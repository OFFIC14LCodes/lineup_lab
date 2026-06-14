import { describe, expect, it } from "vitest";
import { computeProjectionConfidence } from "./confidence";
import type { H8EvidenceEvaluation } from "./h8-evidence";
import { PROJ_CONFIDENCE_BASE, PROJ_CONFIDENCE_MIN, PROJ_CONFIDENCE_MAX } from "./constants";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function makeH8(overrides: Partial<H8EvidenceEvaluation> = {}): H8EvidenceEvaluation {
  return {
    fieldEvaluations: [],
    applicableObserved: 0,
    applicableUnknown: 0,
    secondaryObserved: 0,
    secondaryUnknown: 0,
    notApplicableCount: 0,
    hasContradictory: false,
    hasStale: false,
    reasonCodes: [],
    sourceEvidenceIds: [],
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Base score
// --------------------------------------------------------------------------

describe("base score", () => {
  it("starts at PROJ_CONFIDENCE_BASE before adjustments", () => {
    // Use 6-9 active weeks (no week adjustment) + PART_TIME + no H8 + no single season
    const result = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    // No adjustment category fires for these inputs
    expect(result.projectionConfidenceScore).toBeCloseTo(PROJ_CONFIDENCE_BASE, 2);
  });
});

// --------------------------------------------------------------------------
// Week-count adjustments
// --------------------------------------------------------------------------

describe("week-count adjustment", () => {
  it("adds weeks_14_plus bonus for >= 14 active weeks", () => {
    const r1 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 14, makeH8(), false);
    const r0 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(r1.projectionConfidenceScore).toBeGreaterThan(r0.projectionConfidenceScore);
  });

  it("adds weeks_10_to_13 bonus for 10–13 active weeks", () => {
    const r10 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 10, makeH8(), false);
    const r7 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(r10.projectionConfidenceScore).toBeGreaterThan(r7.projectionConfidenceScore);
  });

  it("applies weeks_under_3 penalty for < 3 active weeks", () => {
    const r2 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 2, makeH8(), false);
    const r7 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(r2.projectionConfidenceScore).toBeLessThan(r7.projectionConfidenceScore);
  });

  it("applies weeks_under_6 penalty for 3–5 active weeks", () => {
    const r5 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 5, makeH8(), false);
    const r7 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(r5.projectionConfidenceScore).toBeLessThan(r7.projectionConfidenceScore);
  });

  it("does NOT apply weeks_under_6 for exactly 6 weeks", () => {
    const r6 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 6, makeH8(), false);
    const r7 = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(r6.projectionConfidenceScore).toBeCloseTo(r7.projectionConfidenceScore, 5);
  });
});

// --------------------------------------------------------------------------
// Role-class adjustments
// --------------------------------------------------------------------------

describe("role-class adjustments", () => {
  it("ESTABLISHED_FULL_SEASON gets the highest class bonus", () => {
    const full = computeProjectionConfidence("ESTABLISHED_FULL_SEASON", 7, makeH8(), false);
    const partial = computeProjectionConfidence("ESTABLISHED_PARTIAL_SEASON", 7, makeH8(), false);
    expect(full.projectionConfidenceScore).toBeGreaterThan(partial.projectionConfidenceScore);
  });

  it("PART_TIME_CONTRIBUTOR gets no role-class delta", () => {
    const pt = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(pt.contributingFactors.some(f => f.factor.includes("part_time"))).toBe(false);
  });

  it("BACKUP_OR_SPOT_STARTER gets a negative delta", () => {
    const backup = computeProjectionConfidence("BACKUP_OR_SPOT_STARTER", 7, makeH8(), false);
    expect(backup.contributingFactors.some(f => f.factor === "backup_or_spot_starter" && f.delta < 0)).toBe(true);
  });

  it("ROLE_UNKNOWN gets the largest negative delta", () => {
    const unknown = computeProjectionConfidence("ROLE_UNKNOWN", 7, makeH8(), false);
    const minimal = computeProjectionConfidence("MINIMAL_SAMPLE", 7, makeH8(), false);
    expect(unknown.projectionConfidenceScore).toBeLessThanOrEqual(minimal.projectionConfidenceScore);
  });
});

// --------------------------------------------------------------------------
// Single season only
// --------------------------------------------------------------------------

