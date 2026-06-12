import { BLACKBIRD_SCORING_READINESS_VERSION, READINESS_THRESHOLDS } from "@/lib/scoring/validation/constants";
import type {
  CohortValidationSummary,
  LeagueReadinessResult,
  ReadinessReason,
  ReadinessScoreBreakdownItem,
  RowValidationError,
  RowValidationResult,
  ScoringReadinessDecision
} from "@/lib/scoring/validation/types";

export function evaluateOverallRecommendationReadiness(input: {
  leagueReadiness: LeagueReadinessResult;
  rows: RowValidationResult[];
  rowErrors: RowValidationError[];
  cohorts: CohortValidationSummary[];
  formulaVersion: string;
}): ScoringReadinessDecision {
  const successfulRows = input.rows.length;
  const totalRows = successfulRows + input.rowErrors.length;
  const eligibleRows = input.rows.filter((row) => row.readiness.eligibleForRecommendationExperiment).length;
  const eligibleRatio = successfulRows > 0 ? eligibleRows / successfulRows : 0;
  const averageCoverage = successfulRows > 0 ? average(input.rows.map((row) => row.coverageRatio)) : 0;
  const minimumCoverage = successfulRows > 0 ? Math.min(...input.rows.map((row) => row.coverageRatio)) : 0;
  const errorRate = totalRows > 0 ? input.rowErrors.length / totalRows : 0;
  const unsupportedCoreSeen = input.rows.some((row) =>
    row.scoringResult.blackbird.coverage.unsupportedScoringKeys.some((key) => input.leagueReadiness.highImpactUnsupportedKeys.includes(key))
  );
  const aggregateWeeklyBlock = input.rows.some(
    (row) =>
      row.sourceType === "projections" &&
      row.projectionType !== "weekly" &&
      row.readiness.eligibleForRecommendationExperiment
  );

  const reasons: ReadinessReason[] = [];
  const warnings: string[] = [];
  const failedRules: string[] = [];
  const passedRules: string[] = [];
  const scoreBreakdown: ReadinessScoreBreakdownItem[] = [];

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        eligibleRatio * 55 +
          averageCoverage * 25 +
          minimumCoverage * 10 +
          Math.max(0, 1 - errorRate) * 10
      )
    )
  );

  if (successfulRows < READINESS_THRESHOLDS.overallConditionalMinRows) {
    failedRules.push("minimum_sample_size");
  } else {
    passedRules.push("minimum_sample_size");
  }

  if (input.leagueReadiness.status === "not_ready" || input.leagueReadiness.status === "insufficient_data") {
    failedRules.push("league_readiness_threshold");
    reasons.push({
      code: "LEAGUE_READINESS_BLOCK",
      message: "League readiness is not sufficient for recommendation-readiness validation.",
      severity: "blocking"
    });
  } else {
    passedRules.push("league_readiness_threshold");
  }

  if (unsupportedCoreSeen || input.leagueReadiness.highImpactUnsupportedKeys.length > 0) {
    failedRules.push("unsupported_core_keys");
    reasons.push({
      code: "UNSUPPORTED_CORE_KEYS",
      message: "Unsupported core, material, or unknown-impact keys are present in the validated sample.",
      severity: "blocking",
      scoringKeys: input.leagueReadiness.highImpactUnsupportedKeys
    });
  } else {
    passedRules.push("unsupported_core_keys");
  }

  if (aggregateWeeklyBlock) {
    warnings.push("Aggregate projection cohorts are excluded from weekly recommendation readiness.");
  }

  const status =
    successfulRows < READINESS_THRESHOLDS.overallConditionalMinRows
      ? "insufficient_data"
      : input.leagueReadiness.status === "not_ready" || input.leagueReadiness.status === "insufficient_data"
        ? "not_ready"
        : unsupportedCoreSeen || input.leagueReadiness.highImpactUnsupportedKeys.length > 0
          ? "not_ready"
          : successfulRows >= READINESS_THRESHOLDS.overallReadyMinRows &&
              eligibleRatio >= READINESS_THRESHOLDS.overallReadyEligibleRatio &&
              averageCoverage >= READINESS_THRESHOLDS.overallReadyAverageCoverage &&
              minimumCoverage >= READINESS_THRESHOLDS.overallReadyMinimumCoverage &&
              errorRate <= READINESS_THRESHOLDS.overallMaxErrorRate
            ? "ready"
            : eligibleRatio >= READINESS_THRESHOLDS.overallConditionalEligibleRatio &&
                averageCoverage >= READINESS_THRESHOLDS.overallConditionalAverageCoverage &&
                minimumCoverage >= READINESS_THRESHOLDS.overallConditionalMinimumCoverage
              ? "conditionally_ready"
              : "not_ready";

  return {
    status,
    eligibleForRecommendationExperiment: status === "ready",
    eligibleExperimentScope: status === "ready" ? "weekly_recommendation" : "none",
    score,
    reasons,
    warnings,
    failedRules,
    passedRules,
    scoreBreakdown: [
      ...scoreBreakdown,
      {
        code: "OVERALL_SCORE",
        label: "Overall readiness composite score",
        points: score,
        kind: "base"
      }
    ],
    formulaVersion: input.formulaVersion,
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
