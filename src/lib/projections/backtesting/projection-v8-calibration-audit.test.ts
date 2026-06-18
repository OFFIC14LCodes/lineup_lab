import { describe, expect, it } from "vitest";

import {
  buildProjectionV8CalibrationAuditFromData,
} from "./projection-v8-calibration-audit";
import type {
  ProjectionParityAuditReport,
  ProjectionParityAuditRow,
  ProjectionParityEvaluationCohort,
} from "./projection-parity-audit-types";

describe("projection v8 calibration audit", () => {
  it("builds deterministic cohort, position, PPG, and adjustment bucket summaries", () => {
    const audit = buildProjectionV8CalibrationAuditFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport([
        row({ player: "High PPG Win", position: "QB", cohorts: ["all_rows", "offense"], actualPoints: 200, actualGames: 10, actualPpg: 20, v7Games: 8, v7Total: 160, v8Games: 10, v8Total: 200 }),
        row({ player: "High PPG Loss", position: "RB", cohorts: ["all_rows", "offense"], actualPoints: 200, actualGames: 10, actualPpg: 20, v7Games: 10, v7Total: 200, v8Games: 14, v8Total: 280 }),
        row({ player: "Rookie Win", position: "WR", cohorts: ["all_rows", "rookie", "v7_only_rows", "low_prior_sample"], actualPoints: 50, actualGames: 5, actualPpg: 10, v7Games: 3, v7Total: 30, v8Games: 5, v8Total: 50, noPrior: true }),
        row({ player: "No Prior Loss", position: "DB", cohorts: ["all_rows", "no_prior_stats", "low_prior_sample", "idp"], actualPoints: 20, actualGames: 4, actualPpg: 5, v7Games: 4, v7Total: 20, v8Games: 5, v8Total: 25, noPrior: true }),
        row({ player: "TE Same", position: "TE", cohorts: ["all_rows", "te_fallback", "offense"], actualPoints: 40, actualGames: 8, actualPpg: 5, v7Games: 8, v7Total: 40, v8Games: 8, v8Total: 40 }),
        row({ player: "K Same", position: "K", cohorts: ["all_rows", "k_fallback", "kicker"], actualPoints: 60, actualGames: 10, actualPpg: 6, v7Games: 10, v7Total: 60, v8Games: 10, v8Total: 60 }),
      ]),
    });

    expect(audit.identitySummary.comparedRows).toBe(6);
    expect(audit.v81IdentitySummary.v8ComparedRows).toBe(6);
    expect(audit.cohortBreakdowns.find((entry) => entry.segment === "all_rows")?.v8DifferentRowCount).toBe(4);
    expect(audit.cohortBreakdowns.find((entry) => entry.segment === "all_rows")?.v81DifferentFromV8RowCount).toBe(0);
    expect(audit.positionBreakdowns.find((entry) => entry.segment === "QB")?.totalMaeDelta).toBe(-40);
    expect(audit.ppgBuckets.find((entry) => entry.segment === "20+ PPG")?.rows).toBe(2);
    expect(audit.adjustmentBuckets.find((entry) => entry.segment === "2-4")?.rows).toBe(1);
    expect(audit.adjustmentBuckets.find((entry) => entry.segment === "0")?.topWorseningRows).toHaveLength(0);
  });

  it("sorts top movers by total absolute error delta", () => {
    const audit = buildProjectionV8CalibrationAuditFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport([
        row({ player: "Best", position: "QB", actualPoints: 100, actualGames: 10, actualPpg: 10, v7Games: 5, v7Total: 50, v8Games: 10, v8Total: 100 }),
        row({ player: "Small Win", position: "RB", actualPoints: 100, actualGames: 10, actualPpg: 10, v7Games: 9, v7Total: 90, v8Games: 10, v8Total: 100 }),
        row({ player: "Worst", position: "WR", actualPoints: 100, actualGames: 10, actualPpg: 10, v7Games: 10, v7Total: 100, v8Games: 4, v8Total: 40 }),
      ]),
    });

    expect(audit.topImprovements[0].player).toBe("Best");
    expect(audit.topImprovements[0].v82TotalAbsErrorDeltaVsV7).toBe(-50);
    expect(audit.topRegressions[0].player).toBe("Worst");
    expect(audit.topRegressions[0].v82TotalAbsErrorDeltaVsV7).toBe(60);
  });

  it("keeps no-prior protocol visible and does not treat TE/K unchanged rows as regressions", () => {
    const audit = buildProjectionV8CalibrationAuditFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport([
        row({ player: "No Prior", position: "DB", cohorts: ["all_rows", "no_prior_stats"], actualPoints: 20, actualGames: 4, actualPpg: 5, v7Games: 4, v7Total: 20, v8Games: 5, v8Total: 25, noPrior: true }),
        row({ player: "TE Same", position: "TE", cohorts: ["all_rows", "te_fallback"], actualPoints: 40, actualGames: 8, actualPpg: 5, v7Games: 8, v7Total: 40, v8Games: 8, v8Total: 40 }),
        row({ player: "K Same", position: "K", cohorts: ["all_rows", "k_fallback"], actualPoints: 60, actualGames: 10, actualPpg: 6, v7Games: 10, v7Total: 60, v8Games: 10, v8Total: 60 }),
      ]),
    });

    expect(audit.cohortBreakdowns.find((entry) => entry.segment === "no_prior_stats")?.rows).toBe(1);
    expect(audit.topRegressions.map((entry) => entry.player)).toEqual(["No Prior"]);
    expect(audit.cohortBreakdowns.find((entry) => entry.segment === "te_fallback")?.v8DifferentRowCount).toBe(0);
    expect(audit.cohortBreakdowns.find((entry) => entry.segment === "k_fallback")?.v8DifferentRowCount).toBe(0);
  });
});

