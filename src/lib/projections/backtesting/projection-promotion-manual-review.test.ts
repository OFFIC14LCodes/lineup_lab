import { describe, expect, it } from "vitest";

import {
  buildProjectionPromotionManualReviewFromData,
  manualReviewRow,
  renderProjectionPromotionManualReviewCsv,
} from "./projection-promotion-manual-review";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection promotion manual review packet", () => {
  it("filters only manual-review rows and assigns review actions", () => {
    const report = buildProjectionPromotionManualReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      universe: universe(),
      candidatePool: candidatePool([
        candidate({ player: "Eligible RB", classification: "eligible_for_projection_promotion", position: "RB", pointDelta: 5 }),
        candidate({ player: "No Prior K", classification: "manual_review_before_promotion", position: "K", pointDelta: 24, critical: true }),
        candidate({ player: "Rookie RB", classification: "manual_review_before_promotion", position: "RB", status: "rookie_or_new_player", pointDelta: 28, critical: true }),
        candidate({ player: "Veteran WR", classification: "manual_review_before_promotion", position: "WR", pointDelta: 22, critical: true }),
        candidate({ player: "Legacy QB", classification: "manual_review_before_promotion", position: "QB", status: "retired_or_legacy_suspect", pointDelta: 25, critical: true, riskFlags: ["retired_legacy_suspect"] }),
        candidate({ player: "Clean Review", classification: "manual_review_before_promotion", position: "RB", pointDelta: 9, riskFlags: [] }),
      ]),
      shadow: shadow([
        shadowRow({ player: "No Prior K", position: "K", pointDelta: 24, critical: true }),
        shadowRow({ player: "Rookie RB", position: "RB", pointDelta: 28, critical: true }),
        shadowRow({ player: "Veteran WR", position: "WR", pointDelta: 22, critical: true }),
        shadowRow({ player: "Legacy QB", position: "QB", pointDelta: 25, critical: true }),
        shadowRow({ player: "Clean Review", position: "RB", pointDelta: 9 }),
      ]),
    });

    expect(report.rows.map((row) => row.player)).not.toContain("Eligible RB");
    expect(report.summary.totalManualReviewRows).toBe(5);
    expect(find(report, "No Prior K").proposedReviewAction).toBe("needs_kicker_policy_review");
    expect(find(report, "Rookie RB").proposedReviewAction).toBe("needs_roster_confirmation");
    expect(find(report, "Veteran WR").proposedReviewAction).toBe("needs_model_policy_review");
    expect(find(report, "Legacy QB").proposedReviewAction).toBe("block_from_promotion");
    expect(find(report, "Clean Review").proposedReviewAction).toBe("approve_for_candidate_pool");
    expect(report.verdict).toBe("manual_review_packet_ready");
  });

  it("summarizes counts and sorts top movement rows", () => {
    const report = buildProjectionPromotionManualReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      universe: universe(),
      candidatePool: candidatePool([
        candidate({ player: "Small", classification: "manual_review_before_promotion", position: "RB", pointDelta: 8, riskFlags: [] }),
        candidate({ player: "Big", classification: "manual_review_before_promotion", position: "RB", pointDelta: -31, critical: true }),
        candidate({ player: "Kicker", classification: "manual_review_before_promotion", position: "K", pointDelta: 24, critical: true }),
      ]),
      shadow: shadow([
        shadowRow({ player: "Small", position: "RB", pointDelta: 8 }),
        shadowRow({ player: "Big", position: "RB", pointDelta: -31, critical: true }),
        shadowRow({ player: "Kicker", position: "K", pointDelta: 24, critical: true }),
      ]),
    });

    expect(report.topManualReviewRows[0]?.player).toBe("Big");
    expect(report.summary.proposedActionCounts.needs_kicker_policy_review).toBe(1);
    expect(report.summary.byPosition.RB).toBe(2);
    expect(report.summary.criticalMovementRows).toBe(2);
    expect(report.kickerManualReviewRows).toHaveLength(1);
  });

  it("renders CSV artifacts with proposed actions", () => {
    const report = buildProjectionPromotionManualReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      universe: universe(),
      candidatePool: candidatePool([candidate({ player: "No Prior K", classification: "manual_review_before_promotion", position: "K", pointDelta: 24, critical: true })]),
      shadow: shadow([shadowRow({ player: "No Prior K", position: "K", pointDelta: 24, critical: true })]),
    });

    const csv = renderProjectionPromotionManualReviewCsv(report);

    expect(csv).toContain("proposed_review_action");
    expect(csv).toContain("needs_kicker_policy_review");
  });

  it("returns no-rows verdict when candidate pool has no manual-review rows", () => {
    const report = buildProjectionPromotionManualReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      universe: universe(),
      candidatePool: candidatePool([candidate({ player: "Eligible RB", classification: "eligible_for_projection_promotion", position: "RB", pointDelta: 3 })]),
      shadow: shadow([]),
    });

    expect(report.verdict).toBe("manual_review_no_rows");
    expect(report.summary.totalManualReviewRows).toBe(0);
  });

  it("does not mutate candidate pool or shadow input", () => {
    const candidatePoolInput = candidatePool([candidate({ player: "Read Only", classification: "manual_review_before_promotion", position: "RB", pointDelta: 20, critical: true })]);
    const shadowInput = shadow([shadowRow({ player: "Read Only", position: "RB", pointDelta: 20, critical: true })]);
    const snapshotInput = snapshot();
    const universeInput = universe();
    const before = JSON.stringify({ candidatePoolInput, shadowInput, snapshotInput, universeInput });

    buildProjectionPromotionManualReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshotInput,
      universe: universeInput,
      candidatePool: candidatePoolInput,
      shadow: shadowInput,
    });

    expect(JSON.stringify({ candidatePoolInput, shadowInput, snapshotInput, universeInput })).toBe(before);
  });

  it("supports direct row conversion with shadow scoring anchor and guardrail reasons", () => {
    const row = manualReviewRow(
      candidate({ player: "Guardrail WR", classification: "manual_review_before_promotion", position: "WR", pointDelta: 21, critical: true }),
      shadowRow({ player: "Guardrail WR", position: "WR", pointDelta: 21, critical: true, reasons: ["high_impact_guardrail"] })
    );

    expect(row.scoringAnchorPpg).toBe(5);
    expect(row.v82GuardrailReasonCodes).toContain("high_impact_guardrail");
    expect(row.reviewRationale.join(" ")).toContain("v8.2 guardrail reasons");
  });
});

