import { describe, expect, it } from "vitest";

import {
  buildProjectionV82ShadowFromData,
  renderProjectionV82ShadowCsv,
} from "./projection-v8-2-shadow";
import type {
  PreseasonProjectionSnapshot,
  PreseasonProjectionSnapshotRow,
  PreseasonProjectionVariant,
} from "./preseason-projection-snapshot-types";

describe("projection v8.2 shadow report", () => {
  it("generates row coverage, movement summaries, risk flags, and ranking estimates", () => {
    const report = buildProjectionV82ShadowFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        pair({ player: "Elite QB", position: "QB", currentGames: 8, shadowGames: 10, ppg: 21, reasonCodes: ["high_impact_guardrail"], guardrailApplied: true }),
        pair({ player: "Rookie RB", position: "RB", currentGames: 8, shadowGames: 12, ppg: 6, priorGames: 0, reasonCodes: ["low_prior_v8_1_preserved"] }),
        pair({ player: "IDP LB", position: "LB", currentGames: 10, shadowGames: 10.5, ppg: 8, reasonCodes: ["idp_v8_1_preserved"] }),
        pair({ player: "TE Same", position: "TE", currentGames: 8, shadowGames: 8, ppg: 5, v7GateReason: "te_hard_baseline_fallback", reasonCodes: ["te_fallback_preserved"] }),
        pair({ player: "K Same", position: "K", currentGames: 12, shadowGames: 12, ppg: 6, v7GateReason: "k_hard_baseline_fallback", reasonCodes: ["k_fallback_preserved"] }),
      ].flat()),
    });

    expect(report.rowCoverage.currentLiveProjectionRows).toBe(5);
    expect(report.rowCoverage.v82ShadowRows).toBe(5);
    expect(report.rowCoverage.sharedRows).toBe(5);
    expect(report.movementBuckets["20+"]).toBe(2);
    expect(report.expectedGamesMovementBuckets["2-4"]).toBe(1);
    expect(report.topMovements[0].player).toBe("Elite QB");
    expect(report.topMovements.find((row) => row.player === "Rookie RB")?.riskFlags).toEqual(expect.arrayContaining(["rookie_or_low_prior", "high_value_position", "large_games_movement"]));
    expect(report.criticalMovements.map((row) => row.player)).toEqual(["Elite QB", "Rookie RB"]);
    expect(report.rankingRiskPreview.estimated).toBe(true);
    expect(report.rankingRiskPreview.rowsWithEstimatedOverallRankMovement).toBe(5);
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    expect(report.recommendation).toBe("shadow_candidate_with_manual_review");
  });

  it("blocks shadow recommendation when elite critical movement is not guardrailed", () => {
    const report = buildProjectionV82ShadowFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        pair({ player: "Elite QB", position: "QB", currentGames: 8, shadowGames: 10, ppg: 21, reasonCodes: ["v8_2_no_guardrail"], guardrailApplied: false }),
      ].flat()),
    });

    expect(report.safetyGates.find((gate) => gate.name === "elite_ppg_movements_guardrailed")?.passed).toBe(false);
    expect(report.criticalMovements[0].criticalReviewStatus).toBe("do_not_promote_until_reviewed");
    expect(report.recommendation).toBe("shadow_blocked");
  });

  it("fails TE/K fallback gates when fallback reason codes are not preserved", () => {
    const report = buildProjectionV82ShadowFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        pair({ player: "TE Missing", position: "TE", currentGames: 8, shadowGames: 8, ppg: 5, v7GateReason: "te_hard_baseline_fallback", reasonCodes: ["test"] }),
        pair({ player: "K Missing", position: "K", currentGames: 12, shadowGames: 12, ppg: 6, v7GateReason: "k_hard_baseline_fallback", reasonCodes: ["test"] }),
      ].flat()),
    });

    expect(report.safetyGates.find((gate) => gate.name === "te_fallback_preserved")?.passed).toBe(false);
    expect(report.safetyGates.find((gate) => gate.name === "k_fallback_preserved")?.passed).toBe(false);
    expect(report.recommendation).toBe("shadow_blocked");
  });

  it("renders all shared rows to CSV", () => {
    const report = buildProjectionV82ShadowFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: snapshot([
        pair({ player: "A", position: "WR", currentGames: 8, shadowGames: 8.5, ppg: 10, reasonCodes: ["test"] }),
        pair({ player: "B", position: "DB", currentGames: 8, shadowGames: 8, ppg: 3, reasonCodes: ["test"] }),
      ].flat()),
    });

    const csv = renderProjectionV82ShadowCsv(report);

    expect(csv).toContain("A");
    expect(csv).toContain("B");
    expect(csv.split("\n").filter(Boolean)).toHaveLength(3);
  });

  it("does not mutate the input snapshot", () => {
    const input = snapshot([
      pair({ player: "Read Only", position: "RB", currentGames: 8, shadowGames: 9, ppg: 7, reasonCodes: ["test"] }),
    ].flat());
    const before = JSON.stringify(input);

    buildProjectionV82ShadowFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      snapshot: input,
    });

    expect(JSON.stringify(input)).toBe(before);
  });
});

