from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field
from typing_extensions import TypedDict


class CriteriaClassification(BaseModel):
    """Classification of a single eligibility criterion."""

    criterion_text: str = Field(description="Original criterion text")
    criterion_type: Literal["inclusion", "exclusion"] = Field(description="Type of criterion")
    is_objective: bool = Field(description="Whether criterion can be objectively scored")
    confidence: Literal["high", "medium", "low"] = Field(description="Confidence in AI scoring")
    requires_human_review: bool = Field(description="Whether this needs human review")
    extractable_parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted parameters like thresholds, ranges",
    )
    ambiguity_reason: str | None = Field(
        default=None,
        description="Reason why criterion is ambiguous",
    )


class TrialCriteria(BaseModel):
    """Structured representation of a CTRI clinical trial record."""

    trial_id: str = Field(description="CTRI registration number, e.g. CTRI/2024/01/061234")
    title: str = Field(description="Public title of the trial")
    condition: str = Field(description="Primary health condition or disease being studied")
    intervention: str = Field(description="Name and type of intervention or comparator")
    inclusion: list[str] = Field(description="Individual inclusion criterion sentences")
    exclusion: list[str] = Field(description="Individual exclusion criterion sentences")
    inclusion_classified: list[CriteriaClassification] = Field(
        default_factory=list,
        description="Classified inclusion criteria",
    )
    exclusion_classified: list[CriteriaClassification] = Field(
        default_factory=list,
        description="Classified exclusion criteria",
    )
    age_min_months: int | None = Field(
        default=None, description="Minimum eligible age in months (e.g. 216 for 18 years)"
    )
    age_max_months: int | None = Field(
        default=None, description="Maximum eligible age in months (e.g. 780 for 65 years)"
    )
    gender: Literal["male", "female", "both"] = Field(
        description="Eligible gender for enrollment"
    )
    phase: str | None = Field(default=None, description="Trial phase, e.g. Phase 3")
    status: str = Field(description="Recruitment status, e.g. Recruiting, Completed")
    subjective_criteria_count: int = Field(
        default=0,
        description="Number of criteria requiring human review",
    )


class PatientProfile(BaseModel):
    """Normalised patient profile derived from AIKosh-shaped health record."""

    patient_id: str = Field(description="Anonymised patient identifier")
    age_months: int = Field(description="Patient age expressed in months")
    gender: Literal["male", "female"] = Field(description="Patient gender")
    conditions: list[str] = Field(description="Diagnosed primary conditions")
    comorbidities: list[str] = Field(default_factory=list, description="Co-existing conditions")
    location_state: str = Field(description="Indian state of residence")
    lab_values: dict[str, float] = Field(
        default_factory=dict,
        description="Key lab values as name→value pairs, e.g. hemoglobin_g_dl: 11.2",
    )
    prior_treatment: list[str] = Field(
        default_factory=list, description="Prior treatments received"
    )
    smoking_history: bool = Field(default=False, description="Smoking history flag")
    stage: str | None = Field(default=None, description="Disease stage if applicable")
    data_completeness: float = Field(
        default=1.0,
        description="0-1 score of data completeness",
    )
    data_quality_flags: list[str] = Field(
        default_factory=list,
        description="Warnings about data quality",
    )


class MatchResult(BaseModel):
    """Output of the coordinator after comparing a patient against a trial."""

    patient_id: str = Field(description="Anonymised patient identifier")
    trial_id: str = Field(description="CTRI trial number")
    eligible: bool = Field(description="Overall eligibility determination")
    score: int = Field(ge=0, le=100, description="Eligibility score from 0 (no fit) to 100 (full fit)")
    hard_filter_passed: bool = Field(
        description="True if patient passed age, gender, and status hard filters"
    )
    rationale: str = Field(description="Plain-English explanation of the scoring decision")
    disqualifying_criteria: list[str] = Field(
        default_factory=list,
        description="Specific exclusion criteria that disqualify this patient, if any",
    )
    # Decision Support Framework fields
    decision_support_only: bool = Field(
        default=True,
        description="Always true - this is a decision support tool, not autonomous",
    )
    requires_investigator_review: bool = Field(
        default=False,
        description="True if subjective criteria present or confidence is low",
    )
    confidence_level: Literal["high", "medium", "low"] = Field(
        default="medium",
        description="Confidence in the match recommendation",
    )
    risk_factors: list[str] = Field(
        default_factory=list,
        description="Why this recommendation might be wrong",
    )
    ai_scored_criteria: list[str] = Field(
        default_factory=list,
        description="Criteria that were objectively scored by AI",
    )
    requires_human_review_criteria: list[str] = Field(
        default_factory=list,
        description="Subjective criteria requiring human review",
    )
    # Data Quality fields
    missing_data_impact: float = Field(
        default=0.0,
        description="0-1 reduction in confidence due to missing data",
    )
    data_quality_warnings: list[str] = Field(
        default_factory=list,
        description="Warnings about data quality affecting this match",
    )


class CoordinatorState(TypedDict):
    """Shared state flowing through the LangGraph coordinator graph."""

    raw_trial: dict
    raw_patient: dict
    trial_criteria: TrialCriteria | None
    patient_profile: PatientProfile | None
    match_result: MatchResult | None


class BatchMatchStats(BaseModel):
    """Statistics for a batch match operation."""

    total: int = Field(description="Total patients processed")
    llm_calls: int = Field(description="Number of LLM scoring calls")
    hard_filtered: int = Field(description="Number filtered by hard criteria")
    high_confidence_matches: int = Field(description="Matches with high confidence")
    medium_confidence_matches: int = Field(description="Matches with medium confidence")
    low_confidence_matches: int = Field(description="Matches with low confidence")
    requiring_review: int = Field(description="Matches requiring human review")
    avg_processing_time_ms: float | None = Field(
        default=None,
        description="Average processing time per patient",
    )


class EvaluationMetrics(BaseModel):
    """Evaluation metrics for match quality."""

    true_positives: int = Field(default=0, description="Correctly identified eligible")
    true_negatives: int = Field(default=0, description="Correctly identified ineligible")
    false_positives: int = Field(default=0, description="Incorrectly identified eligible")
    false_negatives: int = Field(default=0, description="Incorrectly identified ineligible")

    @property
    def precision(self) -> float:
        """Precision: TP / (TP + FP)"""
        total = self.true_positives + self.false_positives
        return self.true_positives / total if total > 0 else 0.0

    @property
    def recall(self) -> float:
        """Recall: TP / (TP + FN)"""
        total = self.true_positives + self.false_negatives
        return self.true_positives / total if total > 0 else 0.0

    @property
    def specificity(self) -> float:
        """Specificity: TN / (TN + FP)"""
        total = self.true_negatives + self.false_positives
        return self.true_negatives / total if total > 0 else 0.0

    @property
    def f1_score(self) -> float:
        """F1 Score: Harmonic mean of precision and recall."""
        p = self.precision
        r = self.recall
        return 2 * p * r / (p + r) if (p + r) > 0 else 0.0

    @property
    def accuracy(self) -> float:
        """Overall accuracy."""
        total = (
            self.true_positives
            + self.true_negatives
            + self.false_positives
            + self.false_negatives
        )
        correct = self.true_positives + self.true_negatives
        return correct / total if total > 0 else 0.0
