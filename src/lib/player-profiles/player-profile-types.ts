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
  floor?: number | null;
  median?: number | null;
  ceiling?: number | null;
  consistencyScore?: number;
  spikeScore?: number;
  availabilityScore?: number;
};

export type PlayerProfileCoverageLabel =
  | "career_from_rookie"
  | "partial_career"
  | "recent_only"
  | "single_season"
  | "no_weekly_stats";

export type PlayerProfileTrendLabel = "rising" | "stable" | "declining" | "volatile" | "insufficient_data";

export type PlayerProfileCareerMetadata = {
  rookieSeason: number | null;
  firstStatSeason: number | null;
  latestStatSeason: number | null;
  seasonsWithStats: number[];
  seasonsOnRoster: number[];
  careerGamesWithStatRows: number;
  activeSeasonsCount: number;
  coverageLabel: PlayerProfileCoverageLabel;
  coverageNote: string | null;
};

export type PlayerProfileCareerSummary = {
  careerGames: number;
  careerTotalPoints: number;
  careerPointsPerGame: number | null;
  careerFloor: number | null;
  careerMedian: number | null;
  careerCeiling: number | null;
  careerConsistencyScore: number;
  careerSpikeScore: number;
  careerAvailabilityScore: number;
  bestSeasonByTotalPoints: PlayerProfileSeasonSummary | null;
  bestSeasonByPpg: PlayerProfileSeasonSummary | null;
  mostRecentSeason: PlayerProfileSeasonSummary | null;
  last2Seasons: PlayerProfileSeasonSummary | null;
  last3Seasons: PlayerProfileSeasonSummary | null;
};

export type PlayerProfileTrendMetrics = {
  ppgTrend: number | null;
  availabilityTrend: number | null;
  consistencyTrend: number | null;
  spikeTrend: number | null;
  roleVolumeTrend: number | null;
  trendLabel: PlayerProfileTrendLabel;
};

export type PlayerProfileRoleLabel =
  | "workhorse"
  | "lead_back"
  | "receiving_back"
  | "committee_back"
  | "alpha_receiver"
  | "volume_receiver"
  | "field_stretcher"
  | "rushing_qb"
  | "pocket_qb"
  | "low_usage"
  | "tackle_floor"
  | "sack_upside"
  | "big_play_dependent"
  | "balanced"
  | "insufficient_data";

export type PlayerProfileRoleModifier =
  | "full_time_role"
  | "part_time_role"
  | "rotational_role"
  | "special_teams_only"
  | "snap_share_rising"
  | "snap_share_declining"
  | "production_without_full_role"
  | "full_role_low_production";

export type PlayerProfileHighValueRoleModifier =
  | "goal_line_role"
  | "red_zone_role"
  | "end_zone_target_role"
  | "deep_threat"
  | "high_value_touch_role"
  | "td_dependent"
  | "low_high_value_usage"
  | "high_value_usage_rising"
  | "high_value_usage_declining";

export type PlayerProfileRoleConfidence = "high" | "medium" | "low";

export type PlayerProfileRoleWarning =
  | "snap_data_unavailable"
  | "participation_data_unavailable"
  | "play_by_play_data_unavailable"
  | "weekly_stat_usage_only"
  | "low_usage_sample"
  | "td_dependent"
  | "big_play_dependent"
  | "low_snap_share"
  | "fragile_role"
  | "opportunity_without_production"
  | "declining_snap_share"
  | "snap_join_low_confidence";

export type PlayerProfileHighValueRoleWarning =
  | "play_by_play_data_unavailable"
  | "high_value_usage_unavailable"
  | "low_high_value_usage_sample"
  | "td_dependent"
  | "big_play_dependent"
  | "low_high_value_usage"
  | "high_value_usage_declining";

export type PlayerProfileWeeklyUsage = {
  season: number | null;
  week: number | null;
  opportunities: number;
  touches: number;
  carries: number;
  targets: number;
  receptions: number;
  passAttempts: number;
  totalYards: number;
  totalTouchdowns: number;
  soloTackles: number;
  assistedTackles: number;
  sacks: number;
  splashPlays: number;
  offenseSnaps: number | null;
  defenseSnaps: number | null;
  specialTeamsSnaps: number | null;
  offensiveSnapShare: number | null;
  defensiveSnapShare: number | null;
  specialTeamsSnapShare: number | null;
  participationOffensePlays: number | null;
  participationDefensePlays: number | null;
};

export type PlayerProfileUsageSummary = {
  sourceBasis: "weekly_stats" | "weekly_stats_plus_snaps" | "unavailable";
  gamesWithUsage: number;
  opportunitiesPerGame: number | null;
  touchesPerGame: number | null;
  carriesPerGame: number | null;
  targetsPerGame: number | null;
  receptionsPerGame: number | null;
  passAttemptsPerGame: number | null;
  yardsPerTouch: number | null;
  touchdownDependency: number | null;
  receivingUsageShare: number | null;
  rushingUsageShare: number | null;
  targetVolumePerGame: number | null;
  tackleFloorScore: number | null;
  bigPlayDependencyScore: number | null;
  sackDependencyScore: number | null;
  gamesWithSnapData: number;
  gamesWithParticipationData: number;
  weeklyUsageConsistency: number;
  offensiveSnapShare: number | null;
  defensiveSnapShare: number | null;
  specialTeamsSnapShare: number | null;
  gamesOver70PercentSnaps: number | null;
  gamesUnder40PercentSnaps: number | null;
  trendLabel: PlayerProfileTrendLabel;
};

