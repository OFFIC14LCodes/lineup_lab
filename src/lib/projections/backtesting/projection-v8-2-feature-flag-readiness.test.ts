import { describe, expect, it } from "vitest";

import {
  buildProjectionV82FeatureFlagReadinessFromData,
  featureFlagRow,
} from "./projection-v8-2-feature-flag-readiness";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionLimitedPromotionPoolReviewReport } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport, ProjectionPromotionReadinessFinalRow } from "./projection-promotion-readiness-final-types";
import type { ProjectionRankImpactTierDecisionReport, ProjectionRankImpactTierResolvedDecisionRow } from "./projection-rank-impact-tier-decisions-types";
import type { ProjectionRankImpactTierReviewReport, ProjectionRankImpactTierReviewRow } from "./projection-rank-impact-tier-review-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection v8.2 feature flag readiness", () => {
  it("allows eligible rows into the disabled flag candidate set", () => {
    const report = buildReport({
      shadowRows: [shadowRow({ playerId: "eligible", player: "Eligible RB", position: "RB", pointDelta: 4 })],
      finalRows: [finalRow({ playerId: "eligible", player: "Eligible RB", position: "RB", finalClassification: "eligible_for_projection_promotion" })],
    });

    expect(report.summary.wouldUseV82UnderFlag).toBe(1);
    expect(report.rows[0]?.status).toBe("would_use_v8_2_under_flag");
    expect(report.rows[0]?.protectionReasons).toEqual(["eligible_for_flag_candidate"]);
    expect(report.recommendation).toBe("ready_for_disabled_feature_flag_scaffold");
  });

  it("keeps conservative promotion decisions on the current path", () => {
    const row = featureFlagRow(
      shadowRow({ playerId: "critical", player: "Critical WR", position: "WR", pointDelta: 24, risk: "critical" }),
      finalRow({
        playerId: "critical",
        player: "Critical WR",
        position: "WR",
        finalClassification: "shadow_only",
        decision: "use_current_path_for_now",
        criticalMovement: true,
      }),
      null,
      new Set(),
    );

    expect(row.status).toBe("would_use_current_path_under_flag");
    expect(row.protectionReasons).toContain("critical_movement_protected");
  });

  it("keeps conservative tier-review decisions on the current path", () => {
    const row = featureFlagRow(
      shadowRow({ playerId: "tier", player: "Tier QB", position: "QB", pointDelta: -8 }),
      finalRow({ playerId: "tier", player: "Tier QB", position: "QB", finalClassification: "eligible_for_projection_promotion" }),
      tierDecision({ playerId: "tier", player: "Tier QB", position: "QB", action: "needs_qb_superflex_review", flags: ["qb_superflex_sensitive_movement"] }),
      new Set(["tier"]),
    );

    expect(row.status).toBe("would_use_current_path_under_flag");
    expect(row.meaningfulRankMover).toBe(true);
    expect(row.protectionReasons).toContain("tier_review_protected");
    expect(row.protectionReasons).toContain("qb_superflex_protected");
  });

  it("prevents K rows, critical movers, meaningful movers, and legacy rows from using v8.2", () => {
    const report = buildReport({
      shadowRows: [
        shadowRow({ playerId: "k", player: "Kicker", position: "K", pointDelta: 3 }),
        shadowRow({ playerId: "critical", player: "Critical RB", position: "RB", pointDelta: 25, risk: "critical" }),
        shadowRow({ playerId: "tier", player: "Tier WR", position: "WR", pointDelta: 7 }),
        shadowRow({ playerId: "legacy", player: "Legacy RB", position: "RB", pointDelta: 1 }),
      ],
      finalRows: [
        finalRow({ playerId: "k", player: "Kicker", position: "K", finalClassification: "eligible_for_projection_promotion" }),
        finalRow({ playerId: "critical", player: "Critical RB", position: "RB", finalClassification: "shadow_only", decision: "use_current_path_for_now", criticalMovement: true }),
        finalRow({ playerId: "tier", player: "Tier WR", position: "WR", finalClassification: "eligible_for_projection_promotion" }),
        finalRow({ playerId: "legacy", player: "Legacy RB", position: "RB", finalClassification: "blocked_from_promotion", universeEligibilityStatus: "retired_or_legacy_suspect" }),
      ],
      tierRows: [tierReviewRow({ playerId: "tier", player: "Tier WR", position: "WR", action: "needs_model_policy_review" })],
      tierDecisions: [tierDecision({ playerId: "tier", player: "Tier WR", position: "WR", action: "needs_model_policy_review" })],
    });

    expect(report.summary.wouldUseV82UnderFlag).toBe(0);
    expect(report.summary.kRowsUsingV82).toBe(0);
    expect(report.summary.criticalMovementRowsUsingV82).toBe(0);
    expect(report.summary.meaningfulRankMoversUsingV82).toBe(0);
    expect(report.summary.legacyRowsUsingV82).toBe(0);
    expect(report.currentPathProtectionSummary.kicker_policy_protected).toBe(1);
    expect(report.currentPathProtectionSummary.critical_movement_protected).toBe(1);
    expect(report.currentPathProtectionSummary.tier_review_protected).toBe(1);
    expect(report.currentPathProtectionSummary.blocked_legacy).toBe(1);
  });

  it("blocks readiness when manual or unresolved rows remain", () => {
    const report = buildReport({
      shadowRows: [shadowRow({ playerId: "manual", player: "Manual RB", position: "RB", pointDelta: 6 })],
      finalRows: [finalRow({ playerId: "manual", player: "Manual RB", position: "RB", finalClassification: "manual_review_before_promotion" })],
      finalSummaryOverrides: { manualReviewRowsRemaining: 1 },
    });

    expect(report.summary.manualReviewRowsRemaining).toBe(1);
    expect(report.recommendation).toBe("feature_flag_readiness_blocked");
    expect(report.safetyGates.find((gate) => gate.name === "manual_review_rows_zero")?.passed).toBe(false);
  });

  it("builds impact summaries only from rows that would use v8.2", () => {
    const report = buildReport({
      shadowRows: [
        shadowRow({ playerId: "a", player: "A", position: "RB", pointDelta: 4 }),
        shadowRow({ playerId: "b", player: "B", position: "WR", pointDelta: -6 }),
        shadowRow({ playerId: "k", player: "K", position: "K", pointDelta: 9 }),
      ],
      finalRows: [
        finalRow({ playerId: "a", player: "A", position: "RB", finalClassification: "eligible_for_projection_promotion" }),
        finalRow({ playerId: "b", player: "B", position: "WR", finalClassification: "eligible_for_projection_promotion" }),
        finalRow({ playerId: "k", player: "K", position: "K", finalClassification: "eligible_for_projection_promotion" }),
      ],
    });

    expect(report.impactSummary.rows).toBe(2);
    expect(report.impactSummary.averageProjectedPointDelta).toBe(-1);
    expect(report.impactSummary.maxProjectedPointDelta).toBe(6);
    expect(report.impactSummary.positionSummary.map((entry) => entry.position).sort()).toEqual(["RB", "WR"]);
  });

  it("does not mutate input reports", () => {
    const shadow = shadowReport([shadowRow({ playerId: "eligible", player: "Eligible RB", position: "RB", pointDelta: 4 })]);
    const before = JSON.stringify(shadow);

    buildReport({
      shadowRows: shadow.rows,
      finalRows: [finalRow({ playerId: "eligible", player: "Eligible RB", position: "RB", finalClassification: "eligible_for_projection_promotion" })],
    });

    expect(JSON.stringify(shadow)).toBe(before);
  });
});

