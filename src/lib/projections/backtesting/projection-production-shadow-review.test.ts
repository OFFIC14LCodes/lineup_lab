import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildProjectionProductionShadowReviewFromData } from "./projection-production-shadow-review";

import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewRow, ProjectionSelectorPipelinePreviewSummary } from "./projection-selector-pipeline-preview-types";
import type { ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection production shadow review", () => {
  it("generates a production path audit and keeps selector simulated-only", () => {
    const report = buildProjectionProductionShadowReviewFromData(input());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.selectorWiredBeyondDryRun).toBe(false);
    expect(report.productionPathAudit.length).toBeGreaterThan(5);
    expect(report.productionPathAudit.some((row) => row.file.includes("combined-projection-read-model"))).toBe(true);
    expect(report.productionPathAudit.some((row) => row.writesToSupabase && !row.safeToShadow)).toBe(true);
  });

  it("proves disabled-mode production equivalence and default inputs unchanged", () => {
    const report = buildProjectionProductionShadowReviewFromData(input());

    expect(report.disabledModeEquivalence.currentPathRows).toBe(4);
    expect(report.disabledModeEquivalence.v82Rows).toBe(0);
    expect(report.disabledModeEquivalence.projectionTotalMismatchesVsCurrent).toBe(0);
    expect(report.disabledModeEquivalence.rankingAffectingOutputDeltaRows).toBe(0);
    expect(gate(report, "disabled_mode_current_path_only")?.passed).toBe(true);
    expect(gate(report, "disabled_mode_projection_equivalent")?.passed).toBe(true);
    expect(gate(report, "rankings_unchanged_by_default")?.passed).toBe(true);
    expect(gate(report, "draft_suggestions_unchanged_by_default")?.passed).toBe(true);
    expect(gate(report, "war_room_unchanged_by_default")?.passed).toBe(true);
  });

  it("summarizes enabled-mode shadow safe subset and protects unsafe rows", () => {
    const report = buildProjectionProductionShadowReviewFromData(input());

    expect(report.summary.v82ShadowRows).toBe(1);
    expect(report.summary.currentPathRows).toBe(1);
    expect(report.summary.excludedRows).toBe(1);
    expect(report.summary.blockedRows).toBe(1);
    expect(report.summary.kRowsUsingV82).toBe(0);
    expect(report.summary.criticalMoversUsingV82).toBe(0);
    expect(report.summary.meaningfulRankMoversUsingV82).toBe(0);
    expect(report.summary.legacyRowsUsingV82).toBe(0);
    expect(gate(report, "enabled_shadow_matches_safe_subset")?.passed).toBe(true);
    expect(gate(report, "k_rows_protected")?.passed).toBe(true);
    expect(gate(report, "critical_movers_protected")?.passed).toBe(true);
    expect(gate(report, "meaningful_rank_movers_protected")?.passed).toBe(true);
    expect(gate(report, "legacy_rows_blocked")?.passed).toBe(true);
  });

  it("fails closed when artifacts are missing and generates impact previews", () => {
    const report = buildProjectionProductionShadowReviewFromData(input());

    expect(report.summary.missingArtifactFallbackRows).toBe(4);
    expect(report.missingArtifactsMode.v82Rows).toBe(0);
    expect(gate(report, "missing_artifacts_fail_closed")?.passed).toBe(true);
    expect(gate(report, "impact_preview_generated")?.passed).toBe(true);
    expect(report.impactPreview.topProjectedPointDeltas[0]).toMatchObject({ playerId: "safe-wr", projectedTotalDeltaVsCurrent: 20 });
    expect(report.impactPreview.topEstimatedDraftSuggestionMovementRows[0]).toMatchObject({ playerId: "safe-wr" });
    expect(report.impactPreview.rowsWhereCurrentPathPreservedDueToProtectionPolicy.some((row) => row.playerId === "safe-k")).toBe(true);
  });

  it("reports needs-review when shadow rank movement is present", () => {
    const report = buildProjectionProductionShadowReviewFromData(input());

    expect(report.recommendation).toBe("production_shadow_needs_review");
    expect(report.impactPreview.blackbirdRankImpactEstimate).toBe("estimated_from_shadow_rank_fields");
    expect(report.impactPreview.topEstimatedBlackbirdRankMovementRows[0]).toMatchObject({ playerId: "safe-wr" });
  });

  it("does not import Supabase or live ranking/draft paths", () => {
    const source = readFileSync("src/lib/projections/backtesting/projection-production-shadow-review.ts", "utf8");

    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("buildWarRoomRecommendations(");
    expect(source).not.toContain("buildBlackbird");
    expect(source).not.toContain("draft-war-room");
    expect(gate(buildProjectionProductionShadowReviewFromData(input()), "no_supabase_writes")?.passed).toBe(true);
  });

  it("blocks the report if protected rows select v8.2", () => {
    const unsafe = input({
      enabledRows: [
        row({ playerId: "safe-k", player: "Safe K", position: "K", selectorSelection: "v8_2_candidate_path", selectorReason: "eligible_safe_candidate", expectedGamesModel: "blackbird_expected_games_v8_2_high_impact_guardrail", delta: 5, protectedRowViolation: true }),
      ],
      enabledSummary: summary({ rowsEvaluated: 1, v82Rows: 1, kRowsUsingV82: 1, rankingAffectingOutputDeltaRows: 1, maxProjectionDeltaVsCurrent: 5, protectedRowViolations: 1 }),
    });
    const report = buildProjectionProductionShadowReviewFromData(unsafe);

    expect(report.recommendation).toBe("production_shadow_blocked");
    expect(gate(report, "k_rows_protected")?.passed).toBe(false);
  });
});

