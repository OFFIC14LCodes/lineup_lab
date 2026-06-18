import { existsSync, readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewSummary } from "./projection-selector-pipeline-preview-types";
import type { ProjectionV82FeatureFlagPreviewReport, ProjectionV82FeatureFlagPreviewSummary } from "./projection-v8-2-feature-flag-preview-types";
import type { ProjectionV82FeatureFlagReadinessReport } from "./projection-v8-2-feature-flag-readiness-types";
import {
  buildProjectionV82SnapshotDiffGuardFromData,
  writeProjectionV82SnapshotDiffGuardArtifacts,
} from "./projection-v8-2-snapshot-diff-guard";

describe("projection v8.2 snapshot diff guard", () => {
  it("passes when the default snapshot is disabled and current-path-only", () => {
    const report = buildReport();

    expect(report.defaultSnapshot).toMatchObject({
      selectorFlagEnabled: false,
      selectorRows: 4,
      v82SelectedRows: 0,
      currentPathRows: 4,
      projectionDeltasVsCurrentPath: 0,
      rankingAffectingDeltas: 0,
      protectedRowViolations: 0,
    });
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    expect(report.recommendation).toBe("snapshot_diff_guard_clean");
  });

  it("detects default-mode v8.2 drift", () => {
    const report = buildReport({
      snapshot: snapshot({ flagEnabled: true, selectedV82Rows: 1, currentPathRows: 3 }),
    });

    expect(report.safetyGates.find((gate) => gate.name === "default_snapshot_flag_disabled")?.passed).toBe(false);
    expect(report.safetyGates.find((gate) => gate.name === "default_snapshot_zero_v8_2_rows")?.passed).toBe(false);
    expect(report.recommendation).toBe("snapshot_diff_guard_blocked");
  });

  it("detects enabled count mismatch", () => {
    const report = buildReport({
      pipelinePreview: pipelinePreview({ enabled: summary({ v82Rows: 2, currentPathRows: 2 }) }),
      readiness: readiness({ wouldUseV82UnderFlag: 3, wouldUseCurrentPathUnderFlag: 1 }),
    });

    expect(report.safetyGates.find((gate) => gate.name === "enabled_counts_match_readiness_or_preview")?.passed).toBe(false);
    expect(report.recommendation).toBe("snapshot_diff_guard_mismatch");
  });

  it("detects protected-row enabled violations", () => {
    const report = buildReport({
      pipelinePreview: pipelinePreview({
        enabled: summary({ v82Rows: 3, currentPathRows: 1, kRowsUsingV82: 1 }),
      }),
    });

    expect(report.safetyGates.find((gate) => gate.name === "enabled_protected_rows_zero")?.passed).toBe(false);
    expect(report.recommendation).toBe("snapshot_diff_guard_blocked");
  });

  it("detects missing-artifact fail-closed violations", () => {
    const report = buildReport({
      pipelinePreview: pipelinePreview({
        missing: summary({ v82Rows: 1, currentPathRows: 3 }),
      }),
    });

    expect(report.safetyGates.find((gate) => gate.name === "missing_artifacts_fail_closed")?.passed).toBe(false);
    expect(report.recommendation).toBe("snapshot_diff_guard_blocked");
  });

  it("writes guard artifacts", () => {
    const report = buildReport({ projectionSeason: 2097 });
    const artifacts = writeProjectionV82SnapshotDiffGuardArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(artifacts.jsonPath, { force: true });
      rmSync(artifacts.markdownPath, { force: true });
      rmSync(artifacts.csvPath, { force: true });
    }
  });

  it("does not import live mutation, ranking, suggestion, or UI paths", () => {
    const source = readFileSync("src/lib/projections/backtesting/projection-v8-2-snapshot-diff-guard.ts", "utf8");

    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("blackbird-league-rank");
    expect(source).not.toContain("live-draft-suggestion");
    expect(source).not.toContain("draft-war-room");
    expect(source).not.toContain("src/components");
  });
});

function buildReport(input: Partial<{
  projectionSeason: number;
  snapshot: PreseasonProjectionSnapshot;
  readiness: ProjectionV82FeatureFlagReadinessReport;
  selectorPreview: ProjectionV82FeatureFlagPreviewReport;
  pipelinePreview: ProjectionSelectorPipelinePreviewReport;
}> = {}) {
  const projectionSeason = input.projectionSeason ?? 2026;
  const readinessReport = input.readiness ?? readiness();
  const pipelinePreviewReport = input.pipelinePreview ?? pipelinePreview();
  return buildProjectionV82SnapshotDiffGuardFromData({
    options: { projectionSeason, includeIdp: true },
    snapshot: input.snapshot ?? snapshot(),
    readiness: readinessReport,
    selectorPreview: input.selectorPreview ?? selectorPreview(pipelinePreviewReport),
    pipelinePreview: pipelinePreviewReport,
  });
}

