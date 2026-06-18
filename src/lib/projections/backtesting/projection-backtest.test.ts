import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { DEFAULT_PLAYER_PROFILE_SCORING, rescoreHistoricalPlayerProfile } from "@/lib/player-profiles";

import { buildProjectionBacktestDataset } from "./projection-backtest-dataset";
import { computeProjectionBacktestMetrics } from "./projection-backtest-metrics";
import { loadExistingProjectionSourceFromArtifact } from "./projection-backtest-existing-projections";
import {
  careerRecentBlend,
  profileInformedPpg,
  runProjectionBacktest,
  weightedRecentPpg,
  withPredictions,
} from "./projection-backtest-runner";
import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

describe("projection backtesting foundation", () => {
  it("excludes the target season from input features", () => {
    const dataset = buildProjectionBacktestDataset({
      profiles: [profile({ seasons: [{ season: 2024, ppg: 10, games: 17 }, { season: 2025, ppg: 12, games: 17 }] })],
      options: options(),
    });

    expect(dataset.rows).toHaveLength(1);
    expect(dataset.rows[0].inputFeatures.inputSeasonsUsed).toEqual([2024]);
    expect(dataset.leakageSafety.targetSeasonExcludedFromInputFeatures).toBe(true);
    expect(dataset.actualSeasonUsed).toBe(2025);
  });

  it("calculates prior-season baseline correctly", () => {
    const row = withPredictions(buildRow([{ season: 2024, ppg: 10, games: 16 }, { season: 2025, ppg: 12, games: 10 }]));

    expect(row.predictions.prior_season_ppg?.predictedPpg).toBe(10);
    expect(row.predictions.prior_season_ppg?.predictedGames).toBe(16);
    expect(row.predictions.prior_season_ppg?.predictedTotalPoints).toBe(160);
  });

  it("calculates weighted recent baseline from prior one to three seasons", () => {
    const row = buildRow([
      { season: 2022, ppg: 8, games: 17 },
      { season: 2023, ppg: 10, games: 17 },
      { season: 2024, ppg: 14, games: 17 },
      { season: 2025, ppg: 12, games: 17 },
    ]);

    expect(weightedRecentPpg(row.inputFeatures)).toBe(11.6);
  });

  it("calculates career/recent blend correctly", () => {
    const row = buildRow([
      { season: 2023, ppg: 10, games: 10 },
      { season: 2024, ppg: 20, games: 10 },
      { season: 2025, ppg: 15, games: 10 },
    ]);

    expect(careerRecentBlend(row.inputFeatures)).toBe(15.8);
  });

  it("keeps profile-informed adjustment conservative", () => {
    const row = buildRow([
      { season: 2024, ppg: 20, games: 17, consistency: 100, availability: 100, spike: 100 },
      { season: 2025, ppg: 10, games: 17 },
    ]);

    const base = careerRecentBlend(row.inputFeatures) ?? 0;
    const adjusted = profileInformedPpg({
      ...row.inputFeatures,
      priorSeasonOffensiveSnapShare: 0.9,
      priorSeasonHighValueUsageFlags: ["goal_line_role", "red_zone_role"],
    }) ?? 0;

    expect(adjusted).toBeLessThanOrEqual(Math.round(base * 1.12 * 10) / 10);
  });

  it("calculates MAE/RMSE/bias metrics", () => {
    const rows = [
      withPredictions(buildRow([{ season: 2024, ppg: 10, games: 10 }, { season: 2025, ppg: 12, games: 10 }])),
      withPredictions(buildRow([{ season: 2024, ppg: 20, games: 10 }, { season: 2025, ppg: 15, games: 10 }], "B Player")),
    ];
    const metrics = computeProjectionBacktestMetrics({ targetSeason: 2025, inputSeasonsUsed: [2024], actualSeasonUsed: 2025, rows, skipped: { missingActuals: 0, positionFiltered: 0, insufficientPositionSupport: 0 }, leakageSafety: { targetSeasonExcludedFromInputFeatures: true, inputSeasonsUsed: [2024], actualSeasonUsed: 2025 } }, ["prior_season_ppg"]);

    expect(metrics.overall.prior_season_ppg.count).toBe(2);
    expect(metrics.overall.prior_season_ppg.maePpg).toBe(3.5);
    expect(metrics.overall.prior_season_ppg.biasPpg).toBe(1.5);
    expect(metrics.byPosition.WR.prior_season_ppg.count).toBe(2);
    expect(metrics.overall.prior_season_ppg.gamesMae).toBe(0);
    expect(metrics.overall.prior_season_ppg.availabilityMissCounts.accurate_games).toBe(2);
  });

  it("classifies insufficient prior data and low actual sample", () => {
    const insufficient = withPredictions(buildRow([{ season: 2025, ppg: 8, games: 8 }]));
    const lowSample = withPredictions(buildRow([{ season: 2024, ppg: 8, games: 10 }, { season: 2025, ppg: 8, games: 2 }], "Low Sample"));

    expect(insufficient.classification).toBe("insufficient_prior_data");
    expect(lowSample.classification).toBe("low_sample_actual");
    expect(insufficient.priorDataGroup).toBe("no_prior_stats");
  });

  it("calculates games error and PPG-vs-games decomposition", () => {
    const row = withPredictions(buildRow([{ season: 2024, ppg: 10, games: 16 }, { season: 2025, ppg: 12, games: 10 }]));
    const prediction = row.predictions.prior_season_ppg!;

    expect(prediction.gamesError).toBe(6);
    expect(prediction.availabilityMissType).toBe("major_availability_miss");
    expect(prediction.ppgErrorComponent).toBe(-32);
    expect(prediction.gamesErrorComponent).toBe(72);
    expect(prediction.combinedError).toBe(40);
  });

  it("loads leakage-safe existing projection artifact rows", () => {
    const filePath = tempArtifact({
      metadata: { sourceName: "fixture", targetSeason: 2025, projectionSeason: 2025, leakageSafe: true },
      rows: [{
        sleeperId: "s-Test Player",
        playerName: "Test Player",
        position: "WR",
        projectedPpg: 11,
        projectedGames: 16,
        projectedTotalPoints: 176,
        source: "fixture_projection",
      }],
    });
    const source = loadExistingProjectionSourceFromArtifact(filePath, 2025);

    expect(source.status).toBe("available");
    expect(source.rows).toHaveLength(1);
  });

  it("rejects leakage-unsafe existing projection artifacts", () => {
    const filePath = tempArtifact({
      metadata: { sourceName: "fixture", targetSeason: 2025, projectionSeason: 2025, leakageSafe: false },
      rows: [{ playerName: "Test Player", position: "WR", projectedPpg: 11 }],
    });

    expect(loadExistingProjectionSourceFromArtifact(filePath, 2025).status).toBe("rejected");
  });

  it("adds existing Blackbird projection baseline when a safe source matches", () => {
    const source = {
      status: "available" as const,
      sourceName: "fixture",
      sourcePath: "fixture.json",
      targetSeason: 2025,
      projectionSeason: 2025,
      leakageSafe: true,
      diagnostics: [],
      rows: [{
        playerId: null,
        sleeperId: "s-Test Player",
        gsisId: null,
        playerName: "Test Player",
        position: "WR",
        projectedTotalPoints: 176,
        projectedPpg: 11,
        projectedGames: 16,
        source: "fixture_projection",
        matchConfidence: "exact_id",
      }, {
        playerId: null,
        sleeperId: "s-Test Player",
        gsisId: null,
        playerName: "Test Player",
        position: "WR",
        projectedTotalPoints: 160,
        projectedPpg: 10,
        projectedGames: 16,
        source: "blackbird_calibrated_v2",
        matchConfidence: "exact_id",
      }, {
        playerId: null,
        sleeperId: "s-Test Player",
        gsisId: null,
        playerName: "Test Player",
        position: "WR",
        projectedTotalPoints: 168,
        projectedPpg: 10.5,
        projectedGames: 16,
        source: "blackbird_cohort_calibrated_v3",
        matchConfidence: "exact_id",
      }],
    };
    const report = runProjectionBacktest({
      source: {
        profiles: [profile()],
        scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
        scoringMetadata: { scoringSource: "default", scoringProfileName: "test", scoringSettingsSummary: emptyScoringSummary(), warnings: [] },
        existingProjectionSource: source,
      },
      options: options({ includeExistingProjections: true }),
    });

    expect(report.metrics.overall.blackbird_existing_projection.count).toBe(1);
    expect(report.metrics.overall.blackbird_calibrated_v2.count).toBe(1);
    expect(report.metrics.overall.blackbird_cohort_calibrated_v3.count).toBe(1);
    expect(report.metrics.byCohort.offense_wr.blackbird_calibrated_v2.playersEvaluated).toBe(1);
    expect(report.metrics.byCohort.offense_wr.blackbird_cohort_calibrated_v3.playersEvaluated).toBe(1);
    expect(report.existingProjectionSummary.matchedRows).toBe(1);
    expect(report.existingProjectionSummary.leakageSafe).toBe(true);
  });

  it("supports IDP scoring with solo tackles and sacks", () => {
    const scored = rescoreHistoricalPlayerProfile(profile({
      position: "LB",
      weeklyStats: [
        { season: 2024, defensive: { solo_tkl: 5, sack: 1 } },
        { season: 2025, defensive: { solo_tkl: 7, sack: 2 } },
      ],
      seasons: [{ season: 2024, ppg: 0, games: 1 }, { season: 2025, ppg: 0, games: 1 }],
    }), DEFAULT_PLAYER_PROFILE_SCORING);

    expect(scored.seasonSummaries.find((season) => season.season === 2024)?.totalFantasyPoints).toBe(16);
    expect(scored.seasonSummaries.find((season) => season.season === 2025)?.totalFantasyPoints).toBe(26);
  });

  it("produces deterministic row ordering", () => {
    const report = runProjectionBacktest({
      source: {
        profiles: [
          profile({ name: "Zulu", position: "WR", seasons: [{ season: 2024, ppg: 8, games: 5 }, { season: 2025, ppg: 9, games: 5 }] }),
          profile({ name: "Alpha", position: "QB", seasons: [{ season: 2024, ppg: 10, games: 5 }, { season: 2025, ppg: 11, games: 5 }] }),
        ],
        scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
        scoringMetadata: { scoringSource: "default", scoringProfileName: "test", scoringSettingsSummary: emptyScoringSummary(), warnings: [] },
      },
      options: options({ positions: ["QB", "WR"] }),
    });

    expect(report.dataset.rows.map((row) => row.identity.name)).toEqual(["Alpha", "Zulu"]);
    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
  });
});

