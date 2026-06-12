import { describe, expect, it } from "vitest";

import { scoreFantasyStats } from "@/lib/scoring";
import { kickerLeagueScoringSettings } from "@/lib/scoring/__fixtures__/league-settings";

describe("kicker fantasy scoring", () => {
  it("scores made and missed kicks by distance band", () => {
    const result = scoreFantasyStats({
      stats: {
        xpm: 3,
        xpmiss: 1,
        fgm_20_29: 1,
        fgm_40_49: 2,
        fgm_50p: 1,
        fgmiss: 1
      },
      scoringSettings: kickerLeagueScoringSettings,
      positionGroup: "K"
    });

    expect(result.totalPoints).toBeCloseTo(3 - 1 + 3 + 8 + 5 - 1, 8);
  });

  it("prevents generic field-goal double counting when distance-band scoring is active", () => {
    const result = scoreFantasyStats({
      stats: {
        fgm: 4,
        fgm_20_29: 1,
        fgm_40_49: 2,
        fgm_50p: 1
      },
      scoringSettings: {
        fgm: 3,
        fgm_20_29: 3,
        fgm_40_49: 4,
        fgm_50p: 5
      },
      positionGroup: "K"
    });

    expect(result.coverage.unsupportedScoringKeys).toContain("fgm");
    expect(result.warnings.some((warning) => warning.code === "OVERLAPPING_KICKER_SCORING")).toBe(true);
    expect(result.totalPoints).toBeCloseTo(3 + 8 + 5, 8);
  });

  it("reports missing distance data when band scoring is active without fabricating band splits", () => {
    const result = scoreFantasyStats({
      stats: {
        fgm: 3
      },
      scoringSettings: {
        fgm_30_39: 3,
        fgm_40_49: 4
      },
      positionGroup: "K"
    });

    expect(result.coverage.missingStatsForSupportedKeys).toEqual(
      expect.arrayContaining([
        { scoringKey: "fgm_30_39", requiredStats: ["fgm_30_39"] },
        { scoringKey: "fgm_40_49", requiredStats: ["fgm_40_49"] }
      ])
    );
    expect(result.totalPoints).toBe(0);
  });
});
