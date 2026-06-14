import { describe, expect, it } from "vitest";
import { computeRoleWeeks } from "./role-weeks";
import type { WeeklyStatRow } from "./types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function makeRow(week: number, overrides: Partial<WeeklyStatRow> = {}): WeeklyStatRow {
  return {
    week,
    passAttempts: 0,
    completions: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    carries: 0,
    rushingYards: 0,
    rushingTds: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
    fumRetTd: 0,
    twoPointConversions: 0,
    fumblesLost: 0,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// historicalActiveWeeks
// --------------------------------------------------------------------------

describe("historicalActiveWeeks", () => {
  it("counts distinct week numbers — not rows", () => {
    // Two rows for week 1 (duplicate) + row for week 2 = 2 distinct weeks
    const rows = [makeRow(1), makeRow(1, { targets: 3 }), makeRow(2)];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.historicalActiveWeeks).toBe(2);
  });

  it("is 0 for an empty array", () => {
    expect(computeRoleWeeks([], "WR").historicalActiveWeeks).toBe(0);
  });

  it("is 1 when there is only one row", () => {
    expect(computeRoleWeeks([makeRow(3)], "WR").historicalActiveWeeks).toBe(1);
  });

  it("counts 17 distinct weeks when all weeks 1-17 are present", () => {
    const rows = Array.from({ length: 17 }, (_, i) => makeRow(i + 1));
    expect(computeRoleWeeks(rows, "WR").historicalActiveWeeks).toBe(17);
  });
});

// --------------------------------------------------------------------------
// QB role-week thresholds
// --------------------------------------------------------------------------

describe("QB role weeks", () => {
  it("qualifies on pass attempts >= 10", () => {
    const result = computeRoleWeeks([makeRow(1, { passAttempts: 10 })], "QB");
    expect(result.historicalRoleWeeks).toBe(1);
  });

  it("does not qualify on pass attempts = 9", () => {
    const result = computeRoleWeeks([makeRow(1, { passAttempts: 9 })], "QB");
    expect(result.historicalRoleWeeks).toBe(0);
  });

  it("qualifies on carries >= 4 (mobile QB)", () => {
    const result = computeRoleWeeks([makeRow(1, { carries: 4 })], "QB");
    expect(result.historicalRoleWeeks).toBe(1);
  });

  it("does not qualify on carries = 3 and passAttempts = 0", () => {
    const result = computeRoleWeeks([makeRow(1, { carries: 3 })], "QB");
    expect(result.historicalRoleWeeks).toBe(0);
  });

  it("qualifies when both thresholds are met in a single week (counts once)", () => {
    const result = computeRoleWeeks([makeRow(1, { passAttempts: 25, carries: 4 })], "QB");
    expect(result.historicalRoleWeeks).toBe(1);
  });
});

// --------------------------------------------------------------------------
// RB role-week thresholds
// --------------------------------------------------------------------------

describe("RB role weeks", () => {
  it("qualifies on carries >= 4", () => {
    const result = computeRoleWeeks([makeRow(1, { carries: 4 })], "RB");
    expect(result.historicalRoleWeeks).toBe(1);
  });

  it("qualifies on targets >= 2", () => {
    const result = computeRoleWeeks([makeRow(1, { targets: 2 })], "RB");
    expect(result.historicalRoleWeeks).toBe(1);
  });

  it("does not qualify on carries=3 targets=1", () => {
    const result = computeRoleWeeks([makeRow(1, { carries: 3, targets: 1 })], "RB");
    expect(result.historicalRoleWeeks).toBe(0);
  });
});

// --------------------------------------------------------------------------
// WR role-week thresholds
// --------------------------------------------------------------------------

describe("WR role weeks", () => {
  it("qualifies on targets >= 2", () => {
    const result = computeRoleWeeks([makeRow(1, { targets: 2 })], "WR");
    expect(result.historicalRoleWeeks).toBe(1);
  });

  it("does not qualify on targets = 1", () => {
    const result = computeRoleWeeks([makeRow(1, { targets: 1 })], "WR");
    expect(result.historicalRoleWeeks).toBe(0);
  });

  it("does not qualify on high carries but zero targets (position-specific)", () => {
    const result = computeRoleWeeks([makeRow(1, { carries: 10 })], "WR");
    expect(result.historicalRoleWeeks).toBe(0);
  });
});