function snapshot(input: Partial<{
  flagEnabled: boolean;
  selectedV82Rows: number;
  currentPathRows: number;
}> = {}): PreseasonProjectionSnapshot {
  return {
    metadata: { artifactType: "blackbird_preseason_projection_snapshot", projectionSeason: 2026, targetSeason: 2026, inputSeasons: [], excludedSeasons: [2026], leakageSafe: true, createdForBacktesting: true, modelVersion: "preseason_snapshot_v2", defaultUniverse: "all", scoringSource: "default", scoringProfile: "test", notes: [] },
    rows: [],
    diagnostics: {
      playersConsidered: 0,
      playersProjected: 0,
      playersSkipped: 0,
      playersSkippedNoSignal: 0,
      universe: "all",
      variantCounts: {},
      cohortCounts: {},
      noPriorTypeCounts: {},
      noPriorCount: 0,
      idpCount: 0,
      averageProjectedGames: null,
      averageProjectedPpgByPosition: {},
      confidenceDistribution: {},
      warningsByType: {},
      leakageSafety: { passed: true, targetSeasonExcludedFromInputs: true, noPostTargetProjectionArtifactsUsed: true, notes: [] },
      expectedGamesSelector: {
        flagEnabled: input.flagEnabled ?? false,
        readinessArtifactsAvailable: true,
        totalSelectorRows: 4,
        selectedV82Rows: input.selectedV82Rows ?? 0,
        currentPathRows: input.currentPathRows ?? 4,
        blockedOrExcludedRows: 0,
        missingReadinessRows: 0,
        missingArtifactRows: 0,
        protectedRows: 0,
        kRowsUsingV82: 0,
        criticalMovementRowsUsingV82: 0,
        meaningfulRankMoversUsingV82: 0,
        legacyRowsUsingV82: 0,
      },
    },
  };
}

function readiness(input: Partial<ProjectionV82FeatureFlagReadinessReport["summary"]> = {}): ProjectionV82FeatureFlagReadinessReport {
  const summaryDefaults = {
    totalRows: 4,
    wouldUseV82UnderFlag: 3,
    wouldUseCurrentPathUnderFlag: 1,
    excludedFromFlagPool: 0,
    blockedFromFlagPool: 0,
    manualReviewRowsRemaining: 0,
    unresolvedRowsRemaining: 0,
    kRowsUsingV82: 0,
    criticalMovementRowsUsingV82: 0,
    meaningfulRankMoversUsingV82: 0,
    legacyRowsUsingV82: 0,
  };
  return {
    generatedAt: "",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { finalReadiness: "", conservativePromotionDecisions: "", conservativeTierDecisions: "", resolvedTierDecisions: "", tierReview: "", limitedPromotionPoolReview: "", shadow: "", universeEligibilityAudit: "", snapshot: "" },
    rows: [],
    summary: { ...summaryDefaults, ...input },
    impactSummary: { rows: 0, averageProjectedPointDelta: null, medianProjectedPointDelta: null, maxProjectedPointDelta: null, movementBuckets: {}, positionSummary: [], cohortSummary: [], topMovements: [] },
    currentPathProtectionSummary: { eligible_for_flag_candidate: 0, critical_movement_protected: 0, kicker_policy_protected: 0, tier_review_protected: 0, qb_superflex_protected: 0, injury_role_protected: 0, model_policy_protected: 0, shadow_only: 0, blocked_legacy: 0, blocked_other: 0, manual_review_remaining: 0, unresolved_tier_decision: 0, missing_readiness_row: 0 },
    safetyGates: [],
    recommendation: "ready_for_disabled_feature_flag_scaffold",
    notes: [],
  };
}

