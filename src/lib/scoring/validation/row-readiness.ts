import type { ProjectionType } from "@/lib/providers/data-types";
import type { PositionGroup } from "@/lib/scoring/types";
import {
  BLACKBIRD_SCORING_READINESS_VERSION,
  classifyScoringKeyImpact,
  isWeeklyProjectionType,
  READINESS_SCORE_CAPS,
  READINESS_SCORE_WEIGHTS,
  READINESS_THRESHOLDS
} from "@/lib/scoring/validation/constants";
import type {
  LeagueReadinessResult,
  ReadinessReason,
  ReadinessScoreBreakdownItem,
  RowValidationResult,
  ScoringReadinessDecision,
  ScoringReadinessStatus
} from "@/lib/scoring/validation/types";
import type { StoredRowScoringResult } from "@/lib/scoring/server/types";

export function evaluateRowScoringReadiness(input: {
  result: StoredRowScoringResult;
  sourceType: "weekly_stats" | "season_stats" | "projections";
  leagueReadiness: LeagueReadinessResult;
  now?: Date;
}): ScoringReadinessDecision {
  const { result, sourceType, leagueReadiness } = input;
  const now = input.now ?? new Date();
  const warnings: string[] = [];
  const reasons: ReadinessReason[] = [];
  const failedRules: string[] = [];
  const passedRules: string[] = [];
  const scoreBreakdown: ReadinessScoreBreakdownItem[] = [
    { code: "BASE", label: "Base readiness score", points: 100, kind: "base" }
  ];

  let score = 100;

  const missingStats = result.blackbird.coverage.missingStatsForSupportedKeys;
  const unsupportedKeys = result.blackbird.coverage.unsupportedScoringKeys;
  const ambiguousAliases = result.blackbird.coverage.ambiguousStatAliases;
  const positionMissing = result.player.positionGroup === null;
  const aggregateInexact = Boolean(result.aggregateCompatibility && !result.aggregateCompatibility.isExact);
  const staleSource = isSourceStale(result, now);

  const unsupportedCoreOrMaterial = unsupportedKeys.filter((key) => {
    const impact = classifyScoringKeyImpact(key);
    return impact === "core" || impact === "material" || impact === "unknown";
  });
  const unsupportedMinor = unsupportedKeys.filter((key) => classifyScoringKeyImpact(key) === "minor");

  const missingCoreOrMaterialStats = missingStats.filter((item) => {
    const impact = classifyScoringKeyImpact(item.scoringKey);
    return impact === "core" || impact === "material" || impact === "unknown";
  });
  const missingMinorStats = missingStats.filter((item) => classifyScoringKeyImpact(item.scoringKey) === "minor");

  if (positionMissing) {
    failedRules.push("known_position_group");
    reasons.push({
      code: "POSITION_GROUP_MISSING",
      message: "Position group is missing, so the row cannot be scored reliably for readiness.",
      severity: "blocking"
    });
    score = applyCap(score, READINESS_SCORE_CAPS.missingPosition, scoreBreakdown, "CAP_POSITION_MISSING", "Missing position cap");
  } else {
    passedRules.push("known_position_group");
  }

  if (leagueReadiness.status === "not_ready") {
    failedRules.push("league_readiness_not_blocking");
    reasons.push({
      code: "LEAGUE_NOT_READY",
      message: "League scoring configuration is not ready for reliable row-level experiments.",
      severity: "blocking"
    });
    score = Math.min(score, 59);
  } else {
    passedRules.push("league_readiness_not_blocking");
  }

  if (unsupportedCoreOrMaterial.length > 0) {
    failedRules.push("no_unsupported_core_or_material_keys");
    reasons.push({
      code: "UNSUPPORTED_HIGH_IMPACT_ROW_KEYS",
      message: "This row depends on unsupported core, material, or unknown-impact scoring keys.",
      severity: "blocking",
      scoringKeys: unsupportedCoreOrMaterial
    });
    score = applyCap(score, READINESS_SCORE_CAPS.unsupportedCoreKey, scoreBreakdown, "CAP_ROW_UNSUPPORTED_HIGH_IMPACT", "Unsupported high-impact row key cap");
  } else {
    passedRules.push("no_unsupported_core_or_material_keys");
  }

  if (missingCoreOrMaterialStats.length > 0) {
    failedRules.push("required_core_stats_present");
    reasons.push({
      code: "MISSING_REQUIRED_CORE_STATS",
      message: "Required raw stats are missing for core, material, or unknown-impact scoring keys.",
      severity: "blocking",
      scoringKeys: missingCoreOrMaterialStats.map((item) => item.scoringKey),
      statKeys: missingCoreOrMaterialStats.flatMap((item) => item.requiredStats)
    });
    score = Math.min(score, 59);
  } else {
    passedRules.push("required_core_stats_present");
  }

  if (ambiguousAliases.length > 0) {
    failedRules.push("no_alias_ambiguity");
    reasons.push({
      code: "AMBIGUOUS_ALIASES",
      message: "Conflicting stat aliases were present and prevent reliable readiness classification.",
      severity: "blocking",
      statKeys: ambiguousAliases.map((item) => item.canonicalKey)
    });
    score -= READINESS_SCORE_WEIGHTS.aliasIntegrity;
  } else {
    passedRules.push("no_alias_ambiguity");
  }

  if (missingMinorStats.length > 0) {
    warnings.push("One or more minor scoring keys are missing raw stats.");
    score -= Math.min(10, missingMinorStats.length * 2);
  }

  if (unsupportedMinor.length > 0) {
    warnings.push("Unsupported minor scoring keys are active for this row.");
    score -= Math.min(8, unsupportedMinor.length * 2);
  }

  if (!result.blackbird.coverage.isComplete) {
    score -= Math.round((1 - result.blackbird.coverage.coverageRatio) * READINESS_SCORE_WEIGHTS.rowCoverage);
  } else {
    passedRules.push("complete_row_coverage");
  }

  if (aggregateInexact) {
    warnings.push("Aggregate scoring is structurally inexact for this row.");
    score -= READINESS_SCORE_WEIGHTS.sourceSuitability;
  } else {
    passedRules.push("aggregate_exactness_or_weekly_source");
  }

  if (staleSource) {
    warnings.push("Source row is older than the configured freshness threshold.");
    score -= 5;
  } else {
    passedRules.push("source_freshness");
  }

  if (result.providerComparison?.comparisonStatus === "different") {
    warnings.push("Provider total differs materially from Blackbird despite complete coverage.");
    score -= 5;
  }

  if (result.providerComparison?.comparisonStatus === "incomplete_blackbird_coverage") {
    failedRules.push("provider_comparison_not_blocked_by_incomplete_coverage");
    reasons.push({
      code: "INCOMPLETE_PROVIDER_COMPARISON",
      message: "Provider comparison is informational only because Blackbird coverage is incomplete.",
      severity: "blocking"
    });
  } else {
    passedRules.push("provider_comparison_not_blocked_by_incomplete_coverage");
  }

  const status = resolveRowStatus({
    positionMissing,
    unsupportedCoreOrMaterialCount: unsupportedCoreOrMaterial.length,
    missingCoreOrMaterialStatsCount: missingCoreOrMaterialStats.length,
    ambiguousAliasCount: ambiguousAliases.length,
    aggregateInexact,
    coverageComplete: result.blackbird.coverage.isComplete,
    leagueStatus: leagueReadiness.status,
    providerComparisonStatus: result.providerComparison?.comparisonStatus ?? null,
    hasOnlyMinorIssues: unsupportedMinor.length > 0 || missingMinorStats.length > 0 || staleSource
  });

  const eligibility = resolveExperimentEligibility({
    status,
    sourceType,
    projectionType: result.source.projectionType,
    aggregateInexact,
    positionGroup: result.player.positionGroup
  });

  return {
    status,
    scoringValidationStatus: status,
    eligibleForRecommendationExperiment: eligibility.eligible,
    eligibleExperimentScope: eligibility.scope,
    recommendationExperimentEligibility: eligibility,
    score: clampScore(score),
    reasons,
    warnings,
    failedRules,
    passedRules,
    scoreBreakdown,
    formulaVersion: result.blackbird.formulaVersion,
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION
  };
}