function input(overrides: Partial<Parameters<typeof buildProjectionProductionShadowReviewFromData>[0]> & {
  enabledRows?: ProjectionSelectorPipelinePreviewRow[];
  enabledSummary?: ProjectionSelectorPipelinePreviewSummary;
} = {}): Parameters<typeof buildProjectionProductionShadowReviewFromData>[0] {
  const enabledRows = overrides.enabledRows ?? [
    row({ playerId: "safe-wr", player: "Safe WR", position: "WR", selectorSelection: "v8_2_candidate_path", selectorReason: "eligible_safe_candidate", expectedGamesModel: "blackbird_expected_games_v8_2_high_impact_guardrail", delta: 20 }),
    row({ playerId: "safe-k", player: "Safe K", position: "K", selectorSelection: "current_path", selectorReason: "kicker_policy_protected", expectedGamesModel: "current", delta: 0 }),
    row({ playerId: "excluded-rb", player: "Excluded RB", position: "RB", selectorSelection: "excluded_from_flag_pool", selectorReason: "excluded_or_blocked", expectedGamesModel: null, delta: null }),
    row({ playerId: "legacy-te", player: "Legacy TE", position: "TE", selectorSelection: "blocked_from_flag_pool", selectorReason: "legacy_or_stale_blocked", expectedGamesModel: null, delta: null, universeEligibilityStatus: "retired_or_legacy_suspect" }),
  ];
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    pipelinePreview: pipelinePreview({
      enabledRows,
      enabledSummary: overrides.enabledSummary ?? summary({ rowsEvaluated: 4, currentPathRows: 1, v82Rows: 1, excludedRows: 1, blockedRows: 1, rankingAffectingOutputDeltaRows: 1, maxProjectionDeltaVsCurrent: 20 }),
    }),
    readinessRows: overrides.readinessRows ?? readinessRows(),
    shadowRows: overrides.shadowRows ?? shadowRows(),
    snapshotDiffGuardRecommendation: overrides.snapshotDiffGuardRecommendation ?? "snapshot_diff_guard_clean",
    foundationHandoffRecommendation: overrides.foundationHandoffRecommendation ?? "foundation_ready_for_disabled_flag_code_review",
    sourceArtifacts: overrides.sourceArtifacts,
  };
}

function pipelinePreview(input: {
  enabledRows: ProjectionSelectorPipelinePreviewRow[];
  enabledSummary: ProjectionSelectorPipelinePreviewSummary;
}): ProjectionSelectorPipelinePreviewReport {
  const disabledRows = input.enabledRows.map((item) => ({
    ...item,
    mode: "disabled" as const,
    selectorSelection: "current_path" as const,
    selectorReason: "flag_disabled" as const,
    expectedGamesModel: "current" as const,
    selectedProjectedTotal: item.currentProjectedTotal,
    projectedTotalDeltaVsCurrent: 0,
    projectionTotalMismatchVsCurrent: false,
    protectedRowViolation: false,
  }));
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    sourceArtifacts: { snapshot: "", readiness: "", selectorPreview: "", shadow: "" },
    disabledMode: { rows: disabledRows, summary: summary({ rowsEvaluated: 4, currentPathRows: 4 }) },
    enabledMode: { rows: input.enabledRows, summary: input.enabledSummary },
    missingArtifactsMode: { summary: summary({ rowsEvaluated: 4, currentPathRows: 4 }) },
    expectedReadinessCounts: { wouldUseV82UnderFlag: 1, wouldUseCurrentPathUnderFlag: 1, excludedFromFlagPool: 1, blockedFromFlagPool: 1 },
    expectedSelectorPreviewCounts: { v82Rows: 1, currentPathRows: 1, excludedRows: 1, blockedRows: 1 },
    mismatches: [],
    protectedRowViolations: [],
    safetyGates: [],
    recommendation: "pipeline_selector_preview_clean",
    notes: [],
  };
}

