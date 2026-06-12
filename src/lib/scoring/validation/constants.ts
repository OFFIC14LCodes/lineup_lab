import type { ProjectionType } from "@/lib/providers/data-types";
import type { ScoringKeyImpact } from "@/lib/scoring/validation/types";

export const BLACKBIRD_SCORING_READINESS_VERSION = "blackbird-scoring-readiness-v1" as const;

export const READINESS_SAMPLE_LIMITS = {
  defaultLimit: 25,
  maxLimit: 100
} as const;

export const READINESS_THRESHOLDS = {
  leagueConditionalSupportRatio: 0.95,
  overallReadyMinRows: 20,
  overallConditionalMinRows: 10,
  overallReadyEligibleRatio: 0.95,
  overallConditionalEligibleRatio: 0.8,
  overallReadyAverageCoverage: 0.99,
  overallConditionalAverageCoverage: 0.95,
  overallReadyMinimumCoverage: 0.95,
  overallConditionalMinimumCoverage: 0.9,
  overallMaxErrorRate: 0.05,
  staleRowDays: 45
} as const;

export const READINESS_SCORE_WEIGHTS = {
  leagueSupport: 30,
  rowCoverage: 35,
  identityIntegrity: 15,
  aliasIntegrity: 10,
  sourceSuitability: 10
} as const;

export const READINESS_SCORE_CAPS = {
  invalidLeagueSettings: 20,
  unsupportedCoreKey: 59,
  missingPosition: 40
} as const;

const CORE_SCORING_KEYS = new Set([
  "pass_yd",
  "pass_td",
  "pass_int",
  "rush_yd",
  "rush_td",
  "rec",
  "rec_yd",
  "rec_td",
  "fum_lost",
  "rec_te_bonus",
  "xpm",
  "fgm",
  "sack",
  "int",
  "solo_tkl",
  "ast_tkl",
  "tkl",
  "def_td",
  "pts_allow_0",
  "pts_allow_1_6",
  "pts_allow_7_13",
  "pts_allow_14_20",
  "pts_allow_21_27",
  "pts_allow_28_34",
  "pts_allow_35p"
]);

const MATERIAL_SCORING_PREFIXES = [
  "bonus_",
  "pts_allow_",
  "yds_allow_",
  "fgm_",
  "safe",
  "ff",
  "fr",
  "pd",
  "qb_hit",
  "tkl_loss",
  "blk_kick"
] as const;

const MINOR_SCORING_PREFIXES = [
  "ret_",
  "st_",
  "kr_",
  "pr_"
] as const;

export function classifyScoringKeyImpact(scoringKey: string): ScoringKeyImpact {
  if (CORE_SCORING_KEYS.has(scoringKey)) {
    return "core";
  }

  if (MATERIAL_SCORING_PREFIXES.some((prefix) => scoringKey.startsWith(prefix))) {
    return "material";
  }

  if (MINOR_SCORING_PREFIXES.some((prefix) => scoringKey.startsWith(prefix))) {
    return "minor";
  }

  return "unknown";
}

export function getSampleSufficiencyLabel(sampleSize: number) {
  if (sampleSize < 5) return "insufficient" as const;
  if (sampleSize < 20) return "small" as const;
  if (sampleSize < 50) return "moderate" as const;
  return "stronger" as const;
}

export function isWeeklyProjectionType(projectionType: ProjectionType | null) {
  return projectionType === "weekly";
}
