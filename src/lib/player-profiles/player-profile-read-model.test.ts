import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createPlayerProfileRepository } from "./player-profile-repository";
import { toPlayerProfileReadModel } from "./player-profile-read-model";
import { writeShardedPlayerProfileArtifacts } from "./player-profile-shards";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

describe("player profile read model repository", () => {
  it("looks up sharded profiles by sleeper_id without loading the single artifact", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = await createPlayerProfileRepository({ artifactPath: manifestPath });

    const result = await repo.lookupProfile({ playerId: "sleeper-1" });

    expect(repo.artifactStrategy).toBe("sharded");
    expect(repo.profiles).toEqual([]);
    expect(result.profile?.identity.gsisId).toBe("00-1");
    expect(result.matchedBy).toBe("sleeper_id");
    expect(repo.indexStats.shardCount).toBe(1);
  });

  it("looks up sharded profiles by gsis_id and name + position", async () => {
    const manifestPath = await writeShardedProfiles([profile({ name: "Caleb Williams", position: "QB", sleeperId: "11560", gsisId: "00-0039918" })]);
    const repo = await createPlayerProfileRepository({ artifactPath: manifestPath });

    await expect(repo.lookupProfile({ playerId: "00-0039918" })).resolves.toMatchObject({ matchedBy: "gsis_id" });
    await expect(repo.lookupProfile({ playerId: "Caleb Williams", position: "QB" })).resolves.toMatchObject({ profile: { bio: { name: "Caleb Williams" } } });
  });

  it("handles sharded duplicate IDs conservatively", async () => {
    const manifestPath = await writeShardedProfiles([
      profile({ name: "First", sleeperId: "dup", gsisId: "00-1" }),
      profile({ name: "Second", sleeperId: "dup", gsisId: "00-2" }),
    ]);
    const repo = await createPlayerProfileRepository({ artifactPath: manifestPath });

    const result = await repo.lookupProfile({ playerId: "dup" });

    expect(result.profile).toBeNull();
    expect(result.duplicateKey).toBe("dup");
    expect(repo.indexStats.duplicateIds).toContainEqual({ index: "sleeper_id", key: "dup", count: 2 });
  });

  it("reports missing and invalid sharded profile files during lookup", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const shardPath = path.join(path.dirname(manifestPath), "shards", "shard-000.json");
    rmSync(shardPath, { force: true });

    const missingRepo = await createPlayerProfileRepository({ artifactPath: manifestPath });
    await expect(missingRepo.lookupProfile({ playerId: "sleeper-1" })).resolves.toMatchObject({
      profile: null,
      artifactStatus: "artifact_missing",
    });

    writeFileSync(shardPath, "{not valid", "utf8");
    const invalidRepo = await createPlayerProfileRepository({ artifactPath: manifestPath });
    await expect(invalidRepo.lookupProfile({ playerId: "sleeper-1" })).resolves.toMatchObject({
      profile: null,
      artifactStatus: "artifact_invalid",
    });
  });

  it("keeps Vercel tracing from bundling sharded profile artifacts", () => {
    const nextConfigSource = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

    expect(nextConfigSource).not.toContain("./artifacts/projections/player-profiles-sharded/**/*");
    expect(nextConfigSource).not.toContain("./artifacts/projections/player-profiles.json");
    expect(nextConfigSource).toContain("./data/**/*");
    expect(nextConfigSource).toContain("Do not bundle player profile shards into Vercel functions.");
  });

  it("looks up a profile by sleeper_id", async () => {
    const artifactPath = await writeProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = await createPlayerProfileRepository({ artifactPath });

    const result = await repo.lookupProfile({ playerId: "sleeper-1" });

    expect(result.profile?.identity.gsisId).toBe("00-1");
    expect(result.matchedBy).toBe("sleeper_id");
  });

  it("looks up a profile by gsis_id", async () => {
    const artifactPath = await writeProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = await createPlayerProfileRepository({ artifactPath });

    const result = await repo.lookupProfile({ playerId: "00-1" });

    expect(result.profile?.identity.sleeperId).toBe("sleeper-1");
    expect(result.matchedBy).toBe("gsis_id");
  });

  it("looks up a profile by normalized name and position fallback", async () => {
    const artifactPath = await writeProfiles([profile({ name: "Amon-Ra St. Brown", position: "WR", sleeperId: null, gsisId: "00-1" })]);
    const repo = await createPlayerProfileRepository({ artifactPath });

    const result = await repo.lookupProfile({ playerId: "Amon Ra St Brown", position: "WR" });

    expect(result.profile?.bio.name).toBe("Amon-Ra St. Brown");
    expect(result.matchedBy).toBe("name_position");
  });

  it("handles duplicate IDs conservatively", async () => {
    const artifactPath = await writeProfiles([
      profile({ name: "First", sleeperId: "dup", gsisId: "00-1" }),
      profile({ name: "Second", sleeperId: "dup", gsisId: "00-2" }),
    ]);
    const repo = await createPlayerProfileRepository({ artifactPath });

    const result = await repo.lookupProfile({ playerId: "dup" });

    expect(result.profile).toBeNull();
    expect(result.duplicateKey).toBe("dup");
    expect(repo.indexStats.duplicateIds).toContainEqual({ index: "sleeper_id", key: "dup", count: 2 });
  });

  it("returns null for missing profiles", async () => {
    const artifactPath = await writeProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = await createPlayerProfileRepository({ artifactPath });

    await expect(repo.lookupProfile({ playerId: "missing" })).resolves.toMatchObject({ profile: null });
  });

  it("reports a missing artifact explicitly", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-missing-"));
    const repo = await createPlayerProfileRepository({ artifactPath: path.join(root, "missing-player-profiles.json") });

    expect(repo.exists).toBe(false);
    expect(repo.status).toBe("artifact_missing");
    expect(repo.artifactSizeBytes).toBeNull();
    expect(repo.indexStats.totalProfiles).toBe(0);
    await expect(repo.runtimeDiagnostics()).resolves.toMatchObject({
      artifactExists: false,
      artifactStatus: "artifact_missing",
      profilesLoadedCount: 0,
    });
  });

  it("reports an invalid artifact explicitly", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-invalid-"));
    const artifactPath = path.join(root, "player-profiles.json");
    mkdirSync(path.dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, "{not valid json", "utf8");

    const repo = await createPlayerProfileRepository({ artifactPath });

    expect(repo.exists).toBe(true);
    expect(repo.status).toBe("artifact_invalid");
    expect(repo.loadError).toBeTruthy();
    expect(repo.profiles).toEqual([]);
  });

  it("builds a UI-facing shape with warnings and capped weekly stats", () => {
    const readModel = toPlayerProfileReadModel(profile({
      warnings: ["weak_identity_match"],
      weeklyStats: Array.from({ length: 30 }, (_, index) => weekly(index + 1)),
    }), { weeklyLimit: 10 });

    expect(readModel.header.name).toBe("Test Player");
    expect(readModel.identity.match_confidence).toBe("exact_id");
    expect(readModel.warnings).toContain("weak_identity_match");
    expect(readModel.weeklyGameLog).toHaveLength(10);
    expect(readModel.weeklyGameLogTruncated).toBe(true);
    expect(readModel.summaryMetrics.games).toBe(33);
    expect(readModel.careerMetadata?.coverageLabel).toBe("partial_career");
    expect(readModel.trendMetrics?.trendLabel).toBe("rising");
    expect(readModel.careerSummary?.last2Seasons?.gamesPlayed).toBe(33);
    expect(readModel.usageSummary?.opportunitiesPerGame).toBe(8);
    expect(readModel.roleMetrics?.roleLabel).toBe("volume_receiver");
  });

  it("uses career summary metrics instead of only the latest season", () => {
    const readModel = toPlayerProfileReadModel(profile());

    expect(readModel.summaryMetrics.games).toBe(33);
    expect(readModel.summaryMetrics.total_points).toBe(420);
    expect(readModel.summaryMetrics.points_per_game).toBe(12.7);
    expect(readModel.seasonSummaries).toHaveLength(2);
  });

  it("exposes compact high-value usage fields without raw PBP rows", () => {
    const readModel = toPlayerProfileReadModel(profile({ highValueUsage: true }));

    expect(readModel.highValueUsageSummary?.sourceStatus).toBe("available");
    expect(readModel.highValueUsageSummary?.goalLineCarriesPerGame).toBe(0.5);
    expect(readModel.seasonHighValueUsageSummaries).toHaveLength(1);
    expect(readModel.highValueRoleWarnings).toEqual([]);
    expect(JSON.stringify(readModel)).not.toContain("play_id");
    expect(JSON.stringify(readModel)).not.toContain("desc");
  });
});