function buildReport(input: {
  shadowRows: ProjectionV82ShadowRow[];
  finalRows: ProjectionPromotionReadinessFinalRow[];
  tierRows?: ProjectionRankImpactTierReviewRow[];
  tierDecisions?: ProjectionRankImpactTierResolvedDecisionRow[];
  finalSummaryOverrides?: Partial<ProjectionPromotionReadinessFinalReport["summary"]>;
}) {
  return buildProjectionV82FeatureFlagReadinessFromData({
    options: { projectionSeason: 2026, includeIdp: true },
    finalReadiness: finalReadinessReport(input.finalRows, input.finalSummaryOverrides),
    resolvedTierDecisions: tierDecisionReport(input.tierDecisions ?? []),
    tierReview: tierReviewReport(input.tierRows ?? []),
    limitedPool: limitedPoolReport(),
    shadow: shadowReport(input.shadowRows),
    universe: universeReport(),
    snapshot: snapshot(),
  });
}

function shadowRow(input: {
  playerId: string;
  player: string;
  position: string;
  pointDelta: number;
  risk?: ProjectionV82ShadowRow["risk"];
}): ProjectionV82ShadowRow {
  const movementBucket = Math.abs(input.pointDelta) >= 20 ? "20+" : Math.abs(input.pointDelta) >= 10 ? "10-20" : Math.abs(input.pointDelta) >= 5 ? "5-10" : Math.abs(input.pointDelta) > 0 ? "0-5" : "0";
  return {
    playerId: input.playerId,
    sleeperId: input.playerId,
    gsisId: null,
    player: input.player,
    position: input.position,
    team: "TST",
    cohorts: ["test"],
    currentExpectedGames: 10,
    v82ExpectedGames: 11,
    expectedGamesDelta: 1,
    ppgAnchor: Math.abs(input.pointDelta),
    projectedTotalPointDelta: input.pointDelta,
    currentProjectedTotal: 100,
    shadowProjectedTotal: 100 + input.pointDelta,
    movementBucket,
    gamesBucket: "1-2",
    risk: input.risk ?? "low",
    riskFlags: input.risk === "critical" ? ["critical_movement"] : [],
    reasonCodes: ["test"],
    guardrailApplied: false,
    currentOverallRank: null,
    shadowOverallRank: null,
    estimatedOverallRankMovement: null,
    currentPositionRank: null,
    shadowPositionRank: null,
    estimatedPositionRankMovement: null,
    criticalReviewStatus: input.risk === "critical" ? "needs_manual_review" : null,
  };
}