function find(report: ReturnType<typeof buildProjectionPromotionManualReviewFromData>, player: string) {
  const result = report.rows.find((row) => row.player === player);
  if (!result) throw new Error(`Missing ${player}`);
  return result;
}

function snapshot(): PreseasonProjectionSnapshot {
  return {
    metadata: {
      artifactType: "blackbird_preseason_projection_snapshot",
      projectionSeason: 2026,
      targetSeason: 2026,
      inputSeasons: [2024, 2025],
      excludedSeasons: [2026],
      leakageSafe: true,
      createdForBacktesting: true,
      modelVersion: "preseason_snapshot_v2",
      defaultUniverse: "fantasy-relevant",
      scoringSource: "default",
      scoringProfile: "default",
      notes: [],
    },
    rows: [],
    diagnostics: {
      playersConsidered: 0,
      playersProjected: 0,
      playersSkipped: 0,
      playersSkippedNoSignal: 0,
      universe: "fantasy-relevant",
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
    },
  };
}

function universe(): ProjectionUniverseEligibilityAuditReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json" },
    summary: {
      totalProjectedRows: 0,
      statusCounts: {
        active_plausible: 0,
        low_confidence_plausible: 0,
        rookie_or_new_player: 0,
        stale_historical_signal: 0,
        retired_or_legacy_suspect: 0,
        manual_review_required: 0,
      },
      byPosition: [],
      byCohort: [],
      byTeam: {},
      byLastActiveSeason: {},
    },
    rows: [],
    criticalMovementReview: [],
    retiredLegacySuspects: [],
    kickerReview: { totalKRows: 0, lowPriorFallbackRows: 0, criticalMovementRows: 0, movingEightToTwelveExpectedGames: 0, statusCounts: {}, recommendation: "" },
    safetyGates: [],
    verdict: "universe_blocked_for_promotion",
    notes: [],
  };
}

