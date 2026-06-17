export interface FeatureFlag {
  flagKey: string;
  enabled: boolean;
  allowlist: string[];
  rolloutPercentage: number;
}

export interface CreateFlagInput {
  flagKey: string;
  enabled: boolean;
  allowlist: string[];
  rolloutPercentage: number;
}

export interface UpdateFlagInput {
  enabled?: boolean;
  allowlist?: string[];
  rolloutPercentage?: number;
}

export type EvaluationReason =
  | 'flag_disabled'
  | 'user_allowlisted'
  | 'full_rollout'
  | 'user_in_percentage_rollout'
  | 'not_in_rollout';

export interface EvaluationResult {
  result: boolean;
  reason: EvaluationReason;
}
