import { describe, expect, it } from "vitest";

import { buildProjectionLimitedPromotionPoolReviewFromData } from "./projection-limited-promotion-pool-review";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionReadinessFinalReport, ProjectionPromotionReadinessFinalRow } from "./projection-promotion-readiness-final-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection limited promotion-pool review", () => {
  it("filters to eligible rows and reports excluded rows", () => {
    const report = buildReport([
      row({ player: "Eligible RB", position: "RB", classification: "eligible_for_projection_promotion", delta: 12, gamesDelta: 2 }),
      row({ player: "Critical QB", position: "QB", classification: "shadow_only", delta: 24, critical: true }),
      row({ player: "Kicker", position: "K", classification: "shadow_only", delta: 18 }),
      row({ player: "Legacy WR", position: "WR", classification: "blocked_from_promotion", status: "retired_or_legacy_suspect", delta: 4 }),
    ]);

    expect(report.eligibleRows.map((entry) => entry.player)).toEqual(["Eligible RB"]);
    expect(report.excludedCounts.criticalMovementRowsExcluded).toBe(1);
    expect(report.excludedCounts.kRowsExcluded).toBe(1);
    expect(report.excludedCounts.legacyRetiredRowsExcluded).toBe(1);
    expect(report.excludedCounts.shadowOnlyRowsExcluded).toBe(2);
    expect(report.excludedCounts.blockedRowsExcluded).toBe(1);
  });

  it("builds movement bucket summaries for eligible rows", () => {
    const report = buildReport([
      row({ player: "Zero", position: "WR", classification: "eligible_for_projection_promotion", delta: 0, gamesDelta: 0 }),
      row({ player: "Small", position: "WR", classification: "eligible_for_projection_promotion", delta: 4.9, gamesDelta: 0.4 }),
      row({ player: "Medium", position: "RB", classification: "eligible_for_projection_promotion", delta: 7, gamesDelta: 0.7 }),
      row({ player: "Large", position: "QB", classification: "eligible_for_projection_promotion", delta: 12, gamesDelta: 2.2 }),
    ]);

    expect(report.movementSummary.rows).toBe(4);
    expect(report.movementSummary.movementBuckets).toMatchObject({ "0": 1, "0-5": 1, "5-10": 1, "10-20": 1, "20+": 0 });
    expect(report.movementSummary.expectedGamesMovementBuckets["2-4"]).toBe(1);
    expect(report.movementSummary.maxProjectedPointDelta).toBe(12);
  });

  it("builds position and cohort summaries", () => {
    const report = buildReport([
      row({ player: "QB", position: "QB", classification: "eligible_for_projection_promotion", delta: 11, riskFlags: ["high_value_position"] }),
      row({ player: "LB", position: "LB", classification: "eligible_for_projection_promotion", delta: 6, riskFlags: ["idp_row"] }),
      row({ player: "Rookie DB", position: "DB", classification: "eligible_for_projection_promotion", delta: 3, status: "rookie_or_new_player", riskFlags: ["idp_row", "rookie_or_low_prior"] }),
    ]);

    expect(report.positionSummary.find((entry) => entry.segment === "QB")?.rows).toBe(1);
    expect(report.positionSummary.find((entry) => entry.segment === "LB")?.rows).toBe(1);
    expect(report.cohortSummary.find((entry) => entry.segment === "offense")?.rows).toBe(1);
    expect(report.cohortSummary.find((entry) => entry.segment === "idp")?.rows).toBe(2);
    expect(report.cohortSummary.find((entry) => entry.segment === "low_prior_sample")?.rows).toBe(1);
  });

  it("reports rank movement estimates and sorts rank movement tables", () => {
    const report = buildReport([
      row({ player: "Riser", position: "RB", classification: "eligible_for_projection_promotion", delta: 9, positionRankMove: 12, overallRankMove: 55 }),
      row({ player: "Faller", position: "WR", classification: "eligible_for_projection_promotion", delta: -8, positionRankMove: -11, overallRankMove: -52 }),
      row({ player: "Flat", position: "TE", classification: "eligible_for_projection_promotion", delta: 1, positionRankMove: 1, overallRankMove: 2 }),
    ]);

    expect(report.rankImpactPreview.estimated).toBe(true);
    expect(report.rankImpactPreview.rowsMoving10PlusPositionRanks).toBe(2);
    expect(report.rankImpactPreview.rowsMoving50PlusOverallRanks).toBe(2);
    expect(report.rankImpactPreview.topPositionRankRisers[0]?.player).toBe("Riser");
    expect(report.rankImpactPreview.topPositionRankFallers[0]?.player).toBe("Faller");
  });

  it("blocks when critical or K rows enter eligible pool", () => {
    const report = buildReport([
      row({ player: "Critical RB", position: "RB", classification: "eligible_for_projection_promotion", delta: 21, critical: true }),
      row({ player: "Kicker", position: "K", classification: "eligible_for_projection_promotion", delta: 2 }),
    ]);

    expect(report.safetyGates.find((gate) => gate.name === "critical_movements_excluded")?.passed).toBe(false);
    expect(report.safetyGates.find((gate) => gate.name === "k_rows_excluded")?.passed).toBe(false);
    expect(report.safetyGates.find((gate) => gate.name === "no_20_plus_movement_in_eligible_pool")?.passed).toBe(false);
    expect(report.recommendation).toBe("limited_pool_blocked");
  });

  it("returns rank-impact review when 10-20 movement remains", () => {
    const report = buildReport([
      row({ player: "Review RB", position: "RB", classification: "eligible_for_projection_promotion", delta: 12 }),
    ]);

    expect(report.recommendation).toBe("limited_pool_needs_rank_impact_review");
  });

  it("returns clean when small eligible movement remains", () => {
    const report = buildReport([
      row({ player: "Small WR", position: "WR", classification: "eligible_for_projection_promotion", delta: 3, overallRankMove: 4, positionRankMove: 1 }),
    ]);

    expect(report.recommendation).toBe("limited_pool_clean_for_feature_flag_review");
  });

  it("does not mutate final readiness inputs", () => {
    const rows = [row({ player: "Read Only", position: "RB", classification: "eligible_for_projection_promotion", delta: 7 })];
    const final = finalReadiness(rows);
    const before = JSON.stringify(final);

    buildProjectionLimitedPromotionPoolReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      finalReadiness: final,
      candidatePool: candidatePool(),
      shadow: shadow(rows),
      universe: universe(),
      snapshot: snapshot(),
    });

    expect(JSON.stringify(final)).toBe(before);
  });
});

