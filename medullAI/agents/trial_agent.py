from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_deepseek import ChatDeepSeek

from schemas import CoordinatorState, CriteriaClassification, TrialCriteria

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


# Ambiguity detection patterns
SUBJECTIVE_PATTERNS = [
    r"per\s+investigator\s+judgment",
    r"investigator['']?s?\s+(?:discretion|judgment|assessment)",
    r"adequate\s+(?:renal|hepatic|organ|bone\s+marrow)\s+function",
    r"clinically\s+significant",
    r"(?:significant|relevant)\s+(?:medical\s+history|disease|condition)",
    r"life\s+expectancy\s+\u003e?\s*\d*\s*(?:months?|years?)",
    r"(?:sufficient|adequate)\s+(?:washout|recovery|period)",
    r"(?:reasonable|good)\s+(?:physical|functional)\s+status",
    r"(?:willing|able)\s+to\s+comply",
    r"(?:appropriate|suitable)\s+candidate",
    r"(?:mentally|psychologically)\s+(?:competent|capable)",
    r"(?:in\s+the\s+opinion\s+of|as\s+determined\s+by)\s+(?:investigator|physician)",
]

OBJECTIVE_PATTERNS = [
    r"(\d+(?:\.\d+)?)\s*[≤<>≥]\s*(?:hb|hemoglobin|hgb)",
    r"(?:hb|hemoglobin|hgb)\s*[≤<>≥]\s*(\d+(?:\.\d+)?)",
    r"(?:platelet|plt)\s*[≤<>≥]\s*(\d+(?:,\d+)*)\s*/?\s*μ?L",
    r"(\d+(?:\.\d+)?)\s*[≤<>≥]\s*(?:wbc|white\s+blood\s+cell)",
    r"(?:creatinine|scr)\s*[≤<>≥]\s*(\d+(?:\.\d+)?)",
    r"(?:egfr|gfr)\s*[≤<>≥]\s*(\d+(?:\.\d+)?)",
    r"(?:alt|ast|sgpt|sgot)\s*[≤<>≥]\s*(\d+(?:\.\d+)?)",
    r"hba1c\s*[≤<>≥]\s*(\d+(?:\.\d+)?)",
    r"(?:age|aged?)\s+(\d+)\s*[\-\s]+\s*(\d+)\s*(?:years?|yrs?)",
    r"(?:age|aged?)\s+[≥>]\s*(\d+)",
    r"(?:age|aged?)\s+[≤<]\s*(\d+)",
    r"(?:male|female|men|women)(?:\s+and\s+(?:male|female))?",
    r"ecog\s+(?:performance\s+status\s+)?[≤<]?\s*(\d)",
    r"karnofsky\s+[≥>]\s*(\d+)",
]


def _get_chain():
    global _chain
    if _chain is None:
        llm = ChatDeepSeek(model="deepseek-chat", temperature=0, max_retries=2)
        _chain = _prompt | llm.with_structured_output(TrialCriteria)
    return _chain


def _is_objective_criterion(criterion: str) -> tuple[bool, str]:
    """
    Determine if a criterion is objectively scorable.

    Returns:
        tuple of (is_objective, reason_if_not)
    """
    criterion_lower = criterion.lower()

    # Check for objective patterns
    for pattern in OBJECTIVE_PATTERNS:
        if re.search(pattern, criterion_lower):
            return True, ""

    # Check for subjective patterns
    for pattern in SUBJECTIVE_PATTERNS:
        match = re.search(pattern, criterion_lower)
        if match:
            return False, f"Subjective language detected: '{match.group(0)}'"

    # Check for numeric thresholds (likely objective)
    if re.search(r"\d+(?:\.\d+)?\s*(?:mg|g|dL|L|mmol|U/L|%)", criterion_lower):
        return True, ""

    # Check for vague quantifiers (likely subjective)
    vague_terms = ["severe", "significant", "relevant", "adequate", "appropriate", "major"]
    for term in vague_terms:
        if term in criterion_lower:
            return False, f"Vague quantifier: '{term}'"

    # Default: ambiguous
    return False, "Ambiguous - requires clinical judgment"