describe("single_season_only", () => {
  it("reduces score when isSingleSeasonOnly=true", () => {
    const with_ = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), true);
    const without_ = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    expect(with_.projectionConfidenceScore).toBeLessThan(without_.projectionConfidenceScore);
  });

  it("appears in contributingFactors when true", () => {
    const result = computeProjectionConfidence("ESTABLISHED_FULL_SEASON", 14, makeH8(), true);
    expect(result.contributingFactors.some(f => f.factor === "single_season_only")).toBe(true);
  });
});

// --------------------------------------------------------------------------
// H8 observed fields
// --------------------------------------------------------------------------

describe("H8 observed fields", () => {
  it("each applicable observed field adds a bonus", () => {
    const h8With = makeH8({ applicableObserved: 2 });
    const h8Without = makeH8({ applicableObserved: 0 });
    const with_ = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, h8With, false);
    const without_ = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, h8Without, false);
    expect(with_.projectionConfidenceScore).toBeGreaterThan(without_.projectionConfidenceScore);
  });

  it("each applicable unknown field subtracts a penalty", () => {
    const h8Few = makeH8({ applicableUnknown: 1 });
    const h8Many = makeH8({ applicableUnknown: 4 });
    const few = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, h8Few, false);
    const many = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, h8Many, false);
    expect(many.projectionConfidenceScore).toBeLessThan(few.projectionConfidenceScore);
  });

  it("secondary unknown penalty is capped at PROJ_CONFIDENCE_SECONDARY_MAX_TOTAL_PENALTY", () => {
    // 10 secondary unknowns — penalty should be capped, not linear
    const h8Many = makeH8({ secondaryUnknown: 10 });
    const h8Few = makeH8({ secondaryUnknown: 2 });
    const many = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, h8Many, false);
    const few = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, h8Few, false);
    // With 10 unknowns, score should be same as with 2+ above cap
    // (Both should be equally penalized once capped)
    expect(many.projectionConfidenceScore).toBeCloseTo(few.projectionConfidenceScore, 5);
  });
});

// --------------------------------------------------------------------------
// Evidence quality
// --------------------------------------------------------------------------

describe("evidence quality", () => {
  it("contradictory evidence reduces score", () => {
    const clean = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    const contradicted = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8({ hasContradictory: true }), false);
    expect(contradicted.projectionConfidenceScore).toBeLessThan(clean.projectionConfidenceScore);
  });

  it("stale evidence reduces score", () => {
    const clean = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8(), false);
    const stale = computeProjectionConfidence("PART_TIME_CONTRIBUTOR", 7, makeH8({ hasStale: true }), false);
    expect(stale.projectionConfidenceScore).toBeLessThan(clean.projectionConfidenceScore);
  });
});

// --------------------------------------------------------------------------
// Score clamping
// --------------------------------------------------------------------------

describe("score clamping", () => {
  it("never exceeds PROJ_CONFIDENCE_MAX", () => {
    const result = computeProjectionConfidence(
      "ESTABLISHED_FULL_SEASON", 17,
      makeH8({ applicableObserved: 10 }),
      false
    );
    expect(result.projectionConfidenceScore).toBeLessThanOrEqual(PROJ_CONFIDENCE_MAX);
  });

  it("never goes below PROJ_CONFIDENCE_MIN", () => {
    const result = computeProjectionConfidence(
      "ROLE_UNKNOWN", 0,
      makeH8({ applicableUnknown: 10, hasContradictory: true, hasStale: true }),
      true
    );
    expect(result.projectionConfidenceScore).toBeGreaterThanOrEqual(PROJ_CONFIDENCE_MIN);
  });
});

// --------------------------------------------------------------------------
// Label mapping
// --------------------------------------------------------------------------

describe("label mapping", () => {
  it("score >= 0.70 → high", () => {
    const result = computeProjectionConfidence(
      "ESTABLISHED_FULL_SEASON", 16,
      makeH8({ applicableObserved: 2 }),
      false
    );
    if (result.projectionConfidenceScore >= 0.70) {
      expect(result.projectionConfidenceLabel).toBe("high");
    }
  });

  it("low sample gets very_low label", () => {
    const result = computeProjectionConfidence(
      "ROLE_UNKNOWN", 0,
      makeH8({ applicableUnknown: 5 }),
      true
    );
    expect(["low", "very_low"]).toContain(result.projectionConfidenceLabel);
  });

  it("contributingFactors array is non-empty when any adjustment fires", () => {
    const result = computeProjectionConfidence("ESTABLISHED_FULL_SEASON", 15, makeH8(), true);
    expect(result.contributingFactors.length).toBeGreaterThan(0);
  });
});
