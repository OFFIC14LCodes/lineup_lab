import type { ContextConfidence } from "./player-context-types";

export function deriveInjuryRisk(input: {
  gamesMissedLastSeason: number | null;
  gamesMissedLast3Seasons: number | null;
  notableInjuries: string[];
  currentInjuryStatus: string | null;
  majorSurgeryFlag?: boolean | null;
  repeatedSoftTissueFlag?: boolean | null;
}): { injuryRisk: "low" | "medium" | "high" | "unknown"; riskReasons: string[]; confidence: ContextConfidence } {
  const hasData = input.gamesMissedLastSeason !== null || input.gamesMissedLast3Seasons !== null || input.notableInjuries.length > 0 || input.currentInjuryStatus !== null || input.majorSurgeryFlag != null || input.repeatedSoftTissueFlag != null;
  if (!hasData) return { injuryRisk: "unknown", riskReasons: ["No sourced injury history is available."], confidence: "very_low" };
  const missed3 = input.gamesMissedLast3Seasons ?? 0;
  const missed1 = input.gamesMissedLastSeason ?? 0;
  if (input.majorSurgeryFlag || input.repeatedSoftTissueFlag || missed3 >= 12 || missed1 >= 6) {
    return { injuryRisk: "high", riskReasons: ["Sourced injury context indicates elevated missed-game or injury-history risk."], confidence: "medium" };
  }
  if (missed3 >= 5 || missed1 >= 3 || input.notableInjuries.length > 0 || input.currentInjuryStatus) {
    return { injuryRisk: "medium", riskReasons: ["Sourced injury context indicates some missed-game or injury note risk."], confidence: "medium" };
  }
  return { injuryRisk: "low", riskReasons: ["Sourced injury context shows limited missed-game signal."], confidence: "medium" };
}