function buildReport(rows: ProjectionPromotionReadinessFinalRow[]) {
  return buildProjectionLimitedPromotionPoolReviewFromData({
    options: { projectionSeason: 2026, includeIdp: true },
    finalReadiness: finalReadiness(rows),
    candidatePool: candidatePool(),
    shadow: shadow(rows),
    universe: universe(),
    snapshot: snapshot(),
  });
}

function row(input: {
  player: string;
  position: string;
  classification: ProjectionPromotionReadinessFinalRow["finalClassification"];
  delta: number;
  gamesDelta?: number;
  critical?: boolean;
  status?: ProjectionPromotionReadinessFinalRow["universeEligibilityStatus"];
  riskFlags?: string[];
  positionRankMove?: number | null;
  overallRankMove?: number | null;
}): ProjectionPromotionReadinessFinalRow {
  return {
    playerId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    universeEligibilityStatus: input.status ?? "active_plausible",
    originalClassification: input.classification,
    finalClassification: input.classification,
    decision: null,
    decisionRationale: null,
    reviewer: null,
    reviewedAt: null,
    projectedTotalPointDelta: input.delta,
    currentExpectedGames: 8,
    v82ExpectedGames: 8 + (input.gamesDelta ?? 1),
    gamesDelta: input.gamesDelta ?? 1,
    criticalMovement: input.critical ?? false,
    movementBucket: Math.abs(input.delta) >= 10 ? "10-20" : Math.abs(input.delta) >= 5 ? "5-10" : Math.abs(input.delta) > 0 ? "0-5" : "0",
    riskFlags: input.riskFlags ?? [],
    reasonCodes: input.status === "rookie_or_new_player" ? ["rookie_allowed"] : ["active_plausible_allowed"],
    source: input.classification === "eligible_for_projection_promotion" ? "candidate_pool" : "review_decision",
  };
}

