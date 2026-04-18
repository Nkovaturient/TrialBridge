from __future__ import annotations

import os

from langchain_core.prompts import ChatPromptTemplate
from langchain_deepseek import ChatDeepSeek

from schemas import CoordinatorState, ImputationTrace, PatientProfile

_SYSTEM = """\
You are a clinical data normaliser for Indian patient health records derived from AIKosh datasets.
Your task is to extract and normalise a raw patient JSON record into a structured PatientProfile.

Rules:
- Convert age_years to age_months (multiply by 12).
- Map primary_diagnosis and comorbidities to standard medical condition names.
- Normalise gender: "male" → "male", "female" → "female".
- Extract all lab_values as a flat dict of name→float (e.g. "hemoglobin_g_dl": 11.2).
- Preserve prior_treatment as a list of strings.
- Set smoking_history to true only if the record explicitly mentions smoking or tobacco use.
- If a field is absent, use null/None or an empty list/dict as appropriate.
- Do NOT invent values not present in the source record.
"""

_HUMAN = """\
Normalise the following AIKosh-shaped patient record into a structured profile:

{raw_patient}
"""

_prompt = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM),
    ("human", _HUMAN),
])

_chain = None


def _get_chain():
    global _chain
    if _chain is None:
        llm = ChatDeepSeek(model="deepseek-chat", temperature=0, max_retries=2)
        _chain = _prompt | llm.with_structured_output(PatientProfile)
    return _chain


def _model_version() -> str:
    return os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


def _attach_llm_lineage(profile: PatientProfile, raw: dict) -> PatientProfile:
    """
    Record ImputationTrace entries for fields that were absent in `raw` but
    are present (non-empty/non-null) in the normalised profile — these were
    inferred by the LLM.
    """
    traces: list[ImputationTrace] = list(profile.imputation_trace)
    model_ver = _model_version()

    def absent_in_raw(key: str) -> bool:
        return raw.get(key) in (None, "", [], {})

    # Scalar / list fields the LLM may have inferred
    checks = [
        ("age_months", profile.age_months != 0 and absent_in_raw("age_months") and absent_in_raw("age_years")),
        ("conditions", bool(profile.conditions) and absent_in_raw("conditions") and absent_in_raw("primary_diagnosis")),
        ("location_state", bool(profile.location_state) and absent_in_raw("location_state") and absent_in_raw("state")),
        ("stage", profile.stage is not None and absent_in_raw("stage")),
        ("lab_values", bool(profile.lab_values) and absent_in_raw("lab_values")),
    ]
    for field_id, was_inferred in checks:
        if was_inferred:
            traces.append(ImputationTrace(
                field_id=field_id,
                method="llm",
                model_version=model_ver,
                source_value=str(raw.get(field_id) or raw.get("primary_diagnosis") or ""),
            ))

    return profile.model_copy(update={"imputation_trace": traces}) if traces != list(profile.imputation_trace) else profile


def parse_patient(state: CoordinatorState) -> dict:
    """LangGraph node: parse raw AIKosh patient JSON → PatientProfile."""
    import json
    raw = state["raw_patient"]
    result: PatientProfile = _get_chain().invoke({"raw_patient": json.dumps(raw, indent=2)})
    result = _attach_llm_lineage(result, raw)
    return {"patient_profile": result}


def normalise_patient(raw: dict) -> PatientProfile:
    """Direct call (outside LangGraph): parse raw AIKosh dict → PatientProfile."""
    import json
    profile = _get_chain().invoke({"raw_patient": json.dumps(raw, indent=2)})
    return _attach_llm_lineage(profile, raw)
