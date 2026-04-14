"""
EDC (Electronic Data Capture) format configurations.

Supported formats:
- medidata_rave: Medidata Rave (most common in Indian CROs)
- veeva_vault: Veeva Vault CDMS (used by Parexel, IQVIA)
- redcap: REDCap (academic centers, Syngene)
- aikosh: AIKosh shaped data (original format)
- generic: Generic flat format
"""
from __future__ import annotations

from . import medidata_rave, redcap, veeva_vault

EDC_FORMATS = {
    "medidata_rave": {
        "columns": medidata_rave.MEDIDATA_RAVE_COLUMNS,
        "labs": medidata_rave.MEDIDATA_RAVE_LABS,
        "date_formats": medidata_rave.MEDIDATA_DATE_FORMATS,
        "gender_map": medidata_rave.MEDIDATA_GENDER_MAP,
        "boolean_map": medidata_rave.MEDIDATA_BOOLEAN_MAP,
    },
    "veeva_vault": {
        "columns": veeva_vault.VEEVA_VAULT_COLUMNS,
        "labs": veeva_vault.VEEVA_VAULT_LABS,
        "date_formats": veeva_vault.VEEVA_DATE_FORMATS,
        "gender_map": veeva_vault.VEEVA_GENDER_MAP,
        "boolean_map": veeva_vault.VEEVA_BOOLEAN_MAP,
    },
    "redcap": {
        "columns": redcap.REDCAP_COLUMNS,
        "labs": redcap.REDCAP_LABS,
        "date_formats": redcap.REDCAP_DATE_FORMATS,
        "gender_map": redcap.REDCAP_GENDER_MAP,
        "boolean_map": redcap.REDCAP_BOOLEAN_MAP,
    },
}

__all__ = ["EDC_FORMATS", "medidata_rave", "veeva_vault", "redcap"]
