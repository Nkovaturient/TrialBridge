"use client";

import { useState } from "react";

interface DataQualityPanelProps {
  completeness: number;
  warnings: string[];
  missingImpact: number;
  imputedFields?: string[];
}

export default function DataQualityPanel({
  completeness,
  warnings,
  missingImpact,
  imputedFields = [],
}: DataQualityPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (warnings.length === 0 && imputedFields.length === 0 && completeness === 1) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          Data Quality
        </p>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] px-2 py-1 rounded"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          {showDetails ? "Less" : "More"}
        </button>
      </div>

      {/* Completeness bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: "var(--text-secondary)" }}>Completeness</span>
          <span style={{ color: completeness >= 0.9 ? "var(--success)" : completeness >= 0.7 ? "var(--warning)" : "var(--danger)" }}>
            {(completeness * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${completeness * 100}%`,
              background:
                completeness >= 0.9 ? "var(--success)" : completeness >= 0.7 ? "var(--warning)" : "var(--danger)",
            }}
          />
        </div>
      </div>

      {showDetails && (
        <div className="space-y-2">
          {imputedFields.length > 0 && (
            <div className="text-xs">
              <p className="font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Imputed Fields ({imputedFields.length}):
              </p>
              <p style={{ color: "var(--text-secondary)", opacity: 0.8 }}>{imputedFields.join(", ")}</p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="text-xs">
              <p className="font-medium mb-1" style={{ color: "var(--warning)" }}>
                Warnings:
              </p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} style={{ color: "var(--text-secondary)", opacity: 0.8 }}>
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missingImpact > 0 && (
            <p className="text-xs pt-2" style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Confidence impact: <span style={{ color: "var(--warning)" }}>-{(missingImpact * 100).toFixed(0)}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
