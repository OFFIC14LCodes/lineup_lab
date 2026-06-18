import { describe, expect, it } from "vitest";

import { DEFAULT_PLAYER_PROFILE_SCORING } from "@/lib/player-profiles";
import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

import { buildProjectionBacktestDataset } from "./projection-backtest-dataset";
import {
  PROJECTION_ABLATION_VARIANTS,
  buildAblationRows,
  runProjectionAblation,
  variantPrediction,
} from "./projection-ablation";
import { withPredictions } from "./projection-backtest-runner";
import type { ProjectionBacktestExistingProjectionSource, ProjectionBacktestOptions } from "./projection-backtest-types";

describe("projection ablation diagnostics", () => {
  it("constructs all required ablation variants", () => {
    const report = runProjectionAblation({
      source: source([profile()]),
      options: options(),
    });

    expect(report.variantsEvaluated).toEqual(PROJECTION_ABLATION_VARIANTS);
    expect(report.overall.weighted_recent_ppg.count).toBe(1);
    expect(report.componentSummaries.map((summary) => summary.variant)).toContain("weighted_recent_ppg_plus_availability_games");
    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
  });

  it("keeps weighted_recent_ppg anchor unchanged", () => {
    const row = withPredictions(datasetRow());
    const anchor = row.predictions.weighted_recent_ppg;
    const ablation = variantPrediction(row, "weighted_recent_ppg");

    expect(ablation?.predictedPpg).toBe(anchor?.predictedPpg);
    expect(ablation?.predictedGames).toBe(anchor?.predictedGames);
    expect(ablation?.predictedTotalPoints).toBe(anchor?.predictedTotalPoints);
  });

  it("games-only adjustment changes total but not PPG", () => {
    const row = withPredictions(datasetRow(undefined, existingSource(8, 9, 72)));
    const anchor = variantPrediction(row, "weighted_recent_ppg");
    const availability = variantPrediction(row, "weighted_recent_ppg_plus_availability_games");

    expect(availability?.predictedPpg).toBe(anchor?.predictedPpg);
    expect(availability?.predictedGames).toBe(8);
    expect(availability?.predictedTotalPoints).not.toBe(anchor?.predictedTotalPoints);
  });

  it("PPG-only adjustment changes PPG and total", () => {
    const row = withPredictions(datasetRow(profile({
      seasons: [{ season: 2024, ppg: 10, games: 10, consistency: 100, availability: 100, spike: 100 }, { season: 2025, ppg: 9, games: 10 }],
    })));
    const anchor = variantPrediction(row, "weighted_recent_ppg");
    const profileAdjusted = variantPrediction(row, "weighted_recent_ppg_plus_profile_ppg_adjustment");

    expect(profileAdjusted?.predictedPpg).not.toBe(anchor?.predictedPpg);
    expect(profileAdjusted?.predictedTotalPoints).not.toBe(anchor?.predictedTotalPoints);
  });

  it("counts improved and worsened components", () => {
    const report = runProjectionAblation({
      source: source([profile()], existingSource(8, 9, 72)),
      options: options(),
    });
    const summary = report.componentSummaries.find((row) => row.variant === "weighted_recent_ppg_plus_availability_games");

    expect(summary?.playersImproved).toBeGreaterThanOrEqual(0);
    expect(summary?.playersWorsened).toBeGreaterThanOrEqual(0);
    expect((summary?.playersImproved ?? 0) + (summary?.playersWorsened ?? 0) + (summary?.playersUnchanged ?? 0)).toBeGreaterThan(0);
  });

  it("builds position and cohort summaries", () => {
    const report = runProjectionAblation({
      source: source([
        profile({ name: "Receiver", position: "WR" }),
        profile({ name: "Linebacker", position: "LB" }),
      ], existingSource(10, 10, 100, "Receiver", "WR")),
      options: options({ includeIdp: true, positions: null }),
    });

    expect(report.byPosition.WR.weighted_recent_ppg.count).toBe(1);
    expect(report.byPosition.LB.weighted_recent_ppg.count).toBe(1);
    expect(report.byCohort.offense_wr.weighted_recent_ppg.count).toBe(1);
    expect(report.byCohort.idp_lb.weighted_recent_ppg.count).toBe(1);
  });

  it("produces deterministic row ordering", () => {
    const report = runProjectionAblation({
      source: source([
        profile({ name: "Zulu", position: "WR" }),
        profile({ name: "Alpha", position: "QB" }),
      ]),
      options: options({ positions: ["QB", "WR"] }),
    });

    expect(report.rows.filter((row) => row.modelName === "weighted_recent_ppg").map((row) => row.player)).toEqual(["Alpha", "Zulu"]);
  });

  it("excludes target season from inputs", () => {
    const report = runProjectionAblation({
      source: source([profile({ seasons: [{ season: 2024, ppg: 10, games: 10 }, { season: 2025, ppg: 25, games: 10 }] })]),
      options: options(),
    });

    expect(report.leakageSafety.passed).toBe(true);
    expect(report.inputSeasons).toEqual([2024]);
  });

  it("does not mutate source profiles or live projection state", () => {
    const profiles = [profile()];
    const before = JSON.stringify(profiles);
    runProjectionAblation({ source: source(profiles), options: options() });

    expect(JSON.stringify(profiles)).toBe(before);
  });

  it("classifies PPG and games component impacts per player", () => {
    const row = withPredictions(datasetRow(undefined, existingSource(8, 9, 72)));
    const ablationRows = buildAblationRows(row);

    expect(ablationRows.find((entry) => entry.modelName === "weighted_recent_ppg_plus_availability_games")?.classification).toMatch(/helped|hurt|neutral/);
  });
});

