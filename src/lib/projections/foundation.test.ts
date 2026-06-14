import { describe, expect, it } from "vitest";
import { buildRoleProjectionFoundation } from "./foundation";
import type { HistoricalPlayerProjectionInput, WeeklyStatRow } from "./types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const UNKNOWN_SNAP = {
  value: null as null,
  status: "unknown" as const,
  confidence: "unresolved" as const,
  sourceEvidenceIds: [] as string[],
};

const NEUTRAL_H8: HistoricalPlayerProjectionInput["h8Fields"] = {
  priorTargetShare: UNKNOWN_SNAP,
  priorCarryShare: UNKNOWN_SNAP,
  priorRedZoneShare: UNKNOWN_SNAP,
  priorGoalLineShare: UNKNOWN_SNAP,
  priorTeamPassRate: UNKNOWN_SNAP,
  priorTeamRushRate: UNKNOWN_SNAP,
  priorEarlyDownPassRate: UNKNOWN_SNAP,
};

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

function makeInput(
  position: HistoricalPlayerProjectionInput["position"],
  rows: WeeklyStatRow[],
  overrides: Partial<HistoricalPlayerProjectionInput> = {}
): HistoricalPlayerProjectionInput {
  return {
    canonicalPlayerId: "00000000-0000-0000-0000-000000000001",
    position,
    historicalSeason: 2025,
    projectionSeason: 2026,
    weeklyStats: rows,
    h8SnapshotId: null,
    h8Fields: NEUTRAL_H8,
    compatibleAdpRecords: [],
    ...overrides,
  };
}

// --- Representative player archetypes ---

// WR1: 16 active weeks, 100 targets — ESTABLISHED_FULL_SEASON
const WR1_ROWS = Array.from({ length: 16 }, (_, i) =>
  makeRow(i + 1, { targets: 6, receptions: 4, receivingYards: 60, receivingTds: i === 2 ? 1 : 0 })
);

// RB2: 8 active weeks, 70 carries — ESTABLISHED_PARTIAL_SEASON
const RB2_ROWS = Array.from({ length: 8 }, (_, i) =>
  makeRow(i + 1, { carries: 9, rushingYards: 40 })
);

// WR3: 6 active weeks, 18 targets — PART_TIME_CONTRIBUTOR
const WR3_ROWS = Array.from({ length: 6 }, (_, i) =>
  makeRow(i + 1, { targets: 3, receptions: 2, receivingYards: 20 })
);

// TE4: 3 active weeks, 1 role week, 3 total targets — MINIMAL_SAMPLE
// (totalTargets=3 < TE_MIN_SIGNIFICANT_TARGETS=4, but has 1 role week → MINIMAL_SAMPLE)
const TE4_ROWS = [
  makeRow(1, { targets: 2 }),  // role week (>= TE_ROLE_WEEK_MIN_TARGETS=2)
  makeRow(2, { targets: 1 }),  // not a role week
  makeRow(3, { targets: 0 }),  // not a role week
];

// QB5: 0 role weeks — ROLE_UNKNOWN
const QB5_ROWS = Array.from({ length: 4 }, (_, i) =>
  makeRow(i + 1, { passAttempts: 3, completions: 2 })
);

// --------------------------------------------------------------------------
// Output contract
// --------------------------------------------------------------------------

describe("foundation output contract", () => {
  it("returns all required fields", () => {
    const result = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS));
    expect(result).toHaveProperty("canonicalPlayerId");
    expect(result).toHaveProperty("position");
    expect(result).toHaveProperty("historicalActiveWeeks");
    expect(result).toHaveProperty("historicalRoleWeeks");
    expect(result).toHaveProperty("roleWeekNumbers");
    expect(result).toHaveProperty("nonRoleWeekNumbers");
    expect(result).toHaveProperty("roleParticipationFactor");
    expect(result).toHaveProperty("totals");
    expect(result).toHaveProperty("roleSampleClass");
    expect(result).toHaveProperty("roleSampleConfidence");
    expect(result).toHaveProperty("classificationInputs");
    expect(result).toHaveProperty("projectedAvailability");
    expect(result).toHaveProperty("h8Evaluation");
    expect(result).toHaveProperty("projectionConfidence");
    expect(result).toHaveProperty("modelUncertainty");
    expect(result).toHaveProperty("playerVolatility");
    expect(result).toHaveProperty("totalRangeWidth");
    expect(result).toHaveProperty("allReasonCodes");
  });
});

