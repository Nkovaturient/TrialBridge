export interface PipelinePhase {
  name: string;
  status?: string;
  ms?: number;
  txHash?: string;
}

export interface X402PaymentInfo {
  settled: boolean;
  network: string;
  amount: string;
  paymentResponse?: string;
  txHash?: string;
  explorerUrl?: string;
}

export interface OnChainInfo {
  txHash: string;
  blockNumber: number;
  explorerUrl: string;
}

export interface MatchResult {
  patient_id: string;
  trial_id: string;
  eligible: boolean;
  score: number;
  hard_filter_passed: boolean;
  rationale: string;
  disqualifying_criteria: string[];
  onChain: OnChainInfo;
  pipeline: PipelinePhase[];
  payment?: X402PaymentInfo;

  // Phase II-III: Decision Support
  decision_support_only?: boolean;
  requires_investigator_review?: boolean;
  confidence_level?: "high" | "medium" | "low";
  risk_factors?: string[];

  // Phase II-III: Criteria Classification
  ai_scored_criteria?: string[];
  requires_human_review_criteria?: string[];

  // Phase II-III: Data Quality
  missing_data_impact?: number;
  data_quality_warnings?: string[];
}

export interface MatchRequest {
  raw_trial: Record<string, unknown>;
  raw_patient: Record<string, unknown>;
}

export interface BatchMatchStats {
  total: number;
  llm_calls: number;
  hard_filtered: number;

  // Phase II-III: Confidence distribution
  high_confidence_matches?: number;
  medium_confidence_matches?: number;
  low_confidence_matches?: number;
  requiring_review?: number;
  avg_processing_time_ms?: number;
}

export interface BatchMatchResult extends Omit<MatchResult, "onChain" | "pipeline" | "payment"> {
  onChain?: OnChainInfo;
  pipeline?: PipelinePhase[];
}

export interface IngestDeduplication {
  input_count: number;
  duplicates_found: number;
  unique_count: number;
  /** Pairs flagged for review: [patient_id_1, patient_id_2, confidence] */
  candidates?: Array<{ patient_id_1: string; patient_id_2: string; confidence: number; recommendation: string }>;
}

export interface IngestDataQuality {
  average_completeness: number;
  patients_with_missing_data: number;
  missing_by_field: Record<string, number>;
  imputation_applied: number;
  critical_missing_count: number;
}

export interface ImputationTrace {
  field_id: string;
  method: "rule" | "llm" | "manual" | "group_mean";
  rule_id?: string;
  source_value?: string;
  confidence?: number;
  model_version?: string;
}

export interface VisitRecord {
  visit_id?: string;
  visit_num?: number;
  form_id?: string;
  form_repeat_key?: string;
  collected_date?: string;
}

export interface IngestResponse {
  patients: unknown[];
  total_rows: number;
  parsed_rows: number;
  mapper_used: string;
  /** Set by the proxy when a fallback mapper was used */
  requested_mapper?: string;
  detected_format?: string;
  format_confidence?: number;
  deduplication?: IngestDeduplication;
  data_quality?: IngestDataQuality;
  warnings: string[];
}

export interface BatchMatchResponse {
  trial_id: string;
  results: BatchMatchResult[];
  stats: BatchMatchStats;
  pipeline?: PipelinePhase[];
  payment?: X402PaymentInfo;
}
