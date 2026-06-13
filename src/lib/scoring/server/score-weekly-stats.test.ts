import { describe, expect, it } from "vitest";

import { auditLeagueScoringSettings, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import { scoreStoredWeeklyStatsForLeague, scoreWeeklyStatsRowsForLeague } from "@/lib/scoring/server/score-weekly-stats";
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

function makePlayer(overrides: Partial<{
  id: string;
  full_name: string | null;
  team: string | null;
  position: string | null;
  raw_position: string | null;
  primary_position: string | null;
  position_group: string | null;
}> = {}) {
  return {
    id: "player-1",
    full_name: "Player One",
    team: "CHI",
    position: "WR",
    raw_position: "WR",
    primary_position: "WR",
    position_group: "WR",
    ...overrides
  };
}

describe("scoreStoredWeeklyStatsForLeague", () => {
  it("scores offensive weekly stats and reports an exact provider match", async () => {
    const league = makeLeagueContext({ rec: 1, rec_yd: 0.1, rec_td: 6 });

    const result = await scoreStoredWeeklyStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        weeklyStatsRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadWeeklyStatsRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            week: 1,
            position_group: "WR",
            stats_json: {
              rec: 5,
              rec_yd: 70,
              rec_td: 1
            },
            provider_fantasy_points: 18,
            source_updated_at: "2026-09-10T12:00:00Z",
            ingested_at: "2026-09-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([["player-1", makePlayer()]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    expect(result.blackbird.totalPoints).toBeCloseTo(18, 8);
    expect(result.providerComparison?.comparisonStatus).toBe("match");
    expect(result.blackbird.formulaVersion).toBe(BLACKBIRD_SCORING_FORMULA_VERSION);
  });

  it("supports kicker and defense scoring through canonical positions", async () => {
    const kickerLeague = makeLeagueContext({ xpm: 1, fgm_40_49: 4 });
    const kicker = await scoreStoredWeeklyStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        weeklyStatsRowId: "row-k"
      },
      {
        async getLeagueScoringContext() {
          return kickerLeague;
        },
        async loadWeeklyStatsRow() {
          return {
            id: "row-k",
            player_id: "player-k",
            provider: "manual",
            provider_external_id: null,
            season: 2026,
            week: 1,
            position_group: null,
            stats_json: { xpm: 2, fgm_40_49: 1 },
            provider_fantasy_points: 6,
            source_updated_at: null,
            ingested_at: "2026-09-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([["player-k", makePlayer({ id: "player-k", full_name: "Kicker One", position: "K", raw_position: "K", primary_position: "K", position_group: "K" })]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    const defenseLeague = makeLeagueContext({ sack: 1, int: 2, pts_allow_0: 10 });
    const defense = await scoreStoredWeeklyStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        weeklyStatsRowId: "row-d"
      },
      {
        async getLeagueScoringContext() {
          return defenseLeague;
        },
        async loadWeeklyStatsRow() {
          return {
            id: "row-d",
            player_id: "player-d",
            provider: "manual",
            provider_external_id: null,
            season: 2026,
            week: 1,
            position_group: "DEF",
            stats_json: { sack: 3, int: 1, pts_allow: 0 },
            provider_fantasy_points: 15,
            source_updated_at: null,
            ingested_at: "2026-09-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([["player-d", makePlayer({ id: "player-d", full_name: "Bears DST", position: "DEF", raw_position: "DEF", primary_position: "DEF", position_group: "DEF" })]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    expect(kicker.blackbird.totalPoints).toBe(6);
    expect(defense.blackbird.totalPoints).toBe(15);
  });

  it("supports IDP rows and negative provider comparisons", async () => {
    const league = makeLeagueContext({ solo_tkl: 2, pass_int: -2 });

    const result = await scoreStoredWeeklyStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        weeklyStatsRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadWeeklyStatsRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            week: 1,
            position_group: "LB",
            stats_json: {
              solo_tkl: 4
            },
            provider_fantasy_points: -1,
            source_updated_at: null,
            ingested_at: "2026-09-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([["player-1", makePlayer({ position: "LB", raw_position: "LB", primary_position: "LB", position_group: "LB" })]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    expect(result.blackbird.totalPoints).toBe(8);
    expect(result.providerComparison?.difference).toBe(9);
    expect(result.providerComparison?.comparisonStatus).toBe("different");
  });

  it("marks provider comparison as incomplete when scoring coverage is incomplete", async () => {
    const league = makeLeagueContext({ pass_td: 4, mystery_bonus: 2 });

    const result = await scoreStoredWeeklyStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        weeklyStatsRowId: "row-1"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadWeeklyStatsRow() {
          return {
            id: "row-1",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            week: 1,
            position_group: "QB",
            stats_json: {
              pass_td: 1
            },
            provider_fantasy_points: 4,
            source_updated_at: null,
            ingested_at: "2026-09-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([["player-1", makePlayer({ position: "QB", raw_position: "QB", primary_position: "QB", position_group: "QB" })]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    expect(result.blackbird.coverage.isComplete).toBe(false);
    expect(result.providerComparison?.comparisonStatus).toBe("incomplete_blackbird_coverage");
  });

  it("classifies provider comparison when newly supported offensive bonus keys are fully covered", async () => {
    const league = makeLeagueContext({ pass_cmp: 0.1, bonus_pass_cmp_25: 2 });

    const result = await scoreStoredWeeklyStatsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        weeklyStatsRowId: "row-bonus"
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async loadWeeklyStatsRow() {
          return {
            id: "row-bonus",
            player_id: "player-1",
            provider: "manual",
            provider_external_id: "ext-1",
            season: 2026,
            week: 1,
            position_group: "QB",
            stats_json: {
              pass_cmp: 25
            },
            provider_fantasy_points: 4.5,
            source_updated_at: null,
            ingested_at: "2026-09-10T12:05:00Z"
          };
        },
        async loadPlayersByIds() {
          return new Map([["player-1", makePlayer({ position: "QB", raw_position: "QB", primary_position: "QB", position_group: "QB" })]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    expect(result.blackbird.coverage.isComplete).toBe(true);
    expect(result.providerComparison?.comparisonStatus).toBe("match");
  });

  it("returns per-row errors without erasing valid batch results", async () => {
    const league = makeLeagueContext({ rec: 0.5 });

    const result = await scoreWeeklyStatsRowsForLeague(
      {
        userId: "user-1",
        leagueId: "league-1",
        season: 2026,
        week: 1,
        limit: 10
      },
      {
        async getLeagueScoringContext() {
          return league;
        },
        async listWeeklyStatsRows() {
          return [
            {
              id: "row-good",
              player_id: "player-1",
              provider: "manual",
              provider_external_id: null,
              season: 2026,
              week: 1,
              position_group: "WR",
              stats_json: { rec: 4 },
              provider_fantasy_points: null,
              source_updated_at: null,
              ingested_at: "2026-09-10T12:05:00Z"
            },
            {
              id: "row-bad",
              player_id: "missing-player",
              provider: "manual",
              provider_external_id: null,
              season: 2026,
              week: 1,
              position_group: "WR",
              stats_json: { rec: 4 },
              provider_fantasy_points: null,
              source_updated_at: null,
              ingested_at: "2026-09-10T12:05:00Z"
            }
          ];
        },
        async loadPlayersByIds() {
          return new Map([["player-1", makePlayer()]]);
        },
        async loadDerivedStats() {
          return new Map();
        }
      }
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({ ok: true });
    expect(result.results[1]).toMatchObject({
      ok: false,
      error: {
        rowId: "row-bad",
        code: "ROW_NOT_FOUND"
      }
    });
  });
});
