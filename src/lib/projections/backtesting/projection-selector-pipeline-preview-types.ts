import type { ExpectedGamesModelSelectionReason } from "@/lib/projections/feature-flags";

import type { ProjectionV82FeatureFlagPreviewSelection } from "./projection-v8-2-feature-flag-preview-types";
import type { ProjectionV82ShadowGamesBucket, ProjectionV82ShadowMovementBucket } from "./projection-v8-2-shadow-types";

export type ProjectionSelectorPipelinePreviewMode = "disabled" | "enabled" | "missing_artifacts";

export type ProjectionSelectorPipelinePreviewSelection = ProjectionV82FeatureFlagPreviewSelection;

export type ProjectionSelectorPipelinePreviewRecommendation =
  | "pipeline_selector_preview_clean"
  | "pipeline_selector_preview_mismatch"
  | "pipeline_selector_preview_blocked";

export type ProjectionSelectorPipelinePreviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionSelectorPipelinePreviewRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  mode: ProjectionSelectorPipelinePreviewMode;
  readinessStatus: ProjectionSelectorPipelinePreviewSelection;
  selectorSelection: ProjectionSelectorPipelinePreviewSelection;
  selectorReason: ExpectedGamesModelSelectionReason;
  expectedGamesModel: "current" | "blackbird_expected_games_v8_2_high_impact_guardrail" | null;
  currentExpectedGames: number | null;
  selectedExpectedGames: number | null;
  v82ExpectedGames: number | null;
  currentProjectedTotal: number | null;
  selectedProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedTotalDeltaVsCurrent: number | null;
  movementBucket: ProjectionV82ShadowMovementBucket | string;
  gamesBucket: ProjectionV82ShadowGamesBucket | string | null;
  cohorts: string[];
  criticalMovement: boolean;
  meaningfulRankMover: boolean;
  universeEligibilityStatus: string | null;
  mismatchWithSelectorPreview: boolean;
  mismatchWithReadiness: boolean;
  projectionTotalMismatchVsCurrent: boolean;
  protectedRowViolation: boolean;
};

export type ProjectionSelectorPipelinePreviewSummary = {
  rowsEvaluated: number;
  currentPathRows: number;
  v82Rows: number;
  excludedRows: number;
  blockedRows: number;
  projectionTotalMismatchesVsCurrent: number;
  maxProjectionDeltaVsCurrent: number | null;
  rankingAffectingOutputDeltaRows: number;
  protectedRowViolations: number;
  mismatchesWithSelectorPreview: number;
  mismatchesWithReadiness: number;
  kRowsUsingV82: number;
  criticalMovementRowsUsingV82: number;
  meaningfulRankMoversUsingV82: number;
  legacyRowsUsingV82: number;
  movementBuckets: Record<string, number>;
  positionSummaries: ProjectionSelectorPipelinePreviewMovementSummary[];
  cohortSummaries: ProjectionSelectorPipelinePreviewMovementSummary[];
};

export type ProjectionSelectorPipelinePreviewMovementSummary = {
  segment: string;
  rows: number;
  averageProjectedTotalDeltaVsCurrent: number | null;
  maxAbsProjectedTotalDeltaVsCurrent: number | null;
  rowsMoving5Plus: number;
  rowsMoving10Plus: number;
  rowsMoving20Plus: number;
};

export type ProjectionSelectorPipelinePreviewMismatch = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  expected: ProjectionSelectorPipelinePreviewSelection | number | null;
  actual: ProjectionSelectorPipelinePreviewSelection | number | null;
  reason: string;
};

export type ProjectionSelectorPipelinePreviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
  sourceArtifacts: {
    snapshot: string;
    readiness: string;
    selectorPreview: string;
    shadow: string;
  };
  disabledMode: {
    rows: ProjectionSelectorPipelinePreviewRow[];
    summary: ProjectionSelectorPipelinePreviewSummary;
  };
  enabledMode: {
    rows: ProjectionSelectorPipelinePreviewRow[];
    summary: ProjectionSelectorPipelinePreviewSummary;
  };
  missingArtifactsMode: {
    summary: ProjectionSelectorPipelinePreviewSummary;
  };
  expectedReadinessCounts: {
    wouldUseV82UnderFlag: number;
    wouldUseCurrentPathUnderFlag: number;
    excludedFromFlagPool: number;
    blockedFromFlagPool: number;
  };
  expectedSelectorPreviewCounts: {
    v82Rows: number;
    currentPathRows: number;
    excludedRows: number;
    blockedRows: number;
  };
  mismatches: ProjectionSelectorPipelinePreviewMismatch[];
  protectedRowViolations: ProjectionSelectorPipelinePreviewMismatch[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionSelectorPipelinePreviewRecommendation;
  notes: string[];
};

export type ProjectionSelectorPipelinePreviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
