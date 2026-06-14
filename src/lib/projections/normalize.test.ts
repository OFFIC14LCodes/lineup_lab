import { describe, expect, it } from "vitest";
import { normalizePlayerStats, normalizeStatsRow } from "./normalize";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const EMPTY_JSON = {};

const WR_FULL_ROW = {
  rec_tgt: 8,
  rec: 6,
  rec_yd: 74,
  rec_td: 1,
  rush_att: 0,
  rush_yd: 0,
  rush_td: 0,
  pass_att: 0,
  pass_cmp: 0,
  pass_yd: 0,
  pass_td: 0,
  pass_int: 0,
  fum_lost: 0,
  pass_2pt: 0,
  rush_2pt: 0,
  rec_2pt: 0,
};

const QB_FULL_ROW = {
  pass_att: 35,
  pass_cmp: 24,
  pass_yd: 280,
  pass_td: 2,
  pass_int: 1,
  rush_att: 3,
  rush_yd: 12,
  rush_td: 0,
  rec_tgt: 0,
  rec: 0,
  rec_yd: 0,
  rec_td: 0,
  fum_lost: 1,
  pass_2pt: 0,
  rush_2pt: 0,
  rec_2pt: 0,
};

// --------------------------------------------------------------------------
// normalizeStatsRow
// --------------------------------------------------------------------------

describe("normalizeStatsRow", () => {
  it("extracts all stat fields from a full row", () => {
    const result = normalizeStatsRow(WR_FULL_ROW, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.week).toBe(5);
    expect(result.row.targets).toBe(8);
    expect(result.row.receptions).toBe(6);
    expect(result.row.receivingYards).toBe(74);
    expect(result.row.receivingTds).toBe(1);
    expect(result.row.fumblesLost).toBe(0);
    expect(result.row.twoPointConversions).toBe(0);
  });

  it("extracts QB fields correctly", () => {
    const result = normalizeStatsRow(QB_FULL_ROW, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.passAttempts).toBe(35);
    expect(result.row.completions).toBe(24);
    expect(result.row.passingYards).toBe(280);
    expect(result.row.passingTds).toBe(2);
    expect(result.row.interceptions).toBe(1);
    expect(result.row.carries).toBe(3);
    expect(result.row.rushingYards).toBe(12);
    expect(result.row.fumblesLost).toBe(1);
  });

  it("absent keys normalize to zero (not an error)", () => {
    const result = normalizeStatsRow(EMPTY_JSON, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.passAttempts).toBe(0);
    expect(result.row.carries).toBe(0);
    expect(result.row.targets).toBe(0);
    expect(result.row.receivingYards).toBe(0);
    expect(result.row.twoPointConversions).toBe(0);
  });

  it("sums pass_2pt + rush_2pt + rec_2pt for twoPointConversions", () => {
    const result = normalizeStatsRow({ ...WR_FULL_ROW, rec_2pt: 1, rush_2pt: 1 }, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.twoPointConversions).toBe(2);
  });

  it("uses fumRetTd parameter (defaults 0)", () => {
    const r1 = normalizeStatsRow(EMPTY_JSON, 1);
    const r2 = normalizeStatsRow(EMPTY_JSON, 1, 1);
    expect(r1.ok && r1.row.fumRetTd).toBe(0);
    expect(r2.ok && r2.row.fumRetTd).toBe(1);
  });

  it("fails on NaN value", () => {
    const result = normalizeStatsRow({ rec_tgt: NaN }, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes("rec_tgt"))).toBe(true);
  });

  it("fails on Infinity value", () => {
    const result = normalizeStatsRow({ pass_att: Infinity }, 1);
    expect(result.ok).toBe(false);
  });

  it("fails on non-numeric string value", () => {
    const result = normalizeStatsRow({ rush_att: "invalid" }, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes("rush_att"))).toBe(true);
  });

  it("fails on negative passAttempts", () => {
    const result = normalizeStatsRow({ pass_att: -1 }, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes("passAttempts"))).toBe(true);
  });

  it("fails on negative carries", () => {
    const result = normalizeStatsRow({ rush_att: -2 }, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes("carries"))).toBe(true);
  });

  it("fails on negative targets", () => {
    const result = normalizeStatsRow({ rec_tgt: -1 }, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes("targets"))).toBe(true);
  });

  it("fails on negative fumblesLost", () => {
    const result = normalizeStatsRow({ fum_lost: -1 }, 1);
    expect(result.ok).toBe(false);
  });

  it("allows negative receiving yards (e.g. QB sack counted as carry)", () => {
    const result = normalizeStatsRow({ rush_yd: -3 }, 1);
    expect(result.ok).toBe(true);
  });

  it("treats numeric-string values as valid (Number coercion)", () => {
    const result = normalizeStatsRow({ rec_tgt: "5" }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.targets).toBe(5);
  });

  it("reports multiple errors in one pass", () => {
    const result = normalizeStatsRow({ pass_att: NaN, rush_att: Infinity }, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// --------------------------------------------------------------------------
// normalizePlayerStats
// --------------------------------------------------------------------------

describe("normalizePlayerStats", () => {
  it("sorts rows ascending by week", () => {
    const result = normalizePlayerStats([
      { week: 3, statsJson: WR_FULL_ROW },
      { week: 1, statsJson: WR_FULL_ROW },
      { week: 2, statsJson: WR_FULL_ROW },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.rows.map(r => r.week)).toEqual([1, 2, 3]);
  });

  it("returns no duplicate weeks when all weeks are distinct", () => {
    const result = normalizePlayerStats([
      { week: 1, statsJson: WR_FULL_ROW },
      { week: 2, statsJson: WR_FULL_ROW },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.duplicateWeeks).toHaveLength(0);
  });

  it("detects duplicate week numbers and reports count", () => {
    const result = normalizePlayerStats([
      { week: 4, statsJson: WR_FULL_ROW },
      { week: 4, statsJson: { ...WR_FULL_ROW, rec_tgt: 5 } },
      { week: 5, statsJson: WR_FULL_ROW },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.duplicateWeeks).toHaveLength(1);
    expect(result.stats.duplicateWeeks[0]).toEqual({ week: 4, count: 2 });
  });

  it("returns ok:false if any row fails validation", () => {
    const result = normalizePlayerStats([
      { week: 1, statsJson: WR_FULL_ROW },
      { week: 2, statsJson: { pass_att: NaN } },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes("week 2"))).toBe(true);
  });

  it("accumulates errors from multiple bad rows", () => {
    const result = normalizePlayerStats([
      { week: 1, statsJson: { pass_att: NaN } },
      { week: 2, statsJson: { rush_att: -5 } },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty input (no rows)", () => {
    const result = normalizePlayerStats([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.rows).toHaveLength(0);
    expect(result.stats.duplicateWeeks).toHaveLength(0);
  });

  it("carries fumRetTd from raw row into WeeklyStatRow", () => {
    const result = normalizePlayerStats([
      { week: 1, statsJson: EMPTY_JSON, fumRetTd: 1 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.rows[0].fumRetTd).toBe(1);
  });

  it("defaults fumRetTd to 0 when not provided", () => {
    const result = normalizePlayerStats([{ week: 1, statsJson: EMPTY_JSON }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.rows[0].fumRetTd).toBe(0);
  });
});
