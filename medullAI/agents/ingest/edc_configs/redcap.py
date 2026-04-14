"""
REDCap export format configuration.
Commonly used by academic medical centers and smaller CROs like Syngene.
"""
from __future__ import annotations

REDCAP_COLUMNS = {
    "patient_id": [
        "record_id", "subject_id", "patient_id", "participant_id",
        "study_id", "redcap_id"
    ],
    "age": [
        "age", "age_years", "current_age", "age_at_enrollment",
        "enrollment_age", "screen_age"
    ],
    "gender": [
        "gender", "sex", "biological_sex", "sex_at_birth",
        "patient_gender", "subject_sex"
    ],
    "state": [
        "state", "site_state", "location_state", "patient_state",
        "residence_state", "state_of_residence"
    ],
    "primary_diagnosis": [
        "primary_diagnosis", "diagnosis", "main_diagnosis",
        "condition", "disease", "study_diagnosis"
    ],
    "icd_code": [
        "icd_code", "icd10", "icd9", "diagnosis_code",
        "primary_icd_code"
    ],
    "stage": [
        "stage", "disease_stage", "cancer_stage", "tumor_stage",
        "clinical_stage", "path_stage"
    ],
    "comorbidities": [
        "comorbidities", "comorbid", "medical_history",
        "past_medical_history", "pmh", "history"
    ],
    "prior_treatment": [
        "prior_treatment", "prior_therapy", "treatment_history",
        "previous_treatment", "med_history"
    ],
    "smoking_history": [
        "smoking_history", "smoking", "tobacco_use",
        "smoking_status", "tobacco_status"
    ],
    "ecog_ps": [
        "ecog", "ecog_ps", "performance_status", "ps",
        "ecog_performance_status", "karnofsky_score"
    ],
}

REDCAP_LABS = {
    "hemoglobin": {
        "columns": ["hemoglobin", "hb", "hgb", "hemoglobin_lab"],
        "unit": "g/dL",
        "alternate_units": ["g/L"],
        "conversion": {"g/L": lambda x: x / 10}
    },
    "wbc_count": {
        "columns": ["wbc", "wbc_count", "white_blood_cell_count", "wbc_lab"],
        "unit": "per_ul",
        "alternate_units": ["10_3_ul", "k_ul"],
        "conversion": {"10_3_ul": lambda x: x * 1000, "k_ul": lambda x: x * 1000}
    },
    "platelet_count": {
        "columns": ["platelets", "plt", "platelet_count", "plt_lab"],
        "unit": "per_ul",
        "alternate_units": ["10_3_ul", "k_ul"],
        "conversion": {"10_3_ul": lambda x: x * 1000, "k_ul": lambda x: x * 1000}
    },
    "serum_creatinine": {
        "columns": ["creatinine", "scr", "serum_creatinine", "creatinine_lab"],
        "unit": "mg/dL",
        "alternate_units": ["umol_l"],
        "conversion": {"umol_l": lambda x: x / 88.42}
    },
    "alt": {
        "columns": ["alt", "alanine_aminotransferase", "sgpt", "alt_lab"],
        "unit": "U/L",
        "alternate_units": [],
        "conversion": {}
    },
    "hba1c": {
        "columns": ["hba1c", "hemoglobin_a1c", "a1c", "hba1c_lab"],
        "unit": "%",
        "alternate_units": ["mmol_mol"],
        "conversion": {"mmol_mol": lambda x: (x * 0.0915) + 2.15}
    },
    "fasting_glucose": {
        "columns": ["fasting_glucose", "glucose", "fbg", "glucose_lab"],
        "unit": "mg/dL",
        "alternate_units": ["mmol_l"],
        "conversion": {"mmol_l": lambda x: x * 18}
    },
    "egfr": {
        "columns": ["egfr", "estimated_gfr", "gfr", "egfr_lab"],
        "unit": "mL/min",
        "alternate_units": [],
        "conversion": {}
    },
}

REDCAP_DATE_FORMATS = [
    "%Y-%m-%d",
    "%d-%b-%Y",
    "%d/%m/%Y",
    "%m/%d/%Y",
]

REDCAP_GENDER_MAP = {
    "male": ["male", "m", "man", "1"],
    "female": ["female", "f", "woman", "2"],
}

REDCAP_BOOLEAN_MAP = {
    True: ["yes", "y", "true", "1", "current", "former"],  # Include former for smoking
    False: ["no", "n", "false", "0", "never", "na"],
}
