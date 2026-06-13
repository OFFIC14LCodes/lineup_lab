import { describe, expect, it } from "vitest";

import {
  scoreFantasyStats,
  scoreProjection,
  scoreSeasonStats,
  scoreWeeklyStats
} from "@/lib/scoring";
import {
  fullPprLeagueScoringSettings,
  halfPprLeagueScoringSettings,
  standardLeagueScoringSettings,
  tePremiumLeagueScoringSettings
} from "@/lib/scoring/__fixtures__/league-settings";

describe("offensive fantasy scoring", () => {
  it("scores standard and six-point-passing formats with fractional yardage and negative totals", () => {
    const standard = scoreFantasyStats({
      stats: {
        pass_yd: 257,
        pass_td: 1,
        pass_int: 2,
        rush_yd: 12,
        fum_lost: 1
      },
      scoringSettings: standardLeagueScoringSettings,
      positionGroup: "QB"
    });

    expect(standard.totalPoints).toBeCloseTo(10.28 + 4 - 4 + 1.2 - 2, 8);

    const sixPoint = scoreFantasyStats({
      stats: {
        pass_yd: 300,
        pass_td: 2,
        pass_int: 1
      },
      scoringSettings: {
        pass_yd: 0.04,
        pass_td: 6,
        pass_int: -1
      },
      positionGroup: "QB"
    });

    expect(sixPoint.totalPoints).toBeCloseTo(12 + 12 - 1, 8);
  });

  it("distinguishes standard, half-ppr, and full-ppr receiving formats", () => {
    const stats = {
      rec: 8,
      rec_yd: 95,
      rec_td: 1
    };

    const standard = scoreFantasyStats({
      stats,
      scoringSettings: standardLeagueScoringSettings,
      positionGroup: "WR"
    });
    const half = scoreFantasyStats({
      stats,
      scoringSettings: halfPprLeagueScoringSettings,
      positionGroup: "WR"
    });
    const full = scoreFantasyStats({
      stats,
      scoringSettings: fullPprLeagueScoringSettings,
      positionGroup: "WR"
    });

    expect(standard.totalPoints).toBeCloseTo(9.5 + 6, 8);
    expect(half.totalPoints).toBeCloseTo(standard.totalPoints + 4, 8);
    expect(full.totalPoints).toBeCloseTo(standard.totalPoints + 8, 8);
  });

  it("supports first downs, two-point conversions, and threshold bonuses", () => {
    const result = scoreFantasyStats({
      stats: {
        rush_yd: 101,
        rush_td: 1,
        rush_fd: 5,
        rush_2pt: 1
      },
      scoringSettings: {
        rush_yd: 0.1,
        rush_td: 6,
        rush_fd: 0.5,
        rush_2pt: 2,
        bonus_rush_yd_100: 3,
        bonus_rush_yd_200: 5
      },
      positionGroup: "RB"
    });

    expect(result.totalPoints).toBeCloseTo(10.1 + 6 + 2.5 + 2 + 3, 8);
    expect(result.coverage.evaluatedScoringKeys).toEqual(
      expect.arrayContaining(["bonus_rush_yd_100", "bonus_rush_yd_200", "rush_fd", "rush_2pt"])
    );
  });

  it("applies tight-end reception bonus additively and keeps unknown premium keys unsupported", () => {
    const te = scoreFantasyStats({
      stats: {
        rec: 6,
        rec_yd: 72
      },
      scoringSettings: tePremiumLeagueScoringSettings,
      positionGroup: "TE"
    });
    const wr = scoreFantasyStats({
      stats: {
        rec: 6,
        rec_yd: 72
      },
      scoringSettings: tePremiumLeagueScoringSettings,
      positionGroup: "WR"
    });
    const unknownPremium = scoreFantasyStats({
      stats: {
        rec: 6
      },
      scoringSettings: {
        rec: 1,
        rec_te: 1.5
      },
      positionGroup: "TE"
    });

    expect(te.totalPoints).toBeCloseTo(6 + 0.5 * 6 + 7.2, 8);
    expect(wr.totalPoints).toBeCloseTo(6 + 7.2, 8);
    expect(unknownPremium.coverage.unsupportedScoringKeys).toContain("rec_te");
  });

  it("supports verified positional reception bonus aliases and 25+ completion bonus", () => {
    const rb = scoreFantasyStats({
      stats: {
        rec: 4,
        rush_att: 7
      },
      scoringSettings: {
        rec: 0.5,
        bonus_rec_rb: 0.25
      },
      positionGroup: "RB"
    });
    const qb = scoreFantasyStats({
      stats: {
        pass_cmp: 25,
        pass_att: 33
      },
      scoringSettings: {
        pass_cmp: 0.1,
        bonus_pass_cmp_25: 2
      },
      positionGroup: "QB"
    });

    expect(rb.totalPoints).toBeCloseTo(4 * 0.5 + 4 * 0.25, 8);
    expect(qb.totalPoints).toBeCloseTo(25 * 0.1 + 2, 8);
  });

  it("supports carry and combined-yard bonuses without double counting", () => {
    const result = scoreFantasyStats({
      stats: {
        rush_att: 20,
        rush_yd: 140,
        rec_yd: 60
      },
      scoringSettings: {
        rush_att: 0.1,
        rush_yd: 0.1,
        rec_yd: 0.1,
        bonus_rush_att_20: 1.5,
        bonus_rush_rec_yd_100: 2,
        bonus_rush_rec_yd_200: 4
      },
      positionGroup: "RB"
    });

    expect(result.totalPoints).toBeCloseTo(2 + 14 + 6 + 1.5 + 4, 8);
    expect(result.components.filter((component) => component.scoringKey === "bonus_rush_rec_yd_100")).toHaveLength(0);
    expect(
      result.components.find((component) => component.scoringKey === "bonus_rush_rec_yd_200")
    ).toMatchObject({
      statKey: "rush_yd+rec_yd",
      statValue: 200,
      scoringValue: 4,
      points: 4
    });
  });

  it("does not award threshold bonuses below the boundary", () => {
    const result = scoreFantasyStats({
      stats: {
        pass_cmp: 24,
        rush_att: 19,
        rush_yd: 199,
        rec_yd: 0
      },
      scoringSettings: {
        bonus_pass_cmp_25: 2,
        bonus_rush_att_20: 1.5,
        bonus_rush_rec_yd_200: 4
      },
      positionGroup: "QB"
    });

    expect(result.totalPoints).toBe(0);
    expect(result.coverage.evaluatedScoringKeys).toEqual(
      expect.arrayContaining(["bonus_pass_cmp_25", "bonus_rush_att_20", "bonus_rush_rec_yd_200"])
    );
  });

  it("bonus_fd_qb: awards extra points per passing first down, additive to pass_fd", () => {
    const result = scoreFantasyStats({
      stats: { pass_fd: 4 },
      scoringSettings: { pass_fd: 0.5, bonus_fd_qb: 0.25 },
      positionGroup: "QB"
    });
    // pass_fd: 4 * 0.5 = 2.0 + bonus_fd_qb: 4 * 0.25 = 1.0 = 3.0
    expect(result.totalPoints).toBeCloseTo(2.0 + 1.0, 8);
    expect(result.coverage.evaluatedScoringKeys).toContain("bonus_fd_qb");
    expect(result.coverage.evaluatedScoringKeys).toContain("pass_fd");
  });

  it("bonus_fd_qb: not applicable to non-QB positions", () => {
    const result = scoreFantasyStats({
      stats: { rush_fd: 2 },
      scoringSettings: { bonus_fd_qb: 0.5 },
      positionGroup: "RB"
    });
    expect(result.totalPoints).toBe(0);
    expect(result.coverage.notApplicableScoringKeys).toContain("bonus_fd_qb");
  });

  it("bonus_fd_rb: awards extra points per combined rushing and receiving first down", () => {
    const result = scoreFantasyStats({
      stats: { rush_fd: 3, rec_fd: 2 },
      scoringSettings: { bonus_fd_rb: 0.5 },
      positionGroup: "RB"
    });
    // (rush_fd 3 + rec_fd 2) * 0.5 = 2.5
    expect(result.totalPoints).toBeCloseTo(2.5, 8);
    const comp = result.components.find((c) => c.scoringKey === "bonus_fd_rb");
    expect(comp).toBeDefined();
    expect(comp?.statKey).toBe("rush_fd+rec_fd");
    expect(comp?.statValue).toBe(5);
  });

  it("bonus_fd_rb: uses only rush_fd when rec_fd is absent", () => {
    const result = scoreFantasyStats({
      stats: { rush_fd: 3 },
      scoringSettings: { bonus_fd_rb: 0.5 },
      positionGroup: "RB"
    });
    expect(result.totalPoints).toBeCloseTo(1.5, 8);
  });

  it("bonus_fd_rb: not applicable to WR, TE, QB", () => {
    for (const pos of ["WR", "TE", "QB"] as const) {
      const result = scoreFantasyStats({
        stats: { rec_fd: 3 },
        scoringSettings: { bonus_fd_rb: 0.5 },
        positionGroup: pos
      });
      expect(result.coverage.notApplicableScoringKeys).toContain("bonus_fd_rb");
    }
  });

  it("bonus_fd_wr: awards extra points per receiving first down, WR only", () => {
    const result = scoreFantasyStats({
      stats: { rec_fd: 5 },
      scoringSettings: { rec_fd: 0.5, bonus_fd_wr: 0.3 },
      positionGroup: "WR"
    });
    // rec_fd: 5 * 0.5 = 2.5 + bonus_fd_wr: 5 * 0.3 = 1.5 = 4.0
    expect(result.totalPoints).toBeCloseTo(2.5 + 1.5, 8);
    expect(result.coverage.evaluatedScoringKeys).toContain("bonus_fd_wr");
  });

  it("bonus_fd_wr: not applicable to TE or RB", () => {
    for (const pos of ["TE", "RB"] as const) {
      const result = scoreFantasyStats({
        stats: { rec_fd: 3 },
        scoringSettings: { bonus_fd_wr: 0.5 },
        positionGroup: pos
      });
      expect(result.coverage.notApplicableScoringKeys).toContain("bonus_fd_wr");
    }
  });

  it("bonus_fd_te: awards extra points per receiving first down, TE only", () => {
    const result = scoreFantasyStats({
      stats: { rec_fd: 3 },
      scoringSettings: { rec_fd: 0.5, bonus_fd_te: 0.4 },
      positionGroup: "TE"
    });
    // rec_fd: 3 * 0.5 = 1.5 + bonus_fd_te: 3 * 0.4 = 1.2 = 2.7
    expect(result.totalPoints).toBeCloseTo(1.5 + 1.2, 8);
    expect(result.coverage.evaluatedScoringKeys).toContain("bonus_fd_te");
  });

  it("bonus_fd_te: not applicable to WR or RB", () => {
    for (const pos of ["WR", "RB"] as const) {
      const result = scoreFantasyStats({
        stats: { rec_fd: 3 },
        scoringSettings: { bonus_fd_te: 0.5 },
        positionGroup: pos
      });
      expect(result.coverage.notApplicableScoringKeys).toContain("bonus_fd_te");
    }
  });

  it("pass_int_td: maps to pass_pick6 canonical field (same event, separate scoring key)", () => {
    const result = scoreFantasyStats({
      stats: { pass_pick6: 1 },
      scoringSettings: { pass_int_td: -6 },
      positionGroup: "QB"
    });
    expect(result.totalPoints).toBeCloseTo(-6, 8);
    const comp = result.components.find((c) => c.scoringKey === "pass_int_td");
    expect(comp?.statKey).toBe("pass_pick6");
    expect(comp?.statValue).toBe(1);
  });

  it("pass_int_td: additive with pass_pick6 if both are active in the same league", () => {
    const result = scoreFantasyStats({
      stats: { pass_pick6: 1 },
      scoringSettings: { pass_pick6: -2, pass_int_td: -4 },
      positionGroup: "QB"
    });
    // Both reference the same canonical stat; both should score
    expect(result.totalPoints).toBeCloseTo(-2 + -4, 8);
    expect(result.coverage.evaluatedScoringKeys).toContain("pass_pick6");
    expect(result.coverage.evaluatedScoringKeys).toContain("pass_int_td");
  });

  it("long-TD keys score 0 when stats absent (values must come from PBP derivation, not inferred from totals)", () => {
    // rec_td_40p, rush_td_40p etc. are now supported keys (H2 PBP derivation).
    // When the derived stats are absent from stats_json, they appear in missingStatsForSupportedKeys.
    // No inference from rec_td / rec_yd total is performed — points = 0.
    const result = scoreFantasyStats({
      stats: { rec_td: 2, rec_yd: 150, rush_td: 1, rush_yd: 80 },
      scoringSettings: { rec_td_40p: 2, rush_td_40p: 2, rec_td_50p: 3, rush_td_50p: 3 },
      positionGroup: "RB"
    });
    expect(result.totalPoints).toBe(0);
    const missingScoringKeys = result.coverage.missingStatsForSupportedKeys.map((m) => m.scoringKey);
    for (const key of ["rec_td_40p", "rush_td_40p", "rec_td_50p", "rush_td_50p"]) {
      expect(missingScoringKeys).toContain(key);
      expect(result.coverage.evaluatedScoringKeys).not.toContain(key);
      expect(result.coverage.unsupportedScoringKeys).not.toContain(key);
    }
  });

  it("pass_int does not infer pass_pick6 — interception count cannot substitute for pick-six outcome", () => {
    // nflverse weekly data provides pass_int but has no pick-six column.
    // The engine must not fabricate pass_pick6 from pass_int.
    const result = scoreFantasyStats({
      stats: { pass_int: 3 },
      scoringSettings: { pass_pick6: -2, pass_int_td: -4 },
      positionGroup: "QB"
    });

    // pass_pick6 stat is absent — both keys must register missing_stat, not evaluated
    expect(result.totalPoints).toBe(0);
    expect(result.coverage.missingStatsForSupportedKeys.map((m) => m.scoringKey)).toContain("pass_pick6");
    expect(result.coverage.missingStatsForSupportedKeys.map((m) => m.scoringKey)).toContain("pass_int_td");
    expect(result.coverage.evaluatedScoringKeys).not.toContain("pass_pick6");
    expect(result.coverage.evaluatedScoringKeys).not.toContain("pass_int_td");
  });

  it("shares the same core engine for weekly actuals, season stats, and projections", () => {
    const weekly = scoreWeeklyStats({
      row: {
        stats_json: { pass_yd: 250, pass_td: 2, pass_int: 1 },
        position_group: "QB",
        season: 2026,
        week: 1,
        player_id: "player-1"
      },
      scoringSettings: standardLeagueScoringSettings
    });
    const season = scoreSeasonStats({
      row: {
        stats_json: { pass_yd: 4000, pass_td: 30, pass_int: 10 },
        position_group: "QB",
        season: 2026,
        player_id: "player-1"
      },
      scoringSettings: standardLeagueScoringSettings
    });
    const projection = scoreProjection({
      row: {
        stats_json: { pass_yd: 250, pass_td: 2, pass_int: 1 },
        position_group: "QB",
        season: 2026,
        week: 1,
        player_id: "player-1"
      },
      scoringSettings: standardLeagueScoringSettings
    });

    expect(weekly.totalPoints).toBeCloseTo(10 + 8 - 2, 8);
    expect(season.totalPoints).toBeCloseTo(160 + 120 - 20, 8);
    expect(projection.totalPoints).toBeCloseTo(weekly.totalPoints, 8);
  });
});
