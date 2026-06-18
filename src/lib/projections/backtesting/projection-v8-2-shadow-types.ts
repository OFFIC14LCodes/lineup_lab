import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";

export type ProjectionV82ShadowOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionV82ShadowMovementBucket = "0" | "0-5" | "5-10" | "10-20" | "20+";
export type ProjectionV82ShadowGamesBucket = "0" | "0-0.5" | "0.5-1" | "1-2" | "2-4" | "4+";
export type ProjectionV82ShadowRisk = "low" | "moderate" | "high" | "critical";
export type ProjectionV82ShadowRecommendation = "shadow_clean" | "shadow_candidate_with_manual_review" | "shadow_blocked";
export type ProjectionV82CriticalReviewStatus = "safe_shadow_difference" | "needs_manual_review" | "do_not_promote_until_reviewed";

export type ProjectionV82ShadowSafetyGateName =
  | "no_live_outputs_changed"
  | "no_supabase_writes"
  | "rankings_unchanged"
  | "draft_suggestions_unchanged"
  | "war_room_unchanged"
  | "te_fallback_preserved"
  | "k_fallback_preserved"
  | "critical_movements_reported"
  | "elite_ppg_movements_guardrailed"
  | "shadow_rows_generated";

export type ProjectionV82ShadowSafetyGate = {
  name: ProjectionV82ShadowSafetyGateName;
  passed: boolean;
  detail: string;
};

export type ProjectionV82ShadowRow = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  player: string;
  position: string;
  team: string | null;
  cohorts: string[];
  currentExpectedGames: number;
  v82ExpectedGames: number;
  expectedGamesDelta: number;
  ppgAnchor: number;
  projectedTotalPointDelta: number;
  currentProjectedTotal: number;
  shadowProjectedTotal: number;
  movementBucket: ProjectionV82ShadowMovementBucket;
  gamesBucket: ProjectionV82ShadowGamesBucket;
  risk: ProjectionV82ShadowRisk;
  riskFlags: string[];
  reasonCodes: string[];
  guardrailApplied: boolean;
  currentOverallRank: number | null;
  shadowOverallRank: number | null;
  estimatedOverallRankMovement: number | null;
  currentPositionRank: number | null;
  shadowPositionRank: number | null;
  estimatedPositionRankMovement: number | null;
  criticalReviewStatus: ProjectionV82CriticalReviewStatus | null;
};

export type ProjectionV82ShadowMovementSummaryRow = {
  segment: string;
  rows: number;
  averageExpectedGamesDelta: number | null;
  averageProjectedTotalPointDelta: number | null;
  rowsMoving5Plus: number;
  rowsMoving10Plus: number;
  rowsMoving20Plus: number;
  criticalMovementRows: number;
};

export type ProjectionV82ShadowReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  currentModel: "blackbird_expected_games_v7_family_selective";
  shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail";
  sourceArtifacts: {
    snapshot: string;
  };
  rowCoverage: {
    currentLiveProjectionRows: number;
    v82ShadowRows: number;
    sharedRows: number;
    currentOnlyRows: number;
    v82OnlyRows: number;
    rowsSkipped: number;
    skipReasons: Record<string, number>;
    positionCounts: Record<string, number>;
    cohortCounts: Record<string, number>;
  };
  movementBuckets: Record<ProjectionV82ShadowMovementBucket, number>;
  expectedGamesMovementBuckets: Record<ProjectionV82ShadowGamesBucket, number>;
  positionMovementSummary: ProjectionV82ShadowMovementSummaryRow[];
  cohortMovementSummary: ProjectionV82ShadowMovementSummaryRow[];
  rows: ProjectionV82ShadowRow[];
  topMovements: ProjectionV82ShadowRow[];
  criticalMovements: ProjectionV82ShadowRow[];
  rankingRiskPreview: {
    estimated: boolean;
    reason: string;
    rowsWithEstimatedOverallRankMovement: number;
    rowsWithEstimatedPositionRankMovement: number;
    topOverallRankMovements: ProjectionV82ShadowRow[];
    topPositionRankMovements: ProjectionV82ShadowRow[];
  };
  safetyGates: ProjectionV82ShadowSafetyGate[];
  recommendation: ProjectionV82ShadowRecommendation;
  notes: string[];
};

export type ProjectionV82ShadowInput = {
  snapshot: PreseasonProjectionSnapshot;
  options: ProjectionV82ShadowOptions;
  sourceArtifacts?: ProjectionV82ShadowReport["sourceArtifacts"];
};

export type ProjectionV82ShadowArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionV82ShadowSnapshotRow = PreseasonProjectionSnapshotRow;
