"""
Data quality module for TrialBridge.

Provides:
- Deduplication of patient records
- Missing data handling and imputation
- Data validation and confidence scoring
- Versioned field catalog (CDASH-like)
"""
from __future__ import annotations

from .deduplicator import DuplicateCandidate, DeduplicationResult, PatientDeduplicator
from .field_catalog import FieldSpec, catalog_by_id, critical_field_ids, get_missing_field_ids, load_catalog
from .missing_data import MissingDataHandler, DataQualityReport
from .queries import (
    Query, QueryCreate, QueryReply, QueryStatus,
    REASON_CODES, create_query, get_query, list_queries,
    answer_query, close_query, void_query,
)

__all__ = [
    "DuplicateCandidate",
    "DeduplicationResult",
    "PatientDeduplicator",
    "MissingDataHandler",
    "DataQualityReport",
    "FieldSpec",
    "load_catalog",
    "catalog_by_id",
    "critical_field_ids",
    "get_missing_field_ids",
    "Query",
    "QueryCreate",
    "QueryReply",
    "QueryStatus",
    "REASON_CODES",
    "create_query",
    "get_query",
    "list_queries",
    "answer_query",
    "close_query",
    "void_query",
]
