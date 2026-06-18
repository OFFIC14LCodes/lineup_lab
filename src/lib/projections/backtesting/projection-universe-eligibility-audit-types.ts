export type ProjectionUniverseEligibilityStatus =
  | "active_plausible"
  | "low_confidence_plausible"
  | "rookie_or_new_player"
  | "stale_historical_signal"
  | "retired_or_legacy_suspect"
  | "manual_review_required";

export type ProjectionUniverseEligibilityReasonCode =
  | "has_current_team"
  | "missing_current_team"
  | "rookie_current_class"
  | "recent_nfl_activity"
  | "no_recent_nfl_activity"
  | "old_last_seen_season"
  | "legacy_name_match"
  | "age_outlier"
  | "kicker_low_prior_fallback"
  | "idp_low_prior_fallback"
  | "shadow_critical_movement"
  | "large_expected_games_delta"
  | "no_2026_roster_signal"
  | "manual_review_name_flag";

export type ProjectionUniverseRecommendedAction =
  | "safe_to_shadow"
  | "manual_review_before_promotion"
  | "exclude_from_promotion_candidate_pool"
  | "needs_roster_source_confirmation"
  | "needs_kicker_policy_review";

export type ProjectionUniverseReadinessVerdict =
  | "universe_clean_for_shadow"
  | "universe_shadow_ok_manual_review_needed"
  | "universe_blocked_for_promotion";

export type ProjectionUniverseEligibilityRow = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  player: string;
  position: string;
  team: string | null;
  eligibilityStatus: ProjectionUniverseEligibilityStatus;
  reasonCodes: ProjectionUniverseEligibilityReasonCode[];
  recommendedAction: ProjectionUniverseRecommendedAction;
  lastActiveSeason: number | null;
  priorGames: number;
  noPriorNflData: boolean;
  matchConfidence: string;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  projectedTotalPointDelta: number | null;
  shadowMovementBucket: string | null;
  criticalMovement: boolean;
  estimatedOverallRankMovement: number | null;
  projectionSignalSource: string;
};

export type ProjectionUniverseEligibilitySummaryRow = {
  segment: string;
  total: number;
  activePlausible: number;
  lowConfidencePlausible: number;
  rookieOrNewPlayer: number;
  staleHistoricalSignal: number;
  retiredOrLegacySuspect: number;
  manualReviewRequired: number;
};

export type ProjectionUniverseKickerReview = {
  totalKRows: number;
  lowPriorFallbackRows: number;
  criticalMovementRows: number;
  movingEightToTwelveExpectedGames: number;
  statusCounts: Record<string, number>;
  recommendation: string;
};

export type ProjectionUniverseEligibilityAuditReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    snapshot: string;
    shadow: string;
  };
  summary: {
    totalProjectedRows: number;
    statusCounts: Record<ProjectionUniverseEligibilityStatus, number>;
    byPosition: ProjectionUniverseEligibilitySummaryRow[];
    byCohort: ProjectionUniverseEligibilitySummaryRow[];
    byTeam: Record<string, number>;
    byLastActiveSeason: Record<string, number>;
  };
  rows: ProjectionUniverseEligibilityRow[];
  criticalMovementReview: ProjectionUniverseEligibilityRow[];
  retiredLegacySuspects: ProjectionUniverseEligibilityRow[];
  kickerReview: ProjectionUniverseKickerReview;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionUniverseReadinessVerdict;
  notes: string[];
};

export type ProjectionUniverseEligibilityAuditOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionUniverseEligibilityAuditArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
