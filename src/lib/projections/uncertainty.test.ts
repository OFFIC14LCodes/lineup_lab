import { describe, expect, it } from "vitest";
import { computeUncertainty } from "./uncertainty";
import type { H8EvidenceEvaluation } from "./h8-evidence";
import type { SeasonOpportunityTotals } from "./role-weeks";
import {
  MODEL_UNCERTAINTY_MIN,
  MODEL_UNCERTAINTY_MAX,
  PLAYER_VOLATILITY_MIN,
  PLAYER_VOLATILITY_MAX,
  TOTAL_RANGE_WIDTH_MIN,
  TOTAL_RANGE_WIDTH_MAX,
} from "./constants";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const ZERO_TOTALS: SeasonOpportunityTotals = {
  totalPassAttempts: 0, totalCarries: 0, totalTargets: 0,
  totalReceptions: 0, totalPassingYards: 0, totalRushingYards: 0,
  totalReceivingYards: 0, totalPassingTds: 0, totalRushingTds: 0,
  totalReceivingTds: 0, totalFumblesLost: 0, totalFumRetTd: 0,
};

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

function makeTotals(overrides: Partial<SeasonOpportunityTotals> = {}): SeasonOpportunityTotals {
  return { ...ZERO_TOTALS, ...overrides };
}

// --------------------------------------------------------------------------
// Model uncertainty
// --------------------------------------------------------------------------

describe("modelUncertainty", () => {
  it("starts at position-specific base value", () => {
    // QB base = 0.14, add 0.06 single-season = 0.20 minimum (before clamp)
    const r = computeUncertainty("QB", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    expect(r.modelUncertainty).toBeGreaterThanOrEqual(MODEL_UNCERTAINTY_MIN);
  });

  it("single season only adds MODEL_UNCERTAINTY_SINGLE_SEASON_ONLY", () => {
    const without = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    const with_ = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, true);
    expect(with_.modelUncertainty).toBeGreaterThan(without.modelUncertainty);
  });

  it("MINIMAL_SAMPLE adds uncertainty vs ESTABLISHED_FULL_SEASON", () => {
    const full = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, true);
    const minimal = computeUncertainty("WR", "MINIMAL_SAMPLE", makeH8(), ZERO_TOTALS, true);
    expect(minimal.modelUncertainty).toBeGreaterThan(full.modelUncertainty);
  });

  it("BACKUP_OR_SPOT_STARTER adds uncertainty", () => {
    const full = computeUncertainty("RB", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, true);
    const backup = computeUncertainty("RB", "BACKUP_OR_SPOT_STARTER", makeH8(), ZERO_TOTALS, true);
    expect(backup.modelUncertainty).toBeGreaterThan(full.modelUncertainty);
  });

  it("ROLE_UNKNOWN adds the least uncertainty of the low classes (base only)", () => {
    const unknown = computeUncertainty("WR", "ROLE_UNKNOWN", makeH8(), ZERO_TOTALS, true);
    const minimal = computeUncertainty("WR", "MINIMAL_SAMPLE", makeH8(), ZERO_TOTALS, true);
    // MINIMAL_SAMPLE adds 0.08, ROLE_UNKNOWN only 0.04
    expect(minimal.modelUncertainty).toBeGreaterThanOrEqual(unknown.modelUncertainty);
  });

  it("applicable unknown H8 fields increase uncertainty (max 2 applied)", () => {
    const none = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableUnknown: 0 }), ZERO_TOTALS, false);
    const two = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableUnknown: 2 }), ZERO_TOTALS, false);
    const ten = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableUnknown: 10 }), ZERO_TOTALS, false);
    expect(two.modelUncertainty).toBeGreaterThan(none.modelUncertainty);
    // 10 unknown fields should equal 2 (capped at 2)
    expect(ten.modelUncertainty).toBeCloseTo(two.modelUncertainty, 4);
  });

  it("applicable observed H8 fields reduce uncertainty", () => {
    const none = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableObserved: 0 }), ZERO_TOTALS, false);
    const two = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableObserved: 2 }), ZERO_TOTALS, false);
    expect(two.modelUncertainty).toBeLessThan(none.modelUncertainty);
  });

  it("stale evidence increases uncertainty", () => {
    const clean = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    const stale = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ hasStale: true }), ZERO_TOTALS, false);
    expect(stale.modelUncertainty).toBeGreaterThan(clean.modelUncertainty);
  });

  it("contradictory evidence increases uncertainty", () => {
    const clean = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    const contr = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ hasContradictory: true }), ZERO_TOTALS, false);
    expect(contr.modelUncertainty).toBeGreaterThan(clean.modelUncertainty);
  });

  it("never exceeds MODEL_UNCERTAINTY_MAX", () => {
    const result = computeUncertainty("TE", "ROLE_UNKNOWN",
      makeH8({ applicableUnknown: 10, hasStale: true, hasContradictory: true }),
      ZERO_TOTALS, true
    );
    expect(result.modelUncertainty).toBeLessThanOrEqual(MODEL_UNCERTAINTY_MAX);
  });

  it("never goes below MODEL_UNCERTAINTY_MIN", () => {
    const result = computeUncertainty("QB", "ESTABLISHED_FULL_SEASON",
      makeH8({ applicableObserved: 10 }),
      ZERO_TOTALS, false
    );
    expect(result.modelUncertainty).toBeGreaterThanOrEqual(MODEL_UNCERTAINTY_MIN);
  });
});

