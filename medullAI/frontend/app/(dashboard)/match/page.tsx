"use client";

import { Fragment, useRef, useState } from "react";
import ResultPanel from "@/components/ResultPanel";
import PipelineLog from "@/components/PipelineLog";
import X402PaymentReceipt from "@/components/X402PaymentReceipt";
import type { BatchMatchResponse, BatchMatchResult, MatchResult, PipelinePhase } from "@/lib/types";


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
type BatchStep = "idle" | "ingesting" | "matching" | "done" | "error";
type Tab = "single" | "batch";

const MAPPERS = [
  { value: "aikosh_oral_cancer", label: "AIKosh Oral Cancer (ICMR)" },
  { value: "generic", label: "Generic patient export" },
];


export default function MatchPage() {
  const [tab, setTab] = useState<Tab>("single");

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Run Eligibility Match
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Single match or batch rank for up to 500 patients against one trial.
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 mb-6 rounded-xl p-1 w-fit"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {(["single", "batch"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg transition-all"
            style={{
              background: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "var(--background)" : "var(--text-secondary)",
            }}
          >
            {t === "single" ? "Single match" : "Batch rank"}
          </button>
        ))}
      </div>

      {tab === "single" ? <SingleMatchTab /> : <BatchMatchTab />}
    </div>
  );
}


