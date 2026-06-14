import { describe, expect, it } from "vitest";
import { computeProjectedAvailability } from "./availability";
import type { RoleWeekResult } from "./role-weeks";

// --------------------------------------------------------------------------
// Fixture builder
// --------------------------------------------------------------------------

function makeRW(aw: number, rw: number): RoleWeekResult {
  return {
    historicalActiveWeeks: aw,
    historicalRoleWeeks: rw,
    roleWeekNumbers: [],
    nonRoleWeekNumbers: [],
    roleParticipationFactor: aw > 0 ? rw / aw : 0,
    totals: {
      totalPassAttempts: 0, totalCarries: 0, totalTargets: 0,
      totalReceptions: 0, totalPassingYards: 0, totalRushingYards: 0,
      totalReceivingYards: 0, totalPassingTds: 0, totalRushingTds: 0,
      totalReceivingTds: 0, totalFumblesLost: 0, totalFumRetTd: 0,
    },
  };
}

// --------------------------------------------------------------------------
// Invariant helper
// --------------------------------------------------------------------------

function assertValidRange(result: ReturnType<typeof computeProjectedAvailability>) {
  const { projectedActiveGames: ag, projectedRoleGames: rg } = result;

  // 0 <= floor <= median <= ceiling <= 17
  expect(ag.floor).toBeGreaterThanOrEqual(0);
  expect(ag.floor).toBeLessThanOrEqual(ag.median);
  expect(ag.median).toBeLessThanOrEqual(ag.ceiling);
  expect(ag.ceiling).toBeLessThanOrEqual(17);

  expect(rg.floor).toBeGreaterThanOrEqual(0);
  expect(rg.floor).toBeLessThanOrEqual(rg.median);
  expect(rg.median).toBeLessThanOrEqual(rg.ceiling);
  expect(rg.ceiling).toBeLessThanOrEqual(17);

  // roleGames <= activeGames at each level
  expect(rg.floor).toBeLessThanOrEqual(ag.floor);
  expect(rg.median).toBeLessThanOrEqual(ag.median);
  expect(rg.ceiling).toBeLessThanOrEqual(ag.ceiling);
}

// --------------------------------------------------------------------------
// ESTABLISHED_FULL_SEASON
// --------------------------------------------------------------------------

describe("ESTABLISHED_FULL_SEASON", () => {
  it("uses fixed active games constants (floor=12, median=15, ceiling=17)", () => {
    const result = computeProjectedAvailability("ESTABLISHED_FULL_SEASON", makeRW(16, 15));
    expect(result.projectedActiveGames.floor).toBe(12);
    expect(result.projectedActiveGames.median).toBe(15);
    expect(result.projectedActiveGames.ceiling).toBe(17);
  });

  it("role games are derived from historical active weeks", () => {
    const result = computeProjectedAvailability("ESTABLISHED_FULL_SEASON", makeRW(16, 14));
    assertValidRange(result);
    expect(result.projectedRoleGames.ceiling).toBeLessThanOrEqual(17);
  });

  it("gamesConfidence is high", () => {
    expect(computeProjectedAvailability("ESTABLISHED_FULL_SEASON", makeRW(15, 14)).gamesConfidence).toBe("high");
  });

  it("satisfies all invariants", () => {
    assertValidRange(computeProjectedAvailability("ESTABLISHED_FULL_SEASON", makeRW(16, 14)));
  });
});

// --------------------------------------------------------------------------
// ESTABLISHED_PARTIAL_SEASON
// --------------------------------------------------------------------------

describe("ESTABLISHED_PARTIAL_SEASON", () => {
  it("active games median equals historicalActiveWeeks", () => {
    const result = computeProjectedAvailability("ESTABLISHED_PARTIAL_SEASON", makeRW(10, 8));
    expect(result.projectedActiveGames.median).toBe(10);
  });

  it("role games median equals historicalRoleWeeks", () => {
    const result = computeProjectedAvailability("ESTABLISHED_PARTIAL_SEASON", makeRW(10, 8));
    expect(result.projectedRoleGames.median).toBe(8);
  });

  it("gamesConfidence is medium", () => {
    expect(computeProjectedAvailability("ESTABLISHED_PARTIAL_SEASON", makeRW(10, 8)).gamesConfidence).toBe("medium");
  });

  it("satisfies all invariants", () => {
    assertValidRange(computeProjectedAvailability("ESTABLISHED_PARTIAL_SEASON", makeRW(10, 8)));
  });

  it("clamps ceiling to 17 even with high active weeks", () => {
    const result = computeProjectedAvailability("ESTABLISHED_PARTIAL_SEASON", makeRW(16, 15));
    expect(result.projectedActiveGames.ceiling).toBeLessThanOrEqual(17);
    expect(result.projectedRoleGames.ceiling).toBeLessThanOrEqual(17);
  });
});

// --------------------------------------------------------------------------
// PART_TIME_CONTRIBUTOR
// --------------------------------------------------------------------------