function candidatePool(rows: ProjectionPromotionCandidateRow[]): ProjectionPromotionCandidatePoolReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json", universeEligibilityAudit: "universe.json" },
    summary: {
      totalRows: rows.length,
      classificationCounts: {
        eligible_for_projection_promotion: 0,
        manual_review_before_promotion: 0,
        shadow_only: 0,
        blocked_from_promotion: 0,
      },
      byUniverseStatus: {},
      byPosition: {},
      byCohort: {},
      byTeamSignal: {},
      byMovementBucket: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      byRiskFlag: {},
      byRecommendedAction: {
        ready_for_promotion_review_pool: 0,
        manual_review_required_before_promotion: 0,
        keep_shadow_only: 0,
        exclude_from_promotion_candidate_pool: 0,
        review_kicker_policy_before_promotion: 0,
      },
    },
    poolMetrics: [],
    rows,
    topEligibleMovements: [],
    topManualReviewMovements: [],
    topBlockedMovements: [],
    topShadowOnlyMovements: [],
    criticalMovementRows: [],
    kickerPolicy: { totalKRows: 0, eligibleKRows: 0, manualReviewKRows: 0, shadowOnlyKRows: 0, blockedKRows: 0, criticalMovementKRows: 0, excludedFromEligiblePoolRows: 0, recommendation: "" },
    safetyGates: [],
    verdict: "promotion_pool_needs_manual_review",
    notes: [],
  };
}

function candidate(input: {
  player: string;
  classification: ProjectionPromotionCandidateRow["promotionEligibilityClassification"];
  position: string;
  pointDelta: number;
  status?: ProjectionPromotionCandidateRow["universeEligibilityStatus"];
  critical?: boolean;
  riskFlags?: string[];
}): ProjectionPromotionCandidateRow {
  const critical = input.critical ?? Math.abs(input.pointDelta) >= 20;
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    universeEligibilityStatus: input.status ?? "active_plausible",
    promotionEligibilityClassification: input.classification,
    reasonCodes: critical ? ["critical_movement_manual_review"] : ["active_plausible_allowed"],
    universeReasonCodes: ["has_current_team"],
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    gamesDelta: 1,
    projectedTotalPointDelta: input.pointDelta,
    movementBucket: critical ? "20+" : "5-10",
    criticalMovement: critical,
    rankingMovementEstimated: true,
    estimatedOverallRankMovement: 2,
    recommendedAction: "manual_review_required_before_promotion",
    riskFlags: input.riskFlags ?? (critical ? ["critical_movement"] : []),
    cohortTags: [input.position === "K" ? "kicker" : "offense"],
    lastActiveSeason: 2025,
    priorGames: 20,
    noPriorNflData: input.status === "rookie_or_new_player",
    matchConfidence: "exact_id",
  };
}

function shadow(rows: ProjectionV82ShadowRow[]): ProjectionV82ShadowReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    currentModel: "blackbird_expected_games_v7_family_selective",
    shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail",
    sourceArtifacts: { snapshot: "snapshot.json" },
    rowCoverage: {
      currentLiveProjectionRows: rows.length,
      v82ShadowRows: rows.length,
      sharedRows: rows.length,
      currentOnlyRows: 0,
      v82OnlyRows: 0,
      rowsSkipped: 0,
      skipReasons: {},
      positionCounts: {},
      cohortCounts: {},
    },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [],
    cohortMovementSummary: [],
    rows,
    topMovements: rows,
    criticalMovements: rows.filter((row) => row.risk === "critical"),
    rankingRiskPreview: {
      estimated: true,
      reason: "",
      rowsWithEstimatedOverallRankMovement: rows.length,
      rowsWithEstimatedPositionRankMovement: rows.length,
      topOverallRankMovements: [],
      topPositionRankMovements: [],
    },
    safetyGates: [],
    recommendation: "shadow_candidate_with_manual_review",
    notes: [],
  };
}

function shadowRow(input: { player: string; position: string; pointDelta: number; critical?: boolean; reasons?: string[] }): ProjectionV82ShadowRow {
  const critical = input.critical ?? Math.abs(input.pointDelta) >= 20;
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    cohorts: [],
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    expectedGamesDelta: 1,
    ppgAnchor: 5,
    projectedTotalPointDelta: input.pointDelta,
    currentProjectedTotal: 40,
    shadowProjectedTotal: 40 + input.pointDelta,
    movementBucket: critical ? "20+" : "5-10",
    gamesBucket: "0.5-1",
    risk: critical ? "critical" : "low",
    riskFlags: critical ? ["large_games_movement"] : [],
    reasonCodes: input.reasons ?? [],
    guardrailApplied: false,
    currentOverallRank: 1,
    shadowOverallRank: 1,
    estimatedOverallRankMovement: 2,
    currentPositionRank: 1,
    shadowPositionRank: 1,
    estimatedPositionRankMovement: 1,
    criticalReviewStatus: critical ? "needs_manual_review" : null,
  };
}
