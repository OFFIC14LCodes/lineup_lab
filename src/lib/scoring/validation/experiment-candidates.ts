import { classifyScoringKeyImpact, READINESS_THRESHOLDS } from "@/lib/scoring/validation/constants";
import type { CohortValidationSummary } from "@/lib/scoring/validation/types";
import type { BlockedCohort, ExperimentCandidate } from "@/lib/scoring/validation/live-evidence";

export const F4_EXPERIMENT_THRESHOLDS = {
  weeklyProjection: {
    minSampleSize: 20,
    minEligibilityRatio: 0.95,
    minAverageCoverage: 0.99,
    minMinimumCoverage: 0.95,
    maxErrorRate: 0.05
  }
} as const;

type AnnotatedCohort = {
  leagueLabel: string;
  providerLabel: string;
  cohort: CohortValidationSummary;
  errorRate: number;
};

export function extractExperimentCandidates(input: { cohorts: AnnotatedCohort[] }): {
  candidates: ExperimentCandidate[];
  blocked: BlockedCohort[];
} {
  const candidates: ExperimentCandidate[] = [];
  const blocked: BlockedCohort[] = [];

  for (const { leagueLabel, providerLabel, cohort, errorRate } of input.cohorts) {
    const posGroup = cohort.positionGroup as string | null;
    const projType = cohort.projectionType as string | null;

    if (cohort.sourceType === "weekly_stats") {
      // Weekly actuals validate scoring accuracy but are not projection recommendation sources.
      // Two independent reasons are reported separately so each is actionable on its own.
      const scoringBlocked = cohort.readiness.status === "not_ready" || cohort.readiness.status === "insufficient_data";
      const blockReasons: string[] = [];
      if (scoringBlocked) {
        blockReasons.push(
          `Scoring validation is blocked: applicable scoring coverage is incomplete (readiness: ${cohort.readiness.status}).`
        );
      }
      blockReasons.push(
        "Recommendation experiments are separately prohibited for weekly actuals: they represent historical outcomes, not future player projections."
      );
      blocked.push({
        leagueLabel,
        sourceType: cohort.sourceType,
        providerLabel,
        positionGroup: posGroup,
        projectionType: projType,
        status: cohort.readiness.status,
        blockReasons
      });
      continue;
    }

    if (cohort.sourceType === "projections" && cohort.projectionType === "weekly") {
      const blockReasons = checkWeeklyProjectionGates({ cohort, errorRate });
      if (blockReasons.length === 0) {
        candidates.push(buildCandidate({ leagueLabel, providerLabel, cohort, scope: "weekly_projection_experiment" }));
      } else {
        blocked.push({ leagueLabel, sourceType: cohort.sourceType, providerLabel, positionGroup: posGroup, projectionType: projType, status: cohort.readiness.status, blockReasons });
      }
      continue;
    }

    if (
      cohort.sourceType === "projections" &&
      (cohort.projectionType === "season" || cohort.projectionType === "rest_of_season")
    ) {
      const blockReasons = checkSeasonRosGates(cohort);
      if (blockReasons.length === 0) {
        candidates.push(buildCandidate({ leagueLabel, providerLabel, cohort, scope: "season_value_experiment" }));
      } else {
        blocked.push({ leagueLabel, sourceType: cohort.sourceType, providerLabel, positionGroup: posGroup, projectionType: projType, status: cohort.readiness.status, blockReasons });
      }
      continue;
    }

    if (cohort.sourceType === "season_stats") {
      const blockReasons: string[] = [];
      if (cohort.sampleSize < READINESS_THRESHOLDS.overallConditionalMinRows) {
        blockReasons.push(
          `Sample size ${cohort.sampleSize} is below minimum ${READINESS_THRESHOLDS.overallConditionalMinRows}.`
        );
      }
      if (cohort.readiness.status === "not_ready" || cohort.readiness.status === "insufficient_data") {
        blockReasons.push(`Readiness is ${cohort.readiness.status}.`);
      }
      blocked.push({
        leagueLabel,
        sourceType: cohort.sourceType,
        providerLabel,
        positionGroup: posGroup,
        projectionType: projType,
        status: cohort.readiness.status,
        blockReasons:
          blockReasons.length > 0
            ? blockReasons
            : [
                "Season stats qualify only for historical_season_analysis experiments, not weekly recommendation or projection experiments."
              ]
      });
      continue;
    }

    // Preseason or unknown projection type
    blocked.push({
      leagueLabel,
      sourceType: cohort.sourceType,
      providerLabel,
      positionGroup: posGroup,
      projectionType: projType,
      status: cohort.readiness.status,
      blockReasons: [`Projection type "${projType ?? "unknown"}" is not eligible for controlled experiments.`]
    });
  }

  return { candidates, blocked };
}

