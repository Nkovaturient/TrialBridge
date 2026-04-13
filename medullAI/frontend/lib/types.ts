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
}

export interface MatchRequest {
  raw_trial: Record<string, unknown>;
  raw_patient: Record<string, unknown>;
}

export interface BatchMatchStats {
  total: number;
  llm_calls: number;
  hard_filtered: number;
}

export interface BatchMatchResult extends Omit<MatchResult, "onChain" | "pipeline" | "payment"> {
  onChain?: OnChainInfo;
  pipeline?: PipelinePhase[];
}

export interface BatchMatchResponse {
  trial_id: string;
  results: BatchMatchResult[];
  stats: BatchMatchStats;
  pipeline?: PipelinePhase[];
  payment?: X402PaymentInfo;
}
