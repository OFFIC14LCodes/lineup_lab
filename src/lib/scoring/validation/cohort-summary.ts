import type { ProviderPointComparison } from "@/lib/scoring/server/types";
import { BLACKBIRD_SCORING_READINESS_VERSION, getSampleSufficiencyLabel } from "@/lib/scoring/validation/constants";
import type {
  CohortValidationSummary,
  ProviderComparisonDistribution,
  ReadinessScoreBreakdownItem,
  RowValidationResult,
  ScoringReadinessDecision
} from "@/lib/scoring/validation/types";

export function buildCohortValidationSummaries(rows: RowValidationResult[]): CohortValidationSummary[] {
  const groups = new Map<string, RowValidationResult[]>();

  for (const row of rows) {
    const key = [
      row.provider,
      row.sourceType,
      row.positionGroup ?? "UNKNOWN",
      row.projectionType ?? "none"
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([cohortKey, groupRows]) => summarizeCohort(cohortKey, groupRows))
    .sort((a, b) => a.cohortKey.localeCompare(b.cohortKey));
}

function summarizeCohort(cohortKey: string, rows: RowValidationResult[]): CohortValidationSummary {
  const readyCount = rows.filter((row) => row.readiness.status === "ready").length;
  const conditionallyReadyCount = rows.filter((row) => row.readiness.status === "conditionally_ready").length;
  const notReadyCount = rows.filter((row) => row.readiness.status === "not_ready").length;
  const insufficientDataCount = rows.filter((row) => row.readiness.status === "insufficient_data").length;
  const eligibleCount = rows.filter((row) => row.readiness.eligibleForRecommendationExperiment).length;
  const eligiblePercentage = rows.length > 0 ? eligibleCount / rows.length : 0;
  const coverageValues = rows.map((row) => row.coverageRatio);
  const averageCoverageRatio = coverageValues.length > 0 ? sum(coverageValues) / coverageValues.length : 0;
  const minimumCoverageRatio = coverageValues.length > 0 ? Math.min(...coverageValues) : 0;
  const unsupportedKeyFrequency = toSortedFrequency(
    rows.flatMap((row) => row.scoringResult.blackbird.coverage.unsupportedScoringKeys)
  ).map(([key, count]) => ({ key, count }));
  const missingStatFrequency = toSortedFrequency(
    rows.flatMap((row) => row.scoringResult.blackbird.coverage.missingStatsForSupportedKeys.flatMap((item) => item.requiredStats))
  ).map(([statKey, count]) => ({ statKey, count }));
  const aliasAmbiguityCount = rows.filter((row) => row.scoringResult.blackbird.coverage.ambiguousStatAliases.length > 0).length;
  const positionWarningCount = rows.filter((row) =>
    row.scoringResult.contextWarnings.some((warning) => warning.code.startsWith("POSITION_"))
  ).length;
  const providerComparison = summarizeProviderComparisons(rows.map((row) => row.providerComparison));

  const warnings: string[] = [];
  if (getSampleSufficiencyLabel(rows.length) === "insufficient") {
    warnings.push("Fewer than 5 rows were available for this cohort.");
  }
  if (providerComparison.differentCount > 0 && providerComparison.incompleteCoverageCount === 0) {
    warnings.push("One or more fully covered rows differ materially from provider totals.");
  }

  return {
    cohortKey,
    provider: rows[0]?.provider ?? "mixed",
    sourceType: rows[0]?.sourceType ?? "weekly_stats",
    positionGroup: uniqueOrMixed(rows.map((row) => row.positionGroup)) as CohortValidationSummary["positionGroup"],
    projectionType: uniqueOrMixed(rows.map((row) => row.projectionType)) as CohortValidationSummary["projectionType"],
    sampleSize: rows.length,
    sampleSufficiency: getSampleSufficiencyLabel(rows.length),
    readyCount,
    conditionallyReadyCount,
    notReadyCount,
    insufficientDataCount,
    eligibleCount,
    eligiblePercentage,
    averageCoverageRatio,
    minimumCoverageRatio,
    unsupportedKeyFrequency,
    missingStatFrequency,
    aliasAmbiguityCount,
    positionWarningCount,
    providerComparison,
    warnings,
    readiness: buildCohortReadinessDecision({
      rows,
      eligiblePercentage,
      averageCoverageRatio,
      minimumCoverageRatio,
      warnings
    })
  };
}

function buildCohortReadinessDecision(input: {
  rows: RowValidationResult[];
  eligiblePercentage: number;
  averageCoverageRatio: number;
  minimumCoverageRatio: number;
  warnings: string[];
}): ScoringReadinessDecision {
  const sourceType = input.rows[0]?.sourceType ?? "weekly_stats";
  const projectionType = input.rows[0]?.projectionType ?? null;
  const readyRows = input.rows.filter((row) => row.readiness.status === "ready").length;
  const conditionalRows = input.rows.filter((row) => row.readiness.status === "conditionally_ready").length;
  const notReadyRows = input.rows.filter((row) => row.readiness.status === "not_ready").length;
  const insufficientRows = input.rows.filter((row) => row.readiness.status === "insufficient_data").length;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(input.eligiblePercentage * 60 + input.averageCoverageRatio * 30 + input.minimumCoverageRatio * 10)
    )
  );

  const status =
    input.rows.length < 5
      ? "insufficient_data"
      : notReadyRows > 0
        ? "not_ready"
        : readyRows === input.rows.length && input.minimumCoverageRatio >= 0.95
          ? "ready"
          : readyRows + conditionalRows === input.rows.length
            ? "conditionally_ready"
            : insufficientRows === input.rows.length
              ? "insufficient_data"
              : "not_ready";

  const eligibleForRecommendationExperiment =
    sourceType !== "weekly_stats" &&
    status === "ready" &&
    input.eligiblePercentage >= 0.95 &&
    (sourceType !== "projections" || projectionType === "weekly");
  const eligibleExperimentScope =
    eligibleForRecommendationExperiment && sourceType === "projections"
      ? "weekly_projection_experiment"
      : "none";

  return {
    status,
    scoringValidationStatus: status,
    eligibleForRecommendationExperiment,
    eligibleExperimentScope,
    recommendationExperimentEligibility: {
      eligible: eligibleForRecommendationExperiment,
      scope: eligibleExperimentScope
    },
    score,
    reasons: [],
    warnings: input.warnings,
    failedRules: status === "ready" ? [] : ["cohort_thresholds"],
    passedRules: status === "ready" ? ["cohort_thresholds"] : [],
    scoreBreakdown: [
      {
        code: "COHORT_SCORE",
        label: "Cohort readiness composite score",
        points: score,
        kind: "base"
      } satisfies ReadinessScoreBreakdownItem
    ],
    formulaVersion: input.rows[0]?.scoringResult.blackbird.formulaVersion ?? "unknown",
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION
  };
}

