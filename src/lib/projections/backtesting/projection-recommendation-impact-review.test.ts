import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildProjectionRecommendationImpactReviewFromData,
  writeProjectionRecommendationImpactReviewArtifacts,
} from "./projection-recommendation-impact-review";

import type { ProjectionRecommendationDraftSuggestionRow } from "./projection-recommendation-impact-review-types";
import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewRow, ProjectionSelectorPipelinePreviewSummary } from "./projection-selector-pipeline-preview-types";
import type { ProjectionV82FeatureFlagProtectionReason, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

let tempCwd: string | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  if (tempCwd) {
    rmSync(tempCwd, { recursive: true, force: true });
    tempCwd = null;
  }
});

describe("projection recommendation impact review", () => {
  it("generates a dry-run report from existing shadow artifacts without live wiring", () => {
    const report = buildProjectionRecommendationImpactReviewFromData(input());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.summary.totalRowsEvaluated).toBe(5);
    expect(report.summary.v82CandidateRows).toBe(2);
    expect(report.summary.currentPathProtectedRows).toBe(1);
    expect(report.summary.excludedRows).toBe(1);
    expect(report.summary.blockedRows).toBe(1);
    expect(gate(report, "no_live_outputs_changed")?.passed).toBe(true);
    expect(gate(report, "rankings_unchanged_by_default")?.passed).toBe(true);
    expect(gate(report, "draft_suggestions_unchanged_by_default")?.passed).toBe(true);
    expect(gate(report, "war_room_unchanged_by_default")?.passed).toBe(true);
  });

  it("filters to the safe v8.2 subset and preserves protected rows", () => {
    const report = buildProjectionRecommendationImpactReviewFromData(input());

    expect(report.summary.topProjectedPointMovers.map((row) => row.playerId)).toEqual(["safe-wr", "safe-qb"]);
    expect(report.protectedRowChecks).toEqual({
      kRowsDoNotUseV82: true,
      criticalMovementRowsDoNotUseV82: true,
      meaningfulRankMoversDoNotUseV82: true,
      legacyStaleRowsDoNotUseV82: true,
      missingArtifactsFailClosed: true,
    });
    expect(gate(report, "safe_subset_only")?.passed).toBe(true);
    expect(gate(report, "protected_rows_preserved")?.passed).toBe(true);
  });

  it("builds projection movement and rank movement buckets", () => {
    const report = buildProjectionRecommendationImpactReviewFromData(input());

    expect(report.summary.movementBuckets["20+"]).toBe(1);
    expect(report.summary.movementBuckets["5-10"]).toBe(1);
    expect(report.blackbirdRankImpact.overallRankMovementBuckets.find((row) => row.bucket === "26-50")?.rows).toBe(1);
    expect(report.blackbirdRankImpact.positionRankMovementBuckets.find((row) => row.bucket === "6-10")?.rows).toBe(1);
    expect(report.blackbirdRankImpact.qbSuperflexSensitiveMovement[0]?.playerId).toBe("safe-qb");
    expect(report.blackbirdRankImpact.starterTierMovement.some((row) => row.playerId === "safe-qb")).toBe(true);
  });

  it("reports top rank risers/fallers and top 300 affected rows", () => {
    const report = buildProjectionRecommendationImpactReviewFromData(input());

    expect(report.blackbirdRankImpact.estimateMethod).toBe("shadow_rank_fields");
    expect(report.blackbirdRankImpact.rowsWithRankEstimate).toBe(2);
    expect(report.blackbirdRankImpact.topOverallRankRisers[0]).toMatchObject({ playerId: "safe-qb", estimatedOverallRankMovement: -30 });
    expect(report.blackbirdRankImpact.topPositionRankRisers[0]).toMatchObject({ playerId: "safe-qb", estimatedPositionRankMovement: -6 });
    expect(report.blackbirdRankImpact.top300AffectedRows.map((row) => row.playerId)).toContain("safe-qb");
  });

  it("estimates draft suggestion overlap without mutating baseline ordering", () => {
    const draftRows = draftSuggestionRows();
    const before = JSON.stringify(draftRows);
    const report = buildProjectionRecommendationImpactReviewFromData(input({ draftSuggestionRows: draftRows }));

    expect(JSON.stringify(draftRows)).toBe(before);
    expect(report.draftSuggestionImpact.estimateMethod).toBe("artifact_proxy");
    expect(report.draftSuggestionImpact.topSuggestionChanged).toBe(true);
    expect(report.draftSuggestionImpact.top5SuggestionOverlap).toBe(5);
    expect(report.draftSuggestionImpact.top10SuggestionOverlap).toBe(10);
    expect(report.draftSuggestionImpact.largestSuggestionRankRisers[0]).toMatchObject({ player: "Safe WR" });
    expect(report.draftSuggestionImpact.protectedRowsRemainedCurrentPath).toBe(true);
  });

  it("falls back to a projected-point proxy when exact rank fields are unavailable", () => {
    const report = buildProjectionRecommendationImpactReviewFromData(input({ shadowRows: [] }));

    expect(report.blackbirdRankImpact.estimateMethod).toBe("projected_point_delta_proxy");
    expect(report.blackbirdRankImpact.limitation).toContain("Exact Blackbird Rank recalculation is not available");
    expect(gate(report, "rank_impact_estimated_or_explained")?.passed).toBe(true);
  });

  it("blocks when a protected row would use v8.2", () => {
    const unsafe = input({
      enabledRows: [
        row({ playerId: "unsafe-k", player: "Unsafe K", position: "K", selectorSelection: "v8_2_candidate_path", delta: 12 }),
      ],
      enabledSummary: summary({ rowsEvaluated: 1, v82Rows: 1, rankingAffectingOutputDeltaRows: 1, kRowsUsingV82: 1 }),
      readinessRows: [readiness("unsafe-k", "Unsafe K", "K", "would_use_v8_2_under_flag", ["kicker_policy_protected"])],
      shadowRows: [shadow("unsafe-k", "Unsafe K", "K", 12, 120, 90, 30, 12, 10, 2)],
    });
    const report = buildProjectionRecommendationImpactReviewFromData(unsafe);

    expect(report.protectedRowChecks.kRowsDoNotUseV82).toBe(false);
    expect(gate(report, "protected_rows_preserved")?.passed).toBe(false);
    expect(report.recommendation).toBe("recommendation_impact_blocked");
  });

  it("writes json, markdown, and csv artifacts", () => {
    tempCwd = mkdtempSync(path.join(tmpdir(), "h14-2-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempCwd);
    const report = buildProjectionRecommendationImpactReviewFromData(input());
    const artifacts = writeProjectionRecommendationImpactReviewArtifacts(report);

    expect(existsSync(artifacts.jsonPath)).toBe(true);
    expect(existsSync(artifacts.markdownPath)).toBe(true);
    expect(existsSync(artifacts.csvPath)).toBe(true);
    expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("Projection Recommendation Impact Review");
    expect(readFileSync(artifacts.csvPath, "utf8")).toContain("top_projected_point_mover");
  });

  it("does not import Supabase, live recommendation builders, or War Room UI", () => {
    const source = readFileSync("src/lib/projections/backtesting/projection-recommendation-impact-review.ts", "utf8");

    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("buildWarRoomRecommendations(");
    expect(source).not.toContain("draft-war-room");
    expect(source).not.toContain("h10-war-room-overlay");
    expect(gate(buildProjectionRecommendationImpactReviewFromData(input()), "no_supabase_writes")?.passed).toBe(true);
  });
});

function input(overrides: Partial<Parameters<typeof buildProjectionRecommendationImpactReviewFromData>[0]> & {
  enabledRows?: ProjectionSelectorPipelinePreviewRow[];
  enabledSummary?: ProjectionSelectorPipelinePreviewSummary;
} = {}): Parameters<typeof buildProjectionRecommendationImpactReviewFromData>[0] {
  const enabledRows = overrides.enabledRows ?? [
    row({ playerId: "safe-wr", player: "Safe WR", position: "WR", selectorSelection: "v8_2_candidate_path", delta: 25 }),
    row({ playerId: "safe-qb", player: "Safe QB", position: "QB", selectorSelection: "v8_2_candidate_path", delta: 8 }),
    row({ playerId: "safe-k", player: "Safe K", position: "K", selectorSelection: "current_path", delta: 0 }),
    row({ playerId: "excluded-rb", player: "Excluded RB", position: "RB", selectorSelection: "excluded_from_flag_pool", delta: null }),
    row({ playerId: "legacy-te", player: "Legacy TE", position: "TE", selectorSelection: "blocked_from_flag_pool", delta: null, universeEligibilityStatus: "retired_or_legacy_suspect" }),
  ];
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    productionShadowReview: overrides.productionShadowReview ?? {
      recommendation: "production_shadow_needs_review",
      selectorWiredBeyondDryRun: false,
      missingArtifactsMode: { v82Rows: 0, currentPathRows: enabledRows.length },
    },
    pipelinePreview: pipelinePreview(enabledRows, overrides.enabledSummary ?? summary({ rowsEvaluated: 5, currentPathRows: 1, v82Rows: 2, excludedRows: 1, blockedRows: 1, rankingAffectingOutputDeltaRows: 2 })),
    readinessRows: overrides.readinessRows ?? readinessRows(),
    shadowRows: overrides.shadowRows ?? [
      shadow("safe-wr", "Safe WR", "WR", 25, 80, 60, 20, 30, 25, 5),
      shadow("safe-qb", "Safe QB", "QB", 8, 90, 60, 30, 18, 12, 6),
    ],
    draftSuggestionRows: overrides.draftSuggestionRows,
    sourceArtifacts: overrides.sourceArtifacts,
  };
}

