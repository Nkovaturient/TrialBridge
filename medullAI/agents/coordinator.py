from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from langchain_core.prompts import ChatPromptTemplate
from langchain_deepseek import ChatDeepSeek
from langgraph.graph import END, START, StateGraph

from patient_agent import parse_patient
from schemas import CoordinatorState, MatchResult, PatientProfile, TrialCriteria
from trial_agent import parse_trial

# ---------------------------------------------------------------------------
# Score-match LLM chain
# ---------------------------------------------------------------------------

_SCORE_SYSTEM = """\
You are a clinical trial eligibility assessor. Given a patient profile and trial criteria, you must:
1. Check whether the patient meets all inclusion criteria.
2. Check whether any exclusion criteria apply.
3. Assign an eligibility score from 0 (no match) to 100 (perfect match).
4. Provide a concise plain-English rationale.
5. List any specific exclusion criteria that disqualify the patient.

Be precise. Do not invent clinical data not present in the inputs.
If prior chemotherapy or radiotherapy is an exclusion criterion, check the patient's prior_treatment list.
"""

_SCORE_HUMAN = """\
TRIAL CRITERIA:
{trial_criteria}

PATIENT PROFILE:
{patient_profile}

Assess eligibility and return a structured MatchResult.
"""

_score_prompt = ChatPromptTemplate.from_messages([
    ("system", _SCORE_SYSTEM),
    ("human", _SCORE_HUMAN),
])

_score_chain = None


def _get_score_chain():
    global _score_chain
    if _score_chain is None:
        llm = ChatDeepSeek(model="deepseek-chat", temperature=0, max_retries=2)
        _score_chain = _score_prompt | llm.with_structured_output(MatchResult)
    return _score_chain


# ---------------------------------------------------------------------------
# Hard-filter helpers
# ---------------------------------------------------------------------------

def _gender_ok(trial: TrialCriteria, patient: PatientProfile) -> bool:
    if trial.gender == "both":
        return True
    return trial.gender == patient.gender


def _age_ok(trial: TrialCriteria, patient: PatientProfile) -> bool:
    if trial.age_min_months is not None and patient.age_months < trial.age_min_months:
        return False
    if trial.age_max_months is not None and patient.age_months > trial.age_max_months:
        return False
    return True


def _status_ok(trial: TrialCriteria) -> bool:
    return "recruit" in trial.status.lower()


# ---------------------------------------------------------------------------
# score_match node
# ---------------------------------------------------------------------------

def score_match(state: CoordinatorState) -> dict:
    """LangGraph node: hard-filter then LLM eligibility scoring."""
    trial: TrialCriteria = state["trial_criteria"]
    patient: PatientProfile = state["patient_profile"]

    if not _status_ok(trial):
        return {
            "match_result": MatchResult(
                patient_id=patient.patient_id,
                trial_id=trial.trial_id,
                eligible=False,
                score=0,
                hard_filter_passed=False,
                rationale=f"Trial status is '{trial.status}' — not currently recruiting.",
                disqualifying_criteria=["Trial is not recruiting"],
            )
        }

    if not _gender_ok(trial, patient):
        return {
            "match_result": MatchResult(
                patient_id=patient.patient_id,
                trial_id=trial.trial_id,
                eligible=False,
                score=0,
                hard_filter_passed=False,
                rationale=f"Gender mismatch: trial requires '{trial.gender}', patient is '{patient.gender}'.",
                disqualifying_criteria=["Gender exclusion"],
            )
        }

    if not _age_ok(trial, patient):
        min_y = (trial.age_min_months or 0) // 12
        max_y = (trial.age_max_months or 9999) // 12
        age_y = patient.age_months // 12
        return {
            "match_result": MatchResult(
                patient_id=patient.patient_id,
                trial_id=trial.trial_id,
                eligible=False,
                score=0,
                hard_filter_passed=False,
                rationale=f"Age out of range: trial requires {min_y}–{max_y} years, patient is {age_y} years.",
                disqualifying_criteria=["Age outside eligibility range"],
            )
        }

    result: MatchResult = _get_score_chain().invoke({
        "trial_criteria": trial.model_dump_json(indent=2),
        "patient_profile": patient.model_dump_json(indent=2),
    })
    result.patient_id = patient.patient_id
    result.trial_id = trial.trial_id
    result.hard_filter_passed = True
    return {"match_result": result}


# ---------------------------------------------------------------------------
# Graph definition
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    builder = StateGraph(CoordinatorState)

    builder.add_node("parse_trial", parse_trial)
    builder.add_node("parse_patient", parse_patient)
    builder.add_node("score_match", score_match)

    # Fan-out: both parse nodes run concurrently from START
    builder.add_edge(START, "parse_trial")
    builder.add_edge(START, "parse_patient")

    # Fan-in: score_match waits for both parse nodes
    builder.add_edge("parse_trial", "score_match")
    builder.add_edge("parse_patient", "score_match")

    builder.add_edge("score_match", END)

    return builder.compile()


graph = build_graph()


# ---------------------------------------------------------------------------
# CLI entry-point for quick validation
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import glob
    import pathlib

    base = pathlib.Path(__file__).parent / "datasets"
    trials = sorted(glob.glob(str(base / "trials" / "*.json")))
    patients = sorted(glob.glob(str(base / "patients" / "*.json")))

    if not trials or not patients:
        print("No seed data found. Run from agents/ directory.")
        raise SystemExit(1)

    with open(trials[0]) as f:
        raw_trial = json.load(f)
    with open(patients[0]) as f:
        raw_patient = json.load(f)

    print(f"Running match: {raw_trial['ctri_number']} × {raw_patient['patient_id']}")
    final_state = graph.invoke({
        "raw_trial": raw_trial,
        "raw_patient": raw_patient,
        "trial_criteria": None,
        "patient_profile": None,
        "match_result": None,
    })

    result: MatchResult = final_state["match_result"]
    print("\n=== MatchResult ===")
    print(result.model_dump_json(indent=2))