// --------------------------------------------------------------------------
// WR1 — ESTABLISHED_FULL_SEASON
// --------------------------------------------------------------------------

describe("WR1 — ESTABLISHED_FULL_SEASON", () => {
  const r = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS));

  it("classifies as ESTABLISHED_FULL_SEASON", () => {
    expect(r.roleSampleClass).toBe("ESTABLISHED_FULL_SEASON");
  });

  it("historicalActiveWeeks = 16", () => {
    expect(r.historicalActiveWeeks).toBe(16);
  });

  it("all role weeks (targets >= 2 every week)", () => {
    expect(r.historicalRoleWeeks).toBe(16);
    expect(r.nonRoleWeekNumbers).toHaveLength(0);
  });

  it("active games uses fixed full-season constants", () => {
    expect(r.projectedAvailability.projectedActiveGames.floor).toBe(12);
    expect(r.projectedAvailability.projectedActiveGames.median).toBe(15);
    expect(r.projectedAvailability.projectedActiveGames.ceiling).toBe(17);
  });

  it("games confidence is high", () => {
    expect(r.projectedAvailability.gamesConfidence).toBe("high");
  });

  it("roleParticipationFactor is 1.0", () => {
    expect(r.roleParticipationFactor).toBeCloseTo(1.0);
  });

  it("totalTargets in totals = 96 (16 * 6)", () => {
    expect(r.totals.totalTargets).toBe(96);
  });
});

// --------------------------------------------------------------------------
// RB2 — ESTABLISHED_PARTIAL_SEASON
// --------------------------------------------------------------------------

describe("RB2 — ESTABLISHED_PARTIAL_SEASON", () => {
  const r = buildRoleProjectionFoundation(makeInput("RB", RB2_ROWS));

  it("classifies as ESTABLISHED_PARTIAL_SEASON", () => {
    expect(r.roleSampleClass).toBe("ESTABLISHED_PARTIAL_SEASON");
  });

  it("active games median = 8 (historicalActiveWeeks)", () => {
    expect(r.projectedAvailability.projectedActiveGames.median).toBe(8);
  });

  it("games confidence is medium", () => {
    expect(r.projectedAvailability.gamesConfidence).toBe("medium");
  });
});

// --------------------------------------------------------------------------
// WR3 — PART_TIME_CONTRIBUTOR
// --------------------------------------------------------------------------

describe("WR3 — PART_TIME_CONTRIBUTOR", () => {
  const r = buildRoleProjectionFoundation(makeInput("WR", WR3_ROWS));

  it("classifies as PART_TIME_CONTRIBUTOR", () => {
    expect(r.roleSampleClass).toBe("PART_TIME_CONTRIBUTOR");
  });

  it("all 6 weeks are role weeks (targets >= 2)", () => {
    expect(r.historicalRoleWeeks).toBe(6);
  });
});

// --------------------------------------------------------------------------
// TE4 — MINIMAL_SAMPLE
// --------------------------------------------------------------------------

describe("TE4 — MINIMAL_SAMPLE", () => {
  const r = buildRoleProjectionFoundation(makeInput("TE", TE4_ROWS));

  it("classifies as MINIMAL_SAMPLE", () => {
    expect(r.roleSampleClass).toBe("MINIMAL_SAMPLE");
  });

  it("gamesConfidence is very_low", () => {
    expect(r.projectedAvailability.gamesConfidence).toBe("very_low");
  });

  it("role games floor is 0", () => {
    expect(r.projectedAvailability.projectedRoleGames.floor).toBe(0);
  });
});

// --------------------------------------------------------------------------
// QB5 — ROLE_UNKNOWN
// --------------------------------------------------------------------------

describe("QB5 — ROLE_UNKNOWN", () => {
  const r = buildRoleProjectionFoundation(makeInput("QB", QB5_ROWS));

  it("classifies as ROLE_UNKNOWN", () => {
    expect(r.roleSampleClass).toBe("ROLE_UNKNOWN");
  });

  it("roleSampleConfidence is very_low", () => {
    expect(r.roleSampleConfidence).toBe("very_low");
  });

  it("role games median is 0", () => {
    expect(r.projectedAvailability.projectedRoleGames.median).toBe(0);
  });
});

// --------------------------------------------------------------------------
// H8 evidence — observed field effect
// --------------------------------------------------------------------------

