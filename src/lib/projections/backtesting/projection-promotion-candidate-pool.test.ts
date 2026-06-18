import { describe, expect, it } from "vitest";

import {
  buildProjectionPromotionCandidatePoolFromData,
  classifyPromotionRow,
  renderProjectionPromotionCandidatePoolCsv,
} from "./projection-promotion-candidate-pool";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionUniverseEligibilityAuditReport, ProjectionUniverseEligibilityRow } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection promotion candidate pool", () => {
  it("classifies eligible, legacy-blocked, kicker, critical, and rookie movement rows", () => {
    const report = buildProjectionPromotionCandidatePoolFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      shadow: shadow([
        shadowRow({ player: "Active RB", position: "RB", pointDelta: 4 }),
        shadowRow({ player: "Eli Manning", position: "QB", pointDelta: 29, critical: true }),
        shadowRow({ player: "No Prior K", position: "K", pointDelta: 24, critical: true }),
        shadowRow({ player: "Critical Vet", position: "WR", pointDelta: 22, critical: true }),
        shadowRow({ player: "Rookie Rocket", position: "RB", pointDelta: 25, critical: true }),
        shadowRow({ player: "Stale WR", position: "WR", pointDelta: 7 }),
      ]),
      universe: universe([
        universeRow({ player: "Active RB", position: "RB", status: "active_plausible", pointDelta: 4 }),
        universeRow({ player: "Eli Manning", position: "QB", status: "retired_or_legacy_suspect", pointDelta: 29, critical: true, reasonCodes: ["legacy_name_match", "manual_review_name_flag"] }),
        universeRow({ player: "No Prior K", position: "K", status: "rookie_or_new_player", pointDelta: 24, critical: true, reasonCodes: ["kicker_low_prior_fallback"] }),
        universeRow({ player: "Critical Vet", position: "WR", status: "active_plausible", pointDelta: 22, critical: true }),
        universeRow({ player: "Rookie Rocket", position: "RB", status: "rookie_or_new_player", pointDelta: 25, critical: true }),
        universeRow({ player: "Stale WR", position: "WR", status: "stale_historical_signal", pointDelta: 7, lastActiveSeason: 2023 }),
      ]),
    });

    expect(find(report, "Active RB").promotionEligibilityClassification).toBe("eligible_for_projection_promotion");
    expect(find(report, "Active RB").reasonCodes).toContain("active_plausible_allowed");
    expect(find(report, "Eli Manning").promotionEligibilityClassification).toBe("blocked_from_promotion");
    expect(find(report, "Eli Manning").reasonCodes).toEqual(expect.arrayContaining(["retired_legacy_blocked", "manual_name_flag_blocked"]));
    expect(find(report, "No Prior K").promotionEligibilityClassification).toBe("manual_review_before_promotion");
    expect(find(report, "No Prior K").reasonCodes).toContain("kicker_policy_shadow_only");
    expect(find(report, "Critical Vet").promotionEligibilityClassification).toBe("manual_review_before_promotion");
    expect(find(report, "Critical Vet").reasonCodes).toEqual(expect.arrayContaining(["critical_movement_manual_review", "high_impact_manual_review"]));
    expect(find(report, "Rookie Rocket").reasonCodes).toContain("rookie_extreme_movement_review");
    expect(find(report, "Stale WR").promotionEligibilityClassification).toBe("shadow_only");
  });

  it("keeps all K rows out of the promotion-eligible pool and passes gates", () => {
    const report = buildProjectionPromotionCandidatePoolFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      shadow: shadow([shadowRow({ player: "No Prior K", position: "K", pointDelta: 2 })]),
      universe: universe([universeRow({ player: "No Prior K", position: "K", status: "active_plausible", pointDelta: 2 })]),
    });

    expect(report.kickerPolicy.totalKRows).toBe(1);
    expect(report.kickerPolicy.eligibleKRows).toBe(0);
    expect(report.safetyGates.find((gate) => gate.name === "k_rows_not_eligible_initially")?.passed).toBe(true);
  });

  it("generates pool summaries and sorts top movements by absolute point delta", () => {
    const report = buildProjectionPromotionCandidatePoolFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      shadow: shadow([
        shadowRow({ player: "Small Eligible", position: "RB", pointDelta: 2 }),
        shadowRow({ player: "Bigger Eligible", position: "RB", pointDelta: -8 }),
        shadowRow({ player: "Manual WR", position: "WR", pointDelta: 21, critical: true }),
      ]),
      universe: universe([
        universeRow({ player: "Small Eligible", position: "RB", status: "active_plausible", pointDelta: 2 }),
        universeRow({ player: "Bigger Eligible", position: "RB", status: "active_plausible", pointDelta: -8 }),
        universeRow({ player: "Manual WR", position: "WR", status: "active_plausible", pointDelta: 21, critical: true }),
      ]),
    });

    expect(report.summary.classificationCounts.eligible_for_projection_promotion).toBe(2);
    expect(report.summary.classificationCounts.manual_review_before_promotion).toBe(1);
    expect(report.topEligibleMovements[0]?.player).toBe("Bigger Eligible");
    expect(report.poolMetrics.find((metric) => metric.segment === "promotion_eligible_rows_only")?.rows).toBe(2);
    expect(report.verdict).toBe("promotion_pool_needs_manual_review");
  });

  it("renders CSV artifacts with promotion classifications", () => {
    const report = buildProjectionPromotionCandidatePoolFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot(),
      shadow: shadow([shadowRow({ player: "Active RB", position: "RB", pointDelta: 4 })]),
      universe: universe([universeRow({ player: "Active RB", position: "RB", status: "active_plausible", pointDelta: 4 })]),
    });

    const csv = renderProjectionPromotionCandidatePoolCsv(report);

    expect(csv).toContain("promotion_eligibility_classification");
    expect(csv).toContain("eligible_for_projection_promotion");
  });

  it("does not mutate source audit or shadow rows", () => {
    const snapshotInput = snapshot();
    const shadowInput = shadow([shadowRow({ player: "Read Only", position: "RB", pointDelta: 1 })]);
    const universeInput = universe([universeRow({ player: "Read Only", position: "RB", status: "active_plausible", pointDelta: 1 })]);
    const before = JSON.stringify({ snapshotInput, shadowInput, universeInput });

    buildProjectionPromotionCandidatePoolFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshotInput,
      shadow: shadowInput,
      universe: universeInput,
    });

    expect(JSON.stringify({ snapshotInput, shadowInput, universeInput })).toBe(before);
  });

  it("supports direct row classification for stale missing-team blockers", () => {
    const row = classifyPromotionRow(universeRow({
      player: "Old Missing",
      position: "WR",
      team: null,
      status: "stale_historical_signal",
      pointDelta: 1,
      lastActiveSeason: 2020,
      reasonCodes: ["missing_current_team", "old_last_seen_season", "no_2026_roster_signal"],
    }), null);

    expect(row.promotionEligibilityClassification).toBe("blocked_from_promotion");
    expect(row.reasonCodes).toEqual(expect.arrayContaining(["missing_current_team_blocked", "old_last_seen_blocked"]));
  });
});