export function summarizeProviderComparisons(comparisons: Array<ProviderPointComparison | null>): ProviderComparisonDistribution {
  const present = comparisons.filter((comparison): comparison is ProviderPointComparison => comparison !== null);
  const total = comparisons.length;
  const classified = present.filter((comparison) => comparison.comparisonStatus !== "incomplete_blackbird_coverage");
  const absoluteDifferences = classified.map((comparison) => comparison.absoluteDifference).sort((a, b) => a - b);
  const signedDifferences = classified.map((comparison) => comparison.difference);

  const matchCount = classified.filter((comparison) => comparison.comparisonStatus === "match").length;
  const closeCount = classified.filter((comparison) => comparison.comparisonStatus === "close").length;
  const differentCount = classified.filter((comparison) => comparison.comparisonStatus === "different").length;
  const incompleteCoverageCount = present.length - classified.length;

  return {
    withProviderTotals: present.length,
    classifiedCount: classified.length,
    excludedCount: incompleteCoverageCount,
    withoutProviderTotals: total - present.length,
    matchCount,
    closeCount,
    differentCount,
    incompleteCoverageCount,
    meanSignedDifference: classified.length > 0 ? sum(signedDifferences) / classified.length : null,
    meanAbsoluteDifference: classified.length > 0 ? sum(absoluteDifferences) / classified.length : null,
    medianAbsoluteDifference: classified.length > 0 ? median(absoluteDifferences) : null,
    maximumAbsoluteDifference: classified.length > 0 ? Math.max(...absoluteDifferences) : null,
    percentageWithProviderTotals: total > 0 ? present.length / total : 0,
    percentageMatch: classified.length > 0 ? matchCount / classified.length : 0,
    percentageClose: classified.length > 0 ? closeCount / classified.length : 0,
    percentageDifferent: classified.length > 0 ? differentCount / classified.length : 0
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[middle];
  }
  return (values[middle - 1] + values[middle]) / 2;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function uniqueOrMixed<T>(values: T[]) {
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : ("mixed" as const);
}

function toSortedFrequency(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => {
    const countOrder = b[1] - a[1];
    if (countOrder !== 0) return countOrder;
    return a[0].localeCompare(b[0]);
  });
}
