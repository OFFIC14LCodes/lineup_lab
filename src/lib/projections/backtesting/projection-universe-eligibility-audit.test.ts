import { describe, expect, it } from "vitest";

import {
  buildProjectionUniverseEligibilityAuditFromData,
  renderProjectionUniverseEligibilityAuditCsv,
} from "./projection-universe-eligibility-audit";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

describe("projection universe eligibility audit", () => {
  it("classifies active, rookie, stale, legacy, and manual-review rows", () => {
    const report = buildProjectionUniverseEligibilityAuditFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        row({ player: "Active RB", position: "RB", seasons: [2024, 2025], priorGames: 28 }),
        row({ player: "Rookie RB", position: "RB", seasons: [], priorGames: 0, noPrior: true }),
        row({ player: "Stale WR", position: "WR", seasons: [2022], priorGames: 20 }),
        row({ player: "Eli Manning", position: "QB", seasons: [2019], priorGames: 200 }),
        row({ player: "Critical Missing", position: "QB", team: null, seasons: [2025], priorGames: 20 }),
        row({ player: "Low IDP", position: "LB", seasons: [2025], priorGames: 4 }),
      ]),
      shadow: shadow([
        shadowRow({ player: "Active RB", position: "RB", pointDelta: 4 }),
        shadowRow({ player: "Rookie RB", position: "RB", pointDelta: 20, critical: true }),
        shadowRow({ player: "Stale WR", position: "WR", pointDelta: 2 }),
        shadowRow({ player: "Eli Manning", position: "QB", pointDelta: 29, critical: true }),
        shadowRow({ player: "Critical Missing", position: "QB", pointDelta: 25, critical: true }),
        shadowRow({ player: "Low IDP", position: "LB", pointDelta: 1 }),
      ]),
    });

    expect(find(report, "Active RB").eligibilityStatus).toBe("active_plausible");
    expect(find(report, "Rookie RB").eligibilityStatus).toBe("rookie_or_new_player");
    expect(find(report, "Stale WR").eligibilityStatus).toBe("stale_historical_signal");
    expect(find(report, "Eli Manning").eligibilityStatus).toBe("retired_or_legacy_suspect");
    expect(find(report, "Eli Manning").reasonCodes).toEqual(expect.arrayContaining(["legacy_name_match", "manual_review_name_flag"]));
    expect(find(report, "Critical Missing").eligibilityStatus).toBe("manual_review_required");
    expect(find(report, "Low IDP").reasonCodes).toContain("idp_low_prior_fallback");
    expect(report.summary.statusCounts.retired_or_legacy_suspect).toBe(1);
    expect(report.summary.statusCounts.manual_review_required).toBe(1);
  });

  it("assigns recommended actions and reports critical movement rows", () => {
    const report = buildProjectionUniverseEligibilityAuditFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        row({ player: "Philip Rivers", position: "QB", seasons: [2020], priorGames: 200 }),
        row({ player: "Critical Rookie", position: "RB", seasons: [], priorGames: 0, noPrior: true }),
      ]),
      shadow: shadow([
        shadowRow({ player: "Philip Rivers", position: "QB", pointDelta: 25, critical: true }),
        shadowRow({ player: "Critical Rookie", position: "RB", pointDelta: 30, critical: true }),
      ]),
    });

    expect(find(report, "Philip Rivers").recommendedAction).toBe("exclude_from_promotion_candidate_pool");
    expect(find(report, "Critical Rookie").recommendedAction).toBe("manual_review_before_promotion");
    expect(report.criticalMovementReview).toHaveLength(2);
    expect(report.retiredLegacySuspects.map((entry) => entry.player)).toContain("Philip Rivers");
  });

  it("summarizes kicker low-prior fallback policy risk", () => {
    const report = buildProjectionUniverseEligibilityAuditFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        row({ player: "No Prior K", position: "K", seasons: [], priorGames: 0, noPrior: true, v7GateReason: "k_hard_baseline_fallback" }),
      ]),
      shadow: shadow([
        shadowRow({ player: "No Prior K", position: "K", currentGames: 8, v82Games: 12, pointDelta: 24, critical: true }),
      ]),
    });

    expect(report.kickerReview.totalKRows).toBe(1);
    expect(report.kickerReview.lowPriorFallbackRows).toBe(1);
    expect(report.kickerReview.movingEightToTwelveExpectedGames).toBe(1);
    expect(find(report, "No Prior K").recommendedAction).toBe("needs_kicker_policy_review");
    expect(report.kickerReview.recommendation).toContain("Keep K on current/v7 fallback");
  });

  it("renders artifact CSV rows", () => {
    const report = buildProjectionUniverseEligibilityAuditFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([row({ player: "Active RB", position: "RB", seasons: [2025], priorGames: 20 })]),
      shadow: shadow([shadowRow({ player: "Active RB", position: "RB", pointDelta: 1 })]),
    });

    const csv = renderProjectionUniverseEligibilityAuditCsv(report);

    expect(csv).toContain("eligibility_status");
    expect(csv).toContain("Active RB");
  });

  it("does not mutate snapshot or shadow input data", () => {
    const snapshotInput = snapshot([row({ player: "Read Only", position: "RB", seasons: [2025], priorGames: 20 })]);
    const shadowInput = shadow([shadowRow({ player: "Read Only", position: "RB", pointDelta: 1 })]);
    const before = JSON.stringify({ snapshotInput, shadowInput });

    buildProjectionUniverseEligibilityAuditFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshotInput,
      shadow: shadowInput,
    });

    expect(JSON.stringify({ snapshotInput, shadowInput })).toBe(before);
  });
});