function pipelinePreview(rows: ProjectionSelectorPipelinePreviewRow[], enabledSummary: ProjectionSelectorPipelinePreviewSummary): ProjectionSelectorPipelinePreviewReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    sourceArtifacts: { snapshot: "", readiness: "", selectorPreview: "", shadow: "" },
    disabledMode: { rows: [], summary: summary({ rowsEvaluated: rows.length, currentPathRows: rows.length }) },
    enabledMode: { rows, summary: enabledSummary },
    missingArtifactsMode: { summary: summary({ rowsEvaluated: rows.length, currentPathRows: rows.length }) },
    expectedReadinessCounts: { wouldUseV82UnderFlag: 2, wouldUseCurrentPathUnderFlag: 1, excludedFromFlagPool: 1, blockedFromFlagPool: 1 },
    expectedSelectorPreviewCounts: { v82Rows: 2, currentPathRows: 1, excludedRows: 1, blockedRows: 1 },
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
  delta: number | null;
  universeEligibilityStatus?: string | null;
}): ProjectionSelectorPipelinePreviewRow {
  return {
    playerId: input.playerId,
    player: input.player,
    position: input.position,
    team: "TST",
    mode: "enabled",
    readinessStatus: input.selectorSelection,
    selectorSelection: input.selectorSelection,
    selectorReason: input.selectorSelection === "v8_2_candidate_path" ? "eligible_safe_candidate" : "excluded_or_blocked",
    expectedGamesModel: input.selectorSelection === "v8_2_candidate_path" ? "blackbird_expected_games_v8_2_high_impact_guardrail" : input.selectorSelection === "current_path" ? "current" : null,
    currentExpectedGames: 10,
    selectedExpectedGames: input.selectorSelection === "v8_2_candidate_path" ? 12 : input.selectorSelection === "current_path" ? 10 : null,
    v82ExpectedGames: 12,
    currentProjectedTotal: 100,
    selectedProjectedTotal: input.delta === null ? null : 100 + input.delta,
    v82ProjectedTotal: input.delta === null ? null : 100 + input.delta,
    projectedTotalDeltaVsCurrent: input.delta,
    movementBucket: "5-10",
    gamesBucket: "2-4",
    cohorts: [`${input.position.toLowerCase()}_cohort`],
    criticalMovement: false,
    meaningfulRankMover: false,
    universeEligibilityStatus: input.universeEligibilityStatus ?? null,
    mismatchWithSelectorPreview: false,
    mismatchWithReadiness: false,
    projectionTotalMismatchVsCurrent: false,
    protectedRowViolation: false,
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
    readiness("safe-wr", "Safe WR", "WR", "would_use_v8_2_under_flag", []),
    readiness("safe-qb", "Safe QB", "QB", "would_use_v8_2_under_flag", []),
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
  protectionReasons: ProjectionV82FeatureFlagProtectionReason[],
  universeEligibilityStatus: ProjectionV82FeatureFlagReadinessRow["universeEligibilityStatus"] = null,
): ProjectionV82FeatureFlagReadinessRow {
  return {
    playerId,
    player,
    position,
    team: "TST",
    status,
    protectionReasons,
    universeEligibilityStatus,
    finalClassification: null,
    currentExpectedGames: 10,
    v82ExpectedGames: 12,
    gamesDelta: 2,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 110,
    projectedPointDelta: 10,
    movementBucket: "5-10",
    criticalMovement: false,
    meaningfulRankMover: false,
    riskFlags: [],
    reasonCodes: [],
  };
}

function shadow(
  playerId: string,
  player: string,
  position: string,
  pointDelta: number,
  currentOverallRank: number,
  shadowOverallRank: number,
  overallMove: number,
  currentPositionRank: number,
  shadowPositionRank: number,
  positionMove: number,
): ProjectionV82ShadowRow {
  return {
    playerId,
    sleeperId: null,
    gsisId: null,
    player,
    position,
    team: "TST",
    cohorts: [`${position.toLowerCase()}_cohort`],
    currentExpectedGames: 10,
    v82ExpectedGames: 12,
    expectedGamesDelta: 2,
    ppgAnchor: 10,
    projectedTotalPointDelta: pointDelta,
    currentProjectedTotal: 100,
    shadowProjectedTotal: 100 + pointDelta,
    movementBucket: pointDelta >= 20 ? "20+" : "5-10",
    gamesBucket: "2-4",
    risk: "low",
    riskFlags: [],
    reasonCodes: [],
    guardrailApplied: false,
    currentOverallRank,
    shadowOverallRank,
    estimatedOverallRankMovement: -overallMove,
    currentPositionRank,
    shadowPositionRank,
    estimatedPositionRankMovement: -positionMove,
    criticalReviewStatus: "safe_shadow_difference",
  };
}

function draftSuggestionRows(): ProjectionRecommendationDraftSuggestionRow[] {
  return [
    suggestion("Baseline One", "RB", 1, 100),
    suggestion("Safe WR", "WR", 2, 99),
    suggestion("Safe QB", "QB", 3, 98),
    suggestion("Baseline Four", "TE", 4, 97),
    suggestion("Baseline Five", "LB", 5, 96),
    suggestion("Baseline Six", "DB", 6, 95),
    suggestion("Baseline Seven", "DB", 7, 94),
    suggestion("Baseline Eight", "DB", 8, 93),
    suggestion("Baseline Nine", "DB", 9, 92),
    suggestion("Baseline Ten", "DB", 10, 91),
  ];
}

function suggestion(player: string, position: string, rank: number, score: number): ProjectionRecommendationDraftSuggestionRow {
  return {
    playerId: null,
    player,
    position,
    team: "TST",
    baselineRank: rank,
    estimatedRank: rank,
    baselineScore: score,
    estimatedScore: score,
    projectedPointDelta: 0,
  };
}

function gate(report: ReturnType<typeof buildProjectionRecommendationImpactReviewFromData>, name: string) {
  return report.safetyGates.find((item) => item.name === name);
}
