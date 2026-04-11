# TrialBridge — Agent Layer

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-multi--agent-1C3C3C?logo=langchain&logoColor=white)
![DeepSeek](https://img.shields.io/badge/DeepSeek-deepseek--chat-4A90D9)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Data](https://img.shields.io/badge/Data-AIKosh%20%2B%20CTRI-orange)
<!-- ![License](https://img.shields.io/badge/License-ISC-blue) -->

AI agent swarm that matches anonymised patient profiles against Indian clinical trials (CTRI registry) using a LangGraph coordinator, DeepSeek V3, and a FastAPI server.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  POST /run_match   (raw CTRI JSON + raw AIKosh patient JSON)      │
│  POST /run_match_parsed  (pre-parsed TrialCriteria + Patient)     │
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
              │                     score_match ──► END
              │                              │
              └──────────────────────────────┘
                   │               │              │
          ChatDeepSeek     ChatDeepSeek     ChatDeepSeek
          with_structured  with_structured  with_structured
          _output(         _output(         _output(
          TrialCriteria)   PatientProfile)  MatchResult)
                   │               │
          CTRI JSON         AIKosh patient
          (datasets/        (datasets/
           trials/)          patients/)
```

### Graph topology (verified)

```
__start__ ──► parse_trial  ──┐
          └─► parse_patient ──┴──► score_match ──► __end__
```

`parse_trial` and `parse_patient` run **concurrently** (fan-out). `score_match` waits for both (fan-in / barrier semantics).

---

## Data sources

| Layer | Source | Files |
|---|---|---|
| Trials | CTRI (ctri.nic.in) — 5 realistic records | `datasets/trials/*.json` |
| Patients | AIKosh ICMR oral cancer dataset (anonymised) — 5 profiles | `datasets/patients/*.json` |

All seed data is realistic but fictional. Fields mirror real CTRI record structure and AIKosh oral cancer clinical dataset column shapes.

---

## Schemas

```
schemas.py
├── TrialCriteria     — normalised CTRI trial (trial_id, inclusion[], exclusion[],
│                       age_min/max_months, gender, status, phase …)
├── PatientProfile    — normalised AIKosh patient (patient_id, age_months, gender,
│                       conditions[], lab_values{}, prior_treatment[] …)
├── MatchResult       — coordinator output (eligible, score 0–100, hard_filter_passed,
│                       rationale, disqualifying_criteria[])
└── CoordinatorState  — TypedDict flowing through the LangGraph graph
```

---

## score_match logic

```
score_match(state)
  ├─ status check  → "recruit" in trial.status?   No  → eligible=False, score=0
  ├─ gender check  → patient.gender matches trial? No  → eligible=False, score=0
  ├─ age check     → patient.age_months in range?  No  → eligible=False, score=0
  └─ LLM scoring   → ChatDeepSeek.with_structured_output(MatchResult)
                      → eligible, score 0–100, rationale, disqualifying_criteria[]
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

### Run the coordinator CLI (end-to-end, requires DeepSeek credits)

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
from schemas import TrialCriteria, PatientProfile, MatchResult, CoordinatorState
from trial_agent import parse_trial
from patient_agent import parse_patient
from coordinator import graph
from server import app
print('All imports OK')
"
```

Expected: `All imports OK`

### 2 — Seed data

```bash
python -c "
import json, glob, pathlib
base = pathlib.Path('datasets')
trials  = sorted(glob.glob(str(base / 'trials'   / '*.json')))
patients = sorted(glob.glob(str(base / 'patients' / '*.json')))
print(f'Trials:   {len(trials)}')
print(f'Patients: {len(patients)}')
for t in trials:
    d = json.load(open(t)); print(f'  {d[\"ctri_number\"]}  {d[\"recruitment_status\"]}')
for p in patients:
    d = json.load(open(p)); print(f'  {d[\"patient_id\"]}  {d[\"primary_diagnosis\"][:50]}')
"
```

Expected: 5 trials (all `Recruiting`) + 5 patient profiles.

### 3 — Graph topology

```bash
python -c "
from coordinator import graph
g = graph.get_graph()
print('Nodes:', [n.id for n in g.nodes.values()])
for e in g.edges: print(f'  {e.source} --> {e.target}')
"
```

Expected:
```
Nodes: ['__start__', 'parse_trial', 'parse_patient', 'score_match', '__end__']
  __start__ --> parse_patient
  __start__ --> parse_trial
  parse_patient --> score_match
  parse_trial --> score_match
  score_match --> __end__
```

### 4 — Hard-filter short-circuit (no LLM credits needed)

```bash
uvicorn server:app --port 8100 &
sleep 2

# Age out of range
curl -s http://localhost:8100/run_match_parsed \
  -H "Content-Type: application/json" \
  -d '{
    "trial_criteria": {"trial_id":"T1","title":"Test","condition":"OSCC","intervention":"Drug X",
      "inclusion":["Age 18-70"],"exclusion":[],"age_min_months":216,"age_max_months":840,
      "gender":"both","phase":"Phase 3","status":"Recruiting"},
    "patient_profile": {"patient_id":"P_young","age_months":120,"gender":"male",
      "conditions":["OSCC"],"location_state":"Delhi","lab_values":{}}
  }'

# Trial not recruiting
curl -s http://localhost:8100/run_match_parsed \
  -H "Content-Type: application/json" \
  -d '{
    "trial_criteria": {"trial_id":"T2","title":"Closed","condition":"OSCC","intervention":"Drug Y",
      "inclusion":[],"exclusion":[],"age_min_months":null,"age_max_months":null,
      "gender":"both","phase":"Phase 2","status":"Completed"},
    "patient_profile": {"patient_id":"P_test","age_months":600,"gender":"female",
      "conditions":["OSCC"],"location_state":"Karnataka","lab_values":{}}
  }'
```

Expected (both): `"eligible": false, "score": 0, "hard_filter_passed": false` with a plain-English rationale.

### 5 — Full LLM pipeline (requires DeepSeek credits)

```bash
python coordinator.py
```

Expected: parses trial 1 × patient 1 via DeepSeek, prints `MatchResult` JSON with `score`, `eligible`, `rationale`.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/run_match` | Full pipeline — raw CTRI + raw AIKosh JSON → LLM parse → score |
| `POST` | `/run_match_parsed` | Direct scoring — pre-parsed `TrialCriteria` + `PatientProfile` → score |

Interactive docs: `http://localhost:8100/docs`

---

## File structure

```
agents/
├── schemas.py          — Pydantic models (shared contract)
├── trial_agent.py      — CTRI parser node (ChatDeepSeek → TrialCriteria)
├── patient_agent.py    — Patient normaliser node (ChatDeepSeek → PatientProfile)
├── coordinator.py      — LangGraph StateGraph + score_match + CLI entry-point
├── server.py           — FastAPI wrapper (:8100)
├── requirements.txt
├── .env.example
└── datasets/
    ├── trials/         — 5 CTRI-shaped JSON files
    └── patients/       — 5 AIKosh-shaped JSON files
```
