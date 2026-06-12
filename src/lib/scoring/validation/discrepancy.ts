import { classifyScoringKeyImpact } from "@/lib/scoring/validation/constants";
import type { CohortValidationSummary, RowValidationResult } from "@/lib/scoring/validation/types";
import type { AnonymizedDiscrepantRow, DiscrepancyInvestigation } from "@/lib/scoring/validation/live-evidence";

export const DISCREPANCY_THRESHOLDS = {
  minFullyCoveredRows: 5,
  minDifferentRows: 3,
  meanAbsDifferenceThreshold: 0.5,
  maxAbsDifferenceThreshold: 2.0,
  maxRepresentativeSamples: 5
} as const;

export function buildDiscrepancyInvestigations(input: {
  leagueLabel: string;
  cohorts: CohortValidationSummary[];
  rows: RowValidationResult[];
  providerLabels: Map<string, string>;
}): DiscrepancyInvestigation[] {
  const { leagueLabel, cohorts, rows, providerLabels } = input;
  const investigations: DiscrepancyInvestigation[] = [];

  for (const cohort of cohorts) {
    const cohortRows = rows.filter(
      (row) =>
        row.provider === cohort.provider &&
        row.sourceType === cohort.sourceType &&
        (row.positionGroup ?? "UNKNOWN") === (cohort.positionGroup ?? "UNKNOWN") &&
        (row.projectionType ?? "none") === (cohort.projectionType ?? "none")
    );

    const fullyCoveredRows = cohortRows.filter(
      (row) => row.providerComparison !== null && row.scoringResult.blackbird.coverage.isComplete
    );

    if (fullyCoveredRows.length < DISCREPANCY_THRESHOLDS.minFullyCoveredRows) {
      continue;
    }

    const differentRows = fullyCoveredRows.filter(
      (row) => row.providerComparison?.comparisonStatus === "different"
    );

    const absDifferences = fullyCoveredRows.map((row) => row.providerComparison?.absoluteDifference ?? 0);
    const meanAbsDiff = absDifferences.length > 0 ? average(absDifferences) : null;
    const maxAbsDiff = absDifferences.length > 0 ? Math.max(...absDifferences) : null;

    const triggerReasons: string[] = [];

    if (differentRows.length >= DISCREPANCY_THRESHOLDS.minDifferentRows) {
      triggerReasons.push(`${differentRows.length} fully-covered rows have comparison status "different"`);
    }
    if (meanAbsDiff !== null && meanAbsDiff > DISCREPANCY_THRESHOLDS.meanAbsDifferenceThreshold) {
      triggerReasons.push(
        `Mean absolute difference ${meanAbsDiff.toFixed(3)} exceeds threshold ${DISCREPANCY_THRESHOLDS.meanAbsDifferenceThreshold}`
      );
    }
    if (maxAbsDiff !== null && maxAbsDiff > DISCREPANCY_THRESHOLDS.maxAbsDifferenceThreshold) {
      triggerReasons.push(
        `Maximum absolute difference ${maxAbsDiff.toFixed(3)} exceeds threshold ${DISCREPANCY_THRESHOLDS.maxAbsDifferenceThreshold}`
      );
    }

    if (triggerReasons.length === 0) {
      continue;
    }

    const likelyCauses = inferLikelyCauses(cohortRows);
    const providerLabel = providerLabels.get(String(cohort.provider)) ?? String(cohort.provider);

    const representativeSamples: AnonymizedDiscrepantRow[] = [...differentRows]
      .sort(
        (a, b) =>
          (b.providerComparison?.absoluteDifference ?? 0) - (a.providerComparison?.absoluteDifference ?? 0)
      )
      .slice(0, DISCREPANCY_THRESHOLDS.maxRepresentativeSamples)
      .map((row, i) => ({
        rowLabel: `Row ${i + 1}`,
        blackbirdPoints: row.blackbirdPoints,
        providerPoints: row.providerComparison?.providerPoints ?? null,
        difference: row.providerComparison?.difference ?? null,
        comparisonStatus: row.providerComparison?.comparisonStatus ?? null,
        coverageRatio: row.coverageRatio,
        isComplete: row.scoringResult.blackbird.coverage.isComplete
      }));

    investigations.push({
      leagueLabel,
      cohortKey: cohort.cohortKey,
      providerLabel,
      positionGroup: cohort.positionGroup as string | null,
      sourceType: cohort.sourceType,
      triggerReasons,
      fullyCoveredRowCount: fullyCoveredRows.length,
      differentStatusCount: differentRows.length,
      meanAbsoluteDifference: meanAbsDiff,
      maximumAbsoluteDifference: maxAbsDiff,
      likelyCauses,
      representativeSamples
    });
  }

  return investigations;
}

function inferLikelyCauses(rows: RowValidationResult[]): string[] {
  const causes: string[] = [];

  const hasUnsupportedKeys = rows.some(
    (row) => row.scoringResult.blackbird.coverage.unsupportedScoringKeys.length > 0
  );
  if (hasUnsupportedKeys) {
    causes.push(
      "Provider total may incorporate scoring keys not yet supported by Blackbird (different or additional settings)."
    );
  }

  const hasMissingCore = rows.some((row) =>
    row.scoringResult.blackbird.coverage.missingStatsForSupportedKeys.some((item) => {
      const impact = classifyScoringKeyImpact(item.scoringKey);
      return impact === "core" || impact === "material";
    })
  );
  if (hasMissingCore) {
    causes.push(
      "Missing core or material raw stats suggest the provider's raw export may be structured differently than expected."
    );
  }

  const hasAliasAmbiguity = rows.some(
    (row) => row.scoringResult.blackbird.coverage.ambiguousStatAliases.length > 0
  );
  if (hasAliasAmbiguity) {
    causes.push("Stat alias ambiguity may resolve to an incorrect canonical stat, producing different component totals.");
  }

  const hasIncomplete = rows.some((row) => !row.scoringResult.blackbird.coverage.isComplete);
  if (hasIncomplete) {
    causes.push(
      "Some rows have incomplete Blackbird coverage; provider total may reflect a more complete calculation."
    );
  }

  if (causes.length === 0) {
    causes.push(
      "Provider fantasy points may be generic (not computed from this league's specific scoring settings).",
      "Rounding differences may accumulate across many scoring components.",
      "Provider raw stats and provider fantasy point total may originate from different update snapshots."
    );
  }

  return causes;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
