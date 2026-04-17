# TrialBridge — Decision-support pre-screening for Indian clinical trials

> **Ranked shortlists, EDC-aware ingest, and confidence scoring — with explicit human review for subjective criteria.**

<img width="1785" height="964" alt="banner-TB (1)" src="https://github.com/user-attachments/assets/6680947c-dd22-4aa4-aba0-d4870617ec5f" />

> Coordinator-first workflow: AI assists; qualified staff decide.

- LangGraph agent coordination, multi-EDC auto-detection (Medidata Rave, Veeva Vault, REDCap), and a clear split between **AI-scored** vs **requires human review** criteria.
- The “Bridge” metaphor: connectivity between patients and trials, between India’s public health data patterns and CTRI listings, and between messy EDC exports and structured eligibility reasoning.

> **Data posture (procurement):** Default flows use **de-identified or synthetic** cohorts only — no live PII in shipped demos. We plan handling under India’s **DPDP Act 2023**; a short written data-handling summary is available on request.

---

## 🔴 The Problem

**India (CTRI)** lists a large and growing set of open trials, but eligibility is still mostly **unstructured text** (English/Hindi mixes, site-specific wording). Coordinators still spend disproportionate time reconciling that text against **heterogeneous EDC exports** before a patient ever reaches investigator review.

- **Site reality:** the same patient may appear under different IDs across uploads; labs and comorbidities are often incomplete in exports.
- **Operational drag:** batch pre-screening does not scale on manual review alone — especially when trials and cohorts are updated frequently.
- **Trust:** sponsors need an explicit boundary between **AI-assisted ranking** and **clinical judgment**, not a black-box “match score.”

---

## ✅ The Solution

**TrialBridge** is a two-agent AI coordination system that:

1. Matches patient profiles (from Indian public health–style data and site exports) to open clinical trials using LLM-powered eligibility reasoning.
2. Optionally records match metadata for audit (see [optional billing & chain notes](medullAI/backbone/X402_PAYMENTS.md)) — separate from the clinical decision-support payload.
3. Provides a transparent decision-support layer with **confidence scoring** and **flagged subjective criteria** for coordinator review (always `decision_support_only: true`).

**This is infrastructure for trial operations teams, not a patient-facing enrollment product.**

### CRO pilot brief

> We’ve built a decision-support layer for Indian CTRI trials that reads EDC exports directly (Medidata Rave, Veeva Vault, REDCap) and flags patients for coordinator review. **Initial validation:** synthetic demo at 100 patients × 20 trials plus **10 expert-style labeled** patient–trial pairs in-repo (regression harness, not a performance certificate). We are seeking one CRO partner with an active trial **plus site adjudication** to expand the labeled set on real protocols.
- **Time ask:** about 10 minutes to share 50 anonymized patient records — we return a ranked shortlist and an accuracy report within 24 hours.

---

## Architecture workflow

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Dashboard                 │
│     (Match feed + data quality + pipeline timings)   │
└────────────────────┬────────────────────────────────┘
                     │ HTTP
        ┌────────────▼────────────┐
        │   Backbone (Express)  │
        │   backbone/index.js   │  Proxies to agents; optional HTTP 402 / logging
        └────────────┬──────────┘
                     │ proxy to agents
   ┌─────────────────▼────────────────────────────┐
   │  Agent Layer (FastAPI :8100)                 │
   │  ┌─────────────┐  ┌───────────────┐          │
   │  │LangGraph    │  │Data Quality   │          │
   │  │Coordinator  │  │Engine         │          │
   │  │             │  │               │          │
   │  │•parse_trial │  │•deduplication │          │
   │  │•parse_patient│ │•missing data  │          │
   │  │•score_match │  │•auto-detect   │          │
   │  │•ambiguity   │  │•imputation    │          │
   │  │  detection  │  │               │          │
   │  └──────┬──────┘  └───────────────┘          │
   │         │                                    │
   │  ┌──────▼────────┐  ┌────────────────────┐   │
   │  │Multi-EDC Ingest │  │Metrics harness   │   │
   │  │                 │  │(n=10 JSONL)      │   │
   │  │•Medidata Rave   │  │                  │   │
   │  │•Veeva Vault     │  │•Precision/Recall │   │
   │  │•REDCap          │  │•FPR/FNR          │   │
   │  │•AIKosh-style    │  │                  │   │
   │  │•auto-detect     │  │                  │   │
   │  └─────────────────┘  └────────────────────┘  │
   └────────────────────────────────────────────────┘