function SingleMatchTab() {
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
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);

      const matchResult = data as MatchResult;
      for (const phase of matchResult.pipeline ?? []) {
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
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
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
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
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
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: isRunning ? "var(--surface-2)" : "var(--accent)",
              color: "var(--background)",
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

        <div className="space-y-4">
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

          {runState === "error" && errorMsg && (
            <div
              className="rounded-xl p-4 text-xs slide-in"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}
            >
              <p className="font-semibold mb-1">Error</p>
              <p>{errorMsg}</p>
            </div>
          )}

          {result && <ResultPanel result={result} />}

          {runState === "idle" && (
            <div
              className="rounded-xl p-8 flex flex-col items-center justify-center text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: "280px" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--surface-2)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="var(--text-secondary)" strokeWidth="1.5" />
                  <path d="M13 13l3 3" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Results will appear here</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Pipeline logs, scores, and on-chain tx will be shown live</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {[
          { label: "Payment", value: "$0.10 USDC via x402" },
          { label: "Agent layer", value: "LangGraph + DeepSeek" },
          { label: "Audit log", value: "TrialRegistry on Base Sepolia" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--text-secondary)" }}>{item.label}</p>
            <p className="font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{item.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}


function BatchMatchTab() {
  const [trialJson, setTrialJson] = useState(DEFAULT_TRIAL);
  const [mapper, setMapper] = useState("aikosh_oral_cancer");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<BatchStep>("idle");
  const [ingestWarnings, setIngestWarnings] = useState<string[]>([]);
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [patientProfiles, setPatientProfiles] = useState<unknown[]>([]);
  const [batchResult, setBatchResult] = useState<BatchMatchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setErrorMsg("File too large: max 2 MB. Split the CSV and re-upload.");
      return;
    }
    setFile(f);
    setStep("idle");
    setBatchResult(null);
    setPatientCount(null);
    setErrorMsg(null);
    setIngestWarnings([]);
  }

  async function handleIngest() {
    if (!file) return;
    setStep("ingesting");
    setErrorMsg(null);
    setIngestWarnings([]);
    setPatientProfiles([]);
    setPatientCount(null);
    setBatchResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapper", mapper);

    try {
      const res = await fetch("/api/ingest_csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPatientProfiles(data.patients ?? []);
      setPatientCount(data.parsed_rows ?? 0);
      setIngestWarnings(data.warnings ?? []);
      setStep("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ingest failed");
      setStep("error");
    }
  }

  async function handleBatchMatch() {
    if (!patientProfiles.length) return;

    let trialData: unknown;
    try {
      trialData = JSON.parse(trialJson);
    } catch {
      setErrorMsg("Invalid JSON in trial criteria field.");
      return;
    }

    setStep("matching");
    setErrorMsg(null);
    setBatchResult(null);

    try {
      const res = await fetch("/api/batch_match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trial_criteria: trialData, patient_profiles: patientProfiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBatchResult(data as BatchMatchResponse);
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Batch match failed");
      setStep("error");
    }
  }

  const isBusy = step === "ingesting" || step === "matching";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Trial Criteria (CTRI JSON)
            </label>
            <textarea
              value={trialJson}
              onChange={(e) => setTrialJson(e.target.value)}
              rows={14}
              spellCheck={false}
              disabled={isBusy}
              className="w-full rounded-xl px-4 py-3 text-xs resize-none focus:outline-none focus:ring-1 disabled:opacity-50"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>

          {/* Mapper selector */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Patient mapper profile
            </label>
            <select
              value={mapper}
              onChange={(e) => setMapper(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none disabled:opacity-50"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {MAPPERS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* File upload zone */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Patient CSV / XLSX (max 2 MB, 500 rows)
            </label>
            <div
              onClick={() => !isBusy && fileRef.current?.click()}
              className="rounded-xl px-4 py-6 text-center cursor-pointer transition-all"
              style={{
                background: "var(--surface)",
                border: `1px dashed ${file ? "var(--accent)" : "var(--border)"}`,
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                disabled={isBusy}
              />
              {file ? (
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {(file.size / 1024).toFixed(1)} KB · click to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Click to upload CSV or XLSX</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                    AIKosh oral cancer or generic patient export
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleIngest}
              disabled={!file || isBusy}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: patientCount !== null ? "var(--surface-2)" : "var(--surface)",
                border: `1px solid ${patientCount !== null ? "var(--success)" : "var(--border)"}`,
                color: patientCount !== null ? "var(--success)" : "var(--text-primary)",
              }}
            >
              {step === "ingesting" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Ingesting…
                </span>
              ) : patientCount !== null ? (
                `✓ ${patientCount} patients ingested`
              ) : (
                "1. Ingest CSV"
              )}
            </button>

            <button
              onClick={handleBatchMatch}
              disabled={!patientProfiles.length || isBusy}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: patientProfiles.length && !isBusy ? "var(--accent)" : "var(--surface-2)",
                color: patientProfiles.length && !isBusy ? "var(--background)" : "var(--text-secondary)",
                border: "1px solid transparent",
              }}
            >
              {step === "matching" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Scoring…
                </span>
              ) : (
                "2. Run Batch Rank — $2.00 USDC"
              )}
            </button>
          </div>
        </div>

        {/* Right: status + results */}
        <div className="space-y-4">
          {/* Ingest warnings */}
          {ingestWarnings.length > 0 && (
            <div
              className="rounded-xl p-4 text-xs"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "var(--warning)" }}
            >
              <p className="font-semibold mb-1">{ingestWarnings.length} row warning(s)</p>
              {ingestWarnings.slice(0, 5).map((w, i) => <p key={i}>{w}</p>)}
              {ingestWarnings.length > 5 && <p>…and {ingestWarnings.length - 5} more</p>}
            </div>
          )}

          {/* Error */}
          {(step === "error") && errorMsg && (
            <div
              className="rounded-xl p-4 text-xs slide-in"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}
            >
              <p className="font-semibold mb-1">Error</p>
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Batch stats */}
          {batchResult && (
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
                Batch results — {batchResult.trial_id}
              </p>
              {batchResult.pipeline && batchResult.pipeline.length > 0 && (
                <div className="mb-4">
                  <PipelineLog phases={batchResult.pipeline} running={false} />
                </div>
              )}
              {batchResult.payment?.settled && (
                <div className="mb-4">
                  <X402PaymentReceipt payment={batchResult.payment} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Total", value: batchResult.stats.total },
                  { label: "AI scored", value: batchResult.stats.llm_calls },
                  { label: "Hard filtered", value: batchResult.stats.hard_filtered },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg px-3 py-2 text-center" style={{ background: "var(--surface-2)" }}>
                    <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Ranked table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      {["#", "Patient ID", "Score", "Eligible", "Filter", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.results.map((r: BatchMatchResult, i: number) => (
                      <Fragment key={r.patient_id}>
                        <tr
                          className="border-b"
                          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                        >
                          <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{i + 1}</td>
                          <td className="px-3 py-2.5 font-mono" style={{ color: "var(--text-primary)" }}>{r.patient_id}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className="px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                background: r.score >= 60 ? "rgba(16,185,129,0.12)" : r.score > 0 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.10)",
                                color: r.score >= 60 ? "var(--success)" : r.score > 0 ? "var(--warning)" : "var(--danger)",
                              }}
                            >
                              {r.score}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span style={{ color: r.eligible ? "var(--success)" : "var(--danger)" }}>
                              {r.eligible ? "✓" : "✗"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span style={{ color: r.hard_filter_passed ? "var(--success)" : "var(--warning)" }}>
                              {r.hard_filter_passed ? "pass" : "filtered"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => setExpandedRow(expandedRow === r.patient_id ? null : r.patient_id)}
                              className="text-xs px-2.5 py-1 rounded-full transition-all duration-200"
                              style={{
                                color: expandedRow === r.patient_id ? "var(--background)" : "var(--accent)",
                                background: expandedRow === r.patient_id ? "var(--accent)" : "var(--accent-dim)",
                                border: "1px solid rgba(34,211,238,0.45)",
                                boxShadow:
                                  expandedRow === r.patient_id
                                    ? "0 0 0 1px rgba(34,211,238,0.35), 0 0 14px rgba(34,211,238,0.55)"
                                    : "0 0 8px rgba(34,211,238,0.22)",
                              }}
                            >
                              {expandedRow === r.patient_id ? "hide" : "rationale"}
                            </button>
                          </td>
                        </tr>
                        {expandedRow === r.patient_id && (
                          <tr style={{ background: "var(--surface-2)" }}>
                            <td colSpan={6} className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                              <p className="leading-relaxed">{r.rationale}</p>
                              {r.disqualifying_criteria.length > 0 && (
                                <ul className="mt-2 space-y-0.5">
                                  {r.disqualifying_criteria.map((c, ci) => (
                                    <li key={ci} style={{ color: "var(--danger)" }}>× {c}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Idle hint */}
          {step === "idle" && !batchResult && (
            <div
              className="rounded-xl p-8 flex flex-col items-center justify-center text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: "260px" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--surface-2)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 14h14M2 10h14M2 6h14" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Ranked patient shortlist</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Upload a patient CSV, ingest, then run batch rank to see scores
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