def _extract_parameters(criterion: str) -> dict[str, Any]:
    """Extract numerical parameters from an objective criterion."""
    params = {}
    criterion_lower = criterion.lower()

    # Extract ranges
    age_range = re.search(r"(\d+)\s*[\-–]\s*(\d+)\s*(?:years?|yrs?|y)", criterion_lower)
    if age_range:
        params["age_min_years"] = int(age_range.group(1))
        params["age_max_years"] = int(age_range.group(2))

    # Extract thresholds
    patterns = [
        (r"(?:hb|hemoglobin)\s*[≥>]\s*(\d+(?:\.\d+)?)", "hemoglobin_min"),
        (r"(?:hb|hemoglobin)\s*[≤<]\s*(\d+(?:\.\d+)?)", "hemoglobin_max"),
        (r"(?:platelet|plt)\s*[≥>]\s*(\d+(?:,\d+)*)", "platelet_min"),
        (r"(?:platelet|plt)\s*[≤<]\s*(\d+(?:,\d+)*)", "platelet_max"),
        (r"(?:wbc)\s*[≥>]\s*(\d+(?:\.\d+)?)", "wbc_min"),
        (r"(?:wbc)\s*[≤<]\s*(\d+(?:\.\d+)?)", "wbc_max"),
        (r"(?:creatinine)\s*[≤<]\s*(\d+(?:\.\d+)?)", "creatinine_max"),
        (r"(?:egfr|gfr)\s*[≥>]\s*(\d+(?:\.\d+)?)", "egfr_min"),
        (r"(?:alt|ast)\s*[≤<]\s*(\d+(?:\.\d+)?)", "alt_max"),
        (r"hba1c\s*[≤<]\s*(\d+(?:\.\d+)?)", "hba1c_max"),
        (r"hba1c\s*[≥>]\s*(\d+(?:\.\d+)?)", "hba1c_min"),
        (r"ecog\s*[≤<]?\s*(\d)", "ecog_max"),
    ]

    for pattern, key in patterns:
        match = re.search(pattern, criterion_lower)
        if match:
            val = match.group(1).replace(",", "")
            try:
                params[key] = float(val)
            except ValueError:
                pass

    return params


def _classify_criterion(criterion: str, criterion_type: str) -> CriteriaClassification:
    """Classify a single criterion."""
    is_objective, reason = _is_objective_criterion(criterion)
    params = _extract_parameters(criterion) if is_objective else {}

    # Determine confidence level
    if is_objective and params:
        confidence = "high"
    elif is_objective:
        confidence = "medium"
    else:
        confidence = "low"

    return CriteriaClassification(
        criterion_text=criterion,
        criterion_type=criterion_type,
        is_objective=is_objective,
        confidence=confidence,
        requires_human_review=not is_objective,
        extractable_parameters=params,
        ambiguity_reason=reason if not is_objective else None,
    )


def _classify_all_criteria(trial: TrialCriteria) -> TrialCriteria:
    """Classify all inclusion and exclusion criteria."""
    # Classify inclusion criteria
    trial.inclusion_classified = [
        _classify_criterion(c, "inclusion") for c in trial.inclusion
    ]

    # Classify exclusion criteria
    trial.exclusion_classified = [
        _classify_criterion(c, "exclusion") for c in trial.exclusion
    ]

    # Count subjective criteria
    subjective_count = sum(
        1 for c in trial.inclusion_classified + trial.exclusion_classified
        if not c.is_objective
    )
    trial.subjective_criteria_count = subjective_count

    return trial


def parse_trial(state: CoordinatorState) -> dict:
    """LangGraph node: parse raw CTRI JSON → TrialCriteria with classification."""
    raw = state["raw_trial"]
    result: TrialCriteria = _get_chain().invoke({"raw_trial": json.dumps(raw, indent=2)})

    # Classify criteria for ambiguity detection
    result = _classify_all_criteria(result)

    return {"trial_criteria": result}


def parse_trial_direct(raw: dict) -> TrialCriteria:
    """Direct call (outside LangGraph): parse raw CTRI dict → TrialCriteria with classification."""
    result: TrialCriteria = _get_chain().invoke({"raw_trial": json.dumps(raw, indent=2)})
    result = _classify_all_criteria(result)
    return result
