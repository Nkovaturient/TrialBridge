from __future__ import annotations

import json

from langchain_core.prompts import ChatPromptTemplate
from langchain_deepseek import ChatDeepSeek

from schemas import CoordinatorState, PatientProfile

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


def parse_patient(state: CoordinatorState) -> dict:
    """LangGraph node: parse raw AIKosh patient JSON → PatientProfile."""
    raw = state["raw_patient"]
    result: PatientProfile = _get_chain().invoke({"raw_patient": json.dumps(raw, indent=2)})
    return {"patient_profile": result}
