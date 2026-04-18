from __future__ import annotations

import asyncio
import os
import time
import uuid as _uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from coordinator import graph, score_match
from ingest import MAPPERS, apply_mapper, load_tabular
from patient_agent import normalise_patient
from quality import DataQualityReport, MissingDataHandler, PatientDeduplicator
from schemas import MatchResult, PatientProfile, TrialCriteria

app = FastAPI(title="TrialBridge Agent API", version="1.0.0")

_INGEST_CONCURRENCY = 6  # parallel LLM calls for patient normalisation
_BATCH_CONCURRENCY = 8   # parallel score_match calls


class MatchRequest(BaseModel):
    """Full pipeline: raw CTRI JSON + raw AIKosh patient JSON → parse via LLM → score."""
    raw_trial: dict
    raw_patient: dict


class ParsedMatchRequest(BaseModel):
    """Direct scoring: pre-parsed TrialCriteria + PatientProfile → score (no LLM parse calls)."""
    trial_criteria: TrialCriteria
    patient_profile: PatientProfile


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/run_match", response_model=MatchResult)
def run_match(req: MatchRequest) -> MatchResult:
    """Full pipeline — parses both inputs via LLM then scores."""
    try:
        final_state = graph.invoke({
            "raw_trial": req.raw_trial,
            "raw_patient": req.raw_patient,
            "trial_criteria": None,
            "patient_profile": None,
            "match_result": None,
        })
        result: MatchResult = final_state["match_result"]
        if result is None:
            raise HTTPException(status_code=500, detail="Coordinator returned no match result")
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/run_match_parsed", response_model=MatchResult)
def run_match_parsed(req: ParsedMatchRequest) -> MatchResult:
    """Direct scoring from pre-parsed objects — bypasses LLM parse nodes."""
    try:
        state = {
            "raw_trial": {},
            "raw_patient": {},
            "trial_criteria": req.trial_criteria,
            "patient_profile": req.patient_profile,
            "match_result": None,
        }
        result_state = score_match(state)
        result: MatchResult = result_state["match_result"]
        if result is None:
            raise HTTPException(status_code=500, detail="score_match returned no result")
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class IngestDedupSummary(BaseModel):
    input_count: int
    duplicates_found: int
    unique_count: int
    candidates: list[dict[str, Any]] = []


class IngestDataQuality(BaseModel):
    average_completeness: float
    patients_with_missing_data: int
    missing_by_field: dict[str, int]
    imputation_applied: int
    critical_missing_count: int


class IngestResponse(BaseModel):
    patients: list[PatientProfile]
    warnings: list[str]
    total_rows: int
    parsed_rows: int
    mapper_used: str
    detected_format: str | None = None
    format_confidence: float | None = None
    deduplication: IngestDedupSummary | None = None
    data_quality: IngestDataQuality | None = None


class BatchMatchRequest(BaseModel):
    trial_criteria: TrialCriteria
    patient_profiles: list[PatientProfile]
    top_k: int | None = None


class BatchMatchStats(BaseModel):
    total: int
    llm_calls: int
    hard_filtered: int


class BatchMatchResponse(BaseModel):
    trial_id: str
    results: list[MatchResult]
    stats: BatchMatchStats


