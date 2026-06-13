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

  describe("pass_pick6 / pass_int_td dataset unavailability", () => {
    it("reclassifies pass_pick6 into unsupportedApplicableKeys, not supportedApplicableKeys", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_int: -2, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.unsupportedApplicableKeys).toContain("pass_pick6");
      expect(result.supportedApplicableKeys).not.toContain("pass_pick6");
    });

    it("reclassifies pass_int_td into unsupportedApplicableKeys, not supportedApplicableKeys", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_int: -2, pass_int_td: -6 }),
        positionGroup: "QB"
      });

      expect(result.unsupportedApplicableKeys).toContain("pass_int_td");
      expect(result.supportedApplicableKeys).not.toContain("pass_int_td");
    });

    it("dataset-unavailable keys do not block readiness (excluded from highImpactUnsupportedKeys)", () => {
      // pass_pick6 is active but unavailable_from_weekly_source — it must not appear in
      // highImpactUnsupportedKeys, so it cannot force not_ready via a blocking-key cap.
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.highImpactUnsupportedKeys).not.toContain("pass_pick6");
      // The "no_high_impact_unsupported_keys" rule passes — the key is unsupported but
      // excluded from blocking checks because it is a known source limitation.
      expect(result.failedRules).not.toContain("no_high_impact_unsupported_keys");
      expect(result.passedRules).toContain("no_high_impact_unsupported_keys");
    });

    it("resolves dataCapabilityStatus to unavailable_from_weekly_source when pass_pick6 is active", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.dataCapabilityStatus).toBe("unavailable_from_weekly_source");
    });

    it("counts dataset-unavailable keys in unavailableFromCurrentDatasetCount", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2, pass_int_td: -6 }),
        positionGroup: "QB"
      });

      // Both pass_pick6 and pass_int_td are unavailable_from_weekly_source
      expect(result.unavailableFromCurrentDatasetCount).toBe(2);
    });

    it("unsupportedKeyReasons records unavailable_from_weekly_source for pass_pick6", () => {
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ pass_td: 4, pass_yd: 0.04, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      const reason = result.unsupportedKeyReasons.find((r) => r.key === "pass_pick6");
      expect(reason).toBeDefined();
      expect(reason?.reason).toBe("unavailable_from_weekly_source");
      expect(reason?.requiredData).toContain("pick-six outcome per interception play");
    });

    it("unavailable_from_weekly_source when pass_pick6 active and long-TD keys are now supported", () => {
      // rec_td_40p is now supported (H2 PBP derivation).
      // With only pass_pick6 unsupported (unavailable_from_weekly_source), the
      // dataCapabilityStatus reflects the remaining unsupported key, not requires_play_by_play.
      const result = evaluateLeagueScoringReadiness({
        league: makeLeague({ rec_td: 6, rec_td_40p: 2, pass_pick6: -2 }),
        positionGroup: "QB"
      });

      expect(result.dataCapabilityStatus).toBe("unavailable_from_weekly_source");
    });
  });

  describe("League B QB coverage math (24/29 = 82.7586%)", () => {
    // League B active QB keys: pass_td, pass_yd, pass_int, pass_2pt, pass_cmp (and similar)
    // 24 evaluated + 4 unsupported (long-TD bonuses) + 1 missing_stat (pass_pick6) = 29
    // supportRatio = supportedApplicableKeys / activeApplicableKeys
    // pass_pick6 active → not in supportedApplicableKeys → lowers supportRatio

    it("pass_pick6 active in League B reduces supportRatio below 1", () => {
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

      // pass_pick6 is now unsupported (dataset-unavailable); supportRatio < 1
      expect(result.supportRatio).toBeLessThan(1);
      expect(result.supportedApplicableKeys).not.toContain("pass_pick6");
      expect(result.unsupportedApplicableKeys).toContain("pass_pick6");
    });
  });
});