function finalRow(input: {
  playerId: string;
  player: string;
  position: string;
  finalClassification: ProjectionPromotionReadinessFinalRow["finalClassification"];
  universeEligibilityStatus?: ProjectionPromotionReadinessFinalRow["universeEligibilityStatus"];
  decision?: ProjectionPromotionReadinessFinalRow["decision"];
  criticalMovement?: boolean;
}): ProjectionPromotionReadinessFinalRow {
  return {
    playerId: input.playerId,
    player: input.player,
    position: input.position,
    team: "TST",
    universeEligibilityStatus: input.universeEligibilityStatus ?? "active_plausible",
    originalClassification: input.finalClassification,
    finalClassification: input.finalClassification,
    decision: input.decision ?? null,
    decisionRationale: null,
    reviewer: null,
    reviewedAt: null,
    projectedTotalPointDelta: null,
    currentExpectedGames: null,
    v82ExpectedGames: null,
    gamesDelta: null,
    criticalMovement: input.criticalMovement ?? false,
    movementBucket: "0-5",
    riskFlags: [],
    reasonCodes: [],
    source: input.decision ? "review_decision" : "candidate_pool",
  };
}

function tierReviewRow(input: {
  playerId: string;
  player: string;
  position: string;
  action: ProjectionRankImpactTierReviewRow["recommendedTierReviewAction"];
  flags?: ProjectionRankImpactTierReviewRow["rankImpactFlags"];
}): ProjectionRankImpactTierReviewRow {
  return {
    playerId: input.playerId,
    player: input.player,
    position: input.position,
    team: "TST",
    currentExpectedGames: 10,
    v82ExpectedGames: 11,
    gamesDelta: 1,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 108,
    projectedPointDelta: 8,
    currentOverallRank: 100,
    v82OverallRank: 80,
    estimatedOverallRankMovement: 20,
    currentPositionRank: 20,
    v82PositionRank: 15,
    estimatedPositionRankMovement: 5,
    bestOverallRank: 80,
    bestPositionRank: 15,
    relevanceTiers: ["overall_top_200"],
    pointDeltaBucket: "5-10",
    overallRankRange: "top_100",
    positionRankRange: "starter",
    rankImpactFlags: input.flags ?? ["top_200_overall_movement"],
    riskFlags: [],
    reasonCodes: [],
    cohortTags: [],
    universeEligibilityStatus: "active_plausible",
    promotionClassification: "eligible_for_projection_promotion",
    recommendedTierReviewAction: input.action,
    reviewRationale: "test",
  };
}

