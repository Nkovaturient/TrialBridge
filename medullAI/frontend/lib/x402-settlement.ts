import "server-only";
import { settleResponseFromHeader } from "x402/types";

/** Strict EVM tx hash (32-byte hex) from facilitator `transaction` field. */
function evmTxHash(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (/^0x[0-9a-fA-F]{64}$/.test(t)) return t;
  if (/^[0-9a-fA-F]{64}$/.test(t)) return `0x${t}`;
  return undefined;
}

function explorerUrlFor(network: string, txHash: string): string | undefined {
  if (network === "base-sepolia") return `https://sepolia.basescan.org/tx/${txHash}`;
  if (network === "base") return `https://basescan.org/tx/${txHash}`;
  return undefined;
}

/** Decode X-PAYMENT-RESPONSE (base64 SettleResponse) → tx hash + BaseScan link for Base networks. */
export function enrichX402Payment(paymentResponse: string | null | undefined): {
  txHash?: string;
  explorerUrl?: string;
  settlementNetwork?: string;
} {
  if (!paymentResponse?.trim()) return {};
  try {
    const r = settleResponseFromHeader(paymentResponse) as {
      success?: boolean;
      transaction?: string;
      network?: string;
    };
    if (!r?.success || typeof r.transaction !== "string") return {};
    const txHash = evmTxHash(r.transaction);
    if (!txHash) return {};
    const settlementNetwork = typeof r.network === "string" ? r.network : undefined;
    const explorerUrl =
      settlementNetwork ? explorerUrlFor(settlementNetwork, txHash) : undefined;
    return {
      txHash,
      settlementNetwork,
      ...(explorerUrl ? { explorerUrl } : {}),
    };
  } catch {
    return {};
  }
}
