from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field
from typing_extensions import TypedDict


class TrialCriteria(BaseModel):
    """Structured representation of a CTRI clinical trial record."""

    trial_id: str = Field(description="CTRI registration number, e.g. CTRI/2024/01/061234")
    title: str = Field(description="Public title of the trial")
    condition: str = Field(description="Primary health condition or disease being studied")
    intervention: str = Field(description="Name and type of intervention or comparator")
    inclusion: list[str] = Field(description="Individual inclusion criterion sentences")
    exclusion: list[str] = Field(description="Individual exclusion criterion sentences")
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


class CoordinatorState(TypedDict):
    """Shared state flowing through the LangGraph coordinator graph."""

    raw_trial: dict
    raw_patient: dict
    trial_criteria: TrialCriteria | None
    patient_profile: PatientProfile | None
    match_result: MatchResult | None