function row(input: {
  playerId: string;
  player: string;
  position: string;
  selectorSelection: ProjectionSelectorPipelinePreviewRow["selectorSelection"];
  selectorReason: ProjectionSelectorPipelinePreviewRow["selectorReason"];
  expectedGamesModel: ProjectionSelectorPipelinePreviewRow["expectedGamesModel"];
  delta: number | null;
  protectedRowViolation?: boolean;
  universeEligibilityStatus?: string | null;
}): ProjectionSelectorPipelinePreviewRow {
  const current = 100;
  return {
    playerId: input.playerId,
    player: input.player,
    position: input.position,
    team: null,
    mode: "enabled",
    readinessStatus: input.selectorSelection,
    selectorSelection: input.selectorSelection,
    selectorReason: input.selectorReason,
    expectedGamesModel: input.expectedGamesModel,
    currentExpectedGames: 10,
    selectedExpectedGames: input.selectorSelection === "v8_2_candidate_path" ? 12 : input.selectorSelection === "current_path" ? 10 : null,
    v82ExpectedGames: 12,
    currentProjectedTotal: current,
    selectedProjectedTotal: input.delta === null ? null : current + input.delta,
    v82ProjectedTotal: current + 20,
    projectedTotalDeltaVsCurrent: input.delta,
    movementBucket: input.delta === null ? "unknown" : String(input.delta),
    gamesBucket: "2-4",
    cohorts: ["offense_wr"],
    criticalMovement: false,
    meaningfulRankMover: false,
    universeEligibilityStatus: input.universeEligibilityStatus ?? null,
    mismatchWithSelectorPreview: false,
    mismatchWithReadiness: false,
    projectionTotalMismatchVsCurrent: false,
    protectedRowViolation: input.protectedRowViolation ?? false,
  };
}

function summary(overrides: Partial<ProjectionSelectorPipelinePreviewSummary>): ProjectionSelectorPipelinePreviewSummary {
  return {
    rowsEvaluated: 0,
    currentPathRows: 0,
    v82Rows: 0,
    excludedRows: 0,
    blockedRows: 0,
    projectionTotalMismatchesVsCurrent: 0,
    maxProjectionDeltaVsCurrent: 0,
    rankingAffectingOutputDeltaRows: 0,
    protectedRowViolations: 0,
    mismatchesWithSelectorPreview: 0,
    mismatchesWithReadiness: 0,
    kRowsUsingV82: 0,
    criticalMovementRowsUsingV82: 0,
    meaningfulRankMoversUsingV82: 0,
    legacyRowsUsingV82: 0,
    movementBuckets: {},
    positionSummaries: [],
    cohortSummaries: [],
    ...overrides,
  };
}

function readinessRows(): ProjectionV82FeatureFlagReadinessRow[] {
  return [
    readiness("safe-wr", "Safe WR", "WR", "would_use_v8_2_under_flag", ["eligible_for_flag_candidate"]),
    readiness("safe-k", "Safe K", "K", "would_use_current_path_under_flag", ["kicker_policy_protected"]),
    readiness("excluded-rb", "Excluded RB", "RB", "excluded_from_flag_pool", ["blocked_other"]),
    readiness("legacy-te", "Legacy TE", "TE", "blocked_from_flag_pool", ["blocked_legacy"], "retired_or_legacy_suspect"),
  ];
}

function readiness(
  playerId: string,
  player: string,
  position: string,
  status: ProjectionV82FeatureFlagReadinessRow["status"],
  protectionReasons: ProjectionV82FeatureFlagReadinessRow["protectionReasons"],
  universeEligibilityStatus: ProjectionV82FeatureFlagReadinessRow["universeEligibilityStatus"] = null,
): ProjectionV82FeatureFlagReadinessRow {
  return {
    playerId,
    player,
    position,
    team: null,
    status,
    protectionReasons,
    universeEligibilityStatus,
    finalClassification: null,
    currentExpectedGames: 10,
    v82ExpectedGames: 12,
    gamesDelta: 2,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 120,
    projectedPointDelta: 20,
    movementBucket: "20+",
    criticalMovement: false,
    meaningfulRankMover: false,
    riskFlags: [],
    reasonCodes: [],
  };
}

function shadowRows(): ProjectionV82ShadowRow[] {
  return [
    {
      playerId: "safe-wr",
      sleeperId: null,
      gsisId: null,
      player: "Safe WR",
      position: "WR",
      team: null,
      cohorts: ["offense_wr"],
      currentExpectedGames: 10,
      v82ExpectedGames: 12,
      expectedGamesDelta: 2,
      ppgAnchor: 10,
      projectedTotalPointDelta: 20,
      currentProjectedTotal: 100,
      shadowProjectedTotal: 120,
      movementBucket: "20+",
      gamesBucket: "2-4",
      risk: "low",
      riskFlags: [],
      reasonCodes: [],
      guardrailApplied: false,
      currentOverallRank: 20,
      shadowOverallRank: 15,
      estimatedOverallRankMovement: -5,
      currentPositionRank: 8,
      shadowPositionRank: 5,
      estimatedPositionRankMovement: -3,
      criticalReviewStatus: "safe_shadow_difference",
    },
  ];
}

function gate(report: ReturnType<typeof buildProjectionProductionShadowReviewFromData>, name: string) {
  return report.safetyGates.find((item) => item.name === name);
}
