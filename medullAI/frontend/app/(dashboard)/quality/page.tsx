"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { IngestResponse } from "@/lib/types";
import { buildCohortSummary } from "@/lib/ingestCohortSummary";

const MAPPERS = [
  { value: "auto", label: "Auto-Detect EDC Format" },
  { value: "medidata_rave", label: "Medidata Rave" },
  { value: "veeva_vault", label: "Veeva Vault CDMS" },
  { value: "redcap", label: "REDCap" },
  { value: "aikosh_oral_cancer", label: "AIKosh Oral Cancer (ICMR)" },
  { value: "generic", label: "Generic Patient Export" },
];

const POLL_INTERVAL_MS = 3000;

export default function QualityPage() {
  const [mapper, setMapper] = useState("auto");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopTimers(), [stopTimers]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) { setFile(f); setResult(null); setError(null); }
  }

  async function handleUpload() {
    if (!file) return;
    stopTimers();
    setUploading(true);
    setError(null);
    setResult(null);
    setElapsedSec(0);
    setStatusMsg("Submitting…");

    const startTs = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapper", mapper);

    try {
      // Start async job
      const startRes = await fetch("/api/ingest_async", { method: "POST", body: fd, signal: AbortSignal.timeout(15_000) });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error ?? `HTTP ${startRes.status}`);

      const jobId: string = startData.job_id;
      setStatusMsg("Normalising rows via LLM…");

      // Poll until done or failed
      await new Promise<void>((resolve, reject) => {
        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/ingest_jobs/${jobId}`);
            const pollData = await pollRes.json();
            if (!pollRes.ok) { reject(new Error(pollData.error ?? `Poll error ${pollRes.status}`)); return; }

            const elapsed: number = pollData.elapsed_sec ?? 0;
            setElapsedSec(Math.round(elapsed));

            if (pollData.status === "done") {
              stopTimers();
              setResult(pollData.result as IngestResponse);
              resolve();
            } else if (pollData.status === "failed") {
              reject(new Error(pollData.error ?? "Ingest job failed"));
            } else {
              setStatusMsg(`Normalising… ${Math.round(elapsed)}s elapsed`);
            }
          } catch (e) {
            stopTimers();
            reject(e);
          }
        }, POLL_INTERVAL_MS);
      });
    } catch (err) {
      stopTimers();
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      stopTimers();
      setUploading(false);
      setStatusMsg("");
    }
  }

  const cohort = result ? buildCohortSummary(result.patients) : null;
  const failed = result ? (result.total_rows ?? result.parsed_rows) - result.parsed_rows : 0;

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Data Quality Report
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Upload a patient CSV/XLSX. Each row is mapped through an EDC profile then normalised via LLM
        into a structured patient record. The report shows upload statistics, mapper-level field
        coverage, and cohort-level missingness derived from the normalised profiles.
      </p>

      {/* Upload section */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              EDC Format
            </label>
            <select
              value={mapper}
              onChange={(e) => setMapper(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-xs"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {MAPPERS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Patient CSV / XLSX
            </label>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl px-4 py-2.5 text-xs text-left transition-all"
              style={{
                background: file ? "rgba(16,185,129,0.1)" : "var(--surface-2)",
                border: `1px dashed ${file ? "var(--success)" : "var(--border)"}`,
                color: file ? "var(--success)" : "var(--text-secondary)",
              }}
            >
              {file ? file.name : "Click to upload CSV/XLSX"}
            </button>
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              {statusMsg || `Processing… ${elapsedSec}s`}
            </span>
          ) : "Generate Quality Report"}
        </button>

        {uploading && (
          <p className="mt-3 text-xs text-center" style={{ color: "var(--text-secondary)" }}>
            Each row goes through a LLM normalisation call (6 concurrent). Expect ~10–15 s per 10 rows.
            The job runs in the background — this page polls every 3 s.
          </p>
        )}

        {error && (
          <div
            className="mt-4 rounded-xl p-3 text-xs"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && cohort && (
        <div className="space-y-5">
          {/* Mapper fallback notice */}
          {result.requested_mapper && result.requested_mapper !== result.mapper_used && (
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "var(--warning)" }}
            >
              Mapper <strong>{result.requested_mapper}</strong> not supported by agent. Used{" "}
              <strong>{result.mapper_used}</strong> fallback.
            </div>
          )}

          {/* Upload summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Rows in file" value={result.total_rows ?? result.parsed_rows} />
            <StatCard label="Parsed OK" value={result.parsed_rows} color="var(--success)" />
            {failed > 0 && (
              <StatCard label="Failed / dropped" value={failed} color="var(--danger)" />
            )}
            <StatCard
              label="Mapper"
              value={result.mapper_used}
              subtitle={result.detected_format ? `detected: ${result.detected_format}` : undefined}
            />
            {result.format_confidence != null && (
              <StatCard
                label="Format confidence"
                value={`${(result.format_confidence * 100).toFixed(0)}%`}
                color={result.format_confidence >= 0.8 ? "var(--success)" : "var(--warning)"}
              />
            )}
          </div>

          {/* Deduplication */}
          {result.deduplication && (
            <Section title="Deduplication">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Input subjects" value={result.deduplication.input_count} />
                <StatCard
                  label="Duplicates flagged"
                  value={result.deduplication.duplicates_found}
                  color={result.deduplication.duplicates_found > 0 ? "var(--warning)" : "var(--success)"}
                />
                <StatCard label="Unique" value={result.deduplication.unique_count} color="var(--success)" />
              </div>
              {(result.deduplication.candidates?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Pairs requiring review
                  </p>
                  <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-1.5 pr-4 font-medium">Subject 1</th>
                        <th className="text-left py-1.5 pr-4 font-medium">Subject 2</th>
                        <th className="text-left py-1.5 pr-4 font-medium">Confidence</th>
                        <th className="text-left py-1.5 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.deduplication.candidates!.slice(0, 10).map((c, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
                          <td className="py-1.5 pr-4" style={{ fontFamily: "var(--font-mono)" }}>{c.patient_id_1}</td>
                          <td className="py-1.5 pr-4" style={{ fontFamily: "var(--font-mono)" }}>{c.patient_id_2}</td>
                          <td className="py-1.5 pr-4">{(c.confidence * 100).toFixed(0)}%</td>
                          <td
                            className="py-1.5"
                            style={{ color: c.recommendation === "merge" ? "var(--danger)" : "var(--warning)" }}
                          >
                            {c.recommendation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {/* Cohort completeness */}
          {cohort.mean_completeness != null && (
            <Section title="Cohort Completeness">
              <CompletenessBar value={cohort.mean_completeness} />
              <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                Mean <code>data_completeness</code> from LLM-normalised profiles ({cohort.n} subjects).
                Below are heuristic checks for commonly required matching fields.
              </p>
            </Section>
          )}

          {/* Per-field missingness table */}
          <Section title="Field-Level Missingness">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-1.5 pr-4 font-medium">Field</th>
                  <th className="text-left py-1.5 pr-4 font-medium">Critical</th>
                  <th className="text-right py-1.5 pr-4 font-medium">Missing</th>
                  <th className="text-right py-1.5 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {cohort.field_table.map((row) => (
                  <tr key={row.field} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-1.5 pr-4" style={{ color: "var(--text-primary)" }}>{row.label}</td>
                    <td className="py-1.5 pr-4">
                      {row.critical && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                          critical
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right" style={{ color: "var(--text-secondary)" }}>
                      {row.missing} / {cohort.n}
                    </td>
                    <td className="py-1.5 text-right">
                      <span
                        style={{
                          color: row.pct === 0 ? "var(--success)" : row.pct < 20 ? "var(--warning)" : "var(--danger)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {row.pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Data quality flags */}
          {result.data_quality && (
            <Section title="Data Quality Summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <StatCard
                  label="Avg completeness"
                  value={`${(result.data_quality.average_completeness * 100).toFixed(0)}%`}
                  color={result.data_quality.average_completeness >= 0.9 ? "var(--success)" : "var(--warning)"}
                />
                <StatCard label="Subjects w/ gaps" value={result.data_quality.patients_with_missing_data} />
                <StatCard label="Critical gaps" value={result.data_quality.critical_missing_count} color="var(--danger)" />
                <StatCard label="Fields imputed" value={result.data_quality.imputation_applied} />
              </div>
              {Object.keys(result.data_quality.missing_by_field).length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Top missing fields (server-computed)</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(result.data_quality.missing_by_field)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 9)
                      .map(([field, count]) => (
                        <div key={field} className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: "var(--surface-2)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>{field}</span>
                          <span style={{ color: "var(--warning)" }}>{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Cohort quality flags */}
          {cohort.quality_flags.length > 0 && (
            <Section title="Quality Flags (from LLM normalisation)">
              <div className="flex flex-wrap gap-2">
                {cohort.quality_flags.map((flag, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "rgba(245,158,11,0.1)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.2)" }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Row-level warnings */}
          {result.warnings.length > 0 && (
            <Section title={`Row Warnings (${result.warnings.length})`} accent="warning">
              <ul className="space-y-1">
                {result.warnings.slice(0, 15).map((w, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>• {w}</li>
                ))}
                {result.warnings.length > 15 && (
                  <li className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                    …and {result.warnings.length - 15} more
                  </li>
                )}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p
        className="text-xl font-bold truncate"
        style={{ color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
        title={String(value)}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>{subtitle}</p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: "warning" | "danger";
}) {
  const border =
    accent === "warning"
      ? "rgba(245,158,11,0.3)"
      : accent === "danger"
      ? "rgba(239,68,68,0.3)"
      : "var(--border)";
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: `1px solid ${border}` }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function CompletenessBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "var(--success)" : pct >= 70 ? "var(--warning)" : "var(--danger)";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "var(--text-secondary)" }}>Mean completeness</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