describe("H8 evidence effect", () => {
  it("observed priorTargetShare for WR increases applicableObserved", () => {
    const input = makeInput("WR", WR1_ROWS, {
      h8Fields: {
        ...NEUTRAL_H8,
        priorTargetShare: { value: 0.18, status: "observed", confidence: "high", sourceEvidenceIds: ["ev-1"] },
      },
    });
    const r = buildRoleProjectionFoundation(input);
    expect(r.h8Evaluation.applicableObserved).toBe(1);
  });

  it("observed field reduces player volatility vs all-unknown", () => {
    const clean = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS));
    const withH8 = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS, {
      h8Fields: {
        ...NEUTRAL_H8,
        priorTargetShare: { value: 0.20, status: "observed", confidence: "high", sourceEvidenceIds: [] },
      },
    }));
    expect(withH8.playerVolatility).toBeLessThanOrEqual(clean.playerVolatility);
  });
});

// --------------------------------------------------------------------------
// Invariants
// --------------------------------------------------------------------------

describe("invariants", () => {
  it("projectedRoleGames <= projectedActiveGames at all levels for WR1", () => {
    const r = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS));
    const ag = r.projectedAvailability.projectedActiveGames;
    const rg = r.projectedAvailability.projectedRoleGames;
    expect(rg.floor).toBeLessThanOrEqual(ag.floor);
    expect(rg.median).toBeLessThanOrEqual(ag.median);
    expect(rg.ceiling).toBeLessThanOrEqual(ag.ceiling);
  });

  it("totalRangeWidth is within [0.20, 0.80]", () => {
    for (const rows of [WR1_ROWS, RB2_ROWS, WR3_ROWS, TE4_ROWS, QB5_ROWS]) {
      const pos = rows === QB5_ROWS ? "QB" : rows === RB2_ROWS ? "RB" : rows === TE4_ROWS ? "TE" : "WR";
      const r = buildRoleProjectionFoundation(makeInput(pos, rows));
      expect(r.totalRangeWidth).toBeGreaterThanOrEqual(0.20);
      expect(r.totalRangeWidth).toBeLessThanOrEqual(0.80);
    }
  });

  it("modelUncertainty and playerVolatility are both within [0.08, 0.48]", () => {
    const r = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS));
    expect(r.modelUncertainty).toBeGreaterThanOrEqual(0.08);
    expect(r.modelUncertainty).toBeLessThanOrEqual(0.48);
    expect(r.playerVolatility).toBeGreaterThanOrEqual(0.08);
    expect(r.playerVolatility).toBeLessThanOrEqual(0.48);
  });

  it("projectionConfidenceScore is within [0.05, 0.95]", () => {
    const r = buildRoleProjectionFoundation(makeInput("WR", WR1_ROWS));
    expect(r.projectionConfidence.projectionConfidenceScore).toBeGreaterThanOrEqual(0.05);
    expect(r.projectionConfidence.projectionConfidenceScore).toBeLessThanOrEqual(0.95);
  });

  it("h8Evaluation contains exactly 7 field evaluations", () => {
    const r = buildRoleProjectionFoundation(makeInput("RB", RB2_ROWS));
    expect(r.h8Evaluation.fieldEvaluations).toHaveLength(7);
  });

  it("empty weeklyStats produces ROLE_UNKNOWN with 0 active weeks", () => {
    const r = buildRoleProjectionFoundation(makeInput("WR", []));
    expect(r.roleSampleClass).toBe("ROLE_UNKNOWN");
    expect(r.historicalActiveWeeks).toBe(0);
    expect(r.historicalRoleWeeks).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Identity passthrough
// --------------------------------------------------------------------------

describe("identity passthrough", () => {
  it("canonicalPlayerId from input is preserved in output", () => {
    const input = makeInput("WR", WR1_ROWS, {
      canonicalPlayerId: "player-abc-123",
    });
    expect(buildRoleProjectionFoundation(input).canonicalPlayerId).toBe("player-abc-123");
  });

  it("position from input is preserved", () => {
    expect(buildRoleProjectionFoundation(makeInput("TE", TE4_ROWS)).position).toBe("TE");
  });

  it("historicalSeason from input is preserved", () => {
    const input = makeInput("WR", WR1_ROWS, { historicalSeason: 2024 });
    expect(buildRoleProjectionFoundation(input).historicalSeason).toBe(2024);
  });
});