describe("PART_TIME_CONTRIBUTOR", () => {
  it("gamesConfidence is medium", () => {
    expect(computeProjectedAvailability("PART_TIME_CONTRIBUTOR", makeRW(8, 6)).gamesConfidence).toBe("medium");
  });

  it("satisfies all invariants", () => {
    assertValidRange(computeProjectedAvailability("PART_TIME_CONTRIBUTOR", makeRW(8, 5)));
  });

  it("median active games equals historicalActiveWeeks", () => {
    const result = computeProjectedAvailability("PART_TIME_CONTRIBUTOR", makeRW(7, 5));
    expect(result.projectedActiveGames.median).toBe(7);
  });
});

// --------------------------------------------------------------------------
// BACKUP_OR_SPOT_STARTER
// --------------------------------------------------------------------------

describe("BACKUP_OR_SPOT_STARTER", () => {
  it("gamesConfidence is low", () => {
    expect(computeProjectedAvailability("BACKUP_OR_SPOT_STARTER", makeRW(5, 2)).gamesConfidence).toBe("low");
  });

  it("active games floor is 0 (may not play at all)", () => {
    const result = computeProjectedAvailability("BACKUP_OR_SPOT_STARTER", makeRW(5, 2));
    expect(result.projectedActiveGames.floor).toBe(0);
  });

  it("role games floor is 0", () => {
    const result = computeProjectedAvailability("BACKUP_OR_SPOT_STARTER", makeRW(5, 2));
    expect(result.projectedRoleGames.floor).toBe(0);
  });

  it("satisfies all invariants", () => {
    assertValidRange(computeProjectedAvailability("BACKUP_OR_SPOT_STARTER", makeRW(5, 2)));
  });
});

// --------------------------------------------------------------------------
// MINIMAL_SAMPLE
// --------------------------------------------------------------------------

describe("MINIMAL_SAMPLE", () => {
  it("gamesConfidence is very_low", () => {
    expect(computeProjectedAvailability("MINIMAL_SAMPLE", makeRW(2, 1)).gamesConfidence).toBe("very_low");
  });

  it("floor is 0 for active and role games", () => {
    const result = computeProjectedAvailability("MINIMAL_SAMPLE", makeRW(2, 1));
    expect(result.projectedActiveGames.floor).toBe(0);
    expect(result.projectedRoleGames.floor).toBe(0);
  });

  it("satisfies all invariants", () => {
    assertValidRange(computeProjectedAvailability("MINIMAL_SAMPLE", makeRW(2, 1)));
  });
});

// --------------------------------------------------------------------------
// ROLE_UNKNOWN
// --------------------------------------------------------------------------

describe("ROLE_UNKNOWN", () => {
  it("gamesConfidence is very_low", () => {
    expect(computeProjectedAvailability("ROLE_UNKNOWN", makeRW(0, 0)).gamesConfidence).toBe("very_low");
  });

  it("active and role games medians are 0", () => {
    const result = computeProjectedAvailability("ROLE_UNKNOWN", makeRW(0, 0));
    expect(result.projectedActiveGames.median).toBe(0);
    expect(result.projectedRoleGames.median).toBe(0);
  });

  it("role games ceiling is 0", () => {
    const result = computeProjectedAvailability("ROLE_UNKNOWN", makeRW(0, 0));
    expect(result.projectedRoleGames.ceiling).toBe(0);
  });

  it("active games ceiling gives upside possibility", () => {
    const result = computeProjectedAvailability("ROLE_UNKNOWN", makeRW(0, 0));
    expect(result.projectedActiveGames.ceiling).toBeGreaterThan(0);
  });

  it("satisfies all invariants", () => {
    assertValidRange(computeProjectedAvailability("ROLE_UNKNOWN", makeRW(0, 0)));
  });
});

// --------------------------------------------------------------------------
// Edge cases — ceiling cannot exceed 17
// --------------------------------------------------------------------------

describe("ceiling clamp to 17", () => {
  it("does not produce activeGames.ceiling > 17", () => {
    for (const cls of ["ESTABLISHED_PARTIAL_SEASON", "PART_TIME_CONTRIBUTOR", "BACKUP_OR_SPOT_STARTER", "MINIMAL_SAMPLE"] as const) {
      const result = computeProjectedAvailability(cls, makeRW(17, 17));
      expect(result.projectedActiveGames.ceiling).toBeLessThanOrEqual(17);
      expect(result.projectedRoleGames.ceiling).toBeLessThanOrEqual(17);
    }
  });

  it("does not produce any negative value", () => {
    for (const cls of ["ESTABLISHED_PARTIAL_SEASON", "BACKUP_OR_SPOT_STARTER"] as const) {
      const result = computeProjectedAvailability(cls, makeRW(0, 0));
      expect(result.projectedActiveGames.floor).toBeGreaterThanOrEqual(0);
      expect(result.projectedRoleGames.floor).toBeGreaterThanOrEqual(0);
    }
  });
});
