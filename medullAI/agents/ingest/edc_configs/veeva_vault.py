"""
Veeva Vault CDMS export format configuration.
Used by Parexel, IQVIA, and large pharma.
"""
from __future__ import annotations

VEEVA_VAULT_COLUMNS = {
    "patient_id": [
        "subject__v", "subject_id__v", "patient__v", "subject",
        "subject_identifier", "study_subject_id"
    ],
    "age": [
        "age__v", "age_years__v", "age_at_screening__v",
        "screening_age__v", "age_screening"
    ],
    "gender": [
        "gender__v", "sex__v", "subject_gender__v",
        "biological_sex__v", "sex_at_birth__v"
    ],
    "state": [
        "site_state__v", "state__v", "site_region__v",
        "site_location__v", "site_country__v"
    ],
    "primary_diagnosis": [
        "primary_diagnosis__v", "diagnosis__v", "main_diagnosis__v",
        "indication__v", "condition__v", "disease__v"
    ],
    "icd_code": [
        "icd_code__v", "icd10_code__v", "diagnosis_code__v",
        "indication_code__v"
    ],
    "stage": [
        "disease_stage__v", "stage__v", "cancer_stage__v",
        "tumor_stage__v", "ajcc_stage__v"
    ],
    "comorbidities": [
        "comorbidities__v", "medical_history__v", "pmh__v",
        "past_medical_history__v", "other_conditions__v"
    ],
    "prior_treatment": [
        "prior_treatment__v", "prior_therapy__v", "treatment_history__v",
        "previous_medication__v", "concomitant_meds__v"
    ],
    "smoking_history": [
        "smoking_history__v", "tobacco_use__v", "smoking__v",
        "smoking_status__v"
    ],
    "ecog_ps": [
        "ecog__v", "ecog_ps__v", "performance_status__v",
        "ps__v", "ecog_performance_status__v"
    ],
}

VEEVA_VAULT_LABS = {
    "hemoglobin": {
        "columns": ["hemoglobin__v", "hb__v", "hgb__v", "hemoglobin_result__v"],
        "unit": "g/dL",
        "alternate_units": ["g/L"],
        "conversion": {"g/L": lambda x: x / 10}
    },
    "wbc_count": {
        "columns": ["wbc__v", "wbc_count__v", "white_blood_cell__v"],
        "unit": "per_ul",
        "alternate_units": ["10^3/uL"],
        "conversion": {"10^3/uL": lambda x: x * 1000}
    },
    "platelet_count": {
        "columns": ["platelets__v", "plt__v", "platelet_count__v"],
        "unit": "per_ul",
        "alternate_units": ["10^3/uL"],
        "conversion": {"10^3/uL": lambda x: x * 1000}
    },
    "serum_creatinine": {
        "columns": ["creatinine__v", "scr__v", "serum_creatinine__v"],
        "unit": "mg/dL",
        "alternate_units": ["umol/L"],
        "conversion": {"umol/L": lambda x: x / 88.42}
    },
    "alt": {
        "columns": ["alt__v", "alanine_aminotransferase__v", "sgpt__v"],
        "unit": "U/L",
        "alternate_units": [],
        "conversion": {}
    },
    "hba1c": {
        "columns": ["hba1c__v", "hemoglobin_a1c__v", "a1c__v"],
        "unit": "%",
        "alternate_units": ["mmol/mol"],
        "conversion": {"mmol/mol": lambda x: (x * 0.0915) + 2.15}
    },
    "fasting_glucose": {
        "columns": ["fasting_glucose__v", "glucose__v", "fbg__v"],
        "unit": "mg/dL",
        "alternate_units": ["mmol/L"],
        "conversion": {"mmol/L": lambda x: x * 18}
    },
    "egfr": {
        "columns": ["egfr__v", "estimated_gfr__v", "gfr__v"],
        "unit": "mL/min",
        "alternate_units": [],
        "conversion": {}
    },
}

VEEVA_DATE_FORMATS = [
    "%Y-%m-%d",
    "%d-%b-%Y",
    "%d/%m/%Y",
]

VEEVA_GENDER_MAP = {
    "male": ["male", "m", "man", "male__v"],
    "female": ["female", "f", "woman", "female__v"],
}

VEEVA_BOOLEAN_MAP = {
    True: ["yes__v", "yes", "y", "true", "1", "positive"],
    False: ["no__v", "no", "n", "false", "0", "negative", "na__v"],
}