export function toRowValidationResult(input: {
  result: StoredRowScoringResult;
  sourceType: "weekly_stats" | "season_stats" | "projections";
  leagueReadiness: LeagueReadinessResult;
  now?: Date;
}): RowValidationResult {
  const readiness = evaluateRowScoringReadiness(input);

  return {
    rowId: input.result.source.rowId,
    playerId: input.result.player.id,
    playerName: input.result.player.name,
    provider: input.result.source.provider,
    sourceType: input.sourceType,
    positionGroup: input.result.player.positionGroup,
    season: input.result.source.season,
    week: input.result.source.week,
    projectionType: input.result.source.projectionType,
    blackbirdPoints: input.result.blackbird.totalPoints,
    coverageRatio: input.result.blackbird.coverage.coverageRatio,
    providerComparison: input.result.providerComparison,
    readiness,
    scoringResult: input.result
  };
}

function resolveRowStatus(input: {
  positionMissing: boolean;
  unsupportedCoreOrMaterialCount: number;
  missingCoreOrMaterialStatsCount: number;
  ambiguousAliasCount: number;
  aggregateInexact: boolean;
  coverageComplete: boolean;
  leagueStatus: ScoringReadinessStatus;
  providerComparisonStatus: string | null;
  hasOnlyMinorIssues: boolean;
}): ScoringReadinessStatus {
  if (input.positionMissing) {
    return "insufficient_data";
  }
  if (input.leagueStatus === "not_ready" || input.leagueStatus === "insufficient_data") {
    return "not_ready";
  }
  if (input.unsupportedCoreOrMaterialCount > 0 || input.missingCoreOrMaterialStatsCount > 0 || input.ambiguousAliasCount > 0) {
    return "not_ready";
  }
  if (input.providerComparisonStatus === "incomplete_blackbird_coverage") {
    return "not_ready";
  }
  if (input.aggregateInexact || !input.coverageComplete || input.hasOnlyMinorIssues) {
    return "conditionally_ready";
  }
  return "ready";
}

