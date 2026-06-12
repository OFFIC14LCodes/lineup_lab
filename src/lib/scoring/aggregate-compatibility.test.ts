import { describe, expect, it } from "vitest";

import { auditAggregateScoringCompatibility } from "@/lib/scoring";

describe("auditAggregateScoringCompatibility", () => {
  it("treats linear scoring keys as aggregate-safe", () => {
    const result = auditAggregateScoringCompatibility({
      scoringSettings: {
        pass_yd: 0.04,
        pass_td: 4,
        rec: 1
      },
      positionGroup: "QB"
    });

    expect(result.isExact).toBe(true);
    expect(result.safeKeys).toEqual(["pass_td", "pass_yd", "rec"]);
    expect(result.aggregateUnsafeKeys).toEqual([]);
  });

  it("flags weekly bonuses and defense tiers as aggregate-unsafe", () => {
    const result = auditAggregateScoringCompatibility({
      scoringSettings: {
        bonus_rush_yd_100: 3,
        pts_allow_0: 10,
        yds_allow_0_100: 5
      },
      positionGroup: "RB"
    });

    expect(result.isExact).toBe(false);
    expect(result.aggregateUnsafeKeys).toEqual(["bonus_rush_yd_100"]);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Weekly threshold bonus bonus_rush_yd_100 cannot be reconstructed exactly from aggregate totals."
      ])
    );

    const defenseResult = auditAggregateScoringCompatibility({
      scoringSettings: {
        pts_allow_0: 10,
        yds_allow_0_100: 5
      },
      positionGroup: "DEF"
    });

    expect(defenseResult.aggregateUnsafeKeys).toEqual(["pts_allow_0", "yds_allow_0_100"]);
  });

  it("treats long-play bonus style keys as aggregate-unsafe even without extra warnings", () => {
    const result = auditAggregateScoringCompatibility({
      scoringSettings: {
        bonus_long_td: 2
      },
      positionGroup: "WR"
    });

    expect(result.isExact).toBe(false);
    expect(result.aggregateUnsafeKeys).toContain("bonus_long_td");
    expect(result.reasons).toContain("Weekly threshold bonus bonus_long_td cannot be reconstructed exactly from aggregate totals.");
    expect(result.warnings).toEqual([]);
  });
});
