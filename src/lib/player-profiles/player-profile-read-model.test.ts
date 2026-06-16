import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createPlayerProfileRepository } from "./player-profile-repository";
import { toPlayerProfileReadModel } from "./player-profile-read-model";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

describe("player profile read model repository", () => {
  it("looks up a profile by sleeper_id", async () => {
    const artifactPath = await writeProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = createPlayerProfileRepository({ artifactPath });

    const result = repo.lookupProfile({ playerId: "sleeper-1" });

    expect(result.profile?.identity.gsisId).toBe("00-1");
    expect(result.matchedBy).toBe("sleeper_id");
  });

  it("looks up a profile by gsis_id", async () => {
    const artifactPath = await writeProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = createPlayerProfileRepository({ artifactPath });

    const result = repo.lookupProfile({ playerId: "00-1" });

    expect(result.profile?.identity.sleeperId).toBe("sleeper-1");
    expect(result.matchedBy).toBe("gsis_id");
  });

  it("looks up a profile by normalized name and position fallback", async () => {
    const artifactPath = await writeProfiles([profile({ name: "Amon-Ra St. Brown", position: "WR", sleeperId: null, gsisId: "00-1" })]);
    const repo = createPlayerProfileRepository({ artifactPath });

    const result = repo.lookupProfile({ playerId: "Amon Ra St Brown", position: "WR" });

    expect(result.profile?.bio.name).toBe("Amon-Ra St. Brown");
    expect(result.matchedBy).toBe("name_position");
  });

  it("handles duplicate IDs conservatively", async () => {
    const artifactPath = await writeProfiles([
      profile({ name: "First", sleeperId: "dup", gsisId: "00-1" }),
      profile({ name: "Second", sleeperId: "dup", gsisId: "00-2" }),
    ]);
    const repo = createPlayerProfileRepository({ artifactPath });

    const result = repo.lookupProfile({ playerId: "dup" });

    expect(result.profile).toBeNull();
    expect(result.duplicateKey).toBe("dup");
    expect(repo.indexStats.duplicateIds).toContainEqual({ index: "sleeper_id", key: "dup", count: 2 });
  });

  it("returns null for missing profiles", async () => {
    const artifactPath = await writeProfiles([profile({ sleeperId: "sleeper-1", gsisId: "00-1" })]);
    const repo = createPlayerProfileRepository({ artifactPath });

    expect(repo.lookupProfile({ playerId: "missing" }).profile).toBeNull();
  });

  it("reports a missing artifact explicitly", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-missing-"));
    const repo = createPlayerProfileRepository({ artifactPath: path.join(root, "missing-player-profiles.json") });

    expect(repo.exists).toBe(false);
    expect(repo.status).toBe("artifact_missing");
    expect(repo.artifactSizeBytes).toBeNull();
    expect(repo.indexStats.totalProfiles).toBe(0);
    expect(repo.runtimeDiagnostics()).toMatchObject({
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

    const repo = createPlayerProfileRepository({ artifactPath });

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
    expect(readModel.summaryMetrics.games).toBe(17);
  });
});

async function writeProfiles(profiles: HistoricalPlayerProfileSnapshot[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-read-model-"));
  const artifactPath = path.join(root, "player-profiles.json");
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
  return artifactPath;
}

function profile(input: Partial<{
  name: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  sleeperId: string | null;
  gsisId: string;
  warnings: HistoricalPlayerProfileSnapshot["profileWarnings"];
  weeklyStats: HistoricalPlayerProfileSnapshot["weeklyStats"];
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
    seasonSummaries: [{ season: 2025, gamesPlayed: 17, totalFantasyPoints: 240, pointsPerGame: 14.1, positionRank: 12, keyStatTotals: { rec: 80, rec_yd: 1000 } }],
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
