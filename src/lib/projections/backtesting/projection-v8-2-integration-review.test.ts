import { describe, expect, it } from "vitest";

import {
  buildProjectionV82IntegrationReviewFromData,
  renderProjectionV82IntegrationReviewCsv,
} from "./projection-v8-2-integration-review";
import type {
  ProjectionParityAuditReport,
  ProjectionParityAuditRow,
  ProjectionParityEvaluationCohort,
} from "./projection-parity-audit-types";

describe("projection v8.2 integration review", () => {
  it("generates a dry-run integration review with passing gates and full impact rows", () => {
    const report = buildProjectionV82IntegrationReviewFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport([
        row({ player: "Elite QB", position: "QB", cohorts: ["all_rows", "offense"], actualPoints: 200, actualGames: 10, v7Games: 8, v7Total: 160, v81Games: 13, v81Total: 260, v82Games: 10, v82Total: 200, guardrailApplied: true }),
        row({ player: "High RB", position: "RB", cohorts: ["all_rows", "offense"], actualPoints: 180, actualGames: 10, v7Games: 8, v7Total: 144, v81Games: 10, v81Total: 180, v82Games: 10, v82Total: 180 }),
        row({ player: "Rookie WR", position: "WR", cohorts: ["all_rows", "rookie", "low_prior_sample"], actualPoints: 80, actualGames: 8, v7Games: 4, v7Total: 40, v81Games: 8, v81Total: 80, v82Games: 8, v82Total: 80 }),
        row({ player: "TE Same", position: "TE", cohorts: ["all_rows", "te_fallback", "offense"], actualPoints: 40, actualGames: 8, v7Games: 8, v7Total: 40, v81Games: 8, v81Total: 40, v82Games: 8, v82Total: 40 }),
        row({ player: "K Same", position: "K", cohorts: ["all_rows", "k_fallback", "kicker"], actualPoints: 60, actualGames: 10, v7Games: 10, v7Total: 60, v81Games: 10, v81Total: 60, v82Games: 10, v82Total: 60 }),
      ]),
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.recommendation).toBe("integration_review_candidate");
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    expect(report.modelQualitySummary.allRows.v82TotalMaeDeltaVsV7).toBeLessThan(0);
    expect(report.impactPreview.rows).toHaveLength(5);
    expect(report.impactPreview.topMovements[0].player).toBe("Elite QB");
    expect(report.impactPreview.topMovements[0].movementBucket).toBe("20+");
    expect(report.impactPreview.topMovements[0].risk).toBe("critical");
    expect(report.impactPreview.topMovements[0].riskFlags).toEqual(expect.arrayContaining(["elite_ppg_player", "qb_superflex_sensitive", "guardrail_applied"]));
  });

  it("fails the 20+ PPG safety gate when v8.2 is worse than v7", () => {
    const report = buildProjectionV82IntegrationReviewFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport([
        row({ player: "Elite Miss", position: "QB", actualPoints: 200, actualGames: 10, v7Games: 10, v7Total: 200, v81Games: 15, v81Total: 300, v82Games: 15, v82Total: 300 }),
        row({ player: "High RB", position: "RB", actualPoints: 180, actualGames: 10, v7Games: 8, v7Total: 144, v81Games: 10, v81Total: 180, v82Games: 10, v82Total: 180 }),
        row({ player: "Rookie WR", position: "WR", cohorts: ["all_rows", "rookie", "low_prior_sample"], actualPoints: 80, actualGames: 8, v7Games: 4, v7Total: 40, v81Games: 8, v81Total: 80, v82Games: 8, v82Total: 80 }),
      ]),
    });

    expect(report.safetyGates.find((gate) => gate.name === "20_plus_ppg_not_worse_than_v7")?.passed).toBe(false);
    expect(report.recommendation).toBe("remain_experimental");
  });

  it("surfaces TE/K fallback parity failures as safety gate failures", () => {
    const report = buildProjectionV82IntegrationReviewFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport(
        [
          row({ player: "Elite QB", position: "QB", actualPoints: 200, actualGames: 10, v7Games: 8, v7Total: 160, v81Games: 10, v81Total: 200, v82Games: 10, v82Total: 200 }),
          row({ player: "High RB", position: "RB", actualPoints: 180, actualGames: 10, v7Games: 8, v7Total: 144, v81Games: 10, v81Total: 180, v82Games: 10, v82Total: 180 }),
          row({ player: "Rookie WR", position: "WR", cohorts: ["all_rows", "rookie", "low_prior_sample"], actualPoints: 80, actualGames: 8, v7Games: 4, v7Total: 40, v81Games: 8, v81Total: 80, v82Games: 8, v82Total: 80 }),
        ],
        { teMismatchRows: 1 }
      ),
    });

    expect(report.safetyGates.find((gate) => gate.name === "te_fallback_parity_clean")?.passed).toBe(false);
    expect(report.recommendation).toBe("remain_experimental");
  });

  it("renders all impact rows to CSV rather than only top movements", () => {
    const report = buildProjectionV82IntegrationReviewFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parityReport([
        row({ player: "Small Move", position: "DB", cohorts: ["all_rows", "idp"], actualPoints: 40, actualGames: 8, v7Games: 8, v7Total: 40, v81Games: 8.2, v81Total: 41, v82Games: 8.2, v82Total: 41 }),
      ]),
    });

    const csv = renderProjectionV82IntegrationReviewCsv(report);

    expect(csv).toContain("Small Move");
    expect(csv.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("does not mutate the parity report input", () => {
    const parity = parityReport([
      row({ player: "Read Only", position: "LB", cohorts: ["all_rows", "idp"], actualPoints: 100, actualGames: 10, v7Games: 8, v7Total: 80, v81Games: 10, v81Total: 100, v82Games: 10, v82Total: 100 }),
    ]);
    const before = JSON.stringify(parity);

    buildProjectionV82IntegrationReviewFromData({
      options: { targetSeason: 2025, includeIdp: true },
      parityAudit: parity,
    });

    expect(JSON.stringify(parity)).toBe(before);
  });
});