function shadow(rows: ProjectionPromotionReadinessFinalRow[]): ProjectionV82ShadowReport {
  const shadowRows = rows.map((entry): ProjectionV82ShadowRow => ({
    playerId: entry.playerId,
    sleeperId: entry.playerId,
    gsisId: entry.playerId,
    player: entry.player,
    position: entry.position,
    team: entry.team,
    cohorts: [],
    currentExpectedGames: entry.currentExpectedGames ?? 0,
    v82ExpectedGames: entry.v82ExpectedGames ?? 0,
    expectedGamesDelta: entry.gamesDelta ?? 0,
    ppgAnchor: 6,
    projectedTotalPointDelta: entry.projectedTotalPointDelta ?? 0,
    currentProjectedTotal: 60,
    shadowProjectedTotal: 60 + (entry.projectedTotalPointDelta ?? 0),
    movementBucket: Math.abs(entry.projectedTotalPointDelta ?? 0) >= 20 ? "20+" : Math.abs(entry.projectedTotalPointDelta ?? 0) >= 10 ? "10-20" : Math.abs(entry.projectedTotalPointDelta ?? 0) >= 5 ? "5-10" : Math.abs(entry.projectedTotalPointDelta ?? 0) > 0 ? "0-5" : "0",
    gamesBucket: Math.abs(entry.gamesDelta ?? 0) >= 4 ? "4+" : Math.abs(entry.gamesDelta ?? 0) >= 2 ? "2-4" : Math.abs(entry.gamesDelta ?? 0) >= 1 ? "1-2" : Math.abs(entry.gamesDelta ?? 0) >= 0.5 ? "0.5-1" : Math.abs(entry.gamesDelta ?? 0) > 0 ? "0-0.5" : "0",
    risk: entry.criticalMovement ? "critical" : "low",
    riskFlags: [...entry.riskFlags],
    reasonCodes: [...entry.reasonCodes],
    guardrailApplied: false,
    currentOverallRank: 100,
    shadowOverallRank: 100 - (entry.player === "Riser" ? 55 : entry.player === "Faller" ? -52 : 2),
    estimatedOverallRankMovement: entry.player === "Riser" ? 55 : entry.player === "Faller" ? -52 : entry.player === "Flat" ? 2 : null,
    currentPositionRank: 20,
    shadowPositionRank: 20 - (entry.player === "Riser" ? 12 : entry.player === "Faller" ? -11 : 1),
    estimatedPositionRankMovement: entry.player === "Riser" ? 12 : entry.player === "Faller" ? -11 : entry.player === "Flat" ? 1 : null,
    criticalReviewStatus: entry.criticalMovement ? "needs_manual_review" : "safe_shadow_difference",
  }));
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    currentModel: "blackbird_expected_games_v7_family_selective",
    shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail",
    sourceArtifacts: { snapshot: "snapshot.json" },
    rowCoverage: { currentLiveProjectionRows: rows.length, v82ShadowRows: rows.length, sharedRows: rows.length, currentOnlyRows: 0, v82OnlyRows: 0, rowsSkipped: 0, skipReasons: {}, positionCounts: {}, cohortCounts: {} },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [],
    cohortMovementSummary: [],
    rows: shadowRows,
    topMovements: shadowRows,
    criticalMovements: shadowRows.filter((entry) => entry.risk === "critical"),
    rankingRiskPreview: { estimated: true, reason: "", rowsWithEstimatedOverallRankMovement: 0, rowsWithEstimatedPositionRankMovement: 0, topOverallRankMovements: [], topPositionRankMovements: [] },
    safetyGates: [],
    recommendation: "shadow_candidate_with_manual_review",
    notes: [],
  };
}

