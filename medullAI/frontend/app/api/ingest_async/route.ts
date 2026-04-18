import { NextRequest, NextResponse } from "next/server";

const AGENT_API_URL = process.env.AGENT_API_URL ?? "http://localhost:8100";
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large: ${Math.round(file.size / 1024)} KB > 2048 KB limit.` },
      { status: 400 },
    );
  }

  const mapper = (formData.get("mapper") as string | null) ?? "aikosh_oral_cancer";
  const forward = new FormData();
  forward.append("file", file, (file as File).name ?? "upload.csv");
  forward.append("mapper", mapper);

  try {
    const res = await fetch(`${AGENT_API_URL}/ingest_async`, {
      method: "POST",
      body: forward,
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail ?? `HTTP ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
