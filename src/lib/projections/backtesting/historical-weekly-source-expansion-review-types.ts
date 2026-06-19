import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";

export type HistoricalWeeklySourceExpansionReason =
  | "not_in_weekly_source_but_in_roster_source"
  | "not_in_weekly_source_and_not_rostered"
  | "identifier_mapping_gap"
  | "position_or_team_mismatch"
  | "likely_zero_season_player"
  | "needs_roster_status_source"
  | "needs_injury_status_source"
  | "needs_snap_count_source"
  | "needs_weekly_source_expansion"
  | "manual_review_required";

export type HistoricalWeeklySourceExpansionTreatment =
  | "zero_season_confirmed"
  | "zero_weeks_from_roster_status"
  | "needs_additional_source"
  | "needs_identifier_mapping"
  | "manual_review"
  | "do_not_score";

export type HistoricalWeeklySourceExpansionIntegrationRecommendation =
  | "weekly_source_expansion_ready_for_zero_season_treatment"
  | "weekly_source_expansion_needs_roster_source"
  | "weekly_source_expansion_needs_identifier_mapping"
  | "weekly_source_expansion_needs_additional_sources"
  | "weekly_source_expansion_blocked";

export type HistoricalWeeklySourceExpansionFinalRecommendation =
  | "historical_weekly_source_expansion_ready_for_h42_fix"
  | "historical_weekly_source_expansion_needs_source_files"
  | "historical_weekly_source_expansion_needs_manual_review"
  | "historical_weekly_source_expansion_blocked";

export type HistoricalWeeklySourceAvailability = {
  source: "rosters" | "players" | "snap_counts" | "injuries" | "depth_charts";
  path: string;
  exists: boolean;
  rows: number;
  exact_id_matches: number;
  strict_name_position_team_candidates: number;
};

export type HistoricalWeeklySourceExpansionPlayerRow = {
  player_id: string;
  sleeper_id: string | null;
  gsis_id: string | null;
  player_name: string;
  position: string;
  team: string | null;
  drafted_by_strategies: HistoricalMockDraftStrategy[];
  drafted_count: number;
  draft_rounds: number[];
  missing_weeks: number[];
  expected_weeks: number;
  season_level_weekly_source_present: boolean;
  roster_source_present: boolean;
  player_registry_present: boolean;
  candidate_source_availability: string[];
  reason: HistoricalWeeklySourceExpansionReason;
  recommended_treatment: HistoricalWeeklySourceExpansionTreatment;
  missing_rows: number;
};

export type HistoricalWeeklySourceExpansionProjection = {
  current_missing_rows: number;
  missing_rows_that_could_become_zero_season_rows: number;
  missing_rows_requiring_source_expansion: number;
  missing_rows_requiring_identifier_mapping: number;
  missing_rows_requiring_manual_review: number;
  projected_remaining_missing_rows: number;
  current_missing_rate: number;
  projected_missing_rate_after_safe_treatment: number;
  projected_reliability_grade: "high" | "medium" | "low" | "insufficient";
};

export type HistoricalWeeklySourceExpansionStrategyDistortion = {
  remaining_missing_rate_by_strategy: Array<{
    strategy: HistoricalMockDraftStrategy;
    missing_rows: number;
    total_player_weeks: number;
    missing_rate: number;
  }>;
  most_distorted_strategies: HistoricalMockDraftStrategy[];
  blackbird_rank_likely_stable_or_uncertain: "likely_stable" | "uncertain";
};

export type HistoricalWeeklySourceExpansionReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  recommendation: HistoricalWeeklySourceExpansionFinalRecommendation;
  h37IntegrationRecommendation: HistoricalWeeklySourceExpansionIntegrationRecommendation;
  sourceArtifacts: Record<string, string>;
  sourceAvailability: HistoricalWeeklySourceAvailability[];
  remainingMissingPlayers: HistoricalWeeklySourceExpansionPlayerRow[];
  reasonSummary: Array<{ reason: HistoricalWeeklySourceExpansionReason; count: number; missing_rows: number }>;
  treatmentSummary: Array<{ treatment: HistoricalWeeklySourceExpansionTreatment; players: number; missing_rows: number }>;
  projectedCoverageImprovement: HistoricalWeeklySourceExpansionProjection;
  strategyDistortionSummary: HistoricalWeeklySourceExpansionStrategyDistortion;
  dataLeakageGuard: {
    draftRostersCameFromH36PreseasonOnlyEngine: boolean;
    outcomesUsedOnlyAfterDraft: boolean;
    noDraftRankingsRecomputedFromOutcomes: boolean;
    noLooseFuzzyConfirmedMatches: boolean;
  };
  limitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalWeeklySourceExpansionReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
