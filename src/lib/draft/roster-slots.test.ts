import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements, buildPositionNeeds, buildTopNeeds } from "./roster-slots";

describe("buildNormalizedRosterRequirements", () => {
  it("normalizes a standard offense league", () => {
    const requirements = buildNormalizedRosterRequirements([
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "BN",
      "BN",
      "IR"
    ]);

    expect(requirements.directStarters.QB).toBe(1);
    expect(requirements.directStarters.RB).toBe(2);
    expect(requirements.directStarters.WR).toBe(2);
    expect(requirements.directStarters.TE).toBe(1);
    expect(requirements.offensiveFlexCount).toBe(1);
    expect(requirements.benchCount).toBe(2);
    expect(requirements.irCount).toBe(1);
    expect(requirements.hasIDP).toBe(false);
    expect(requirements.hasKicker).toBe(false);
    expect(requirements.hasTeamDefense).toBe(false);
  });

  it("keeps superflex demand separate from offensive flex demand", () => {
    const requirements = buildNormalizedRosterRequirements(["QB", "RB", "WR", "WR", "TE", "SUPER_FLEX", "FLEX", "BN"]);
    const needs = buildPositionNeeds({ QB: 0, RB: 0, WR: 0, TE: 0 }, requirements);
    const qbNeed = needs.find((need) => need.position === "QB");
    const rbNeed = needs.find((need) => need.position === "RB");

    expect(requirements.superflexCount).toBe(1);
    expect(requirements.offensiveFlexCount).toBe(1);
    expect(qbNeed?.sharedFlexDemand).toBe(1);
    expect(qbNeed?.note).toContain("Superflex");
    expect(rbNeed?.sharedFlexDemand).toBe(2);
  });

  it("normalizes kicker and team defense slots", () => {
    const requirements = buildNormalizedRosterRequirements(["QB", "RB", "WR", "TE", "K", "DST"]);

    expect(requirements.directStarters.K).toBe(1);
    expect(requirements.directStarters.DEF).toBe(1);
    expect(requirements.hasKicker).toBe(true);
    expect(requirements.hasTeamDefense).toBe(true);
  });

  it("tracks direct IDP starters", () => {
    const requirements = buildNormalizedRosterRequirements(["DL", "DL", "LB", "LB", "DB", "DB"]);

    expect(requirements.directStarters.DL).toBe(2);
    expect(requirements.directStarters.LB).toBe(2);
    expect(requirements.directStarters.DB).toBe(2);
    expect(requirements.hasIDP).toBe(true);
  });

  it("supports IDP-flex-only leagues without false direct requirements", () => {
    const requirements = buildNormalizedRosterRequirements(["IDP", "IDP_FLEX", "BN"]);
    const needs = buildPositionNeeds({ DL: 0, LB: 0, DB: 0 }, requirements);
    const sharedIdp = needs.find((need) => need.position === "IDP");

    expect(requirements.idpFlexCount).toBe(2);
    expect(requirements.directStarters.DL).toBe(0);
    expect(requirements.directStarters.LB).toBe(0);
    expect(requirements.directStarters.DB).toBe(0);
    expect(sharedIdp?.sharedFlexDemand).toBe(2);
    expect(sharedIdp?.kind).toBe("shared");
    expect(sharedIdp?.note).toContain("Shared defensive flex demand");
  });

  it("normalizes raw defensive aliases", () => {
    const requirements = buildNormalizedRosterRequirements(["DE", "DT", "EDGE", "ILB", "OLB", "MLB", "CB", "S", "FS", "SS", "D/ST"]);

    expect(requirements.directStarters.DL).toBe(3);
    expect(requirements.directStarters.LB).toBe(3);
    expect(requirements.directStarters.DB).toBe(4);
    expect(requirements.directStarters.DEF).toBe(1);
  });

  it("preserves unknown slots without creating false starter demand", () => {
    const requirements = buildNormalizedRosterRequirements(["QB", "CUSTOM_FLEX_X"]);

    expect(requirements.unknownSlots).toEqual(["CUSTOM_FLEX_X"]);
    expect(requirements.directStarters.RB).toBe(0);
    expect(requirements.offensiveFlexCount).toBe(0);
  });
});

describe("buildTopNeeds", () => {
  it("surfaces generalized IDP demand for IDP-flex-only leagues", () => {
    const requirements = buildNormalizedRosterRequirements(["IDP", "IDP_FLEX"]);
    const topNeeds = buildTopNeeds(buildPositionNeeds({ DL: 0, LB: 0, DB: 0 }, requirements));

    expect(topNeeds[0]?.position).toBe("IDP");
    expect(topNeeds[0]?.sharedFlexDemand).toBe(2);
    expect(topNeeds[0]?.kind).toBe("shared");
  });
});
