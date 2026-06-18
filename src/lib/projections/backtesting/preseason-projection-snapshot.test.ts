import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

import { loadExistingProjectionSourceFromArtifact } from "./projection-backtest-existing-projections";
import type { ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import { buildPreseasonProjectionSnapshot } from "./preseason-projection-snapshot-builder";

describe("preseason projection snapshot", () => {
  it("excludes target season from inputs and marks metadata leakage-safe", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ seasons: [{ season: 2024, ppg: 10, games: 16 }, { season: 2025, ppg: 30, games: 17 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });

    expect(snapshot.metadata.leakageSafe).toBe(true);
    expect(snapshot.metadata.inputSeasons).toEqual([2024]);
    expect(snapshot.metadata.excludedSeasons).toEqual([2025]);
    expect(snapshot.rows[0].inputCoverage.priorSeasonsUsed).toEqual([2024]);
    expect(snapshot.rows[0].projectedPpg).toBeLessThan(20);
  });

  it("projects weighted recent PPG and expected games", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ seasons: [{ season: 2022, ppg: 8, games: 8 }, { season: 2023, ppg: 10, games: 12 }, { season: 2024, ppg: 14, games: 16 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });

    expect(snapshot.rows[0].projectedGames).toBeGreaterThanOrEqual(12);
    expect(snapshot.rows[0].projectedPpg).toBeGreaterThan(11);
    expect(snapshot.rows[0].projectedTotalPoints).toBe(snapshot.rows[0].medianPoints);
  });

  it("uses conservative no-prior projections and warnings", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ name: "Rookie Player", seasons: [], yearsExperience: 0, rookieSeason: 2025 })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });

    expect(snapshot.rows[0].confidence).toBe("very_low");
    expect(snapshot.rows[0].warnings).toContain("no_prior_nfl_data");
    expect(snapshot.rows[0].inputCoverage.noPriorNflData).toBe(true);
    expect(snapshot.diagnostics.noPriorCount).toBe(1);
  });

  it("supports IDP rows when requested", () => {
    const withoutIdp = buildPreseasonProjectionSnapshot({
      profiles: [profile({ position: "LB", seasons: [{ season: 2024, ppg: 9, games: 17 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const withIdp = buildPreseasonProjectionSnapshot({
      profiles: [profile({ position: "LB", seasons: [{ season: 2024, ppg: 9, games: 17 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: true },
    });

    expect(withoutIdp.rows).toHaveLength(0);
    expect(withIdp.rows.filter((row) => row.variant === "blackbird_calibrated_v2")).toHaveLength(1);
    expect(withIdp.diagnostics.idpCount).toBe(1);
  });

  it("is recognized by existing projection loader", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ seasons: [{ season: 2024, ppg: 10, games: 16 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const filePath = tempArtifact(snapshot);
    const loaded = loadExistingProjectionSourceFromArtifact(filePath, 2025);

    expect(loaded.status).toBe("available");
    expect(loaded.leakageSafe).toBe(true);
    expect(loaded.rows[0].projectedPpg).toBe(snapshot.rows[0].projectedPpg);
  });

  it("produces deterministic output ordering", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [
        profile({ name: "Zulu", position: "WR" }),
        profile({ name: "Alpha", position: "QB" }),
      ],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });

    expect(snapshot.rows.filter((row) => row.variant === "blackbird_calibrated_v2").map((row) => row.playerName)).toEqual(["Alpha", "Zulu"]);
  });

  it("includes calibrated variants and cohort/no-prior diagnostics", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ name: "Variant Player", position: "RB", seasons: [] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });

    expect(snapshot.diagnostics.variantCounts.blackbird_calibrated_v2).toBe(1);
    expect(snapshot.diagnostics.variantCounts.blackbird_cohort_calibrated_v3).toBe(1);
    expect(snapshot.rows.map((row) => row.variant)).toContain("blackbird_availability_calibrated");
    expect(snapshot.rows.map((row) => row.variant)).toContain("blackbird_cohort_games_calibrated");
    expect(snapshot.rows.map((row) => row.variant)).toContain("blackbird_cohort_ppg_calibrated");
    expect(snapshot.rows[0].cohortLabels).toContain("rookie_or_no_prior_nfl_data");
    expect(snapshot.rows[0].expectedGamesDiagnostics.calibrationCohort).toBeTruthy();
    expect(snapshot.rows[0].expectedGamesDiagnostics.expectedGamesRule).toContain("cohort rule");
    expect(snapshot.rows[0].inputCoverage.noPriorType).not.toBe("has_prior_nfl_data");
    expect(snapshot.rows[0].expectedGamesDiagnostics.projectedGamesV1).toBeGreaterThan(0);
  });

  it("keeps cohort v3 PPG close to v1 for veteran prior-data players", () => {
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [profile({ name: "Veteran Receiver", position: "WR", seasons: [{ season: 2022, ppg: 8, games: 14 }, { season: 2023, ppg: 10, games: 15 }, { season: 2024, ppg: 12, games: 16 }] })],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const v1 = snapshot.rows.find((row) => row.variant === "blackbird_existing_projection_v1")!;
    const v3 = snapshot.rows.find((row) => row.variant === "blackbird_cohort_calibrated_v3")!;

    expect(Math.abs(v3.projectedPpg - v1.projectedPpg)).toBeLessThanOrEqual(0.5);
    expect(v3.expectedGamesDiagnostics.calibrationCohort).toBe("wr_veteran");
  });

  it("keeps the v8.2 selector on current path when the flag is disabled", () => {
    const player = profile({ name: "Selector Disabled", position: "RB", seasons: [{ season: 2023, ppg: 8, games: 8 }, { season: 2024, ppg: 12, games: 16 }] });
    const baseline = buildPreseasonProjectionSnapshot({
      profiles: [player],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
    });
    const disabled = buildPreseasonProjectionSnapshot({
      profiles: [player],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
      expectedGamesSelector: {
        flagEnabled: false,
        readinessArtifactsAvailable: true,
        readinessRows: new Map([[player.identity.sleeperId!, readinessRow({ playerId: player.identity.sleeperId!, position: "RB" })]]),
      },
    });
    const baselineV7 = rowFor(baseline, "blackbird_expected_games_v7_family_selective");
    const disabledV7 = rowFor(disabled, "blackbird_expected_games_v7_family_selective");

    expect(disabledV7.projectedGames).toBe(baselineV7.projectedGames);
    expect(disabledV7.projectedTotalPoints).toBe(baselineV7.projectedTotalPoints);
    expect(disabledV7.expectedGamesDiagnostics.expectedGamesModelSelected).toBe("current");
    expect(disabledV7.expectedGamesDiagnostics.expectedGamesSelectionReason).toBe("flag_disabled");
    expect(selectorSummary(disabled).selectedV82Rows).toBe(0);
  });

  it("uses v8.2 expected games for selector-approved rows when the flag is enabled", () => {
    const player = profile({ name: "Selector Approved", position: "RB", seasons: [{ season: 2023, ppg: 6, games: 6 }, { season: 2024, ppg: 14, games: 16 }] });
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [player],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
      expectedGamesSelector: {
        flagEnabled: true,
        readinessArtifactsAvailable: true,
        readinessRows: new Map([[player.identity.sleeperId!, readinessRow({ playerId: player.identity.sleeperId!, position: "RB" })]]),
      },
    });
    const v7 = rowFor(snapshot, "blackbird_expected_games_v7_family_selective");
    const v82 = rowFor(snapshot, "blackbird_expected_games_v8_2_high_impact_guardrail");

    expect(v7.expectedGamesDiagnostics.expectedGamesModelSelected).toBe("blackbird_expected_games_v8_2_high_impact_guardrail");
    expect(v7.expectedGamesDiagnostics.expectedGamesSelectionReason).toBe("eligible_safe_candidate");
    expect(v7.projectedGames).toBe(v82.projectedGames);
    expect(v7.projectedTotalPoints).toBe(v82.projectedTotalPoints);
    expect(selectorSummary(snapshot).selectedV82Rows).toBe(1);
    expect(selectorSummary(snapshot).kRowsUsingV82).toBe(0);
  });

  it("fails closed to current path when readiness artifacts are missing", () => {
    const player = profile({ name: "Missing Artifact", position: "WR", seasons: [{ season: 2024, ppg: 11, games: 14 }] });
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [player],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
      expectedGamesSelector: {
        flagEnabled: true,
        readinessArtifactsAvailable: false,
        readinessRows: null,
      },
    });
    const v7 = rowFor(snapshot, "blackbird_expected_games_v7_family_selective");

    expect(v7.expectedGamesDiagnostics.expectedGamesModelSelected).toBe("current");
    expect(v7.expectedGamesDiagnostics.expectedGamesSelectionReason).toBe("missing_safety_artifacts");
    expect(selectorSummary(snapshot).selectedV82Rows).toBe(0);
    expect(selectorSummary(snapshot).missingArtifactRows).toBe(1);
  });

  it("keeps protected K rows on current path even when the flag is enabled", () => {
    const player = profile({ name: "Protected Kicker", position: "K", seasons: [{ season: 2024, ppg: 8, games: 17 }] });
    const snapshot = buildPreseasonProjectionSnapshot({
      profiles: [player],
      scoringMetadata: metadata(),
      options: { targetSeason: 2025, includeIdp: false },
      expectedGamesSelector: {
        flagEnabled: true,
        readinessArtifactsAvailable: true,
        readinessRows: new Map([[player.identity.sleeperId!, readinessRow({ playerId: player.identity.sleeperId!, position: "K" })]]),
      },
    });
    const v7 = rowFor(snapshot, "blackbird_expected_games_v7_family_selective");

    expect(v7.expectedGamesDiagnostics.expectedGamesModelSelected).toBe("current");
    expect(v7.expectedGamesDiagnostics.expectedGamesSelectionReason).toBe("kicker_policy_protected");
    expect(selectorSummary(snapshot).selectedV82Rows).toBe(0);
    expect(selectorSummary(snapshot).protectedRows).toBe(1);
  });
});