function tierDecision(input: {
  playerId: string;
  player: string;
  position: string;
  action: ProjectionRankImpactTierReviewRow["recommendedTierReviewAction"];
  flags?: ProjectionRankImpactTierReviewRow["rankImpactFlags"];
}): ProjectionRankImpactTierResolvedDecisionRow {
  const reviewRow = tierReviewRow(input);
  return {
    playerId: input.playerId,
    player: input.player,
    position: input.position,
    team: "TST",
    currentExpectedGames: 10,
    v82ExpectedGames: 11,
    gamesDelta: 1,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 108,
    projectedPointDelta: 8,
    currentOverallRank: 100,
    v82OverallRank: 80,
    estimatedOverallRankMovement: 20,
    currentPositionRank: 20,
    v82PositionRank: 15,
    estimatedPositionRankMovement: 5,
    rankImpactFlags: reviewRow.rankImpactFlags,
    riskFlags: [],
    reasonCodes: [],
    recommendedTierReviewAction: input.action,
    decision: "use_current_path_for_now",
    decisionRationale: "Reviewed conservatively.",
    reviewer: "tester",
    reviewedAt: "2026-06-17T00:00:00.000Z",
    resolvedTierStatus: "tier_current_path",
    source: "decision_file",
    validationErrors: [],
    policyViolations: [],
    tierReviewRow: reviewRow,
  };
}

function finalReadinessReport(rows: ProjectionPromotionReadinessFinalRow[], overrides: Partial<ProjectionPromotionReadinessFinalReport["summary"]> = {}): ProjectionPromotionReadinessFinalReport {
  const summary: ProjectionPromotionReadinessFinalReport["summary"] = {
    eligibleRows: rows.filter((row) => row.finalClassification === "eligible_for_projection_promotion").length,
    manualReviewRowsRemaining: rows.filter((row) => row.finalClassification === "manual_review_before_promotion").length,
    shadowOnlyRows: rows.filter((row) => row.finalClassification === "shadow_only").length,
    blockedRows: rows.filter((row) => row.finalClassification === "blocked_from_promotion").length,
    kRows: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 },
    criticalMovementRows: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 },
    unresolvedRows: 0,
    validationErrors: 0,
    policyViolations: 0,
    ...overrides,
  };
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    decisionsFile: null,
    sourceArtifacts: { reviewDecisions: "", promotionCandidatePool: "", promotionManualReview: "", shadow: "", universeEligibilityAudit: "" },
    validationIssues: [],
    policyViolations: [],
    finalRows: rows,
    summary,
    topEligibleMovements: [],
    topManualReviewMovements: [],
    topShadowOnlyMovements: [],
    topBlockedMovements: [],
    criticalMovementRows: [],
    unresolvedRows: [],
    safetyGates: [],
    verdict: "ready_for_shadow_promotion_review",
    notes: [],
  };
}

