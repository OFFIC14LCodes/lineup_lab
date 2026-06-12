import { describe, expect, it } from "vitest";

import { normalizeSleeperScoringSettings } from "@/lib/scoring";

describe("normalizeSleeperScoringSettings", () => {
  it("normalizes numeric strings, negatives, and zero values without mutating the source object", () => {
    const raw = {
      PASS_YD: "0.04",
      pass_td: 4,
      pass_int: "-2",
      rec: 0,
      bad: "abc"
    };

    const result = normalizeSleeperScoringSettings(raw);

    expect(result.values).toEqual({
      pass_yd: 0.04,
      pass_td: 4,
      pass_int: -2,
      rec: 0
    });
    expect(result.ignoredKeys).toEqual(["rec"]);
    expect(result.invalidKeys).toEqual([
      {
        key: "bad",
        value: "abc",
        reason: "Scoring value is not a finite number."
      }
    ]);
    expect(raw).toEqual({
      PASS_YD: "0.04",
      pass_td: 4,
      pass_int: "-2",
      rec: 0,
      bad: "abc"
    });
  });
});