function buildCandidate(input: {
  leagueLabel: string;
  providerLabel: string;
  cohort: CohortValidationSummary;
  scope: "weekly_projection_experiment" | "season_value_experiment";
}): ExperimentCandidate {
  return {
    leagueLabel: input.leagueLabel,
    sourceType: input.cohort.sourceType,
    providerLabel: input.providerLabel,
    positionGroup: input.cohort.positionGroup as string | null,
    projectionType: input.cohort.projectionType as string | null,
    sampleSize: input.cohort.sampleSize,
    eligibilityPercentage: input.cohort.eligiblePercentage,
    averageCoverage: input.cohort.averageCoverageRatio,
    minimumCoverage: input.cohort.minimumCoverageRatio,
    unsupportedKeys: input.cohort.unsupportedKeyFrequency.map((item) => item.key),
    missingStats: input.cohort.missingStatFrequency.map((item) => item.statKey),
    readinessVerdict: input.cohort.readiness.status,
    intendedExperimentScope: input.scope
  };
}

function checkWeeklyProjectionGates(input: { cohort: CohortValidationSummary; errorRate: number }): string[] {
  const { cohort, errorRate } = input;
  const thresholds = F4_EXPERIMENT_THRESHOLDS.weeklyProjection;
  const reasons: string[] = [];

  if (cohort.sampleSize < thresholds.minSampleSize) {
    reasons.push(
      `Sample size ${cohort.sampleSize} is below the minimum ${thresholds.minSampleSize} required for weekly projection experiments.`
    );
  }
  if (cohort.eligiblePercentage < thresholds.minEligibilityRatio) {
    reasons.push(
      `Eligibility ${pct(cohort.eligiblePercentage)} is below the required ${pct(thresholds.minEligibilityRatio)}.`
    );
  }
  if (cohort.averageCoverageRatio < thresholds.minAverageCoverage) {
    reasons.push(
      `Average coverage ${pct(cohort.averageCoverageRatio)} is below the required ${pct(thresholds.minAverageCoverage)}.`
    );
  }
  if (cohort.minimumCoverageRatio < thresholds.minMinimumCoverage) {
    reasons.push(
      `Minimum coverage ${pct(cohort.minimumCoverageRatio)} is below the required ${pct(thresholds.minMinimumCoverage)}.`
    );
  }

  const highImpact = cohort.unsupportedKeyFrequency.filter((item) => {
    const impact = classifyScoringKeyImpact(item.key);
    return impact === "core" || impact === "material";
  });
  if (highImpact.length > 0) {
    reasons.push(
      `Unsupported core or material scoring keys are present: ${highImpact.map((item) => item.key).join(", ")}.`
    );
  }

  if (cohort.aliasAmbiguityCount > 0) {
    reasons.push(
      `${cohort.aliasAmbiguityCount} row(s) have stat alias ambiguity, preventing reliable scoring.`
    );
  }

  if (errorRate > thresholds.maxErrorRate) {
    reasons.push(
      `Overall error rate ${pct(errorRate)} exceeds the maximum allowed ${pct(thresholds.maxErrorRate)}.`
    );
  }

  return reasons;
}

function checkSeasonRosGates(cohort: CohortValidationSummary): string[] {
  const reasons: string[] = [];

  if (cohort.sampleSize < READINESS_THRESHOLDS.overallConditionalMinRows) {
    reasons.push(
      `Sample size ${cohort.sampleSize} is below minimum ${READINESS_THRESHOLDS.overallConditionalMinRows} for season-value experiments.`
    );
  }
  if (cohort.readiness.status === "not_ready" || cohort.readiness.status === "insufficient_data") {
    reasons.push(`Cohort readiness is ${cohort.readiness.status}.`);
  }

  const highImpact = cohort.unsupportedKeyFrequency.filter((item) => {
    const impact = classifyScoringKeyImpact(item.key);
    return impact === "core" || impact === "material";
  });
  if (highImpact.length > 0) {
    reasons.push(
      `Unsupported core or material scoring keys block season-value experiments: ${highImpact.map((item) => item.key).join(", ")}.`
    );
  }

  return reasons;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
