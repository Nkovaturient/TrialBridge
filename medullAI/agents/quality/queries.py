"""
Lightweight query/clarification workflow for data management review.

A "query" in DM language is a data clarification request raised against a specific
subject + field + visit. This module provides the in-memory store and entity definitions.
For production, replace _QUERY_STORE with a database-backed implementation.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


QueryStatus = Literal["open", "answered", "closed", "void"]

# Standard DM reason codes (ICH E6 / CDISC-aligned)
REASON_CODES = [
    "MISSING_VALUE",
    "INCONSISTENT_VALUE",
    "OUT_OF_RANGE",
    "PROTOCOL_DEVIATION",
    "DATA_ENTRY_ERROR",
    "ILLEGIBLE",
    "UNVERIFIABLE",
    "OTHER",
]


class QueryCreate(BaseModel):
    subject_id: str = Field(description="Patient / subject ID")
    field_id: str = Field(description="Catalog field_id the query concerns")
    visit_id: str | None = Field(default=None, description="Visit label if applicable")
    form_id: str | None = Field(default=None, description="CRF form if applicable")
    reason_code: str = Field(description="DM reason code from REASON_CODES list")
    description: str = Field(description="Free-text description of the discrepancy")
    raised_by: str = Field(default="system", description="User or system role that raised the query")


class QueryReply(BaseModel):
    answer: str = Field(description="Response text from site / coordinator")
    answered_by: str = Field(default="site", description="Who answered")


class Query(BaseModel):
    query_id: str
    subject_id: str
    field_id: str
    visit_id: str | None
    form_id: str | None
    reason_code: str
    description: str
    raised_by: str
    status: QueryStatus
    created_at: float
    updated_at: float
    answer: str | None = None
    answered_by: str | None = None
    closed_at: float | None = None


# ---------------------------------------------------------------------------
# In-memory store — replace with DB-backed repo for production
# ---------------------------------------------------------------------------

_QUERY_STORE: dict[str, Query] = {}


def create_query(payload: QueryCreate) -> Query:
    qid = str(uuid.uuid4())
    now = time.time()
    query = Query(
        query_id=qid,
        subject_id=payload.subject_id,
        field_id=payload.field_id,
        visit_id=payload.visit_id,
        form_id=payload.form_id,
        reason_code=payload.reason_code,
        description=payload.description,
        raised_by=payload.raised_by,
        status="open",
        created_at=now,
        updated_at=now,
    )
    _QUERY_STORE[qid] = query
    return query


def get_query(query_id: str) -> Query | None:
    return _QUERY_STORE.get(query_id)


def list_queries(
    subject_id: str | None = None,
    field_id: str | None = None,
    status: QueryStatus | None = None,
) -> list[Query]:
    results = list(_QUERY_STORE.values())
    if subject_id:
        results = [q for q in results if q.subject_id == subject_id]
    if field_id:
        results = [q for q in results if q.field_id == field_id]
    if status:
        results = [q for q in results if q.status == status]
    return sorted(results, key=lambda q: q.created_at, reverse=True)


def answer_query(query_id: str, reply: QueryReply) -> Query | None:
    q = _QUERY_STORE.get(query_id)
    if not q:
        return None
    now = time.time()
    updated = q.model_copy(update={
        "status": "answered",
        "answer": reply.answer,
        "answered_by": reply.answered_by,
        "updated_at": now,
    })
    _QUERY_STORE[query_id] = updated
    return updated


def close_query(query_id: str) -> Query | None:
    q = _QUERY_STORE.get(query_id)
    if not q:
        return None
    now = time.time()
    updated = q.model_copy(update={"status": "closed", "closed_at": now, "updated_at": now})
    _QUERY_STORE[query_id] = updated
    return updated


def void_query(query_id: str) -> Query | None:
    q = _QUERY_STORE.get(query_id)
    if not q:
        return None
    now = time.time()
    updated = q.model_copy(update={"status": "void", "updated_at": now})
    _QUERY_STORE[query_id] = updated
    return updated
