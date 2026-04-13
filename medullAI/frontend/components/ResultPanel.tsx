"use client";

import type { MatchResult } from "@/lib/types";
import PipelineLog from "./PipelineLog";
import X402PaymentReceipt from "./X402PaymentReceipt";

interface Props {
  result: MatchResult;
}

export default function ResultPanel({ result }: Props) {
  const { eligible, score, hard_filter_passed, rationale, disqualifying_criteria, onChain, pipeline, payment } =
    result;

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

      {/* Consent disclaimer */}
      <div
        className="rounded-xl p-4 text-xs leading-relaxed"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>Consent audit note:</span>{" "}
        TrialBridge is B2B infrastructure. Patient e-signature UI is out of scope. SHA-256 patient hash and
        eligibility score are immutably logged via{" "}
        <code style={{ color: "var(--accent)" }}>TrialRegistry.logMatch()</code> on Base Sepolia above.
      </div>
    </div>
  );
}
