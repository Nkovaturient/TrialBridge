"use client";

import type { X402PaymentInfo } from "@/lib/types";

interface Props {
  payment: X402PaymentInfo;
}

export default function X402PaymentReceipt({ payment }: Props) {
  if (!payment.settled) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
        x402 Payment
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Status</span>
        <span style={{ color: "var(--success)" }}>✓ Settled</span>
        <span style={{ color: "var(--text-secondary)" }}>Amount</span>
        <span style={{ color: "var(--text-primary)" }}>{payment.amount}</span>
        <span style={{ color: "var(--text-secondary)" }}>Network</span>
        <span style={{ color: "var(--text-primary)" }}>{payment.network}</span>
        {payment.txHash && (
          <>
            <span style={{ color: "var(--text-secondary)" }}>Tx hash</span>
            {payment.explorerUrl ? (
              <a
                href={payment.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline truncate font-mono"
                style={{ color: "var(--accent)" }}
              >
                {payment.txHash.slice(0, 18)}…
              </a>
            ) : (
              <span className="font-mono truncate" style={{ color: "var(--text-primary)" }}>
                {payment.txHash}
              </span>
            )}
          </>
        )}
      </div>
      {payment.explorerUrl && (
        <a
          href={payment.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs mt-3 px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid var(--accent-border)",
          }}
        >
          View payment on BaseScan ↗
        </a>
      )}
    </div>
  );
}
