import type { FantasyScoringResult } from "@/lib/scoring/types";
import type { ProviderPointComparison } from "@/lib/scoring/server/types";

export const PROVIDER_POINT_COMPARISON_THRESHOLDS = {
  match: 0.01,
  close: 0.5
} as const;

export function compareProviderPoints(args: {
  providerPoints: number | null;
  blackbird: FantasyScoringResult;
  forceIncomplete?: boolean;
  warnings?: string[];
}): ProviderPointComparison | null {
  if (args.providerPoints === null || !Number.isFinite(args.providerPoints)) {
    return null;
  }

  const difference = args.blackbird.totalPoints - args.providerPoints;
  const absoluteDifference = Math.abs(difference);
  const denominator = Math.abs(args.providerPoints);
  const percentDifference = denominator > 0 ? absoluteDifference / denominator : null;

  if (args.forceIncomplete || !args.blackbird.coverage.isComplete) {
    return {
      providerPoints: args.providerPoints,
      blackbirdPoints: args.blackbird.totalPoints,
      difference,
      absoluteDifference,
      percentDifference,
      comparisonStatus: "incomplete_blackbird_coverage",
      warnings: args.warnings?.length
        ? args.warnings
        : ["Blackbird coverage is incomplete for this row, so provider comparison is informational only."]
    };
  }

  const comparisonStatus =
    absoluteDifference <= PROVIDER_POINT_COMPARISON_THRESHOLDS.match
      ? "match"
      : absoluteDifference <= PROVIDER_POINT_COMPARISON_THRESHOLDS.close
        ? "close"
        : "different";

  return {
    providerPoints: args.providerPoints,
    blackbirdPoints: args.blackbird.totalPoints,
    difference,
    absoluteDifference,
    percentDifference,
    comparisonStatus,
    warnings: []
  };
}
