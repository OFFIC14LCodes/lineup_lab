export type IdentityReviewPriority = "P1" | "P2" | "P3" | "P4";

export type IdentityReviewRecommendedAction =
  | "manual_review_required"
  | "likely_safe_ignore"
  | "needs_manual_override"
  | "improve_normalization"
  | "provider_missing_id"
  | "possible_duplicate"
  | "unsupported_position";

export type IdentityReviewQueueRow = {
  sourcePlayerId: string;
  sleeperId: string | null;
  blackbirdPlayerId: string | null;
  playerName: string;
  normalizedName: string;
  position: string | null;
  normalizedPosition: string | null;
  team: string | null;
  status: string | null;
  active: boolean | null;
  searchRank: number | null;
  yearsExperience: number | null;
  college: string | null;
  age: number | null;
  birthDate: string | null;
  height: number | null;
  weight: number | null;
  candidateNflversePlayerIds: string[];
  candidateNames: string[];
  candidateTeams: Array<string | null>;
  candidatePositions: Array<string | null>;
  matchConfidence: string;
  matchReasons: string[];
  conflictReasons: string[];
  recommendedAction: IdentityReviewRecommendedAction;
  reviewPriority: IdentityReviewPriority;
};

export type IdentityReviewQueue = {
  generatedAt: string;
  activeUnmatched: IdentityReviewQueueRow[];
  activeConflicts: IdentityReviewQueueRow[];
  summary: {
    activeUnmatchedRows: number;
    activeConflictRows: number;
    byPriority: Record<string, number>;
    byPosition: Record<string, number>;
    byTeam: Record<string, number>;
    byRecommendedAction: Record<string, number>;
    byConflictReason: Record<string, number>;
    byUnmatchedReason: Record<string, number>;
  };
};