function pipelinePreview(input: Partial<{
  disabled: ProjectionSelectorPipelinePreviewSummary;
  enabled: ProjectionSelectorPipelinePreviewSummary;
  missing: ProjectionSelectorPipelinePreviewSummary;
  recommendation: ProjectionSelectorPipelinePreviewReport["recommendation"];
}> = {}): ProjectionSelectorPipelinePreviewReport {
  return {
    generatedAt: "",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    sourceArtifacts: { snapshot: "", readiness: "", selectorPreview: "", shadow: "" },
    disabledMode: { rows: [], summary: input.disabled ?? summary({ currentPathRows: 4, v82Rows: 0 }) },
    enabledMode: { rows: [], summary: input.enabled ?? summary({ currentPathRows: 1, v82Rows: 3 }) },
    missingArtifactsMode: { summary: input.missing ?? summary({ currentPathRows: 4, v82Rows: 0 }) },
    expectedReadinessCounts: { wouldUseV82UnderFlag: 3, wouldUseCurrentPathUnderFlag: 1, excludedFromFlagPool: 0, blockedFromFlagPool: 0 },
    expectedSelectorPreviewCounts: { v82Rows: 3, currentPathRows: 1, excludedRows: 0, blockedRows: 0 },
    mismatches: [],
    protectedRowViolations: [],
    safetyGates: [],
    recommendation: input.recommendation ?? "pipeline_selector_preview_clean",
    notes: [],
  };
}

function selectorPreview(pipeline: ProjectionSelectorPipelinePreviewReport): ProjectionV82FeatureFlagPreviewReport {
  return {
    generatedAt: "",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    sourceArtifacts: { readiness: "", shadow: "", snapshot: "" },
    disabledMode: { rows: [], summary: selectorSummary(pipeline.disabledMode.summary) },
    enabledMode: {
      rows: [],
      summary: selectorSummary(pipeline.enabledMode.summary),
      expectedReadinessSummary: {
        wouldUseV82UnderFlag: pipeline.enabledMode.summary.v82Rows,
        wouldUseCurrentPathUnderFlag: pipeline.enabledMode.summary.currentPathRows,
        excludedFromFlagPool: pipeline.enabledMode.summary.excludedRows,
        blockedFromFlagPool: pipeline.enabledMode.summary.blockedRows,
        kRowsUsingV82: pipeline.enabledMode.summary.kRowsUsingV82,
        criticalMovementRowsUsingV82: pipeline.enabledMode.summary.criticalMovementRowsUsingV82,
        meaningfulRankMoversUsingV82: pipeline.enabledMode.summary.meaningfulRankMoversUsingV82,
        legacyRowsUsingV82: pipeline.enabledMode.summary.legacyRowsUsingV82,
      },
    },
    missingArtifactsMode: { summary: selectorSummary(pipeline.missingArtifactsMode.summary) },
    mismatches: [],
    protectedRowViolations: [],
    safetyGates: [],
    recommendation: "selector_preview_clean",
    notes: [],
  };
}

function summary(input: Partial<ProjectionSelectorPipelinePreviewSummary> = {}): ProjectionSelectorPipelinePreviewSummary {
  return {
    rowsEvaluated: input.rowsEvaluated ?? 4,
    currentPathRows: input.currentPathRows ?? 1,
    v82Rows: input.v82Rows ?? 3,
    excludedRows: input.excludedRows ?? 0,
    blockedRows: input.blockedRows ?? 0,
    projectionTotalMismatchesVsCurrent: input.projectionTotalMismatchesVsCurrent ?? 0,
    maxProjectionDeltaVsCurrent: input.maxProjectionDeltaVsCurrent ?? 0,
    rankingAffectingOutputDeltaRows: input.rankingAffectingOutputDeltaRows ?? 0,
    protectedRowViolations: input.protectedRowViolations ?? 0,
    mismatchesWithSelectorPreview: input.mismatchesWithSelectorPreview ?? 0,
    mismatchesWithReadiness: input.mismatchesWithReadiness ?? 0,
    kRowsUsingV82: input.kRowsUsingV82 ?? 0,
    criticalMovementRowsUsingV82: input.criticalMovementRowsUsingV82 ?? 0,
    meaningfulRankMoversUsingV82: input.meaningfulRankMoversUsingV82 ?? 0,
    legacyRowsUsingV82: input.legacyRowsUsingV82 ?? 0,
    movementBuckets: input.movementBuckets ?? {},
    positionSummaries: input.positionSummaries ?? [],
    cohortSummaries: input.cohortSummaries ?? [],
  };
}

function selectorSummary(input: ProjectionSelectorPipelinePreviewSummary): ProjectionV82FeatureFlagPreviewSummary {
  return {
    totalRows: input.rowsEvaluated,
    currentPathRows: input.currentPathRows,
    v82Rows: input.v82Rows,
    excludedRows: input.excludedRows,
    blockedRows: input.blockedRows,
    kRowsUsingV82: input.kRowsUsingV82,
    criticalMovementRowsUsingV82: input.criticalMovementRowsUsingV82,
    meaningfulRankMoversUsingV82: input.meaningfulRankMoversUsingV82,
    legacyRowsUsingV82: input.legacyRowsUsingV82,
    mismatches: 0,
    protectedRowViolations: input.protectedRowViolations,
  };
}
