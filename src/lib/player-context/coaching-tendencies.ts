import type { ContextConfidence, PaceTendency, Tendency } from "./player-context-types";

export type CoachingTendencies = {
  paceTendency: PaceTendency;
  passRateTendency: Tendency;
  rushRateTendency: Tendency;
  teUsageTendency: Tendency;
  rbTargetTendency: Tendency;
  idpTackleOpportunity: Tendency;
  confidence: ContextConfidence;
  dataGaps: string[];
};

export function defaultCoachingTendencies(): CoachingTendencies {
  return {
    paceTendency: "unknown",
    passRateTendency: "unknown",
    rushRateTendency: "unknown",
    teUsageTendency: "unknown",
    rbTargetTendency: "unknown",
    idpTackleOpportunity: "unknown",
    confidence: "very_low",
    dataGaps: ["coaching environment"],
  };
}
