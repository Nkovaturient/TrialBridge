"use client";

import { useState, useRef } from "react";
import type { IngestResponse } from "@/lib/types";

const MAPPERS = [
  { value: "auto", label: "🔍 Auto-Detect EDC Format" },
  { value: "medidata_rave", label: "Medidata Rave" },
  { value: "veeva_vault", label: "Veeva Vault CDMS" },
  { value: "redcap", label: "REDCap" },
  { value: "aikosh_oral_cancer", label: "AIKosh Oral Cancer (ICMR)" },
  { value: "generic", label: "Generic Patient Export" },
];

export default function QualityPage() {
  const [mapper, setMapper] = useState("auto");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapper", mapper);

    try {
      const res = await fetch("/api/ingest_csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data as IngestResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Data Quality Report
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Upload patient CSV for deduplication, missing data analysis, and completeness scoring.
      </p>

      {/* Upload Section */}
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
              Patient CSV
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
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
              Analyzing...
            </span>
          ) : (
            "Generate Quality Report"
          )}
        </button>

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
      {result && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Patients" value={result.parsed_rows} />
            {result.deduplication && (
              <>
                <StatCard
                  label="Duplicates"
                  value={result.deduplication.duplicates_found}
                  color="var(--warning)"
                />
                <StatCard
                  label="Unique"
                  value={result.deduplication.unique_count}
                  color="var(--success)"
                />
              </>
            )}
            {result.detected_format && (
              <StatCard
                label="Format"
                value={result.detected_format}
                subtitle={result.format_confidence ? `${(result.format_confidence * 100).toFixed(0)}% conf.` : undefined}
              />
            )}
          </div>

          {/* Data Quality Metrics */}
          {result.data_quality && (
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                Data Quality Summary
              </h3>

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span style={{ color: "var(--text-secondary)" }}>Completeness</span>
                  <span
                    style={{
                      color:
                        result.data_quality.completeness >= 0.9
                          ? "var(--success)"
                          : result.data_quality.completeness >= 0.7
                          ? "var(--warning)"
                          : "var(--danger)",
                    }}
                  >
                    {(result.data_quality.completeness * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${result.data_quality.completeness * 100}%`,
                      background:
                        result.data_quality.completeness >= 0.9
                          ? "var(--success)"
                          : result.data_quality.completeness >= 0.7
                          ? "var(--warning)"
                          : "var(--danger)",
                    }}
                  />
                </div>
              </div>

              {result.data_quality.imputed_fields.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Imputed Fields ({result.data_quality.imputed_fields.length}):
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.8 }}>
                    {result.data_quality.imputed_fields.join(", ")}
                  </p>
                </div>
              )}

              {result.data_quality.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--warning)" }}>
                    Warnings ({result.data_quality.warnings.length}):
                  </p>
                  <ul className="space-y-0.5">
                    {result.data_quality.warnings.slice(0, 5).map((w, i) => (
                      <li key={i} className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.8 }}>
                        • {w}
                      </li>
                    ))}
                    {result.data_quality.warnings.length > 5 && (
                      <li className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                        ...and {result.data_quality.warnings.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Row Warnings */}
          {result.warnings.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--warning)" }}>
                Row Warnings ({result.warnings.length})
              </h3>
              <ul className="space-y-0.5">
                {result.warnings.slice(0, 10).map((w, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
      <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
