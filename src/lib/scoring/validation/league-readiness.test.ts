import { describe, expect, it } from "vitest";

import { auditLeagueScoringSettings, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import { evaluateLeagueScoringReadiness } from "@/lib/scoring/validation";
import type { LeagueScoringContext } from "@/lib/scoring/server/types";

function makeLeague(scoringSettings: Record<string, unknown>): LeagueScoringContext {
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

describe("evaluateLeagueScoringReadiness", () => {
  it("returns ready for fully supported keys", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec: 1, rec_yd: 0.1, rec_td: 6 }),
      positionGroup: "WR"
    });

    expect(result.status).toBe("ready");
    expect(result.supportRatio).toBe(1);
  });

  it("returns conditionally ready for high support with only a minor unsupported key", () => {
    const baseLeague = makeLeague({
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      rush_yd: 0.1,
      rush_td: 6,
      rush_fd: 0.5,
      rush_2pt: 2,
      rec_fd: 0.5,
      rec_2pt: 2,
      fum_lost: -2,
      ret_td: 6,
      st_td: 6,
      kr_td: 6,
      pr_td: 6,
      ret_yd: 0.04,
      ret_fd: 0.25,
      bonus_rec_yd_100: 3,
      bonus_rec_yd_200: 5,
      bonus_rush_yd_100: 3,
      bonus_rush_yd_200: 5
    });
    const result = evaluateLeagueScoringReadiness({
      league: {
        ...baseLeague,
        scoringAudit: {
          ...baseLeague.scoringAudit,
          positionSpecificSupport: {
            ...baseLeague.scoringAudit.positionSpecificSupport,
            WR: {
              supportedKeys: [
                "bonus_rec_yd_100",
                "bonus_rec_yd_200",
                "bonus_rush_yd_100",
                "bonus_rush_yd_200",
                "fum_lost",
                "kr_td",
                "pr_td",
                "rec",
                "rec_2pt",
                "rec_fd",
                "rec_td",
                "rec_yd",
                "ret_td",
                "ret_yd",
                "rush_2pt",
                "rush_fd",
                "rush_td",
                "rush_yd",
                "st_td"
              ],
              unsupportedKeys: ["ret_fd"],
              notApplicableKeys: []
            }
          }
        }
      },
      positionGroup: "WR"
    });

    expect(result.status).toBe("conditionally_ready");
    expect(result.highImpactUnsupportedKeys).toEqual([]);
    expect(result.supportRatio).toBe(0.95);
  });

  it("returns not ready for unsupported core keys", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec: 1, rec_bonus_super: 2 }),
      positionGroup: "WR"
    });

    expect(result.status).toBe("not_ready");
    expect(result.highImpactUnsupportedKeys).toContain("rec_bonus_super");
  });

  it("returns not ready for invalid scoring values", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec: "oops" }),
      positionGroup: "WR"
    });

    expect(result.status).toBe("not_ready");
    expect(result.invalidScoringKeys).toContain("rec");
  });

  it("returns insufficient data when no active applicable keys exist", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec: 0 }),
      positionGroup: "WR"
    });

    expect(result.status).toBe("insufficient_data");
  });
});
