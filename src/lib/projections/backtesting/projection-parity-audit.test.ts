import { describe, expect, it } from "vitest";

import { buildProjectionParityAuditFromData } from "./projection-parity-audit";
import type { ProjectionBacktestPrediction, ProjectionBacktestReport } from "./projection-backtest-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";

describe("projection parity audit", () => {
  it("detects row universe differences", () => {
    const audit = auditFor([
      row("A", "WR", { weighted: pred(10, 10, 100), v7: pred(10, 10, 100) }),
      row("B", "WR", { v7: pred(9, 10, 90), priorDataGroup: "rookie", cohortLabels: ["low_prior_sample", "rookie_or_no_prior_nfl_data"] }),
    ]);

    expect(audit.rowUniverse.weightedRows).toBe(1);
    expect(audit.rowUniverse.v7Rows).toBe(2);
    expect(audit.rowUniverse.v7OnlyRows).toBe(1);
    expect(audit.evaluationCohorts.find((cohort) => cohort.cohort === "v7_only_rows")?.rows).toBe(1);
    expect(audit.rootCauses).toContain("row_universe_difference");
  });

  it("assigns explicit evaluation cohorts deterministically", () => {
    const audit = auditFor([
      row("A", "RB", {
        weighted: pred(10, 10, 100),
        v7: pred(10, 10, 100),
        priorDataGroup: "multi_year_prior",
        cohortLabels: ["offense_rb"],
      }),
      row("B", "LB", {
        v7: pred(8, 5, 40),
        priorDataGroup: "rookie",
        cohortLabels: ["low_prior_sample", "rookie_or_no_prior_nfl_data", "idp_lb"],
      }),
    ]);

    expect(audit.rows[0].evaluationCohorts).toEqual(["all_rows", "shared_weighted_rows", "veteran_prior_sample", "offense"]);
    expect(audit.rows[1].evaluationCohorts).toEqual(["all_rows", "v7_only_rows", "rookie", "low_prior_sample", "idp"]);
  });

  it("keeps v7-only no-prior rows and compares them only against no-prior baseline", () => {
    const audit = auditFor([
      row("A", "QB", {
        v7: pred(9, 2, 18),
        priorDataGroup: "rookie",
        cohortLabels: ["low_prior_sample", "rookie_or_no_prior_nfl_data"],
      }),
    ]);
    const v7Only = audit.evaluationCohorts.find((cohort) => cohort.cohort === "v7_only_rows");
    const rookie = audit.evaluationCohorts.find((cohort) => cohort.cohort === "rookie");

    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].weighted.games).toBeNull();
    expect(audit.rows[0].noPriorBaseline.expectedGames).toBe(7);
    expect(v7Only?.weightedRows).toBe(0);
    expect(v7Only?.v7Rows).toBe(1);
    expect(v7Only?.noPriorBaselineRows).toBe(1);
    expect(v7Only?.weightedMaeGames).toBeNull();
    expect(rookie?.noPriorBaselineRows).toBe(1);
  });

  it("detects PPG anchor mismatches", () => {
    const audit = auditFor([
      row("A", "RB", { weighted: pred(10, 10, 100), v7: pred(11, 10, 110) }),
    ]);

    expect(audit.ppgAnchorParity.mismatchedRows).toBe(1);
    expect(audit.rows[0].rootCauses).toContain("ppg_anchor_mismatch");
  });

  it("detects games baseline mismatches", () => {
    const audit = auditFor([
      row("A", "TE", { weighted: pred(10, 12, 120), v7: pred(10, 10, 100) }),
    ], [
      snapshotRow("A", "TE", { v7GateReason: "te_hard_baseline_fallback" }),
    ]);

    expect(audit.gamesBaselineParity.mismatchedRows).toBe(1);
    expect(audit.gamesBaselineParity.baselineImplementationMismatchRows).toBe(1);
    expect(audit.rows[0].rootCauses).toContain("baseline_games_mismatch");
  });

  it("detects TE fallback mismatch", () => {
    const audit = auditFor([
      row("A", "TE", { weighted: pred(8, 12, 96), v7: pred(8, 10, 80) }),
    ], [
      snapshotRow("A", "TE", { v7GateReason: "te_hard_baseline_fallback" }),
    ]);

    expect(audit.fallbackAudit.TE.fallbackAppliedRows).toBe(1);
    expect(audit.fallbackAudit.TE.baselineMismatchRows).toBe(1);
    expect(audit.rootCauses).toContain("fallback_applied_but_not_baseline_equivalent");
    expect(audit.rootCauses).toContain("te_k_baseline_definition_issue");
  });

  it("detects K fallback mismatch", () => {
    const audit = auditFor([
      row("A", "K", { weighted: pred(7, 17, 119), v7: pred(7, 15, 105) }),
    ], [
      snapshotRow("A", "K", { v7GateReason: "k_hard_baseline_fallback" }),
    ]);

    expect(audit.fallbackAudit.K.fallbackAppliedRows).toBe(1);
    expect(audit.fallbackAudit.K.baselineMismatchRows).toBe(1);
    expect(audit.rootCauses).toContain("fallback_applied_but_not_baseline_equivalent");
  });

  it("detects missing TE/K fallback", () => {
    const audit = auditFor([
      row("A", "TE", { weighted: pred(8, 12, 96), v7: pred(8, 12, 96) }),
      row("B", "K", { weighted: pred(7, 17, 119), v7: pred(7, 17, 119) }),
    ]);

    expect(audit.fallbackAudit.TE.fallbackMissingRows).toBe(1);
    expect(audit.fallbackAudit.K.fallbackMissingRows).toBe(1);
    expect(audit.rootCauses).toContain("fallback_not_applied");
  });

  it("detects identical v6/v7 paths", () => {
    const audit = auditFor([
      row("A", "QB", { weighted: pred(20, 16, 320), v6: pred(20, 16, 320), v7: pred(20, 16, 320) }),
      row("B", "RB", { weighted: pred(10, 12, 120), v6: pred(10, 12, 120), v7: pred(10, 12, 120) }),
    ]);

    expect(audit.v6V7IdentityAudit.identicalRows).toBe(2);
    expect(audit.rootCauses).toContain("v6_v7_same_path");
  });

  it("reports v7 vs v8 identity and cohort difference rates", () => {
    const audit = auditFor([
      row("A", "RB", { v7: pred(10, 10, 100), v8: pred(10, 11, 110), cohortLabels: ["offense_rb"] }),
      row("B", "TE", { v7: pred(8, 12, 96), v8: pred(8, 12, 96), cohortLabels: ["offense_te"] }),
    ]);

    expect(audit.v7V8IdentityAudit.comparedRows).toBe(2);
    expect(audit.v7V8IdentityAudit.differentRows).toBe(1);
    expect(audit.v7V8IdentityAudit.differentRate).toBe(0.5);
    expect(audit.v7V8IdentityAudit.byCohort.offense.differentRows).toBe(1);
  });

  it("calculates shared-row PPG MAE", () => {
    const audit = auditFor([
      row("A", "WR", { actualPpg: 12, weighted: pred(10, 10, 100), v7: pred(11, 10, 110) }),
      row("B", "WR", { actualPpg: 8, weighted: pred(9, 10, 90), v7: pred(6, 10, 60) }),
    ]);

    expect(audit.sharedRowMetrics.weightedMaePpg).toBe(1.5);
    expect(audit.sharedRowMetrics.v7MaePpg).toBe(1.5);
  });

  it("is deterministic except generation timestamp", () => {
    const first = auditFor([row("A", "WR", { weighted: pred(10, 10, 100), v7: pred(10, 10, 100) })]);
    const second = auditFor([row("A", "WR", { weighted: pred(10, 10, 100), v7: pred(10, 10, 100) })]);
    const stripGeneratedAt = (value: typeof first) => ({ ...value, generatedAt: "fixed" });

    expect(stripGeneratedAt(first)).toEqual(stripGeneratedAt(second));
  });

  it("does not mutate inputs", () => {
    const rows = [row("A", "WR", { weighted: pred(10, 10, 100), v7: pred(10, 10, 100) })];
    const input = report(rows);
    const before = JSON.stringify(input);

    buildProjectionParityAuditFromData({
      report: input,
      snapshot: snapshot([]),
      options: { targetSeason: 2025, includeIdp: false },
    });

    expect(JSON.stringify(input)).toBe(before);
  });
});

