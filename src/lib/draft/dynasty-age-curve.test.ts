import { describe, expect, it } from "vitest";

import { buildDynastyAgeCurve } from "./dynasty-age-curve";

describe("H56B dynasty age curve", () => {
  it("differs by position", () => {
    const rb = buildDynastyAgeCurve({ position: "RB", age: 30 });
    const qb = buildDynastyAgeCurve({ position: "QB", age: 30 });

    expect(rb.agePhase).toBe("cliff_risk");
    expect(qb.agePhase).toBe("prime");
    expect(qb.runwayScore).toBeGreaterThan(rb.runwayScore);
  });

  it("older RB age cliff penalty is stronger than older QB penalty", () => {
    const rb = buildDynastyAgeCurve({ position: "RB", age: 32 });
    const qb = buildDynastyAgeCurve({ position: "QB", age: 37 });

    expect(rb.declineRisk).toBe("severe");
    expect(qb.declineRisk).toBe("high");
    expect(rb.ageAdjustment).toBeLessThan(qb.ageAdjustment);
  });

  it("young elite TE runway is recognized", () => {
    const te = buildDynastyAgeCurve({ position: "TE", age: 23 });

    expect(te.agePhase).toBe("ascending");
    expect(te.runwayScore).toBeGreaterThanOrEqual(90);
    expect(te.explanation).toContain("runway");
  });

  it("returns neutral unknown when age is missing", () => {
    const curve = buildDynastyAgeCurve({ position: "WR", age: null });

    expect(curve).toMatchObject({ agePhase: "unknown", declineRisk: "unknown", runwayScore: 50 });
  });
});
