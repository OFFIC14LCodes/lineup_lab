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

  it("ignores unsupported position-specific keys that do not apply to the requested position", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ pass_td: 4, bonus_rec_te: 0.5, bonus_fd_rb: 1 }),
      positionGroup: "QB"
    });

    expect(result.status).toBe("ready");
    expect(result.unsupportedApplicableKeys).toEqual([]);
    expect(result.supportRatio).toBe(1);
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

  it("dataset capability: fully_supported when all keys are supported", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec: 1, rec_yd: 0.1, rec_td: 6 }),
      positionGroup: "WR"
    });

    expect(result.dataCapabilityStatus).toBe("fully_supported");
    expect(result.unsupportedApplicableKeyCount).toBe(0);
    expect(result.unavailableFromCurrentDatasetCount).toBe(0);
    expect(result.unsupportedKeyReasons).toEqual([]);
  });

  it("dataset capability: long-TD keys are now fully supported (PBP derivation implemented)", () => {
    // rec_td_40p and rush_td_40p were previously requires_play_by_play.
    // After H2 PBP derivation, they are implementable_now_verified and fully supported.
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec_td: 6, rec_td_40p: 2, rush_td: 6, rush_td_40p: 2 }),
      positionGroup: "RB"
    });

    expect(result.dataCapabilityStatus).toBe("fully_supported");
    expect(result.unavailableFromCurrentDatasetCount).toBe(0);
    const playByPlayReasons = result.unsupportedKeyReasons.filter((r) => r.reason === "requires_play_by_play");
    expect(playByPlayReasons).toHaveLength(0);
  });

  it("applicableCoverageRatio matches supportRatio", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ rec: 1, rec_yd: 0.1, rec_td: 6 }),
      positionGroup: "WR"
    });

    expect(result.applicableCoverageRatio).toBe(result.supportRatio);
  });

  it("reclassifies return_fd as unavailable from the current weekly dataset", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ return_fd: 0.25, rec: 1 }),
      positionGroup: "WR"
    });

    expect(result.unsupportedApplicableKeys).toContain("return_fd");
    expect(result.supportedApplicableKeys).not.toContain("return_fd");
    expect(result.dataCapabilityStatus).toBe("unavailable_from_weekly_source");
    expect(result.unsupportedKeyReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "return_fd",
          reason: "unavailable_from_weekly_source"
        })
      ])
    );
  });

  it("treats fum_ret_td as a supported applicable key once the PBP derivation is available", () => {
    const result = evaluateLeagueScoringReadiness({
      league: makeLeague({ fum_ret_td: 6, rec: 1 }),
      positionGroup: "RB"
    });

    expect(result.supportedApplicableKeys).toContain("fum_ret_td");
    expect(result.unsupportedApplicableKeys).not.toContain("fum_ret_td");
    expect(result.dataCapabilityStatus).toBe("fully_supported");
  });

  describe("pass_pick6 / pass_int_td derived support", () => {
    it("treats pass_pick6 as a supported applicable key", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_int: -2, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.supportedApplicableKeys).toContain("pass_pick6");
      expect(result.unsupportedApplicableKeys).not.toContain("pass_pick6");
    });

    it("treats pass_int_td as a supported applicable key", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_int: -2, pass_int_td: -6 }),
        positionGroup: "QB"
      });

      expect(result.supportedApplicableKeys).toContain("pass_int_td");
      expect(result.unsupportedApplicableKeys).not.toContain("pass_int_td");
    });

    it("derived pick-six keys do not appear in unsupported readiness buckets", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.highImpactUnsupportedKeys).not.toContain("pass_pick6");
      expect(result.failedRules).not.toContain("no_high_impact_unsupported_keys");
      expect(result.passedRules).toContain("no_high_impact_unsupported_keys");
    });

    it("resolves dataCapabilityStatus to fully_supported when pass_pick6 is active", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.dataCapabilityStatus).toBe("fully_supported");
    });

    it("does not count supported derived pick-six keys as unavailable", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2, pass_int_td: -6 }),
        positionGroup: "QB"
      });

      expect(result.unavailableFromCurrentDatasetCount).toBe(0);
    });

    it("does not emit unsupportedKeyReasons for supported pick-six keys", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      const reason = result.unsupportedKeyReasons.find((r) => r.key === "pass_pick6");
      expect(reason).toBeUndefined();
    });

    it("remains fully_supported when pass_pick6 is combined with long-TD derived keys", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ rec_td: 6, rec_td_40p: 2, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.dataCapabilityStatus).toBe("fully_supported");
    });
  });

  describe("League B QB coverage math", () => {
    it("pass_pick6 no longer reduces supportRatio below 1 by itself", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({
          pass_td: 4,
          pass_yd: 0.04,
          pass_int: -2,
          pass_pick6: -2,
          rec_td_40p: 2,
          rush_td_40p: 2
        }),
        positionGroup: "QB"
      });

      expect(result.supportRatio).toBe(1);
      expect(result.supportedApplicableKeys).toContain("pass_pick6");
      expect(result.unsupportedApplicableKeys).not.toContain("pass_pick6");
    });
  });
});
