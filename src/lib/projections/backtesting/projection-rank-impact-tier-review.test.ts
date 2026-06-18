import { describe, expect, it } from "vitest";

import {
  buildProjectionRankImpactTierReviewFromData,
  isMeaningfulRankImpactRow,
  tierReviewRow,
} from "./projection-rank-impact-tier-review";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionLimitedPromotionPoolReviewReport, ProjectionLimitedPromotionPoolReviewRow } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport } from "./projection-promotion-readiness-final-types";
import type { ProjectionRankImpactQualityReviewReport, ProjectionRankImpactQualityRow } from "./projection-rank-impact-quality-review-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

describe("projection rank impact tier review", () => {
  it("filters meaningful rows and excludes deep-noise-only rows", () => {
    const meaningful = quality({ player: "Meaningful", flags: ["top_200_overall_movement"] });
    const noiseOnly = quality({ player: "Noise", flags: ["deep_tier_rank_noise"] });

    expect(isMeaningfulRankImpactRow(meaningful)).toBe(true);
    expect(isMeaningfulRankImpactRow(noiseOnly)).toBe(false);

    const report = buildReport([meaningful, noiseOnly], [limited("Meaningful"), limited("Noise")]);

    expect(report.rows.map((row) => row.player)).toEqual(["Meaningful"]);
    expect(report.safetyGates.find((gate) => gate.name === "deep_noise_only_excluded")?.passed).toBe(true);
  });

  it("assigns QB/Superflex-sensitive movers to QB/Superflex review", () => {
    const row = tierReviewRow(
      quality({ player: "QB", position: "QB", flags: ["qb_superflex_sensitive_movement"], bestPositionRank: 22 }),
      limited("QB", { position: "QB" }),
    );

    expect(row.recommendedTierReviewAction).toBe("needs_qb_superflex_review");
    expect(row.reviewRationale).toContain("Superflex");
  });

  it("assigns starter-tier veteran negative movement to injury/role review", () => {
    const row = tierReviewRow(
      quality({ player: "Veteran WR", position: "WR", pointDelta: -7, flags: ["starter_tier_position_movement"], tiers: ["overall_top_300", "position_starter_tier"] }),
      limited("Veteran WR", { position: "WR", cohortTags: ["veteran"] }),
    );

    expect(row.recommendedTierReviewAction).toBe("needs_injury_role_review");
  });

  it("assigns rookie/young movement to roster confirmation", () => {
    const row = tierReviewRow(
      quality({ player: "Rookie RB", position: "RB", pointDelta: 8, flags: ["top_300_overall_movement"], riskFlags: ["rookie_or_low_prior"] }),
      limited("Rookie RB", { position: "RB", cohortTags: ["rookie"] }),
    );

    expect(row.recommendedTierReviewAction).toBe("needs_roster_confirmation");
  });

  it("assigns small point movement in meaningful ranges to model policy review", () => {
    const row = tierReviewRow(
      quality({ player: "Small Move", pointDelta: 1.5, overallMove: 30, flags: ["top_200_overall_movement"] }),
      limited("Small Move"),
    );

    expect(row.recommendedTierReviewAction).toBe("needs_model_policy_review");
  });

  it("summarizes recommended actions and flags", () => {
    const report = buildReport(
      [
        quality({ player: "QB", position: "QB", flags: ["qb_superflex_sensitive_movement"] }),
        quality({ player: "WR", position: "WR", pointDelta: -8, flags: ["starter_tier_position_movement"], tiers: ["overall_top_300", "position_starter_tier"] }),
      ],
      [limited("QB", { position: "QB" }), limited("WR", { position: "WR" })],
    );

    expect(report.summary.meaningfulRows).toBe(2);
    expect(report.summary.actionCounts.needs_qb_superflex_review).toBe(1);
    expect(report.summary.actionCounts.needs_injury_role_review).toBe(1);
    expect(report.summary.rankImpactFlagCounts.qb_superflex_sensitive_movement).toBe(1);
    expect(report.summary.rankImpactFlagCounts.starter_tier_position_movement).toBe(1);
  });

  it("sorts top tables by movement magnitude", () => {
    const report = buildReport(
      [
        quality({ player: "Small", overallMove: 30, positionMove: 6, flags: ["top_300_overall_movement", "starter_tier_position_movement"] }),
        quality({ player: "Big", overallMove: 90, positionMove: 12, flags: ["top_300_overall_movement", "starter_tier_position_movement"] }),
      ],
      [limited("Small"), limited("Big")],
    );

    expect(report.allMeaningfulOverallRankMovers[0]?.player).toBe("Big");
    expect(report.allMeaningfulPositionRankMovers[0]?.player).toBe("Big");
  });

  it("generates a ready packet when meaningful rows exist", () => {
    const report = buildReport([quality({ player: "Review", flags: ["top_100_overall_movement"] })], [limited("Review")]);

    expect(report.verdict).toBe("tier_review_packet_ready");
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("returns no-meaningful-movers when no meaningful rows exist", () => {
    const report = buildReport([quality({ player: "Noise", flags: ["deep_tier_rank_noise"] })], [limited("Noise")]);

    expect(report.rows).toHaveLength(0);
    expect(report.verdict).toBe("tier_review_no_meaningful_movers");
  });

  it("does not mutate input reports", () => {
    const qualityReport = qualityReview([quality({ player: "Read Only", flags: ["top_200_overall_movement"] })]);
    const limitedReport = limitedPool([limited("Read Only")]);
    const before = JSON.stringify({ qualityReport, limitedReport });

    buildProjectionRankImpactTierReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      qualityReview: qualityReport,
      limitedPool: limitedReport,
      finalReadiness: finalReadiness(),
      shadow: shadow(),
      snapshot: snapshot(),
    });

    expect(JSON.stringify({ qualityReport, limitedReport })).toBe(before);
  });
});