function profile(input: Partial<{
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  seasons: Array<{ season: number; ppg: number; games: number }>;
  yearsExperience: number;
  rookieSeason: number;
}> = {}): HistoricalPlayerProfileSnapshot {
  const position = input.position ?? "WR";
  const seasons = input.seasons ?? [{ season: 2024, ppg: 10, games: 16 }];
  return {
    identity: {
      blackbirdPlayerId: null,
      sleeperId: `s-${input.name ?? "test"}`,
      gsisId: `g-${input.name ?? "test"}`,
      espnId: null,
      pfrId: null,
      nflId: null,
      smartId: null,
      matchConfidence: "exact_id",
      matchReasons: ["test"],
      preservedIds: { blackbirdPlayerId: null, sleeperId: `s-${input.name ?? "test"}`, gsisId: `g-${input.name ?? "test"}`, espnId: null, pfrId: null, nflId: null, smartId: null },
    },
    bio: {
      name: input.name ?? "Test Player",
      position,
      normalizedPosition: position,
      team: "DET",
      status: "Active",
      active: true,
      age: 25,
      birthDate: "2000-01-01",
      height: 72,
      weight: 210,
      college: "Example",
      rookieSeason: input.rookieSeason ?? 2020,
      yearsExperience: input.yearsExperience ?? 5,
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
      consistencyScore: 75,
      spikeScore: 60,
      availabilityScore: season.games >= 15 ? 95 : 70,
    })),
    careerMetadata: {
      rookieSeason: input.rookieSeason ?? 2020,
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
      targetsPerGame: 8,
      receptionsPerGame: 5,
      passAttemptsPerGame: 0,
      yardsPerTouch: 10,
      touchdownDependency: 5,
      receivingUsageShare: 100,
      rushingUsageShare: 0,
      targetVolumePerGame: 8,
      tackleFloorScore: position === "LB" ? 80 : null,
      bigPlayDependencyScore: null,
      sackDependencyScore: null,
      gamesWithSnapData: season.games,
      gamesWithParticipationData: season.games,
      weeklyUsageConsistency: 80,
      offensiveSnapShare: ["WR", "TE", "RB", "QB"].includes(position) ? 0.75 : null,
      defensiveSnapShare: ["DL", "LB", "DB"].includes(position) ? 0.8 : null,
      specialTeamsSnapShare: null,
      gamesOver70PercentSnaps: season.games,
      gamesUnder40PercentSnaps: 0,
      trendLabel: "stable",
    })),
    seasonHighValueUsageSummaries: seasons.map((season) => ({
      season: season.season,
      games: season.games,
      sourceStatus: "available",
      gamesWithHighValueUsage: season.games,
      highValueTouchesPerGame: 1,
      highValueTargetsPerGame: 1,
      redZoneCarriesPerGame: 0,
      inside10CarriesPerGame: 0,
      inside5CarriesPerGame: 0,
      goalLineCarriesPerGame: 0,
      redZoneTargetsPerGame: 1,
      inside10TargetsPerGame: 0,
      endZoneTargetsPerGame: 0,
      deepTargetsPerGame: 1,
      thirdDownTargetsPerGame: 1,
      twoMinuteTargetsPerGame: 0,
      airYardsPerTarget: 10,
      redZonePassAttemptsPerGame: null,
      designedQbRushesPerGame: null,
      scramblesPerGame: null,
      highValueUsageShare: 10,
      targetHighValueShare: 10,
      touchdownDependency: 5,
      trendLabel: "stable",
      modifiers: ["red_zone_role"],
    })),
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

