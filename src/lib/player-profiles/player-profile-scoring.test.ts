import { describe, expect, it } from "vitest";

import type { NflverseWeeklyStatRecord } from "@/lib/data-acquisition/nflverse";
import { buildAvailabilityMetrics, buildConsistencyMetrics, buildRecommendationSignals } from "./player-profile-metrics";
import { scoreProfileWeeklyStat } from "./player-profile-scoring";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

describe("historical player profile scoring and metrics", () => {
  it("calculates fantasy scoring for offensive weekly stats", () => {
    const scored = scoreProfileWeeklyStat(weekly({
      position: "WR",
      offensiveStats: { receptions: 6, receiving_yards: 80, receiving_tds: 1 },
    }));

    expect(scored.result.totalPoints).toBe(20);
    expect(scored.stats).toMatchObject({ rec: 6, rec_yd: 80, rec_td: 1 });
  });

  it("calculates IDP scoring for solo tackles and sacks", () => {
    const scored = scoreProfileWeeklyStat(weekly({
      position: "LB",
      defensiveStats: { def_tackles_solo: 5, def_tackle_assists: 2, def_sacks: 1 },
    }));

    expect(scored.result.totalPoints).toBe(18);
    expect(scored.stats).toMatchObject({ solo_tkl: 5, ast_tkl: 2, sack: 1 });
  });

  it("calculates floor, median, ceiling, and consistency behavior", () => {
    const metrics = buildConsistencyMetrics([4, 8, 12, 20, 28], "WR");

    expect(metrics.floorPercentile20).toBe(7.2);
    expect(metrics.median).toBe(12);
    expect(metrics.ceilingPercentile80).toBe(21.6);
    expect(metrics.ceilingPercentile90).toBe(24.8);
    expect(metrics.consistencyScore).toBeGreaterThan(60);
  });

  it("classifies boom, bust, and startable weeks", () => {
    const metrics = buildConsistencyMetrics([4, 9, 13, 22, 30], "WR");

    expect(metrics.boomWeeks).toBe(2);
    expect(metrics.bustWeeks).toBe(1);
    expect(metrics.startableWeeks).toBe(3);
  });

  it("builds recommendation signals from consistency and availability", () => {
    const consistency = buildConsistencyMetrics([10, 11, 12, 22, 25], "DB");
    const availability = buildAvailabilityMetrics(14);
    const signals = buildRecommendationSignals({ position: "DB", consistency, availability });

    expect(signals.availabilityScore).toBe(82.4);
    expect(signals.formatFitHints.idp).toContain("tackle/sack");
    expect(signals.volatilityLabel).toMatch(/low|medium|high/);
  });

  it("supports an empty stats behavior without fabricated points", () => {
    const scored = scoreProfileWeeklyStat(weekly({ position: "RB" }));
    const metrics = buildConsistencyMetrics([], "RB");

    expect(scored.result.totalPoints).toBe(0);
    expect(metrics.mean).toBeNull();
    expect(metrics.consistencyScore).toBe(0);
  });

  it("preserves the profile snapshot shape used by artifacts", () => {
    const profile: HistoricalPlayerProfileSnapshot = {
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
        position: "LB",
        normalizedPosition: "LB",
        team: "DET",
        status: "Active",
        active: true,
        age: 24,
        birthDate: "2002-01-01",
        height: 72,
        weight: 230,
        college: "Example",
        rookieSeason: 2024,
        yearsExperience: 2,
      },
      weeklyStats: [],
      seasonSummaries: [{ season: 2025, gamesPlayed: 0, totalFantasyPoints: 0, pointsPerGame: null, positionRank: null, keyStatTotals: {} }],
      consistencyMetrics: buildConsistencyMetrics([], "LB"),
      availabilityMetrics: buildAvailabilityMetrics(0),
      recommendationSignals: buildRecommendationSignals({ position: "LB", consistency: buildConsistencyMetrics([], "LB"), availability: buildAvailabilityMetrics(0) }),
      profileWarnings: ["weak_identity_match", "no_weekly_stats", "low_sample_size"],
    };

    expect(profile.identity.matchConfidence).toBe("weak");
    expect(profile.profileWarnings).toContain("weak_identity_match");
    expect(profile.profileWarnings).toContain("no_weekly_stats");
  });
});

function weekly(overrides: Partial<NflverseWeeklyStatRecord> = {}): NflverseWeeklyStatRecord {
  const { offensiveStats, defensiveStats, kickingStats, ...rest } = overrides;
  const base: NflverseWeeklyStatRecord = {
    season: 2025,
    week: 1,
    playerId: "00-1",
    playerName: "Test Player",
    position: "WR",
    rawPosition: "WR",
    positionGroup: "WR",
    team: "DET",
    opponentTeam: "GB",
    offensiveStats: {},
    defensiveStats: {},
    kickingStats: {},
    fantasyPoints: null,
    fantasyPointsPpr: null,
  };
  return Object.assign(base, rest, {
    offensiveStats: { ...offensiveStats },
    defensiveStats: { ...defensiveStats },
    kickingStats: { ...kickingStats },
  });
}
