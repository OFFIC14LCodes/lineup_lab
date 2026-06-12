import { describe, expect, it } from "vitest";

import { scoreFantasyStats } from "@/lib/scoring";
import { defenseLeagueScoringSettings } from "@/lib/scoring/__fixtures__/league-settings";

describe("team defense fantasy scoring", () => {
  it("scores core defensive stats and exclusive points-allowed tiers", () => {
    const shutout = scoreFantasyStats({
      stats: {
        sack: 4,
        int: 2,
        fr: 1,
        pts_allow: 0
      },
      scoringSettings: defenseLeagueScoringSettings,
      positionGroup: "DEF"
    });

    const highAllowed = scoreFantasyStats({
      stats: {
        pts_allow: 38
      },
      scoringSettings: defenseLeagueScoringSettings,
      positionGroup: "DEF"
    });

    expect(shutout.totalPoints).toBeCloseTo(4 + 4 + 2 + 10, 8);
    expect(highAllowed.totalPoints).toBeCloseTo(-4, 8);
    expect(shutout.coverage.evaluatedScoringKeys).toContain("pts_allow_0");
    expect(highAllowed.coverage.evaluatedScoringKeys).toContain("pts_allow_35p");
  });

  it("supports yards-allowed tiers and missing-stat reporting", () => {
    const withYards = scoreFantasyStats({
      stats: {
        yds_allow: 180
      },
      scoringSettings: {
        yds_allow_0_100: 5,
        yds_allow_101_199: 3,
        yds_allow_200_299: 1
      },
      positionGroup: "DEF"
    });
    const missingYards = scoreFantasyStats({
      stats: {
        sack: 2
      },
      scoringSettings: {
        yds_allow_0_100: 5
      },
      positionGroup: "DEF"
    });

    expect(withYards.totalPoints).toBe(3);
    expect(missingYards.coverage.missingStatsForSupportedKeys).toEqual([
      { scoringKey: "yds_allow_0_100", requiredStats: ["yds_allow"] }
    ]);
  });

  it("keeps team defense separate from individual IDP tackle scoring", () => {
    const result = scoreFantasyStats({
      stats: {
        solo_tkl: 8,
        int: 1,
        pts_allow: 10
      },
      scoringSettings: {
        solo_tkl: 2,
        int: 2,
        pts_allow_7_13: 4
      },
      positionGroup: "DEF"
    });

    expect(result.coverage.notApplicableScoringKeys).toContain("solo_tkl");
    expect(result.totalPoints).toBeCloseTo(2 + 4, 8);
  });
});
