"""
CTRI recruiting-trial corpus ingester.

Strategy
--------
CTRI's advanced-search form is protected by a visual security code, so
automated POST-based search is not viable.  Instead, detail pages are
directly accessible at:

    https://ctri.nic.in/Clinicaltrials/pmaindet2.php?EncHid=<b64>

where EncHid = base64(str(sequential_integer)).  Total registered trials
are ~108,000.  This script enumerates a configurable range, fetching each
detail page, parsing key fields, and writing recruiting Phase II/III/IV
trials to:

    agents/datasets/trials_corpus/<CTRI_ID>.json
    agents/datasets/trials_corpus/index.jsonl       (manifest, one line per trial)
    agents/datasets/trials_corpus/.checkpoint        (last enc_id for resumable runs)

Usage: # python3 scripts/ctri_ingest.py --start 1 --end 100 --delay-min 0.5 --delay-max 1.2 2>&1
-----
    python scripts/ctri_ingest.py [--start N] [--end N] [--delay-min 1.0] [--delay-max 3.0]

Defaults: start=1, end=2000 (covers early 2007-2010 registry, ~200-400 recruiting).
Resumable: if .checkpoint exists, start is overridden by checkpoint value.
"""
from __future__ import annotations

import argparse
import base64
import json
import logging
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://ctri.nic.in/Clinicaltrials"
DETAIL_URL = f"{BASE_URL}/pmaindet2.php"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": f"{BASE_URL}/pubview.php",
}

CORPUS_DIR = Path(__file__).resolve().parent.parent / "datasets" / "trials_corpus"
CHECKPOINT_FILE = CORPUS_DIR / ".checkpoint"
MANIFEST_FILE = CORPUS_DIR / "index.jsonl"

# Phases to include (lowercase match)
TARGET_PHASES = {"phase 2", "phase 3", "phase 4", "phase ii", "phase iii", "phase iv"}

MAX_RETRIES = 3
RETRY_DELAY = 5.0  # seconds between retry attempts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ctri_ingest")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def enc_hid(i: int) -> str:
    return base64.b64encode(str(i).encode()).decode()


def parse_status(status_text: str) -> dict:
    lower = status_text.lower().strip()
    return {
        "raw": status_text.strip(),
        "is_open": any(word in lower for word in ["recruit", "open"]),
        "priority": 1 if "not yet" in lower else 2,
    }


def _cell_text(cell) -> str:
    return cell.get_text(separator=" ", strip=True).replace("\xa0", " ")