function auditFor(rows: ReturnType<typeof row>[], snapshotRows: PreseasonProjectionSnapshotRow[] = []) {
  return buildProjectionParityAuditFromData({
    report: report(rows),
    snapshot: snapshot(snapshotRows),
    options: { targetSeason: 2025, includeIdp: true },
  });
}

function row(
  name: string,
  position: string,
  input: Partial<{
    actualPpg: number;
    weighted: ProjectionBacktestPrediction;
    v6: ProjectionBacktestPrediction;
    v7: ProjectionBacktestPrediction;
    v8: ProjectionBacktestPrediction;
    v81: ProjectionBacktestPrediction;
    v82: ProjectionBacktestPrediction;
    priorDataGroup: ProjectionBacktestReport["dataset"]["rows"][number]["priorDataGroup"];
    cohortLabels: ProjectionBacktestReport["dataset"]["rows"][number]["cohortLabels"];
  }>
): ProjectionBacktestReport["dataset"]["rows"][number] {
  const actualPpg = input.actualPpg ?? 10;
  const actualGames = 10;
  const predictions: Partial<ProjectionBacktestReport["dataset"]["rows"][number]["predictions"]> = {};
  if (input.weighted) predictions.weighted_recent_ppg = withErrors(input.weighted, actualPpg, actualGames);
  if (input.v6) predictions.blackbird_expected_games_v6_gated = withErrors(input.v6, actualPpg, actualGames);
  if (input.v7) predictions.blackbird_expected_games_v7_family_selective = withErrors(input.v7, actualPpg, actualGames);
  if (input.v8) predictions.blackbird_expected_games_v8_cohort_blend = withErrors(input.v8, actualPpg, actualGames);
  if (input.v81) predictions.blackbird_expected_games_v8_1_calibrated_gate = withErrors(input.v81, actualPpg, actualGames);
  if (input.v82) predictions.blackbird_expected_games_v8_2_high_impact_guardrail = withErrors(input.v82, actualPpg, actualGames);
  return {
    identity: {
      sleeperId: `s-${name}`,
      gsisId: `g-${name}`,
      name,
      position,
      team: "DET",
      matchConfidence: "exact_id",
    },
    actuals: {
      games: actualGames,
      pointsPerGame: actualPpg,
      totalPoints: actualPpg * actualGames,
      weeklyScores: [],
      positionalRank: null,
    },
    inputFeatures: {} as ProjectionBacktestReport["dataset"]["rows"][number]["inputFeatures"],
    predictions: predictions as ProjectionBacktestReport["dataset"]["rows"][number]["predictions"],
    bestBaseline: null,
    classification: "accurate",
    priorDataGroup: input.priorDataGroup ?? "multi_year_prior",
    cohortLabels: input.cohortLabels ?? [],
  };
}

