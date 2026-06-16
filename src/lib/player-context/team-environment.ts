import type { ContextConfidence, Tendency } from "./player-context-types";

export type TeamEnvironmentContext = {
  playVolumeTendency: Tendency;
  scoringEnvironment: Tendency;
  offensiveLineContext: string | null;
  defensiveSnapContext: string | null;
  confidence: ContextConfidence;
  dataGaps: string[];
};

export function defaultTeamEnvironment(): TeamEnvironmentContext {
  return {
    playVolumeTendency: "unknown",
    scoringEnvironment: "unknown",
    offensiveLineContext: null,
    defensiveSnapContext: null,
    confidence: "very_low",
    dataGaps: ["team environment"],
  };
}
