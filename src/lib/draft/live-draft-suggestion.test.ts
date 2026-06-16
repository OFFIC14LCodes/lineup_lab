import { describe, expect, it } from "vitest";

import { buildLiveDraftSuggestions, findBannedLiveDraftSuggestionLanguage } from "./live-draft-suggestion";
import type { BlackbirdLeagueRankRow } from "./blackbird-league-rank";

describe("H11.4.2 live draft suggestions", () => {
  it("includes only available players", () => {
    const result = buildLiveDraftSuggestions({
      leagueRankRows: [rank({ playerId: "taken", drafted: true }), rank({ playerId: "available", playerName: "Available", blackbirdRank: 2 })],
      draftedPlayerIds: ["taken"],
    });

    expect(result.rows.map((row) => row.playerId)).toEqual(["available"]);
    expect(result.diagnostics.draftedRowsExcluded).toBe(1);
  });

  it("can differ from static Blackbird Rank when roster need is active", () => {
    const result = buildLiveDraftSuggestions({
      leagueRankRows: [
        rank({ playerId: "rb", playerName: "RB", position: "RB", blackbirdRank: 1, leagueValueScore: 70 }),
        rank({ playerId: "qb", playerName: "QB", position: "QB", blackbirdRank: 2, leagueValueScore: 69 }),
      ],
      positionNeeds: [{ position: "QB", needLevel: "urgent", deficit: 1 }],
      currentPickNumber: 20,
    });

    expect(result.rows[0].playerName).toBe("QB");
    expect(result.rows[0].blackbirdRank).toBe(2);
    expect(result.diagnostics.rankChangedFromStatic).toBe(true);
  });

  it("does not mutate static rank rows", () => {
    const rows = [rank({ playerId: "a" }), rank({ playerId: "b", blackbirdRank: 2 })];
    const before = JSON.stringify(rows);
    buildLiveDraftSuggestions({ leagueRankRows: rows, positionNeeds: [{ position: "RB", needLevel: "high" }] });
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("does not emit banned language", () => {
    const result = buildLiveDraftSuggestions({ leagueRankRows: [rank()] });
    expect(result.diagnostics.bannedLanguageFound).toEqual([]);
    expect(findBannedLiveDraftSuggestionLanguage(JSON.stringify(result.rows))).toEqual([]);
  });
});

function rank(overrides: Partial<BlackbirdLeagueRankRow> = {}): BlackbirdLeagueRankRow {
  return {
    playerId: "p",
    playerName: "Player",
    position: "RB",
    team: "TST",
    drafted: false,
    blackbirdRank: 1,
    blackbirdTier: 1,
    leagueValueScore: 70,
    projectedFantasyPoints: {
      floor: 180,
      median: 220,
      ceiling: 260,
      unit: "season",
      source: "h10_league_projection",
      scoringAware: true,
    },
    pointsAboveReplacement: 30,
    valueComponents: {
      projectionValue: 60,
      floorCeilingShape: 60,
      positionScarcity: 50,
      rosterFormatFit: 50,
      leagueFormatFit: 50,
      ageCurve: 50,
      dynastyValue: 50,
      redraftValue: 50,
      bestBallFit: 50,
      superflexFit: 50,
      idpFormatFit: 50,
      situation: 50,
      coachingEnvironment: 50,
      depthChartRole: 50,
      projectedSnapShare: 50,
      confidence: 66,
      riskAdjustment: 1,
    },
    confidence: "medium",
    risk: "low",
    reasons: [],
    dataGaps: [],
    source: {
      adp: null,
      externalMarketRank: null,
      h10RecommendationRank: null,
      projectionRunId: null,
      projectionVersion: "test",
      fallbackProjection: false,
    },
    ...overrides,
  };
}
