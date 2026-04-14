"""
Medidata Rave EDC export format configuration.
Most common EDC in Indian CROs (Veeda, Lambda, etc.)
"""
from __future__ import annotations

# Medidata Rave common column patterns (column name variations)
MEDIDATA_RAVE_COLUMNS = {
    "patient_id": [
        "subjectid", "subject_id", "patient_id", "patid", "participant_id",
        "subject", "patient", "subjectkey", "usubjid"
    ],
    "age": [
        "age", "age_years", "ageyrs", "ageyr", "subject_age",
        "age_at_screening", "screening_age"
    ],
    "gender": [
        "gender", "sex", "subject_gender", "subject_sex",
        "sex_at_birth", "biological_sex"
    ],
    "state": [
        "state", "site_state", "location_state", "state_province",
        "region", "site_region", "geographic_region"
    ],
    "primary_diagnosis": [
        "primary_diagnosis", "diagnosis", "main_diagnosis", "condition",
        "disease", "indication", "primary_condition", "principal_diagnosis"
    ],
    "icd_code": [
        "icd_code", "icd10", "icd9", "icd", "diagnosis_code",
        "disease_code", "code", "icd10cm"
    ],
    "stage": [
        "stage", "cancer_stage", "disease_stage", "tumor_stage",
        "clinical_stage", "pathologic_stage", "ajcc_stage"
    ],
    "comorbidities": [
        "comorbidities", "comorbid_conditions", "other_conditions",
        "medical_history", "past_medical_history", "pmh"
    ],
    "prior_treatment": [
        "prior_treatment", "prior_therapy", "previous_treatment",
        "treatment_history", "prior_medication", "concomitant_meds"
    ],
    "smoking_history": [
        "smoking_history", "smoking", "tobacco_use", "smoker",
        "smoking_status", "tobacco_status"
    ],
    "ecog_ps": [
        "ecog", "ecog_ps", "performance_status", "ps", "ecog_performance_status",
        "who_ps", "karnofsky", "ecog_score"
    ],
}

# Lab value columns with unit variations
MEDIDATA_RAVE_LABS = {
    "hemoglobin": {
        "columns": [
            "hemoglobin", "hb", "hgb", "hemoglobingdl", "hemoglobin_gdl",
            "hbgdl", "hemoglobin_val"
        ],
        "unit": "g/dL",
        "alternate_units": ["g/L"],
        "conversion": {"g/L": lambda x: x / 10}  # g/L to g/dL
    },
    "wbc_count": {
        "columns": [
            "wbc", "white_blood_cell", "wbc_count", "wbccount",
            "leukocyte_count", "wbc_ul", "wbc_per_ul"
        ],
        "unit": "per_ul",
        "alternate_units": ["10^3/uL", "K/uL"],
        "conversion": {"10^3/uL": lambda x: x * 1000, "K/uL": lambda x: x * 1000}
    },
    "platelet_count": {
        "columns": [
            "platelets", "plt", "platelet_count", "pltcount",
            "platelet", "plt_ul", "platelets_per_ul"
        ],
        "unit": "per_ul",
        "alternate_units": ["10^3/uL", "K/uL"],
        "conversion": {"10^3/uL": lambda x: x * 1000, "K/uL": lambda x: x * 1000}
    },
    "serum_creatinine": {
        "columns": [
            "creatinine", "scr", "serum_creatinine", "creat",
            "creatinine_mgdl", "creatinine_val"
        ],
        "unit": "mg/dL",
        "alternate_units": ["umol/L", "micromol/L"],
        "conversion": {"umol/L": lambda x: x / 88.42, "micromol/L": lambda x: x / 88.42}
    },
    "alt": {
        "columns": [
            "alt", "alanine_aminotransferase", "sgpt",
            "alanine_transaminase", "alt_u_l", "alt_ul"
        ],
        "unit": "U/L",
        "alternate_units": [],
        "conversion": {}
    },
    "ast": {
        "columns": [
            "ast", "aspartate_aminotransferase", "sgot",
            "aspartate_transaminase", "ast_u_l", "ast_ul"
        ],
        "unit": "U/L",
        "alternate_units": [],
        "conversion": {}
    },
    "hba1c": {
        "columns": [
            "hba1c", "hemoglobin_a1c", "glycosylated_hemoglobin",
            "a1c", "hba1c_percent", "hba1c_val"
        ],
        "unit": "%",
        "alternate_units": ["mmol/mol"],
        "conversion": {"mmol/mol": lambda x: (x * 0.0915) + 2.15}
    },
    "fasting_glucose": {
        "columns": [
            "fasting_glucose", "glucose", "fasting_blood_glucose",
            "fbg", "glucose_mgdl", "glucose_fasting"
        ],
        "unit": "mg/dL",
        "alternate_units": ["mmol/L"],
        "conversion": {"mmol/L": lambda x: x * 18}
    },
    "egfr": {
        "columns": [
            "egfr", "estimated_gfr", "glomerular_filtration_rate",
            "egfr_mlmin", "gfr", "mdrd_gfr"
        ],
        "unit": "mL/min",
        "alternate_units": ["mL/min/1.73m2"],
        "conversion": {}
    },
    "bilirubin_total": {
        "columns": [
            "bilirubin", "total_bilirubin", "bilirubin_total",
            "tbil", "bilirubin_mgdl"
        ],
        "unit": "mg/dL",
        "alternate_units": ["umol/L"],
        "conversion": {"umol/L": lambda x: x / 17.1}
    },
    "albumin": {
        "columns": [
            "albumin", "serum_albumin", "albumin_gdl"
        ],
        "unit": "g/dL",
        "alternate_units": ["g/L"],
        "conversion": {"g/L": lambda x: x / 10}
    },
}

# Date formats commonly seen in Medidata exports
MEDIDATA_DATE_FORMATS = [
    "%Y-%m-%d",      # ISO format
    "%d-%b-%Y",      # 15-Jan-2024
    "%d/%m/%Y",      # Indian format
    "%m/%d/%Y",      # US format
    "%Y%m%d",        # Compact
    "%d-%m-%Y",      # Alternative Indian
]

# Gender value mappings
MEDIDATA_GENDER_MAP = {
    "male": ["male", "m", "man", "1", "m_"],
    "female": ["female", "f", "woman", "2", "f_"],
}

# Boolean/Yes-No mappings
MEDIDATA_BOOLEAN_MAP = {
    True: ["yes", "y", "true", "1", "positive", "pos", "+"],
    False: ["no", "n", "false", "0", "negative", "neg", "-", "na", "n/a"],
}