function pair(input: {
  player: string;
  position: string;
  currentGames: number;
  shadowGames: number;
  ppg: number;
  priorGames?: number;
  v7GateReason?: string;
  reasonCodes: string[];
  guardrailApplied?: boolean;
}): PreseasonProjectionSnapshotRow[] {
  return [
    row({ ...input, variant: "blackbird_expected_games_v7_family_selective", games: input.currentGames }),
    row({ ...input, variant: "blackbird_expected_games_v8_2_high_impact_guardrail", games: input.shadowGames }),
  ];
}

function snapshot(rows: PreseasonProjectionSnapshotRow[]): PreseasonProjectionSnapshot {
  return {
    metadata: {
      artifactType: "blackbird_preseason_projection_snapshot",
      projectionSeason: 2026,
      targetSeason: 2026,
      inputSeasons: [2023, 2024, 2025],
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
      playersConsidered: rows.length / 2,
      playersProjected: rows.length / 2,
      playersSkipped: 2,
      playersSkippedNoSignal: 2,
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
      leakageSafety: {
        passed: true,
        targetSeasonExcludedFromInputs: true,
        noPostTargetProjectionArtifactsUsed: true,
        notes: [],
      },
    },
  };
}

function row(input: {
  player: string;
  position: string;
  variant: PreseasonProjectionVariant;
  games: number;
  ppg: number;
  priorGames?: number;
  v7GateReason?: string;
  reasonCodes: string[];
  guardrailApplied?: boolean;
}): PreseasonProjectionSnapshotRow {
  const projectedTotalPoints = Math.round(input.games * input.ppg * 10) / 10;
  return {
    sleeperId: input.player,
    gsisId: input.player,
    playerName: input.player,
    normalizedName: input.player.toLowerCase(),
    position: input.position,
    team: "TST",
    matchConfidence: "exact_id",
    projectedGames: input.games,
    projectedPpg: input.ppg,
    projectedTotalPoints,
    floorPoints: projectedTotalPoints * 0.8,
    medianPoints: projectedTotalPoints,
    ceilingPoints: projectedTotalPoints * 1.2,
    confidence: "medium",
    confidenceScore: 0.7,
    variant: input.variant,
    source: input.variant,
    projectionSource: input.variant,
    projectionRunId: null,
    projectionReasons: [],
    warnings: [],
    cohortLabels: [],
    universe: "fantasy-relevant",
    inputCoverage: {
      priorSeasonsUsed: [2024, 2025],
      priorGames: input.priorGames ?? 20,
      priorPpg: input.ppg,
      careerToDatePpg: input.ppg,
      roleLabel: "starter",
      availabilitySignal: null,
      snapShare: null,
      usageTrend: "stable",
      highValueUsageFlags: [],
      noPriorNflData: (input.priorGames ?? 20) === 0,
      noPriorType: (input.priorGames ?? 20) === 0 ? "rookie" : "prior",
    },
    expectedGamesDiagnostics: {
      projectedGamesV1: input.games,
      calibratedProjectedGames: input.games,
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
      v7ProjectedGames: input.games,
      v8ProjectedGames: null,
      v81ProjectedGames: null,
      v82ProjectedGames: input.games,
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
      v8Cohort: (input.priorGames ?? 20) === 0 ? "rookie" : "veteran_prior_sample",
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
      v82GuardrailApplied: input.guardrailApplied ?? false,
      v82GuardrailReasonCodes: input.reasonCodes,
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
