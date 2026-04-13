from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from coordinator import graph, score_match
from ingest import MAPPERS, apply_mapper, load_tabular
from patient_agent import normalise_patient
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


class IngestResponse(BaseModel):
    patients: list[PatientProfile]
    warnings: list[str]
    total_rows: int
    parsed_rows: int
    mapper_used: str


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
                return await asyncio.to_thread(normalise_patient, raw)
            except Exception as exc:
                warnings.append(f"Row {idx + 1}: LLM normalisation failed — {exc}")
                return None

    tasks = [_normalise(i, r) for i, r in enumerate(mapped_rows)]
    results_raw = await asyncio.gather(*tasks)
    patients = [p for p in results_raw if p is not None]

    return IngestResponse(
        patients=patients,
        warnings=warnings,
        total_rows=len(rows),
        parsed_rows=len(patients),
        mapper_used=mapper,
    )


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", "8100"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