function parityReport(rows: ProjectionParityAuditRow[]): ProjectionParityAuditReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    targetSeason: 2025,
    includeIdp: true,
    sourceArtifacts: { backtest: "backtest.json", snapshot: "snapshot.json" },
    rowUniverse: {
      weightedRows: rows.length,
      v7Rows: rows.length,
      sharedRows: rows.length,
      weightedOnlyRows: 0,
      v7OnlyRows: 0,
      byPosition: {},
      v7OnlyByPriorDataGroup: {},
      v7OnlyByCohort: {},
    },
    sharedRowMetrics: emptyMetricSummary(),
    evaluationCohorts: [],
    comparisonProtocol: {
      sharedWeightedRows: "",
      v7OnlyRows: "",
      noPriorBaseline: {
        name: "conservative_position_prior",
        description: "",
        appliesToCohorts: ["v7_only_rows", "rookie", "second_year_low_prior", "no_prior_stats", "low_prior_sample"],
        mergedIntoWeightedComparison: false,
      },
    },
    ppgAnchorParity: { comparedRows: 0, mismatchedRows: 0, matchedRows: 0, averageAbsDiff: null, maxAbsDiff: null, examples: [] },
    gamesBaselineParity: { comparedRows: 0, mismatchedRows: 0, baselineImplementationMismatchRows: 0, trueModelDifferenceRows: 0, matchedRows: 0, averageAbsDiff: null, maxAbsDiff: null, examples: [] },
    fallbackAudit: {
      TE: { position: "TE", rows: 0, fallbackAppliedRows: 0, fallbackMissingRows: 0, baselineEquivalentRows: 0, baselineMismatchRows: 0, weightedMaeTotal: null, v7MaeTotal: null, v7DeltaMaeTotal: null, examples: [] },
      K: { position: "K", rows: 0, fallbackAppliedRows: 0, fallbackMissingRows: 0, baselineEquivalentRows: 0, baselineMismatchRows: 0, weightedMaeTotal: null, v7MaeTotal: null, v7DeltaMaeTotal: null, examples: [] },
    },
    v6V7IdentityAudit: { comparedRows: 0, identicalRows: 0, differentRows: 0, identicalRate: null, examplesIdentical: [], examplesDifferent: [] },
    v7V8IdentityAudit: {
      comparedRows: rows.length,
      identicalRows: rows.filter((entry) => entry.v7.total === entry.v8.total && entry.v7.games === entry.v8.games).length,
      differentRows: rows.filter((entry) => entry.v7.total !== entry.v8.total || entry.v7.games !== entry.v8.games).length,
      identicalRate: null,
      differentRate: null,
      byCohort: {},
      examplesIdentical: [],
      examplesDifferent: [],
    },
    v7V81IdentityAudit: {
      comparedRows: rows.length,
      identicalRows: rows.filter((entry) => entry.v7.total === entry.v81.total && entry.v7.games === entry.v81.games).length,
      differentRows: rows.filter((entry) => entry.v7.total !== entry.v81.total || entry.v7.games !== entry.v81.games).length,
      identicalRate: null,
      differentRate: null,
      byCohort: {},
      examplesIdentical: [],
      examplesDifferent: [],
    },
    v8V81IdentityAudit: {
      comparedRows: rows.length,
      identicalRows: rows.filter((entry) => entry.v8.total === entry.v81.total && entry.v8.games === entry.v81.games).length,
      differentRows: rows.filter((entry) => entry.v8.total !== entry.v81.total || entry.v8.games !== entry.v81.games).length,
      identicalRate: null,
      differentRate: null,
      byCohort: {},
      examplesIdentical: [],
      examplesDifferent: [],
    },
    v81V82IdentityAudit: {
      comparedRows: rows.length,
      identicalRows: rows.filter((entry) => entry.v81.total === entry.v82.total && entry.v81.games === entry.v82.games).length,
      differentRows: rows.filter((entry) => entry.v81.total !== entry.v82.total || entry.v81.games !== entry.v82.games).length,
      identicalRate: null,
      differentRate: null,
      byCohort: {},
      examplesIdentical: [],
      examplesDifferent: [],
    },
    rootCauses: [],
    recommendationsBeforeV8: [],
    rows,
  };
}