function tierDecisionReport(rows: ProjectionRankImpactTierResolvedDecisionRow[]): ProjectionRankImpactTierDecisionReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    decisionsFile: null,
    sourceArtifacts: { rankImpactTierReview: "", rankImpactQualityReview: "", limitedPromotionPoolReview: "", finalReadiness: "", shadow: "" },
    templateRows: [],
    resolvedRows: rows,
    validationErrors: [],
    policyViolations: [],
    summary: {
      totalTierReviewRows: rows.length,
      defaultDecisionCounts: { approve_v8_2_movement: 0, use_current_path_for_now: rows.length, keep_shadow_only: 0, needs_roster_confirmation: 0, needs_injury_role_review: 0, needs_qb_superflex_review: 0, needs_model_policy_review: 0, unresolved: 0 },
      resolvedDecisionCounts: { approve_v8_2_movement: 0, use_current_path_for_now: rows.length, keep_shadow_only: 0, needs_roster_confirmation: 0, needs_injury_role_review: 0, needs_qb_superflex_review: 0, needs_model_policy_review: 0, unresolved: 0 },
      resolvedTierStatusCounts: { tier_approved: 0, tier_current_path: rows.length, tier_shadow_only: 0, tier_unresolved: 0 },
      validationErrors: 0,
      policyViolations: 0,
      qbSuperflexRowsByStatus: { tier_approved: 0, tier_current_path: 0, tier_shadow_only: 0, tier_unresolved: 0 },
      injuryRoleRowsByStatus: { tier_approved: 0, tier_current_path: 0, tier_shadow_only: 0, tier_unresolved: 0 },
      modelPolicyRowsByStatus: { tier_approved: 0, tier_current_path: 0, tier_shadow_only: 0, tier_unresolved: 0 },
    },
    topMovementRowsByFinalStatus: { tier_approved: [], tier_current_path: rows, tier_shadow_only: [], tier_unresolved: [] },
    unresolvedQbSuperflexRows: [],
    unresolvedInjuryRoleRows: [],
    unresolvedModelPolicyRows: [],
    safetyGates: [],
    verdict: "tier_decisions_ready",
    notes: [],
  };
}

function tierReviewReport(rows: ProjectionRankImpactTierReviewRow[]): ProjectionRankImpactTierReviewReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { rankImpactQualityReview: "", limitedPromotionPoolReview: "", finalReadiness: "", shadow: "", snapshot: "" },
    rows,
    summary: { meaningfulRows: rows.length, actionCounts: { acceptable_v8_2_movement: 0, keep_current_path_for_now: 0, needs_roster_confirmation: 0, needs_injury_role_review: 0, needs_qb_superflex_review: 0, needs_model_policy_review: 0 }, positionCounts: {}, rankImpactFlagCounts: { top_100_overall_movement: 0, top_200_overall_movement: 0, top_300_overall_movement: 0, starter_tier_position_movement: 0, qb_superflex_sensitive_movement: 0, large_points_small_rank_noise: 0, small_points_large_rank_noise: 0, deep_tier_rank_noise: 0 }, overallRankRangeCounts: { top_50: 0, top_100: 0, top_150: 0, top_200: 0, top_300: 0, top_500: 0, "500_plus": 0, unknown: 0 }, positionRankRangeCounts: { starter: 0, depth: 0, deep: 0, unknown: 0 }, projectedPointMovementBucketCounts: { "0": 0, "0-2": 0, "2-5": 0, "5-10": 0, "10-20": 0 }, qbSuperflexSensitiveRows: 0 },
    allMeaningfulOverallRankMovers: rows,
    allMeaningfulPositionRankMovers: rows,
    allQbSuperflexSensitiveMovers: rows.filter((row) => row.rankImpactFlags.includes("qb_superflex_sensitive_movement")),
    starterTierVeteranMovers: rows,
    rookieYoungMovers: [],
    topProjectedPointMovers: rows,
    safetyGates: [],
    verdict: "tier_review_packet_ready",
    notes: [],
  };
}

