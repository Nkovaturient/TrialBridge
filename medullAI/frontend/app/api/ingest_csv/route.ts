import { NextRequest, NextResponse } from "next/server";

const AGENT_API_URL = process.env.AGENT_API_URL ?? "http://localhost:8100";
const MAX_BYTES = 2 * 1024 * 1024;
const INGEST_TIMEOUT_MS = 10 * 60 * 1000;
const LEGACY_MAPPER_FALLBACKS: Record<string, string> = {
  auto: "generic",
  medidata_rave: "generic",
  veeva_vault: "generic",
  redcap: "generic",
};

function getErrorText(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const maybeError = (payload as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.length > 0) return maybeError;
    const maybeDetail = (payload as { detail?: unknown }).detail;
    if (typeof maybeDetail === "string" && maybeDetail.length > 0) return maybeDetail;
  }
  return "";
}

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
  const uploadFile = file;

  const mapper = (formData.get("mapper") as string | null) ?? "aikosh_oral_cancer"; 
  

  async function forwardIngest(selectedMapper: string) {
    const forward = new FormData();
    forward.append("file", uploadFile, (uploadFile as File).name ?? "upload.csv");
    forward.append("mapper", selectedMapper);
    const res = await fetch(`${AGENT_API_URL}/ingest_patients_csv`, {
      method: "POST",
      body: forward,
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
    const data = await res.json();
    return { res, data };
  }

  try {
    let { res, data } = await forwardIngest(mapper);

    const fallbackMapper = LEGACY_MAPPER_FALLBACKS[mapper];
    const errorText = getErrorText(data);
    const isLegacyMapperError =
      res.status === 400 && errorText.includes("Unknown mapper");

    if (isLegacyMapperError && fallbackMapper) {
      ({ res, data } = await forwardIngest(fallbackMapper));
      if (res.ok && data && typeof data === "object") {
        const withFallbackWarning = {
          ...(data as Record<string, unknown>),
          warnings: [
            ...(((data as { warnings?: unknown }).warnings as string[] | undefined) ?? []),
            `Selected mapper '${mapper}' is not supported by the configured agent API. Used '${fallbackMapper}' fallback.`,
          ],
          requested_mapper: mapper,
          mapper_used: fallbackMapper,
        };
        return NextResponse.json(withFallbackWarning);
      }
    }

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
