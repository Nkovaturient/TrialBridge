"""
Parse raw CTRI corpus JSONs into TrialCriteria objects via trial_agent.

Usage:
    python scripts/ctri_parse_corpus.py [--limit N] [--open-only]

Reads:  agents/datasets/trials_corpus/*.json (raw scraper output)
Writes: agents/datasets/trials_corpus_parsed/<CTRI_ID>.json (TrialCriteria JSON)
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

# Resolve agent package root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import argparse
from trial_agent import parse_trial
from schemas import CoordinatorState

log = logging.getLogger("ctri_parse_corpus")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(message)s")

CORPUS_DIR = Path(__file__).resolve().parent.parent / "datasets" / "trials_corpus"
PARSED_DIR = Path(__file__).resolve().parent.parent / "datasets" / "trials_corpus_parsed"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Max trials to parse")
    parser.add_argument("--open-only", action="store_true", help="Only parse open-to-recruitment trials")
    args = parser.parse_args()

    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    raw_files = sorted(CORPUS_DIR.glob("*.json"))
    if args.open_only:
        raw_files = [f for f in raw_files if json.loads(f.read_text()).get("is_open")]
    if args.limit:
        raw_files = raw_files[: args.limit]

    log.info("Parsing %d raw trial files → %s", len(raw_files), PARSED_DIR)
    ok = failed = 0

    for path in raw_files:
        ctri_id = path.stem
        out_path = PARSED_DIR / path.name
        if out_path.exists():
            log.debug("Skip (already parsed): %s", ctri_id)
            continue

        raw = json.loads(path.read_text())
        state: CoordinatorState = {
            "raw_trial": raw,
            "raw_patient": {},
            "trial_criteria": None,
            "patient_profile": None,
            "match_result": None,
        }
        try:
            result = parse_trial(state)
            criteria = result["trial_criteria"]
            out_path.write_text(criteria.model_dump_json(indent=2), encoding="utf-8")
            log.info("Parsed %-45s  score_ready=True", ctri_id)
            ok += 1
        except Exception as exc:
            log.warning("Failed %s: %s", ctri_id, exc)
            failed += 1

    log.info("Done. ok=%d  failed=%d", ok, failed)


if __name__ == "__main__":
    main()
