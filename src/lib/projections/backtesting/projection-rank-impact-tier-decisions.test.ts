import { describe, expect, it } from "vitest";

import {
  buildProjectionRankImpactTierDecisionsFromData,
  parseTierDecisionTemplateCsv,
  renderTierDecisionTemplateCsv,
  resolveTierDecisionToStatus,
  tierDecisionTemplateRowFor,
} from "./projection-rank-impact-tier-decisions";
import type { ProjectionLimitedPromotionPoolReviewReport } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport } from "./projection-promotion-readiness-final-types";
import type { ProjectionRankImpactQualityReviewReport } from "./projection-rank-impact-quality-review-types";
import type { ProjectionRankImpactTierDecisionTemplateRow } from "./projection-rank-impact-tier-decisions-types";
import type { ProjectionRankImpactTierReviewReport, ProjectionRankImpactTierReviewRow } from "./projection-rank-impact-tier-review-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

describe("projection rank impact tier decisions", () => {
  it("generates decision templates with conservative defaults", () => {
    const qb = tierDecisionTemplateRowFor(row({ player: "QB", action: "needs_qb_superflex_review", flags: ["qb_superflex_sensitive_movement"] }));
    const injury = tierDecisionTemplateRowFor(row({ player: "WR", action: "needs_injury_role_review" }));
    const policy = tierDecisionTemplateRowFor(row({ player: "RB", action: "needs_model_policy_review" }));
    const current = tierDecisionTemplateRowFor(row({ player: "DL", action: "keep_current_path_for_now" }));

    expect(qb.decision).toBe("needs_qb_superflex_review");
    expect(injury.decision).toBe("needs_injury_role_review");
    expect(policy.decision).toBe("needs_model_policy_review");
    expect(current.decision).toBe("use_current_path_for_now");
  });

  it("parses decision CSV rows", () => {
    const csv = renderTierDecisionTemplateCsv([tierDecisionTemplateRowFor(row({ player: "CSV", action: "needs_model_policy_review" }))]);
    const parsed = parseTierDecisionTemplateCsv(csv);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.playerId).toBe("CSV");
    expect(parsed[0]?.decision).toBe("needs_model_policy_review");
  });

  it("maps supported decisions to tier statuses", () => {
    expect(resolveTierDecisionToStatus("approve_v8_2_movement")).toBe("tier_approved");
    expect(resolveTierDecisionToStatus("use_current_path_for_now")).toBe("tier_current_path");
    expect(resolveTierDecisionToStatus("keep_shadow_only")).toBe("tier_shadow_only");
    expect(resolveTierDecisionToStatus("needs_roster_confirmation")).toBe("tier_unresolved");
    expect(resolveTierDecisionToStatus("needs_injury_role_review")).toBe("tier_unresolved");
    expect(resolveTierDecisionToStatus("needs_qb_superflex_review")).toBe("tier_unresolved");
    expect(resolveTierDecisionToStatus("needs_model_policy_review")).toBe("tier_unresolved");
    expect(resolveTierDecisionToStatus("unresolved")).toBe("tier_unresolved");
  });

  it("resolves defaults and reports unresolved rows", () => {
    const report = buildReport([
      row({ player: "QB", action: "needs_qb_superflex_review", flags: ["qb_superflex_sensitive_movement"] }),
      row({ player: "WR", action: "needs_injury_role_review" }),
      row({ player: "RB", action: "needs_model_policy_review" }),
      row({ player: "DL", action: "keep_current_path_for_now" }),
    ]);

    expect(report.summary.totalTierReviewRows).toBe(4);
    expect(report.summary.resolvedTierStatusCounts.tier_unresolved).toBe(3);
    expect(report.summary.resolvedTierStatusCounts.tier_current_path).toBe(1);
    expect(report.unresolvedQbSuperflexRows.map((entry) => entry.player)).toEqual(["QB"]);
    expect(report.unresolvedInjuryRoleRows.map((entry) => entry.player)).toEqual(["WR"]);
    expect(report.unresolvedModelPolicyRows.map((entry) => entry.player)).toEqual(["RB"]);
    expect(report.verdict).toBe("tier_decisions_unresolved_rows_remaining");
  });

  it("applies edited decision rows", () => {
    const rows = [row({ player: "DL", action: "keep_current_path_for_now" })];
    const decision = {
      ...tierDecisionTemplateRowFor(rows[0]),
      decision: "keep_shadow_only",
      decisionRationale: "Reviewed and kept shadow-only.",
      reviewer: "tester",
      reviewedAt: "2026-06-17T00:00:00.000Z",
    } satisfies ProjectionRankImpactTierDecisionTemplateRow;

    const report = buildReport(rows, [decision], "edited.csv");

    expect(report.resolvedRows[0]?.source).toBe("decision_file");
    expect(report.resolvedRows[0]?.decision).toBe("keep_shadow_only");
    expect(report.resolvedRows[0]?.resolvedTierStatus).toBe("tier_shadow_only");
  });

  it("validates duplicate, unknown, and missing decision rows", () => {
    const rows = [row({ player: "Known", action: "needs_model_policy_review" })];
    const known = tierDecisionTemplateRowFor(rows[0]);
    const unknown = { ...known, playerId: "Unknown", player: "Unknown" };
    const report = buildReport(rows, [known, known, unknown], "edited.csv");

    expect(report.validationErrors.some((error) => error.includes("duplicate decision row"))).toBe(true);
    expect(report.validationErrors.some((error) => error.includes("unknown player id"))).toBe(true);
    expect(report.verdict).toBe("tier_decisions_blocked_by_validation");
  });

  it("requires rationale", () => {
    const rows = [row({ player: "Known", action: "needs_model_policy_review" })];
    const decision = { ...tierDecisionTemplateRowFor(rows[0]), decisionRationale: "" };
    const report = buildReport(rows, [decision], "edited.csv");

    expect(report.validationErrors.some((error) => error.includes("missing rationale"))).toBe(true);
    expect(report.verdict).toBe("tier_decisions_blocked_by_validation");
  });

  it("blocks risky approvals without explicit rationale", () => {
    const rows = [row({ player: "QB", action: "needs_qb_superflex_review", flags: ["qb_superflex_sensitive_movement"], pointDelta: -12 })];
    const decision = {
      ...tierDecisionTemplateRowFor(rows[0]),
      decision: "approve_v8_2_movement",
      decisionRationale: "Default decision: approved.",
    } satisfies ProjectionRankImpactTierDecisionTemplateRow;
    const report = buildReport(rows, [decision], "edited.csv");

    expect(report.policyViolations.some((violation) => violation.includes("QB/Superflex row approved without explicit rationale"))).toBe(true);
    expect(report.verdict).toBe("tier_decisions_blocked_by_policy");
  });

  it("allows risky approvals with explicit rationale", () => {
    const rows = [row({ player: "QB", action: "needs_qb_superflex_review", flags: ["qb_superflex_sensitive_movement"], pointDelta: -12 })];
    const decision = {
      ...tierDecisionTemplateRowFor(rows[0]),
      decision: "approve_v8_2_movement",
      decisionRationale: "Reviewed current role and Superflex depth; movement is acceptable for disabled flag review.",
      reviewer: "tester",
      reviewedAt: "2026-06-17T00:00:00.000Z",
    } satisfies ProjectionRankImpactTierDecisionTemplateRow;
    const report = buildReport(rows, [decision], "edited.csv");

    expect(report.policyViolations).toEqual([]);
    expect(report.summary.resolvedTierStatusCounts.tier_approved).toBe(1);
    expect(report.verdict).toBe("tier_decisions_ready");
  });

  it("does not mutate input reports", () => {
    const tier = tierReview([row({ player: "Read Only", action: "needs_model_policy_review" })]);
    const before = JSON.stringify(tier);

    buildProjectionRankImpactTierDecisionsFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      tierReview: tier,
      qualityReview: qualityReview(),
      limitedPool: limitedPool(),
      finalReadiness: finalReadiness(),
      shadow: shadow(),
    });

    expect(JSON.stringify(tier)).toBe(before);
  });
});

