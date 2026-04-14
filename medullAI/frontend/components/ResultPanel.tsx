"use client";

import type { MatchResult } from "@/lib/types";
import PipelineLog from "./PipelineLog";
import X402PaymentReceipt from "./X402PaymentReceipt";

interface Props {
  result: MatchResult;
}

export default function ResultPanel({ result }: Props) {
  const {
    eligible,
    score,
    hard_filter_passed,
    rationale,
    disqualifying_criteria,
    onChain,
    pipeline,
    payment,
    // Phase II-III fields
    confidence_level = "medium",
    requires_investigator_review = false,
    risk_factors = [],
    ai_scored_criteria = [],
    requires_human_review_criteria = [],
    data_quality_warnings = [],
    missing_data_impact = 0,
  } = result;

  const isHardFiltered = !hard_filter_passed && score === 0;

  return (
    <div className="space-y-4 slide-in">
      {/* Score card */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--surface)",
          border: `1px solid ${eligible ? "var(--success)" : isHardFiltered ? "var(--warning)" : "var(--danger)"}`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: isHardFiltered
                    ? "rgba(245,158,11,0.15)"
                    : eligible
                      ? "rgba(16,185,129,0.15)"
                      : "rgba(239,68,68,0.15)",
                  color: isHardFiltered ? "var(--warning)" : eligible ? "var(--success)" : "var(--danger)",
                }}
              >
                {isHardFiltered ? "⚡ HARD FILTERED" : eligible ? "✓ ELIGIBLE" : "✗ NOT ELIGIBLE"}
              </span>
              {isHardFiltered && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple)" }}
                >
                  Skipped eligibility scoring LLM
                </span>
              )}
            </div>

            <h3 className="font-semibold text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Trial: <span style={{ color: "var(--text-primary)" }}>{result.trial_id}</span>
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Patient: {result.patient_id}
            </p>
          </div>

          {/* Score dial */}
          <div className="text-right shrink-0">
            <p
              className="text-3xl font-bold tabular-nums"
              style={{ color: eligible ? "var(--success)" : isHardFiltered ? "var(--warning)" : "var(--danger)" }}
            >
              {score}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              / 100
            </p>
          </div>
        </div>

        {/* Phase II-III: Confidence Level */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background:
                confidence_level === "high"
                  ? "rgba(16,185,129,0.15)"
                  : confidence_level === "medium"
                  ? "rgba(245,158,11,0.15)"
                  : "rgba(249,115,22,0.15)",
              color:
                confidence_level === "high"
                  ? "var(--success)"
                  : confidence_level === "medium"
                  ? "var(--warning)"
                  : "var(--orange, #F97316)",
            }}
          >
            {confidence_level === "high" && "●"} {confidence_level === "medium" && "◐"} {confidence_level === "low" && "○"} {confidence_level.toUpperCase()} CONFIDENCE
          </span>
          {requires_investigator_review && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                background: "rgba(239,68,68,0.15)",
                color: "var(--danger)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5zM11 10v6h2v-6h-2z"/>
              </svg>
              REQUIRES INVESTIGATOR REVIEW
            </span>
          )}
        </div>

        {/* Phase II-III: Risk Factors */}
        {risk_factors.length > 0 && (
          <div
            className="mt-3 text-xs px-3 py-2 rounded-lg"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <p className="font-semibold mb-1" style={{ color: "var(--warning)" }}>Risk Factors:</p>
            <ul className="space-y-0.5">
              {risk_factors.map((factor, i) => (
                <li key={i} style={{ color: "var(--text-secondary)" }}>• {factor}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Hard-filter savings note */}
        {isHardFiltered && (
          <div
            className="mt-3 text-xs px-3 py-2 rounded-lg"
            style={{ background: "rgba(139,92,246,0.1)", color: "var(--purple)", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            Deterministic hard filter matched before LLM scoring — eligibility scoring LLM call avoided.
          </div>
        )}

        {/* Rationale */}
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {rationale}
        </p>

        {/* Disqualifiers */}
        {disqualifying_criteria.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Disqualifying criteria:
            </p>
            <ul className="space-y-0.5">
              {disqualifying_criteria.map((c, i) => (
                <li key={i} className="text-xs flex gap-1.5" style={{ color: "var(--danger)" }}>
                  <span>×</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Phase II-III: Criteria Breakdown */}
      {(ai_scored_criteria.length > 0 || requires_human_review_criteria.length > 0) && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
            Criteria Classification
          </p>

          {ai_scored_criteria.length > 0 && (
            <div className="mb-3">
              <p className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: "var(--success)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                AI Scored ({ai_scored_criteria.length})
              </p>
              <ul className="space-y-0.5 ml-5">
                {ai_scored_criteria.slice(0, 3).map((criterion, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    ✓ {criterion}
                  </li>
                ))}
                {ai_scored_criteria.length > 3 && (
                  <li className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                    ...and {ai_scored_criteria.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {requires_human_review_criteria.length > 0 && (
            <div>
              <p className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: "var(--danger)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5zM11 10v6h2v-6h-2z"/>
                </svg>
                Requires Human Review ({requires_human_review_criteria.length})
              </p>
              <ul className="space-y-0.5 ml-5">
                {requires_human_review_criteria.map((criterion, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    ⚠ {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Phase II-III: Data Quality */}
      {data_quality_warnings.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--warning)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Data Quality Warnings
          </p>
          <ul className="space-y-0.5">
            {data_quality_warnings.map((warning, i) => (
              <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                • {warning}
              </li>
            ))}
          </ul>
          {missing_data_impact > 0 && (
            <p className="text-xs mt-2 pt-2" style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Confidence impact: -{(missing_data_impact * 100).toFixed(0)}% due to missing data
            </p>
          )}
        </div>
      )}

      {/* On-chain info */}
      {onChain && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
            On-Chain Audit Log
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Block</span>
            <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              {onChain.blockNumber}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>Tx Hash</span>
            <a
              href={onChain.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline truncate"
              style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}
            >
              {onChain.txHash.slice(0, 18)}…
            </a>
          </div>
          <a
            href={onChain.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs mt-1 px-3 py-1.5 rounded-lg"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            View on BaseScan ↗
          </a>
        </div>
      )}

      {payment?.settled && <X402PaymentReceipt payment={payment} />}

      {/* Pipeline trace */}
      {pipeline?.length > 0 && (
        <PipelineLog phases={pipeline} />
      )}

      {/* Phase II-III: Decision Support Disclaimer */}
      <div
        className="rounded-xl p-4 text-xs leading-relaxed"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        <div className="flex items-start gap-2 mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--accent)", marginTop: "1px" }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>Decision Support Only</span>
        </div>
        This is an AI-assisted recommendation, not a clinical determination. Final eligibility
        assessment requires qualified clinical judgment. Subjective criteria flagged above should be
        reviewed by a physician before any enrollment decision.
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="font-medium">Audit note:</span> SHA-256 patient hash and eligibility score are immutably
          logged via <code style={{ color: "var(--accent)" }}>TrialRegistry.logMatch()</code> on Base Sepolia.
        </div>
      </div>
    </div>
  );
}
