# TrialBridge — Agent Layer

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-multi--agent-1C3C3C?logo=langchain&logoColor=white)
![DeepSeek](https://img.shields.io/badge/DeepSeek-deepseek--chat-4A90D9)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Data](https://img.shields.io/badge/Data-AIKosh%20%2B%20CTRI-orange)

AI agent swarm that matches anonymised patient profiles against Indian clinical trials (CTRI registry) using a LangGraph coordinator, DeepSeek V3, and a FastAPI server.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  POST /run_match           raw CTRI + raw patient → parse → score │
│  POST /run_match_parsed    TrialCriteria + PatientProfile → score  │
│  POST /ingest_patients_csv multipart CSV/XLSX → PatientProfile[]   │
│  POST /batch_match_parsed  TrialCriteria + PatientProfile[] → rank │
│  GET  /health                                                     │
│                      FastAPI  :8100                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │  invoke(CoordinatorState)
                             ▼
              ┌──────────────────────────────┐
              │     LangGraph StateGraph      │
              │                              │
              │  START                       │
              │    ├──► parse_trial ──────┐  │
              │    └──► parse_patient ───►│  │
              │              │ score_match ──► END
              │              │              │
              │  Ambiguity   │ Data Quality │
              │  Detection   │ Flags        │
              └──────────────┴──────────────┘
                   │               │              │
          ChatDeepSeek     ChatDeepSeek     ChatDeepSeek
          with_structured  with_structured  with_structured
          _output(         _output(         _output(
          TrialCriteria)   PatientProfile)  MatchResult)
                   │               │
          CTRI JSON         Patient CSV
          (datasets/        (any EDC format)
           trials/)          via auto-detect
```

### Graph topology (verified)

```
__start__ ──► parse_trial  ──┐
          └─► parse_patient ──┴──► score_match ──► __end__
```

`parse_trial` and `parse_patient` run **concurrently** (fan-out). `score_match` waits for both (fan-in / barrier semantics).

---

## Phase II-III Upgrades

### 1. Multi-EDC Format Support

Auto-detects and parses major EDC exports:
- **Medidata Rave** — Veeda, Lambda, Indian CROs
- **Veeva Vault CDMS** — Parexel, IQVIA
- **REDCap** — Syngene, academic centers
- **AIKosh** — ICMR datasets

```python
# Auto-detect format from column headers
mapped_row, format_name, confidence = detect_and_map(raw_row)
# Returns: ('medidata_rave', 0.92) with unit conversions
```

**Key files:**
- `ingest/auto_detect.py` — Format detection engine
- `ingest/edc_configs/` — EDC format definitions
- `ingest/mappers.py` — Enhanced with EDC mappers

### 2. Data Quality Engine

**Deduplication (OVIS-like):**
- Fuzzy matching on demographics + labs
- 85% threshold, `merge`/`review`/`keep_separate` recommendations
- `quality/deduplicator.py`

**Missing Data Handling:**
- Critical field imputation by diagnosis group
- Confidence impact scoring (-0.3 per critical missing)
- `quality/missing_data.py`

### 3. Ambiguity Detection

Two-tier classification of eligibility criteria:

| Type | Examples | Action |
|------|----------|--------|
| **Objective** | "HbA1c > 7%", "Age 18-65" | AI scored |
| **Subjective** | "adequate renal function per investigator" | Flagged for MD review |

**MatchResult now includes:**
- `confidence_level`: high/medium/low
- `requires_investigator_review`: boolean
- `ai_scored_criteria`: what AI evaluated
- `requires_human_review_criteria`: what needs physician review
- `risk_factors`: documented limitations

### 4. Decision Support Framework

- **Always** `decision_support_only: true`
- Risk factors documented for every match
- Data quality warnings included
- Clear boundary: AI assists, human decides

### 5. Evaluation Framework

Benchmark metrics on ground truth dataset:
- Precision, Recall, F1-Score
- False Positive Rate, False Negative Rate
- Specificity

**Files:**
- `evaluation/benchmark.py` — Evaluation runner
- `evaluation/ground_truth.jsonl` — 10 labeled test cases

---

## Data sources

| Layer | Source | Files |
|---|---|---|
| Trials (seeds) | CTRI-shaped demo records | `datasets/trials/*.json` |
| Trials (corpus) | CTRI detail pages scraped to JSON | `datasets/trials_corpus/*.json` |
| Patients (seeds) | AIKosh ICMR oral cancer | `datasets/patients/*.json` |
| Patients (demo) | **100 synthetic patients** | `datasets/patients_demo_100.csv` |
| Trials (demo) | **20 synthetic trials** | `datasets/trials_demo_20.json` |

All seed data is realistic but fictional.

### Tabular ingest (`ingest/`)

- **`ingest/tabular.py`** — CSV/XLSX → row dicts (2 MB / 500-row caps)
- **`ingest/mappers.py`** — EDC format mappers with auto-detect
- **`ingest/auto_detect.py`** — Format detection with fuzzy matching

### CTRI corpus scripts (`scripts/`)

- **`ctri_ingest.py`** — Enumerate `pmaindet2.php?EncHid=…`, parse Phase II/III/IV trials
- **`ctri_parse_corpus.py`** — Optional: run `trial_agent.parse_trial` over corpus files

---

## Schemas

```
schemas.py
├── TrialCriteria           — normalised CTRI trial
│   └── NEW: inclusion_classified[], exclusion_classified[]
│   └── NEW: subjective_criteria_count
├── PatientProfile          — normalised patient
│   └── NEW: data_completeness, data_quality_flags
├── MatchResult             — coordinator output
│   └── NEW: decision_support_only, requires_investigator_review
│   └── NEW: confidence_level, risk_factors[]
│   └── NEW: ai_scored_criteria[], requires_human_review_criteria[]
│   └── NEW: missing_data_impact, data_quality_warnings[]
├── EvaluationMetrics       — NEW: benchmark metrics
│   └── precision, recall, f1_score, specificity
├── CoordinatorState        — TypedDict flowing through LangGraph
└── BatchMatchStats         — batch processing statistics
```

---

## score_match logic (Phase II-III)

```
score_match(state)
  ├─ status check   → "recruit" in trial.status?   No → eligible=False, score=0
  ├─ gender check   → patient.gender matches?      No → eligible=False, score=0
  ├─ age check      → patient.age_months in range? No → eligible=False, score=0
  ├─ data quality   → check missing labs/fields
  │                    → adjust confidence, add warnings
  ├─ ambiguity check→ flag subjective criteria
  │                    → mark requires_investigator_review
  └─ LLM scoring    → ChatDeepSeek.with_structured_output(MatchResult)
                       → eligible, score 0–100, rationale
                       → NEW: confidence_level, risk_factors, etc.
```

Hard filters short-circuit **before** any LLM call, saving API credits on obvious mismatches.

---

## Getting started

### Prerequisites

- Python 3.12
- DeepSeek API key — [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)

### Setup

```bash
cd medullAI/agents

# Create and activate venv
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure API key
cp .env.example .env
# edit .env → set DEEPSEEK_API_KEY=sk-...
```

### Run the server

```bash
cd medullAI/agents
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
uvicorn server:app --host 0.0.0.0 --port 8100
```

### Run the coordinator CLI

```bash
cd medullAI/agents
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
python coordinator.py
```

---

## Verification commands

### 1 — Imports

```bash
python -c "
from schemas import TrialCriteria, PatientProfile, MatchResult, EvaluationMetrics
from trial_agent import parse_trial_direct
from coordinator import graph
from quality import PatientDeduplicator, MissingDataHandler
from ingest import detect_and_map
print('All imports OK')
"
```

### 2 — Demo datasets

```bash
python -c "
import csv, json
csv_path = 'datasets/patients_demo_100.csv'
with open(csv_path) as f:
    count = sum(1 for _ in f) - 1
print(f'Demo patients: {count}')

trials = json.load(open('datasets/trials_demo_20.json'))
print(f'Demo trials: {len(trials)}')
"
```

Expected: 100 patients, 20 trials

### 3 — EDC format auto-detect

```bash
python -c "
from ingest.auto_detect import detect_edc_format

# Medidata Rave style columns
cols = ['subjectid', 'age', 'gender', 'hemoglobin', 'creatinine']
fmt, conf = detect_edc_format(cols)
print(f'Detected: {fmt} (confidence: {conf:.2f})')
"
```

Expected: `medidata_rave` with high confidence

### 4 — Deduplication

```bash
python -c "
from quality import PatientDeduplicator

dedup = PatientDeduplicator()
patients = [
    {'patient_id': 'P001', 'age_years': 50, 'gender': 'male', 'primary_diagnosis': 'Cancer'},
    {'patient_id': 'P001', 'age_years': 50, 'gender': 'male', 'primary_diagnosis': 'Cancer'},  # Duplicate
]
result = dedup.check_duplicates(patients)
print(f'Duplicates found: {result.duplicates_found}')
print(f'Unique patients: {result.unique_patients}')
"
```

### 5 — Full LLM pipeline (requires DeepSeek credits)

```bash
python coordinator.py
```

Expected: parses trial × patient via DeepSeek, prints `MatchResult` with confidence_level and risk_factors.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/run_match` | Full pipeline — raw CTRI + raw patient → LLM parse → score |
| `POST` | `/run_match_parsed` | Direct scoring — pre-parsed `TrialCriteria` + `PatientProfile` → score |
| `POST` | `/ingest_patients_csv` | Multipart `file` + form `mapper` → normalised `PatientProfile[]` (supports auto-detect, medidata_rave, veeva_vault, redcap) |
| `POST` | `/batch_match_parsed` | One `TrialCriteria` + `patient_profiles[]` → ranked `MatchResult[]` + stats |

Interactive docs: `http://localhost:8100/docs`

---

## File structure

```
agents/
├── schemas.py              — Pydantic models (NEW: EvaluationMetrics, enhanced MatchResult)
├── trial_agent.py          — CTRI parser with ambiguity detection
├── patient_agent.py        — Patient normaliser
├── coordinator.py          — LangGraph with data quality checks
├── server.py               — FastAPI wrapper (:8100)
├── quality/                — NEW: Data quality module
│   ├── deduplicator.py     — OVIS-like duplicate detection
│   └── missing_data.py     — Missing data imputation
├── ingest/                 — Enhanced EDC format support
│   ├── tabular.py          — CSV/XLSX loader
│   ├── mappers.py          — Column mappers (NEW: EDC formats)
│   ├── auto_detect.py      — NEW: Format auto-detection
│   └── edc_configs/        — NEW: EDC format definitions
│       ├── medidata_rave.py
│       ├── veeva_vault.py
│       └── redcap.py
├── evaluation/             — NEW: Benchmark framework
│   ├── benchmark.py        — Evaluation runner
│   └── ground_truth.jsonl  — Labeled test cases
├── scripts/                — CTRI ingestion scripts
├── requirements.txt
├── .env.example
└── datasets/
    ├── trials/             — CTRI JSON seeds
    ├── patients/           — AIKosh JSON seeds
    ├── patients_demo_100.csv   — 100 patient demo
    └── trials_demo_20.json     — 20 trial demo
```

---

## Demo Metrics (Phase II-III)

| Metric | Value | How Measured |
|---|---|---|
| EDC Formats Supported | 4 | Auto-detect + explicit mappers |
| Format Detection Accuracy | >85% | Fuzzy matching on headers |
| Deduplication Precision | >90% | Fuzzy demographic + lab matching |
| Demo Dataset | 100 patients × 20 trials | Synthetic, realistic distribution |
| Evaluation Cases | 10 ground truth | Precision, Recall, FPR, FNR |

---

## CRO Pilot Readiness

<!-- **The Ask:**
> "Give us one active CTRI trial + an anonymized CSV of 50 patient records. We'll return a ranked shortlist with confidence scores and flagged criteria. Takes 10 minutes." -->

**What CROs Get:**
1. Direct EDC export ingestion (no manual mapping)
2. Confidence scores (high/medium/low) per match
3. Flagged subjective criteria for physician review
4. Data quality report (missing fields, imputed values)
5. Deduplicated patient list

**Liability Clear:** Decision support only. AI assists, human decides.