function row(input: {
  player: string;
  position: string;
  cohorts?: ProjectionParityEvaluationCohort[];
  actualPoints: number;
  actualGames: number;
  actualPpg: number;
  v7Games: number;
  v8Games: number;
  v81Games?: number;
  v82Games?: number;
  v7Total: number;
  v8Total: number;
  v81Total?: number;
  v82Total?: number;
  noPrior?: boolean;
}): ProjectionParityAuditRow {
  const cohorts = input.cohorts ?? ["all_rows"];
  const v81Games = input.v81Games ?? input.v8Games;
  const v81Total = input.v81Total ?? input.v8Total;
  const v82Games = input.v82Games ?? v81Games;
  const v82Total = input.v82Total ?? v81Total;
  return {
    key: `${input.player}:${input.position}`,
    player: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    position: input.position,
    team: "TST",
    priorDataGroup: cohorts.includes("rookie") ? "rookie" : cohorts.includes("no_prior_stats") ? "no_prior_stats" : "multi_year_prior",
    cohortLabels: [],
    evaluationCohorts: cohorts,
    actualGames: input.actualGames,
    actualPpg: input.actualPpg,
    actualPoints: input.actualPoints,
    weighted: prediction(null, null, input.actualPoints, input.actualGames),
    noPriorBaseline: input.noPrior
      ? { expectedGames: 5, protocol: "conservative_position_prior", basis: "test", errorGames: 5 - input.actualGames, reasons: ["No-prior rows stay on low-prior protocol."] }
      : { expectedGames: null, protocol: null, basis: null, errorGames: null, reasons: [] },
    v6: prediction(input.v7Total, input.v7Games, input.actualPoints, input.actualGames),
    v7: prediction(input.v7Total, input.v7Games, input.actualPoints, input.actualGames),
    v8: prediction(input.v8Total, input.v8Games, input.actualPoints, input.actualGames),
    v81: prediction(v81Total, v81Games, input.actualPoints, input.actualGames),
    v82: prediction(v82Total, v82Games, input.actualPoints, input.actualGames),
    ppgAnchorDiff: 0,
    gamesBaselineDiff: null,
    totalDiff: input.v7Total - input.v8Total,
    v6V7PpgDiff: 0,
    v6V7GamesDiff: 0,
    v6V7TotalDiff: 0,
    v7V8PpgDiff: 0,
    v7V8GamesDiff: input.v8Games - input.v7Games,
    v7V8TotalDiff: input.v8Total - input.v7Total,
    v7V81PpgDiff: 0,
    v7V81GamesDiff: v81Games - input.v7Games,
    v7V81TotalDiff: v81Total - input.v7Total,
    v8V81PpgDiff: 0,
    v8V81GamesDiff: v81Games - input.v8Games,
    v8V81TotalDiff: v81Total - input.v8Total,
    v7V82PpgDiff: 0,
    v7V82GamesDiff: v82Games - input.v7Games,
    v7V82TotalDiff: v82Total - input.v7Total,
    v81V82PpgDiff: 0,
    v81V82GamesDiff: v82Games - v81Games,
    v81V82TotalDiff: v82Total - v81Total,
    snapshotDiagnostics: {
      weightedRecentGames: null,
      v6ProjectedGames: input.v7Games,
      v7ProjectedGames: input.v7Games,
      v8ProjectedGames: input.v8Games,
      v81ProjectedGames: v81Games,
      v6SelectedExpectedGamesMethod: null,
      v6GateReason: null,
      v6PositionFamilyGateStatus: null,
      v6FallbackReason: null,
      v7SelectedExpectedGamesMethod: null,
      v7GateReason: null,
      v7PositionFamilyGateStatus: null,
      v7FallbackReason: null,
      v8SelectedExpectedGamesMethod: "v8_cohort_blend",
      v8Cohort: input.noPrior ? "no_prior_stats" : "veteran_prior_sample",
      v8BaselineExpectedGames: input.v7Games,
      v8Adjustment: input.v8Games - input.v7Games,
      v8AdjustmentReason: "test adjustment",
      v8BaselineSource: input.noPrior ? "low_prior_baseline" : "weighted_baseline",
      v8FallbackReason: null,
      v81BaseModelUsed: "blackbird_expected_games_v8_cohort_blend",
      v81ProjectedGamesRawV8: input.v8Games,
      v81ProjectedGamesV7: input.v7Games,
      v81RawDeltaFromV7: input.v8Games - input.v7Games,
      v81CalibratedDeltaFromV7: v81Games - input.v7Games,
      v81DampeningFactor: input.v8Games === input.v7Games ? 1 : (v81Games - input.v7Games) / (input.v8Games - input.v7Games),
      v81GatesApplied: [],
      v81Cohort: input.noPrior ? "no_prior_stats" : "veteran_prior_sample",
      v81Position: input.position,
      v81PpgBucket: "10-15 PPG",
      v81AdjustmentBucket: "0",
      v81ReasonCodes: ["test"],
      v81SelectedExpectedGamesReason: "test v8.1 reason",
      v82BaseModelUsed: "blackbird_expected_games_v8_1_calibrated_gate",
      v82ProjectedGamesV7: input.v7Games,
      v82ProjectedGamesV8: input.v8Games,
      v82ProjectedGamesV81: v81Games,
      v82DeltaFromV7: v82Games - input.v7Games,
      v82DeltaFromV81: v82Games - v81Games,
      v82GuardrailApplied: v82Games !== v81Games,
      v82GuardrailReasonCodes: ["test"],
      v82PpgBucket: "10-15 PPG",
      v82AdjustmentBucket: "0",
      v82SelectedExpectedGamesReason: "test v8.2 reason",
    },
    rootCauses: [],
  };
}

function prediction(total: number | null, games: number | null, actualPoints: number, actualGames: number) {
  return {
    ppg: games && total !== null ? total / games : null,
    games,
    total,
    errorPpg: null,
    errorGames: games === null ? null : games - actualGames,
    errorTotal: total === null ? null : total - actualPoints,
  };
}

function emptyMetricSummary() {
  return {
    count: 0,
    weightedMaePpg: null,
    v7MaePpg: null,
    weightedMaeGames: null,
    v7MaeGames: null,
    weightedMaeTotal: null,
    v7MaeTotal: null,
    v7DeltaMaePpg: null,
    v7DeltaMaeGames: null,
    v7DeltaMaeTotal: null,
  };
}
