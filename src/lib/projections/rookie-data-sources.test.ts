import { describe, expect, it } from "vitest";

import { buildCollegeProductionProfile, buildDraftCapitalProfile, normalizeRookieProfile } from "./rookie-data-sources";

describe("rookie data source normalization", () => {
  it("derives deterministic draft capital without ADP", () => {
    const profile = buildDraftCapitalProfile({ nflDraftRound: 1, nflDraftPick: 8, nflDraftOverall: 8 });

    expect(profile.score).toBe(95);
    expect(profile.opportunityTier).toBe("high");
    expect(profile.dataGaps).toEqual([]);
  });

  it("scores college production by position and reports missing inputs", () => {
    const receiver = buildCollegeProductionProfile({
      playerName: "Rookie WR",
      position: "WR",
      season: 2026,
      collegeTargets: 120,
      collegeReceptions: 82,
      collegeReceivingYards: 1320,
      collegeReceivingTouchdowns: 12,
      source: "manual",
    });
    const missing = buildCollegeProductionProfile({ playerName: "Missing", position: "RB", season: 2026, source: "manual" });

    expect(receiver.productionScore).toBeGreaterThan(75);
    expect(receiver.dataGaps).toEqual([]);
    expect(missing.productionScore).toBeNull();
    expect(missing.dataGaps).toContain("college production");
  });

  it("keeps unavailable rookie context as explicit data gaps", () => {
    const profile = normalizeRookieProfile({
      playerName: "Rookie DB",
      position: "DB",
      team: "JAX",
      season: 2026,
      collegeSoloTackles: 70,
      collegePassesDefended: 11,
      source: "manual",
    });

    expect(profile.draftCapitalScore).toBeNull();
    expect(profile.collegeProductionScore).not.toBeNull();
    expect(profile.dataGaps).toEqual(expect.arrayContaining(["NFL draft capital", "landing spot role"]));
    expect(profile.availableInputs).toContain("college production");
    expect(profile.sourceLabels).toContain("manual");
  });
});
