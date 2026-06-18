import { existsSync, readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionSelectorPipelinePreviewFromData,
  writeProjectionSelectorPipelinePreviewArtifacts,
} from "./projection-selector-pipeline-preview";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionV82FeatureFlagPreviewReport, ProjectionV82FeatureFlagPreviewRow } from "./projection-v8-2-feature-flag-preview-types";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection selector pipeline preview", () => {
  it("disabled mode selects current path only and matches current outputs", () => {
    const report = buildReport([
      readinessRow("eligible", "would_use_v8_2_under_flag"),
      readinessRow("current", "would_use_current_path_under_flag"),
      readinessRow("excluded", "excluded_from_flag_pool"),
      readinessRow("blocked", "blocked_from_flag_pool"),
    ]);

    expect(report.disabledMode.summary).toMatchObject({
      rowsEvaluated: 4,
      currentPathRows: 4,
      v82Rows: 0,
      excludedRows: 0,
      blockedRows: 0,
      projectionTotalMismatchesVsCurrent: 0,
      maxProjectionDeltaVsCurrent: 0,
      rankingAffectingOutputDeltaRows: 0,
    });
  });

  it("enabled mode selection counts match readiness and selector preview", () => {
    const report = buildReport([
      readinessRow("eligible-a", "would_use_v8_2_under_flag"),
      readinessRow("eligible-b", "would_use_v8_2_under_flag"),
      readinessRow("current", "would_use_current_path_under_flag"),
      readinessRow("excluded", "excluded_from_flag_pool"),
      readinessRow("blocked", "blocked_from_flag_pool"),
    ]);

    expect(report.enabledMode.summary).toMatchObject({
      v82Rows: 2,
      currentPathRows: 1,
      excludedRows: 1,
      blockedRows: 1,
      mismatchesWithReadiness: 0,
      mismatchesWithSelectorPreview: 0,
      protectedRowViolations: 0,
    });
    expect(report.expectedReadinessCounts).toMatchObject({ wouldUseV82UnderFlag: 2, wouldUseCurrentPathUnderFlag: 1 });
    expect(report.expectedSelectorPreviewCounts).toMatchObject({ v82Rows: 2, currentPathRows: 1 });
    expect(report.recommendation).toBe("pipeline_selector_preview_clean");
  });

  it("keeps protected rows off v8.2", () => {
    const report = buildReport([
      readinessRow("bad-k", "would_use_v8_2_under_flag", { position: "K" }),
      readinessRow("bad-critical", "would_use_v8_2_under_flag", { criticalMovement: true }),
      readinessRow("bad-rank", "would_use_v8_2_under_flag", { meaningfulRankMover: true }),
    ]);

    expect(report.enabledMode.summary.v82Rows).toBe(0);
    expect(report.enabledMode.summary.kRowsUsingV82).toBe(0);
    expect(report.enabledMode.summary.criticalMovementRowsUsingV82).toBe(0);
    expect(report.enabledMode.summary.meaningfulRankMoversUsingV82).toBe(0);
    expect(report.protectedRowViolations).toEqual([]);
    expect(report.recommendation).toBe("pipeline_selector_preview_mismatch");
  });

  it("missing artifacts fail closed", () => {
    const report = buildReport([
      readinessRow("eligible-a", "would_use_v8_2_under_flag"),
      readinessRow("eligible-b", "would_use_v8_2_under_flag"),
    ]);

    expect(report.missingArtifactsMode.summary.v82Rows).toBe(0);
    expect(report.missingArtifactsMode.summary.currentPathRows).toBe(2);
    expect(report.safetyGates.find((gate) => gate.name === "missing_artifacts_fail_closed")?.passed).toBe(true);
  });

  it("summarizes projection deltas for enabled v8.2 rows", () => {
    const report = buildReport([
      readinessRow("eligible-a", "would_use_v8_2_under_flag", { currentProjectedTotal: 100, v82ProjectedTotal: 112, projectedPointDelta: 12, movementBucket: "10-20" }),
      readinessRow("eligible-b", "would_use_v8_2_under_flag", { currentProjectedTotal: 100, v82ProjectedTotal: 100, projectedPointDelta: 0, movementBucket: "0" }),
    ]);

    expect(report.enabledMode.summary.maxProjectionDeltaVsCurrent).toBe(12);
    expect(report.enabledMode.summary.rankingAffectingOutputDeltaRows).toBe(1);
    expect(report.enabledMode.summary.movementBuckets["10-20"]).toBe(1);
    expect(report.enabledMode.summary.positionSummaries.find((row) => row.segment === "RB")?.rowsMoving10Plus).toBe(1);
  });

  it("writes preview artifacts", () => {
    const report = buildReport([readinessRow("eligible", "would_use_v8_2_under_flag")], 2098);
    const artifacts = writeProjectionSelectorPipelinePreviewArtifacts(report);
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
    const source = readFileSync("src/lib/projections/backtesting/projection-selector-pipeline-preview.ts", "utf8");

    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("blackbird-league-rank");
    expect(source).not.toContain("live-draft-suggestion");
    expect(source).not.toContain("draft-war-room");
    expect(source).not.toContain("src/components");
  });
});

