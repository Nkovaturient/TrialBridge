import { NextResponse } from "next/server";

const BACKBONE_URL = process.env.BACKBONE_URL ?? "http://127.0.0.1:4020";

export async function GET() {
  try {
    const res = await fetch(`${BACKBONE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { status: "unreachable", checks: { backbone: "unreachable" } },
      { status: 503 },
    );
  }
}
