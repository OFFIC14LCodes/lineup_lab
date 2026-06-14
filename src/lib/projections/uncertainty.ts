// H9.1 — model uncertainty and player volatility.
//
// model uncertainty: knowledge-gap uncertainty from data quality and sample size.
//   Changes when H8 context is missing or low quality.
//   Does NOT change the median — it widens the range.
//
// player volatility: inherent player variance from behavioral signals.
//   Available in H9.1: fumble-return TDs, H8 role stability.
//   NOT included in H9.1: long TDs, multi-team, pick rate (deferred to later passes).
//
// totalRangeWidth = clamp(modelUncertainty + playerVolatility, MIN, MAX)

import type { ProjectionPosition, RoleSampleClass } from "./types";
import type { H8EvidenceEvaluation } from "./h8-evidence";
import type { SeasonOpportunityTotals } from "./role-weeks";
import type { ReasonCode } from "./reason-codes";
import {
  MODEL_UNCERTAINTY_BASE_QB,
  MODEL_UNCERTAINTY_BASE_RB,
  MODEL_UNCERTAINTY_BASE_WR,
  MODEL_UNCERTAINTY_BASE_TE,
  MODEL_UNCERTAINTY_SINGLE_SEASON_ONLY,
  MODEL_UNCERTAINTY_MINIMAL_SAMPLE,
  MODEL_UNCERTAINTY_BACKUP_OR_SPOT,
  MODEL_UNCERTAINTY_ROLE_UNKNOWN,
  MODEL_UNCERTAINTY_UNKNOWN_APPLICABLE_FIELD,
  MODEL_UNCERTAINTY_ESTABLISHED_OBSERVED,
  MODEL_UNCERTAINTY_STALE_EVIDENCE,
  MODEL_UNCERTAINTY_CONTRADICTORY_EVIDENCE,
  MODEL_UNCERTAINTY_MIN,
  MODEL_UNCERTAINTY_MAX,
  PLAYER_VOLATILITY_BASE_QB,
  PLAYER_VOLATILITY_BASE_RB,
  PLAYER_VOLATILITY_BASE_WR,
  PLAYER_VOLATILITY_BASE_TE,
  PLAYER_VOLATILITY_MISC_TD,
  PLAYER_VOLATILITY_ROLE_STABILITY_HIGH,
  PLAYER_VOLATILITY_MIN,
  PLAYER_VOLATILITY_MAX,
  TOTAL_RANGE_WIDTH_MIN,
  TOTAL_RANGE_WIDTH_MAX,
} from "./constants";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type UncertaintyResult = {
  modelUncertainty: number;
  playerVolatility: number;
  totalRangeWidth: number;
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const POSITION_UNCERTAINTY_BASE: Record<ProjectionPosition, number> = {
  QB: MODEL_UNCERTAINTY_BASE_QB,
  RB: MODEL_UNCERTAINTY_BASE_RB,
  WR: MODEL_UNCERTAINTY_BASE_WR,
  TE: MODEL_UNCERTAINTY_BASE_TE,
};

const POSITION_VOLATILITY_BASE: Record<ProjectionPosition, number> = {
  QB: PLAYER_VOLATILITY_BASE_QB,
  RB: PLAYER_VOLATILITY_BASE_RB,
  WR: PLAYER_VOLATILITY_BASE_WR,
  TE: PLAYER_VOLATILITY_BASE_TE,
};

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function computeUncertainty(
  position: ProjectionPosition,
  roleSampleClass: RoleSampleClass,
  h8: H8EvidenceEvaluation,
  totals: SeasonOpportunityTotals,
  isSingleSeasonOnly: boolean
): UncertaintyResult {
  const reasonCodes = new Set<ReasonCode>();

  // --- Model uncertainty ---

  let modelUncertainty = POSITION_UNCERTAINTY_BASE[position];

  // Always fires in H9-lite baseline
  if (isSingleSeasonOnly) {
    modelUncertainty += MODEL_UNCERTAINTY_SINGLE_SEASON_ONLY;
    reasonCodes.add("SINGLE_SEASON_ONLY");
  }

  // Role-class additions
  switch (roleSampleClass) {
    case "MINIMAL_SAMPLE":
      modelUncertainty += MODEL_UNCERTAINTY_MINIMAL_SAMPLE;
      break;
    case "BACKUP_OR_SPOT_STARTER":
      modelUncertainty += MODEL_UNCERTAINTY_BACKUP_OR_SPOT;
      break;
    case "ROLE_UNKNOWN":
      modelUncertainty += MODEL_UNCERTAINTY_ROLE_UNKNOWN;
      break;
    default:
      break;
  }

  // H8 applicable unknown fields (max 2 apply to uncertainty)
  const unknownFieldsApplied = Math.min(h8.applicableUnknown, 2);
  modelUncertainty += unknownFieldsApplied * MODEL_UNCERTAINTY_UNKNOWN_APPLICABLE_FIELD;

  // H8 applicable observed fields reduce uncertainty
  modelUncertainty += h8.applicableObserved * MODEL_UNCERTAINTY_ESTABLISHED_OBSERVED;

  // Evidence quality
  if (h8.hasStale) {
    modelUncertainty += MODEL_UNCERTAINTY_STALE_EVIDENCE;
    reasonCodes.add("STALE_EVIDENCE");
  }
  if (h8.hasContradictory) {
    modelUncertainty += MODEL_UNCERTAINTY_CONTRADICTORY_EVIDENCE;
    reasonCodes.add("CONTRADICTORY_EVIDENCE");
  }

  modelUncertainty = Math.max(MODEL_UNCERTAINTY_MIN, Math.min(MODEL_UNCERTAINTY_MAX, modelUncertainty));

  // --- Player volatility ---

  let playerVolatility = POSITION_VOLATILITY_BASE[position];

  // Non-repeatable misc TD (fumble return) increases volatility slightly
  if (totals.totalFumRetTd > 0) {
    playerVolatility += PLAYER_VOLATILITY_MISC_TD;
    reasonCodes.add("NON_REPEATABLE_MISC_TD");
  }

  // H8 role stability observed → reduces volatility
  if (h8.applicableObserved > 0) {
    playerVolatility += PLAYER_VOLATILITY_ROLE_STABILITY_HIGH;
    reasonCodes.add("ROLE_STABILITY_HIGH");
  }

  playerVolatility = Math.max(PLAYER_VOLATILITY_MIN, Math.min(PLAYER_VOLATILITY_MAX, playerVolatility));

  // --- Total range width ---

  const totalRangeWidth = Math.max(
    TOTAL_RANGE_WIDTH_MIN,
    Math.min(TOTAL_RANGE_WIDTH_MAX, modelUncertainty + playerVolatility)
  );

  return {
    modelUncertainty: Math.round(modelUncertainty * 10000) / 10000,
    playerVolatility: Math.round(playerVolatility * 10000) / 10000,
    totalRangeWidth: Math.round(totalRangeWidth * 10000) / 10000,
    reasonCodes: [...reasonCodes],
  };
}
