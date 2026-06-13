import { describe, expect, it } from "vitest";

import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import { extractExperimentCandidates, F4_EXPERIMENT_THRESHOLDS } from "@/lib/scoring/validation/experiment-candidates";
import { BLACKBIRD_SCORING_READINESS_VERSION } from "@/lib/scoring/validation/constants";
import type { CohortValidationSummary } from "@/lib/scoring/validation/types";

function makeReadiness(status: "ready" | "conditionally_ready" | "not_ready" | "insufficient_data") {
  const eligible = status === "ready";
  const scope = eligible ? ("weekly_recommendation" as const) : ("none" as const);
  return {
    status,
    scoringValidationStatus: status,
    eligibleForRecommendationExperiment: eligible,
    eligibleExperimentScope: scope,
    recommendationExperimentEligibility: {
      eligible,
      scope
    },
    score: status === "ready" ? 100 : 40,
    reasons: [],
    warnings: [],
    failedRules: status !== "ready" ? ["cohort_thresholds"] : [],
    passedRules: status === "ready" ? ["cohort_thresholds"] : [],
    scoreBreakdown: [],
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION,
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION
  };
}

function makeCohort(overrides: Partial<CohortValidationSummary> = {}): CohortValidationSummary {
  return {
    cohortKey: "manual|projections|WR|weekly",
    provider: "manual",
    sourceType: "projections",
    positionGroup: "WR",
    projectionType: "weekly",
    sampleSize: 25,
    sampleSufficiency: "moderate",
    readyCount: 25,
    conditionallyReadyCount: 0,
    notReadyCount: 0,
    insufficientDataCount: 0,
    eligibleCount: 25,
    eligiblePercentage: 1.0,
    averageCoverageRatio: 1.0,
    minimumCoverageRatio: 1.0,
    unsupportedKeyFrequency: [],
    missingStatFrequency: [],
    aliasAmbiguityCount: 0,
    positionWarningCount: 0,
    providerComparison: {
      withProviderTotals: 0,
      classifiedCount: 0,
      excludedCount: 0,
      withoutProviderTotals: 25,
      matchCount: 0,
      closeCount: 0,
      differentCount: 0,
      incompleteCoverageCount: 0,
      meanSignedDifference: null,
      meanAbsoluteDifference: null,
      medianAbsoluteDifference: null,
      maximumAbsoluteDifference: null,
      percentageWithProviderTotals: 0,
      percentageMatch: 0,
      percentageClose: 0,
      percentageDifferent: 0
    },
    warnings: [],
    readiness: makeReadiness("ready"),
    ...overrides
  };
}

function annotate(cohort: CohortValidationSummary, opts: { leagueLabel?: string; providerLabel?: string; errorRate?: number } = {}) {
  return {
    leagueLabel: opts.leagueLabel ?? "League A",
    providerLabel: opts.providerLabel ?? "Provider A",
    cohort,
    errorRate: opts.errorRate ?? 0
  };
}

describe("extractExperimentCandidates — weekly projection candidate", () => {
  it("qualifies a fully-ready weekly projection cohort", () => {
    const { candidates, blocked } = extractExperimentCandidates({
      cohorts: [annotate(makeCohort())]
    });

    expect(candidates).toHaveLength(1);
    expect(blocked).toHaveLength(0);
    expect(candidates[0].intendedExperimentScope).toBe("weekly_projection_experiment");
    expect(candidates[0].sourceType).toBe("projections");
    expect(candidates[0].projectionType).toBe("weekly");
  });

  it("blocks when sample size is below minimum", () => {
    const cohort = makeCohort({ sampleSize: F4_EXPERIMENT_THRESHOLDS.weeklyProjection.minSampleSize - 1 });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].blockReasons[0]).toMatch(/Sample size/);
  });

  it("blocks when eligibility is below threshold", () => {
    const cohort = makeCohort({
      eligiblePercentage: F4_EXPERIMENT_THRESHOLDS.weeklyProjection.minEligibilityRatio - 0.05,
      eligibleCount: 18,
      readyCount: 18
    });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/Eligibility/);
  });

  it("blocks when average coverage is below threshold", () => {
    const cohort = makeCohort({ averageCoverageRatio: F4_EXPERIMENT_THRESHOLDS.weeklyProjection.minAverageCoverage - 0.01 });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/Average coverage/);
  });

  it("blocks when minimum coverage is below threshold", () => {
    const cohort = makeCohort({ minimumCoverageRatio: F4_EXPERIMENT_THRESHOLDS.weeklyProjection.minMinimumCoverage - 0.01 });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/Minimum coverage/);
  });

  it("blocks when high-impact unsupported keys are present", () => {
    const cohort = makeCohort({
      unsupportedKeyFrequency: [{ key: "pass_td", count: 5 }] // pass_td is core
    });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/core or material/);
  });

  it("blocks when alias ambiguity count is nonzero", () => {
    const cohort = makeCohort({ aliasAmbiguityCount: 2 });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/alias ambiguity/);
  });

  it("blocks when error rate exceeds maximum", () => {
    const { candidates, blocked } = extractExperimentCandidates({
      cohorts: [annotate(makeCohort(), { errorRate: F4_EXPERIMENT_THRESHOLDS.weeklyProjection.maxErrorRate + 0.01 })]
    });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/error rate/i);
  });
});

