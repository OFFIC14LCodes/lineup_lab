import { describe, expect, it } from "vitest";

import {
  buildInjuryInsert,
  buildProjectionInsert,
  buildSeasonStatsInsert,
  buildWeeklyStatsInsert,
  normalizeStatsJson,
  validateProjectionType,
  validateSeasonType
} from "@/lib/providers/data-builders";

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

describe("provider data builders", () => {
  it("builds a valid weekly offensive stats row", () => {
    const row = buildWeeklyStatsInsert({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      week: 1,
      stats_json: { passing_yards: 325, passing_tds: 3 },
      position_group: "QB",
      team: "buf"
    });

    expect(row.provider).toBe("sportsdataio");
    expect(row.position_group).toBe("QB");
    expect(row.team).toBe("BUF");
  });

  it("builds a valid IDP weekly stats row", () => {
    const row = buildWeeklyStatsInsert({
      player_id: PLAYER_ID,
      provider: "fantasydata",
      season: 2026,
      week: 5,
      season_type: "regular",
      position_group: "LB",
      stats_json: { solo_tackles: 8, sacks: 1.5, passes_defended: 1 }
    });

    expect(row.position_group).toBe("LB");
    expect(row.stats_json.solo_tackles).toBe(8);
    expect(row.stats_json.solo_tkl).toBe(8);
    expect(row.stats_json.sack).toBe(1.5);
    expect(row.stats_json.pd).toBe(1);
  });

  it("builds a valid kicker stats row", () => {
    const row = buildWeeklyStatsInsert({
      player_id: PLAYER_ID,
      provider: "sportradar",
      season: 2026,
      week: 8,
      position_group: "K",
      stats_json: { fg_made_40_49: 2, xp_made: 3, xp_missed: 1 }
    });

    expect(row.position_group).toBe("K");
    expect(row.stats_json.fg_made_40_49).toBe(2);
  });

  it("builds a valid DEF stats row with opponent and game context", () => {
    const row = buildWeeklyStatsInsert({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      week: 10,
      game_id: "game-123",
      team: "pit",
      opponent: "bal",
      home_away: "home",
      game_date: "2026-11-15T18:00:00Z",
      position_group: "DEF",
      stats_json: { sacks: 4, interceptions: 1, points_allowed: 13 }
    });

    expect(row.team).toBe("PIT");
    expect(row.opponent).toBe("BAL");
    expect(row.home_away).toBe("home");
    expect(row.position_group).toBe("DEF");
    expect(row.stats_json.sack).toBe(4);
    expect(row.stats_json.int).toBe(1);
    expect(row.stats_json.pts_allow).toBe(13);
  });

  it("builds a season aggregate row", () => {
    const row = buildSeasonStatsInsert({
      player_id: PLAYER_ID,
      provider: "nflverse",
      season: 2025,
      games_played: 17,
      games_started: 17,
      stats_json: { rushing_yards: 1211, rushing_tds: 10 }
    });

    expect(row.games_played).toBe(17);
    expect(row.season_type).toBe("regular");
  });

  it("builds a weekly projection with week", () => {
    const row = buildProjectionInsert({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      week: 3,
      projection_type: "weekly",
      scoring_format: "ppr",
      stats_json: { receptions: 6, receiving_yards: 78 }
    });

    expect(row.week).toBe(3);
    expect(row.version).toBe("current");
  });

  it("builds a season projection with null week", () => {
    const row = buildProjectionInsert({
      player_id: PLAYER_ID,
      provider: "fantasydata",
      season: 2026,
      week: null,
      projection_type: "season",
      stats_json: { rushing_yards: 980 }
    });

    expect(row.week).toBeNull();
    expect(row.projection_type).toBe("season");
  });

  it("builds a rest-of-season projection", () => {
    const row = buildProjectionInsert({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      projection_type: "rest_of_season",
      stats_json: { receiving_yards: 550 }
    });

    expect(row.projection_type).toBe("rest_of_season");
    expect(row.week).toBeUndefined();
  });

  it("builds an injury observation", () => {
    const row = buildInjuryInsert({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      week: 7,
      team: "kc",
      status: "Questionable",
      game_status: "Game-time decision",
      body_part: "Ankle",
      description: " Limited in practice ",
      is_current: true
    });

    expect(row.team).toBe("KC");
    expect(row.description).toBe("Limited in practice");
  });

  it("rejects an invalid provider", () => {
    expect(() =>
      buildWeeklyStatsInsert({
        player_id: PLAYER_ID,
        provider: "unknown" as never,
        season: 2026,
        week: 1,
        stats_json: { tackles: 3 }
      })
    ).toThrow("Unsupported provider");
  });

  it("rejects an invalid season or week", () => {
    expect(() =>
      buildWeeklyStatsInsert({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 1800,
        week: 1,
        stats_json: { tackles: 3 }
      })
    ).toThrow("Season");

    expect(() =>
      buildWeeklyStatsInsert({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 2026,
        week: 0,
        stats_json: { tackles: 3 }
      })
    ).toThrow("Week");
  });

  it("rejects non-finite numeric stats", () => {
    expect(() => normalizeStatsJson({ sacks: Number.POSITIVE_INFINITY })).toThrow("finite number");
  });

  it("preserves unknown raw stat keys and normalizes null-ish strings", () => {
    const stats = normalizeStatsJson({
      custom_provider_metric: 42,
      raw_label: " value ",
      empty_text: "   "
    });

    expect(stats.custom_provider_metric).toBe(42);
    expect(stats.raw_label).toBe("value");
    expect(stats.empty_text).toBeNull();
  });

  it("enforces projection week rules", () => {
    expect(() =>
      buildProjectionInsert({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 2026,
        projection_type: "weekly",
        stats_json: {}
      })
    ).toThrow("require a week");

    expect(() =>
      buildProjectionInsert({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 2026,
        week: 2,
        projection_type: "season",
        stats_json: {}
      })
    ).toThrow("must not include a week");
  });

  it("validates season and projection type helpers", () => {
    expect(validateSeasonType("POSTSEASON")).toBe("postseason");
    expect(validateProjectionType("weekly")).toBe("weekly");
  });
});
