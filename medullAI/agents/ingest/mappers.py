"""
Column mapping profiles: raw tabular column name → AIKosh-shaped patient dict key.
Each mapper is a dict of { source_column: target_field } plus optional transform fns.

The target shape must mirror the AIKosh seed JSON accepted by patient_agent.parse_patient:
  patient_id, age_years, gender, state, primary_diagnosis,
  comorbidities (list), smoking_history (bool), prior_treatment (list),
  lab_values (dict), stage, icd_code, ...
"""
from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Transform helpers
# ---------------------------------------------------------------------------

def _to_bool(val: Any) -> bool:
    if val is None:
        return False
    return str(val).strip().lower() in {"true", "yes", "1", "y"}


def _split_list(val: Any) -> list[str]:
    if val is None:
        return []
    return [v.strip() for v in str(val).split(";") if v.strip()]


def _lab_dict(row: dict, lab_cols: list[str]) -> dict[str, float]:
    out: dict[str, float] = {}
    for col in lab_cols:
        v = row.get(col)
        if v is not None:
            try:
                out[col.lower().replace(" ", "_")] = float(v)
            except (TypeError, ValueError):
                pass
    return out


# ---------------------------------------------------------------------------
# AIKosh oral-cancer tabular profile
# Expected CSV columns mirror the seed JSON fields exported from ICMR dataset.
# ---------------------------------------------------------------------------

_AIKOSH_ORAL_CANCER_LABS = [
    "hemoglobin_g_dl",
    "wbc_count_per_ul",
    "platelet_count_per_ul",
    "serum_creatinine_mg_dl",
    "alt_u_l",
    "hba1c_percent",
    "fasting_glucose_mg_dl",
    "egfr_ml_min",
]

_AIKOSH_FIELD_MAP = {
    "patient_id":       "patient_id",
    "pid":              "patient_id",
    "age_years":        "age_years",
    "age":              "age_years",
    "gender":           "gender",
    "sex":              "gender",
    "state":            "state",
    "location_state":   "state",
    "primary_diagnosis": "primary_diagnosis",
    "diagnosis":         "primary_diagnosis",
    "icd_code":          "icd_code",
    "stage":             "stage",
    "comorbidities":     "comorbidities",       # semicolon-delimited string
    "prior_treatment":   "prior_treatment",     # semicolon-delimited string
    "smoking_history":   "smoking_history",     # bool-ish
    "tobacco_use":       "tobacco_use",
    "alcohol_use":       "alcohol_use",
    "ecog_ps":           "ecog_ps",
    "data_source":       "data_source",
}


def _apply_aikosh(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for src, tgt in _AIKOSH_FIELD_MAP.items():
        if src in row and row[src] is not None:
            out[tgt] = row[src]

    # List fields from semicolon-delimited strings
    for list_field in ("comorbidities", "prior_treatment"):
        if list_field in out and isinstance(out[list_field], str):
            out[list_field] = _split_list(out[list_field])

    # Bool fields
    for bool_field in ("smoking_history", "alcohol_use"):
        if bool_field in out:
            out[bool_field] = _to_bool(out[bool_field])

    # Numeric ECOG
    if "ecog_ps" in out:
        try:
            out["ecog_ps"] = int(float(out["ecog_ps"]))
        except (TypeError, ValueError):
            out.pop("ecog_ps", None)

    # Lab values: collect all recognised lab columns
    out["lab_values"] = _lab_dict(row, _AIKOSH_ORAL_CANCER_LABS)

    # Ensure list defaults
    out.setdefault("comorbidities", [])
    out.setdefault("prior_treatment", [])

    return out


# ---------------------------------------------------------------------------
# Generic flat-patient profile (hospital export style)
# Assumes minimal columns: id, age, gender, diagnosis, state
# ---------------------------------------------------------------------------

_GENERIC_FIELD_MAP = {
    "id":           "patient_id",
    "patient_id":   "patient_id",
    "pid":          "patient_id",
    "age":          "age_years",
    "age_years":    "age_years",
    "gender":       "gender",
    "sex":          "gender",
    "diagnosis":    "primary_diagnosis",
    "condition":    "primary_diagnosis",
    "state":        "state",
    "location":     "state",
    "stage":        "stage",
}


def _apply_generic(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for src, tgt in _GENERIC_FIELD_MAP.items():
        if src in row and row[src] is not None:
            out[tgt] = row[src]
    out.setdefault("comorbidities", [])
    out.setdefault("prior_treatment", [])
    out["lab_values"] = {}
    return out


# ---------------------------------------------------------------------------
# Public registry
# ---------------------------------------------------------------------------

MAPPERS: dict[str, Any] = {
    "aikosh_oral_cancer": _apply_aikosh,
    "generic":            _apply_generic,
}


def apply_mapper(row: dict[str, Any], mapper_name: str = "aikosh_oral_cancer") -> dict[str, Any]:
    """Apply a named mapper profile to a raw tabular row dict."""
    fn = MAPPERS.get(mapper_name)
    if fn is None:
        raise ValueError(
            f"Unknown mapper '{mapper_name}'. Available: {list(MAPPERS)}"
        )
    return fn(row)
