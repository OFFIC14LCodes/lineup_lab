import { existsSync, readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionV82FeatureFlagPreviewFromData,
  writeProjectionV82FeatureFlagPreviewArtifacts,
} from "./projection-v8-2-feature-flag-preview";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

describe("projection v8.2 feature flag preview", () => {
  it("disabled preview returns zero v8.2 rows", () => {
    const report = buildReport([
      row("eligible", "would_use_v8_2_under_flag"),
      row("current", "would_use_current_path_under_flag"),
      row("excluded", "excluded_from_flag_pool"),
      row("blocked", "blocked_from_flag_pool", { universeEligibilityStatus: "retired_or_legacy_suspect" }),
    ]);

    expect(report.disabledMode.summary.totalRows).toBe(4);
    expect(report.disabledMode.summary.v82Rows).toBe(0);
    expect(report.disabledMode.summary.currentPathRows).toBe(4);
  });

  it("enabled preview matches readiness counts", () => {
    const report = buildReport([
      row("eligible-a", "would_use_v8_2_under_flag"),
      row("eligible-b", "would_use_v8_2_under_flag"),
      row("current", "would_use_current_path_under_flag"),
      row("excluded", "excluded_from_flag_pool"),
      row("blocked", "blocked_from_flag_pool", { universeEligibilityStatus: "retired_or_legacy_suspect" }),
    ]);

    expect(report.enabledMode.summary).toMatchObject({
      v82Rows: 2,
      currentPathRows: 1,
      excludedRows: 1,
      blockedRows: 1,
      mismatches: 0,
      protectedRowViolations: 0,
    });
    expect(report.recommendation).toBe("selector_preview_clean");
  });

  it("reports selector/readiness mismatches", () => {
    const report = buildReport([
      row("bad-k", "would_use_v8_2_under_flag", { position: "K" }),
    ]);

    expect(report.enabledMode.summary.v82Rows).toBe(0);
    expect(report.enabledMode.summary.mismatches).toBe(1);
    expect(report.mismatches[0]).toMatchObject({
      playerId: "bad-k",
      readinessExpectedSelection: "v8_2_candidate_path",
      selectorSelection: "current_path",
      selectorReason: "kicker_policy_protected",
    });
    expect(report.recommendation).toBe("selector_preview_mismatch");
  });

  it("reports protected-row violation detection when a protected row selects v8.2", () => {
    const report = buildReport([
      row("unsafe", "would_use_v8_2_under_flag", { criticalMovement: true }),
    ]);

    expect(report.enabledMode.summary.v82Rows).toBe(0);
    expect(report.enabledMode.summary.criticalMovementRowsUsingV82).toBe(0);
    expect(report.protectedRowViolations).toEqual([]);
    expect(report.safetyGates.find((gate) => gate.name === "critical_movers_not_using_v8_2")?.passed).toBe(true);
  });

  it("missing artifacts fail closed", () => {
    const report = buildReport([
      row("eligible-a", "would_use_v8_2_under_flag"),
      row("eligible-b", "would_use_v8_2_under_flag"),
    ]);

    expect(report.missingArtifactsMode.summary.v82Rows).toBe(0);
    expect(report.missingArtifactsMode.summary.currentPathRows).toBe(2);
    expect(report.safetyGates.find((gate) => gate.name === "missing_artifacts_fail_closed")?.passed).toBe(true);
  });

  it("gate logic blocks protected selector violations", () => {
    const report = buildReport([
      row("legacy", "would_use_v8_2_under_flag", { universeEligibilityStatus: "retired_or_legacy_suspect" }),
    ]);

    expect(report.enabledMode.summary.legacyRowsUsingV82).toBe(0);
    expect(report.safetyGates.find((gate) => gate.name === "legacy_rows_not_using_v8_2")?.passed).toBe(true);
    expect(report.recommendation).toBe("selector_preview_mismatch");
  });

  it("writes preview artifacts", () => {
    const report = buildReport([row("eligible", "would_use_v8_2_under_flag")], 2099);
    const artifacts = writeProjectionV82FeatureFlagPreviewArtifacts(report);
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
    const source = readFileSync("src/lib/projections/backtesting/projection-v8-2-feature-flag-preview.ts", "utf8");

    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("blackbird-league-rank");
    expect(source).not.toContain("live-draft-suggestion");
    expect(source).not.toContain("draft-war-room");
    expect(source).not.toContain("src/components");
  });
});

function buildReport(rows: ProjectionV82FeatureFlagReadinessRow[], projectionSeason = 2026) {
  return buildProjectionV82FeatureFlagPreviewFromData({
    options: { projectionSeason, includeIdp: true },
    readiness: readinessReport(rows, projectionSeason),
    shadow: shadowReport(rows, projectionSeason),
    snapshot: snapshot(projectionSeason),
  });
}

function row(
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

function shadowReport(rows: ProjectionV82FeatureFlagReadinessRow[], projectionSeason: number): ProjectionV82ShadowReport {
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
    rows: [],
    topMovements: [],
    criticalMovements: [],
    rankingRiskPreview: { estimated: true, reason: "", rowsWithEstimatedOverallRankMovement: 0, rowsWithEstimatedPositionRankMovement: 0, topOverallRankMovements: [], topPositionRankMovements: [] },
    safetyGates: [],
    recommendation: "shadow_candidate_with_manual_review",
    notes: [],
  };
}

function snapshot(projectionSeason: number): PreseasonProjectionSnapshot {
  return {
    metadata: { artifactType: "blackbird_preseason_projection_snapshot", projectionSeason, targetSeason: projectionSeason, inputSeasons: [], excludedSeasons: [projectionSeason], leakageSafe: true, createdForBacktesting: true, modelVersion: "preseason_snapshot_v2", defaultUniverse: "all", scoringSource: "default", scoringProfile: "test", notes: [] },
    rows: [],
    diagnostics: { playersConsidered: 0, playersProjected: 0, playersSkipped: 0, playersSkippedNoSignal: 0, universe: "all", variantCounts: {}, cohortCounts: {}, noPriorTypeCounts: {}, noPriorCount: 0, idpCount: 0, averageProjectedGames: null, averageProjectedPpgByPosition: {}, confidenceDistribution: {}, warningsByType: {}, leakageSafety: { passed: true, targetSeasonExcludedFromInputs: true, noPostTargetProjectionArtifactsUsed: true, notes: [] } },
  };
}
