import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { x402Fetch } from "@/lib/cdp-wallet";
import type { MatchResult } from "@/lib/types";

const MatchRequestSchema = z.object({
  raw_trial: z.record(z.unknown()),
  raw_patient: z.record(z.unknown()),
});

const BACKBONE_URL = process.env.BACKBONE_URL ?? "http://localhost:4020";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { data, paymentResponse, status } = await x402Fetch(
      `${BACKBONE_URL}/match`,
      parsed.data,
    );

    if (status >= 400) {
      return NextResponse.json(data, { status });
    }

    const result = data as MatchResult;

    // Augment with sanitized payment metadata for the UI
    const response = {
      ...result,
      payment: {
        settled: true,
        network: "base-sepolia",
        amount: "$0.10 USDC",
        paymentResponse: paymentResponse ?? undefined,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Match request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
