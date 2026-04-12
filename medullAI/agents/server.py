from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from coordinator import graph, score_match
from schemas import MatchResult, PatientProfile, TrialCriteria

app = FastAPI(title="TrialBridge Agent API", version="1.0.0")


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", "8100"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