function parityReport(
  rows: ProjectionParityAuditRow[],
  overrides: { teMismatchRows?: number; kMismatchRows?: number } = {}
): ProjectionParityAuditReport {
  const teRows = rows.filter((entry) => entry.position === "TE").length || 1;
  const kRows = rows.filter((entry) => entry.position === "K").length || 1;
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
      TE: { position: "TE", rows: teRows, fallbackAppliedRows: teRows, fallbackMissingRows: 0, baselineEquivalentRows: teRows - (overrides.teMismatchRows ?? 0), baselineMismatchRows: overrides.teMismatchRows ?? 0, weightedMaeTotal: null, v7MaeTotal: null, v7DeltaMaeTotal: null, examples: [] },
      K: { position: "K", rows: kRows, fallbackAppliedRows: kRows, fallbackMissingRows: 0, baselineEquivalentRows: kRows - (overrides.kMismatchRows ?? 0), baselineMismatchRows: overrides.kMismatchRows ?? 0, weightedMaeTotal: null, v7MaeTotal: null, v7DeltaMaeTotal: null, examples: [] },
    },
    v6V7IdentityAudit: { comparedRows: 0, identicalRows: 0, differentRows: 0, identicalRate: null, examplesIdentical: [], examplesDifferent: [] },
    v7V8IdentityAudit: identityAudit(rows, "v7", "v8"),
    v7V81IdentityAudit: identityAudit(rows, "v7", "v81"),
    v8V81IdentityAudit: identityAudit(rows, "v8", "v81"),
    v81V82IdentityAudit: identityAudit(rows, "v81", "v82"),
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
  v7Games: number;
  v81Games: number;
  v82Games: number;
  v7Total: number;
  v81Total: number;
  v82Total: number;
  guardrailApplied?: boolean;
}): ProjectionParityAuditRow {
  const cohorts = input.cohorts ?? ["all_rows", input.position === "K" ? "kicker" : ["DL", "LB", "DB"].includes(input.position) ? "idp" : "offense"];
  const actualPpg = input.actualPoints / input.actualGames;
  return {
    key: `${input.player}:${input.position}`,
    player: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    position: input.position,
    team: "TST",
    priorDataGroup: cohorts.includes("rookie") ? "rookie" : "multi_year_prior",
    cohortLabels: [],
    evaluationCohorts: cohorts,
    actualGames: input.actualGames,
    actualPpg,
    actualPoints: input.actualPoints,
    weighted: prediction(null, null, input.actualPoints, input.actualGames),
    noPriorBaseline: { expectedGames: null, protocol: null, basis: null, errorGames: null, reasons: [] },
    v6: prediction(input.v7Total, input.v7Games, input.actualPoints, input.actualGames),
    v7: prediction(input.v7Total, input.v7Games, input.actualPoints, input.actualGames),
    v8: prediction(input.v81Total, input.v81Games, input.actualPoints, input.actualGames),
    v81: prediction(input.v81Total, input.v81Games, input.actualPoints, input.actualGames),
    v82: prediction(input.v82Total, input.v82Games, input.actualPoints, input.actualGames),
    ppgAnchorDiff: 0,
    gamesBaselineDiff: null,
    totalDiff: input.v7Total - input.v82Total,
    v6V7PpgDiff: 0,
    v6V7GamesDiff: 0,
    v6V7TotalDiff: 0,
    v7V8PpgDiff: 0,
    v7V8GamesDiff: input.v81Games - input.v7Games,
    v7V8TotalDiff: input.v81Total - input.v7Total,
    v7V81PpgDiff: 0,
    v7V81GamesDiff: input.v81Games - input.v7Games,
    v7V81TotalDiff: input.v81Total - input.v7Total,
    v8V81PpgDiff: 0,
    v8V81GamesDiff: 0,
    v8V81TotalDiff: 0,
    v7V82PpgDiff: 0,
    v7V82GamesDiff: input.v82Games - input.v7Games,
    v7V82TotalDiff: input.v82Total - input.v7Total,
    v81V82PpgDiff: 0,
    v81V82GamesDiff: input.v82Games - input.v81Games,
    v81V82TotalDiff: input.v82Total - input.v81Total,
    snapshotDiagnostics: {
      weightedRecentGames: null,
      v6ProjectedGames: input.v7Games,
      v7ProjectedGames: input.v7Games,
      v8ProjectedGames: input.v81Games,
      v81ProjectedGames: input.v81Games,
      v6SelectedExpectedGamesMethod: null,
      v6GateReason: null,
      v6PositionFamilyGateStatus: null,
      v6FallbackReason: null,
      v7SelectedExpectedGamesMethod: null,
      v7GateReason: null,
      v7PositionFamilyGateStatus: null,
      v7FallbackReason: null,
      v8SelectedExpectedGamesMethod: "v8_cohort_blend",
      v8Cohort: cohorts.includes("rookie") ? "rookie" : "veteran_prior_sample",
      v8BaselineExpectedGames: input.v7Games,
      v8Adjustment: input.v81Games - input.v7Games,
      v8AdjustmentReason: "test adjustment",
      v8BaselineSource: "weighted_baseline",
      v8FallbackReason: null,
      v81BaseModelUsed: "blackbird_expected_games_v8_cohort_blend",
      v81ProjectedGamesRawV8: input.v81Games,
      v81ProjectedGamesV7: input.v7Games,
      v81RawDeltaFromV7: input.v81Games - input.v7Games,
      v81CalibratedDeltaFromV7: input.v81Games - input.v7Games,
      v81DampeningFactor: 1,
      v81GatesApplied: [],
      v81Cohort: cohorts.includes("rookie") ? "rookie" : "veteran_prior_sample",
      v81Position: input.position,
      v81PpgBucket: "10-15 PPG",
      v81AdjustmentBucket: "0",
      v81ReasonCodes: ["test"],
      v81SelectedExpectedGamesReason: "test v8.1 reason",
      v82BaseModelUsed: "blackbird_expected_games_v8_1_calibrated_gate",
      v82ProjectedGamesV7: input.v7Games,
      v82ProjectedGamesV8: input.v81Games,
      v82ProjectedGamesV81: input.v81Games,
      v82DeltaFromV7: input.v82Games - input.v7Games,
      v82DeltaFromV81: input.v82Games - input.v81Games,
      v82GuardrailApplied: input.guardrailApplied ?? false,
      v82GuardrailReasonCodes: input.guardrailApplied ? ["high_impact_guardrail"] : ["test"],
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

function identityAudit(rows: ProjectionParityAuditRow[], left: "v7" | "v8" | "v81", right: "v8" | "v81" | "v82") {
  const identicalRows = rows.filter((entry) => entry[left].total === entry[right].total && entry[left].games === entry[right].games).length;
  const differentRows = rows.length - identicalRows;
  return {
    comparedRows: rows.length,
    identicalRows,
    differentRows,
    identicalRate: rows.length ? identicalRows / rows.length : null,
    differentRate: rows.length ? differentRows / rows.length : null,
    byCohort: {},
    examplesIdentical: [],
    examplesDifferent: [],
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