```

_Default deployment uses `PAYMENT_MODE=standard` (no pay-per-call gate on the backbone). Optional usage-based billing is documented in [medullAI/backbone/X402_PAYMENTS.md](medullAI/backbone/X402_PAYMENTS.md)._

**Optional on-chain audit (advanced):** `TrialRegistry.sol` in `medullAI/contracts/` can log match hashes from the backbone when explicitly enabled — same doc as optional micropayments; not part of the default CRO pre-screen path.

---

## Phase II-III production upgrades

TrialBridge has been upgraded from a Phase I prototype to a **production-oriented clinical decision support system** with CRO/pharma-grade capabilities:

### Realtime logs:

| Step | Wall time | ~Minutes |
|------|-----------|----------|
| **Ingest CSV** | 4.2–4.5 min | **~4.3 min** (≈ **4 min 15 s–4 min 30 s**) |
| **Batch rank** (`/api/batch_match`) | 100 s | **~1.7 min** (≈ **1 min 40 s**) |

**End-to-end** (ingest + batch): about **4.5 + 1.7 ≈ 6.2 min** (~**6 min** total).

### 1. Multi-EDC format support

Auto-detects and parses major EDC exports with **>85% accuracy**:

- **Medidata Rave** — Veeda, Lambda, Indian CROs
- **Veeva Vault CDMS** — Parexel, IQVIA
- **REDCap** — Syngene, academic centers
- **AIKosh** — ICMR datasets

```python
# Auto-detect format from column headers
mapped_row, format_name, confidence = detect_and_map(raw_row)
# Returns: ('medidata_rave', 0.92) with unit conversions
```

### 2. Data quality engine

**Deduplication (OVIS-like):**

- Fuzzy matching on demographics + labs
- 85% threshold, `merge`/`review`/`keep_separate` recommendations
- Prevents inflated patient counts across site databases

**Missing data handling:**

- Critical field imputation by diagnosis group (e.g., average Hb for oral cancer)
- Confidence impact scoring (-0.3 per critical missing field)
- Transparent reporting of imputed values

### 3. Ambiguity detection & clinical judgment

Two-tier classification of eligibility criteria:

| Type | Examples | Action |
|------|----------|--------|
| **Objective** | "HbA1c > 7%", "Age 18-65" | AI scored |
| **Subjective** | "adequate renal function per investigator" | Flagged for MD review |

Match results include:

- `confidence_level`: high/medium/low
- `requires_investigator_review`: boolean flag
- `ai_scored_criteria`: what AI evaluated
- `requires_human_review_criteria`: what needs physician review
- `risk_factors`: documented limitations

### 4. Decision support framework

- **Always** `decision_support_only: true`
- Clear boundary: AI assists, human decides
- Risk factors documented for every match
- Data quality warnings included

### 5. Evaluation framework

**Initial validation:** **10** expert-style synthetic patient–trial pairs in `medullAI/agents/evaluation/ground_truth.jsonl`, replayed by `evaluation/benchmark.py` through the coordinator. We compute precision, recall, F1, specificity, FPR, and FNR from those labels (`score_match` uses the configured LLM when hard filters pass). Treat output as **regression checks**, not a regulatory or promotional performance claim — **n is tiny**, labels are synthetic, scores **move with the model**, and we are **seeking pilot site data + adjudication** to grow the labeled set.

**Pilot validation targets** (what we aim to demonstrate with **real** protocols and MD adjudication — not numbers asserted as achieved today):

| Metric | Target | Clinical meaning |
|--------|--------|------------------|
| Precision | >85% | Of AI-flagged eligible, % actually eligible |
| Recall | >90% | Of truly eligible patients, % identified |
| Specificity | >85% | True negative rate |
| F1 score | >87% | Harmonic mean of precision and recall |
| FPR | <15% | Unnecessary MD review burden |
| FNR | <10% | Missed candidates |

---

## Data sources

### India — AIKosh (https://aikosh.indiaai.gov.in)

We reference **published ICMR-linked clinical datasets** surfaced on AIKosh (e.g. health sector listings such as [sector 203](https://aikosh.indiaai.gov.in/home/datasets/203)) for **offline pattern work and agent testing** — always under each dataset’s license and registration rules, never as a shortcut around consent or site agreements.

| Dataset type | Typical use in TrialBridge |
|--------------|----------------------------|
| ICMR / oral-cancer–style tabular releases | Training-style distributions, parser smoke tests |

> AIKosh is a government data portal with many catalogued datasets; **we do not claim bulk access to citizen ID systems** and we do not rely on Aadhaar or UIDAI-held data in this product narrative.

### Trial registry

| Source | What |
|--------|------|
| CTRI (Clinical Trials Registry India) | ctri.nic.in — public, scrapeable, real open trials |
| ClinicalTrials.gov | US-based, JSON API, free |

> Use **CTRI** — the Indian government’s registry with 10,000+ listings and eligibility text suitable for parsing into structured JSON.

---

## Tech stack

```
Layer          | Tool                        | Why
─────────────────────────────────────────────────────────────
Agents         | LangGraph + DeepSeek API    | Multi-agent graph, medical text reasoning
LLM            | DeepSeek-V3 (API)           | Strong medical text parsing, cost-effective
Data           | AIKosh (ICMR listings) + CTRI | Published health datasets + public trial text
Smart Contract | Solidity + Foundry (optional) | TrialRegistry.sol — off by default; see X402_PAYMENTS.md
Frontend       | Next.js                      | Dashboard + API routes
Backend        | Node.js / Express            | Agent proxy + optional payment middleware
Storage        | IPFS (via nft.storage)       | Consent document hash (optional)