function buildReport(rows: ProjectionV82FeatureFlagReadinessRow[], projectionSeason = 2026) {
  return buildProjectionSelectorPipelinePreviewFromData({
    options: { projectionSeason, includeIdp: true },
    snapshot: snapshot(projectionSeason),
    readiness: readinessReport(rows, projectionSeason),
    selectorPreview: selectorPreviewReport(rows, projectionSeason),
    shadow: shadowReport(rows, projectionSeason),
  });
}

function readinessRow(
  playerId: string,
  status: ProjectionV82FeatureFlagReadinessRow["status"],
  overrides: Partial<ProjectionV82FeatureFlagReadinessRow> = {},
): ProjectionV82FeatureFlagReadinessRow {
  return {
    playerId,
    player: playerId,
    position: "RB",
    team: "TST",
    status,
    protectionReasons: status === "would_use_v8_2_under_flag" ? ["eligible_for_flag_candidate"] : [],
    universeEligibilityStatus: "active_plausible",
    finalClassification: status === "blocked_from_flag_pool" ? "blocked_from_promotion" : status === "excluded_from_flag_pool" ? "shadow_only" : "eligible_for_projection_promotion",
    currentExpectedGames: 10,
    v82ExpectedGames: 11,
    gamesDelta: 1,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 105,
    projectedPointDelta: 5,
    movementBucket: "5-10",
    criticalMovement: false,
    meaningfulRankMover: false,
    riskFlags: [],
    reasonCodes: [],
    ...overrides,
  };
}

function readinessReport(rows: ProjectionV82FeatureFlagReadinessRow[], projectionSeason: number): ProjectionV82FeatureFlagReadinessReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason,
    includeIdp: true,
    sourceArtifacts: { finalReadiness: "", conservativePromotionDecisions: "", conservativeTierDecisions: "", resolvedTierDecisions: "", tierReview: "", limitedPromotionPoolReview: "", shadow: "", universeEligibilityAudit: "", snapshot: "" },
    rows,
    summary: {
      totalRows: rows.length,
      wouldUseV82UnderFlag: rows.filter((entry) => entry.status === "would_use_v8_2_under_flag").length,
      wouldUseCurrentPathUnderFlag: rows.filter((entry) => entry.status === "would_use_current_path_under_flag").length,
      excludedFromFlagPool: rows.filter((entry) => entry.status === "excluded_from_flag_pool").length,
      blockedFromFlagPool: rows.filter((entry) => entry.status === "blocked_from_flag_pool").length,
      manualReviewRowsRemaining: 0,
      unresolvedRowsRemaining: 0,
      kRowsUsingV82: 0,
      criticalMovementRowsUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
    },
    impactSummary: { rows: 0, averageProjectedPointDelta: null, medianProjectedPointDelta: null, maxProjectedPointDelta: null, movementBuckets: {}, positionSummary: [], cohortSummary: [], topMovements: [] },
    currentPathProtectionSummary: { eligible_for_flag_candidate: 0, critical_movement_protected: 0, kicker_policy_protected: 0, tier_review_protected: 0, qb_superflex_protected: 0, injury_role_protected: 0, model_policy_protected: 0, shadow_only: 0, blocked_legacy: 0, blocked_other: 0, manual_review_remaining: 0, unresolved_tier_decision: 0, missing_readiness_row: 0 },
    safetyGates: [],
    recommendation: "ready_for_disabled_feature_flag_scaffold",
    notes: [],
  };
}

