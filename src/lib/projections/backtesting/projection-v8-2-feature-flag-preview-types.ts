import type { ExpectedGamesModelSelectionReason } from "@/lib/projections/feature-flags";

import type { ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";

export type ProjectionV82FeatureFlagPreviewMode = "disabled" | "enabled" | "missing_artifacts";

export type ProjectionV82FeatureFlagPreviewSelection = "current_path" | "v8_2_candidate_path" | "excluded_from_flag_pool" | "blocked_from_flag_pool";

export type ProjectionV82FeatureFlagPreviewRecommendation =
  | "selector_preview_clean"
  | "selector_preview_mismatch"
  | "selector_preview_blocked";

export type ProjectionV82FeatureFlagPreviewRow = Pick<
  ProjectionV82FeatureFlagReadinessRow,
  | "playerId"
  | "player"
  | "position"
  | "team"
  | "status"
  | "universeEligibilityStatus"
  | "criticalMovement"
  | "meaningfulRankMover"
  | "projectedPointDelta"
  | "movementBucket"
> & {
  mode: ProjectionV82FeatureFlagPreviewMode;
  selectorSelection: ProjectionV82FeatureFlagPreviewSelection;
  selectorReason: ExpectedGamesModelSelectionReason;
  readinessExpectedSelection: ProjectionV82FeatureFlagPreviewSelection;
  mismatch: boolean;
  violation: boolean;
};

export type ProjectionV82FeatureFlagPreviewSummary = {
  totalRows: number;
  currentPathRows: number;
  v82Rows: number;
  excludedRows: number;
  blockedRows: number;
  kRowsUsingV82: number;
  criticalMovementRowsUsingV82: number;
  meaningfulRankMoversUsingV82: number;
  legacyRowsUsingV82: number;
  mismatches: number;
  protectedRowViolations: number;
};

export type ProjectionV82FeatureFlagPreviewMismatch = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  readinessExpectedSelection: ProjectionV82FeatureFlagPreviewSelection;
  selectorSelection: ProjectionV82FeatureFlagPreviewSelection;
  selectorReason: ExpectedGamesModelSelectionReason;
  detail: string;
};

export type ProjectionV82FeatureFlagPreviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
  sourceArtifacts: {
    readiness: string;
    shadow: string;
    snapshot: string;
  };
  disabledMode: {
    rows: ProjectionV82FeatureFlagPreviewRow[];
    summary: ProjectionV82FeatureFlagPreviewSummary;
  };
  enabledMode: {
    rows: ProjectionV82FeatureFlagPreviewRow[];
    summary: ProjectionV82FeatureFlagPreviewSummary;
    expectedReadinessSummary: {
      wouldUseV82UnderFlag: number;
      wouldUseCurrentPathUnderFlag: number;
      excludedFromFlagPool: number;
      blockedFromFlagPool: number;
      kRowsUsingV82: number;
      criticalMovementRowsUsingV82: number;
      meaningfulRankMoversUsingV82: number;
      legacyRowsUsingV82: number;
    };
  };
  missingArtifactsMode: {
    summary: ProjectionV82FeatureFlagPreviewSummary;
  };
  mismatches: ProjectionV82FeatureFlagPreviewMismatch[];
  protectedRowViolations: ProjectionV82FeatureFlagPreviewMismatch[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionV82FeatureFlagPreviewRecommendation;
  notes: string[];
};

export type ProjectionV82FeatureFlagPreviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionV82FeatureFlagPreviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