function buildRow(seasons: Array<{ season: number; ppg: number; games: number; consistency?: number; availability?: number; spike?: number }>, name = "Test Player") {
  return buildProjectionBacktestDataset({
    profiles: [profile({ name, seasons })],
    options: options(),
  }).rows[0];
}

function options(input: Partial<ReturnType<typeof optionsBase>> = {}) {
  return { ...optionsBase(), ...input };
}

function optionsBase() {
  return { targetSeason: 2025, positions: ["WR"], includeIdp: false, includeExistingProjections: false, scoring: "default" as const, draftRoomId: null, leagueId: null };
}

function profile(input: Partial<{
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  seasons: Array<{ season: number; ppg: number; games: number; consistency?: number; availability?: number; spike?: number }>;
  weeklyStats: Array<{ season: number; defensive?: Record<string, number> }>;
}> = {}): HistoricalPlayerProfileSnapshot {
  const position = input.position ?? "WR";
  const seasons = input.seasons ?? [{ season: 2024, ppg: 10, games: 17 }, { season: 2025, ppg: 12, games: 17 }];
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
      rookieSeason: 2020,
      yearsExperience: 5,
    },
    weeklyStats: input.weeklyStats?.map((row, index) => ({
      season: row.season,
      week: index + 1,
      team: "DET",
      opponent: "GB",
      passing: {},
      rushing: {},
      receiving: {},
      kicking: {},
      defensive: row.defensive ?? {},
      calculatedFantasyPoints: 0,
      scoringWarnings: [],
    })) ?? [],
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
  const dir = mkdtempSync(path.join(os.tmpdir(), "blackbird-backtest-"));
  const filePath = path.join(dir, "fixture.json");
  writeFileSync(filePath, JSON.stringify(value), "utf8");
  return filePath;
}
