from __future__ import annotations

import json
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from langchain_core.prompts import ChatPromptTemplate
from langchain_deepseek import ChatDeepSeek
from langgraph.graph import END, START, StateGraph

from patient_agent import parse_patient
from schemas import CoordinatorState, MatchResult, PatientProfile, TrialCriteria
from trial_agent import parse_trial
from quality import MissingDataHandler

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

IMPORTANT: This is a DECISION SUPPORT tool. Your recommendation should assist a clinical coordinator,
not replace their judgment. Be explicit about what can and cannot be determined from the data.
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
# Confidence and risk assessment
# ---------------------------------------------------------------------------

def _calculate_confidence(
    trial: TrialCriteria,
    patient: PatientProfile,
    match_score: int,
) -> tuple[str, bool, list[str], list[str]]:
    """
    Calculate confidence level and identify risk factors.

    Returns:
        tuple of (confidence_level, requires_review, risk_factors, human_review_criteria)
    """
    risk_factors = []
    requires_review = False
    confidence = "medium"

    # Check for subjective criteria
    subjective_count = sum(
        1 for c in trial.inclusion_classified + trial.exclusion_classified
        if not c.is_objective
    )
    if subjective_count > 0:
        requires_review = True
        risk_factors.append(f"{subjective_count} subjective criteria require clinical judgment")

    # Check for missing data
    if patient.data_completeness < 0.8:
        requires_review = True
        risk_factors.append(f"Patient data incomplete ({patient.data_completeness:.0%})")

    # Check for missing critical lab values
    critical_labs = ["hemoglobin", "platelet_count", "wbc_count"]
    missing_labs = [lab for lab in critical_labs if lab not in patient.lab_values]
    if missing_labs:
        requires_review = True
        risk_factors.append(f"Missing critical lab values: {', '.join(missing_labs)}")

    # Score-based confidence
    if match_score >= 90 and not requires_review:
        confidence = "high"
    elif match_score <= 30:
        confidence = "low"
    elif requires_review:
        confidence = "low"

    # Collect criteria requiring human review
    human_review_criteria = [
        c.criterion_text
        for c in trial.inclusion_classified + trial.exclusion_classified
        if not c.is_objective
    ]

    return confidence, requires_review, risk_factors, human_review_criteria


def _get_ai_scored_criteria(trial: TrialCriteria) -> list[str]:
    """Get list of criteria that were objectively scored by AI."""
    return [
        c.criterion_text
        for c in trial.inclusion_classified + trial.exclusion_classified
        if c.is_objective
    ]


# ---------------------------------------------------------------------------
# score_match node
# ---------------------------------------------------------------------------

def score_match(state: CoordinatorState) -> dict:
    """LangGraph node: hard-filter then LLM eligibility scoring."""
    trial: TrialCriteria = state["trial_criteria"]
    patient: PatientProfile = state["patient_profile"]

    # Check data quality
    missing_data_handler = MissingDataHandler()
    missing_data_report = missing_data_handler.analyze_patient(
        patient.model_dump(),
        apply_imputation=False,
    )

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
                confidence_level="high",
                requires_investigator_review=False,
                missing_data_impact=missing_data_report.confidence_impact,
                data_quality_warnings=missing_data_report.critical_missing,
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
                confidence_level="high",
                requires_investigator_review=False,
                missing_data_impact=missing_data_report.confidence_impact,
                data_quality_warnings=[],
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
                confidence_level="high",
                requires_investigator_review=False,
                missing_data_impact=missing_data_report.confidence_impact,
                data_quality_warnings=[],
            )
        }

    # LLM scoring for patients passing hard filters
    result: MatchResult = _get_score_chain().invoke({
        "trial_criteria": trial.model_dump_json(indent=2),
        "patient_profile": patient.model_dump_json(indent=2),
    })
    result.patient_id = patient.patient_id
    result.trial_id = trial.trial_id
    result.hard_filter_passed = True

    # Add decision support metadata
    confidence, requires_review, risk_factors, human_review_criteria = _calculate_confidence(
        trial, patient, result.score
    )
    result.confidence_level = confidence
    result.requires_investigator_review = requires_review
    result.risk_factors = risk_factors
    result.requires_human_review_criteria = human_review_criteria
    result.ai_scored_criteria = _get_ai_scored_criteria(trial)
    result.missing_data_impact = missing_data_report.confidence_impact
    result.data_quality_warnings = missing_data_report.critical_missing

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