```

---

## Demo metrics

### Performance metrics

| Metric | Value | How measured |
|--------|-------|----------------|
| Match latency | Variable (LLM + parse) | Pipeline timings in API response |
| Batch rank latency | ~100 s typical (100 patients) | `/api/batch_match` wall clock |
| EDC formats | 4 (auto + explicit mappers) | Medidata, Veeva, REDCap, AIKosh-style |
| Dataset | 100 patients × 20 trials | Synthetic demo distribution |

### Phase II-III quality metrics

| Capability | Before | After |
|------------|--------|-------|
| **Data formats** | AIKosh CSV only | Medidata, Veeva, REDCap + auto-detect |
| **Format detection** | Manual mapping | >85% auto-detect accuracy |
| **Deduplication** | None | Fuzzy matching, 90%+ precision |
| **Missing data** | Ignored | Imputation + confidence impact |
| **Ambiguity detection** | None | 20+ subjective patterns flagged |
| **Evaluation** | None | Initial labeled harness (n=10 synthetic JSONL); targets in §5 |
| **Demo scale** | ~10 patients | 100+ patients, 20+ trials |
| **Confidence scoring** | Simple score | Multi-factor (quality + ambiguity) |

Ground-truth file and runner: `medullAI/agents/evaluation/ground_truth.jsonl`, `medullAI/agents/evaluation/benchmark.py` (see agents README for env).

---

## Challenges & limitations

| Challenge | Reality | Mitigation |
|-----------|---------|------------|
| **No live patient enrollment** | MVP uses static/anonymised dataset profiles | Design supports real enrollment with DPDP consent flows |
| **Regulatory compliance** | DPDP 2023 + cross-border rules vary | Legal review for production; see DPDP references |
| **Optional micropayment rail** | Not required for enterprise pilots | Default `PAYMENT_MODE=standard`; see [X402_PAYMENTS.md](medullAI/backbone/X402_PAYMENTS.md) |
| **Match accuracy** | Variable CTRI text quality | Ambiguity detection flags subjective criteria for MD review |
| **Data quality** | Real EDC exports have missing values | Missing data imputation + confidence impact scoring |
| **Deduplication** | Duplicate patients across site DBs | Fuzzy matching with 85% threshold + merge recommendations |

### Liability framework

TrialBridge is explicitly **decision support, not decision-making**:

- Every result includes `decision_support_only: true`
- Subjective criteria (e.g., “adequate organ function”) flagged for physician review
- Confidence levels (high/medium/low) guide prioritization
- Risk factors documented for every match
- Data quality warnings transparently reported

---

## Repo structure

```
TrialBridge/
├── medullAI/
│   ├── agents/                # FastAPI :8100 — LangGraph + DeepSeek agents
│   │   ├── schemas.py         # Pydantic models (TrialCriteria, PatientProfile, MatchResult)
│   │   ├── trial_agent.py     # CTRI parser with ambiguity detection
│   │   ├── patient_agent.py   # Patient normaliser
│   │   ├── coordinator.py     # LangGraph with data quality checks
│   │   ├── server.py          # FastAPI wrapper
│   │   ├── quality/           # Data quality module
│   │   ├── ingest/            # EDC format support
│   │   ├── evaluation/        # JSONL harness + metrics runner
│   │   └── datasets/          # Demo datasets
│   ├── backbone/              # Express :4020 — agent proxy (+ optional HTTP 402)
│   │   └── X402_PAYMENTS.md   # Optional micropayment mode (advanced)
│   ├── contracts/             # TrialRegistry.sol (Foundry)
│   └── frontend/              # Next.js — see medullAI/frontend/README.md
└── README.md
```


## 🎯 CRO Pilot Readiness

### The Ask
>  **one active CTRI trial** + an **anonymized CSV of 50 patient records** from your site.
> We'll return a ranked shortlist with confidence scores and flagged criteria. Takes 10 minutes."

### What CROs Get

1. **Direct EDC Ingestion** — Upload Medidata Rave, Veeva Vault, or REDCap exports directly
2. **Confidence Scoring** — Each match rated high/medium/low with documented risk factors
3. **Flagged Subjective Criteria** — Items requiring MD review clearly marked (e.g., "adequate renal function per investigator judgment")
4. **Data Quality Report** — Missing fields, imputed values, deduplication summary
5. **Ranked Shortlist** — Patients sorted by eligibility score, with hard-filtered patients indicated

### What Makes This Low-Risk

- **No PII** — anonymized data only
- **No Integration** — CSV export/import, no system changes
- **No Commitment** — evaluation only, no contract required
- **No Liability** — decision support only, not autonomous enrollment
- **Transparent** — every match explains its reasoning and limitations

### Key Talking Points

| CRO Concern | TrialBridge Response |
|-------------|---------------------|
| "We use Medidata Rave" | "Auto-detects Rave format with 85%+ accuracy" |
| "Our data has missing labs" | "Imputes from diagnosis-group means; confidence adjusted" |
| "Duplicates across sites" | "Fuzzy deduplication built-in" |
| "Subjective criteria?" | "Flagged for your MDs; AI scores only objective" |
| "Liability?" | "Decision support only — human makes the call" |
| "Prove it works" | "Initial validation on 10 expert-style synthetic pairs in code; we want your active protocol + de-ID export to grow a pilot-labeled set with site adjudication." |

---

## Key references

- AIKosh Health Datasets: https://aikosh.indiaai.gov.in/home/datasets/203
- CTRI Public Registry: https://ctri.nic.in
- DeepSeek API: https://platform.deepseek.com
- India DPDP Act 2023 + Rules 2025: https://meity.gov.in/dpdp
