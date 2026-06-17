import { describe, expect, it } from "vitest";

import {
  buildPlayerProfileScoringMetadata,
  rescoreHistoricalPlayerProfile,
  scoringProfileFromNormalizedSettings,
} from "./player-profile-rescoring";
import type { HistoricalPlayerProfileSnapshot, PlayerProfileScoringProfile } from "./player-profile-types";

describe("player profile rescoring", () => {
  it("recalculates offensive weekly points and derived metrics from custom scoring", () => {
    const scoringProfile: PlayerProfileScoringProfile = {
      id: "test-ppr",
      label: "Test PPR",
      version: "test",
      scoringSettings: {
        rec: 2,
        rec_yd: 0.1,
        rec_td: 6,
        rush_yd: 0.1,
        rush_td: 6,
        fum_lost: -2,
      },
      notes: [],
    };

    const rescored = rescoreHistoricalPlayerProfile(profile({
      weeklyStats: [
        weekly({ receiving: { rec: 5, rec_yd: 70, rec_td: 1 }, rushing: { rush_yd: 20 }, calculatedFantasyPoints: 1 }),
        weekly({ week: 2, receiving: { rec: 3, rec_yd: 40, rec_td: 0 }, rushing: { rush_yd: 10 }, calculatedFantasyPoints: 1 }),
      ],
    }), scoringProfile);

    expect(rescored.weeklyStats.map((row) => row.calculatedFantasyPoints)).toEqual([25, 11]);
    expect(rescored.seasonSummaries[0].totalFantasyPoints).toBe(36);
    expect(rescored.seasonSummaries[0].pointsPerGame).toBe(18);
    expect(rescored.careerSummary?.careerTotalPoints).toBe(36);
    expect(rescored.careerSummary?.careerPointsPerGame).toBe(18);
    expect(rescored.trendMetrics?.trendLabel).toBe("insufficient_data");
    expect(rescored.consistencyMetrics.median).toBe(18);
    expect(rescored.recommendationSignals.consistencyScore).toBe(rescored.consistencyMetrics.consistencyScore);
  });

  it("supports league-specific IDP scoring for tackles, sacks, turnovers, passes defended, and touchdowns", () => {
    const scoringProfile: PlayerProfileScoringProfile = {
      id: "idp",
      label: "IDP scoring",
      version: "test",
      scoringSettings: {
        solo_tkl: 2,
        ast_tkl: 1,
        sack: 6,
        int: 4,
        ff: 2,
        fr: 2,
        pd: 1,
        def_td: 6,
      },
      notes: [],
    };

    const rescored = rescoreHistoricalPlayerProfile(profile({
      position: "LB",
      weeklyStats: [
        weekly({
          defensive: {
            solo_tkl: 3,
            ast_tkl: 2,
            sack: 1,
            int: 1,
            ff: 1,
            fr: 1,
            pd: 2,
            def_td: 1,
          },
          calculatedFantasyPoints: 0,
        }),
      ],
    }), scoringProfile);

    expect(rescored.weeklyStats[0].calculatedFantasyPoints).toBe(30);
    expect(rescored.seasonSummaries[0].keyStatTotals).toMatchObject({
      solo_tkl: 3,
      ast_tkl: 2,
      sack: 1,
      int: 1,
      ff: 1,
      fr: 1,
      pd: 2,
      def_td: 1,
    });
  });

  it("builds explicit scoring metadata without exposing full settings", () => {
    const scoringProfile = scoringProfileFromNormalizedSettings({
      id: "league:1",
      label: "League scoring",
      version: "test",
      scoringSettings: { rec: 1, pass_td: 4, pass_int: -2, solo_tkl: 2, sack: 6 },
      notes: ["read-time scoring"],
    });

    const metadata = buildPlayerProfileScoringMetadata({
      scoringSource: "league",
      scoringProfile,
      warnings: ["one warning"],
    });

    expect(metadata.scoringSource).toBe("league");
    expect(metadata.scoringSettingsSummary).toMatchObject({
      reception: 1,
      passingTd: 4,
      interception: -2,
      soloTackle: 2,
      sack: 6,
    });
    expect(metadata.warnings).toEqual(["one warning", "read-time scoring"]);
  });
});

function profile(input: Partial<{
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DL" | "LB" | "DB";
  weeklyStats: HistoricalPlayerProfileSnapshot["weeklyStats"];
}> = {}): HistoricalPlayerProfileSnapshot {
  const position = input.position ?? "WR";
  return {
    identity: {
      blackbirdPlayerId: null,
      sleeperId: "s1",
      gsisId: "00-1",
      espnId: null,
      pfrId: null,
      nflId: null,
      smartId: null,
      matchConfidence: "exact_id",
      matchReasons: ["exact"],
      preservedIds: { blackbirdPlayerId: null, sleeperId: "s1", gsisId: "00-1", espnId: null, pfrId: null, nflId: null, smartId: null },
    },
    bio: {
      name: "Test Player",
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
    weeklyStats: input.weeklyStats ?? [weekly()],
    seasonSummaries: [{ season: 2025, gamesPlayed: 1, totalFantasyPoints: 0, pointsPerGame: 0, positionRank: null, keyStatTotals: {} }],
    consistencyMetrics: {
      mean: 0,
      median: 0,
      standardDeviation: 0,
      floorPercentile20: 0,
      ceilingPercentile80: 0,
      ceilingPercentile90: 0,
      boomWeeks: 0,
      bustWeeks: 1,
      startableWeeks: 0,
      consistencyScore: 0,
      spikeWeekScore: 0,
    },
    availabilityMetrics: { weeksWithStatRows: 1, missedWeekEstimate: 16, gamesPlayed: 1, availabilityScore: 5.9 },
    recommendationSignals: {
      floorScore: 0,
      ceilingScore: 0,
      consistencyScore: 0,
      spikeScore: 0,
      availabilityScore: 5.9,
      volatilityLabel: "low",
      formatFitHints: { redraft: "sample", dynasty: "bio", bestBall: "sample", idp: null },
    },
    profileWarnings: [],
  };
}

function weekly(input: Partial<HistoricalPlayerProfileSnapshot["weeklyStats"][number]> = {}) {
  return {
    season: 2025,
    week: 1,
    team: "DET",
    opponent: "GB",
    passing: {},
    rushing: {},
    receiving: {},
    kicking: {},
    defensive: {},
    calculatedFantasyPoints: 0,
    scoringWarnings: [],
    ...input,
  };
}