function buildReport(rows: ProjectionRankImpactTierReviewRow[], decisions?: ProjectionRankImpactTierDecisionTemplateRow[], decisionsFile?: string) {
  return buildProjectionRankImpactTierDecisionsFromData({
    options: { projectionSeason: 2026, includeIdp: true, decisionsFile },
    tierReview: tierReview(rows),
    qualityReview: qualityReview(),
    limitedPool: limitedPool(),
    finalReadiness: finalReadiness(),
    shadow: shadow(),
    decisions,
  });
}

function row(input: {
  player: string;
  action: ProjectionRankImpactTierReviewRow["recommendedTierReviewAction"];
  flags?: ProjectionRankImpactTierReviewRow["rankImpactFlags"];
  pointDelta?: number;
}): ProjectionRankImpactTierReviewRow {
  const pointDelta = input.pointDelta ?? 8;
  return {
    playerId: input.player,
    player: input.player,
    position: input.action === "needs_qb_superflex_review" ? "QB" : input.player === "DL" ? "DL" : "WR",
    team: "TST",
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    gamesDelta: 1,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 100 + pointDelta,
    projectedPointDelta: pointDelta,
    currentOverallRank: 220,
    v82OverallRank: 180,
    estimatedOverallRankMovement: 40,
    currentPositionRank: 36,
    v82PositionRank: 30,
    estimatedPositionRankMovement: 6,
    bestOverallRank: 180,
    bestPositionRank: 30,
    relevanceTiers: ["overall_top_200", "position_starter_tier"],
    pointDeltaBucket: Math.abs(pointDelta) >= 10 ? "10-20" : Math.abs(pointDelta) >= 5 ? "5-10" : "2-5",
    overallRankRange: "top_200",
    positionRankRange: "starter",
    rankImpactFlags: input.flags ?? ["top_200_overall_movement"],
    riskFlags: [],
    reasonCodes: ["active_plausible_allowed"],
    cohortTags: [],
    universeEligibilityStatus: "active_plausible",
    promotionClassification: "eligible_for_projection_promotion",
    recommendedTierReviewAction: input.action,
    reviewRationale: "test",
  };
}

