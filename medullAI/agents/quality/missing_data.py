"""
Missing data handling and imputation for clinical trial patient data.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel


class MissingDataReport(BaseModel):
    """Report of missing data for a single patient."""
    patient_id: str
    missing_fields: list[str]
    missing_percentage: float
    critical_missing: list[str]  # Fields that are critical for matching
    imputed_fields: dict[str, Any]  # Fields that were imputed
    confidence_impact: float  # 0-1 reduction in confidence


class DataQualityReport(BaseModel):
    """Overall data quality report for a batch of patients."""
    total_patients: int
    patients_with_missing_data: int
    missing_by_field: dict[str, int]  # Field -> count missing
    imputation_applied: int
    critical_missing_count: int
    average_completeness: float  # 0-1


@dataclass
class FieldConfig:
    """Configuration for a field's importance and imputation strategy."""
    name: str
    critical: bool  # Is this field critical for matching?
    imputable: bool  # Can we impute this field?
    imputation_strategy: str  # "mean", "median", "mode", "group_mean"
    default_value: Any = None


# Define field configurations for clinical trial matching
FIELD_CONFIGS = {
    "age_months": FieldConfig("age_months", True, False, "none"),
    "gender": FieldConfig("gender", True, False, "none"),
    "primary_diagnosis": FieldConfig("primary_diagnosis", True, False, "none"),
    "location_state": FieldConfig("location_state", False, False, "none"),
    "icd_code": FieldConfig("icd_code", True, False, "none"),
    "stage": FieldConfig("stage", False, False, "none"),
    "comorbidities": FieldConfig("comorbidities", False, True, "empty_list", []),
    "prior_treatment": FieldConfig("prior_treatment", False, True, "empty_list", []),
    "smoking_history": FieldConfig("smoking_history", False, True, "false", False),
    "ecog_ps": FieldConfig("ecog_ps", True, True, "median", None),
    "hemoglobin": FieldConfig("hemoglobin", True, True, "group_mean", None),
    "wbc_count": FieldConfig("wbc_count", True, True, "group_mean", None),
    "platelet_count": FieldConfig("platelet_count", True, True, "group_mean", None),
    "serum_creatinine": FieldConfig("serum_creatinine", True, True, "group_mean", None),
    "alt": FieldConfig("alt", True, True, "group_mean", None),
    "hba1c": FieldConfig("hba1c", True, True, "group_mean", None),
    "fasting_glucose": FieldConfig("fasting_glucose", True, True, "group_mean", None),
    "egfr": FieldConfig("egfr", True, True, "group_mean", None),
}