function buildReport(qualityRows: ProjectionRankImpactQualityRow[], limitedRows: ProjectionLimitedPromotionPoolReviewRow[]) {
  return buildProjectionRankImpactTierReviewFromData({
    options: { projectionSeason: 2026, includeIdp: true },
    qualityReview: qualityReview(qualityRows),
    limitedPool: limitedPool(limitedRows),
    finalReadiness: finalReadiness(),
    shadow: shadow(),
    snapshot: snapshot(),
  });
}

function quality(input: {
  player: string;
  position?: string;
  pointDelta?: number;
  overallMove?: number;
  positionMove?: number;
  bestOverallRank?: number;
  bestPositionRank?: number;
  flags: ProjectionRankImpactQualityRow["meaningfulFlags"];
  tiers?: ProjectionRankImpactQualityRow["relevanceTiers"];
  riskFlags?: string[];
  reasonCodes?: string[];
}): ProjectionRankImpactQualityRow {
  const position = input.position ?? "WR";
  const pointDelta = input.pointDelta ?? 8;
  const overallMove = input.overallMove ?? 40;
  const positionMove = input.positionMove ?? 6;
  const bestOverallRank = input.bestOverallRank ?? 180;
  const bestPositionRank = input.bestPositionRank ?? 30;
  return {
    playerId: input.player,
    player: input.player,
    position,
    team: "TST",
    currentProjectedTotal: 100,
    v82ProjectedTotal: 100 + pointDelta,
    projectedPointDelta: pointDelta,
    currentOverallRank: bestOverallRank + Math.max(overallMove, 0),
    v82OverallRank: bestOverallRank,
    currentPositionRank: bestPositionRank + Math.max(positionMove, 0),
    v82PositionRank: bestPositionRank,
    estimatedOverallRankMovement: overallMove,
    estimatedPositionRankMovement: positionMove,
    bestOverallRank,
    bestPositionRank,
    relevanceTiers: input.tiers ?? ["overall_top_200", "position_starter_tier"],
    pointDeltaBucket: Math.abs(pointDelta) >= 10 ? "10-20" : Math.abs(pointDelta) >= 5 ? "5-10" : Math.abs(pointDelta) >= 2 ? "2-5" : Math.abs(pointDelta) > 0 ? "0-2" : "0",
    meaningfulFlags: [...input.flags],
    riskFlags: input.riskFlags ?? [],
    reasonCodes: input.reasonCodes ?? ["active_plausible_allowed"],
  };
}

function limited(player: string, input?: Partial<ProjectionLimitedPromotionPoolReviewRow>): ProjectionLimitedPromotionPoolReviewRow {
  return {
    playerId: player,
    player,
    position: input?.position ?? "WR",
    team: "TST",
    universeEligibilityStatus: "active_plausible",
    finalClassification: "eligible_for_projection_promotion",
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    gamesDelta: 1,
    scoringAnchorPpg: 6,
    projectedPointDelta: 8,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 108,
    movementBucket: "5-10",
    expectedGamesMovementBucket: "1-2",
    estimatedPositionRankMovement: 6,
    estimatedOverallRankMovement: 40,
    currentPositionRank: 36,
    v82PositionRank: 30,
    currentOverallRank: 220,
    v82OverallRank: 180,
    riskFlags: [],
    reasonCodes: ["active_plausible_allowed"],
    cohortTags: input?.cohortTags ?? [],
    criticalMovement: false,
    ...input,
  };
}

