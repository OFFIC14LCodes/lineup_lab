import { describe, expect, it } from "vitest";

import { auditLeagueScoringSettings, scoreFantasyStats } from "@/lib/scoring";

describe("scoring coverage and audit", () => {
  it("reports unsupported keys, missing stats, unused stats, alias ambiguity, and positional denominator behavior", () => {
    const result = scoreFantasyStats({
      stats: {
        pass_yd: 275,
        passing_yards: 280,
        mystery_stat: 9
      },
      scoringSettings: {
        pass_yd: 0.04,
        solo_tkl: 2,
        custom_unknown_key: 5
      },
      positionGroup: "QB"
    });

    expect(result.coverage.evaluatedScoringKeys).toEqual(["pass_yd"]);
    expect(result.coverage.notApplicableScoringKeys).toContain("solo_tkl");
    expect(result.coverage.unsupportedScoringKeys).toContain("custom_unknown_key");
    expect(result.coverage.unusedStatKeys).toContain("mystery_stat");
    expect(result.coverage.ambiguousStatAliases).toEqual([
      { canonicalKey: "pass_yd", presentAliases: ["pass_yd", "passing_yards"] }
    ]);
    expect(result.coverage.coverageRatio).toBeCloseTo(0.5, 8);
    expect(result.coverage.isComplete).toBe(false);
  });

  it("keeps unsupported but applicable keys visible in league audit output", () => {
    const audit = auditLeagueScoringSettings({
      pass_yd: 0.04,
      rec_te_bonus: 0.5,
      rec_te: 1.5,
      solo_tkl: 2
    });

    expect(audit.partiallySupportedKeys).toEqual(expect.arrayContaining(["pass_yd", "rec_te_bonus"]));
    expect(audit.unknownKeys).toContain("rec_te");
    expect(audit.positionSpecificSupport.TE.supportedKeys).toContain("rec_te_bonus");
    expect(audit.positionSpecificSupport.WR.notApplicableKeys).toContain("rec_te_bonus");
    expect(audit.positionSpecificSupport.LB.supportedKeys).toContain("solo_tkl");
  });
});
