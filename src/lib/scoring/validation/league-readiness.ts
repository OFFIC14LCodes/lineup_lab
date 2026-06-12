import { auditAggregateScoringCompatibility } from "@/lib/scoring";
import type { PositionGroup } from "@/lib/scoring/types";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import {
  BLACKBIRD_SCORING_READINESS_VERSION,
  classifyScoringKeyImpact,
  READINESS_SCORE_CAPS,
  READINESS_SCORE_WEIGHTS,
  READINESS_THRESHOLDS
} from "@/lib/scoring/validation/constants";
import type {
  LeagueReadinessResult,
  ReadinessReason,
  ReadinessScoreBreakdownItem,
  ScoringReadinessStatus
} from "@/lib/scoring/validation/types";
import type { LeagueScoringContext } from "@/lib/scoring/server/types";

export function evaluateLeagueScoringReadiness(input: {
  league: LeagueScoringContext;
  positionGroup: PositionGroup | null;
}): LeagueReadinessResult {
  const { league, positionGroup } = input;
  const activeApplicableKeys = getActiveApplicableKeys(league, positionGroup);
  const supportedApplicableKeys = getSupportedApplicableKeys(league, positionGroup);
  const unsupportedApplicableKeys = activeApplicableKeys.filter((key) => !supportedApplicableKeys.includes(key));
  const invalidScoringKeys = league.scoringSettings.invalidKeys.map((item) => item.key);
  const aggregateUnsafeKeys = auditAggregateScoringCompatibility({
    scoringSettings: league.scoringSettings,
    positionGroup
  }).aggregateUnsafeKeys;
  const unsupportedKeyImpacts = Object.fromEntries(
    unsupportedApplicableKeys.map((key) => [key, classifyScoringKeyImpact(key)])
  );
  const highImpactUnsupportedKeys = unsupportedApplicableKeys.filter((key) => {
    const impact = unsupportedKeyImpacts[key];
    return impact === "core" || impact === "material" || impact === "unknown";
  });
  const supportRatio =
    activeApplicableKeys.length > 0 ? supportedApplicableKeys.length / activeApplicableKeys.length : null;

  const reasons: ReadinessReason[] = [];
  const warnings: string[] = [];
  const failedRules: string[] = [];
  const passedRules: string[] = [];
  const scoreBreakdown: ReadinessScoreBreakdownItem[] = [
    {
      code: "BASE",
      label: "Base readiness score",
      points: 100,
      kind: "base"
    }
  ];

  let score = 100;
  let cappedScore: number | null = null;

  if (league.formulaVersion !== BLACKBIRD_SCORING_FORMULA_VERSION) {
    failedRules.push("recognized_formula_version");
    reasons.push({
      code: "UNRECOGNIZED_FORMULA_VERSION",
      message: `Scoring formula version ${league.formulaVersion} is not recognized for readiness evaluation.`,
      severity: "blocking"
    });
    score = applyCap(score, READINESS_SCORE_CAPS.invalidLeagueSettings, scoreBreakdown, "CAP_UNRECOGNIZED_FORMULA", "Unrecognized formula version cap");
    cappedScore = score;
  } else {
    passedRules.push("recognized_formula_version");
  }

  if (invalidScoringKeys.length > 0) {
    failedRules.push("no_invalid_scoring_values");
    reasons.push({
      code: "INVALID_SCORING_VALUES",
      message: "League scoring settings contain invalid values.",
      severity: "blocking",
      scoringKeys: invalidScoringKeys
    });
    score = applyCap(score, READINESS_SCORE_CAPS.invalidLeagueSettings, scoreBreakdown, "CAP_INVALID_SCORING", "Invalid scoring settings cap");
    cappedScore = score;
  } else {
    passedRules.push("no_invalid_scoring_values");
  }

  if (activeApplicableKeys.length === 0) {
    failedRules.push("active_applicable_scoring_keys");
    reasons.push({
      code: "NO_ACTIVE_APPLICABLE_KEYS",
      message: "No active applicable scoring keys were found for this league and position context.",
      severity: "blocking"
    });
  } else {
    passedRules.push("active_applicable_scoring_keys");
  }

  if (highImpactUnsupportedKeys.length > 0) {
    failedRules.push("no_high_impact_unsupported_keys");
    reasons.push({
      code: "HIGH_IMPACT_UNSUPPORTED_KEYS",
      message: "One or more unsupported applicable scoring keys are core, material, or unknown impact.",
      severity: "blocking",
      scoringKeys: highImpactUnsupportedKeys
    });
    score = applyCap(score, READINESS_SCORE_CAPS.unsupportedCoreKey, scoreBreakdown, "CAP_UNSUPPORTED_HIGH_IMPACT", "Unsupported high-impact key cap");
    cappedScore = score;
  } else {
    passedRules.push("no_high_impact_unsupported_keys");
  }

  if (supportRatio === null) {
    warnings.push("Support ratio could not be calculated because there are no active applicable keys.");
  } else if (supportRatio < 1) {
    const deduction = Math.round((1 - supportRatio) * READINESS_SCORE_WEIGHTS.leagueSupport);
    score = Math.max(0, score - deduction);
    scoreBreakdown.push({
      code: "DEDUCTION_SUPPORT_RATIO",
      label: "League support ratio deduction",
      points: -deduction,
      kind: "deduction"
    });
  } else {
    passedRules.push("full_applicable_key_support");
  }

  if (unsupportedApplicableKeys.length > 0 && highImpactUnsupportedKeys.length === 0) {
    warnings.push("Unsupported applicable keys remain, but they are currently classified as minor only.");
  }

  const status = resolveLeagueStatus({
    invalidScoringKeys,
    activeApplicableKeys,
    highImpactUnsupportedKeys,
    supportRatio
  });

  const eligibleForRecommendationExperiment = status === "ready";
  const eligibleExperimentScope = eligibleForRecommendationExperiment ? "weekly_recommendation" : "none";

  return {
    status,
    eligibleForRecommendationExperiment,
    eligibleExperimentScope,
    score: clampScore(cappedScore ?? score),
    reasons,
    warnings,
    failedRules,
    passedRules,
    scoreBreakdown,
    formulaVersion: league.formulaVersion,
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION,
    positionGroup,
    activeApplicableKeys,
    supportedApplicableKeys,
    unsupportedApplicableKeys,
    invalidScoringKeys,
    aggregateUnsafeKeys,
    supportRatio,
    unsupportedKeyImpacts,
    highImpactUnsupportedKeys
  };
}

