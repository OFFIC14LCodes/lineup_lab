import { describe, expect, it } from "vitest";

import { auditLeagueScoringSettings, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import { scoreStoredProjectionForLeague } from "@/lib/scoring/server/score-projections";
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

describe("scoreStoredProjectionForLeague", () => {
  it("scores weekly projections exactly", async () => {
    const league = makeLeagueContext({ rec: 0.5, rec_te_bonus: 0.5, rec_yd: 0.1 });

    const result = await scoreStoredProjectionForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        projectionRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadProjectionRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            week: 1,
            projection_type: "weekly",
            position_group: "TE",
            stats_json: {
              rec: 6,
              rec_yd: 72
            },
            provider_fantasy_points: 13.2,
            source_updated_at: null,
            ingested_at: "2026-08-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([
            [
              "player-1",
              {
                id: "player-1",
                full_name: "Tight End One",
                team: "CHI",
                position: "TE",
                raw_position: "TE",
                primary_position: "TE",
                position_group: "TE"
              }
            ]
          ]);
        }
      }
    );

    expect(result.blackbird.totalPoints).toBeCloseTo(13.2, 8);
    expect(result.aggregateCompatibility).toBeNull();
    expect(result.providerComparison?.comparisonStatus).toBe("match");
  });

  it("adds aggregate warnings for season and rest-of-season projections", async () => {
    const league = makeLeagueContext({ pass_yd: 0.04, bonus_pass_yd_300: 3 });

    const result = await scoreStoredProjectionForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        projectionRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadProjectionRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            week: null,
            projection_type: "rest_of_season",
            position_group: "QB",
            stats_json: {
              pass_yd: 3000
            },
            provider_fantasy_points: 120,
            source_updated_at: null,
            ingested_at: "2026-08-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([
            [
              "player-1",
              {
                id: "player-1",
                full_name: "Quarterback One",
                team: "CHI",
                position: "QB",
                raw_position: "QB",
                primary_position: "QB",
                position_group: "QB"
              }
            ]
          ]);
        }
      }
    );

    expect(result.aggregateCompatibility?.isExact).toBe(false);
    expect(result.contextWarnings.some((warning) => warning.code === "AGGREGATE_PROJECTION_LIMITATION")).toBe(true);
  });
});
