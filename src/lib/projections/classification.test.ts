import { describe, expect, it } from "vitest";
import { classifyRoleSample } from "./classification";
import type { RoleWeekResult } from "./role-weeks";

// --------------------------------------------------------------------------
// Fixture builder
// --------------------------------------------------------------------------

function makeRW(overrides: Partial<RoleWeekResult> = {}): RoleWeekResult {
  return {
    historicalActiveWeeks: 0,
    historicalRoleWeeks: 0,
    roleWeekNumbers: [],
    nonRoleWeekNumbers: [],
    roleParticipationFactor: 0,
    totals: {
      totalPassAttempts: 0,
      totalCarries: 0,
      totalTargets: 0,
      totalReceptions: 0,
      totalPassingYards: 0,
      totalRushingYards: 0,
      totalReceivingYards: 0,
      totalPassingTds: 0,
      totalRushingTds: 0,
      totalReceivingTds: 0,
      totalFumblesLost: 0,
      totalFumRetTd: 0,
    },
    ...overrides,
  };
}

function makeTotals(overrides: Partial<RoleWeekResult["totals"]> = {}): RoleWeekResult["totals"] {
  return {
    totalPassAttempts: 0,
    totalCarries: 0,
    totalTargets: 0,
    totalReceptions: 0,
    totalPassingYards: 0,
    totalRushingYards: 0,
    totalReceivingYards: 0,
    totalPassingTds: 0,
    totalRushingTds: 0,
    totalReceivingTds: 0,
    totalFumblesLost: 0,
    totalFumRetTd: 0,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// QB classification
// --------------------------------------------------------------------------

describe("QB classification", () => {
  it("ESTABLISHED_FULL_SEASON: >= 14 weeks and >= 300 attempts", () => {
    const result = classifyRoleSample("QB", makeRW({
      historicalActiveWeeks: 15,
      historicalRoleWeeks: 15,
      totals: makeTotals({ totalPassAttempts: 350 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_FULL_SEASON");
    expect(result.roleSampleConfidence).toBe("high");
  });

  it("ESTABLISHED_PARTIAL_SEASON: >= 8 weeks and >= 100 attempts", () => {
    const result = classifyRoleSample("QB", makeRW({
      historicalActiveWeeks: 10,
      historicalRoleWeeks: 9,
      totals: makeTotals({ totalPassAttempts: 130 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_PARTIAL_SEASON");
  });

  it("PART_TIME_CONTRIBUTOR: >= 50 attempts but below partial season", () => {
    const result = classifyRoleSample("QB", makeRW({
      historicalActiveWeeks: 5,
      historicalRoleWeeks: 4,
      totals: makeTotals({ totalPassAttempts: 65 }),
    }));
    expect(result.roleSampleClass).toBe("PART_TIME_CONTRIBUTOR");
  });

  it("BACKUP_OR_SPOT_STARTER: >= 20 attempts and > 0 role weeks", () => {
    const result = classifyRoleSample("QB", makeRW({
      historicalActiveWeeks: 6,
      historicalRoleWeeks: 2,
      totals: makeTotals({ totalPassAttempts: 35 }),
    }));
    expect(result.roleSampleClass).toBe("BACKUP_OR_SPOT_STARTER");
  });

  it("MINIMAL_SAMPLE: has role weeks but < 20 attempts", () => {
    const result = classifyRoleSample("QB", makeRW({
      historicalActiveWeeks: 2,
      historicalRoleWeeks: 1,
      totals: makeTotals({ totalPassAttempts: 10 }),
    }));
    expect(result.roleSampleClass).toBe("MINIMAL_SAMPLE");
  });

  it("ROLE_UNKNOWN: zero role weeks", () => {
    const result = classifyRoleSample("QB", makeRW({
      historicalActiveWeeks: 3,
      historicalRoleWeeks: 0,
      totals: makeTotals({ totalPassAttempts: 5 }),
    }));
    expect(result.roleSampleClass).toBe("ROLE_UNKNOWN");
    expect(result.roleSampleConfidence).toBe("very_low");
  });

  it("ROLE_UNKNOWN for empty data", () => {
    expect(classifyRoleSample("QB", makeRW()).roleSampleClass).toBe("ROLE_UNKNOWN");
  });
});

// --------------------------------------------------------------------------
// RB classification
// --------------------------------------------------------------------------

describe("RB classification", () => {
  it("ESTABLISHED_FULL_SEASON: >= 14 weeks and >= 150 carries", () => {
    const result = classifyRoleSample("RB", makeRW({
      historicalActiveWeeks: 14,
      historicalRoleWeeks: 14,
      totals: makeTotals({ totalCarries: 180, totalTargets: 40 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_FULL_SEASON");
  });

  it("ESTABLISHED_FULL_SEASON: >= 14 weeks and >= 60 targets (pass-catching RB)", () => {
    const result = classifyRoleSample("RB", makeRW({
      historicalActiveWeeks: 15,
      historicalRoleWeeks: 14,
      totals: makeTotals({ totalCarries: 80, totalTargets: 70 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_FULL_SEASON");
  });

  it("ESTABLISHED_PARTIAL_SEASON: >= 8 weeks and >= 60 carries", () => {
    const result = classifyRoleSample("RB", makeRW({
      historicalActiveWeeks: 9,
      historicalRoleWeeks: 8,
      totals: makeTotals({ totalCarries: 72, totalTargets: 15 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_PARTIAL_SEASON");
  });

  it("PART_TIME_CONTRIBUTOR: >= 25 carries", () => {
    const result = classifyRoleSample("RB", makeRW({
      historicalActiveWeeks: 6,
      historicalRoleWeeks: 4,
      totals: makeTotals({ totalCarries: 30, totalTargets: 5 }),
    }));
    expect(result.roleSampleClass).toBe("PART_TIME_CONTRIBUTOR");
  });

  it("BACKUP_OR_SPOT_STARTER: >= 8 carries and > 0 role weeks", () => {
    const result = classifyRoleSample("RB", makeRW({
      historicalActiveWeeks: 4,
      historicalRoleWeeks: 2,
      totals: makeTotals({ totalCarries: 12, totalTargets: 3 }),
    }));
    expect(result.roleSampleClass).toBe("BACKUP_OR_SPOT_STARTER");
  });

  it("ROLE_UNKNOWN for empty input", () => {
    expect(classifyRoleSample("RB", makeRW()).roleSampleClass).toBe("ROLE_UNKNOWN");
  });
});

// --------------------------------------------------------------------------
// WR classification
// --------------------------------------------------------------------------

describe("WR classification", () => {
  it("ESTABLISHED_FULL_SEASON: >= 14 weeks and >= 80 targets", () => {
    const result = classifyRoleSample("WR", makeRW({
      historicalActiveWeeks: 16,
      historicalRoleWeeks: 15,
      totals: makeTotals({ totalTargets: 110 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_FULL_SEASON");
    expect(result.roleSampleConfidence).toBe("high");
  });

  it("ESTABLISHED_PARTIAL_SEASON: >= 8 weeks and >= 30 targets", () => {
    const result = classifyRoleSample("WR", makeRW({
      historicalActiveWeeks: 9,
      historicalRoleWeeks: 8,
      totals: makeTotals({ totalTargets: 45 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_PARTIAL_SEASON");
    expect(result.roleSampleConfidence).toBe("medium");
  });

  it("PART_TIME_CONTRIBUTOR: >= 15 targets", () => {
    const result = classifyRoleSample("WR", makeRW({
      historicalActiveWeeks: 8,
      historicalRoleWeeks: 6,
      totals: makeTotals({ totalTargets: 22 }),
    }));
    expect(result.roleSampleClass).toBe("PART_TIME_CONTRIBUTOR");
  });

  it("BACKUP_OR_SPOT_STARTER: >= 5 targets and > 0 role weeks", () => {
    const result = classifyRoleSample("WR", makeRW({
      historicalActiveWeeks: 4,
      historicalRoleWeeks: 2,
      totals: makeTotals({ totalTargets: 8 }),
    }));
    expect(result.roleSampleClass).toBe("BACKUP_OR_SPOT_STARTER");
    expect(result.roleSampleConfidence).toBe("low");
  });

  it("MINIMAL_SAMPLE: has role weeks but < 5 significant targets", () => {
    const result = classifyRoleSample("WR", makeRW({
      historicalActiveWeeks: 3,
      historicalRoleWeeks: 2,
      totals: makeTotals({ totalTargets: 4 }),
    }));
    expect(result.roleSampleClass).toBe("MINIMAL_SAMPLE");
    expect(result.roleSampleConfidence).toBe("very_low");
  });
});

// --------------------------------------------------------------------------
// TE classification
// --------------------------------------------------------------------------

describe("TE classification", () => {
  it("ESTABLISHED_FULL_SEASON: >= 14 weeks and >= 50 targets", () => {
    const result = classifyRoleSample("TE", makeRW({
      historicalActiveWeeks: 15,
      historicalRoleWeeks: 14,
      totals: makeTotals({ totalTargets: 60 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_FULL_SEASON");
  });

  it("ESTABLISHED_PARTIAL_SEASON: >= 8 weeks and >= 20 targets", () => {
    const result = classifyRoleSample("TE", makeRW({
      historicalActiveWeeks: 10,
      historicalRoleWeeks: 9,
      totals: makeTotals({ totalTargets: 28 }),
    }));
    expect(result.roleSampleClass).toBe("ESTABLISHED_PARTIAL_SEASON");
  });

  it("PART_TIME_CONTRIBUTOR: >= 10 targets", () => {
    const result = classifyRoleSample("TE", makeRW({
      historicalActiveWeeks: 7,
      historicalRoleWeeks: 5,
      totals: makeTotals({ totalTargets: 14 }),
    }));
    expect(result.roleSampleClass).toBe("PART_TIME_CONTRIBUTOR");
  });

  it("ROLE_UNKNOWN for empty input", () => {
    expect(classifyRoleSample("TE", makeRW()).roleSampleClass).toBe("ROLE_UNKNOWN");
  });
});

// --------------------------------------------------------------------------
// classificationInputs for diagnostics
// --------------------------------------------------------------------------

describe("classificationInputs", () => {
  it("exposes the inputs used for classification", () => {
    const rw = makeRW({
      historicalActiveWeeks: 10,
      historicalRoleWeeks: 8,
      roleParticipationFactor: 0.8,
      totals: makeTotals({ totalTargets: 55 }),
    });
    const result = classifyRoleSample("WR", rw);
    expect(result.classificationInputs.historicalActiveWeeks).toBe(10);
    expect(result.classificationInputs.historicalRoleWeeks).toBe(8);
    expect(result.classificationInputs.totalTargets).toBe(55);
    expect(result.classificationInputs.roleParticipationFactor).toBeCloseTo(0.8);
  });
});
