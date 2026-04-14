"""
Deduplication engine for patient records.
Identifies duplicate patients across uploads and databases.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from pydantic import BaseModel


class DuplicateCandidate(BaseModel):
    """Represents a potential duplicate patient pair."""
    patient_id_1: str
    patient_id_2: str
    confidence: float  # 0-1 similarity score
    match_reasons: list[str]  # Why they might be duplicates
    conflicting_fields: list[str]  # Fields that differ
    recommendation: str  # "merge", "review", "keep_separate"


class DeduplicationResult(BaseModel):
    """Result of deduplication analysis."""
    total_patients: int
    unique_patients: int
    duplicates_found: int
    duplicate_groups: list[list[str]]  # Groups of duplicate patient IDs
    candidates: list[DuplicateCandidate]


@dataclass
class PatientFingerprint:
    """Hashable fingerprint of a patient for quick comparison."""
    patient_id: str
    age: int | None
    gender: str | None
    diagnosis: str | None
    state: str | None
    lab_hash: str  # Hash of lab values

    def to_tuple(self) -> tuple:
        return (self.age, self.gender, self.diagnosis, self.state, self.lab_hash)


class PatientDeduplicator:
    """
    Deduplication engine using multi-stage matching:
    1. Exact match on patient_id
    2. Fuzzy match on demographics + diagnosis
    3. Lab value consistency check
    """

    def __init__(
        self,
        name_similarity_threshold: float = 0.85,
        demographic_weight: float = 0.6,
        lab_weight: float = 0.4,
    ):
        self.name_similarity_threshold = name_similarity_threshold
        self.demographic_weight = demographic_weight
        self.lab_weight = lab_weight

    def _normalize_text(self, text: str | None) -> str:
        """Normalize text for comparison."""
        if text is None:
            return ""
        return str(text).lower().strip().replace(" ", "_")

    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate Jaro-Winkler-like similarity between names."""
        return SequenceMatcher(None, self._normalize_text(name1), self._normalize_text(name2)).ratio()

    def _create_lab_hash(self, lab_values: dict[str, float]) -> str:
        """Create a hash of lab values for quick comparison."""
        if not lab_values:
            return ""
        # Sort keys for consistent hashing
        lab_str = "|".join(f"{k}:{round(v, 1)}" for k, v in sorted(lab_values.items()) if v is not None)
        return hashlib.md5(lab_str.encode()).hexdigest()[:8]

    def _compare_lab_values(
        self,
        labs1: dict[str, float],
        labs2: dict[str, float],
    ) -> tuple[float, list[str]]:
        """
        Compare lab values and return similarity score.

        Returns:
            tuple of (similarity_score, common_labs)
        """
        if not labs1 or not labs2:
            return 0.0, []

        common_labs = []
        matching_values = 0
        total_comparisons = 0

        for lab_name, val1 in labs1.items():
            if lab_name in labs2 and labs2[lab_name] is not None:
                val2 = labs2[lab_name]
                common_labs.append(lab_name)

                # Allow 10% tolerance for lab values
                if val1 > 0:
                    diff_ratio = abs(val1 - val2) / val1
                else:
                    diff_ratio = abs(val1 - val2)

                if diff_ratio < 0.1:  # Within 10%
                    matching_values += 1
                total_comparisons += 1

        if total_comparisons == 0:
            return 0.0, []

        return matching_values / total_comparisons, common_labs

    def _calculate_demographic_similarity(
        self,
        patient1: dict[str, Any],
        patient2: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Calculate similarity based on demographics.

        Returns:
            tuple of (similarity_score, match_reasons)
        """
        score = 0.0
        reasons = []

        # Age matching (exact or within 1 year)
        age1 = patient1.get("age_years") or patient1.get("age_months", 0) // 12
        age2 = patient2.get("age_years") or patient2.get("age_months", 0) // 12
        if age1 and age2:
            if abs(age1 - age2) <= 1:
                score += 0.3
                reasons.append(f"age_match:{age1}vs{age2}")

        # Gender matching (exact)
        gender1 = self._normalize_text(patient1.get("gender"))
        gender2 = self._normalize_text(patient2.get("gender"))
        if gender1 and gender2 and gender1 == gender2:
            score += 0.2
            reasons.append(f"gender_match:{gender1}")

        # State/location matching
        state1 = self._normalize_text(patient1.get("state") or patient1.get("location_state"))
        state2 = self._normalize_text(patient2.get("state") or patient2.get("location_state"))
        if state1 and state2 and state1 == state2:
            score += 0.1
            reasons.append(f"state_match:{state1}")

        # Diagnosis similarity
        diag1 = self._normalize_text(patient1.get("primary_diagnosis"))
        diag2 = self._normalize_text(patient2.get("primary_diagnosis"))
        if diag1 and diag2:
            diag_sim = self._calculate_name_similarity(diag1, diag2)
            if diag_sim > 0.8:
                score += 0.3 * diag_sim
                reasons.append(f"diagnosis_similar:{diag_sim:.2f}")

        # ICD code matching (exact)
        icd1 = self._normalize_text(patient1.get("icd_code"))
        icd2 = self._normalize_text(patient2.get("icd_code"))
        if icd1 and icd2 and icd1 == icd2:
            score += 0.2
            reasons.append(f"icd_match:{icd1}")

        return min(1.0, score), reasons

    def check_duplicates(
        self,
        patients: list[dict[str, Any]],
    ) -> DeduplicationResult:
        """
        Check for duplicates in a list of patients.

        Args:
            patients: List of patient dictionaries

        Returns:
            DeduplicationResult with all findings
        """
        if not patients:
            return DeduplicationResult(
                total_patients=0,
                unique_patients=0,
                duplicates_found=0,
                duplicate_groups=[],
                candidates=[],
            )

        candidates = []
        duplicate_groups = []
        processed = set()

        for i, p1 in enumerate(patients):
            if i in processed:
                continue

            pid1 = p1.get("patient_id", f"unknown_{i}")
            group = [pid1]

            for j, p2 in enumerate(patients[i + 1 :], start=i + 1):
                if j in processed:
                    continue

                pid2 = p2.get("patient_id", f"unknown_{j}")

                # Check for exact ID match first
                if pid1 == pid2:
                    confidence = 1.0
                    reasons = ["exact_id_match"]
                    conflicting = []
                    recommendation = "merge"
                else:
                    # Calculate similarity
                    demo_sim, demo_reasons = self._calculate_demographic_similarity(p1, p2)

                    labs1 = p1.get("lab_values", {})
                    labs2 = p2.get("lab_values", {})
                    lab_sim, common_labs = self._compare_lab_values(labs1, labs2)

                    # Weighted combined score
                    confidence = (demo_sim * self.demographic_weight) + (
                        lab_sim * self.lab_weight
                    )

                    reasons = demo_reasons
                    if common_labs:
                        reasons.append(f"lab_match:{len(common_labs)}_values")

                    # Find conflicting fields
                    conflicting = []
                    if abs((p1.get("age_years") or 0) - (p2.get("age_years") or 0)) > 2:
                        conflicting.append("age")

                    # Recommendation based on confidence
                    if confidence >= 0.95:
                        recommendation = "merge"
                    elif confidence >= 0.75:
                        recommendation = "review"
                    else:
                        recommendation = "keep_separate"

                if confidence >= self.name_similarity_threshold:
                    candidates.append(
                        DuplicateCandidate(
                            patient_id_1=pid1,
                            patient_id_2=pid2,
                            confidence=confidence,
                            match_reasons=reasons,
                            conflicting_fields=conflicting,
                            recommendation=recommendation,
                        )
                    )

                    if recommendation in ["merge", "review"]:
                        group.append(pid2)
                        processed.add(j)

            if len(group) > 1:
                duplicate_groups.append(group)
            processed.add(i)

        # Calculate unique count
        unique_count = len(patients) - sum(len(g) - 1 for g in duplicate_groups)

        return DeduplicationResult(
            total_patients=len(patients),
            unique_patients=unique_count,
            duplicates_found=len(candidates),
            duplicate_groups=duplicate_groups,
            candidates=candidates,
        )

    def merge_patients(
        self,
        patient1: dict[str, Any],
        patient2: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Merge two patient records, preferring non-null values.

        Args:
            patient1: Primary patient record
            patient2: Secondary patient record

        Returns:
            Merged patient dictionary
        """
        merged = patient1.copy()

        # Merge simple fields (prefer non-null)
        for key in ["age_years", "age_months", "gender", "state", "primary_diagnosis", "icd_code", "stage"]:
            if key not in merged or merged[key] is None:
                if key in patient2 and patient2[key] is not None:
                    merged[key] = patient2[key]

        # Merge list fields (union)
        for key in ["comorbidities", "prior_treatment"]:
            if key in patient2:
                existing = set(merged.get(key, []))
                new_items = set(patient2.get(key, []))
                merged[key] = list(existing | new_items)

        # Merge lab values (prefer non-null)
        labs1 = merged.get("lab_values", {})
        labs2 = patient2.get("lab_values", {})
        merged_labs = labs1.copy()
        for lab_name, value in labs2.items():
            if lab_name not in merged_labs or merged_labs[lab_name] is None:
                merged_labs[lab_name] = value
        merged["lab_values"] = merged_labs

        # Track merge
        merged["_merged_from"] = [patient1.get("patient_id"), patient2.get("patient_id")]
        merged["_deduplication_applied"] = True

        return merged