function find(report: ReturnType<typeof buildProjectionPromotionCandidatePoolFromData>, player: string) {
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

function universe(rows: ProjectionUniverseEligibilityRow[]): ProjectionUniverseEligibilityAuditReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json" },
    summary: {
      totalProjectedRows: rows.length,
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
    rows,
    criticalMovementReview: rows.filter((row) => row.criticalMovement),
    retiredLegacySuspects: rows.filter((row) => row.eligibilityStatus === "retired_or_legacy_suspect"),
    kickerReview: {
      totalKRows: rows.filter((row) => row.position === "K").length,
      lowPriorFallbackRows: 0,
      criticalMovementRows: rows.filter((row) => row.position === "K" && row.criticalMovement).length,
      movingEightToTwelveExpectedGames: 0,
      statusCounts: {},
      recommendation: "",
    },
    safetyGates: [],
    verdict: "universe_blocked_for_promotion",
    notes: [],
  };
}

function universeRow(input: {
  player: string;
  position: string;
  status: ProjectionUniverseEligibilityRow["eligibilityStatus"];
  pointDelta: number;
  critical?: boolean;
  team?: string | null;
  reasonCodes?: ProjectionUniverseEligibilityRow["reasonCodes"];
  lastActiveSeason?: number | null;
  priorGames?: number;
  noPrior?: boolean;
}): ProjectionUniverseEligibilityRow {
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: input.team === undefined ? "TST" : input.team,
    eligibilityStatus: input.status,
    reasonCodes: input.reasonCodes ?? ["has_current_team", "recent_nfl_activity", "no_2026_roster_signal"],
    recommendedAction: "safe_to_shadow",
    lastActiveSeason: input.lastActiveSeason === undefined ? 2025 : input.lastActiveSeason,
    priorGames: input.priorGames ?? 20,
    noPriorNflData: input.noPrior ?? input.status === "rookie_or_new_player",
    matchConfidence: "exact_id",
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    gamesDelta: 1,
    projectedTotalPointDelta: input.pointDelta,
    shadowMovementBucket: Math.abs(input.pointDelta) >= 20 ? "20+" : "0-5",
    criticalMovement: input.critical ?? Math.abs(input.pointDelta) >= 20,
    estimatedOverallRankMovement: 0,
    projectionSignalSource: "test",
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
    criticalMovements: rows.filter((entry) => entry.risk === "critical"),
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

function shadowRow(input: { player: string; position: string; pointDelta: number; critical?: boolean }): ProjectionV82ShadowRow {
  const critical = input.critical ?? Math.abs(input.pointDelta) >= 20;
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    cohorts: input.position === "K" ? ["kicker", "k_fallback"] : ["offense"],
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    expectedGamesDelta: 1,
    ppgAnchor: 5,
    projectedTotalPointDelta: input.pointDelta,
    currentProjectedTotal: 40,
    shadowProjectedTotal: 40 + input.pointDelta,
    movementBucket: critical ? "20+" : "0-5",
    gamesBucket: "0.5-1",
    risk: critical ? "critical" : "low",
    riskFlags: critical ? ["large_games_movement"] : [],
    reasonCodes: [],
    guardrailApplied: false,
    currentOverallRank: 1,
    shadowOverallRank: 1,
    estimatedOverallRankMovement: 0,
    currentPositionRank: 1,
    shadowPositionRank: 1,
    estimatedPositionRankMovement: 0,
    criticalReviewStatus: critical ? "needs_manual_review" : null,
  };
}