async function writeProfiles(profiles: HistoricalPlayerProfileSnapshot[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-read-model-"));
  const artifactPath = path.join(root, "player-profiles.json");
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
  return artifactPath;
}

async function writeShardedProfiles(profiles: HistoricalPlayerProfileSnapshot[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-shards-"));
  const outputDir = path.join(root, "player-profiles-sharded");
  writeShardedPlayerProfileArtifacts({ profiles, generatedAt: "2026-01-01T00:00:00.000Z", outputDir, shardSize: 1 });
  return path.join(outputDir, "manifest.json");
}

function profile(input: Partial<{
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  sleeperId: string | null;
  gsisId: string;
  warnings: HistoricalPlayerProfileSnapshot["profileWarnings"];
  weeklyStats: HistoricalPlayerProfileSnapshot["weeklyStats"];
  highValueUsage: boolean;
}> = {}): HistoricalPlayerProfileSnapshot {
  const position = input.position ?? "WR";
  return {
    identity: {
      blackbirdPlayerId: "bb-1",
      sleeperId: input.sleeperId === undefined ? "sleeper-1" : input.sleeperId,
      gsisId: input.gsisId ?? "00-1",
      espnId: "espn-1",
      pfrId: "pfr-1",
      nflId: "nfl-1",
      smartId: "smart-1",
      matchConfidence: "exact_id",
      matchReasons: ["exact ID match: sleeper_id"],
      preservedIds: {
        blackbirdPlayerId: "bb-1",
        sleeperId: input.sleeperId === undefined ? "sleeper-1" : input.sleeperId,
        gsisId: input.gsisId ?? "00-1",
        espnId: "espn-1",
        pfrId: "pfr-1",
        nflId: "nfl-1",
        smartId: "smart-1",
      },
    },
    bio: {
      name: input.name ?? "Test Player",
      position,
      normalizedPosition: position,
      team: "DET",
      status: "Active",
      active: true,
      age: 24,
      birthDate: "2002-01-01",
      height: 72,
      weight: 205,
      college: "Example",
      rookieSeason: 2024,
      yearsExperience: 2,
    },
    weeklyStats: input.weeklyStats ?? [weekly(1)],
    seasonSummaries: [
      { season: 2025, gamesPlayed: 17, totalFantasyPoints: 240, pointsPerGame: 14.1, positionRank: 12, keyStatTotals: { rec: 80, rec_yd: 1000 }, floor: 8, median: 13, ceiling: 24, consistencyScore: 82, spikeScore: 68, availabilityScore: 100 },
      { season: 2024, gamesPlayed: 16, totalFantasyPoints: 180, pointsPerGame: 11.3, positionRank: 22, keyStatTotals: { rec: 62, rec_yd: 780 }, floor: 6, median: 10, ceiling: 20, consistencyScore: 74, spikeScore: 58, availabilityScore: 94.1 },
    ],
    careerMetadata: {
      rookieSeason: 2022,
      firstStatSeason: 2024,
      latestStatSeason: 2025,
      seasonsWithStats: [2024, 2025],
      seasonsOnRoster: [2024, 2025],
      careerGamesWithStatRows: 33,
      activeSeasonsCount: 2,
      coverageLabel: "partial_career",
      coverageNote: "Profile coverage begins in 2024 based on available local nflverse export.",
    },
    careerSummary: {
      careerGames: 33,
      careerTotalPoints: 420,
      careerPointsPerGame: 12.7,
      careerFloor: 7,
      careerMedian: 12,
      careerCeiling: 23,
      careerConsistencyScore: 79,
      careerSpikeScore: 64,
      careerAvailabilityScore: 97.1,
      bestSeasonByTotalPoints: { season: 2025, gamesPlayed: 17, totalFantasyPoints: 240, pointsPerGame: 14.1, positionRank: 12, keyStatTotals: { rec: 80, rec_yd: 1000 }, floor: 8, median: 13, ceiling: 24, consistencyScore: 82, spikeScore: 68, availabilityScore: 100 },
      bestSeasonByPpg: { season: 2025, gamesPlayed: 17, totalFantasyPoints: 240, pointsPerGame: 14.1, positionRank: 12, keyStatTotals: { rec: 80, rec_yd: 1000 }, floor: 8, median: 13, ceiling: 24, consistencyScore: 82, spikeScore: 68, availabilityScore: 100 },
      mostRecentSeason: { season: 2025, gamesPlayed: 17, totalFantasyPoints: 240, pointsPerGame: 14.1, positionRank: 12, keyStatTotals: { rec: 80, rec_yd: 1000 }, floor: 8, median: 13, ceiling: 24, consistencyScore: 82, spikeScore: 68, availabilityScore: 100 },
      last2Seasons: { season: 2025, gamesPlayed: 33, totalFantasyPoints: 420, pointsPerGame: 12.7, positionRank: null, keyStatTotals: { rec: 142, rec_yd: 1780 }, floor: 7, median: 12, ceiling: 23, consistencyScore: 79, spikeScore: 64, availabilityScore: 97.1 },
      last3Seasons: { season: 2025, gamesPlayed: 33, totalFantasyPoints: 420, pointsPerGame: 12.7, positionRank: null, keyStatTotals: { rec: 142, rec_yd: 1780 }, floor: 7, median: 12, ceiling: 23, consistencyScore: 79, spikeScore: 64, availabilityScore: 97.1 },
    },
    trendMetrics: {
      ppgTrend: 2.8,
      availabilityTrend: 5.9,
      consistencyTrend: 8,
      spikeTrend: 10,
      roleVolumeTrend: 238,
      trendLabel: "rising",
    },
    usageSummary: {
      sourceBasis: "weekly_stats",
      gamesWithUsage: 33,
      opportunitiesPerGame: 8,
      touchesPerGame: 5,
      carriesPerGame: 0,
      targetsPerGame: 8,
      receptionsPerGame: 5,
      passAttemptsPerGame: 0,
      yardsPerTouch: 13,
      touchdownDependency: 4,
      receivingUsageShare: 100,
      rushingUsageShare: 0,
      targetVolumePerGame: 8,
      tackleFloorScore: null,
      bigPlayDependencyScore: null,
      sackDependencyScore: null,
      gamesWithSnapData: 17,
      gamesWithParticipationData: 17,
      weeklyUsageConsistency: 82,
      offensiveSnapShare: 0.82,
      defensiveSnapShare: null,
      specialTeamsSnapShare: null,
      gamesOver70PercentSnaps: 14,
      gamesUnder40PercentSnaps: 1,
      trendLabel: "stable",
    },
    seasonUsageSummaries: [],
    weeklyUsage: [],
    highValueUsageSummary: input.highValueUsage
      ? {
          sourceStatus: "available",
          gamesWithHighValueUsage: 12,
          highValueTouchesPerGame: 1.5,
          highValueTargetsPerGame: 2.1,
          redZoneCarriesPerGame: 0.8,
          inside10CarriesPerGame: 0.6,
          inside5CarriesPerGame: 0.5,
          goalLineCarriesPerGame: 0.5,
          redZoneTargetsPerGame: 0.9,
          inside10TargetsPerGame: 0.4,
          endZoneTargetsPerGame: 0.3,
          deepTargetsPerGame: 1.8,
          thirdDownTargetsPerGame: 1.2,
          twoMinuteTargetsPerGame: 0.6,
          airYardsPerTarget: 12.4,
          redZonePassAttemptsPerGame: null,
          designedQbRushesPerGame: null,
          scramblesPerGame: null,
          highValueUsageShare: 24,
          targetHighValueShare: 42,
          touchdownDependency: 8,
          trendLabel: "stable",
          modifiers: ["red_zone_role", "end_zone_target_role", "deep_threat"],
        }
      : undefined,
    seasonHighValueUsageSummaries: input.highValueUsage
      ? [
          {
            sourceStatus: "available",
            season: 2025,
            games: 12,
            gamesWithHighValueUsage: 12,
            highValueTouchesPerGame: 1.5,
            highValueTargetsPerGame: 2.1,
            redZoneCarriesPerGame: 0.8,
            inside10CarriesPerGame: 0.6,
            inside5CarriesPerGame: 0.5,
            goalLineCarriesPerGame: 0.5,
            redZoneTargetsPerGame: 0.9,
            inside10TargetsPerGame: 0.4,
            endZoneTargetsPerGame: 0.3,
            deepTargetsPerGame: 1.8,
            thirdDownTargetsPerGame: 1.2,
            twoMinuteTargetsPerGame: 0.6,
            airYardsPerTarget: 12.4,
            redZonePassAttemptsPerGame: null,
            designedQbRushesPerGame: null,
            scramblesPerGame: null,
            highValueUsageShare: 24,
            targetHighValueShare: 42,
            touchdownDependency: 8,
            trendLabel: "stable",
            modifiers: ["red_zone_role", "end_zone_target_role", "deep_threat"],
          },
        ]
      : undefined,
    weeklyHighValueUsage: input.highValueUsage
      ? [
          {
            season: 2025,
            week: 1,
            carries: 0,
            targets: 8,
            receptions: 5,
            rushTouchdowns: 0,
            receivingTouchdowns: 1,
            passingAttempts: 0,
            redZoneCarries: 0,
            inside10Carries: 0,
            inside5Carries: 0,
            goalLineCarries: 0,
            redZoneTargets: 2,
            inside10Targets: 1,
            endZoneTargets: 1,
            deepTargets: 2,
            thirdDownTargets: 2,
            twoMinuteTargets: 1,
            highValueTouches: 0,
            highValueTargets: 4,
            airYards: 96,
            redZonePassAttempts: 0,
            designedQbRushes: 0,
            scrambles: 0,
          },
        ]
      : undefined,
    highValueRoleWarnings: input.highValueUsage ? [] : undefined,
    roleMetrics: {
      roleLabel: "volume_receiver",
      roleConfidence: "medium",
      roleStabilityLabel: "high",
      idpArchetype: null,
      roleModifiers: ["full_time_role"],
      roleTrend: "stable",
      keySignals: ["8 opportunities/g", "82/100 weekly usage consistency"],
      dataGaps: ["snap counts"],
    },
    roleWarnings: ["weekly_stat_usage_only", "snap_data_unavailable"],
    consistencyMetrics: {
      mean: 14,
      median: 13,
      standardDeviation: 5,
      floorPercentile20: 8,
      ceilingPercentile80: 19,
      ceilingPercentile90: 24,
      boomWeeks: 4,
      bustWeeks: 2,
      startableWeeks: 10,
      consistencyScore: 82,
      spikeWeekScore: 68,
    },
    availabilityMetrics: { weeksWithStatRows: 17, missedWeekEstimate: 0, gamesPlayed: 17, availabilityScore: 100 },
    recommendationSignals: {
      floorScore: 55,
      ceilingScore: 70,
      consistencyScore: 82,
      spikeScore: 68,
      availabilityScore: 100,
      volatilityLabel: "medium",
      formatFitHints: { redraft: "usable", dynasty: "age preserved", bestBall: "spike", idp: null },
    },
    profileWarnings: input.warnings ?? [],
  };
}

function weekly(week: number): HistoricalPlayerProfileSnapshot["weeklyStats"][number] {
  return {
    season: 2025,
    week,
    team: "DET",
    opponent: "GB",
    passing: {},
    rushing: {},
    receiving: { rec: 5, rec_yd: 70, rec_td: 0 },
    kicking: {},
    defensive: {},
    calculatedFantasyPoints: 12,
    scoringWarnings: [],
  };
}