function selectorPreviewReport(rows: ProjectionV82FeatureFlagReadinessRow[], projectionSeason: number): ProjectionV82FeatureFlagPreviewReport {
  const disabledRows = rows.map((row) => selectorRow(row, "disabled", "current_path"));
  const enabledRows = rows.map((row) => selectorRow(row, "enabled", expectedSelection(row)));
  const enabledSummary = summary(enabledRows);
  return {
    generatedAt: "",
    dryRun: true,
    readOnly: true,
    projectionSeason,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    sourceArtifacts: { readiness: "", shadow: "", snapshot: "" },
    disabledMode: { rows: disabledRows, summary: summary(disabledRows) },
    enabledMode: {
      rows: enabledRows,
      summary: enabledSummary,
      expectedReadinessSummary: {
        wouldUseV82UnderFlag: enabledSummary.v82Rows,
        wouldUseCurrentPathUnderFlag: enabledSummary.currentPathRows,
        excludedFromFlagPool: enabledSummary.excludedRows,
        blockedFromFlagPool: enabledSummary.blockedRows,
        kRowsUsingV82: 0,
        criticalMovementRowsUsingV82: 0,
        meaningfulRankMoversUsingV82: 0,
        legacyRowsUsingV82: 0,
      },
    },
    missingArtifactsMode: { summary: summary(disabledRows) },
    mismatches: [],
    protectedRowViolations: [],
    safetyGates: [],
    recommendation: "selector_preview_clean",
    notes: [],
  };
}

function selectorRow(row: ProjectionV82FeatureFlagReadinessRow, mode: "disabled" | "enabled", selection: ProjectionV82FeatureFlagPreviewRow["selectorSelection"]): ProjectionV82FeatureFlagPreviewRow {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    status: row.status,
    universeEligibilityStatus: row.universeEligibilityStatus,
    criticalMovement: row.criticalMovement,
    meaningfulRankMover: row.meaningfulRankMover,
    projectedPointDelta: row.projectedPointDelta,
    movementBucket: row.movementBucket,
    mode,
    selectorSelection: selection,
    selectorReason: selection === "v8_2_candidate_path" ? "eligible_safe_candidate" : "current_path_protected",
    readinessExpectedSelection: selection,
    mismatch: false,
    violation: false,
  };
}

function expectedSelection(row: ProjectionV82FeatureFlagReadinessRow): ProjectionV82FeatureFlagPreviewRow["selectorSelection"] {
  if (row.position === "K" || row.criticalMovement || row.meaningfulRankMover) return "current_path";
  if (row.status === "would_use_v8_2_under_flag") return "v8_2_candidate_path";
  if (row.status === "would_use_current_path_under_flag") return "current_path";
  return row.status;
}

function summary(rows: ProjectionV82FeatureFlagPreviewRow[]) {
  return {
    totalRows: rows.length,
    currentPathRows: rows.filter((row) => row.selectorSelection === "current_path").length,
    v82Rows: rows.filter((row) => row.selectorSelection === "v8_2_candidate_path").length,
    excludedRows: rows.filter((row) => row.selectorSelection === "excluded_from_flag_pool").length,
    blockedRows: rows.filter((row) => row.selectorSelection === "blocked_from_flag_pool").length,
    kRowsUsingV82: 0,
    criticalMovementRowsUsingV82: 0,
    meaningfulRankMoversUsingV82: 0,
    legacyRowsUsingV82: 0,
    mismatches: 0,
    protectedRowViolations: 0,
  };
}

