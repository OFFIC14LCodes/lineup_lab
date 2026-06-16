import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

export type IdentityMatchConfidence = "manual_override" | "exact_id" | "strong" | "medium" | "weak" | "unmatched" | "conflict";

export type PlayerIdentitySource = "blackbird_context" | "blackbird_rookie" | "sleeper_export" | "sleeper_repair_diagnostic" | "nflverse_players" | "nflverse_rosters" | "nflverse_player_stats";

export type PlayerIdentityIds = {
  blackbirdPlayerId: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  espnId: string | null;
  pfrId: string | null;
  nflId: string | null;
  smartId: string | null;
};

export type PlayerIdentityRecord = {
  source: PlayerIdentitySource;
  playerId: string;
  playerName: string;
  normalizedName: string;
  position: BlackbirdNflversePosition | null;
  rawPosition: string | null;
  team: string | null;
  rookieSeason: number | null;
  birthDate: string | null;
  height: number | null;
  weight: number | null;
  age: number | null;
  yearsExperience: number | null;
  college: string | null;
  active: boolean | null;
  status: string | null;
  searchRank: number | null;
  ids: PlayerIdentityIds;
  externalIds: Record<string, string>;
  sourceRefs: string[];
};

export type PlayerIdentityMatch = {
  sourcePlayer: PlayerIdentityRecord;
  matchedPlayer: PlayerIdentityRecord | null;
  confidence: IdentityMatchConfidence;
  score: number;
  matchReasons: string[];
  conflictReasons: string[];
  candidateCount: number;
  candidateExamples: Array<{
    playerId: string;
    playerName: string;
    position: string | null;
    team: string | null;
    score: number;
    reasons: string[];
  }>;
  preservedIds: PlayerIdentityIds;
};
