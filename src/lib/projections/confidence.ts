// H9.1 — projection confidence score (football data quality only; no ADP).
//
// Component formula:
//   base score
//   + week-count adjustment (sample size)
//   + role-class adjustment
//   + single-season-only penalty (always fires in H9-lite)
//   + H8 applicable-observed bonus (per field, up to field count)
//   + H8 applicable-unknown penalty (per field)
//   + H8 secondary-unknown penalty (capped at max total)
//   + contradictory evidence penalty
//   + stale evidence penalty
//
// Final score clamped to [PROJ_CONFIDENCE_MIN, PROJ_CONFIDENCE_MAX].
// Label mapped from score using fixed thresholds.

import type { ProjectionConfidenceLabel, RoleSampleClass } from "./types";
import type { H8EvidenceEvaluation } from "./h8-evidence";
import {
  PROJ_CONFIDENCE_BASE,
  PROJ_CONFIDENCE_WEEKS_14_PLUS,
  PROJ_CONFIDENCE_WEEKS_10_TO_13,
  PROJ_CONFIDENCE_WEEKS_UNDER_6,
  PROJ_CONFIDENCE_WEEKS_UNDER_3,
  PROJ_CONFIDENCE_ESTABLISHED_FULL,
  PROJ_CONFIDENCE_ESTABLISHED_PARTIAL,
  PROJ_CONFIDENCE_BACKUP,
  PROJ_CONFIDENCE_MINIMAL,
  PROJ_CONFIDENCE_ROLE_UNKNOWN,
  PROJ_CONFIDENCE_SINGLE_SEASON_ONLY,
  PROJ_CONFIDENCE_APPLICABLE_OBSERVED,
  PROJ_CONFIDENCE_APPLICABLE_UNKNOWN_PENALTY,
  PROJ_CONFIDENCE_SECONDARY_UNKNOWN_PENALTY,
  PROJ_CONFIDENCE_SECONDARY_MAX_TOTAL_PENALTY,
  PROJ_CONFIDENCE_CONTRADICTORY,
  PROJ_CONFIDENCE_STALE,
  PROJ_CONFIDENCE_MIN,
  PROJ_CONFIDENCE_MAX,
} from "./constants";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ConfidenceFactor = {
  factor: string;
  delta: number;
};