// --------------------------------------------------------------------------
// Player volatility
// --------------------------------------------------------------------------

describe("playerVolatility", () => {
  it("starts at position-specific base", () => {
    const r = computeUncertainty("RB", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    expect(r.playerVolatility).toBeGreaterThanOrEqual(PLAYER_VOLATILITY_MIN);
  });

  it("fumble return TD increases volatility", () => {
    const clean = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    const withFumRetTd = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), makeTotals({ totalFumRetTd: 1 }), false);
    expect(withFumRetTd.playerVolatility).toBeGreaterThan(clean.playerVolatility);
  });

  it("NON_REPEATABLE_MISC_TD reason code emitted when fumRetTd > 0", () => {
    const result = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), makeTotals({ totalFumRetTd: 1 }), false);
    expect(result.reasonCodes).toContain("NON_REPEATABLE_MISC_TD");
  });

  it("H8 applicable observed reduces volatility (ROLE_STABILITY_HIGH)", () => {
    const none = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableObserved: 0 }), ZERO_TOTALS, false);
    const obs = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ applicableObserved: 1 }), ZERO_TOTALS, false);
    expect(obs.playerVolatility).toBeLessThan(none.playerVolatility);
    expect(obs.reasonCodes).toContain("ROLE_STABILITY_HIGH");
  });

  it("never exceeds PLAYER_VOLATILITY_MAX", () => {
    const result = computeUncertainty("RB", "MINIMAL_SAMPLE",
      makeH8(), makeTotals({ totalFumRetTd: 5 }), true
    );
    expect(result.playerVolatility).toBeLessThanOrEqual(PLAYER_VOLATILITY_MAX);
  });

  it("never goes below PLAYER_VOLATILITY_MIN", () => {
    const result = computeUncertainty("QB", "ESTABLISHED_FULL_SEASON",
      makeH8({ applicableObserved: 10 }), ZERO_TOTALS, false
    );
    expect(result.playerVolatility).toBeGreaterThanOrEqual(PLAYER_VOLATILITY_MIN);
  });
});

// --------------------------------------------------------------------------
// Total range width
// --------------------------------------------------------------------------

describe("totalRangeWidth", () => {
  it("equals modelUncertainty + playerVolatility (when within bounds)", () => {
    const result = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    const expected = result.modelUncertainty + result.playerVolatility;
    if (expected >= TOTAL_RANGE_WIDTH_MIN && expected <= TOTAL_RANGE_WIDTH_MAX) {
      expect(result.totalRangeWidth).toBeCloseTo(expected, 4);
    }
  });

  it("never exceeds TOTAL_RANGE_WIDTH_MAX", () => {
    const result = computeUncertainty("TE", "ROLE_UNKNOWN",
      makeH8({ applicableUnknown: 5, hasStale: true, hasContradictory: true }),
      makeTotals({ totalFumRetTd: 2 }),
      true
    );
    expect(result.totalRangeWidth).toBeLessThanOrEqual(TOTAL_RANGE_WIDTH_MAX);
  });

  it("never goes below TOTAL_RANGE_WIDTH_MIN", () => {
    const result = computeUncertainty("QB", "ESTABLISHED_FULL_SEASON",
      makeH8({ applicableObserved: 10 }),
      ZERO_TOTALS, false
    );
    expect(result.totalRangeWidth).toBeGreaterThanOrEqual(TOTAL_RANGE_WIDTH_MIN);
  });
});

// --------------------------------------------------------------------------
// Reason codes
// --------------------------------------------------------------------------

describe("reasonCodes", () => {
  it("includes SINGLE_SEASON_ONLY when isSingleSeasonOnly=true", () => {
    const result = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, true);
    expect(result.reasonCodes).toContain("SINGLE_SEASON_ONLY");
  });

  it("does NOT include SINGLE_SEASON_ONLY when isSingleSeasonOnly=false", () => {
    const result = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8(), ZERO_TOTALS, false);
    expect(result.reasonCodes).not.toContain("SINGLE_SEASON_ONLY");
  });

  it("includes STALE_EVIDENCE when h8.hasStale=true", () => {
    const result = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ hasStale: true }), ZERO_TOTALS, false);
    expect(result.reasonCodes).toContain("STALE_EVIDENCE");
  });

  it("includes CONTRADICTORY_EVIDENCE when h8.hasContradictory=true", () => {
    const result = computeUncertainty("WR", "ESTABLISHED_FULL_SEASON", makeH8({ hasContradictory: true }), ZERO_TOTALS, false);
    expect(result.reasonCodes).toContain("CONTRADICTORY_EVIDENCE");
  });
});
