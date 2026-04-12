import "server-only";
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";

let _cdp: CdpClient | null = null;

function getCdp(): CdpClient {
  if (!_cdp) {
    _cdp = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      walletSecret: process.env.CDP_WALLET_SECRET!,
    });
  }
  return _cdp;
}

let _payerAddress: string | null = null;

export async function getPayerAccount() {
  const cdp = getCdp();
  const account = await cdp.evm.getOrCreateAccount({ name: "TrialBridgePayer" });
  _payerAddress = account.address;
  return account;
}

export async function getPayerAddress(): Promise<string> {
  if (_payerAddress) return _payerAddress;
  const account = await getPayerAccount();
  return account.address;
}

/**
 * Makes an x402-authenticated POST request to the backbone.
 * Handles the 402 retry loop: first attempt may get a 402, then we sign and retry.
 */
export async function x402Fetch(
  url: string,
  body: unknown,
): Promise<{ data: unknown; paymentResponse: string | null; status: number }> {
  const account = await getPayerAccount();
  const bodyStr = JSON.stringify(body);
  const headers = { "Content-Type": "application/json" };

  // First attempt — may get 402
  const r1 = await fetch(url, { method: "POST", headers, body: bodyStr });

  if (r1.status !== 402) {
    const data = await r1.json();
    return { data, paymentResponse: r1.headers.get("X-PAYMENT-RESPONSE"), status: r1.status };
  }

  // Extract payment requirements from 402 response
  const paymentInfo = await r1.json();
  const accepts: unknown[] = paymentInfo.accepts ?? [];
  if (!accepts.length) {
    throw new Error("402 response has no payment requirements");
  }

  // Select the best requirement (first one, or network-filtered)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selected = selectPaymentRequirements(accepts as any);
  if (!selected) throw new Error("No compatible payment requirement found");

  // Build payment header signed by CDP server account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentHeader = await createPaymentHeader(account as any, 1, selected);

  // Retry with payment header
  const r2 = await fetch(url, {
    method: "POST",
    headers: { ...headers, "X-PAYMENT": paymentHeader },
    body: bodyStr,
  });

  const data = await r2.json();
  return {
    data,
    paymentResponse: r2.headers.get("X-PAYMENT-RESPONSE"),
    status: r2.status,
  };
}