function qualityReview(rows: ProjectionRankImpactQualityRow[]): ProjectionRankImpactQualityReviewReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { limitedPromotionPoolReview: "", finalReadiness: "", shadow: "", snapshot: "" },
    rows,
    tierSummaries: [],
    pointDeltaBucketSummaries: [],
    draftableRangeSummaries: [],
    positionRangeSummaries: [],
    qbReview: { eligibleQbRows: 0, rowsMoving5PlusPositionRanks: 0, rowsMoving10PlusPositionRanks: 0, top12MeaningfulRows: 0, top24MeaningfulRows: 0, top36MeaningfulRows: 0, topQbMovements: [], backupDeepQbNoiseRows: [] },
    summary: { eligibleRows: rows.length, meaningfulOverallRankMovers: 0, meaningfulPositionRankMovers: 0, smallPointsLargeRankNoiseRows: 0, deepTierNoiseRows: 0, qbSuperflexSensitiveRows: 0 },
    topMeaningfulOverallRankMovers: [],
    topMeaningfulPositionRankMovers: [],
    topSmallPointsLargeRankNoiseRows: [],
    topDeepTierRankNoiseRows: [],
    topQbRankMovers: [],
    topRbRankMovers: [],
    topWrRankMovers: [],
    topTeRankMovers: [],
    safetyGates: [],
    recommendation: "rank_impact_needs_tier_review",
    notes: [],
  };
}

function limitedPool(rows: ProjectionLimitedPromotionPoolReviewRow[]): ProjectionLimitedPromotionPoolReviewReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { finalReadiness: "", conservativeDecisions: "", candidatePool: "", shadow: "", universeEligibilityAudit: "", snapshot: "" },
    eligibleRows: rows,
    excludedCounts: { criticalMovementRowsExcluded: 1, kRowsExcluded: 1, legacyRetiredRowsExcluded: 1, shadowOnlyRowsExcluded: 1, blockedRowsExcluded: 1, manualReviewRowsRemaining: 0 },
    movementSummary: { rows: rows.length, averageExpectedGamesDelta: null, averageProjectedPointDelta: null, medianProjectedPointDelta: null, maxProjectedPointDelta: null, movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 }, expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 } },
    positionSummary: [],
    cohortSummary: [],
    rankImpactPreview: { estimated: true, reason: "", rowsWithRankMovementEstimate: rows.length, rowsWithPositionRankMovementEstimate: rows.length, rowsWithOverallRankMovementEstimate: rows.length, topPositionRankRisers: [], topPositionRankFallers: [], topOverallRankRisers: [], topOverallRankFallers: [], rowsMoving5PlusPositionRanks: 0, rowsMoving10PlusPositionRanks: 0, rowsMoving25PlusOverallRanks: 0, rowsMoving50PlusOverallRanks: 0 },
    topEligibleMovements: rows,
    safetyGates: [],
    recommendation: "limited_pool_needs_rank_impact_review",
    notes: [],
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

function snapshot(): PreseasonProjectionSnapshot {
  return {
    metadata: { artifactType: "blackbird_preseason_projection_snapshot", projectionSeason: 2026, targetSeason: 2026, inputSeasons: [], excludedSeasons: [], leakageSafe: true, createdForBacktesting: true, modelVersion: "preseason_snapshot_v2", defaultUniverse: "fantasy-relevant", scoringSource: "default", scoringProfile: "default", notes: [] },
    rows: [],
    diagnostics: { playersConsidered: 0, playersProjected: 0, playersSkipped: 0, playersSkippedNoSignal: 0, universe: "fantasy-relevant", variantCounts: {}, cohortCounts: {}, noPriorTypeCounts: {}, noPriorCount: 0, idpCount: 0, averageProjectedGames: null, averageProjectedPpgByPosition: {}, confidenceDistribution: {}, warningsByType: {}, leakageSafety: { passed: true, targetSeasonExcludedFromInputs: true, noPostTargetProjectionArtifactsUsed: true, notes: [] } },
  };
}