class MissingDataHandler:
    """
    Handles missing data in patient records.

    Features:
    - Identifies missing critical vs non-critical fields
    - Imputes missing values using group statistics
    - Calculates confidence impact of missing data
    - Provides detailed reports
    """

    def __init__(self):
        self.field_configs = FIELD_CONFIGS
        self.group_stats: dict[str, dict[str, float]] = {}  # diagnosis -> field -> mean

    def _build_group_stats(self, patients: list[dict[str, Any]]) -> None:
        """Build group statistics for imputation by diagnosis."""
        stats_by_diagnosis: dict[str, dict[str, list[float]]] = {}

        for patient in patients:
            diagnosis = self._normalize_diagnosis(patient.get("primary_diagnosis", "unknown"))
            if diagnosis not in stats_by_diagnosis:
                stats_by_diagnosis[diagnosis] = {}

            labs = patient.get("lab_values", {})
            for lab_name, value in labs.items():
                if value is not None and isinstance(value, (int, float)):
                    if lab_name not in stats_by_diagnosis[diagnosis]:
                        stats_by_diagnosis[diagnosis][lab_name] = []
                    stats_by_diagnosis[diagnosis][lab_name].append(value)

        # Calculate means
        for diagnosis, fields in stats_by_diagnosis.items():
            self.group_stats[diagnosis] = {}
            for field, values in fields.items():
                if values:
                    self.group_stats[diagnosis][field] = sum(values) / len(values)

    def _normalize_diagnosis(self, diagnosis: str | None) -> str:
        """Normalize diagnosis name for grouping."""
        if not diagnosis:
            return "unknown"
        return str(diagnosis).lower().strip().replace(" ", "_")

    def _impute_field(
        self,
        field: str,
        diagnosis: str,
        strategy: str,
    ) -> Any:
        """Impute a single field using the specified strategy."""
        if strategy == "empty_list":
            return []
        if strategy == "false":
            return False
        if strategy == "none":
            return None

        # Group-based imputation
        if strategy in ["mean", "median", "group_mean"]:
            diag_stats = self.group_stats.get(diagnosis, {})
            if field in diag_stats:
                return diag_stats[field]

        return None

    def analyze_patient(
        self,
        patient: dict[str, Any],
        apply_imputation: bool = True,
    ) -> MissingDataReport:
        """
        Analyze a single patient for missing data.

        Args:
            patient: Patient dictionary
            apply_imputation: Whether to impute missing values

        Returns:
            MissingDataReport
        """
        patient_id = patient.get("patient_id", "unknown")
        diagnosis = self._normalize_diagnosis(patient.get("primary_diagnosis"))
        labs = patient.get("lab_values", {})

        missing_fields = []
        critical_missing = []
        imputed_fields = {}

        # Check standard fields
        total_fields = 0
        missing_count = 0

        for field, config in self.field_configs.items():
            if field in ["hemoglobin", "wbc_count", "platelet_count", "serum_creatinine", "alt", "hba1c", "fasting_glucose", "egfr"]:
                # Lab value
                total_fields += 1
                if field not in labs or labs[field] is None:
                    missing_count += 1
                    missing_fields.append(f"lab.{field}")
                    if config.critical:
                        critical_missing.append(f"lab.{field}")

                    if apply_imputation and config.imputable:
                        imputed_value = self._impute_field(field, diagnosis, config.imputation_strategy)
                        if imputed_value is not None:
                            labs[field] = imputed_value
                            imputed_fields[f"lab.{field}"] = imputed_value
            else:
                # Regular field
                total_fields += 1
                if field not in patient or patient[field] is None:
                    missing_count += 1
                    missing_fields.append(field)
                    if config.critical:
                        critical_missing.append(field)

                    if apply_imputation and config.imputable:
                        imputed_value = self._impute_field(field, diagnosis, config.imputation_strategy)
                        if imputed_value is not None:
                            patient[field] = imputed_value
                            imputed_fields[field] = imputed_value

        missing_percentage = (missing_count / total_fields * 100) if total_fields > 0 else 0

        # Calculate confidence impact
        # Critical missing = 0.3 impact each, regular = 0.1 impact each
        confidence_impact = min(1.0, (len(critical_missing) * 0.3) + ((len(missing_fields) - len(critical_missing)) * 0.1))

        return MissingDataReport(
            patient_id=patient_id,
            missing_fields=missing_fields,
            missing_percentage=missing_percentage,
            critical_missing=critical_missing,
            imputed_fields=imputed_fields,
            confidence_impact=confidence_impact,
        )

    def analyze_batch(
        self,
        patients: list[dict[str, Any]],
        apply_imputation: bool = True,
    ) -> tuple[list[MissingDataReport], DataQualityReport]:
        """
        Analyze a batch of patients for missing data.

        Args:
            patients: List of patient dictionaries
            apply_imputation: Whether to apply imputation

        Returns:
            Tuple of (list of individual reports, summary report)
        """
        if not patients:
            return [], DataQualityReport(
                total_patients=0,
                patients_with_missing_data=0,
                missing_by_field={},
                imputation_applied=0,
                critical_missing_count=0,
                average_completeness=1.0,
            )

        # Build group statistics for imputation
        self._build_group_stats(patients)

        individual_reports = []
        missing_by_field: dict[str, int] = {}
        patients_with_missing = 0
        imputation_count = 0
        critical_missing_total = 0
        total_completeness = 0.0

        for patient in patients:
            report = self.analyze_patient(patient, apply_imputation)
            individual_reports.append(report)

            if report.missing_fields:
                patients_with_missing += 1

            if report.imputed_fields:
                imputation_count += len(report.imputed_fields)

            if report.critical_missing:
                critical_missing_total += len(report.critical_missing)

            # Track missing by field
            for field in report.missing_fields:
                missing_by_field[field] = missing_by_field.get(field, 0) + 1

            total_completeness += 100 - report.missing_percentage

        avg_completeness = total_completeness / len(patients) / 100 if patients else 1.0

        summary = DataQualityReport(
            total_patients=len(patients),
            patients_with_missing_data=patients_with_missing,
            missing_by_field=missing_by_field,
            imputation_applied=imputation_count,
            critical_missing_count=critical_missing_total,
            average_completeness=avg_completeness,
        )

        return individual_reports, summary

    def get_confidence_adjustment(self, patient: dict[str, Any]) -> float:
        """
        Get a confidence score adjustment (0-1 reduction) for a patient based on missing data.

        Args:
            patient: Patient dictionary

        Returns:
            Float between 0 and 1 representing confidence reduction
        """
        report = self.analyze_patient(patient, apply_imputation=False)
        return report.confidence_impact