function shadowReport(rows: ProjectionV82FeatureFlagReadinessRow[], projectionSeason: number): ProjectionV82ShadowReport {
  const shadowRows = rows.map((row) => shadowRow(row));
  return {
    generatedAt: "",
    dryRun: true,
    readOnly: true,
    projectionSeason,
    includeIdp: true,
    currentModel: "blackbird_expected_games_v7_family_selective",
    shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail",
    sourceArtifacts: { snapshot: "" },
    rowCoverage: { currentLiveProjectionRows: rows.length, v82ShadowRows: rows.length, sharedRows: rows.length, currentOnlyRows: 0, v82OnlyRows: 0, rowsSkipped: 0, skipReasons: {}, positionCounts: {}, cohortCounts: {} },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [],
    cohortMovementSummary: [],
    rows: shadowRows,
    topMovements: shadowRows,
    criticalMovements: [],
    rankingRiskPreview: { estimated: true, reason: "", rowsWithEstimatedOverallRankMovement: 0, rowsWithEstimatedPositionRankMovement: 0, topOverallRankMovements: [], topPositionRankMovements: [] },
    safetyGates: [],
    recommendation: "shadow_candidate_with_manual_review",
    notes: [],
  };
}

function shadowRow(row: ProjectionV82FeatureFlagReadinessRow): ProjectionV82ShadowRow {
  return {
    playerId: row.playerId,
    sleeperId: row.playerId,
    gsisId: null,
    player: row.player,
    position: row.position,
    team: row.team,
    cohorts: row.position === "K" ? ["kicker"] : ["offense"],
    currentExpectedGames: row.currentExpectedGames ?? 10,
    v82ExpectedGames: row.v82ExpectedGames ?? 11,
    expectedGamesDelta: row.gamesDelta ?? 1,
    ppgAnchor: 10,
    projectedTotalPointDelta: row.projectedPointDelta ?? 5,
    currentProjectedTotal: row.currentProjectedTotal ?? 100,
    shadowProjectedTotal: row.v82ProjectedTotal ?? 105,
    movementBucket: "5-10",
    gamesBucket: "0.5-1",
    risk: "moderate",
    riskFlags: [],
    reasonCodes: [],
    guardrailApplied: false,
    currentOverallRank: null,
    shadowOverallRank: null,
    estimatedOverallRankMovement: null,
    currentPositionRank: null,
    shadowPositionRank: null,
    estimatedPositionRankMovement: null,
    criticalReviewStatus: null,
  };
}

function snapshot(projectionSeason: number): PreseasonProjectionSnapshot {
  return {
    metadata: { artifactType: "blackbird_preseason_projection_snapshot", projectionSeason, targetSeason: projectionSeason, inputSeasons: [], excludedSeasons: [projectionSeason], leakageSafe: true, createdForBacktesting: true, modelVersion: "preseason_snapshot_v2", defaultUniverse: "all", scoringSource: "default", scoringProfile: "test", notes: [] },
    rows: [],
    diagnostics: { playersConsidered: 0, playersProjected: 0, playersSkipped: 0, playersSkippedNoSignal: 0, universe: "all", variantCounts: {}, cohortCounts: {}, noPriorTypeCounts: {}, noPriorCount: 0, idpCount: 0, averageProjectedGames: null, averageProjectedPpgByPosition: {}, confidenceDistribution: {}, warningsByType: {}, leakageSafety: { passed: true, targetSeasonExcludedFromInputs: true, noPostTargetProjectionArtifactsUsed: true, notes: [] } },
  };
}
