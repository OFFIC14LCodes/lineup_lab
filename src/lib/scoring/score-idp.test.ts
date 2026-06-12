import { describe, expect, it } from "vitest";

import { scoreFantasyStats } from "@/lib/scoring";
import { idpLeagueScoringSettings } from "@/lib/scoring/__fixtures__/league-settings";

describe("IDP fantasy scoring", () => {
  it("scores solo and assisted tackles, sacks, tfl, pressures, and turnovers", () => {
    const result = scoreFantasyStats({
      stats: {
        solo_tkl: 6,
        ast_tkl: 2,
        sack: 1.5,
        tkl_loss: 2,
        qb_hit: 3,
        int: 1,
        pd: 1,
        ff: 1,
        fr: 1
      },
      scoringSettings: idpLeagueScoringSettings,
      positionGroup: "LB"
    });

    expect(result.totalPoints).toBeCloseTo(12 + 2 + 6 + 4 + 3 + 6 + 2 + 3 + 3, 8);
  });

  it("scores total tackles literally and warns about overlapping tackle keys", () => {
    const result = scoreFantasyStats({
      stats: {
        solo_tkl: 5,
        ast_tkl: 2,
        tkl: 7
      },
      scoringSettings: {
        solo_tkl: 2,
        ast_tkl: 1,
        tkl: 0.5
      },
      positionGroup: "DB"
    });

    expect(result.totalPoints).toBeCloseTo(10 + 2 + 3.5, 8);
    expect(result.warnings.some((warning) => warning.code === "OVERLAPPING_IDP_TACKLE_KEYS")).toBe(true);
  });

  it("applies IDP position groups and keeps offensive scoring keys not applicable", () => {
    const result = scoreFantasyStats({
      stats: {
        pass_td: 1,
        solo_tkl: 4,
        def_td: 1,
        blk_kick: 1,
        safe: 1
      },
      scoringSettings: {
        pass_td: 4,
        solo_tkl: 2,
        def_td: 6,
        blk_kick: 3,
        safe: 4
      },
      positionGroup: "DL"
    });

    expect(result.coverage.notApplicableScoringKeys).toContain("pass_td");
    expect(result.totalPoints).toBeCloseTo(8 + 6 + 3 + 4, 8);
  });
});
