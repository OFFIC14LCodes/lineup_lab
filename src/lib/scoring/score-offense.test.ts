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