export type PlayerProfileSeasonUsageSummary = PlayerProfileUsageSummary & {
  season: number | null;
  games: number;
};

export type PlayerProfileWeeklyHighValueUsage = {
  season: number | null;
  week: number | null;
  carries: number;
  targets: number;
  receptions: number;
  rushTouchdowns: number;
  receivingTouchdowns: number;
  passingAttempts: number;
  redZoneCarries: number;
  inside10Carries: number;
  inside5Carries: number;
  goalLineCarries: number;
  redZoneTargets: number;
  inside10Targets: number;
  endZoneTargets: number;
  deepTargets: number;
  thirdDownTargets: number;
  twoMinuteTargets: number;
  highValueTouches: number;
  highValueTargets: number;
  airYards: number | null;
  redZonePassAttempts: number;
  designedQbRushes: number;
  scrambles: number;
};

export type PlayerProfileHighValueUsageSummary = {
  sourceStatus: "available" | "unavailable";
  gamesWithHighValueUsage: number;
  highValueTouchesPerGame: number | null;
  highValueTargetsPerGame: number | null;
  redZoneCarriesPerGame: number | null;
  inside10CarriesPerGame: number | null;
  inside5CarriesPerGame: number | null;
  goalLineCarriesPerGame: number | null;
  redZoneTargetsPerGame: number | null;
  inside10TargetsPerGame: number | null;
  endZoneTargetsPerGame: number | null;
  deepTargetsPerGame: number | null;
  thirdDownTargetsPerGame: number | null;
  twoMinuteTargetsPerGame: number | null;
  airYardsPerTarget: number | null;
  redZonePassAttemptsPerGame: number | null;
  designedQbRushesPerGame: number | null;
  scramblesPerGame: number | null;
  highValueUsageShare: number | null;
  targetHighValueShare: number | null;
  touchdownDependency: number | null;
  trendLabel: PlayerProfileTrendLabel;
  modifiers: PlayerProfileHighValueRoleModifier[];
};

export type PlayerProfileSeasonHighValueUsageSummary = PlayerProfileHighValueUsageSummary & {
  season: number | null;
  games: number;
};

export type PlayerProfileRoleMetrics = {
  roleLabel: PlayerProfileRoleLabel;
  roleConfidence: PlayerProfileRoleConfidence;
  roleStabilityLabel: "high" | "medium" | "low" | "unknown";
  idpArchetype: "tackle_floor" | "big_play_edge" | "coverage_playmaker" | "balanced_idp" | "low_signal" | null;
  roleModifiers: PlayerProfileRoleModifier[];
  roleTrend: PlayerProfileTrendLabel;
  keySignals: string[];
  dataGaps: string[];
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
  careerMetadata?: PlayerProfileCareerMetadata;
  careerSummary?: PlayerProfileCareerSummary;
  trendMetrics?: PlayerProfileTrendMetrics;
  usageSummary?: PlayerProfileUsageSummary;
  seasonUsageSummaries?: PlayerProfileSeasonUsageSummary[];
  weeklyUsage?: PlayerProfileWeeklyUsage[];
  highValueUsageSummary?: PlayerProfileHighValueUsageSummary;
  seasonHighValueUsageSummaries?: PlayerProfileSeasonHighValueUsageSummary[];
  weeklyHighValueUsage?: PlayerProfileWeeklyHighValueUsage[];
  highValueRoleWarnings?: PlayerProfileHighValueRoleWarning[];
  roleMetrics?: PlayerProfileRoleMetrics;
  roleWarnings?: PlayerProfileRoleWarning[];
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
  profilesWithMultiSeasonData?: number;
  profilesWithOnlyOneSeason?: number;
  profilesWithFullRookieToCurrentCoverage?: number;
  profilesWithPartialCoverage?: number;
  profilesByCoverageLabel?: Record<string, number>;
  seasonsIncluded?: number[];
  sourceFilesUsed?: {
    playerStats: string;
    rosters: string;
  };
  sourceRows?: {
    weeklyStats: number;
    rosters: number;
  };
  minSeason?: number | null;
  maxSeason?: number | null;
  artifactSizeBytes?: number | null;
  profilesWithIdpStats: number;
  profilesWithWarnings: number;
  profilesWithUsageSummary?: number;
  profilesWithOffensiveUsage?: number;
  profilesWithIdpUsage?: number;
  profilesWithSnapData?: number;
  profilesMissingSnapData?: number;
  profilesWithHighValueUsage?: number;
  profilesWithRedZoneUsage?: number;
  profilesWithEndZoneTargets?: number;
  profilesWithGoalLineCarries?: number;
  profilesWithDeepTargets?: number;
  profilesWithRoleLabel?: number;
  roleLabelsByPosition?: Record<string, Record<string, number>>;
  usageSourceFiles?: {
    used: string[];
    missing: string[];
    snapCounts?: {
      exists: boolean;
      rowCount: number;
      seasons: number[];
      requiredColumns: string[];
      missingColumns: string[];
      playersWithPfrId: number;
      matchedRows: number;
      unmatchedRows: number;
    };
    participation?: {
      exists: boolean;
      rowCount: number;
      seasons: number[];
      requiredColumns: string[];
      missingColumns: string[];
      playersWithGsisId: number;
      matchedRows: number;
      unmatchedRows: number;
    };
    pbp?: {
      exists: boolean;
      selectedFile: string | null;
      candidateFiles: string[];
      rowCount: number;
      seasons: number[];
      requiredColumns: string[];
      missingColumns: string[];
      derivedPlayerWeekRows: number;
      playersWithGsisId: number;
      matchedRows: number;
      unmatchedRows: number;
    };
  };
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
