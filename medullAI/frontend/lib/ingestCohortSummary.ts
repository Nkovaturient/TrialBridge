/**
 * Deterministic cohort-level data-quality helpers derived from PatientProfile[] returned by ingest.
 *
 * These are heuristic checks against known PatientProfile fields (conditions, lab_values, stage,
 * location_state, data_quality_flags) — not CDASH/SDTM validated counts.
 * For regulatory-facing numbers, drive from the field catalog (Phase 3) + deterministic rules.
 */

export interface FieldMissingRow {
  field: string;
  label: string;
  missing: number;
  pct: number;
  critical: boolean;
}

export interface CohortQualitySummary {
  n: number;
  /** Mean of PatientProfile.data_completeness (0-1), null if none present */
  mean_completeness: number | null;
  /** Heuristic per-field missingness table, sorted by missing % desc */
  field_table: FieldMissingRow[];
  /** Unique data_quality_flags across all patients (up to 30) */
  quality_flags: string[];
}

type R = Record<string, unknown>;

function asRecord(p: unknown): R | null {
  return p && typeof p === "object" ? (p as R) : null;
}

function labs(p: R): R {
  const lv = p.lab_values;
  return lv && typeof lv === "object" ? (lv as R) : {};
}

/** Canonical field checks aligned with FIELD_CONFIGS in missing_data.py */
const FIELD_CHECKS: Array<{ field: string; label: string; critical: boolean; missing: (p: R) => boolean }> = [
  {
    field: "conditions",
    label: "Primary conditions",
    critical: true,
    missing: (p) => !Array.isArray(p.conditions) || (p.conditions as unknown[]).length === 0,
  },
  {
    field: "stage",
    label: "Stage",
    critical: false,
    missing: (p) => p.stage == null || String(p.stage).trim() === "",
  },
  {
    field: "location_state",
    label: "State / region",
    critical: false,
    missing: (p) => {
      const s = p.location_state;
      return typeof s !== "string" || s.trim() === "" || s === "Unknown";
    },
  },
  {
    field: "lab_values",
    label: "Any lab values",
    critical: false,
    missing: (p) => Object.keys(labs(p)).length === 0,
  },
  {
    field: "lab.hemoglobin",
    label: "Hemoglobin",
    critical: true,
    missing: (p) => {
      const lv = labs(p);
      return lv.hemoglobin_g_dl == null && lv.hb == null && lv.hemoglobin == null;
    },
  },
  {
    field: "lab.serum_creatinine",
    label: "Serum creatinine",
    critical: true,
    missing: (p) => {
      const lv = labs(p);
      return lv.serum_creatinine_mg_dl == null && lv.creatinine == null && lv.serum_creatinine == null;
    },
  },
  {
    field: "lab.wbc_count",
    label: "WBC count",
    critical: true,
    missing: (p) => {
      const lv = labs(p);
      return lv.wbc_count_per_ul == null && lv.wbc_count == null && lv.wbc == null;
    },
  },
  {
    field: "lab.platelet_count",
    label: "Platelet count",
    critical: true,
    missing: (p) => {
      const lv = labs(p);
      return lv.platelet_count_per_ul == null && lv.platelet_count == null && lv.platelets == null;
    },
  },
  {
    field: "comorbidities",
    label: "Comorbidities (any)",
    critical: false,
    missing: (p) => !Array.isArray(p.comorbidities) || (p.comorbidities as unknown[]).length === 0,
  },
  {
    field: "prior_treatment",
    label: "Prior treatment",
    critical: false,
    missing: (p) => !Array.isArray(p.prior_treatment) || (p.prior_treatment as unknown[]).length === 0,
  },
];

export function buildCohortSummary(patients: unknown[]): CohortQualitySummary {
  const rows = patients.map(asRecord).filter(Boolean) as R[];
  const n = rows.length;

  if (n === 0) {
    return { n: 0, mean_completeness: null, field_table: [], quality_flags: [] };
  }

  const field_table: FieldMissingRow[] = FIELD_CHECKS.map(({ field, label, critical, missing }) => {
    let count = 0;
    for (const p of rows) {
      if (missing(p)) count++;
    }
    return { field, label, missing: count, pct: (count / n) * 100, critical };
  }).sort((a, b) => b.missing - a.missing);

  let completenessSum = 0;
  let completenessCount = 0;
  const flagSet = new Set<string>();

  for (const p of rows) {
    const dc = p.data_completeness;
    if (typeof dc === "number" && Number.isFinite(dc)) {
      completenessSum += dc;
      completenessCount++;
    }
    const flags = p.data_quality_flags;
    if (Array.isArray(flags)) {
      for (const f of flags as unknown[]) {
        if (typeof f === "string" && f.trim() && flagSet.size < 30) flagSet.add(f.trim());
      }
    }
  }

  return {
    n,
    mean_completeness: completenessCount > 0 ? completenessSum / completenessCount : null,
    field_table,
    quality_flags: [...flagSet],
  };
}
