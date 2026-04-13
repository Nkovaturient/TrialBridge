"use client";

import type { PipelinePhase } from "@/lib/types";

const PHASE_META: Record<string, { label: string; icon: string }> = {
  x402_payment:         { label: "x402 Payment",          icon: "💳" },
  agent_run_match:      { label: "Agent: LLM Parse + Score", icon: "🤖" },
  agent_run_match_parsed: { label: "Agent: Score",         icon: "🤖" },
  agent_batch_match_parsed: { label: "Agent: Batch rank",  icon: "🤖" },
  onchain_logMatch:     { label: "On-chain Log",           icon: "⛓️" },
};

interface Props {
  phases: PipelinePhase[];
  running?: boolean;
  runningLabel?: string;
}

export default function PipelineLog({ phases, running, runningLabel }: Props) {
  return (
    <div
      className="rounded-xl p-4 space-y-2 font-mono text-xs"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)", fontFamily: "inherit" }}>
        Pipeline Trace
      </p>

      {phases.map((phase, i) => {
        const meta = PHASE_META[phase.name] ?? { label: phase.name, icon: "▸" };
        const settled = phase.status === "settled" || phase.ms !== undefined;
        return (
          <div key={i} className="flex items-start gap-2 slide-in">
            <span className="shrink-0 w-5 text-center">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <span style={{ color: settled ? "var(--success)" : "var(--text-secondary)" }}>
                {settled ? "✓" : "·"} {meta.label}
              </span>
              {phase.ms !== undefined && (
                <span className="ml-2" style={{ color: "var(--text-secondary)" }}>
                  {phase.ms}ms
                </span>
              )}
              {phase.status === "settled" && (
                <span className="ml-2" style={{ color: "var(--success)" }}>
                  settled
                </span>
              )}
              {phase.txHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${phase.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline"
                  style={{ color: "var(--accent)" }}
                >
                  {phase.txHash.slice(0, 10)}…
                </a>
              )}
            </div>
          </div>
        );
      })}

      {running && (
        <div className="flex items-center gap-2 slide-in">
          <span className="shrink-0 w-5 text-center">
            <span className="inline-block w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--accent)" }} />
          </span>
          <span style={{ color: "var(--accent)" }}>
            {runningLabel ?? "Processing…"}
          </span>
        </div>
      )}
    </div>
  );
}
