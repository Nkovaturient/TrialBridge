import { NextRequest, NextResponse } from "next/server";

const AGENT_API_URL = process.env.AGENT_API_URL ?? "http://localhost:8100";

async function proxyGet(path: string) {
  const res = await fetch(`${AGENT_API_URL}${path}`, { signal: AbortSignal.timeout(10_000) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  return proxyGet(`/queries${qs ? "?" + qs : ""}`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${AGENT_API_URL}/queries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
