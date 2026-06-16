import type { IdentityMatchConfidence, PlayerIdentityIds } from "@/lib/data-acquisition/player-identity";
import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

export type PlayerProfileWarning =
  | "unmatched_identity"
  | "weak_identity_match"
  | "low_sample_size"
  | "no_weekly_stats"
  | "possible_duplicate_conflict"
  | "unsupported_missing_stat_columns";

export type PlayerProfileScoringProfile = {
  id: string;
  label: string;
  version: string;
  scoringSettings: Record<string, number>;
  notes: string[];
};

export type PlayerProfileWeeklyStats = {
  season: number | null;
  week: number | null;
  team: string | null;
  opponent: string | null;
  passing: Record<string, number | null>;
  rushing: Record<string, number | null>;
  receiving: Record<string, number | null>;
  kicking: Record<string, number | null>;
  defensive: Record<string, number | null>;
  calculatedFantasyPoints: number;
  scoringWarnings: string[];
};

export type PlayerProfileSeasonSummary = {
  season: number | null;
  gamesPlayed: number;
  totalFantasyPoints: number;
  pointsPerGame: number | null;
  positionRank: number | null;
  keyStatTotals: Record<string, number>;
};

export type PlayerProfileConsistencyMetrics = {
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  floorPercentile20: number | null;
  ceilingPercentile80: number | null;
  ceilingPercentile90: number | null;
  boomWeeks: number;
  bustWeeks: number;
  startableWeeks: number;
  consistencyScore: number;
  spikeWeekScore: number;
};

export type PlayerProfileAvailabilityMetrics = {
  weeksWithStatRows: number;
  missedWeekEstimate: number | null;
  gamesPlayed: number;
  availabilityScore: number;
};

export type PlayerProfileRecommendationSignals = {
  floorScore: number;
  ceilingScore: number;
  consistencyScore: number;
  spikeScore: number;
  availabilityScore: number;
  volatilityLabel: "low" | "medium" | "high" | "unknown";
  formatFitHints: {
    redraft: string;
    dynasty: string;
    bestBall: string;
    idp: string | null;
  };
};

export type HistoricalPlayerProfileSnapshot = {
  identity: {
    blackbirdPlayerId: string | null;
    sleeperId: string | null;
    gsisId: string;
    espnId: string | null;
    pfrId: string | null;
    nflId: string | null;
    smartId: string | null;
    matchConfidence: IdentityMatchConfidence;
    matchReasons: string[];
    preservedIds: PlayerIdentityIds;
  };
  bio: {
    name: string;
    position: BlackbirdNflversePosition;
    normalizedPosition: BlackbirdNflversePosition;
    team: string | null;
    status: string | null;
    active: boolean | null;
    age: number | null;
    birthDate: string | null;
    height: number | null;
    weight: number | null;
    college: string | null;
    rookieSeason: number | null;
    yearsExperience: number | null;
  };
  weeklyStats: PlayerProfileWeeklyStats[];
  seasonSummaries: PlayerProfileSeasonSummary[];
  consistencyMetrics: PlayerProfileConsistencyMetrics;
  availabilityMetrics: PlayerProfileAvailabilityMetrics;
  recommendationSignals: PlayerProfileRecommendationSignals;
  profileWarnings: PlayerProfileWarning[];
};

export type PlayerProfilesDiagnostics = {
  generatedAt: string;
  dryRun: true;
  totalProfilesBuilt: number;
  profilesByPosition: Record<string, number>;
  profilesByMatchConfidence: Record<string, number>;
  profilesWithWeeklyStats: number;
  profilesWithoutWeeklyStats: number;
  profilesWithIdpStats: number;
  profilesWithWarnings: number;
  skippedMatches: {
    unmatched: number;
    conflict: number;
    missingGsisId: number;
  };
  sampleTopProfilesByPosition: Record<string, Array<{ playerName: string; gsisId: string; totalFantasyPoints: number; gamesPlayed: number }>>;
  scoringProfileUsed: PlayerProfileScoringProfile;
  limitations: string[];
};

export type PlayerProfilesBuildResult = {
  generatedAt: string;
  dryRun: true;
  scoringProfile: PlayerProfileScoringProfile;
  profiles: HistoricalPlayerProfileSnapshot[];
  diagnostics: PlayerProfilesDiagnostics;
};