function finalReadiness(rows: ProjectionPromotionReadinessFinalRow[]): ProjectionPromotionReadinessFinalReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    decisionsFile: "conservative.csv",
    sourceArtifacts: { reviewDecisions: "", promotionCandidatePool: "", promotionManualReview: "", shadow: "", universeEligibilityAudit: "" },
    validationIssues: [],
    policyViolations: [],
    finalRows: rows,
    summary: {
      eligibleRows: rows.filter((entry) => entry.finalClassification === "eligible_for_projection_promotion").length,
      manualReviewRowsRemaining: rows.filter((entry) => entry.finalClassification === "manual_review_before_promotion").length,
      shadowOnlyRows: rows.filter((entry) => entry.finalClassification === "shadow_only").length,
      blockedRows: rows.filter((entry) => entry.finalClassification === "blocked_from_promotion").length,
      kRows: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 },
      criticalMovementRows: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 },
      unresolvedRows: 0,
      validationErrors: 0,
      policyViolations: 0,
    },
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

function candidatePool(): ProjectionPromotionCandidatePoolReport {
  return {
    generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true,
    sourceArtifacts: { snapshot: "", shadow: "", universeEligibilityAudit: "" },
    summary: { totalRows: 0, classificationCounts: { eligible_for_projection_promotion: 0, manual_review_before_promotion: 0, shadow_only: 0, blocked_from_promotion: 0 }, byUniverseStatus: {}, byPosition: {}, byCohort: {}, byTeamSignal: {}, byMovementBucket: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 }, byRiskFlag: {}, byRecommendedAction: { ready_for_promotion_review_pool: 0, manual_review_required_before_promotion: 0, keep_shadow_only: 0, exclude_from_promotion_candidate_pool: 0, review_kicker_policy_before_promotion: 0 } },
    poolMetrics: [], rows: [], topEligibleMovements: [], topManualReviewMovements: [], topBlockedMovements: [], topShadowOnlyMovements: [], criticalMovementRows: [],
    kickerPolicy: { totalKRows: 0, eligibleKRows: 0, manualReviewKRows: 0, shadowOnlyKRows: 0, blockedKRows: 0, criticalMovementKRows: 0, excludedFromEligiblePoolRows: 0, recommendation: "" },
    safetyGates: [], verdict: "promotion_pool_clean_for_review", notes: [],
  };
}

function universe(): ProjectionUniverseEligibilityAuditReport {
  return {
    generatedAt: "", dryRun: true, readOnly: true, projectionSeason: 2026, includeIdp: true,
    sourceArtifacts: { snapshot: "", shadow: "" },
    summary: { totalProjectedRows: 0, statusCounts: { active_plausible: 0, low_confidence_plausible: 0, rookie_or_new_player: 0, stale_historical_signal: 0, retired_or_legacy_suspect: 0, manual_review_required: 0 }, byPosition: [], byCohort: [], byTeam: {}, byLastActiveSeason: {} },
    rows: [], criticalMovementReview: [], retiredLegacySuspects: [],
    kickerReview: { totalKRows: 0, lowPriorFallbackRows: 0, criticalMovementRows: 0, movingEightToTwelveExpectedGames: 0, statusCounts: {}, recommendation: "" },
    safetyGates: [], verdict: "universe_clean_for_shadow", notes: [],
  };
}

function snapshot(): PreseasonProjectionSnapshot {
  return {
    metadata: { artifactType: "blackbird_preseason_projection_snapshot", projectionSeason: 2026, targetSeason: 2026, inputSeasons: [], excludedSeasons: [], leakageSafe: true, createdForBacktesting: true, modelVersion: "preseason_snapshot_v2", defaultUniverse: "fantasy-relevant", scoringSource: "default", scoringProfile: "default", notes: [] },
    rows: [],
    diagnostics: { playersConsidered: 0, playersProjected: 0, playersSkipped: 0, playersSkippedNoSignal: 0, universe: "fantasy-relevant", variantCounts: {}, cohortCounts: {}, noPriorTypeCounts: {}, noPriorCount: 0, idpCount: 0, averageProjectedGames: null, averageProjectedPpgByPosition: {}, confidenceDistribution: {}, warningsByType: {}, leakageSafety: { passed: true, targetSeasonExcludedFromInputs: true, noPostTargetProjectionArtifactsUsed: true, notes: [] } },
  };
}
