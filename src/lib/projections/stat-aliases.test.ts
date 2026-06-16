import { describe, expect, it } from "vitest";

import { normalizeProjectionStatKey, normalizeProjectionStats } from "./stat-aliases";

describe("projection stat aliases", () => {
  it("normalizes offensive and defensive interception aliases by context", () => {
    expect(normalizeProjectionStatKey("int", { position: "QB" })).toBe("pass_int");
    expect(normalizeProjectionStatKey("interceptions", { position: "DB" })).toBe("def_int");
  });

  it("normalizes common offense, IDP, and kicking aliases", () => {
    const stats = normalizeProjectionStats({
      passing_yards: 4200,
      receiving_targets: 112,
      solo_tackles: 80,
      passes_defended: 12,
      field_goals_made: 28,
    }, { position: "LB" });

    expect(stats).toMatchObject({
      pass_yd: 4200,
      target: 112,
      solo_tkl: 80,
      pass_def: 12,
      fg_made: 28,
    });
  });
});