describe("extractExperimentCandidates — weekly actuals are not projection candidates", () => {
  it("classifies weekly_stats cohort as blocked regardless of readiness", () => {
    const cohort = makeCohort({ sourceType: "weekly_stats", projectionType: null, cohortKey: "manual|weekly_stats|WR|none" });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].sourceType).toBe("weekly_stats");
    // Always has the recommendation prohibition reason
    expect(blocked[0].blockReasons.some((r) => /recommendation experiments/i.test(r))).toBe(true);
    expect(blocked[0].blockReasons.some((r) => /prohibited for weekly actuals/i.test(r))).toBe(true);
  });

  it("does not classify a ready weekly_stats cohort as a projection recommendation candidate", () => {
    const cohort = makeCohort({
      sourceType: "weekly_stats",
      projectionType: null,
      cohortKey: "manual|weekly_stats|QB|none",
      positionGroup: "QB"
    });
    const { candidates } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
  });

  it("adds a scoring-validation blocked reason when readiness is not_ready — separate from the recommendation prohibition", () => {
    const cohort = makeCohort({
      sourceType: "weekly_stats",
      projectionType: null,
      cohortKey: "manual|weekly_stats|WR|none",
      readiness: makeReadiness("not_ready")
    });
    const { blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(blocked[0].blockReasons).toHaveLength(2);
    expect(blocked[0].blockReasons[0]).toMatch(/scoring validation is blocked/i);
    expect(blocked[0].blockReasons[1]).toMatch(/recommendation experiments.*prohibited/i);
  });

  it("does not add scoring-validation blocked reason when readiness is ready", () => {
    const cohort = makeCohort({
      sourceType: "weekly_stats",
      projectionType: null,
      cohortKey: "manual|weekly_stats|WR|none",
      readiness: makeReadiness("ready")
    });
    const { blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    // Only the recommendation prohibition; no scoring-validation block
    expect(blocked[0].blockReasons).toHaveLength(1);
    expect(blocked[0].blockReasons[0]).toMatch(/recommendation experiments.*prohibited/i);
  });

  it("does not add scoring-validation blocked reason when readiness is conditionally_ready", () => {
    const cohort = makeCohort({
      sourceType: "weekly_stats",
      projectionType: null,
      cohortKey: "manual|weekly_stats|WR|none",
      readiness: makeReadiness("conditionally_ready")
    });
    const { blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(blocked[0].blockReasons).toHaveLength(1);
    expect(blocked[0].blockReasons[0]).toMatch(/recommendation experiments.*prohibited/i);
  });
});

describe("extractExperimentCandidates — season/ROS projection scope", () => {
  it("qualifies a ready season projection cohort for season_value_experiment", () => {
    const cohort = makeCohort({
      sourceType: "projections",
      projectionType: "season",
      cohortKey: "manual|projections|WR|season"
    });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].intendedExperimentScope).toBe("season_value_experiment");
    expect(blocked).toHaveLength(0);
  });

  it("qualifies a ready rest_of_season cohort for season_value_experiment only", () => {
    const cohort = makeCohort({
      sourceType: "projections",
      projectionType: "rest_of_season",
      cohortKey: "manual|projections|RB|rest_of_season",
      positionGroup: "RB"
    });
    const { candidates } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].intendedExperimentScope).toBe("season_value_experiment");
    expect(candidates[0].intendedExperimentScope).not.toBe("weekly_projection_experiment");
  });

  it("blocks season projection when sample is too small", () => {
    const cohort = makeCohort({
      sourceType: "projections",
      projectionType: "season",
      sampleSize: 5,
      sampleSufficiency: "small"
    });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons[0]).toMatch(/Sample size/);
  });

  it("blocks season projection when readiness is not_ready", () => {
    const cohort = makeCohort({
      sourceType: "projections",
      projectionType: "season",
      readiness: makeReadiness("not_ready")
    });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked[0].blockReasons.some((r) => r.includes("not_ready"))).toBe(true);
  });
});

describe("extractExperimentCandidates — sparse cohort remains insufficient", () => {
  it("blocks an insufficient_data cohort", () => {
    const cohort = makeCohort({
      sampleSize: 3,
      sampleSufficiency: "insufficient",
      readiness: makeReadiness("insufficient_data")
    });
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(candidates).toHaveLength(0);
    expect(blocked).toHaveLength(1);
  });
});

describe("extractExperimentCandidates — empty input", () => {
  it("returns empty arrays for no cohorts", () => {
    const { candidates, blocked } = extractExperimentCandidates({ cohorts: [] });

    expect(candidates).toHaveLength(0);
    expect(blocked).toHaveLength(0);
  });
});

describe("extractExperimentCandidates — anonymized evidence serialization", () => {
  it("candidate serializes to JSON without throwing", () => {
    const { candidates } = extractExperimentCandidates({
      cohorts: [annotate(makeCohort(), { leagueLabel: "League A", providerLabel: "Provider A" })]
    });

    expect(() => JSON.stringify(candidates)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(candidates));
    expect(parsed[0].leagueLabel).toBe("League A");
    expect(parsed[0].providerLabel).toBe("Provider A");
  });

  it("blocked cohort serializes to JSON without throwing", () => {
    const cohort = makeCohort({ sourceType: "weekly_stats", projectionType: null });
    const { blocked } = extractExperimentCandidates({ cohorts: [annotate(cohort)] });

    expect(() => JSON.stringify(blocked)).not.toThrow();
  });
});