function resolveLeagueStatus(input: {
  invalidScoringKeys: string[];
  activeApplicableKeys: string[];
  highImpactUnsupportedKeys: string[];
  supportRatio: number | null;
}): ScoringReadinessStatus {
  if (input.invalidScoringKeys.length > 0) {
    return "not_ready";
  }
  if (input.activeApplicableKeys.length === 0 || input.supportRatio === null) {
    return "insufficient_data";
  }
  if (input.highImpactUnsupportedKeys.length > 0) {
    return "not_ready";
  }
  if (input.supportRatio === 1) {
    return "ready";
  }
  if (input.supportRatio >= READINESS_THRESHOLDS.leagueConditionalSupportRatio) {
    return "conditionally_ready";
  }
  return "not_ready";
}

function getActiveApplicableKeys(league: LeagueScoringContext, positionGroup: PositionGroup | null) {
  const activeKeys = Object.entries(league.scoringSettings.values)
    .filter(([, value]) => value !== 0)
    .map(([key]) => key)
    .sort();
  if (!positionGroup) {
    return activeKeys;
  }

  const support = league.scoringAudit.positionSpecificSupport[positionGroup];
  if (!support) {
    return activeKeys;
  }

  return activeKeys.filter((key) => !support.notApplicableKeys.includes(key));
}

function getSupportedApplicableKeys(league: LeagueScoringContext, positionGroup: PositionGroup | null) {
  if (!positionGroup) {
    return [...new Set([...league.scoringAudit.fullySupportedKeys, ...league.scoringAudit.partiallySupportedKeys])].sort();
  }

  return [...league.scoringAudit.positionSpecificSupport[positionGroup].supportedKeys].sort();
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
