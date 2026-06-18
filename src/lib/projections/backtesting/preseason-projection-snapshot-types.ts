import type { PlayerProfileScoringMetadata } from "@/lib/player-profiles";
import type { ExpectedGamesModelSelectionReason } from "@/lib/projections/feature-flags";

import type { ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";

export type PreseasonProjectionSnapshotMetadata = {
  artifactType: "blackbird_preseason_projection_snapshot";
  projectionSeason: number;
  targetSeason: number;
  inputSeasons: number[];
  excludedSeasons: number[];
  leakageSafe: true;
  createdForBacktesting: true;
  modelVersion: "preseason_snapshot_v2";
  defaultUniverse: PreseasonProjectionUniverse;
  scoringSource: PlayerProfileScoringMetadata["scoringSource"];
  scoringProfile: string;
  notes: string[];
};

export type PreseasonProjectionUniverse = "all" | "fantasy-relevant" | "evaluated-backtest";

export type PreseasonProjectionSnapshotOptions = {
  targetSeason: number;
  includeIdp: boolean;
  universe?: PreseasonProjectionUniverse;
};

export type PreseasonProjectionExpectedGamesSelectorOverride = {
  flagEnabled?: boolean;
  readinessArtifactsAvailable?: boolean;
  readinessRows?: Map<string, ProjectionV82FeatureFlagReadinessRow> | null;
};

export type PreseasonProjectionVariant =
  | "blackbird_existing_projection_v1"
  | "blackbird_availability_calibrated"
  | "blackbird_no_prior_calibrated"
  | "blackbird_calibrated_v2"
  | "blackbird_cohort_games_calibrated"
  | "blackbird_cohort_ppg_calibrated"
  | "blackbird_cohort_calibrated_v3"
  | "blackbird_expected_games_v4"
  | "blackbird_expected_games_v5_selective"
  | "blackbird_expected_games_v6_gated"
  | "blackbird_expected_games_v7_family_selective"
  | "blackbird_expected_games_v8_cohort_blend"
  | "blackbird_expected_games_v8_1_calibrated_gate"
  | "blackbird_expected_games_v8_2_high_impact_guardrail";

export type PreseasonProjectionCohort =
  | "veteran_3plus_prior_seasons"
  | "two_prior_seasons"
  | "one_prior_season"
  | "rookie_or_no_prior_nfl_data"
  | "low_prior_sample"
  | "low_actual_sample"
  | "idp_dl"
  | "idp_lb"
  | "idp_db"
  | "offense_qb"
  | "offense_rb"
  | "offense_wr"
  | "offense_te"
  | "kicker";

export type PreseasonProjectionSnapshotRow = {
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  normalizedName: string;
  position: string;
  team: string | null;
  matchConfidence: string;
  projectedGames: number;
  projectedPpg: number;
  projectedTotalPoints: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  confidence: "very_low" | "low" | "medium" | "high";
  confidenceScore: number;
  variant: PreseasonProjectionVariant;
  source: PreseasonProjectionVariant;
  projectionSource: PreseasonProjectionVariant;
  projectionRunId: string | null;
  projectionReasons: string[];
  warnings: string[];
  cohortLabels: PreseasonProjectionCohort[];
  universe: PreseasonProjectionUniverse;
  inputCoverage: {
    priorSeasonsUsed: number[];
    priorGames: number;
    priorPpg: number | null;
    careerToDatePpg: number | null;
    roleLabel: string;
    availabilitySignal: number | null;
    snapShare: number | null;
    usageTrend: string;
    highValueUsageFlags: string[];
    noPriorNflData: boolean;
    noPriorType: string;
  };
  expectedGamesDiagnostics: {
    projectedGamesV1: number;
    calibratedProjectedGames: number;
    gamesCalibrationReason: string;
    availabilityCohort: string;
    availabilityConfidence: "very_low" | "low" | "medium" | "high";
    calibrationCohort: string;
    cohortReason: string;
    expectedGamesRule: string;
    ppgAdjustmentRule: string;
    confidenceRule: string;
    noPriorRule: string | null;
    expectedGamesModel: string | null;
    expectedGamesModelSelected?: "current" | "blackbird_expected_games_v8_2_high_impact_guardrail" | null;
    expectedGamesSelectionReason?: ExpectedGamesModelSelectionReason | null;
    expectedGamesSelectionProtectedReason?: ExpectedGamesModelSelectionReason | null;
    expectedGamesSelectionFlagEnabled?: boolean;
    expectedGamesReadinessArtifactsAvailable?: boolean;
    expectedGamesReadinessStatus?: string | null;
    expectedGamesSelectorPlayerId?: string | null;
    expectedGamesRuleV4: string | null;
    expectedGamesInputs: {
      priorSeasonsUsed: number[];
      weightedRecentGames: number | null;
      careerRecentGames: number | null;
      priorSeasonGames: number | null;
      snapShare: number | null;
      roleLabel: string;
      noPriorType: string;
    } | null;
    expectedGamesConfidence: "very_low" | "low" | "medium" | "high" | null;
    expectedGamesWarnings: string[];
    previousProjectedGames: number | null;
    v4ProjectedGames: number | null;
    v5ProjectedGames: number | null;
    v6ProjectedGames: number | null;
    v7ProjectedGames: number | null;
    v8ProjectedGames: number | null;
    v81ProjectedGames: number | null;
    v82ProjectedGames: number | null;
    weightedRecentGames: number | null;
    careerRecentGames: number | null;
    selectedExpectedGamesMethod: string | null;
    selectedExpectedGamesReason: string | null;
    fallbackReason: string | null;
    v6SelectedExpectedGamesMethod: string | null;
    v6GateReason: string | null;
    v6PositionFamilyGateStatus: string | null;
    v6ExpectedGamesConfidence: "very_low" | "low" | "medium" | "high" | null;
    v6SelectedExpectedGamesReason: string | null;
    v6FallbackReason: string | null;
    v7SelectedExpectedGamesMethod: string | null;
    v7GateReason: string | null;
    v7PositionFamilyGateStatus: string | null;
    v7ExpectedGamesConfidence: "very_low" | "low" | "medium" | "high" | null;
    v7SelectedExpectedGamesReason: string | null;
    v7FallbackReason: string | null;
    v8SelectedExpectedGamesMethod: string | null;
    v8Cohort: string | null;
    v8BaselineExpectedGames: number | null;
    v8Adjustment: number | null;
    v8AdjustmentReason: string | null;
    v8BaselineSource: string | null;
    v8ExpectedGamesConfidence: "very_low" | "low" | "medium" | "high" | null;
    v8SelectedExpectedGamesReason: string | null;
    v8FallbackReason: string | null;
    v81BaseModelUsed: string | null;
    v81ProjectedGamesRawV8: number | null;
    v81ProjectedGamesV7: number | null;
    v81RawDeltaFromV7: number | null;
    v81CalibratedDeltaFromV7: number | null;
    v81DampeningFactor: number | null;
    v81GatesApplied: string[];
    v81Cohort: string | null;
    v81Position: string | null;
    v81PpgBucket: string | null;
    v81AdjustmentBucket: string | null;
    v81ReasonCodes: string[];
    v81SelectedExpectedGamesReason: string | null;
    v82BaseModelUsed: string | null;
    v82ProjectedGamesV7: number | null;
    v82ProjectedGamesV8: number | null;
    v82ProjectedGamesV81: number | null;
    v82DeltaFromV7: number | null;
    v82DeltaFromV81: number | null;
    v82GuardrailApplied: boolean | null;
    v82GuardrailReasonCodes: string[];
    v82PpgBucket: string | null;
    v82AdjustmentBucket: string | null;
    v82SelectedExpectedGamesReason: string | null;
    qbStarterProbabilityBucket: string | null;
    qbStarterSignalReason: string | null;
    qbExpectedGamesCap: number | null;
    qbFallbackReason: string | null;
  };
};

export type PreseasonProjectionSnapshot = {
  metadata: PreseasonProjectionSnapshotMetadata;
  rows: PreseasonProjectionSnapshotRow[];
  diagnostics: {
    playersConsidered: number;
    playersProjected: number;
    playersSkipped: number;
    playersSkippedNoSignal: number;
    universe: PreseasonProjectionUniverse;
    variantCounts: Record<string, number>;
    cohortCounts: Record<string, number>;
    noPriorTypeCounts: Record<string, number>;
    noPriorCount: number;
    idpCount: number;
    averageProjectedGames: number | null;
    averageProjectedPpgByPosition: Record<string, number>;
    confidenceDistribution: Record<string, number>;
    warningsByType: Record<string, number>;
    leakageSafety: {
      passed: boolean;
      targetSeasonExcludedFromInputs: boolean;
      noPostTargetProjectionArtifactsUsed: boolean;
      notes: string[];
    };
    expectedGamesSelector?: {
      flagEnabled: boolean;
      readinessArtifactsAvailable: boolean;
      totalSelectorRows: number;
      selectedV82Rows: number;
      currentPathRows: number;
      blockedOrExcludedRows: number;
      missingReadinessRows: number;
      missingArtifactRows: number;
      protectedRows: number;
      kRowsUsingV82: number;
      criticalMovementRowsUsingV82: number;
      meaningfulRankMoversUsingV82: number;
      legacyRowsUsingV82: number;
    };
  };
};
