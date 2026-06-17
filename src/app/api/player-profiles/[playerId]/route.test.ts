import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

const mocks = vi.hoisted(() => ({
  createPlayerProfileRepository: vi.fn(),
  resolvePlayerProfileScoringContext: vi.fn(),
}));

vi.mock("@/lib/player-profiles/player-profile-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/player-profiles/player-profile-repository")>();
  return {
    ...actual,
    createPlayerProfileRepository: mocks.createPlayerProfileRepository,
  };
});

vi.mock("@/lib/player-profiles/server/player-profile-scoring-context", () => ({
  resolvePlayerProfileScoringContext: mocks.resolvePlayerProfileScoringContext,
}));

describe("GET /api/player-profiles/[playerId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.resolvePlayerProfileScoringContext.mockResolvedValue(scoringContext());
  });

  it("returns a compact read-only profile payload", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue(repoMock({
      lookupProfile: vi.fn().mockReturnValue({ profile: profile(), matchedBy: "sleeper_id", duplicateKey: null }),
    }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/s1?weeklyLimit=1"), { params: Promise.resolve({ playerId: "s1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile.header.name).toBe("Test Player");
    expect(payload.profile.identity.sleeper_id).toBe("s1");
    expect(payload.profile.warnings).toContain("weak_identity_match");
    expect(payload.profile.weeklyGameLog).toHaveLength(1);
    expect(payload.profile.highValueUsageSummary.goalLineCarriesPerGame).toBe(0.2);
    expect(payload.profile.seasonHighValueUsageSummaries).toHaveLength(1);
    expect(JSON.stringify(payload.profile)).not.toContain("play_id");
    expect(payload.profile.summaryMetrics.total_points).toBe(11);
    expect(payload.scoring.scoringSource).toBe("default");
    expect(payload.status).toBe("profile_found");
    expect(payload.lookup).toEqual({ matchedBy: "sleeper_id", artifactBacked: true, readOnly: true });
  });

  it("passes draft room scoring context through and returns recalculated profile points", async () => {
    mocks.resolvePlayerProfileScoringContext.mockResolvedValue(scoringContext({
      scoringSource: "draft_room",
      scoringSettings: { rec: 2 },
      scoringProfileName: "League scoring",
    }));
    mocks.createPlayerProfileRepository.mockReturnValue(repoMock({
      lookupProfile: vi.fn().mockReturnValue({ profile: profile(), matchedBy: "sleeper_id", duplicateKey: null }),
    }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/s1?draftRoomId=room-1&weeklyLimit=2"), {
      params: Promise.resolve({ playerId: "s1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.resolvePlayerProfileScoringContext).toHaveBeenCalledWith({ draftRoomId: "room-1", leagueId: null });
    expect(payload.scoring.scoringSource).toBe("draft_room");
    expect(payload.profile.weeklyGameLog.map((row: { calculatedFantasyPoints: number }) => row.calculatedFantasyPoints)).toEqual([10, 12]);
    expect(payload.profile.summaryMetrics.total_points).toBe(22);
  });

  it("returns 404 when no profile exists", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue(repoMock({
      lookupProfile: vi.fn().mockReturnValue({ profile: null, matchedBy: null, duplicateKey: null }),
    }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/missing"), { params: Promise.resolve({ playerId: "missing" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.status).toBe("profile_not_found");
    expect(payload.error).toBe("Player profile not found.");
  });

  it("returns 404 for ambiguous duplicate profile IDs", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue(repoMock({
      lookupProfile: vi.fn().mockReturnValue({ profile: null, matchedBy: "sleeper_id", duplicateKey: "dup" }),
    }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/dup"), { params: Promise.resolve({ playerId: "dup" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.status).toBe("ambiguous_duplicate_lookup");
    expect(payload.error).toBe("Player profile lookup is ambiguous.");
    expect(payload.duplicateKey).toBe("dup");
  });

  it("returns artifact-unavailable response when the artifact is missing", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue(repoMock({
      status: "artifact_missing",
      exists: false,
      artifactSizeBytes: null,
      profiles: [],
      lookupProfile: vi.fn(),
    }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/4034"), { params: Promise.resolve({ playerId: "4034" }) });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("artifact_missing");
    expect(payload.error).toBe("Player profile artifact is missing from this deployment.");
    expect(payload.diagnostics.artifactExists).toBe(false);
  });

  it("returns runtime diagnostics safely", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue(repoMock({
      lookupProfile: vi.fn().mockReturnValue({ profile: profile(), matchedBy: "sleeper_id", duplicateKey: null }),
    }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/4034?diagnostics=1"), { params: Promise.resolve({ playerId: "4034" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ready");
    expect(payload.diagnostics).toMatchObject({
      artifactExists: true,
      profilesLoadedCount: 1,
      storageMode: "local",
      storageProvider: "local",
      source: "local_artifacts",
    });
  });
});

function repoMock(overrides: Record<string, unknown> = {}) {
  const base = {
    artifactPath: "artifacts/projections/player-profiles.json",
    exists: true,
    artifactSizeBytes: 1000,
    status: "ready",
    loadError: null,
    profiles: [profile()],
    indexStats: {
      totalProfiles: 1,
      bySleeperId: 1,
      byGsisId: 1,
      byBlackbirdPlayerId: 0,
      byNflId: 0,
      byEspnId: 0,
      byPfrId: 0,
      byNamePosition: 1,
      duplicateIds: [],
    },
    lookupProfile: vi.fn(),
    runtimeDiagnostics: vi.fn(() => ({
      artifactPath: "artifacts/projections/player-profiles.json",
      cwd: "/repo",
      artifactExists: Boolean((overrides.exists as boolean | undefined) ?? true),
      artifactSizeBytes: (overrides.artifactSizeBytes as number | null | undefined) ?? 1000,
      artifactStatus: (overrides.status as string | undefined) ?? "ready",
      loadError: null,
      profilesLoadedCount: (overrides.profiles as unknown[] | undefined)?.length ?? 1,
      storageMode: "local",
      storageProvider: "local",
      bucket: null,
      prefix: null,
      source: "local_artifacts",
      manifestLoaded: false,
      manifestProfileCount: null,
      shardLoaded: false,
      storage: {
        storageMode: "local",
        storageProvider: "local",
        bucket: null,
        prefix: null,
        source: "local_artifacts",
        manifestLoaded: false,
        manifestProfileCount: null,
        shardLoaded: false,
        selectedShard: null,
        configErrors: [],
        configWarnings: [],
        supabaseUrlDefined: false,
        supabaseServiceRoleDefined: false,
      },
      knownLookups: {
        christianMcCaffreyBySleeperId4034: { found: true, matchedBy: "sleeper_id", duplicateKey: null, playerName: "Christian McCaffrey", position: "RB" },
        christianMcCaffreyByGsisId000033280: { found: true, matchedBy: "gsis_id", duplicateKey: null, playerName: "Christian McCaffrey", position: "RB" },
        calebWilliamsByNamePosition: { found: true, matchedBy: "name_position", duplicateKey: null, playerName: "Caleb Williams", position: "QB" },
      },
    })),
  };
  return { ...base, ...overrides };
}

function scoringContext(input: Partial<{
  scoringSource: "draft_room" | "league" | "default" | "fallback";
  scoringSettings: Record<string, number>;
  scoringProfileName: string;
}> = {}) {
  const scoringSettings = input.scoringSettings ?? { rec: 1, solo_tkl: 2, sack: 6 };
  return {
    scoringProfile: {
      id: "test-scoring",
      label: input.scoringProfileName ?? "Default scoring",
      version: "test",
      scoringSettings,
      notes: [],
    },
    metadata: {
      scoringSource: input.scoringSource ?? "default",
      scoringProfileName: input.scoringProfileName ?? "Default scoring",
      scoringSettingsSummary: {
        reception: scoringSettings.rec ?? null,
        passingYard: scoringSettings.pass_yd ?? null,
        passingTd: scoringSettings.pass_td ?? null,
        interception: scoringSettings.pass_int ?? null,
        rushingYard: scoringSettings.rush_yd ?? null,
        rushingTd: scoringSettings.rush_td ?? null,
        receivingYard: scoringSettings.rec_yd ?? null,
        receivingTd: scoringSettings.rec_td ?? null,
        fumbleLost: scoringSettings.fum_lost ?? null,
        soloTackle: scoringSettings.solo_tkl ?? null,
        assistedTackle: scoringSettings.ast_tkl ?? null,
        sack: scoringSettings.sack ?? null,
        interceptionDefense: scoringSettings.int ?? null,
        forcedFumble: scoringSettings.ff ?? null,
        fumbleRecovery: scoringSettings.fr ?? null,
        passDefended: scoringSettings.pd ?? null,
        defensiveTd: scoringSettings.def_td ?? null,
        tightEndReceptionBonus: scoringSettings.rec_te_bonus ?? null,
      },
      warnings: [],
    },
  };
}

function profile(): HistoricalPlayerProfileSnapshot {
  return {
    identity: {
      blackbirdPlayerId: null,
      sleeperId: "s1",
      gsisId: "00-1",
      espnId: null,
      pfrId: null,
      nflId: null,
      smartId: null,
      matchConfidence: "weak",
      matchReasons: ["normalized full name match"],
      preservedIds: { blackbirdPlayerId: null, sleeperId: "s1", gsisId: "00-1", espnId: null, pfrId: null, nflId: null, smartId: null },
    },
    bio: {
      name: "Test Player",
      position: "WR",
      normalizedPosition: "WR",
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
    weeklyStats: [
      { season: 2025, week: 1, team: "DET", opponent: "GB", passing: {}, rushing: {}, receiving: { rec: 5 }, kicking: {}, defensive: {}, calculatedFantasyPoints: 10, scoringWarnings: [] },
      { season: 2025, week: 2, team: "DET", opponent: "CHI", passing: {}, rushing: {}, receiving: { rec: 6 }, kicking: {}, defensive: {}, calculatedFantasyPoints: 12, scoringWarnings: [] },
    ],
    seasonSummaries: [{ season: 2025, gamesPlayed: 2, totalFantasyPoints: 22, pointsPerGame: 11, positionRank: 10, keyStatTotals: { rec: 11 } }],
    usageSummary: {
      sourceBasis: "weekly_stats",
      gamesWithUsage: 2,
      opportunitiesPerGame: 5.5,
      touchesPerGame: 5.5,
      carriesPerGame: 0,
      targetsPerGame: 5.5,
      receptionsPerGame: 5.5,
      passAttemptsPerGame: 0,
      yardsPerTouch: 0,
      touchdownDependency: 0,
      receivingUsageShare: 100,
      rushingUsageShare: 0,
      targetVolumePerGame: 5.5,
      tackleFloorScore: null,
      bigPlayDependencyScore: null,
      sackDependencyScore: null,
      gamesWithSnapData: 2,
      gamesWithParticipationData: 2,
      weeklyUsageConsistency: 90,
      offensiveSnapShare: 0.78,
      defensiveSnapShare: null,
      specialTeamsSnapShare: null,
      gamesOver70PercentSnaps: 2,
      gamesUnder40PercentSnaps: 0,
      trendLabel: "insufficient_data",
    },
    seasonUsageSummaries: [],
    weeklyUsage: [],
    highValueUsageSummary: {
      sourceStatus: "available",
      gamesWithHighValueUsage: 2,
      highValueTouchesPerGame: 0,
      highValueTargetsPerGame: 2.5,
      redZoneCarriesPerGame: 0,
      inside10CarriesPerGame: 0,
      inside5CarriesPerGame: 0,
      goalLineCarriesPerGame: 0.2,
      redZoneTargetsPerGame: 1,
      inside10TargetsPerGame: 0.5,
      endZoneTargetsPerGame: 0.5,
      deepTargetsPerGame: 1.5,
      thirdDownTargetsPerGame: 1,
      twoMinuteTargetsPerGame: 0.5,
      airYardsPerTarget: 14,
      redZonePassAttemptsPerGame: null,
      designedQbRushesPerGame: null,
      scramblesPerGame: null,
      highValueUsageShare: null,
      targetHighValueShare: 45,
      touchdownDependency: 10,
      trendLabel: "stable",
      modifiers: ["red_zone_role", "deep_threat"],
    },
    seasonHighValueUsageSummaries: [
      {
        sourceStatus: "available",
        season: 2025,
        games: 2,
        gamesWithHighValueUsage: 2,
        highValueTouchesPerGame: 0,
        highValueTargetsPerGame: 2.5,
        redZoneCarriesPerGame: 0,
        inside10CarriesPerGame: 0,
        inside5CarriesPerGame: 0,
        goalLineCarriesPerGame: 0.2,
        redZoneTargetsPerGame: 1,
        inside10TargetsPerGame: 0.5,
        endZoneTargetsPerGame: 0.5,
        deepTargetsPerGame: 1.5,
        thirdDownTargetsPerGame: 1,
        twoMinuteTargetsPerGame: 0.5,
        airYardsPerTarget: 14,
        redZonePassAttemptsPerGame: null,
        designedQbRushesPerGame: null,
        scramblesPerGame: null,
        highValueUsageShare: null,
        targetHighValueShare: 45,
        touchdownDependency: 10,
        trendLabel: "stable",
        modifiers: ["red_zone_role", "deep_threat"],
      },
    ],
    weeklyHighValueUsage: [],
    highValueRoleWarnings: [],
    roleMetrics: {
      roleLabel: "volume_receiver",
      roleConfidence: "low",
      roleStabilityLabel: "low",
      idpArchetype: null,
      roleModifiers: ["full_time_role"],
      roleTrend: "insufficient_data",
      keySignals: ["Role label: volume receiver"],
      dataGaps: ["snap counts"],
    },
    roleWarnings: ["weekly_stat_usage_only", "snap_data_unavailable"],
    consistencyMetrics: { mean: 11, median: 11, standardDeviation: 1, floorPercentile20: 10.4, ceilingPercentile80: 11.6, ceilingPercentile90: 11.8, boomWeeks: 0, bustWeeks: 0, startableWeeks: 1, consistencyScore: 90, spikeWeekScore: 50 },
    availabilityMetrics: { weeksWithStatRows: 2, missedWeekEstimate: 15, gamesPlayed: 2, availabilityScore: 11.8 },
    recommendationSignals: { floorScore: 50, ceilingScore: 60, consistencyScore: 90, spikeScore: 50, availabilityScore: 11.8, volatilityLabel: "low", formatFitHints: { redraft: "small sample", dynasty: "age", bestBall: "limited", idp: null } },
    profileWarnings: ["weak_identity_match"],
  };
}
