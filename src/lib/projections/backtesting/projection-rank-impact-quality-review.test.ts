import { describe, expect, it } from "vitest";

import {
  buildProjectionRankImpactQualityReviewFromData,
  qualityRow,
} from "./projection-rank-impact-quality-review";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionLimitedPromotionPoolReviewReport, ProjectionLimitedPromotionPoolReviewRow } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport } from "./projection-promotion-readiness-final-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

describe("projection rank impact quality review", () => {
  it("assigns overall and position relevance tiers", () => {
    const top = qualityRow(row({ player: "Top RB", position: "RB", overallRank: 40, positionRank: 10, pointDelta: 6 }));
    const deep = qualityRow(row({ player: "Deep WR", position: "WR", overallRank: 700, positionRank: 180, pointDelta: 1 }));

    expect(top.relevanceTiers).toContain("overall_top_50");
    expect(top.relevanceTiers).toContain("position_starter_tier");
    expect(deep.relevanceTiers).toContain("overall_500_plus");
    expect(deep.relevanceTiers).toContain("position_deep_tier");
  });

  it("flags meaningful top overall and starter-tier position movement", () => {
    const entry = qualityRow(row({ player: "Meaningful WR", position: "WR", overallRank: 90, positionRank: 24, pointDelta: 8, overallMove: 30, positionMove: 8 }));

    expect(entry.meaningfulFlags).toContain("top_100_overall_movement");
    expect(entry.meaningfulFlags).toContain("starter_tier_position_movement");
  });

  it("detects small-points large-rank noise and deep-tier noise", () => {
    const entry = qualityRow(row({ player: "Noise DB", position: "DB", overallRank: 900, positionRank: 180, pointDelta: 1.2, overallMove: 120, positionMove: 20 }));

    expect(entry.meaningfulFlags).toContain("small_points_large_rank_noise");
    expect(entry.meaningfulFlags).toContain("deep_tier_rank_noise");
  });

  it("reports QB/Superflex-sensitive movement", () => {
    const report = buildReport([
      row({ player: "QB1", position: "QB", overallRank: 80, positionRank: 18, pointDelta: 7, overallMove: 35, positionMove: 6 }),
      row({ player: "Deep QB", position: "QB", overallRank: 650, positionRank: 55, pointDelta: 1, overallMove: 80, positionMove: 12 }),
    ]);

    expect(report.qbReview.eligibleQbRows).toBe(2);
    expect(report.qbReview.top24MeaningfulRows).toBe(1);
    expect(report.qbReview.backupDeepQbNoiseRows.map((entry) => entry.player)).toEqual(["Deep QB"]);
    expect(report.summary.qbSuperflexSensitiveRows).toBe(1);
  });

  it("builds point bucket and draftable range summaries", () => {
    const report = buildReport([
      row({ player: "Zero", position: "RB", overallRank: 20, positionRank: 5, pointDelta: 0, overallMove: 0, positionMove: 0 }),
      row({ player: "Small", position: "RB", overallRank: 150, positionRank: 40, pointDelta: 3, overallMove: 20, positionMove: 4 }),
      row({ player: "Large", position: "WR", overallRank: 260, positionRank: 60, pointDelta: 12, overallMove: 60, positionMove: 10 }),
    ]);

    expect(report.pointDeltaBucketSummaries.find((entry) => entry.tier === "0")?.rows).toBe(1);
    expect(report.pointDeltaBucketSummaries.find((entry) => entry.tier === "2-5")?.rows).toBe(1);
    expect(report.pointDeltaBucketSummaries.find((entry) => entry.tier === "10-20")?.rows).toBe(1);
    expect(report.draftableRangeSummaries.find((entry) => entry.segment === "top_300_overall")?.rows).toBe(3);
  });

  it("sorts top tables by rank movement magnitude", () => {
    const report = buildReport([
      row({ player: "Medium", position: "WR", overallRank: 150, positionRank: 45, pointDelta: 5, overallMove: 40, positionMove: 6 }),
      row({ player: "Big", position: "WR", overallRank: 120, positionRank: 35, pointDelta: 6, overallMove: 90, positionMove: 12 }),
    ]);

    expect(report.topMeaningfulOverallRankMovers[0]?.player).toBe("Big");
    expect(report.topMeaningfulPositionRankMovers[0]?.player).toBe("Big");
  });

  it("returns tier review when meaningful movement exists", () => {
    const report = buildReport([
      row({ player: "Review", position: "TE", overallRank: 95, positionRank: 10, pointDelta: 6, overallMove: 40, positionMove: 7 }),
    ]);

    expect(report.recommendation).toBe("rank_impact_needs_tier_review");
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("returns clean when movement is only small deep noise", () => {
    const report = buildReport([
      row({ player: "Noise", position: "DB", overallRank: 900, positionRank: 180, pointDelta: 1, overallMove: 90, positionMove: 12 }),
    ]);

    expect(report.summary.deepTierNoiseRows).toBe(1);
    expect(report.recommendation).toBe("rank_impact_clean_for_feature_flag_review");
  });

  it("does not mutate inputs", () => {
    const limited = limitedPool([row({ player: "Read Only", position: "RB", overallRank: 150, positionRank: 40, pointDelta: 4 })]);
    const before = JSON.stringify(limited);

    buildProjectionRankImpactQualityReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      limitedPool: limited,
      finalReadiness: finalReadiness(),
      shadow: shadow(),
      snapshot: snapshot(),
    });

    expect(JSON.stringify(limited)).toBe(before);
  });
});

function buildReport(rows: ProjectionLimitedPromotionPoolReviewRow[]) {
  return buildProjectionRankImpactQualityReviewFromData({
    options: { projectionSeason: 2026, includeIdp: true },
    limitedPool: limitedPool(rows),
    finalReadiness: finalReadiness(),
    shadow: shadow(),
    snapshot: snapshot(),
  });
}

function row(input: {
  player: string;
  position: string;
  overallRank: number;
  positionRank: number;
  pointDelta: number;
  overallMove?: number;
  positionMove?: number;
}): ProjectionLimitedPromotionPoolReviewRow {
  return {
    playerId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    universeEligibilityStatus: "active_plausible",
    finalClassification: "eligible_for_projection_promotion",
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    gamesDelta: 1,
    scoringAnchorPpg: 6,
    projectedPointDelta: input.pointDelta,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 100 + input.pointDelta,
    movementBucket: Math.abs(input.pointDelta) >= 10 ? "10-20" : Math.abs(input.pointDelta) >= 5 ? "5-10" : Math.abs(input.pointDelta) > 0 ? "0-5" : "0",
    expectedGamesMovementBucket: "1-2",
    estimatedPositionRankMovement: input.positionMove ?? 0,
    estimatedOverallRankMovement: input.overallMove ?? 0,
    currentPositionRank: input.positionRank,
    v82PositionRank: input.positionRank - (input.positionMove ?? 0),
    currentOverallRank: input.overallRank,
    v82OverallRank: input.overallRank - (input.overallMove ?? 0),
    riskFlags: [],
    reasonCodes: ["active_plausible_allowed"],
    cohortTags: [],
    criticalMovement: false,
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
