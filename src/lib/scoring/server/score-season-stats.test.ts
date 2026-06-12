import { describe, expect, it } from "vitest";

import { auditLeagueScoringSettings, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import { scoreStoredSeasonStatsForLeague } from "@/lib/scoring/server/score-season-stats";
import type { LeagueScoringContext } from "@/lib/scoring/server/types";

function makeLeagueContext(scoringSettings: Record<string, unknown>): LeagueScoringContext {
  const normalized = normalizeSleeperScoringSettings(scoringSettings);
  return {
    leagueId: "league-1",
    leagueName: "League One",
    season: 2026,
    scoringSettings: normalized,
    scoringAudit: auditLeagueScoringSettings(normalized),
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
  };
}

describe("scoreStoredSeasonStatsForLeague", () => {
  it("scores season aggregates and marks exact compatibility for linear scoring", async () => {
    const league = makeLeagueContext({ rec: 1, rec_yd: 0.1, rec_td: 6 });

    const result = await scoreStoredSeasonStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        seasonStatsRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadSeasonStatsRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            position_group: "WR",
            stats_json: {
              rec: 90,
              rec_yd: 1100,
              rec_td: 8
            },
            provider_fantasy_points: 248,
            source_updated_at: null,
            ingested_at: "2026-12-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([
            [
              "player-1",
              {
                id: "player-1",
                full_name: "Player One",
                team: "CHI",
                position: "WR",
                raw_position: "WR",
                primary_position: "WR",
                position_group: "WR"
              }
            ]
          ]);
        }
      }
    );

    expect(result.blackbird.totalPoints).toBe(248);
    expect(result.aggregateCompatibility?.isExact).toBe(true);
  });

  it("adds aggregate warnings for weekly bonus and defense tier settings", async () => {
    const league = makeLeagueContext({
      sack: 1,
      pts_allow_0: 10,
      bonus_rush_yd_100: 3
    });

    const result = await scoreStoredSeasonStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        seasonStatsRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadSeasonStatsRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            position_group: "DEF",
            stats_json: {
              sack: 40,
              pts_allow: 250
            },
            provider_fantasy_points: 55,
            source_updated_at: null,
            ingested_at: "2026-12-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([
            [
              "player-1",
              {
                id: "player-1",
                full_name: "Bears DST",
                team: "CHI",
                position: "DEF",
                raw_position: "DEF",
                primary_position: "DEF",
                position_group: "DEF"
              }
            ]
          ]);
        }
      }
    );

    expect(result.aggregateCompatibility?.isExact).toBe(false);
    expect(result.contextWarnings.some((warning) => warning.code === "AGGREGATE_SCORING_LIMITATION")).toBe(true);
    expect(result.providerComparison?.comparisonStatus).toBe("incomplete_blackbird_coverage");
  });
});
