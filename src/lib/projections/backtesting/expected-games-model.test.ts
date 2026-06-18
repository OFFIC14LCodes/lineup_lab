import { describe, expect, it } from "vitest";

import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

import { projectExpectedGamesV4 } from "./expected-games-model";
import { buildPreseasonProjectionSnapshot } from "./preseason-projection-snapshot-builder";
import { buildProjectionBacktestDataset } from "./projection-backtest-dataset";
import { withPredictions } from "./projection-backtest-runner";
import { calculateWeightedBaselineExpectedGamesFromBacktestFeatures } from "./weighted-baseline-expected-games";

describe("position-specific expected-games v4 model", () => {
  it("keeps weighted recent PPG anchor unchanged in snapshot v4", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ seasons: [{ season: 2024, ppg: 10, games: 10 }, { season: 2025, ppg: 30, games: 17 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const v4 = snapshot.rows.find((row) => row.variant === "blackbird_expected_games_v4")!;

    expect(v4.projectedPpg).toBe(10);
    expect(v4.projectedTotalPoints).toBe(v4.projectedPpg * v4.projectedGames);
    expect(v4.inputCoverage.priorSeasonsUsed).toEqual([2024]);
  });

  it("v4 changes expected games and total points only", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ position: "RB", usage: { touchesPerGame: 22, offensiveSnapShare: 0.72 }, seasons: [{ season: 2024, ppg: 12, games: 10 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const v1 = snapshot.rows.find((row) => row.variant === "blackbird_existing_projection_v1")!;
    const v4 = snapshot.rows.find((row) => row.variant === "blackbird_expected_games_v4")!;

    expect(v4.projectedPpg).not.toBeNaN();
    expect(v4.projectedPpg).toBe(v1.inputCoverage.priorPpg);
    expect(v4.projectedTotalPoints).toBe(v4.projectedPpg * v4.projectedGames);
  });

  it("QB starter expected-games rule works", () => {
    const result = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 32, offensiveSnapShare: 0.9 }, seasons: [{ season: 2024, ppg: 18, games: 16 }] }));

    expect(result.expectedGamesRule).toBe("qb_projected_or_prior_starter_expected_games");
    expect(result.v4ProjectedGames).toBeGreaterThanOrEqual(15);
  });

  it("QB backup expected-games rule works", () => {
    const result = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 4, offensiveSnapShare: 0.2 }, seasons: [{ season: 2024, ppg: 6, games: 5 }] }));

    expect(result.expectedGamesRule).toBe("qb_backup_or_low_sample_expected_games");
    expect(result.v4ProjectedGames).toBeLessThanOrEqual(7);
  });

  it("RB volatility and lead-role rules work", () => {
    const lead = resultFor(profile({ position: "RB", usage: { touchesPerGame: 22, offensiveSnapShare: 0.72 }, seasons: [{ season: 2024, ppg: 12, games: 14 }] }));
    const lowSample = resultFor(profile({ position: "RB", usage: { touchesPerGame: 4, offensiveSnapShare: 0.25 }, seasons: [{ season: 2024, ppg: 4, games: 6 }] }));

    expect(lead.expectedGamesRule).toBe("rb_lead_role_protected_expected_games");
    expect(lowSample.expectedGamesWarnings).toContain("rb_low_sample_capped_games");
  });

  it("WR/TE stable role rule works", () => {
    const wr = resultFor(profile({ position: "WR", usage: { targetsPerGame: 9, offensiveSnapShare: 0.8 }, seasons: [{ season: 2024, ppg: 11, games: 14 }] }));
    const te = resultFor(profile({ position: "TE", usage: { targetsPerGame: 6, offensiveSnapShare: 0.7 }, seasons: [{ season: 2024, ppg: 8, games: 13 }] }));

    expect(wr.expectedGamesRule).toBe("wr_weighted_recent_role_expected_games");
    expect(te.expectedGamesRule).toBe("te_weighted_recent_role_expected_games");
    expect(wr.v4ProjectedGames).toBeGreaterThanOrEqual(14);
  });

  it("K simple rule works", () => {
    const result = resultFor(profile({ position: "K", seasons: [{ season: 2024, ppg: 7, games: 16 }] }));

    expect(result.expectedGamesRule).toBe("kicker_simple_roster_status_expected_games");
    expect(result.v4ProjectedGames).toBeGreaterThanOrEqual(8);
  });

  it("LB, DL, and DB IDP rules work", () => {
    const lb = resultFor(profile({ position: "LB", usage: { defensiveSnapShare: 0.82, tackleFloorScore: 80 }, seasons: [{ season: 2024, ppg: 9, games: 14 }] }));
    const dl = resultFor(profile({ position: "DL", usage: { defensiveSnapShare: 0.38, sackDependencyScore: 75 }, seasons: [{ season: 2024, ppg: 6, games: 14 }] }));
    const db = resultFor(profile({ position: "DB", usage: { defensiveSnapShare: 0.35 }, seasons: [{ season: 2024, ppg: 7, games: 14 }] }));

    expect(lb.expectedGamesRule).toBe("lb_snap_tackle_floor_expected_games");
    expect(dl.expectedGamesWarnings).toContain("dl_rotational_or_sack_dependent_conservative_games");
    expect(db.expectedGamesWarnings).toContain("db_low_snap_share_volatility_games");
  });

  it("no-prior/no-signal player is conservative", () => {
    const result = resultFor(profile({ position: "WR", seasons: [], active: false }));

    expect(result.v4ProjectedGames).toBeLessThanOrEqual(2);
    expect(result.expectedGamesWarnings).toContain("no_prior_nfl_data");
  });

  it("v4 appears in backtest metrics after source row is present", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile()],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const sourceRows = snapshot.rows.map((row) => ({
      playerId: null,
      sleeperId: row.sleeperId,
      gsisId: row.gsisId,
      playerName: row.playerName,
      position: row.position,
      projectedTotalPoints: row.projectedTotalPoints,
      projectedPpg: row.projectedPpg,
      projectedGames: row.projectedGames,
      source: row.source,
      matchConfidence: row.matchConfidence,
    }));
    const row = withPredictions(buildProjectionBacktestDataset({
      profiles: [profile()],
      options: { targetSeason: 2025, positions: ["WR"], includeIdp: false, includeExistingProjections: true, scoring: "default", draftRoomId: null, leagueId: null },
      existingProjectionSource: { status: "available", sourceName: "fixture", sourcePath: "fixture", targetSeason: 2025, projectionSeason: 2025, leakageSafe: true, rows: sourceRows, diagnostics: [] },
    }).rows[0], ["weighted_recent_ppg", "blackbird_expected_games_v4"]);

    expect(row.predictions.blackbird_expected_games_v4?.predictedPpg).toBeTruthy();
  });

  it("v5 uses v4 for RB/WR when confidence is high and falls back when low", () => {
    const rbHigh = resultFor(profile({ position: "RB", usage: { touchesPerGame: 22, offensiveSnapShare: 0.72 }, seasons: [{ season: 2023, ppg: 10, games: 12 }, { season: 2024, ppg: 12, games: 14 }] }));
    const wrLow = resultFor(profile({ position: "WR", usage: { targetsPerGame: 2, offensiveSnapShare: 0.25 }, seasons: [{ season: 2024, ppg: 5, games: 10 }] }));

    expect(rbHigh.selectedExpectedGamesMethod).toBe("v4_position_model");
    expect(rbHigh.v5ProjectedGames).toBe(rbHigh.v4ProjectedGames);
    expect(wrLow.selectedExpectedGamesMethod).toBe("baseline_games");
    expect(wrLow.fallbackReason).toContain("WR");
  });

  it("v5 preserves LB tackle-floor/full-time role signal and caps DL sack-only profiles", () => {
    const lb = resultFor(profile({ position: "LB", usage: { defensiveSnapShare: 0.82, tackleFloorScore: 80 }, seasons: [{ season: 2023, ppg: 8, games: 12 }, { season: 2024, ppg: 9, games: 14 }] }));
    const dl = resultFor(profile({ position: "DL", usage: { defensiveSnapShare: 0.35, sackDependencyScore: 80 }, seasons: [{ season: 2023, ppg: 5, games: 15 }, { season: 2024, ppg: 6, games: 14 }] }));

    expect(lb.selectedExpectedGamesMethod).toBe("v4_position_model");
    expect(dl.selectedExpectedGamesMethod).toBe("baseline_games");
    expect(dl.v5ProjectedGames).toBeLessThanOrEqual(dl.previousProjectedGames);
  });

  it("v5 uses safe TE and simple K models", () => {
    const te = resultFor(profile({ position: "TE", usage: { targetsPerGame: 4, offensiveSnapShare: 0.58 }, seasons: [{ season: 2024, ppg: 7, games: 11 }] }));
    const kicker = resultFor(profile({ position: "K", seasons: [{ season: 2024, ppg: 7, games: 16 }] }));

    expect(te.selectedExpectedGamesMethod).toBe("te_safe_model");
    expect(te.v5ProjectedGames).toBe(te.previousProjectedGames);
    expect(kicker.selectedExpectedGamesMethod).toBe("simple_kicker_games");
    expect(kicker.v5ProjectedGames).toBe(kicker.previousProjectedGames);
  });

  it("v5 distinguishes QB clear starter from backup/no-prior QB", () => {
    const starter = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 34, offensiveSnapShare: 0.9 }, seasons: [{ season: 2023, ppg: 18, games: 15 }, { season: 2024, ppg: 19, games: 16 }] }));
    const backup = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 5, offensiveSnapShare: 0.2 }, seasons: [{ season: 2024, ppg: 5, games: 5 }] }));
    const noPrior = resultFor(profile({ position: "QB", seasons: [], active: true }));

    expect(starter.selectedExpectedGamesMethod).toBe("qb_starter_model");
    expect(starter.v5ProjectedGames).toBeGreaterThanOrEqual(15);
    expect(backup.selectedExpectedGamesMethod).toBe("qb_backup_model");
    expect(backup.v5ProjectedGames).toBeLessThanOrEqual(5);
    expect(noPrior.selectedExpectedGamesMethod).toBe("no_prior_minimal");
    expect(noPrior.v5ProjectedGames).toBeLessThanOrEqual(2);
  });

  it("v5 appears in backtest metrics after source row is present", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile()],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const sourceRows = snapshot.rows.map((row) => ({
      playerId: null,
      sleeperId: row.sleeperId,
      gsisId: row.gsisId,
      playerName: row.playerName,
      position: row.position,
      projectedTotalPoints: row.projectedTotalPoints,
      projectedPpg: row.projectedPpg,
      projectedGames: row.projectedGames,
      source: row.source,
      matchConfidence: row.matchConfidence,
    }));
    const row = withPredictions(buildProjectionBacktestDataset({
      profiles: [profile()],
      options: { targetSeason: 2025, positions: ["WR"], includeIdp: false, includeExistingProjections: true, scoring: "default", draftRoomId: null, leagueId: null },
      existingProjectionSource: { status: "available", sourceName: "fixture", sourcePath: "fixture", targetSeason: 2025, projectionSeason: 2025, leakageSafe: true, rows: sourceRows, diagnostics: [] },
    }).rows[0], ["weighted_recent_ppg", "blackbird_expected_games_v5_selective"]);

    expect(row.predictions.blackbird_expected_games_v5_selective?.predictedPpg).toBeTruthy();
  });

  it("v6 uses expected-games model for eligible RB and gates WR by role confidence", () => {
    const rb = resultFor(profile({ position: "RB", usage: { touchesPerGame: 18, offensiveSnapShare: 0.6 }, seasons: [{ season: 2023, ppg: 9, games: 12 }, { season: 2024, ppg: 11, games: 13 }] }));
    const wrPass = resultFor(profile({ position: "WR", usage: { targetsPerGame: 8, offensiveSnapShare: 0.78 }, seasons: [{ season: 2023, ppg: 10, games: 13 }, { season: 2024, ppg: 11, games: 14 }] }));
    const wrFail = resultFor(profile({ position: "WR", usage: { targetsPerGame: 2, offensiveSnapShare: 0.32 }, seasons: [{ season: 2024, ppg: 5, games: 10 }] }));

    expect(rb.v6SelectedExpectedGamesMethod).toBe("v4_position_model");
    expect(rb.v6GateReason).toBe("position_family_passed_gate");
    expect(wrPass.v6SelectedExpectedGamesMethod).toBe("v4_position_model");
    expect(wrPass.v6PositionFamilyGateStatus).toBe("passed");
    expect(wrFail.v6SelectedExpectedGamesMethod).toBe("baseline_games");
    expect(wrFail.v6GateReason).toBe("position_family_failed_gate");
  });

  it("v6 uses IDP expected-games for DL/LB/DB with safeguards", () => {
    const lb = resultFor(profile({ position: "LB", usage: { defensiveSnapShare: 0.82, tackleFloorScore: 80 }, seasons: [{ season: 2023, ppg: 8, games: 12 }, { season: 2024, ppg: 9, games: 14 }] }));
    const dl = resultFor(profile({ position: "DL", usage: { defensiveSnapShare: 0.35, sackDependencyScore: 80 }, seasons: [{ season: 2023, ppg: 5, games: 15 }, { season: 2024, ppg: 6, games: 14 }] }));
    const db = resultFor(profile({ position: "DB", usage: { defensiveSnapShare: 0.78, tackleFloorScore: 75 }, seasons: [{ season: 2023, ppg: 7, games: 13 }, { season: 2024, ppg: 8, games: 15 }] }));

    expect(lb.v6GateReason).toBe("idp_expected_games_enabled");
    expect(lb.v6SelectedExpectedGamesMethod).toBe("v4_position_model");
    expect(dl.v6SelectedExpectedGamesMethod).toBe("baseline_games");
    expect(dl.v6FallbackReason).toContain("DL");
    expect(db.v6GateReason).toBe("idp_expected_games_enabled");
  });

  it("v6 falls back for TE and K", () => {
    const te = resultFor(profile({ position: "TE", usage: { targetsPerGame: 8, offensiveSnapShare: 0.8 }, seasons: [{ season: 2023, ppg: 8, games: 12 }, { season: 2024, ppg: 9, games: 13 }] }));
    const kicker = resultFor(profile({ position: "K", seasons: [{ season: 2023, ppg: 7, games: 15 }, { season: 2024, ppg: 8, games: 16 }] }));

    expect(te.v6SelectedExpectedGamesMethod).toBe("te_safe_model");
    expect(te.v6GateReason).toBe("te_baseline_fallback");
    expect(kicker.v6SelectedExpectedGamesMethod).toBe("simple_kicker_games");
    expect(kicker.v6GateReason).toBe("k_baseline_fallback");
  });

  it("v6 distinguishes QB clear starter from backup/no-prior QB and emits gate reasons", () => {
    const starter = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 34, offensiveSnapShare: 0.9 }, seasons: [{ season: 2023, ppg: 18, games: 15 }, { season: 2024, ppg: 19, games: 16 }] }));
    const backup = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 5, offensiveSnapShare: 0.2 }, seasons: [{ season: 2024, ppg: 5, games: 5 }] }));
    const noPrior = resultFor(profile({ position: "QB", seasons: [], active: true }));

    expect(starter.v6SelectedExpectedGamesMethod).toBe("qb_starter_model");
    expect(starter.v6GateReason).toBe("qb_clear_starter_expected_games");
    expect(backup.v6SelectedExpectedGamesMethod).toBe("qb_backup_model");
    expect(backup.v6ProjectedGames).toBeLessThanOrEqual(5);
    expect(noPrior.v6SelectedExpectedGamesMethod).toBe("no_prior_minimal");
    expect(noPrior.v6ProjectedGames).toBeLessThanOrEqual(2);
  });

  it("v6 appears in snapshot/backtest metrics after source row is present", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile()],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const v6 = snapshot.rows.find((row) => row.variant === "blackbird_expected_games_v6_gated")!;
    const sourceRows = snapshot.rows.map((row) => ({
      playerId: null,
      sleeperId: row.sleeperId,
      gsisId: row.gsisId,
      playerName: row.playerName,
      position: row.position,
      projectedTotalPoints: row.projectedTotalPoints,
      projectedPpg: row.projectedPpg,
      projectedGames: row.projectedGames,
      source: row.source,
      matchConfidence: row.matchConfidence,
    }));
    const row = withPredictions(buildProjectionBacktestDataset({
      profiles: [profile()],
      options: { targetSeason: 2025, positions: ["WR"], includeIdp: false, includeExistingProjections: true, scoring: "default", draftRoomId: null, leagueId: null },
      existingProjectionSource: { status: "available", sourceName: "fixture", sourcePath: "fixture", targetSeason: 2025, projectionSeason: 2025, leakageSafe: true, rows: sourceRows, diagnostics: [] },
    }).rows[0], ["weighted_recent_ppg", "blackbird_expected_games_v6_gated"]);

    expect(v6.expectedGamesDiagnostics.v6GateReason).toBeTruthy();
    expect(row.predictions.blackbird_expected_games_v6_gated?.predictedPpg).toBeTruthy();
  });

  it("v7 hard-falls back for TE and K", () => {
    const te = resultFor(profile({ position: "TE", usage: { targetsPerGame: 9, offensiveSnapShare: 0.84 }, seasons: [{ season: 2023, ppg: 9, games: 12 }, { season: 2024, ppg: 10, games: 13 }] }));
    const kicker = resultFor(profile({ position: "K", seasons: [{ season: 2023, ppg: 7, games: 15 }, { season: 2024, ppg: 8, games: 16 }] }));

    expect(te.v7SelectedExpectedGamesMethod).toBe("te_safe_model");
    expect(te.v7GateReason).toBe("te_hard_baseline_fallback");
    expect(te.v7FallbackReason).toContain("TE expected-games model disabled");
    expect(kicker.v7SelectedExpectedGamesMethod).toBe("simple_kicker_games");
    expect(kicker.v7GateReason).toBe("k_hard_baseline_fallback");
    expect(kicker.v7FallbackReason).toContain("K expected-games model disabled");
  });

  it("v7 TE/K hard fallback uses the same games baseline as weighted_recent_ppg", () => {
    const profiles = [
      profile({ name: "Parity TE", position: "TE", usage: { targetsPerGame: 8, offensiveSnapShare: 0.8 }, seasons: [{ season: 2022, ppg: 7, games: 16 }, { season: 2023, ppg: 8, games: 8 }, { season: 2024, ppg: 9, games: 13 }, { season: 2025, ppg: 10, games: 12 }] }),
      profile({ name: "Parity K", position: "K", seasons: [{ season: 2022, ppg: 6, games: 9 }, { season: 2023, ppg: 7, games: 17 }, { season: 2024, ppg: 8, games: 15 }, { season: 2025, ppg: 9, games: 14 }] }),
    ];
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles,
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const dataset = buildProjectionBacktestDataset({
      profiles,
      options: { targetSeason: 2025, positions: ["TE", "K"], includeIdp: false, includeExistingProjections: false, scoring: "default", draftRoomId: null, leagueId: null },
    });

    for (const row of dataset.rows) {
      const v7 = snapshot.rows.find((snapshotRow) => snapshotRow.sleeperId === row.identity.sleeperId && snapshotRow.variant === "blackbird_expected_games_v7_family_selective")!;
      const weightedGames = calculateWeightedBaselineExpectedGamesFromBacktestFeatures(row.inputFeatures);
      expect(v7.projectedGames).toBe(weightedGames);
      expect(v7.expectedGamesDiagnostics.v7GateReason).toBe(row.identity.position === "TE" ? "te_hard_baseline_fallback" : "k_hard_baseline_fallback");
    }
  });

  it("v8.1 preserves TE and K fallback outputs", () => {
    const te = resultFor(profile({ position: "TE", usage: { targetsPerGame: 9, offensiveSnapShare: 0.84 }, seasons: [{ season: 2023, ppg: 9, games: 12 }, { season: 2024, ppg: 10, games: 13 }] }));
    const kicker = resultFor(profile({ position: "K", seasons: [{ season: 2023, ppg: 7, games: 15 }, { season: 2024, ppg: 8, games: 16 }] }));

    expect(te.v81ProjectedGames).toBe(te.v8ProjectedGames);
    expect(te.v81GatesApplied).toContain("te_fallback_preserved");
    expect(kicker.v81ProjectedGames).toBe(kicker.v8ProjectedGames);
    expect(kicker.v81GatesApplied).toContain("k_fallback_preserved");
  });

  it("v8.1 dampens high-PPG offensive movement from v7", () => {
    const qb = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 35, offensiveSnapShare: 0.9 }, seasons: [{ season: 2023, ppg: 22, games: 8 }, { season: 2024, ppg: 24, games: 16 }] }));

    expect(qb.v81GatesApplied).toContain("high_ppg_offense_dampen");
    expect(qb.v81GatesApplied).toContain("qb_high_ppg_dampen");
    expect(Math.abs(qb.v81CalibratedDeltaFromV7)).toBeLessThanOrEqual(Math.abs(qb.v81RawDeltaFromV7));
  });

  it("v8.1 keeps no-prior rows conservative", () => {
    const noPrior = resultFor(profile({ position: "DB", seasons: [], active: true }));

    expect(noPrior.v81GatesApplied).toContain("no_prior_stats_conservative");
    expect(Math.abs(noPrior.v81CalibratedDeltaFromV7)).toBeLessThanOrEqual(Math.abs(noPrior.v81RawDeltaFromV7));
  });

  it("v8.2 applies an extra high-impact guardrail to elite QB rows", () => {
    const qb = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 35, offensiveSnapShare: 0.9 }, seasons: [{ season: 2023, ppg: 22, games: 8 }, { season: 2024, ppg: 24, games: 16 }] }));

    expect(qb.v82BaseModelUsed).toBe("blackbird_expected_games_v8_1_calibrated_gate");
    expect(qb.v82GuardrailReasonCodes).toContain("high_impact_guardrail");
    expect(qb.v82GuardrailReasonCodes).toContain("qb_elite_guardrail");
    expect(Math.abs(qb.v82DeltaFromV7)).toBeLessThanOrEqual(Math.abs(qb.v81CalibratedDeltaFromV7));
  });

  it("v8.2 preserves TE and K fallback outputs", () => {
    const te = resultFor(profile({ position: "TE", usage: { targetsPerGame: 9, offensiveSnapShare: 0.84 }, seasons: [{ season: 2023, ppg: 9, games: 12 }, { season: 2024, ppg: 10, games: 13 }] }));
    const kicker = resultFor(profile({ position: "K", seasons: [{ season: 2023, ppg: 7, games: 15 }, { season: 2024, ppg: 8, games: 16 }] }));

    expect(te.v82ProjectedGames).toBe(te.v81ProjectedGames);
    expect(te.v82GuardrailApplied).toBe(false);
    expect(te.v82GuardrailReasonCodes).toContain("te_fallback_preserved");
    expect(kicker.v82ProjectedGames).toBe(kicker.v81ProjectedGames);
    expect(kicker.v82GuardrailApplied).toBe(false);
    expect(kicker.v82GuardrailReasonCodes).toContain("k_fallback_preserved");
  });

  it("v8.2 keeps no-prior rows on the conservative v8.1 path", () => {
    const noPrior = resultFor(profile({ position: "DB", seasons: [], active: true }));

    expect(noPrior.v82ProjectedGames).toBe(noPrior.v81ProjectedGames);
    expect(noPrior.v82GuardrailApplied).toBe(false);
    expect(noPrior.v82GuardrailReasonCodes).toContain("idp_v8_1_preserved");
  });

  it("v8.2 preserves non-elite WR rows outside the high-impact guardrail", () => {
    const wr = resultFor(profile({ position: "WR", usage: { targetsPerGame: 8, offensiveSnapShare: 0.78 }, seasons: [{ season: 2023, ppg: 10, games: 13 }, { season: 2024, ppg: 11, games: 14 }] }));

    expect(wr.v82ProjectedGames).toBe(wr.v81ProjectedGames);
    expect(wr.v82GuardrailApplied).toBe(false);
    expect(wr.v82GuardrailReasonCodes).toContain("wr_v8_1_preserved");
  });

  it("v7 uses expected-games model for eligible RB and WR", () => {
    const rb = resultFor(profile({ position: "RB", usage: { touchesPerGame: 20, offensiveSnapShare: 0.68 }, seasons: [{ season: 2023, ppg: 10, games: 12 }, { season: 2024, ppg: 12, games: 14 }] }));
    const wr = resultFor(profile({ position: "WR", usage: { targetsPerGame: 9, offensiveSnapShare: 0.78 }, seasons: [{ season: 2023, ppg: 10, games: 13 }, { season: 2024, ppg: 11, games: 14 }] }));

    expect(rb.v7SelectedExpectedGamesMethod).toBe("v4_position_model");
    expect(rb.v7GateReason).toBe("position_family_passed_gate");
    expect(wr.v7SelectedExpectedGamesMethod).toBe("v4_position_model");
    expect(wr.v7PositionFamilyGateStatus).toBe("passed");
  });

  it("v7 uses IDP expected-games for DL/LB/DB with safeguards", () => {
    const dl = resultFor(profile({ position: "DL", usage: { defensiveSnapShare: 0.68, sackDependencyScore: 40 }, seasons: [{ season: 2023, ppg: 5, games: 13 }, { season: 2024, ppg: 6, games: 14 }] }));
    const lb = resultFor(profile({ position: "LB", usage: { defensiveSnapShare: 0.82, tackleFloorScore: 80 }, seasons: [{ season: 2023, ppg: 8, games: 12 }, { season: 2024, ppg: 9, games: 14 }] }));
    const db = resultFor(profile({ position: "DB", usage: { defensiveSnapShare: 0.78, tackleFloorScore: 75 }, seasons: [{ season: 2023, ppg: 7, games: 13 }, { season: 2024, ppg: 8, games: 15 }] }));

    expect(dl.v7GateReason).toBe("idp_expected_games_enabled");
    expect(lb.v7GateReason).toBe("idp_expected_games_enabled");
    expect(db.v7GateReason).toBe("idp_expected_games_enabled");
  });

  it("v7 QB starter bucket is deterministic and no-prior QB remains conservative", () => {
    const starter = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 34, offensiveSnapShare: 0.9 }, seasons: [{ season: 2023, ppg: 18, games: 15 }, { season: 2024, ppg: 19, games: 16 }] }));
    const backup = resultFor(profile({ position: "QB", usage: { passAttemptsPerGame: 5, offensiveSnapShare: 0.2 }, seasons: [{ season: 2024, ppg: 5, games: 5 }] }));
    const noPrior = resultFor(profile({ position: "QB", seasons: [], active: true }));

    expect(starter.qbStarterProbabilityBucket).toBe("clear_starter");
    expect(starter.qbExpectedGamesCap).toBe(17);
    expect(backup.qbStarterProbabilityBucket).toBe("backup_or_low_sample");
    expect(backup.qbExpectedGamesCap).toBe(5);
    expect(noPrior.qbStarterProbabilityBucket).toBe("no_prior_minimal");
    expect(noPrior.v7ProjectedGames).toBeLessThanOrEqual(2);
  });

  it("v7 appears in snapshot/backtest metrics after source row is present", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile()],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const v7 = snapshot.rows.find((row) => row.variant === "blackbird_expected_games_v7_family_selective")!;
    const sourceRows = snapshot.rows.map((row) => ({
      playerId: null,
      sleeperId: row.sleeperId,
      gsisId: row.gsisId,
      playerName: row.playerName,
      position: row.position,
      projectedTotalPoints: row.projectedTotalPoints,
      projectedPpg: row.projectedPpg,
      projectedGames: row.projectedGames,
      source: row.source,
      matchConfidence: row.matchConfidence,
    }));
    const row = withPredictions(buildProjectionBacktestDataset({
      profiles: [profile()],
      options: { targetSeason: 2025, positions: ["WR"], includeIdp: false, includeExistingProjections: true, scoring: "default", draftRoomId: null, leagueId: null },
      existingProjectionSource: { status: "available", sourceName: "fixture", sourcePath: "fixture", targetSeason: 2025, projectionSeason: 2025, leakageSafe: true, rows: sourceRows, diagnostics: [] },
    }).rows[0], ["weighted_recent_ppg", "blackbird_expected_games_v7_family_selective"]);

    expect(v7.expectedGamesDiagnostics.v7GateReason).toBeTruthy();
    expect(row.predictions.blackbird_expected_games_v7_family_selective?.predictedPpg).toBeTruthy();
  });

  it("output is deterministic", () => {
    const a = resultFor(profile({ position: "DB", usage: { defensiveSnapShare: 0.8 } }));
    const b = resultFor(profile({ position: "DB", usage: { defensiveSnapShare: 0.8 } }));

    expect(a).toEqual(b);
  });
});

