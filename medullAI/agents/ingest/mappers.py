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

from .auto_detect import (
    convert_unit,
    detect_edc_format,
    get_column_mapping,
    get_lab_column_mapping,
    normalize_value,
)


# ---------------------------------------------------------------------------
# Transform helpers
# ---------------------------------------------------------------------------

def _to_bool(val: Any) -> bool:
    if val is None:
        return False
    return str(val).strip().lower() in {"true", "yes", "1", "y", "current", "former"}


def _split_list(val: Any, delimiter: str | None = None) -> list[str]:
    if val is None:
        return []
    # Support multiple delimiters
    val_str = str(val).strip()
    if delimiter:
        return [v.strip() for v in val_str.split(delimiter) if v.strip()]
    # Auto-detect delimiter
    for sep in [";", "|", ",", "\n"]:
        if sep in val_str:
            return [v.strip() for v in val_str.split(sep) if v.strip()]
    return [val_str] if val_str else []


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


def _extract_numeric(value: Any) -> float | None:
    """Extract numeric value from string that might contain units."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        pass

    # Try to extract number from string like "12.5 mg/dL"
    import re
    match = re.search(r"(\d+\.?\d*)", str(value))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# EDC-aware mapper with auto-detection
# ---------------------------------------------------------------------------

def _extract_visit(row: dict[str, Any]) -> dict[str, Any] | None:
    """Extract visit/form context from a row if EDC columns are present."""
    _VISIT_CANDIDATES: dict[str, list[str]] = {
        "visit_id":        ["visit", "visitnam", "visit_name", "visitid", "visit_id"],
        "visit_num":       ["visitnum", "visit_num", "visitn"],
        "form_id":         ["form", "formid", "form_id", "domain"],
        "form_repeat_key": ["formrepeatkey", "form_repeat_key", "itemgroupdataseq"],
        "collected_date":  ["datecollected", "collected_date", "visitdat", "date_collected"],
    }
    visit_data: dict[str, Any] = {}
    norm_map = {k.lower().replace(" ", "_"): k for k in row}
    for vkey, candidates in _VISIT_CANDIDATES.items():
        for col in candidates:
            if col in norm_map:
                val = row[norm_map[col]]
                if val is not None:
                    visit_data[vkey] = val
                    break
    return visit_data if visit_data else None


def _apply_edc_mapper(row: dict[str, Any], format_name: str | None = None) -> dict[str, Any]:
    """
    Apply EDC-aware mapping to a row.

    If format_name is None, auto-detects the format from column names.
    Handles unit conversions and format-specific normalizations.
    """
    out: dict[str, Any] = {}

    # Get all column names
    columns = list(row.keys())

    # Auto-detect format if not specified
    if format_name is None or format_name == "auto":
        format_name, confidence = detect_edc_format(columns)
        out["_format_detected"] = format_name
        out["_format_confidence"] = confidence

    # Get column mappings
    col_mapping = get_column_mapping(columns, format_name)
    lab_mapping = get_lab_column_mapping(columns, format_name)

    # Map standard fields
    field_mapping = {
        "patient_id": ("patient_id", None),
        "age": ("age_years", lambda x: int(float(x)) if x else None),
        "gender": ("gender", lambda x: normalize_value(x, "gender", format_name)),
        "state": ("state", None),
        "primary_diagnosis": ("primary_diagnosis", None),
        "icd_code": ("icd_code", None),
        "stage": ("stage", None),
        "ecog_ps": ("ecog_ps", lambda x: int(float(x)) if x else None),
    }

    for canonical_field, (target_field, transform) in field_mapping.items():
        if canonical_field in col_mapping:
            src_col = col_mapping[canonical_field]
            value = row.get(src_col)
            if value is not None:
                if transform:
                    try:
                        value = transform(value)
                    except (ValueError, TypeError):
                        value = None
                if value is not None:
                    out[target_field] = value

    # Handle list fields (comorbidities, prior_treatment)
    if "comorbidities" in col_mapping:
        val = row.get(col_mapping["comorbidities"])
        if val:
            out["comorbidities"] = _split_list(val)

    if "prior_treatment" in col_mapping:
        val = row.get(col_mapping["prior_treatment"])
        if val:
            out["prior_treatment"] = _split_list(val)

    # Handle boolean fields
    if "smoking_history" in col_mapping:
        val = row.get(col_mapping["smoking_history"])
        if val is not None:
            normalized = normalize_value(val, "boolean", format_name)
            out["smoking_history"] = _to_bool(normalized) if normalized is not None else False

    # Handle lab values with unit conversion
    out["lab_values"] = {}
    for lab_name, (src_col, detected_unit, conversions) in lab_mapping.items():
        val = row.get(src_col)
        if val is not None:
            numeric_val = _extract_numeric(val)
            if numeric_val is not None:
                # Convert to standard unit if needed
                if detected_unit and conversions:
                    for target_unit, converter in conversions.items():
                        if detected_unit.lower() == target_unit.lower():
                            numeric_val = converter(numeric_val)
                            break
                out["lab_values"][lab_name] = numeric_val

    # Ensure list defaults
    out.setdefault("comorbidities", [])
    out.setdefault("prior_treatment", [])
    out.setdefault("lab_values", {})

    visit = _extract_visit(row)
    if visit:
        out["_visit"] = visit

    # Add data quality flags
    out["_data_quality"] = {
        "mapped_fields": len([k for k in out.keys() if not k.startswith("_")]),
        "total_columns": len(columns),
        "lab_values_count": len(out.get("lab_values", {})),
    }

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

    visit = _extract_visit(row)
    if visit:
        out["_visit"] = visit

    # Add data quality flags
    out["_data_quality"] = {
        "mapped_fields": len([k for k in out.keys() if not k.startswith("_")]),
        "total_columns": len(row),
        "lab_values_count": len(out.get("lab_values", {})),
    }

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

    visit = _extract_visit(row)
    if visit:
        out["_visit"] = visit

    # Add data quality flags
    out["_data_quality"] = {
        "mapped_fields": len([k for k in out.keys() if not k.startswith("_")]),
        "total_columns": len(row),
        "lab_values_count": 0,
    }

    return out


# ---------------------------------------------------------------------------
# Public registry
# ---------------------------------------------------------------------------

MAPPERS: dict[str, Any] = {
    "aikosh_oral_cancer": _apply_aikosh,
    "generic":            _apply_generic,
    "medidata_rave":      lambda row: _apply_edc_mapper(row, "medidata_rave"),
    "veeva_vault":        lambda row: _apply_edc_mapper(row, "veeva_vault"),
    "redcap":             lambda row: _apply_edc_mapper(row, "redcap"),
    "auto":               lambda row: _apply_edc_mapper(row, None),  # Auto-detect
}


def apply_mapper(row: dict[str, Any], mapper_name: str = "aikosh_oral_cancer") -> dict[str, Any]:
    """Apply a named mapper profile to a raw tabular row dict."""
    fn = MAPPERS.get(mapper_name)
    if fn is None:
        raise ValueError(
            f"Unknown mapper '{mapper_name}'. Available: {list(MAPPERS)}"
        )
    return fn(row)


def detect_and_map(row: dict[str, Any]) -> tuple[dict[str, Any], str, float]:
    """
    Auto-detect the EDC format and apply the appropriate mapper.

    Returns:
        tuple of (mapped_row, detected_format, confidence_score)
    """
    columns = list(row.keys())
    detected_format, confidence = detect_edc_format(columns)

    mapped = apply_mapper(row, detected_format)

    return mapped, detected_format, confidence


def get_mapper_info() -> dict[str, Any]:
    """Get information about available mappers."""
    return {
        "available_mappers": list(MAPPERS.keys()),
        "edc_formats": ["medidata_rave", "veeva_vault", "redcap", "aikosh_oral_cancer", "generic"],
        "auto_detect": True,
        "supported_features": [
            "column_name_fuzzy_matching",
            "unit_conversion",
            "data_quality_scoring",
            "format_confidence_scores",
        ],
    }