function tierReview(rows: ProjectionRankImpactTierReviewRow[]): ProjectionRankImpactTierReviewReport {
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
    allQbSuperflexSensitiveMovers: rows.filter((entry) => entry.rankImpactFlags.includes("qb_superflex_sensitive_movement")),
    starterTierVeteranMovers: rows,
    rookieYoungMovers: [],
    topProjectedPointMovers: rows,
    safetyGates: [],
    verdict: "tier_review_packet_ready",
    notes: [],
  };
}

function qualityReview(): ProjectionRankImpactQualityReviewReport {
  return {
    generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true,
    sourceArtifacts: { limitedPromotionPoolReview: "", finalReadiness: "", shadow: "", snapshot: "" },
    rows: [], tierSummaries: [], pointDeltaBucketSummaries: [], draftableRangeSummaries: [], positionRangeSummaries: [],
    qbReview: { eligibleQbRows: 0, rowsMoving5PlusPositionRanks: 0, rowsMoving10PlusPositionRanks: 0, top12MeaningfulRows: 0, top24MeaningfulRows: 0, top36MeaningfulRows: 0, topQbMovements: [], backupDeepQbNoiseRows: [] },
    summary: { eligibleRows: 0, meaningfulOverallRankMovers: 0, meaningfulPositionRankMovers: 0, smallPointsLargeRankNoiseRows: 0, deepTierNoiseRows: 0, qbSuperflexSensitiveRows: 0 },
    topMeaningfulOverallRankMovers: [], topMeaningfulPositionRankMovers: [], topSmallPointsLargeRankNoiseRows: [], topDeepTierRankNoiseRows: [], topQbRankMovers: [], topRbRankMovers: [], topWrRankMovers: [], topTeRankMovers: [],
    safetyGates: [], recommendation: "rank_impact_needs_tier_review", notes: [],
  };
}

function limitedPool(): ProjectionLimitedPromotionPoolReviewReport {
  return {
    generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true,
    sourceArtifacts: { finalReadiness: "", conservativeDecisions: "", candidatePool: "", shadow: "", universeEligibilityAudit: "", snapshot: "" },
    eligibleRows: [], excludedCounts: { criticalMovementRowsExcluded: 0, kRowsExcluded: 0, legacyRetiredRowsExcluded: 0, shadowOnlyRowsExcluded: 0, blockedRowsExcluded: 0, manualReviewRowsRemaining: 0 },
    movementSummary: { rows: 0, averageExpectedGamesDelta: null, averageProjectedPointDelta: null, medianProjectedPointDelta: null, maxProjectedPointDelta: null, movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 }, expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 } },
    positionSummary: [], cohortSummary: [], rankImpactPreview: { estimated: true, reason: "", rowsWithRankMovementEstimate: 0, rowsWithPositionRankMovementEstimate: 0, rowsWithOverallRankMovementEstimate: 0, topPositionRankRisers: [], topPositionRankFallers: [], topOverallRankRisers: [], topOverallRankFallers: [], rowsMoving5PlusPositionRanks: 0, rowsMoving10PlusPositionRanks: 0, rowsMoving25PlusOverallRanks: 0, rowsMoving50PlusOverallRanks: 0 },
    topEligibleMovements: [], safetyGates: [], recommendation: "limited_pool_needs_rank_impact_review", notes: [],
  };
}

function finalReadiness(): ProjectionPromotionReadinessFinalReport {
  return {
    generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true, decisionsFile: null,
    sourceArtifacts: { reviewDecisions: "", promotionCandidatePool: "", promotionManualReview: "", shadow: "", universeEligibilityAudit: "" },
    validationIssues: [], policyViolations: [], finalRows: [], summary: { eligibleRows: 0, manualReviewRowsRemaining: 0, shadowOnlyRows: 0, blockedRows: 0, kRows: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 }, criticalMovementRows: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 }, unresolvedRows: 0, validationErrors: 0, policyViolations: 0 },
    topEligibleMovements: [], topManualReviewMovements: [], topShadowOnlyMovements: [], topBlockedMovements: [], criticalMovementRows: [], unresolvedRows: [], safetyGates: [], verdict: "ready_for_shadow_promotion_review", notes: [],
  };
}

function shadow(): ProjectionV82ShadowReport {
  return {
    generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true,
    currentModel: "blackbird_expected_games_v7_family_selective", shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail", sourceArtifacts: { snapshot: "" },
    rowCoverage: { currentLiveProjectionRows: 0, v82ShadowRows: 0, sharedRows: 0, currentOnlyRows: 0, v82OnlyRows: 0, rowsSkipped: 0, skipReasons: {}, positionCounts: {}, cohortCounts: {} },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [], cohortMovementSummary: [], rows: [], topMovements: [], criticalMovements: [],
    rankingRiskPreview: { estimated: true, reason: "", rowsWithEstimatedOverallRankMovement: 0, rowsWithEstimatedPositionRankMovement: 0, topOverallRankMovements: [], topPositionRankMovements: [] },
    safetyGates: [], recommendation: "shadow_candidate_with_manual_review", notes: [],
  };
}
