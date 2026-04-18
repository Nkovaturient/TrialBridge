import { NextRequest, NextResponse } from "next/server";

const AGENT_API_URL = process.env.AGENT_API_URL ?? "http://localhost:8100";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params;
  const res = await fetch(`${AGENT_API_URL}/queries/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "answer";
  const allowed = ["answer", "close", "void"];
  if (!allowed.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const body = action === "answer" ? await req.json() : undefined;
  const res = await fetch(`${AGENT_API_URL}/queries/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