function resolveExperimentEligibility(input: {
  status: ScoringReadinessStatus;
  sourceType: "weekly_stats" | "season_stats" | "projections";
  projectionType: ProjectionType | null;
  aggregateInexact: boolean;
  positionGroup: PositionGroup | null;
}) {
  if (input.positionGroup === null) {
    return { eligible: false, scope: "none" as const };
  }

  if (input.sourceType === "weekly_stats") {
    return {
      eligible: false,
      scope: "none" as const
    };
  }

  if (input.sourceType === "projections") {
    if (isWeeklyProjectionType(input.projectionType)) {
      return {
        eligible: input.status === "ready",
        scope: input.status === "ready" ? "weekly_projection_experiment" as const : "none" as const
      };
    }

    if (input.status === "conditionally_ready" && input.aggregateInexact) {
      return {
        eligible: true,
        scope: "season_value_experiment" as const
      };
    }

    return {
      eligible: input.status === "ready" && !input.aggregateInexact,
      scope: input.status === "ready" && !input.aggregateInexact ? "season_value_experiment" as const : "none" as const
    };
  }

  if (input.status === "ready" && !input.aggregateInexact) {
    return {
      eligible: true,
      scope: "historical_season_analysis" as const
    };
  }

  return { eligible: false, scope: "none" as const };
}

function isSourceStale(result: StoredRowScoringResult, now: Date) {
  const timestamp = result.source.sourceUpdatedAt ?? result.source.ingestedAt;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  const ageMs = now.getTime() - parsed;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > READINESS_THRESHOLDS.staleRowDays;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function applyCap(
  currentScore: number,
  cap: number,
  breakdown: ReadinessScoreBreakdownItem[],
  code: string,
  label: string
) {
  const nextScore = Math.min(currentScore, cap);
  if (nextScore !== currentScore) {
    breakdown.push({
      code,
      label,
      points: nextScore - currentScore,
      kind: "cap"
    });
  }
  return nextScore;
}