// --------------------------------------------------------------------------
// TE role-week thresholds
// --------------------------------------------------------------------------

describe("TE role weeks", () => {
  it("qualifies on targets >= 2", () => {
    const result = computeRoleWeeks([makeRow(1, { targets: 2 })], "TE");
    expect(result.historicalRoleWeeks).toBe(1);
  });

  it("does not qualify on targets = 1", () => {
    const result = computeRoleWeeks([makeRow(1, { targets: 1 })], "TE");
    expect(result.historicalRoleWeeks).toBe(0);
  });
});

// --------------------------------------------------------------------------
// roleParticipationFactor
// --------------------------------------------------------------------------

describe("roleParticipationFactor", () => {
  it("is 0 when both activeWeeks and roleWeeks are 0", () => {
    expect(computeRoleWeeks([], "WR").roleParticipationFactor).toBe(0);
  });

  it("is 1.0 when all active weeks are role weeks", () => {
    const rows = [
      makeRow(1, { targets: 5 }),
      makeRow(2, { targets: 6 }),
      makeRow(3, { targets: 3 }),
    ];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.roleParticipationFactor).toBeCloseTo(1.0);
  });

  it("is 0.5 when half of active weeks are role weeks", () => {
    const rows = [
      makeRow(1, { targets: 3 }),
      makeRow(2, { targets: 1 }),   // below threshold
    ];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.roleParticipationFactor).toBeCloseTo(0.5);
  });

  it("is 0 when active weeks > 0 but no role weeks", () => {
    const rows = [makeRow(1), makeRow(2)];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.roleParticipationFactor).toBe(0);
  });
});

// --------------------------------------------------------------------------
// roleWeekNumbers and nonRoleWeekNumbers
// --------------------------------------------------------------------------

describe("roleWeekNumbers / nonRoleWeekNumbers", () => {
  it("correctly partitions weeks into role and non-role sets", () => {
    const rows = [
      makeRow(1, { targets: 5 }),  // role
      makeRow(2, { targets: 1 }),  // non-role
      makeRow(3, { targets: 3 }),  // role
      makeRow(4),                   // non-role
    ];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.roleWeekNumbers).toEqual([1, 3]);
    expect(result.nonRoleWeekNumbers).toEqual([2, 4]);
  });

  it("returns sorted arrays regardless of row insertion order", () => {
    const rows = [makeRow(5, { targets: 3 }), makeRow(2, { targets: 4 }), makeRow(1)];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.roleWeekNumbers).toEqual([2, 5]);
    expect(result.nonRoleWeekNumbers).toEqual([1]);
  });

  it("when a week has one role row and one non-role row (duplicate), classifies as role", () => {
    const rows = [
      makeRow(1, { targets: 5 }),  // role
      makeRow(1, { targets: 0 }),  // non-role (same week)
    ];
    const result = computeRoleWeeks(rows, "WR");
    expect(result.roleWeekNumbers).toContain(1);
    expect(result.nonRoleWeekNumbers).not.toContain(1);
  });
});

// --------------------------------------------------------------------------
// Season opportunity totals
// --------------------------------------------------------------------------

describe("totals", () => {
  it("sums all numeric fields across rows", () => {
    const rows = [
      makeRow(1, { passAttempts: 30, passingTds: 2, carries: 3, targets: 5, receivingYards: 60, fumblesLost: 1 }),
      makeRow(2, { passAttempts: 25, passingTds: 1, carries: 2, targets: 4, receivingYards: 40 }),
    ];
    const result = computeRoleWeeks(rows, "QB");
    expect(result.totals.totalPassAttempts).toBe(55);
    expect(result.totals.totalPassingTds).toBe(3);
    expect(result.totals.totalCarries).toBe(5);
    expect(result.totals.totalTargets).toBe(9);
    expect(result.totals.totalReceivingYards).toBe(100);
    expect(result.totals.totalFumblesLost).toBe(1);
  });

  it("returns all-zero totals for empty input", () => {
    const result = computeRoleWeeks([], "RB");
    expect(result.totals.totalCarries).toBe(0);
    expect(result.totals.totalTargets).toBe(0);
    expect(result.totals.totalReceivingTds).toBe(0);
  });
});
