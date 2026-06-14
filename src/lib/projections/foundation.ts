// H9.1 — PlayerRoleProjectionFoundation.
//
// Combines role-weeks, classification, availability, H8 evidence, confidence,
// and uncertainty into a single foundation object per player.
// Computation only — no persistence, no fantasy points.

import type { HistoricalPlayerProjectionInput } from "./types";
import type { ReasonCode } from "./reason-codes";
import type { RoleWeekResult, SeasonOpportunityTotals } from "./role-weeks";
import type { RoleSampleClassification, ClassificationInputs } from "./classification";
import type { ProjectedAvailability } from "./availability";
import type { H8EvidenceEvaluation } from "./h8-evidence";
import type { ProjectionConfidence } from "./confidence";
import type { RoleSampleClass, ProjectionConfidenceLabel } from "./types";

import { computeRoleWeeks } from "./role-weeks";
import { classifyRoleSample } from "./classification";
import { computeProjectedAvailability } from "./availability";
import { evaluateH8Evidence } from "./h8-evidence";
import { computeProjectionConfidence } from "./confidence";
import { computeUncertainty } from "./uncertainty";

// --------------------------------------------------------------------------
// Output type
// --------------------------------------------------------------------------

export type PlayerRoleProjectionFoundation = {
  // Identity
  canonicalPlayerId: string;
  position: "QB" | "RB" | "WR" | "TE";
  historicalSeason: number;
  projectionSeason: number;

  // Role weeks
  historicalActiveWeeks: number;
  historicalRoleWeeks: number;
  roleWeekNumbers: number[];
  nonRoleWeekNumbers: number[];
  roleParticipationFactor: number;

  // Opportunity totals
  totals: SeasonOpportunityTotals;

  // Role/sample classification
  roleSampleClass: RoleSampleClass;
  roleSampleConfidence: ProjectionConfidenceLabel;
  classificationInputs: ClassificationInputs;

  // Games projections
  projectedAvailability: ProjectedAvailability;

  // H8 evidence evaluation
  h8Evaluation: H8EvidenceEvaluation;

  // Confidence
  projectionConfidence: ProjectionConfidence;

  // Uncertainty and volatility
  modelUncertainty: number;
  playerVolatility: number;
  totalRangeWidth: number;

  // Aggregated reason codes from all passes
  allReasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function buildRoleProjectionFoundation(
  input: HistoricalPlayerProjectionInput
): PlayerRoleProjectionFoundation {
  // Pass 1: role weeks and opportunity totals
  const rw: RoleWeekResult = computeRoleWeeks(input.weeklyStats, input.position);

  // Pass 2: role/sample classification
  const classification: RoleSampleClassification = classifyRoleSample(input.position, rw);

  // Pass 3: projected availability
  const projectedAvailability: ProjectedAvailability = computeProjectedAvailability(
    classification.roleSampleClass,
    rw
  );

  // Pass 4: H8 evidence evaluation
  const h8Evaluation: H8EvidenceEvaluation = evaluateH8Evidence(
    input.h8Fields,
    input.position
  );

  // Pass 5: projection confidence
  // In H9-lite baseline, isSingleSeasonOnly is always true (single historical season).
  const isSingleSeasonOnly = true;
  const projectionConfidence: ProjectionConfidence = computeProjectionConfidence(
    classification.roleSampleClass,
    rw.historicalActiveWeeks,
    h8Evaluation,
    isSingleSeasonOnly
  );

  // Pass 6: uncertainty and volatility
  const uncertaintyResult = computeUncertainty(
    input.position,
    classification.roleSampleClass,
    h8Evaluation,
    rw.totals,
    isSingleSeasonOnly
  );

  // Aggregate all reason codes
  const allReasonCodes = new Set<ReasonCode>([
    classification.roleSampleClass as ReasonCode,  // classification class code
    ...h8Evaluation.reasonCodes,
    ...uncertaintyResult.reasonCodes,
  ]);

  return {
    canonicalPlayerId: input.canonicalPlayerId,
    position: input.position,
    historicalSeason: input.historicalSeason,
    projectionSeason: input.projectionSeason,

    historicalActiveWeeks: rw.historicalActiveWeeks,
    historicalRoleWeeks: rw.historicalRoleWeeks,
    roleWeekNumbers: rw.roleWeekNumbers,
    nonRoleWeekNumbers: rw.nonRoleWeekNumbers,
    roleParticipationFactor: rw.roleParticipationFactor,

    totals: rw.totals,

    roleSampleClass: classification.roleSampleClass,
    roleSampleConfidence: classification.roleSampleConfidence,
    classificationInputs: classification.classificationInputs,

    projectedAvailability,

    h8Evaluation,

    projectionConfidence,

    modelUncertainty: uncertaintyResult.modelUncertainty,
    playerVolatility: uncertaintyResult.playerVolatility,
    totalRangeWidth: uncertaintyResult.totalRangeWidth,

    allReasonCodes: [...allReasonCodes],
  };
}
