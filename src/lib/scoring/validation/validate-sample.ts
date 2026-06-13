import { buildCohortValidationSummaries } from "@/lib/scoring/validation/cohort-summary";
import { evaluateLeagueScoringReadiness } from "@/lib/scoring/validation/league-readiness";
import { evaluateOverallRecommendationReadiness } from "@/lib/scoring/validation/recommendations";
import { toRowValidationResult } from "@/lib/scoring/validation/row-readiness";
import { BLACKBIRD_SCORING_READINESS_VERSION } from "@/lib/scoring/validation/constants";
import type {
  LeagueScoringValidationReport,
  RowValidationError,
  RowValidationResult,
  ValidateScoringSampleInput
} from "@/lib/scoring/validation/types";

export function validateLeagueScoringSample(input: ValidateScoringSampleInput): LeagueScoringValidationReport {
  const leagueReadiness = evaluateLeagueScoringReadiness({
    league: input.league,
    positionGroup: input.request.positionGroup
  });

  const rows: RowValidationResult[] = [];
  const rowErrors: RowValidationError[] = [];

  for (const item of input.results) {
    if (!item.ok) {
      rowErrors.push({
        rowId: item.error.rowId,
        error: item.error,
        readiness: {
          status: "insufficient_data",
          scoringValidationStatus: "insufficient_data",
          eligibleForRecommendationExperiment: false,
          eligibleExperimentScope: "none",
          recommendationExperimentEligibility: {
            eligible: false,
            scope: "none"
          },
          score: 0,
          reasons: [
            {
              code: "ROW_SCORING_ERROR",
              message: item.error.message,
              severity: "blocking"
            }
          ],
          warnings: [],
          failedRules: ["row_scored_successfully"],
          passedRules: [],
          scoreBreakdown: [
            {
              code: "ROW_ERROR",
              label: "Row scoring error",
              points: 0,
              kind: "base"
            }
          ],
          formulaVersion: input.league.formulaVersion,
          readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION
        }
      });
      continue;
    }

    rows.push(
      toRowValidationResult({
        result: item.result,
        sourceType: input.request.sourceType,
        leagueReadiness,
        now: input.now
      })
    );
  }

  const cohorts = buildCohortValidationSummaries(rows);
  const overallRecommendationReadiness = evaluateOverallRecommendationReadiness({
    leagueReadiness,
    rows,
    rowErrors,
    cohorts,
    formulaVersion: input.league.formulaVersion
  });

  const warnings: string[] = [];
  if (rowErrors.length > 0) {
    warnings.push(`${rowErrors.length} row(s) could not be scored and were classified as insufficient data.`);
  }
  if (cohorts.some((cohort) => cohort.sampleSufficiency === "insufficient")) {
    warnings.push("One or more cohorts have fewer than 5 rows and should be treated as descriptive only.");
  }

  return {
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION,
    scoringFormulaVersion: input.league.formulaVersion,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    league: {
      leagueId: input.league.leagueId,
      leagueName: input.league.leagueName,
      season: input.league.season,
      formulaVersion: input.league.formulaVersion
    },
    request: input.request,
    sample: {
      requestedLimit: input.request.limit,
      returnedRows: input.results.length,
      successfullyScoredRows: rows.length,
      erroredRows: rowErrors.length
    },
    leagueReadiness,
    rows: [...rows, ...rowErrors].sort((a, b) => a.rowId.localeCompare(b.rowId)),
    cohorts,
    overallRecommendationReadiness,
    warnings
  };
}
