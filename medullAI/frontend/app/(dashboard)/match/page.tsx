"use client";

import { useState } from "react";
import ResultPanel from "@/components/ResultPanel";
import PipelineLog from "@/components/PipelineLog";
import type { MatchResult, PipelinePhase } from "@/lib/types";

const DEFAULT_TRIAL = JSON.stringify(
  {
    ctri_number: "CTRI/2023/11/059302",
    title: "Efficacy of Topical Curcumin Gel in Oral Potentially Malignant Disorders",
    condition: "Leukoplakia or Oral Submucous Fibrosis (OSMF)",
    intervention: "Topical Curcumin 2% Gel vs Placebo",
    phase: "Phase 2",
    status: "Recruiting",
    inclusion_criteria: [
      "Diagnosed with oral leukoplakia or OSMF",
      "Age 18–65 years",
      "Willing to provide written informed consent",
    ],
    exclusion_criteria: [
      "Prior or current malignancy of any site",
      "Established diagnosis of diabetes mellitus or on anti-diabetic medication",
      "Pregnant or lactating women",
    ],
    min_age_years: 18,
    max_age_years: 65,
    gender: "both",
    principal_investigator: "Dr. A. Sharma",
  },
  null,
  2,
);

const DEFAULT_PATIENT = JSON.stringify(
  {
    patient_id: "PID_anon_001",
    age_years: 58,
    gender: "male",
    primary_conditions: ["Oral Squamous Cell Carcinoma"],
    comorbidities: ["Type 2 Diabetes Mellitus"],
    location_state: "Maharashtra",
    lab_values: { hba1c: 7.4 },
    prior_treatment: ["Surgical resection"],
    smoking_history: true,
    stage: "Stage II",
  },
  null,
  2,
);

type RunState = "idle" | "paying" | "running" | "logging" | "done" | "error";

const PHASES_SEQUENCE: PipelinePhase[] = [
  { name: "x402_payment", status: "settled" },
];

export default function MatchPage() {
  const [trialJson, setTrialJson] = useState(DEFAULT_TRIAL);
  const [patientJson, setPatientJson] = useState(DEFAULT_PATIENT);
  const [runState, setRunState] = useState<RunState>("idle");
  const [visiblePhases, setVisiblePhases] = useState<PipelinePhase[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRun() {
    setRunState("paying");
    setVisiblePhases([]);
    setResult(null);
    setErrorMsg(null);

    let trialData: unknown, patientData: unknown;
    try {
      trialData = JSON.parse(trialJson);
      patientData = JSON.parse(patientJson);
    } catch {
      setErrorMsg("Invalid JSON in trial or patient field.");
      setRunState("error");
      return;
    }

    // Animate payment phase start
    await delay(300);
    setRunState("running");
    setVisiblePhases([{ name: "x402_payment", status: "settled" }]);

    try {
      const resp = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_trial: trialData, raw_patient: patientData }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }

      const matchResult = data as MatchResult;

      // Animate pipeline phases in sequence
      const backendPhases = matchResult.pipeline ?? [];
      for (const phase of backendPhases) {
        setVisiblePhases((prev) => [...prev, phase]);
        await delay(200);
      }

      setResult(matchResult);
      setRunState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setRunState("error");
    }
  }

  const isRunning = runState === "paying" || runState === "running" || runState === "logging";

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Run Eligibility Match
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Enter CTRI trial criteria and patient profile. Payment of{" "}
          <span style={{ color: "var(--accent)" }}>$0.10 USDC</span> is deducted automatically via{" "}
          <span style={{ color: "var(--accent)" }}>x402</span> from your org wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          {/* Trial input */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Trial Record (CTRI JSON)
            </label>
            <textarea
              value={trialJson}
              onChange={(e) => setTrialJson(e.target.value)}
              rows={16}
              spellCheck={false}
              disabled={isRunning}
              className="w-full rounded-xl px-4 py-3 text-xs resize-none focus:outline-none focus:ring-1 transition-opacity disabled:opacity-50"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          </div>

          {/* Patient input */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Patient Profile (AIKosh JSON)
            </label>
            <textarea
              value={patientJson}
              onChange={(e) => setPatientJson(e.target.value)}
              rows={16}
              spellCheck={false}
              disabled={isRunning}
              className="w-full rounded-xl px-4 py-3 text-xs resize-none focus:outline-none focus:ring-1 transition-opacity disabled:opacity-50"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-geist-mono)",
              }}
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: isRunning ? "var(--surface-2)" : "var(--accent)",
              color: "#fff",
              border: "1px solid transparent",
            }}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {runState === "paying" ? "Initiating x402 payment…" : "Agents running…"}
              </span>
            ) : (
              "Run Match — $0.10 USDC"
            )}
          </button>
        </div>

        {/* Output panel */}
        <div className="space-y-4">
          {/* Live pipeline log */}
          {(visiblePhases.length > 0 || isRunning) && (
            <PipelineLog
              phases={visiblePhases}
              running={isRunning}
              runningLabel={
                runState === "paying"
                  ? "Paying $0.10 USDC via x402…"
                  : runState === "running"
                    ? "Agents parsing & scoring…"
                    : "Writing to Base Sepolia…"
              }
            />
          )}

          {/* Error */}
          {runState === "error" && errorMsg && (
            <div
              className="rounded-xl p-4 text-xs slide-in"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--danger)",
              }}
            >
              <p className="font-semibold mb-1">Error</p>
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Result */}
          {result && <ResultPanel result={result} />}

          {/* Idle state hint */}
          {runState === "idle" && (
            <div
              className="rounded-xl p-8 flex flex-col items-center justify-center text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: "280px" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                style={{ background: "var(--surface-2)" }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="var(--text-secondary)" strokeWidth="1.5" />
                  <path d="M13 13l3 3" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Results will appear here
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Pipeline logs, scores, and on-chain tx will be shown live
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info row */}
      <div
        className="mt-8 grid grid-cols-3 gap-4 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        {[
          { label: "Payment", value: "$0.10 USDC via x402" },
          { label: "Agent layer", value: "LangGraph + DeepSeek" },
          { label: "Audit log", value: "TrialRegistry on Base Sepolia" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl px-4 py-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p style={{ color: "var(--text-secondary)" }}>{item.label}</p>
            <p className="font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
