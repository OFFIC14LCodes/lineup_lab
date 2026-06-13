import { describe, expect, it } from "vitest";

import { compareProviderPoints } from "@/lib/scoring/server/compare-provider-points";
import type { FantasyScoringResult } from "@/lib/scoring/types";

function makeBlackbird(totalPoints: number, isComplete = true): FantasyScoringResult {
  return {
    totalPoints,
    components: [],
    coverage: {
      supportedScoringKeys: [],
      unsupportedScoringKeys: [],
      missingStatsForSupportedKeys: [],
      unusedStatKeys: [],
      ambiguousStatAliases: [],
      notApplicableScoringKeys: [],
      activeScoringKeys: [],
      evaluatedScoringKeys: [],
      coverageRatio: isComplete ? 1 : 0.5,
      isComplete
    },
    warnings: [],
    positionGroup: "WR",
    formulaVersion: "blackbird-scoring-v1"
  };
}

describe("compareProviderPoints", () => {
  it("classifies exact and threshold-boundary matches", () => {
    expect(compareProviderPoints({ providerPoints: 10, blackbird: makeBlackbird(10) })?.comparisonStatus).toBe("match");
    expect(compareProviderPoints({ providerPoints: 10, blackbird: makeBlackbird(10.01) })?.comparisonStatus).toBe("match");
  });

  it("classifies close and different boundaries", () => {
    expect(compareProviderPoints({ providerPoints: 10, blackbird: makeBlackbird(10.01001) })?.comparisonStatus).toBe("close");
    expect(compareProviderPoints({ providerPoints: 10, blackbird: makeBlackbird(10.5) })?.comparisonStatus).toBe("close");
    expect(compareProviderPoints({ providerPoints: 10, blackbird: makeBlackbird(10.50001) })?.comparisonStatus).toBe("different");
  });

  it("handles negative differences symmetrically", () => {
    const result = compareProviderPoints({ providerPoints: 10, blackbird: makeBlackbird(9.49) });
    expect(result?.difference).toBeCloseTo(-0.51);
    expect(result?.comparisonStatus).toBe("different");
  });

  it("returns null for null or non-finite provider totals", () => {
    expect(compareProviderPoints({ providerPoints: null, blackbird: makeBlackbird(10) })).toBeNull();
    expect(compareProviderPoints({ providerPoints: Number.NaN, blackbird: makeBlackbird(10) })).toBeNull();
    expect(compareProviderPoints({ providerPoints: Number.POSITIVE_INFINITY, blackbird: makeBlackbird(10) })).toBeNull();
  });

  it("marks incomplete coverage as excluded from classified comparisons", () => {
    expect(
      compareProviderPoints({
        providerPoints: 10,
        blackbird: makeBlackbird(10.25, false)
      })?.comparisonStatus
    ).toBe("incomplete_blackbird_coverage");
  });
});