function pred(ppg: number, games: number, total: number): ProjectionBacktestPrediction {
  return {
    model: "weighted_recent_ppg",
    predictedPpg: ppg,
    predictedGames: games,
    predictedTotalPoints: total,
    errorPpg: null,
    errorTotalPoints: null,
    gamesError: null,
    availabilityMissType: "accurate_games",
    ppgErrorComponent: null,
    gamesErrorComponent: null,
    combinedError: null,
    projectionSource: null,
    matchConfidence: null,
    reasons: [],
  };
}

function withErrors(prediction: ProjectionBacktestPrediction, actualPpg: number, actualGames: number): ProjectionBacktestPrediction {
  return {
    ...prediction,
    errorPpg: prediction.predictedPpg === null ? null : Math.round((prediction.predictedPpg - actualPpg) * 10) / 10,
    gamesError: prediction.predictedGames === null ? null : Math.round((prediction.predictedGames - actualGames) * 10) / 10,
    errorTotalPoints: prediction.predictedTotalPoints === null ? null : Math.round((prediction.predictedTotalPoints - actualPpg * actualGames) * 10) / 10,
  };
}

function report(rows: ProjectionBacktestReport["dataset"]["rows"]): ProjectionBacktestReport {
  return {
    generatedAt: "test",
    dryRun: true,
    readOnly: true,
    targetSeason: 2025,
    scoring: { source: "default", profile: "test", warnings: [] },
    options: { targetSeason: 2025, positions: null, includeIdp: true, scoring: "default" },
    playersEvaluated: rows.length,
    playersSkipped: { missingActuals: 0, positionFiltered: 0, insufficientPositionSupport: 0 },
    dataset: {
      targetSeason: 2025,
      inputSeasonsUsed: [2024],
      actualSeasonUsed: 2025,
      rows,
      skipped: { missingActuals: 0, positionFiltered: 0, insufficientPositionSupport: 0 },
      leakageSafety: { targetSeasonExcludedFromInputFeatures: true, inputSeasonsUsed: [2024], actualSeasonUsed: 2025 },
    },
    metrics: {} as ProjectionBacktestReport["metrics"],
    classificationCounts: {},
    positionCounts: {},
    overprojectedLeaders: [],
    underprojectedLeaders: [],
    biggestRankMisses: [],
    existingProjectionSummary: {} as ProjectionBacktestReport["existingProjectionSummary"],
    availabilitySummary: {} as ProjectionBacktestReport["availabilitySummary"],
    errorDecompositionSummary: {} as ProjectionBacktestReport["errorDecompositionSummary"],
    priorDataSummary: {} as ProjectionBacktestReport["priorDataSummary"],
    idpCalibrationSummary: {} as ProjectionBacktestReport["idpCalibrationSummary"],
    rookieLowSampleSummary: { lowActualSamplePlayers: 0, insufficientPriorDataPlayers: 0 },
    leakageSafety: { targetSeasonExcludedFromInputFeatures: true, inputSeasonsUsed: [2024], actualSeasonUsed: 2025, notes: [] },
    recommendedNextCalibrationPriorities: [],
  };
}