export type ProjectionConfidence = {
  projectionConfidenceScore: number;
  projectionConfidenceLabel: ProjectionConfidenceLabel;
  contributingFactors: ConfidenceFactor[];
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function scoreToLabel(score: number): ProjectionConfidenceLabel {
  if (score >= 0.70) return "high";
  if (score >= 0.50) return "medium";
  if (score >= 0.30) return "low";
  return "very_low";
}

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function computeProjectionConfidence(
  roleSampleClass: RoleSampleClass,
  historicalActiveWeeks: number,
  h8: H8EvidenceEvaluation,
  isSingleSeasonOnly: boolean
): ProjectionConfidence {
  const factors: ConfidenceFactor[] = [];
  let score = PROJ_CONFIDENCE_BASE;

  // Week-count adjustment
  if (historicalActiveWeeks >= 14) {
    factors.push({ factor: "weeks_14_plus", delta: PROJ_CONFIDENCE_WEEKS_14_PLUS });
    score += PROJ_CONFIDENCE_WEEKS_14_PLUS;
  } else if (historicalActiveWeeks >= 10) {
    factors.push({ factor: "weeks_10_to_13", delta: PROJ_CONFIDENCE_WEEKS_10_TO_13 });
    score += PROJ_CONFIDENCE_WEEKS_10_TO_13;
  } else if (historicalActiveWeeks < 3) {
    factors.push({ factor: "weeks_under_3", delta: PROJ_CONFIDENCE_WEEKS_UNDER_3 });
    score += PROJ_CONFIDENCE_WEEKS_UNDER_3;
  } else if (historicalActiveWeeks < 6) {
    factors.push({ factor: "weeks_under_6", delta: PROJ_CONFIDENCE_WEEKS_UNDER_6 });
    score += PROJ_CONFIDENCE_WEEKS_UNDER_6;
  }

  // Role-class adjustment
  switch (roleSampleClass) {
    case "ESTABLISHED_FULL_SEASON":
      factors.push({ factor: "established_full_season", delta: PROJ_CONFIDENCE_ESTABLISHED_FULL });
      score += PROJ_CONFIDENCE_ESTABLISHED_FULL;
      break;
    case "ESTABLISHED_PARTIAL_SEASON":
      factors.push({ factor: "established_partial_season", delta: PROJ_CONFIDENCE_ESTABLISHED_PARTIAL });
      score += PROJ_CONFIDENCE_ESTABLISHED_PARTIAL;
      break;
    case "PART_TIME_CONTRIBUTOR":
      // No adjustment for part-time
      break;
    case "BACKUP_OR_SPOT_STARTER":
      factors.push({ factor: "backup_or_spot_starter", delta: PROJ_CONFIDENCE_BACKUP });
      score += PROJ_CONFIDENCE_BACKUP;
      break;
    case "MINIMAL_SAMPLE":
      factors.push({ factor: "minimal_sample", delta: PROJ_CONFIDENCE_MINIMAL });
      score += PROJ_CONFIDENCE_MINIMAL;
      break;
    case "ROLE_UNKNOWN":
      factors.push({ factor: "role_unknown", delta: PROJ_CONFIDENCE_ROLE_UNKNOWN });
      score += PROJ_CONFIDENCE_ROLE_UNKNOWN;
      break;
  }

  // Single season only (always fires in H9-lite baseline)
  if (isSingleSeasonOnly) {
    factors.push({ factor: "single_season_only", delta: PROJ_CONFIDENCE_SINGLE_SEASON_ONLY });
    score += PROJ_CONFIDENCE_SINGLE_SEASON_ONLY;
  }

  // H8 applicable observed bonus
  for (let i = 0; i < h8.applicableObserved; i++) {
    factors.push({ factor: `h8_applicable_observed_${i + 1}`, delta: PROJ_CONFIDENCE_APPLICABLE_OBSERVED });
    score += PROJ_CONFIDENCE_APPLICABLE_OBSERVED;
  }

  // H8 applicable unknown penalty
  for (let i = 0; i < h8.applicableUnknown; i++) {
    factors.push({ factor: `h8_applicable_unknown_${i + 1}`, delta: PROJ_CONFIDENCE_APPLICABLE_UNKNOWN_PENALTY });
    score += PROJ_CONFIDENCE_APPLICABLE_UNKNOWN_PENALTY;
  }

  // H8 secondary unknown penalty (capped)
  if (h8.secondaryUnknown > 0) {
    const rawPenalty = h8.secondaryUnknown * PROJ_CONFIDENCE_SECONDARY_UNKNOWN_PENALTY;
    const cappedPenalty = Math.max(rawPenalty, PROJ_CONFIDENCE_SECONDARY_MAX_TOTAL_PENALTY);
    factors.push({ factor: "h8_secondary_unknown", delta: cappedPenalty });
    score += cappedPenalty;
  }

  // Evidence quality
  if (h8.hasContradictory) {
    factors.push({ factor: "contradictory_evidence", delta: PROJ_CONFIDENCE_CONTRADICTORY });
    score += PROJ_CONFIDENCE_CONTRADICTORY;
  }
  if (h8.hasStale) {
    factors.push({ factor: "stale_evidence", delta: PROJ_CONFIDENCE_STALE });
    score += PROJ_CONFIDENCE_STALE;
  }

  const finalScore = Math.max(PROJ_CONFIDENCE_MIN, Math.min(PROJ_CONFIDENCE_MAX, score));

  return {
    projectionConfidenceScore: Math.round(finalScore * 1000) / 1000,
    projectionConfidenceLabel: scoreToLabel(finalScore),
    contributingFactors: factors,
  };
}