function find(report: ReturnType<typeof buildProjectionUniverseEligibilityAuditFromData>, player: string) {
  const result = report.rows.find((row) => row.player === player);
  if (!result) throw new Error(`Missing ${player}`);
  return result;
}

function snapshot(rows: PreseasonProjectionSnapshotRow[]): PreseasonProjectionSnapshot {
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
    rows,
    diagnostics: {
      playersConsidered: rows.length,
      playersProjected: rows.length,
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

function row(input: {
  player: string;
  position: string;
  seasons: number[];
  priorGames: number;
  team?: string | null;
  noPrior?: boolean;
  v7GateReason?: string;
}): PreseasonProjectionSnapshotRow {
  return {
    sleeperId: input.player,
    gsisId: input.player,
    playerName: input.player,
    normalizedName: input.player.toLowerCase(),
    position: input.position,
    team: input.team === undefined ? "TST" : input.team,
    matchConfidence: "exact_id",
    projectedGames: 8,
    projectedPpg: 5,
    projectedTotalPoints: 40,
    floorPoints: 32,
    medianPoints: 40,
    ceilingPoints: 48,
    confidence: "medium",
    confidenceScore: 0.7,
    variant: "blackbird_expected_games_v7_family_selective",
    source: "blackbird_expected_games_v7_family_selective",
    projectionSource: "blackbird_expected_games_v7_family_selective",
    projectionRunId: null,
    projectionReasons: [],
    warnings: [],
    cohortLabels: [],
    universe: "fantasy-relevant",
    inputCoverage: {
      priorSeasonsUsed: input.seasons,
      priorGames: input.priorGames,
      priorPpg: 5,
      careerToDatePpg: 5,
      roleLabel: "starter",
      availabilitySignal: null,
      snapShare: null,
      usageTrend: "stable",
      highValueUsageFlags: [],
      noPriorNflData: input.noPrior ?? false,
      noPriorType: input.noPrior ? "rookie" : "prior",
    },
    expectedGamesDiagnostics: {
      projectedGamesV1: 8,
      calibratedProjectedGames: 8,
      gamesCalibrationReason: "",
      availabilityCohort: "",
      availabilityConfidence: "medium",
      calibrationCohort: "",
      cohortReason: "",
      expectedGamesRule: "",
      ppgAdjustmentRule: "",
      confidenceRule: "",
      noPriorRule: null,
      expectedGamesModel: null,
      expectedGamesRuleV4: null,
      expectedGamesInputs: null,
      expectedGamesConfidence: null,
      expectedGamesWarnings: [],
      previousProjectedGames: null,
      v4ProjectedGames: null,
      v5ProjectedGames: null,
      v6ProjectedGames: null,
      v7ProjectedGames: 8,
      v8ProjectedGames: null,
      v81ProjectedGames: null,
      v82ProjectedGames: null,
      weightedRecentGames: null,
      careerRecentGames: null,
      selectedExpectedGamesMethod: null,
      selectedExpectedGamesReason: null,
      fallbackReason: null,
      v6SelectedExpectedGamesMethod: null,
      v6GateReason: null,
      v6PositionFamilyGateStatus: null,
      v6ExpectedGamesConfidence: null,
      v6SelectedExpectedGamesReason: null,
      v6FallbackReason: null,
      v7SelectedExpectedGamesMethod: null,
      v7GateReason: input.v7GateReason ?? null,
      v7PositionFamilyGateStatus: null,
      v7ExpectedGamesConfidence: null,
      v7SelectedExpectedGamesReason: null,
      v7FallbackReason: null,
      v8SelectedExpectedGamesMethod: null,
      v8Cohort: null,
      v8BaselineExpectedGames: null,
      v8Adjustment: null,
      v8AdjustmentReason: null,
      v8BaselineSource: null,
      v8ExpectedGamesConfidence: null,
      v8SelectedExpectedGamesReason: null,
      v8FallbackReason: null,
      v81BaseModelUsed: null,
      v81ProjectedGamesRawV8: null,
      v81ProjectedGamesV7: null,
      v81RawDeltaFromV7: null,
      v81CalibratedDeltaFromV7: null,
      v81DampeningFactor: null,
      v81GatesApplied: [],
      v81Cohort: null,
      v81Position: null,
      v81PpgBucket: null,
      v81AdjustmentBucket: null,
      v81ReasonCodes: [],
      v81SelectedExpectedGamesReason: null,
      v82BaseModelUsed: null,
      v82ProjectedGamesV7: null,
      v82ProjectedGamesV8: null,
      v82ProjectedGamesV81: null,
      v82DeltaFromV7: null,
      v82DeltaFromV81: null,
      v82GuardrailApplied: false,
      v82GuardrailReasonCodes: [],
      v82PpgBucket: null,
      v82AdjustmentBucket: null,
      v82SelectedExpectedGamesReason: null,
      qbStarterProbabilityBucket: null,
      qbStarterSignalReason: null,
      qbExpectedGamesCap: null,
      qbFallbackReason: null,
    },
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

function shadowRow(input: {
  player: string;
  position: string;
  pointDelta: number;
  critical?: boolean;
  currentGames?: number;
  v82Games?: number;
}): ProjectionV82ShadowRow {
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    cohorts: [],
    currentExpectedGames: input.currentGames ?? 8,
    v82ExpectedGames: input.v82Games ?? 9,
    expectedGamesDelta: (input.v82Games ?? 9) - (input.currentGames ?? 8),
    ppgAnchor: 5,
    projectedTotalPointDelta: input.pointDelta,
    currentProjectedTotal: 40,
    shadowProjectedTotal: 40 + input.pointDelta,
    movementBucket: input.critical || Math.abs(input.pointDelta) >= 20 ? "20+" : "0-5",
    gamesBucket: "0.5-1",
    risk: input.critical || Math.abs(input.pointDelta) >= 20 ? "critical" : "low",
    riskFlags: [],
    reasonCodes: [],
    guardrailApplied: false,
    currentOverallRank: 1,
    shadowOverallRank: 1,
    estimatedOverallRankMovement: 0,
    currentPositionRank: 1,
    shadowPositionRank: 1,
    estimatedPositionRankMovement: 0,
    criticalReviewStatus: input.critical ? "needs_manual_review" : null,
  };
}
