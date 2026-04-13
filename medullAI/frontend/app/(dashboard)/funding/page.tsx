"use client";

import { useEffect, useState } from "react";

interface PayerInfo {
  payerAddress: string;
  network: string;
  asset: string;
  contractAddress: string;
  note: string;
}

export default function FundingPage() {
  const [info, setInfo] = useState<PayerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const [onrampError, setOnrampError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/onramp/session")
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleOnramp() {
    setOnrampLoading(true);
    setOnrampError(null);
    try {
      const r = await fetch("/api/onramp/session", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      window.open(d.onrampUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setOnrampError(err instanceof Error ? err.message : "Onramp unavailable");
    } finally {
      setOnrampLoading(false);
    }
  }

  async function copyAddress() {
    if (!info?.payerAddress) return;
    await navigator.clipboard.writeText(info.payerAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Funding
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Top up the org payer wallet with USDC on Base Sepolia. Each match deducts{" "}
          <span style={{ color: "var(--accent)" }}>$0.10 USDC</span> automatically via x402.
        </p>
      </div>

      {/* Payer wallet card */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          CDP Server Wallet (Org Payer)
        </p>
        {loading ? (
          <div className="h-12 shimmer rounded-lg" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <code
                className="text-xs flex-1 truncate px-3 py-2 rounded-lg"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  border: "1px solid var(--border)",
                }}
              >
                {info?.payerAddress ?? "Loading…"}
              </code>
              <button
                onClick={copyAddress}
                className="px-3 py-2 rounded-lg text-xs transition-colors shrink-0"
                style={{
                  background: copied ? "rgba(16,185,129,0.1)" : "var(--surface-2)",
                  color: copied ? "var(--success)" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
              <span style={{ color: "var(--text-secondary)" }}>Network</span>
              <span style={{ color: "var(--text-primary)" }}>Base Sepolia (testnet)</span>
              <span style={{ color: "var(--text-secondary)" }}>Asset</span>
              <span style={{ color: "var(--text-primary)" }}>USDC</span>
              <span style={{ color: "var(--text-secondary)" }}>USDC contract</span>
              <a
                href={`https://sepolia.basescan.org/address/${info?.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-mono truncate"
                style={{ color: "var(--accent)" }}
              >
                {info?.contractAddress?.slice(0, 16)}…
              </a>
            </div>
          </>
        )}
      </div>

      {/* Funding options */}
      <div className="space-y-3 mb-6">
        {/* Coinbase Onramp */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Coinbase Onramp
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Buy USDC with a debit card or Coinbase balance directly to the org wallet.
              </p>
              <p
                className="text-xs mt-2 px-2 py-1 inline-block rounded"
                style={{ background: "rgba(245,158,11,0.1)", color: "var(--warning)" }}
              >
                Availability varies by region. Not available for Indian users on testnet.
              </p>
            </div>
            <button
              onClick={handleOnramp}
              disabled={onrampLoading || loading}
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--background)" }}
            >
              {onrampLoading ? "Opening…" : "Open Onramp ↗"}
            </button>
          </div>
          {onrampError && (
            <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>
              {onrampError}
            </p>
          )}
        </div>

        {/* Manual transfer */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Manual USDC Transfer
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Transfer Base Sepolia USDC to the org payer address above. Recommended for Indian CRO/Pharma
            companies. Use the Base Sepolia USDC faucet to get testnet funds.
          </p>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
            }}
          >
            Base Sepolia USDC Faucet ↗
          </a>
        </div>
      </div>

      {/* Architecture note */}
      <div
        className="rounded-xl p-4 text-xs leading-relaxed"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>How it works:</span>{" "}
        The CDP Server Wallet is a server-side wallet managed by Coinbase Developer Platform. Your
        organization never needs MetaMask, browser wallets, or private key management. The x402
        payment of $0.10 USDC is deducted from this wallet automatically on each match request — no
        user interaction required.
      </div>
    </div>
  );
}