function snapshot(rows: PreseasonProjectionSnapshotRow[]): PreseasonProjectionSnapshot {
  return {
    metadata: {
      artifactType: "blackbird_preseason_projection_snapshot",
      projectionSeason: 2025,
      targetSeason: 2025,
      inputSeasons: [2024],
      excludedSeasons: [2025],
      leakageSafe: true,
      createdForBacktesting: true,
      modelVersion: "preseason_snapshot_v2",
      defaultUniverse: "evaluated-backtest",
      scoringSource: "default",
      scoringProfile: "test",
      notes: [],
    },
    rows,
    diagnostics: {} as PreseasonProjectionSnapshot["diagnostics"],
  };
}

function snapshotRow(
  name: string,
  position: string,
  diagnostics: Partial<PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"]>
): PreseasonProjectionSnapshotRow {
  return {
    sleeperId: `s-${name}`,
    gsisId: `g-${name}`,
    playerName: name,
    normalizedName: name.toLowerCase(),
    position,
    team: "DET",
    matchConfidence: "exact_id",
    projectedGames: 10,
    projectedPpg: 10,
    projectedTotalPoints: 100,
    floorPoints: 80,
    medianPoints: 100,
    ceilingPoints: 120,
    confidence: "medium",
    confidenceScore: 50,
    variant: "blackbird_expected_games_v7_family_selective",
    source: "blackbird_expected_games_v7_family_selective",
    projectionSource: "blackbird_expected_games_v7_family_selective",
    projectionRunId: null,
    projectionReasons: [],
    warnings: [],
    cohortLabels: [],
    universe: "evaluated-backtest",
    inputCoverage: {} as PreseasonProjectionSnapshotRow["inputCoverage"],
    expectedGamesDiagnostics: {
      projectedGamesV1: 10,
      calibratedProjectedGames: 10,
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
      v7ProjectedGames: null,
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
      v7GateReason: null,
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
      v82GuardrailApplied: null,
      v82GuardrailReasonCodes: [],
      v82PpgBucket: null,
      v82AdjustmentBucket: null,
      v82SelectedExpectedGamesReason: null,
      qbStarterProbabilityBucket: null,
      qbStarterSignalReason: null,
      qbExpectedGamesCap: null,
      qbFallbackReason: null,
      ...diagnostics,
    },
  };
}
