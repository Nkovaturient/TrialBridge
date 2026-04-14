"""
Data quality module for TrialBridge.

Provides:
- Deduplication of patient records
- Missing data handling and imputation
- Data validation and confidence scoring
"""
from __future__ import annotations

from .deduplicator import DuplicateCandidate, DeduplicationResult, PatientDeduplicator
from .missing_data import MissingDataHandler, DataQualityReport

__all__ = [
    "DuplicateCandidate",
    "DeduplicationResult",
    "PatientDeduplicator",
    "MissingDataHandler",
    "DataQualityReport",
]