function shadowReport(rows: ProjectionV82ShadowRow[]): ProjectionV82ShadowReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    currentModel: "blackbird_expected_games_v7_family_selective",
    shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail",
    sourceArtifacts: { snapshot: "" },
    rowCoverage: { currentLiveProjectionRows: rows.length, v82ShadowRows: rows.length, sharedRows: rows.length, currentOnlyRows: 0, v82OnlyRows: 0, rowsSkipped: 0, skipReasons: {}, positionCounts: {}, cohortCounts: {} },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [],
    cohortMovementSummary: [],
    rows,
    topMovements: rows,
    criticalMovements: rows.filter((row) => row.risk === "critical"),
    rankingRiskPreview: { estimated: true, reason: "", rowsWithEstimatedOverallRankMovement: 0, rowsWithEstimatedPositionRankMovement: 0, topOverallRankMovements: [], topPositionRankMovements: [] },
    safetyGates: [],
    recommendation: "shadow_candidate_with_manual_review",
    notes: [],
  };
}

function limitedPoolReport(): ProjectionLimitedPromotionPoolReviewReport {
  return { generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true, sourceArtifacts: { finalReadiness: "", conservativeDecisions: "", candidatePool: "", shadow: "", universeEligibilityAudit: "", snapshot: "" }, eligibleRows: [], excludedCounts: { criticalMovementRowsExcluded: 0, kRowsExcluded: 0, legacyRetiredRowsExcluded: 0, shadowOnlyRowsExcluded: 0, blockedRowsExcluded: 0, manualReviewRowsRemaining: 0 }, movementSummary: { rows: 0, averageExpectedGamesDelta: null, averageProjectedPointDelta: null, medianProjectedPointDelta: null, maxProjectedPointDelta: null, movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 }, expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 } }, positionSummary: [], cohortSummary: [], rankImpactPreview: { estimated: true, reason: "", rowsWithRankMovementEstimate: 0, rowsWithPositionRankMovementEstimate: 0, rowsWithOverallRankMovementEstimate: 0, topPositionRankRisers: [], topPositionRankFallers: [], topOverallRankRisers: [], topOverallRankFallers: [], rowsMoving5PlusPositionRanks: 0, rowsMoving10PlusPositionRanks: 0, rowsMoving25PlusOverallRanks: 0, rowsMoving50PlusOverallRanks: 0 }, topEligibleMovements: [], safetyGates: [], recommendation: "limited_pool_clean_for_feature_flag_review", notes: [] };
}

function universeReport(): ProjectionUniverseEligibilityAuditReport {
  return { generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true, sourceArtifacts: { snapshot: "", shadow: "" }, summary: { totalProjectedRows: 0, statusCounts: { active_plausible: 0, low_confidence_plausible: 0, rookie_or_new_player: 0, stale_historical_signal: 0, retired_or_legacy_suspect: 0, manual_review_required: 0 }, byPosition: [], byCohort: [], byTeam: {}, byLastActiveSeason: {} }, rows: [], criticalMovementReview: [], retiredLegacySuspects: [], kickerReview: { totalKRows: 0, lowPriorFallbackRows: 0, criticalMovementRows: 0, movingEightToTwelveExpectedGames: 0, statusCounts: {}, recommendation: "" }, safetyGates: [], verdict: "universe_clean_for_shadow", notes: [] };
}

function snapshot(): PreseasonProjectionSnapshot {
  return {
    metadata: { artifactType: "blackbird_preseason_projection_snapshot", projectionSeason: 2026, targetSeason: 2026, inputSeasons: [], excludedSeasons: [2026], leakageSafe: true, createdForBacktesting: true, modelVersion: "preseason_snapshot_v2", defaultUniverse: "all", scoringSource: "default", scoringProfile: "test", notes: [] },
    rows: [],
    diagnostics: { playersConsidered: 0, playersProjected: 0, playersSkipped: 0, playersSkippedNoSignal: 0, universe: "all", variantCounts: {}, cohortCounts: {}, noPriorTypeCounts: {}, noPriorCount: 0, idpCount: 0, averageProjectedGames: null, averageProjectedPpgByPosition: {}, confidenceDistribution: {}, warningsByType: {}, leakageSafety: { passed: true, targetSeasonExcludedFromInputs: true, noPostTargetProjectionArtifactsUsed: true, notes: [] } },
  };
}
