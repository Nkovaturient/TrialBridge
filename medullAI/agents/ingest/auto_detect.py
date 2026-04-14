"""
Auto-detect EDC format from CSV column headers.
Uses fuzzy matching and scoring to identify the source EDC system.
"""
from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any

from .edc_configs import EDC_FORMATS


def _fuzzy_match(column: str, patterns: list[str], threshold: float = 0.8) -> bool:
    """Check if column name matches any pattern with fuzzy similarity."""
    column_lower = column.lower().strip().replace(" ", "_")
    for pattern in patterns:
        pattern_lower = pattern.lower().strip()
        # Exact match
        if column_lower == pattern_lower:
            return True
        # Fuzzy match
        if SequenceMatcher(None, column_lower, pattern_lower).ratio() >= threshold:
            return True
        # Pattern contained in column
        if pattern_lower in column_lower or column_lower in pattern_lower:
            return True
    return False


def _calculate_format_score(columns: list[str], format_config: dict) -> float:
    """
    Calculate a confidence score (0-1) for how well columns match an EDC format.

    Scoring:
    - Required fields (patient_id, age, gender): 0.3 each = 0.9
    - Bonus for matching lab columns: +0.1
    """
    score = 0.0
    score = 0.0

    # Check required field presence
    required_fields = ["patient_id", "age", "gender"]
    for field in required_fields:
        patterns = format_config["columns"].get(field, [])
        for col in columns:
            if _fuzzy_match(col, patterns):
                score += 0.3
                break

    # Bonus for lab columns
    lab_matches = 0
    for _lab_name, lab_config in format_config.get("labs", {}).items():
        patterns = lab_config.get("columns", [])
        for col in columns:
            if _fuzzy_match(col, patterns):
                lab_matches += 1
                break

    # Normalize lab bonus (max 0.1 for matching at least 3 labs)
    score += min(0.1, (lab_matches / 3) * 0.1)

    return min(1.0, score)


def detect_edc_format(columns: list[str]) -> tuple[str, float]:
    """
    Auto-detect the EDC format from column headers.

    Returns:
        tuple of (format_name, confidence_score)

    Example:
        >>> detect_edc_format(["subjectid", "age", "gender", "hemoglobin"])
        ("medidata_rave", 0.95)
    """
    scores = {}

    for format_name, format_config in EDC_FORMATS.items():
        scores[format_name] = _calculate_format_score(columns, format_config)

    # Get best match
    if not scores:
        return "generic", 0.0

    best_format = max(scores, key=scores.get)
    best_score = scores[best_format]

    # If score is too low, fall back to generic
    if best_score < 0.5:
        return "generic", best_score

    return best_format, best_score


def get_column_mapping(
    source_columns: list[str],
    format_name: str,
) -> dict[str, str]:
    """
    Map source columns to canonical fields based on detected format.

    Returns:
        dict mapping canonical_field -> source_column
    """
    if format_name == "generic":
        return {}

    if format_name not in EDC_FORMATS:
        return {}

    format_config = EDC_FORMATS[format_name]
    mapping = {}

    for canonical_field, patterns in format_config["columns"].items():
        for src_col in source_columns:
            if _fuzzy_match(src_col, patterns):
                mapping[canonical_field] = src_col
                break

    return mapping


def get_lab_column_mapping(
    source_columns: list[str],
    format_name: str,
) -> dict[str, tuple[str, str, dict]]:
    """
    Map lab value columns with unit detection.

    Returns:
        dict mapping canonical_lab -> (source_column, detected_unit, conversions)
    """
    if format_name not in EDC_FORMATS:
        return {}

    format_config = EDC_FORMATS[format_name]
    mapping = {}

    for lab_name, lab_config in format_config.get("labs", {}).items():
        patterns = lab_config.get("columns", [])
        for src_col in source_columns:
            if _fuzzy_match(src_col, patterns):
                # Try to detect unit from column name
                detected_unit = lab_config["unit"]
                src_lower = src_col.lower()

                # Check for unit indicators in column name
                for alt_unit in lab_config.get("alternate_units", []):
                    if alt_unit.lower().replace("/", "_").replace(".", "_") in src_lower:
                        detected_unit = alt_unit
                        break

                mapping[lab_name] = (
                    src_col,
                    detected_unit,
                    lab_config.get("conversion", {})
                )
                break

    return mapping


def normalize_value(
    value: Any,
    value_type: str,
    format_name: str,
    target_unit: str | None = None,
) -> Any:
    """
    Normalize a value based on format-specific rules.

    Args:
        value: The raw value from CSV
        value_type: Type of value (gender, boolean, etc.)
        format_name: Detected EDC format
        target_unit: Target unit for conversion
    """
    if value is None or value == "":
        return None

    value_str = str(value).strip()

    if format_name not in EDC_FORMATS:
        return value

    format_config = EDC_FORMATS[format_name]

    if value_type == "gender":
        gender_map = format_config.get("gender_map", {})
        value_lower = value_str.lower()
        for canonical, variants in gender_map.items():
            if value_lower in [v.lower() for v in variants]:
                return canonical
        return value_str

    if value_type == "boolean":
        bool_map = format_config.get("boolean_map", {})
        value_lower = value_str.lower()
        for canonical, variants in bool_map.items():
            if value_lower in [v.lower() for v in variants]:
                return canonical
        return None

    return value


def convert_unit(value: float, from_unit: str, to_unit: str, conversion_map: dict) -> float:
    """Convert lab value from one unit to another."""
    if from_unit == to_unit:
        return value

    key = f"{from_unit}_to_{to_unit}"
    if key in conversion_map:
        return conversion_map[key](value)

    # Try direct conversion function
    if from_unit in conversion_map:
        return conversion_map[from_unit](value)

    # No conversion available
    return value