function resultFor(player: HistoricalPlayerProfileSnapshot) {
  const priorSummaries = player.seasonSummaries.filter((summary) => typeof summary.season === "number" && summary.season < 2025);
  const priorUsage = player.seasonUsageSummaries?.find((summary) => summary.season === priorSummaries[0]?.season) ?? null;
  return projectExpectedGamesV4({
    profile: player,
    targetSeason: 2025,
    priorSummaries,
    priorUsage,
    noPrior: priorSummaries.length === 0,
    noPriorType: priorSummaries.length === 0 ? "unsupported_no_signal" : "has_prior_nfl_data",
    previousProjectedGames: priorSummaries[0]?.gamesPlayed ?? 8,
  });
}

function profile(input: Partial<{
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  seasons: Array<{ season: number; ppg: number; games: number }>;
  usage: Partial<NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number]>;
  active: boolean;
}> = {}): HistoricalPlayerProfileSnapshot {
  const position = input.position ?? "WR";
  const name = input.name ?? "Test Player";
  const seasons = input.seasons ?? [{ season: 2024, ppg: 10, games: 12 }, { season: 2025, ppg: 9, games: 11 }];
  return {
    identity: {
      blackbirdPlayerId: null,
      sleeperId: `s-${name}`,
      gsisId: `g-${name}`,
      espnId: null,
      pfrId: null,
      nflId: null,
      smartId: null,
      matchConfidence: "exact_id",
      matchReasons: ["test"],
      preservedIds: { blackbirdPlayerId: null, sleeperId: `s-${name}`, gsisId: `g-${name}`, espnId: null, pfrId: null, nflId: null, smartId: null },
    },
    bio: {
      name,
      position,
      normalizedPosition: position,
      team: "DET",
      status: input.active === false ? "Inactive" : "Active",
      active: input.active !== false,
      age: 25,
      birthDate: "2000-01-01",
      height: 72,
      weight: 210,
      college: "Example",
      rookieSeason: 2020,
      yearsExperience: 5,
    },
    weeklyStats: [],
    seasonSummaries: seasons.map((season) => ({
      season: season.season,
      gamesPlayed: season.games,
      totalFantasyPoints: Math.round(season.ppg * season.games * 10) / 10,
      pointsPerGame: season.ppg,
      positionRank: null,
      keyStatTotals: {},
      floor: season.ppg - 2,
      median: season.ppg,
      ceiling: season.ppg + 4,
      consistencyScore: 70,
      spikeScore: 60,
      availabilityScore: 80,
    })),
    careerMetadata: {
      rookieSeason: 2020,
      firstStatSeason: seasons[0]?.season ?? null,
      latestStatSeason: seasons.at(-1)?.season ?? null,
      seasonsWithStats: seasons.map((season) => season.season),
      seasonsOnRoster: seasons.map((season) => season.season),
      careerGamesWithStatRows: seasons.reduce((sum, season) => sum + season.games, 0),
      activeSeasonsCount: seasons.length,
      coverageLabel: "partial_career",
      coverageNote: null,
    },
    seasonUsageSummaries: seasons.map((season) => ({
      season: season.season,
      games: season.games,
      sourceBasis: "weekly_stats_plus_snaps",
      gamesWithUsage: season.games,
      opportunitiesPerGame: 8,
      touchesPerGame: 5,
      carriesPerGame: 0,
      targetsPerGame: 5,
      receptionsPerGame: 4,
      passAttemptsPerGame: 0,
      yardsPerTouch: 8,
      touchdownDependency: 5,
      receivingUsageShare: 70,
      rushingUsageShare: 0,
      targetVolumePerGame: 5,
      tackleFloorScore: null,
      bigPlayDependencyScore: null,
      sackDependencyScore: null,
      gamesWithSnapData: season.games,
      gamesWithParticipationData: season.games,
      weeklyUsageConsistency: 75,
      offensiveSnapShare: ["WR", "TE", "RB", "QB"].includes(position) ? 0.65 : null,
      defensiveSnapShare: ["DL", "LB", "DB"].includes(position) ? 0.65 : null,
      specialTeamsSnapShare: null,
      gamesOver70PercentSnaps: 5,
      gamesUnder40PercentSnaps: 0,
      trendLabel: "stable",
      ...input.usage,
    })),
    seasonHighValueUsageSummaries: [],
    consistencyMetrics: { mean: 0, median: 0, standardDeviation: 0, floorPercentile20: 0, ceilingPercentile80: 0, ceilingPercentile90: 0, boomWeeks: 0, bustWeeks: 0, startableWeeks: 0, consistencyScore: 0, spikeWeekScore: 0 },
    availabilityMetrics: { weeksWithStatRows: 0, missedWeekEstimate: 0, gamesPlayed: 0, availabilityScore: 0 },
    recommendationSignals: { floorScore: 0, ceilingScore: 0, consistencyScore: 0, spikeScore: 0, availabilityScore: 0, volatilityLabel: "low", formatFitHints: { redraft: "", dynasty: "", bestBall: "", idp: null } },
    profileWarnings: [],
  };
}

function metadata() {
  return { scoringSource: "default" as const, scoringProfileName: "test", scoringSettingsSummary: emptyScoringSummary(), warnings: [] };
}

function emptyScoringSummary() {
  return {
    reception: null,
    passingYard: null,
    passingTd: null,
    interception: null,
    rushingYard: null,
    rushingTd: null,
    receivingYard: null,
    receivingTd: null,
    fumbleLost: null,
    soloTackle: null,
    assistedTackle: null,
    sack: null,
    interceptionDefense: null,
    forcedFumble: null,
    fumbleRecovery: null,
    passDefended: null,
    defensiveTd: null,
    tightEndReceptionBonus: null,
  };
}
