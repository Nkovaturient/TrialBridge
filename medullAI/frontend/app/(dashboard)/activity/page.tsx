"use client";

import { useEffect, useState } from "react";
import { isX402 } from "@/lib/payment-mode";

interface OnChainMatch {
  patientHash: string;
  trialId: string;
  score: number;
  timestamp: number;
}

interface HealthData {
  status: string;
  checks: {
    agent: string;
    registry: string;
    registryOwner?: string;
    walletIsOwner?: boolean;
  };
}

export default function ActivityPage() {
  const [count, setCount] = useState<number | null>(null);
  const [matches, setMatches] = useState<OnChainMatch[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const healthRes = await fetch("/api/health");
        const healthData = await healthRes.json();
        setHealth(healthData);

        if (!isX402()) {
          setCount(null);
          setMatches([]);
          return;
        }

        const countRes = await fetch(
          `${process.env.NEXT_PUBLIC_BACKBONE_URL ?? "http://127.0.0.1:4020"}/match_count`,
        );
        const countData = await countRes.json();
        const total = countData.count ?? 0;
        setCount(total);

        if (total > 0) {
          const last = Math.max(0, total - 5);
          const rows: OnChainMatch[] = [];
          for (let i = total - 1; i >= last; i--) {
            const r = await fetch(
              `${process.env.NEXT_PUBLIC_BACKBONE_URL ?? "http://127.0.0.1:4020"}/matches/${i}`,
            );
            if (r.ok) rows.push(await r.json());
          }
          setMatches(rows);
        }
      } catch {
        /* ignore network errors */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusColor = (s: string) =>
    s === "ok" ? "var(--success)" : s === "degraded" ? "var(--warning)" : "var(--danger)";

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Activity
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          {isX402() ? (
            <>
              System health and on-chain match history from{" "}
              <code
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
              >
                TrialRegistry
              </code>
            </>
          ) : (
            "System health for agents and backbone."
          )}
        </p>
      </div>

      {/* System Health */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          System Health
        </p>
        {loading ? (
          <div className="h-16 shimmer rounded-lg" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Backbone", value: health?.status ?? "unknown" },
              { label: "Agent API", value: health?.checks?.agent ?? "unknown" },
              { label: "Registry", value: health?.checks?.registry ?? "unknown" },
              { label: "Owner match", value: health?.checks?.walletIsOwner ? "✓" : health?.checks?.walletIsOwner === false ? "✗" : "—" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg px-3 py-2.5"
                style={{ background: "var(--surface-2)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {item.label}
                </p>
                <p
                  className="text-sm font-semibold mt-0.5"
                  style={{ color: statusColor(item.value) }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {health?.checks?.registryOwner && (
          <p className="text-xs mt-3 font-mono truncate" style={{ color: "var(--text-secondary)" }}>
            Registry owner: {health.checks.registryOwner.slice(0, 8)}...{health.checks.registryOwner.slice(-5)}
          </p>
        )}
      </div>

      {isX402() && (
        <>
          <div
            className="rounded-xl p-5 mb-6 flex items-center gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl font-bold"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            >
              {loading ? "…" : (count ?? 0)}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Total matches logged on-chain
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Immutable records in TrialRegistry.sol on Base Sepolia
              </p>
            </div>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <div
              className="px-5 py-3 text-xs font-semibold border-b"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Recent On-Chain Matches (last 5)
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 shimmer rounded-lg" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                No matches found. Run your first match to see results here.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="border-b"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    {["Trial ID", "Patient Hash", "Score", "Timestamp"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-2 font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <tr
                      key={i}
                      className="border-b last:border-0"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <td
                        className="px-5 py-3 font-mono"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {m.trialId}
                      </td>
                      <td
                        className="px-5 py-3 font-mono"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {m.patientHash.slice(0, 14)}…
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            background: m.score > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                            color: m.score > 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {m.score}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>
                        {new Date(m.timestamp * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
