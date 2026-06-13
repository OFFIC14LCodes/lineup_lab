import { describe, expect, it } from "vitest";

import { chooseValidationWeeks, fetchAllPages, summarizeCounts } from "@/lib/scoring/validation/live-validation-utils";

describe("fetchAllPages", () => {
  it("collects more than 1,000 rows without truncating inventory", async () => {
    const rows = Array.from({ length: 1800 }, (_, index) => ({ id: index + 1 }));
    const result = await fetchAllPages(async (offset, limit) => rows.slice(offset, offset + limit), 1000);
    expect(result).toHaveLength(1800);
    expect(result[0]?.id).toBe(1);
    expect(result[1799]?.id).toBe(1800);
  });
});

describe("chooseValidationWeeks", () => {
  it("discovers all 18 weeks and prefers representative checkpoints", () => {
    const allWeeks = Array.from({ length: 18 }, (_, index) => index + 1);
    expect(chooseValidationWeeks(allWeeks)).toEqual([1, 6, 12, 18]);
  });

  it("uses an explicit requested week when provided", () => {
    expect(chooseValidationWeeks([1, 2, 3, 4], { explicitWeek: 3 })).toEqual([3]);
  });

  it("returns an empty set when the explicit requested week is unavailable", () => {
    expect(chooseValidationWeeks([1, 2, 3, 4], { explicitWeek: 8 })).toEqual([]);
  });
});

describe("summarizeCounts", () => {
  it("produces deterministic frequency ordering for position cohorts", () => {
    expect(summarizeCounts(["WR", "QB", "WR", "RB", "QB"])).toEqual([
      { key: "QB", count: 2 },
      { key: "WR", count: 2 },
      { key: "RB", count: 1 }
    ]);
  });
});