@app.post("/ingest_patients_csv", response_model=IngestResponse)
async def ingest_patients_csv(
    file: UploadFile = File(...),
    mapper: str = Form(default="aikosh_oral_cancer"),
) -> IngestResponse:
    """Ingest a CSV/XLSX patient file and normalise every row into a PatientProfile.

    - mapper: one of aikosh_oral_cancer | generic (default: aikosh_oral_cancer)
    - Max 2 MB / 500 rows enforced.
    """
    if mapper not in MAPPERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown mapper '{mapper}'. Available: {list(MAPPERS)}",
        )

    raw_bytes = await file.read()
    filename = file.filename or "upload.csv"

    try:
        rows = load_tabular(raw_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    warnings: list[str] = []
    mapped_rows: list[dict[str, Any]] = []
    for i, row in enumerate(rows):
        try:
            mapped_rows.append(apply_mapper(row, mapper))
        except Exception as exc:
            warnings.append(f"Row {i + 1}: mapping failed — {exc}")

    sem = asyncio.Semaphore(_INGEST_CONCURRENCY)

    async def _normalise(idx: int, raw: dict[str, Any]) -> PatientProfile | None:
        async with sem:
            try:
                profile = await asyncio.to_thread(normalise_patient, raw)
                # Attach visit context extracted by mapper (not known to LLM)
                visit_raw = raw.get("_visit")
                if visit_raw and isinstance(visit_raw, dict):
                    from schemas import VisitRecord
                    profile = profile.model_copy(update={"visit": VisitRecord(**{
                        k: v for k, v in visit_raw.items()
                        if k in VisitRecord.model_fields
                    })})
                return profile
            except Exception as exc:
                warnings.append(f"Row {idx + 1}: LLM normalisation failed — {exc}")
                return None

    tasks = [_normalise(i, r) for i, r in enumerate(mapped_rows)]
    results_raw = await asyncio.gather(*tasks)
    patients = [p for p in results_raw if p is not None]

    # Deduplication
    dedup_summary: IngestDedupSummary | None = None
    try:
        dedup_result = PatientDeduplicator().check_duplicates(
            [p.model_dump() for p in patients]
        )
        dedup_summary = IngestDedupSummary(
            input_count=dedup_result.total_patients,
            duplicates_found=dedup_result.duplicates_found,
            unique_count=dedup_result.unique_patients,
            candidates=[
                {
                    "patient_id_1": c.patient_id_1,
                    "patient_id_2": c.patient_id_2,
                    "confidence": c.confidence,
                    "recommendation": c.recommendation,
                }
                for c in dedup_result.candidates
            ],
        )
    except Exception as exc:
        warnings.append(f"Deduplication failed — {exc}")

    # Missing-data / cohort DQ (apply imputation to get lineage traces)
    dq_summary: IngestDataQuality | None = None
    try:
        patient_dicts = [p.model_dump() for p in patients]
        individual_reports, dq_report = MissingDataHandler().analyze_batch(
            patient_dicts, apply_imputation=True
        )
        dq_summary = IngestDataQuality(
            average_completeness=dq_report.average_completeness,
            patients_with_missing_data=dq_report.patients_with_missing_data,
            missing_by_field=dq_report.missing_by_field,
            imputation_applied=dq_report.imputation_applied,
            critical_missing_count=dq_report.critical_missing_count,
        )
        # Attach group-mean imputation traces to each profile
        from schemas import ImputationTrace as ITrace
        updated: list[PatientProfile] = []
        for profile, report in zip(patients, individual_reports):
            if report.imputed_fields:
                new_traces = list(profile.imputation_trace) + [
                    ITrace(field_id=fid, method="group_mean", source_value=str(val))
                    for fid, val in report.imputed_fields.items()
                ]
                profile = profile.model_copy(update={"imputation_trace": new_traces})
            updated.append(profile)
        patients = updated
    except Exception as exc:
        warnings.append(f"DQ analysis failed — {exc}")

    # Detected format from first mapped row (auto mapper sets _format_detected)
    detected_format: str | None = None
    format_confidence: float | None = None
    if mapped_rows:
        detected_format = mapped_rows[0].get("_format_detected")
        raw_conf = mapped_rows[0].get("_format_confidence")
        if isinstance(raw_conf, (int, float)):
            format_confidence = float(raw_conf)

    return IngestResponse(
        patients=patients,
        warnings=warnings,
        total_rows=len(rows),
        parsed_rows=len(patients),
        mapper_used=mapper,
        detected_format=detected_format,
        format_confidence=format_confidence,
        deduplication=dedup_summary,
        data_quality=dq_summary,
    )


# ---------------------------------------------------------------------------
# Async ingest job store — in-memory, single-process MVP
# ---------------------------------------------------------------------------

class _JobStatus:
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"

_INGEST_JOBS: dict[str, dict[str, Any]] = {}  # job_id → {status, result?, error?, started_at, done_at?}


class IngestJobCreated(BaseModel):
    job_id: str
    status: str
    message: str


class IngestJobStatus(BaseModel):
    job_id: str
    status: str
    elapsed_sec: float
    result: IngestResponse | None = None
    error: str | None = None


async def _run_ingest_job(job_id: str, file_bytes: bytes, filename: str, mapper: str) -> None:
    """Background coroutine that processes ingest and stores result in _INGEST_JOBS."""
    try:
        if mapper not in MAPPERS:
            raise ValueError(f"Unknown mapper '{mapper}'. Available: {list(MAPPERS)}")

        try:
            rows = load_tabular(file_bytes, filename)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

        warnings_: list[str] = []
        mapped_rows: list[dict[str, Any]] = []
        for i, row in enumerate(rows):
            try:
                mapped_rows.append(apply_mapper(row, mapper))
            except Exception as exc:
                warnings_.append(f"Row {i + 1}: mapping failed — {exc}")

        sem = asyncio.Semaphore(_INGEST_CONCURRENCY)

        async def _normalise(idx: int, raw: dict[str, Any]) -> PatientProfile | None:
            async with sem:
                try:
                    profile = await asyncio.to_thread(normalise_patient, raw)
                    visit_raw = raw.get("_visit")
                    if visit_raw and isinstance(visit_raw, dict):
                        from schemas import VisitRecord
                        profile = profile.model_copy(update={"visit": VisitRecord(**{
                            k: v for k, v in visit_raw.items()
                            if k in VisitRecord.model_fields
                        })})
                    return profile
                except Exception as exc:
                    warnings_.append(f"Row {idx + 1}: LLM normalisation failed — {exc}")
                    return None

        results_raw = await asyncio.gather(*[_normalise(i, r) for i, r in enumerate(mapped_rows)])
        patients = [p for p in results_raw if p is not None]

        dedup_summary: IngestDedupSummary | None = None
        try:
            dedup_result = PatientDeduplicator().check_duplicates([p.model_dump() for p in patients])
            dedup_summary = IngestDedupSummary(
                input_count=dedup_result.total_patients,
                duplicates_found=dedup_result.duplicates_found,
                unique_count=dedup_result.unique_patients,
                candidates=[
                    {"patient_id_1": c.patient_id_1, "patient_id_2": c.patient_id_2,
                     "confidence": c.confidence, "recommendation": c.recommendation}
                    for c in dedup_result.candidates
                ],
            )
        except Exception as exc:
            warnings_.append(f"Deduplication failed — {exc}")

        dq_summary: IngestDataQuality | None = None
        try:
            patient_dicts_ = [p.model_dump() for p in patients]
            individual_reports_, dq_report = MissingDataHandler().analyze_batch(patient_dicts_, apply_imputation=True)
            dq_summary = IngestDataQuality(
                average_completeness=dq_report.average_completeness,
                patients_with_missing_data=dq_report.patients_with_missing_data,
                missing_by_field=dq_report.missing_by_field,
                imputation_applied=dq_report.imputation_applied,
                critical_missing_count=dq_report.critical_missing_count,
            )
            from schemas import ImputationTrace as ITrace
            updated_: list[PatientProfile] = []
            for profile, report in zip(patients, individual_reports_):
                if report.imputed_fields:
                    new_traces = list(profile.imputation_trace) + [
                        ITrace(field_id=fid, method="group_mean", source_value=str(val))
                        for fid, val in report.imputed_fields.items()
                    ]
                    profile = profile.model_copy(update={"imputation_trace": new_traces})
                updated_.append(profile)
            patients = updated_
        except Exception as exc:
            warnings_.append(f"DQ analysis failed — {exc}")

        detected_format: str | None = None
        format_confidence: float | None = None
        if mapped_rows:
            detected_format = mapped_rows[0].get("_format_detected")
            raw_conf = mapped_rows[0].get("_format_confidence")
            if isinstance(raw_conf, (int, float)):
                format_confidence = float(raw_conf)

        response = IngestResponse(
            patients=patients,
            warnings=warnings_,
            total_rows=len(rows),
            parsed_rows=len(patients),
            mapper_used=mapper,
            detected_format=detected_format,
            format_confidence=format_confidence,
            deduplication=dedup_summary,
            data_quality=dq_summary,
        )
        _INGEST_JOBS[job_id]["status"] = _JobStatus.DONE
        _INGEST_JOBS[job_id]["result"] = response
        _INGEST_JOBS[job_id]["done_at"] = time.time()
    except Exception as exc:
        _INGEST_JOBS[job_id]["status"] = _JobStatus.FAILED
        _INGEST_JOBS[job_id]["error"] = str(exc)
        _INGEST_JOBS[job_id]["done_at"] = time.time()


@app.post("/ingest_async", response_model=IngestJobCreated)
async def ingest_async(
    file: UploadFile = File(...),
    mapper: str = Form(default="aikosh_oral_cancer"),
) -> IngestJobCreated:
    """Start an ingest job in the background; returns job_id immediately."""
    raw_bytes = await file.read()
    filename = file.filename or "upload.csv"
    job_id = str(_uuid.uuid4())
    _INGEST_JOBS[job_id] = {"status": _JobStatus.RUNNING, "started_at": time.time()}
    asyncio.create_task(_run_ingest_job(job_id, raw_bytes, filename, mapper))
    return IngestJobCreated(job_id=job_id, status=_JobStatus.RUNNING, message=f"Job started. Poll /ingest_jobs/{job_id}")


@app.get("/ingest_jobs/{job_id}", response_model=IngestJobStatus)
def get_ingest_job(job_id: str) -> IngestJobStatus:
    """Poll ingest job status and retrieve result when done."""
    job = _INGEST_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    elapsed = time.time() - job["started_at"]
    return IngestJobStatus(
        job_id=job_id,
        status=job["status"],
        elapsed_sec=round(elapsed, 1),
        result=job.get("result"),
        error=job.get("error"),
    )


@app.get("/field_catalog")
def get_field_catalog() -> list[dict]:
    """Return the versioned CDASH-like field catalog as JSON."""
    from quality.field_catalog import load_catalog
    return [
        {
            "field_id": f.field_id,
            "label": f.label,
            "cdash": f.cdash,
            "sdtm": f.sdtm,
            "type": f.type,
            "critical": f.critical,
            "imputable": f.imputable,
            "required": f.required,
        }
        for f in load_catalog()
    ]


@app.post("/batch_match_parsed", response_model=BatchMatchResponse)
async def batch_match_parsed(req: BatchMatchRequest) -> BatchMatchResponse:
    """Score a list of pre-parsed patient profiles against one trial, return ranked results.

    Hard filters (status/gender/age) run deterministically first; LLM scoring
    is called only for patients that pass. Results are sorted by score desc.
    """
    sem = asyncio.Semaphore(_BATCH_CONCURRENCY)

    async def _score(profile: PatientProfile) -> MatchResult:
        async with sem:
            state: dict[str, Any] = {
                "raw_trial": {},
                "raw_patient": {},
                "trial_criteria": req.trial_criteria,
                "patient_profile": profile,
                "match_result": None,
            }
            result_state = await asyncio.to_thread(score_match, state)
            return result_state["match_result"]

    raw_results = await asyncio.gather(*[_score(p) for p in req.patient_profiles])

    results = sorted(
        raw_results,
        key=lambda r: (r.score, r.eligible, r.hard_filter_passed),
        reverse=True,
    )

    if req.top_k is not None:
        results = results[: req.top_k]

    hard_filtered = sum(1 for r in raw_results if not r.hard_filter_passed)
    llm_calls = len(raw_results) - hard_filtered

    return BatchMatchResponse(
        trial_id=req.trial_criteria.trial_id,
        results=results,
        stats=BatchMatchStats(
            total=len(raw_results),
            llm_calls=llm_calls,
            hard_filtered=hard_filtered,
        ),
    )



# ---------------------------------------------------------------------------
# Query / clarification workflow (Phase 5)
# ---------------------------------------------------------------------------

from quality.queries import (
    Query as DmQuery,
    QueryCreate,
    QueryReply,
    REASON_CODES,
    create_query,
    get_query as _get_query,
    list_queries,
    answer_query,
    close_query,
    void_query,
)


@app.get("/queries/reason_codes")
def get_reason_codes() -> list[str]:
    """Return the standard DM reason codes for query creation."""
    return REASON_CODES


@app.post("/queries", response_model=DmQuery)
def create_dm_query(payload: QueryCreate) -> DmQuery:
    """Raise a new data-clarification query against a subject + field."""
    return create_query(payload)


@app.get("/queries", response_model=list[DmQuery])
def list_dm_queries(
    subject_id: str | None = None,
    field_id: str | None = None,
    status: str | None = None,
) -> list[DmQuery]:
    """List queries, optionally filtered by subject, field, or status."""
    return list_queries(subject_id=subject_id, field_id=field_id, status=status)  # type: ignore[arg-type]


@app.get("/queries/{query_id}", response_model=DmQuery)
def get_dm_query(query_id: str) -> DmQuery:
    q = _get_query(query_id)
    if not q:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    return q


@app.post("/queries/{query_id}/answer", response_model=DmQuery)
def answer_dm_query(query_id: str, reply: QueryReply) -> DmQuery:
    """Post an answer to an open query."""
    q = answer_query(query_id, reply)
    if not q:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    return q


@app.post("/queries/{query_id}/close", response_model=DmQuery)
def close_dm_query(query_id: str) -> DmQuery:
    q = close_query(query_id)
    if not q:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    return q


@app.post("/queries/{query_id}/void", response_model=DmQuery)
def void_dm_query(query_id: str) -> DmQuery:
    q = void_query(query_id)
    if not q:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    return q


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", "8100"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)