function datasetRow(player = profile(), existingProjectionSource?: ProjectionBacktestExistingProjectionSource) {
  return buildProjectionBacktestDataset({
    profiles: [player],
    options: options(),
    existingProjectionSource,
  }).rows[0];
}

function source(profiles: HistoricalPlayerProfileSnapshot[], existingProjectionSource: ProjectionBacktestExistingProjectionSource | null = null) {
  return {
    profiles,
    scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
    scoringMetadata: { scoringSource: "default" as const, scoringProfileName: "test", scoringSettingsSummary: emptyScoringSummary(), warnings: [] },
    existingProjectionSource,
  };
}

function existingSource(games: number, ppg: number, points: number, name = "Test Player", position = "WR"): ProjectionBacktestExistingProjectionSource {
  return {
    status: "available",
    sourceName: "fixture",
    sourcePath: "fixture.json",
    targetSeason: 2025,
    projectionSeason: 2025,
    leakageSafe: true,
    diagnostics: [],
    rows: [
      projectionRow("blackbird_availability_calibrated", games, ppg, points, name, position),
      projectionRow("blackbird_no_prior_calibrated", games, ppg, points, name, position),
      projectionRow("blackbird_calibrated_v2", games, ppg, points, name, position),
      projectionRow("blackbird_cohort_games_calibrated", games, ppg, points, name, position),
      projectionRow("blackbird_cohort_calibrated_v3", games, ppg, points, name, position),
    ],
  };
}

function projectionRow(sourceName: string, games: number, ppg: number, points: number, name: string, position: string) {
  return {
    playerId: null,
    sleeperId: `s-${name}`,
    gsisId: `g-${name}`,
    playerName: name,
    position,
    projectedTotalPoints: points,
    projectedPpg: ppg,
    projectedGames: games,
    source: sourceName,
    matchConfidence: "exact_id",
  };
}

function options(input: Partial<ReturnType<typeof optionsBase>> = {}) {
  return { ...optionsBase(), ...input };
}

function optionsBase(): ProjectionBacktestOptions {
  return { targetSeason: 2025, positions: ["WR"], includeIdp: false, includeExistingProjections: true, scoring: "default" as const, draftRoomId: null, leagueId: null };
}

function profile(input: Partial<{
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  seasons: Array<{ season: number; ppg: number; games: number; consistency?: number; availability?: number; spike?: number }>;
}> = {}): HistoricalPlayerProfileSnapshot {
  const position = input.position ?? "WR";
  const seasons = input.seasons ?? [{ season: 2024, ppg: 10, games: 10 }, { season: 2025, ppg: 9, games: 10 }];
  const name = input.name ?? "Test Player";
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
      status: "Active",
      active: true,
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
      consistencyScore: season.consistency ?? 70,
      spikeScore: season.spike ?? 60,
      availabilityScore: season.availability ?? 90,
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
    seasonHighValueUsageSummaries: [],
    consistencyMetrics: { mean: 0, median: 0, standardDeviation: 0, floorPercentile20: 0, ceilingPercentile80: 0, ceilingPercentile90: 0, boomWeeks: 0, bustWeeks: 0, startableWeeks: 0, consistencyScore: 0, spikeWeekScore: 0 },
    availabilityMetrics: { weeksWithStatRows: 0, missedWeekEstimate: 0, gamesPlayed: 0, availabilityScore: 0 },
    recommendationSignals: { floorScore: 0, ceilingScore: 0, consistencyScore: 0, spikeScore: 0, availabilityScore: 0, volatilityLabel: "low", formatFitHints: { redraft: "", dynasty: "", bestBall: "", idp: null } },
    profileWarnings: [],
  };
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