function tempArtifact(value: unknown) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "blackbird-preseason-snapshot-"));
  const filePath = path.join(dir, "snapshot.json");
  writeFileSync(filePath, JSON.stringify(value), "utf8");
  return filePath;
}

function rowFor(snapshot: ReturnType<typeof buildPreseasonProjectionSnapshot>, variant: string) {
  const row = snapshot.rows.find((entry) => entry.variant === variant);
  if (!row) throw new Error(`Missing ${variant}`);
  return row;
}

function selectorSummary(snapshot: ReturnType<typeof buildPreseasonProjectionSnapshot>) {
  if (!snapshot.diagnostics.expectedGamesSelector) throw new Error("Missing expected-games selector summary");
  return snapshot.diagnostics.expectedGamesSelector;
}

function readinessRow(input: { playerId: string; position: string }): ProjectionV82FeatureFlagReadinessRow {
  return {
    playerId: input.playerId,
    player: input.playerId,
    position: input.position,
    team: "DET",
    status: "would_use_v8_2_under_flag",
    protectionReasons: ["eligible_for_flag_candidate"],
    universeEligibilityStatus: "active_plausible",
    finalClassification: "eligible_for_projection_promotion",
    currentExpectedGames: 12,
    v82ExpectedGames: 13,
    gamesDelta: 1,
    currentProjectedTotal: 120,
    v82ProjectedTotal: 130,
    projectedPointDelta: 10,
    movementBucket: "5-10",
    criticalMovement: false,
    meaningfulRankMover: false,
    riskFlags: [],
    reasonCodes: [],
  };
}