def extract_field(soup: BeautifulSoup, label_pattern: str) -> str:
    """Find a <tr> whose direct-child first cell matches label_pattern; return second cell text."""
    pat = re.compile(label_pattern, re.IGNORECASE)
    for row in soup.find_all("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) >= 2:
            label = _cell_text(cells[0])
            if pat.search(label):
                return _cell_text(cells[1])
    return ""


def extract_inclusion_exclusion(soup: BeautifulSoup) -> tuple[str, str]:
    """Extract inclusion and exclusion criteria text from detail page."""
    inclusion = exclusion = ""
    rows = soup.find_all("tr")
    for row in rows:
        cells = row.find_all("td", recursive=False)
        if not cells:
            continue
        label = _cell_text(cells[0])

        if re.search(r"Inclusion Criteria", label, re.IGNORECASE):
            sub_rows = row.find_all("tr")
            for sub in sub_rows:
                sub_cells = sub.find_all("td", recursive=False)
                if len(sub_cells) >= 2 and re.search(r"^Details$", _cell_text(sub_cells[0]), re.IGNORECASE):
                    inclusion = _cell_text(sub_cells[1])
                    break
            if not inclusion and len(cells) >= 2:
                inclusion = _cell_text(cells[1])

        if re.search(r"Exclusion\s*Criteria", label, re.IGNORECASE):
            sub_rows = row.find_all("tr")
            for sub in sub_rows:
                sub_cells = sub.find_all("td", recursive=False)
                if len(sub_cells) >= 2 and re.search(r"^Details$", _cell_text(sub_cells[0]), re.IGNORECASE):
                    exclusion = _cell_text(sub_cells[1])
                    break
            if not exclusion and len(cells) >= 2:
                exclusion = _cell_text(cells[1])

    return inclusion, exclusion


def extract_age(soup: BeautifulSoup) -> tuple[int | None, int | None]:
    """Return (age_min_months, age_max_months) from inclusion criteria block."""
    age_from_text = extract_field(soup, r"^Age\s*From$")
    age_to_text = extract_field(soup, r"^Age\s*To$")

    def parse_years(text: str) -> int | None:
        m = re.search(r"([\d.]+)\s*Year", text, re.IGNORECASE)
        if m:
            try:
                return int(float(m.group(1)) * 12)
            except ValueError:
                pass
        return None

    return parse_years(age_from_text), parse_years(age_to_text)


def parse_detail_page(html: str, enc_id: int) -> dict | None:
    """Parse a CTRI detail page; return a structured dict or None if invalid/not target phase."""
    if "Invalid Request" in html or len(html) < 2000:
        return None

    soup = BeautifulSoup(html, "html.parser")

    ctri_raw = extract_field(soup, r"^CTRI Number$")
    ctri_match = re.search(r"CTRI/[\d/]+", ctri_raw)
    if not ctri_match:
        return None
    ctri_id = ctri_match.group(0)

    phase_raw = extract_field(soup, r"^Phase of Trial$")
    if not any(ph in phase_raw.lower() for ph in TARGET_PHASES):
        return None

    status_global_raw = extract_field(soup, r"Recruitment Status.*Global")
    status_india_raw = extract_field(soup, r"Recruitment Status.*India")
    status_effective = status_global_raw or status_india_raw
    status = parse_status(status_effective)

    title = extract_field(soup, r"Public Title of Study")
    title = re.sub(r"Modification\(s\)", "", title).strip()

    health_condition = extract_field(soup, r"Health Condition")
    # Direct-child scan for condition cells tagged with health type label
    condition_cells = []
    for row in soup.find_all("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) == 2:
            label = _cell_text(cells[0]).lower()
            val = _cell_text(cells[1])
            if label in {"patients", "healthy volunteers", "both"}:
                condition_cells.append(val)
    condition = condition_cells[0] if condition_cells else health_condition

    # Intervention: scan direct-child rows only
    interventions: list[str] = []
    in_interv_section = False
    for row in soup.find_all("tr"):
        cells = row.find_all("td", recursive=False)
        if not cells:
            continue
        label = _cell_text(cells[0])
        if re.search(r"Intervention.*Comparator", label, re.IGNORECASE):
            in_interv_section = True
        elif in_interv_section and re.search(r"^(Intervention|Comparator Agent)$", label, re.IGNORECASE):
            if len(cells) >= 2:
                name = _cell_text(cells[1])
                if name and name not in {"Name", "Details", "Type"}:
                    interventions.append(name)
        elif in_interv_section and re.search(r"Inclusion Criteria", label, re.IGNORECASE):
            in_interv_section = False

    inclusion, exclusion = extract_inclusion_exclusion(soup)
    age_min, age_max = extract_age(soup)

    gender_raw = extract_field(soup, r"^Gender$").lower().strip()
    if gender_raw in {"male", "males"}:
        gender = "male"
    elif gender_raw in {"female", "females"}:
        gender = "female"
    else:
        gender = "both"

    # Locations: look for rows with 4 direct-child cells (PI | Site | Address | Contact)
    locations: list[str] = []
    for row in soup.find_all("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) == 4:
            site_name = _cell_text(cells[1])
            if site_name and site_name not in {"Name of Site", ""}:
                locations.append(site_name)

    return {
        "ctri_number": ctri_id,
        "enc_hid": enc_id,
        "title": title,
        "phase": phase_raw.strip(),
        "recruitment_status": status_effective.strip(),
        "is_open": status["is_open"],
        "condition": condition.strip(),
        "interventions": interventions[:5],
        "inclusion_criteria": inclusion,
        "exclusion_criteria": exclusion,
        "age_min_years": round(age_min / 12) if age_min else None,
        "age_max_years": round(age_max / 12) if age_max else None,
        "gender": gender,
        "locations": locations[:5],
        "source_url": f"{DETAIL_URL}?EncHid={enc_hid(enc_id)}&Enc=&userName=",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# HTTP fetcher with retry
# ---------------------------------------------------------------------------

def fetch_detail(session: requests.Session, enc_id: int, delay_min: float, delay_max: float) -> str | None:
    url = f"{DETAIL_URL}?EncHid={enc_hid(enc_id)}&Enc=&userName="
    for attempt in range(MAX_RETRIES):
        try:
            resp = session.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                return resp.text
            log.warning("HTTP %d for enc_id=%d (attempt %d)", resp.status_code, enc_id, attempt + 1)
        except requests.RequestException as exc:
            log.warning("Request error enc_id=%d (attempt %d): %s", enc_id, attempt + 1, exc)
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)
    return None


# ---------------------------------------------------------------------------
# Crawler
# ---------------------------------------------------------------------------

def crawl(start: int, end: int, delay_min: float, delay_max: float) -> None:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)

    # Resume from checkpoint
    if CHECKPOINT_FILE.exists():
        saved = int(CHECKPOINT_FILE.read_text().strip())
        if saved >= start:
            start = saved + 1
            log.info("Resuming from checkpoint: enc_id=%d", start)

    session = requests.Session()

    stats = {"pages_seen": 0, "rows_seen": 0, "details_success": 0, "details_failed": 0}

    with open(MANIFEST_FILE, "a", encoding="utf-8") as manifest_f:
        for enc_id in range(start, end + 1):
            stats["pages_seen"] += 1
            html = fetch_detail(session, enc_id, delay_min, delay_max)

            if html is None:
                stats["details_failed"] += 1
                log.debug("Skip enc_id=%d (fetch failed)", enc_id)
            else:
                trial = parse_detail_page(html, enc_id)
                if trial:
                    stats["details_success"] += 1
                    stats["rows_seen"] += 1
                    ctri_safe = trial["ctri_number"].replace("/", "_")
                    out_path = CORPUS_DIR / f"{ctri_safe}.json"
                    out_path.write_text(json.dumps(trial, indent=2, ensure_ascii=False), encoding="utf-8")
                    manifest_f.write(json.dumps({
                        "trial_id": trial["ctri_number"],
                        "enc_hid": enc_id,
                        "title": trial["title"][:120],
                        "phase": trial["phase"],
                        "status": trial["recruitment_status"],
                        "is_open": trial["is_open"],
                        "source_url": trial["source_url"],
                        "scraped_at": trial["scraped_at"],
                    }) + "\n")
                    manifest_f.flush()
                    log.info(
                        "[%d/%d] %-40s  phase=%-8s  open=%s",
                        enc_id, end, trial["ctri_number"], trial["phase"], trial["is_open"],
                    )
                else:
                    log.debug("Skip enc_id=%d (not target phase or invalid)", enc_id)

            # Checkpoint every 50 IDs
            if enc_id % 50 == 0:
                CHECKPOINT_FILE.write_text(str(enc_id))
                log.info(
                    "Checkpoint %d | seen=%d saved=%d failed=%d",
                    enc_id, stats["pages_seen"], stats["details_success"], stats["details_failed"],
                )

            time.sleep(random.uniform(delay_min, delay_max))

    # Final checkpoint
    CHECKPOINT_FILE.write_text(str(end))
    log.info(
        "Done. pages=%d  saved=%d  failed=%d",
        stats["pages_seen"], stats["details_success"], stats["details_failed"],
    )
    if stats["details_success"] < 10:
        log.warning(
            "Coverage too low: only %d trials saved from %d pages. "
            "Widen the range or check HTML structure.",
            stats["details_success"], stats["pages_seen"],
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest recruiting CTRI trials into local JSON corpus")
    parser.add_argument("--start", type=int, default=1, help="First EncHid integer (default 1)")
    parser.add_argument("--end", type=int, default=2000, help="Last EncHid integer (default 2000)")
    parser.add_argument("--delay-min", type=float, default=1.0, help="Min seconds between requests (default 1.0)")
    parser.add_argument("--delay-max", type=float, default=3.0, help="Max seconds between requests (default 3.0)")
    args = parser.parse_args()

    log.info("CTRI ingest  enc_id=%d..%d  delay=%.1f–%.1fs", args.start, args.end, args.delay_min, args.delay_max)
    log.info("Corpus dir: %s", CORPUS_DIR)
    crawl(args.start, args.end, args.delay_min, args.delay_max)


if __name__ == "__main__":
    main()
