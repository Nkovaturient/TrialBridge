import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { x402Fetch } from "@/lib/cdp-wallet";
import { enrichX402Payment } from "@/lib/x402-settlement";
import type { BatchMatchResponse } from "@/lib/types";

const TrialCriteriaSchema = z.object({
  trial_id: z.string(),
  title: z.string(),
  condition: z.string(),
  intervention: z.string(),
  inclusion: z.array(z.string()),
  exclusion: z.array(z.string()),
  age_min_months: z.number().nullable().optional(),
  age_max_months: z.number().nullable().optional(),
  gender: z.enum(["male", "female", "both"]),
  phase: z.string().nullable().optional(),
  status: z.string(),
});

const PatientProfileSchema = z.object({
  patient_id: z.string(),
  age_months: z.number(),
  gender: z.enum(["male", "female"]),
  conditions: z.array(z.string()),
  comorbidities: z.array(z.string()).optional(),
  location_state: z.string(),
  lab_values: z.record(z.number()).optional(),
  prior_treatment: z.array(z.string()).optional(),
  smoking_history: z.boolean().optional(),
  stage: z.string().nullable().optional(),
});

const BatchMatchRequestSchema = z.object({
  trial_criteria: TrialCriteriaSchema,
  patient_profiles: z.array(PatientProfileSchema).min(1).max(500),
  top_k: z.number().int().positive().optional(),
});

const BACKBONE_URL = process.env.BACKBONE_URL ?? "http://localhost:4020";

function toCriteriaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*\d+[\).\-\t ]+\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function parseAgeMonths(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 12);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const years = Number.parseFloat(match[1]);
  if (!Number.isFinite(years)) return null;
  return Math.round(years * 12);
}

function normalizeGender(value: unknown): "male" | "female" | "both" | undefined {
  if (typeof value !== "string") return undefined;
  const g = value.trim().toLowerCase();
  if (g === "male" || g === "m") return "male";
  if (g === "female" || g === "f") return "female";
  if (g === "both" || g === "all" || g === "any") return "both";
  return undefined;
}

function normalizeTrialCriteria(input: unknown): unknown {
  if (Array.isArray(input)) {
    return normalizeTrialCriteria(input[0] ?? null);
  }
  if (!input || typeof input !== "object") return input;
  const t = input as Record<string, unknown>;

  const trial_id = (t.trial_id as string | undefined) ?? (t.ctri_number as string | undefined);
  const inclusion = toCriteriaList(t.inclusion ?? t.inclusion_criteria);
  const exclusion = toCriteriaList(t.exclusion ?? t.exclusion_criteria);

  const age_min_months =
    asNumber(t.age_min_months) ??
    (asNumber(t.min_age_years) !== null ? asNumber(t.min_age_years)! * 12 : null) ??
    (asNumber(t.age_min_years) !== null ? asNumber(t.age_min_years)! * 12 : null) ??
    parseAgeMonths(t.min_age) ??
    parseAgeMonths(t.minimum_age);
  const age_max_months =
    asNumber(t.age_max_months) ??
    (asNumber(t.max_age_years) !== null ? asNumber(t.max_age_years)! * 12 : null) ??
    (asNumber(t.age_max_years) !== null ? asNumber(t.age_max_years)! * 12 : null) ??
    parseAgeMonths(t.max_age) ??
    parseAgeMonths(t.maximum_age);

  const intervention =
    typeof t.intervention === "string"
      ? t.intervention
      : Array.isArray(t.interventions)
        ? t.interventions.map((x) => String(x)).join(" | ")
        : "";

  const status =
    (typeof t.status === "string" ? t.status : undefined) ??
    (typeof t.recruitment_status === "string" ? t.recruitment_status : undefined) ??
    "";

  return {
    trial_id,
    title: t.title,
    condition: t.condition,
    intervention,
    inclusion,
    exclusion,
    age_min_months,
    age_max_months,
    gender: normalizeGender(t.gender),
    phase: t.phase ?? null,
    status,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalizedBody =
    body && typeof body === "object"
      ? {
          ...(body as Record<string, unknown>),
          trial_criteria: normalizeTrialCriteria(
            (body as Record<string, unknown>).trial_criteria,
          ),
        }
      : body;

  const parsed = BatchMatchRequestSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { data, paymentResponse, status } = await x402Fetch(
      `${BACKBONE_URL}/batch_match_parsed`,
      parsed.data,
    );

    if (status >= 400) {
      return NextResponse.json(data, { status });
    }

    const result = data as BatchMatchResponse;
    const x402 = enrichX402Payment(paymentResponse);
    const { settlementNetwork, ...x402Rest } = x402;
    return NextResponse.json({
      ...result,
      payment: {
        settled: true,
        network: settlementNetwork ?? "base-sepolia",
        amount: "$2.00 USDC",
        paymentResponse: paymentResponse ?? undefined,
        ...x402Rest,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch match failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
