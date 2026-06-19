import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";

export type HistoricalOutcomeCoverageMissingReason =
  | "no_weekly_row_for_player"
  | "identifier_mismatch_possible"
  | "name_position_candidate_exists"
  | "position_mismatch_candidate"
  | "team_mismatch_candidate"
  | "player_did_not_record_stats"
  | "player_not_in_weekly_source"
  | "draft_universe_synthetic_or_invalid";

export type HistoricalOutcomeCoverageCandidateStatus =
  | "exact_player_id"
  | "exact_sleeper_id"
  | "exact_gsis_id"
  | "normalized_name_position_team_candidate"
  | "normalized_name_position_candidate"
  | "normalized_name_position_mismatch_candidate"
  | "none";

export type HistoricalOutcomeCoverageIntegrationRecommendation =
  | "coverage_ready_to_treat_missing_weeks_as_zero"
  | "coverage_needs_identifier_crosswalk"
  | "coverage_needs_name_review_candidates"
  | "coverage_needs_weekly_source_expansion"
  | "coverage_blocked";

export type HistoricalOutcomeCoverageFinalRecommendation =
  | "historical_outcome_coverage_ready_for_h37_fix"
  | "historical_outcome_coverage_needs_identifier_mapping"
  | "historical_outcome_coverage_needs_source_expansion"
  | "historical_outcome_coverage_needs_manual_review"
  | "historical_outcome_coverage_blocked";

export type HistoricalOutcomeCoverageMissingScoreRow = {
  strategy: HistoricalMockDraftStrategy;
  team_id: string;
  draft_slot: number | null;
  week: number;
  player_id: string;
  sleeper_id: string | null;
  gsis_id: string | null;
  player_name: string;
  position: string;
  team: string | null;
  draft_round: number | null;
  draft_pick: number | null;
  missing_reason: HistoricalOutcomeCoverageMissingReason;
  candidate_match_status: HistoricalOutcomeCoverageCandidateStatus;
  season_level_player_found_in_weekly_source: boolean;
  week_level_row_found: boolean;
  score_should_be_zero_for_week: boolean;
  mapping_failure_suspected: boolean;
  candidate_count: number;
};

export type HistoricalOutcomeCoverageSeasonPlayerRow = {
  drafted_player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  strategy_count: number;
  team_count: number;
  weeks_expected: number;
  weeks_with_scores: number;
  weeks_missing: number;
  season_total_points: number;
  weekly_source_match_type: HistoricalOutcomeCoverageCandidateStatus;
  coverage_rate: number;
};

export type HistoricalOutcomeCoverageRateRow = {
  key: string;
  missing_rows: number;
  total_rows: number;
  missing_rate: number;
};

export type HistoricalOutcomeCoverageImprovementPreview = {
  current_missing_rows: number;
  new_exact_matches_possible: number;
  new_strict_name_position_team_review_candidates: number;
  true_zero_week_rows_to_synthesize: number;
  remaining_missing_after_preview: number;
  current_missing_score_rate: number;
  projected_missing_score_rate_after_preview: number;
};

export type HistoricalOutcomeCoverageStrategyImpact = {
  missing_score_rate_by_strategy: HistoricalOutcomeCoverageRateRow[];
  missing_score_rate_by_position: HistoricalOutcomeCoverageRateRow[];
  missing_score_rate_by_draft_round: HistoricalOutcomeCoverageRateRow[];
  blackbird_missing_score_rate: number;
  baseline_missing_score_rates: Record<string, number>;
  blackbird_rank_may_be_distorted_by_coverage: boolean;
};

export type HistoricalOutcomeCoverageDiagnosticsReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  recommendation: HistoricalOutcomeCoverageFinalRecommendation;
  h37IntegrationRecommendation: HistoricalOutcomeCoverageIntegrationRecommendation;
  sourceArtifacts: Record<string, string>;
  missingScoreRows: HistoricalOutcomeCoverageMissingScoreRow[];
  missingReasonSummary: Array<{ reason: HistoricalOutcomeCoverageMissingReason; count: number }>;
  seasonLevelCoverage: HistoricalOutcomeCoverageSeasonPlayerRow[];
  trueZeroVsIdentifierMismatch: {
    true_zero_week_rows: number;
    identifier_mismatch_suspected_rows: number;
    source_expansion_needed_rows: number;
    manual_review_candidate_rows: number;
  };
  improvementPreview: HistoricalOutcomeCoverageImprovementPreview;
  strategyImpactPreview: HistoricalOutcomeCoverageStrategyImpact;
  dataLeakageGuard: {
    draftRostersCameFromH36PreseasonOnlyEngine: boolean;
    outcomesCameFromH37ScoringPhase: boolean;
    actualSeasonPointsUsedOnlyAfterDraftsWereComplete: boolean;
    noLooseFuzzyConfirmedMatches: boolean;
  };
  limitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalOutcomeCoverageDiagnosticsArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
