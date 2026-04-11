from __future__ import annotations

import json

from langchain_core.prompts import ChatPromptTemplate
from langchain_deepseek import ChatDeepSeek

from schemas import CoordinatorState, TrialCriteria

_SYSTEM = """\
You are a clinical trial data parser specialising in Indian CTRI registry records.
Your task is to extract and normalise trial eligibility criteria from raw CTRI JSON into a structured schema.

Rules:
- Convert age fields like "18.00 Year(s)" to months (multiply years by 12).
- Split free-text inclusion/exclusion criteria into individual discrete sentences.
- Normalise gender: "Both" → "both", "Male" → "male", "Female" → "female".
- Set status to the exact recruitment_status string from the record.
- If a field is missing or unclear, use null/None.
- Do NOT invent information not present in the source record.
"""

_HUMAN = """\
Parse the following CTRI trial record into structured eligibility criteria:

{raw_trial}
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
        _chain = _prompt | llm.with_structured_output(TrialCriteria)
    return _chain


def parse_trial(state: CoordinatorState) -> dict:
    """LangGraph node: parse raw CTRI JSON → TrialCriteria."""
    raw = state["raw_trial"]
    result: TrialCriteria = _get_chain().invoke({"raw_trial": json.dumps(raw, indent=2)})
    return {"trial_criteria": result}
