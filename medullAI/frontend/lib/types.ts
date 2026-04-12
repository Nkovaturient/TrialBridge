export interface PipelinePhase {
  name: string;
  status?: string;
  ms?: number;
  txHash?: string;
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
  payment?: {
    settled: boolean;
    network: string;
    amount: string;
    paymentResponse?: string;
  };
}

export interface MatchRequest {
  raw_trial: Record<string, unknown>;
  raw_patient: Record<string, unknown>;
}
