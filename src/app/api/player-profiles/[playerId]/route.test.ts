import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

const mocks = vi.hoisted(() => ({
  createPlayerProfileRepository: vi.fn(),
}));

vi.mock("@/lib/player-profiles/player-profile-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/player-profiles/player-profile-repository")>();
  return {
    ...actual,
    createPlayerProfileRepository: mocks.createPlayerProfileRepository,
  };
});

describe("GET /api/player-profiles/[playerId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a compact read-only profile payload", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue({
      lookupProfile: vi.fn().mockReturnValue({ profile: profile(), matchedBy: "sleeper_id", duplicateKey: null }),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/s1?weeklyLimit=1"), { params: Promise.resolve({ playerId: "s1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile.header.name).toBe("Test Player");
    expect(payload.profile.identity.sleeper_id).toBe("s1");
    expect(payload.profile.warnings).toContain("weak_identity_match");
    expect(payload.profile.weeklyGameLog).toHaveLength(1);
    expect(payload.lookup).toEqual({ matchedBy: "sleeper_id", artifactBacked: true, readOnly: true });
  });

  it("returns 404 when no profile exists", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue({
      lookupProfile: vi.fn().mockReturnValue({ profile: null, matchedBy: null, duplicateKey: null }),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/missing"), { params: Promise.resolve({ playerId: "missing" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Player profile not found.");
  });

  it("returns 404 for ambiguous duplicate profile IDs", async () => {
    mocks.createPlayerProfileRepository.mockReturnValue({
      lookupProfile: vi.fn().mockReturnValue({ profile: null, matchedBy: "sleeper_id", duplicateKey: "dup" }),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/player-profiles/dup"), { params: Promise.resolve({ playerId: "dup" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Player profile lookup is ambiguous.");
    expect(payload.duplicateKey).toBe("dup");
  });
});

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
    consistencyMetrics: { mean: 11, median: 11, standardDeviation: 1, floorPercentile20: 10.4, ceilingPercentile80: 11.6, ceilingPercentile90: 11.8, boomWeeks: 0, bustWeeks: 0, startableWeeks: 1, consistencyScore: 90, spikeWeekScore: 50 },
    availabilityMetrics: { weeksWithStatRows: 2, missedWeekEstimate: 15, gamesPlayed: 2, availabilityScore: 11.8 },
    recommendationSignals: { floorScore: 50, ceilingScore: 60, consistencyScore: 90, spikeScore: 50, availabilityScore: 11.8, volatilityLabel: "low", formatFitHints: { redraft: "small sample", dynasty: "age", bestBall: "limited", idp: null } },
    profileWarnings: ["weak_identity_match"],
  };
}
