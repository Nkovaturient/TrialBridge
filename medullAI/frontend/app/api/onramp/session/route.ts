import { NextRequest, NextResponse } from "next/server";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { getPayerAddress } from "@/lib/cdp-wallet";

const ONRAMP_API = "https://api.cdp.coinbase.com";
const SESSION_PATH = "/onramp/v1/token";

export async function POST(req: NextRequest) {
  // Auth gate: require MATCH_API_SECRET header if set
  const secret = process.env.MATCH_API_SECRET;
  if (secret) {
    const provided = req.headers.get("x-api-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payerAddress = await getPayerAddress();

    const jwt = await generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      requestMethod: "POST",
      requestHost: "api.cdp.coinbase.com",
      requestPath: SESSION_PATH,
    });

    const resp = await fetch(`${ONRAMP_API}${SESSION_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        destination_wallets: [
          {
            address: payerAddress,
            assets: ["USDC"],
            network: "base-sepolia",
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: `Onramp session failed: ${resp.status}`, detail: errText },
        { status: 502 },
      );
    }

    const { token } = (await resp.json()) as { token: string };
    const onrampUrl = `https://pay.coinbase.com/buy?sessionToken=${token}`;

    return NextResponse.json({
      onrampUrl,
      payerAddress,
      note: "Onramp availability varies by region. Indian users may need to transfer USDC directly to the payer address.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onramp session creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Also expose payer address info via GET (no auth needed — read-only)
export async function GET() {
  try {
    const payerAddress = await getPayerAddress();
    return NextResponse.json({
      payerAddress,
      network: "base-sepolia",
      asset: "USDC",
      contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC contract addr on Base Sepolia
      note: "Transfer USDC to this address to fund matches. Each match costs $0.10 USDC.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get payer info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
