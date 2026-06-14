import type { FantasyScoringComponent, FantasyScoringResult } from "@/lib/scoring";

export const OFFENSIVE_DRAFT_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export type OffensiveDraftPosition = (typeof OFFENSIVE_DRAFT_POSITIONS)[number];

export type JsonRecord = Record<string, unknown>;

export type DraftDataLeague = {
  id: string;
  user_id?: string | null;
  platform?: string | null;
  platform_league_id?: string | null;
  name: string | null;
  season: string | number | null;
  status?: string | null;
  total_teams: number | null;
  is_dynasty?: boolean | null;
  is_best_ball?: boolean | null;
  is_superflex?: boolean | null;
  is_two_qb?: boolean | null;
  te_premium?: boolean | null;
  scoring_settings_json: JsonRecord | null;
  roster_positions_json: unknown;
  settings_json?: JsonRecord | null;
};

export type DraftAnalysisMode = "historical_under_current_format" | "historical_under_historical_format";

export type DraftDataAnalysisContext = {
  performanceSeason: number;
  leagueConfigSeason: number;
  leagueId: string;
  leagueName: string | null;
  analysisAsOfDate: string;
  analysisMode: DraftAnalysisMode;
  leagueConfigurationSnapshotId: string | null;
};

export type DraftDataProvenance = DraftDataAnalysisContext & {
  scoringSettingsHash: string;
  rosterSettingsHash: string;
  formatProfileVersion: "h6-format-profile-v1";
  metricDefinitionVersion: "h6-metric-definitions-v1";
  sourceWeeklyStatRows: number;
  sourceWeeklyStatHash: string;
  derivedStatRows: number;
  derivedStatHash: string;
};

export type DraftDataPlayer = {
  id: string;
  full_name: string | null;
  position: string | null;
  team: string | null;
  primary_position?: string | null;
  position_group?: string | null;
  raw_position?: string | null;
};

export type DraftDataWeeklyRow = {
  id?: string;
  player_id: string;
  season: number;
  week: number;
  season_type: string;
  game_id: string | null;
  team: string | null;
  opponent: string | null;
  position_group: string | null;
  stats_json: JsonRecord;
  provider_fantasy_points?: number | null;
  metadata_json?: JsonRecord | null;
};

export type DraftDataDerivedWeeklyRow = {
  player_id: string;
  season: number;
  week: number;
  season_type: string;
  stat_scope: string;
  stats_json: JsonRecord;
  completeness: "complete" | "partial";
};

export type LeagueFormatProfile = {
  leagueId: string;
  performanceSeason: number;
  leagueConfigSeason: number;
  teamCount: number;
  rosterSlots: string[];
  directStarters: Record<OffensiveDraftPosition, number>;
  offensiveFlexCount: number;
  superflexCount: number;
  benchCount: number;
  isDynasty: boolean;
  isBestBall: boolean;
  isSuperflex: boolean;
  isTwoQb: boolean;
  tePremium: {
    detected: boolean;
    ppr: number;
    teReceptionPremium: number;
  };
  scoring: {
    passingTd: number | null;
    reception: number;
    firstDownKeys: string[];
    bonusKeys: string[];
    activeKeyCount: number;
  };
  notes: string[];
};

export type WeeklyFinishDistribution = {
  weeks: number;
  buckets: Record<string, number>;
  rates: Record<string, number>;
};

export type ComponentShares = {
  touchdowns: number;
  receptions: number;
  passingYardage: number;
  rushingYardage: number;
  receivingYardage: number;
  other: number;
};

export type DraftRanks = {
  overallTotal: number | null;
  positionTotal: number | null;
  positionPpg: number | null;
  positionMedian: number | null;
  positionConsistency: number | null;
  positionCeiling: number | null;
  ppgSmallSample: boolean;
};

// Classification of PBP-derived batch completeness for a season.
// "complete"  — a finished batch exists; absent derived rows = known zero.
// "partial"   — batch ran but did not finish; absent rows = unknown.
// "not_run"   — no batch record; all derived keys are unknown.
export type PbpDerivedBatchStatus = "complete" | "partial" | "not_run";

// Per-key scoring gap classification.
export type ProfileLimitationReason =
  | "known_zero_inferred"       // PBP complete; no event → definitively 0
  | "missing_merge"             // PBP incomplete or player identity unresolved
  | "unsupported_engine"        // Scoring engine has no rule for this key
  | "unavailable_dataset";      // Required dataset (team context, projections) not yet wired

export type ProfileLimitation = {
  scoringKey: string;
  reason: ProfileLimitationReason;
  estimatedMaxPointImpactPerGame: number | null;
  couldAffectPositionRank: boolean;
  couldAffectReplacementValue: boolean;
};

export type ScoringCompleteness = {
  validScoredWeeksOnly: true;
  gamesWithValidScoringData: number;
  // New structured completeness fields (H6.1)
  applicableKeyCount: number;
  evaluatedKeyCount: number;
  knownZeroKeyCount: number;
  unsupportedEngineKeyCount: number;
  unavailableDatasetKeyCount: number;
  incompleteSourceKeyCount: number;
  missingMergeKeyCount: number;
  scoringCompletenessRatio: number;
  historicalScoreConfidence: "complete" | "high" | "moderate" | "low" | "unusable";
  // Legacy fields kept for backwards compatibility
  coverageRatio: number;
  validationStatus: "complete_for_stored_rows" | "partial_missing_scoring_keys" | "no_valid_rows";
  unsupportedScoringKeys: string[];
  missingStatsForSupportedKeys: string[];
  knownZeroStatsForSupportedKeys: string[];
  warnings: string[];
};

export type ReplacementSummary = {
  leagueId: string;
  performanceSeason: number;
  leagueConfigSeason: number;
  methodVersion: "h6-preliminary-v1";
  methodology: string;
  positionSummaries: Record<
    OffensiveDraftPosition,
    {
      starterDemand: number;
      replacementRank: number;
      replacementPlayerId: string | null;
      replacementPlayerName: string | null;
      replacementPointsPerGame: number | null;
      eligiblePlayerCount: number;
    }
  >;
};

export type PlayerSituationSignal<T = unknown> = {
  status: "unknown" | "known";
  value: T | null;
  source: string | null;
  updatedAt: string | null;
  confidence: "unknown" | "low" | "medium" | "high";
};

export type PlayerSituationProfile = {
  playerId: string;
  performanceSeason: number;
  team: PlayerSituationSignal<string>;
  depthChartRole: PlayerSituationSignal<string>;
  projectedRole: PlayerSituationSignal<string>;
  injuryStatus: PlayerSituationSignal<string>;
  offensiveLineContext: PlayerSituationSignal<string>;
  quarterbackContext: PlayerSituationSignal<string>;
  teammateCompetition: PlayerSituationSignal<string>;
  coachingScheme: PlayerSituationSignal<string>;
};

export type LeagueSummary = {
  leagueId: string;
  totalProfiles: number;
  completeProfiles: number;
  highConfidenceProfiles: number;
  moderateConfidenceProfiles: number;
  lowConfidenceProfiles: number;
  unusableProfiles: number;
  averageScoringCompletenessRatio: number;
  minimumScoringCompletenessRatio: number;
  activeScoringKeyCount: number;
  positionBreakdown: Record<OffensiveDraftPosition, { count: number; averageCompleteness: number }>;
  mostCommonLimitationKeys: Array<{ scoringKey: string; reason: ProfileLimitationReason; affectedProfileCount: number }>;
  // Active league scoring keys that belong to DEF/IDP/K — not applicable to any offensive profile.
  outOfScopeLeagueScoringKeys: string[];
};

export type PlayerLeagueSeasonProfile = {
  leagueId: string;
  performanceSeason: number;
  leagueConfigSeason: number;
  analysisMode: DraftAnalysisMode;
  provenance: DraftDataProvenance;
  playerId: string;
  playerName: string;
  position: OffensiveDraftPosition;
  nflTeam: string | null;
  gamesWithValidScoringData: number;
  gamesPlayed: number;
  gamesStarted: number | null;
  totalPoints: number;
  pointsPerGame: number;
  medianPoints: number;
  minPoints: number;
  maxPoints: number;
  stddevPoints: number;
  coefficientOfVariation: number | null;
  zeroPointWeeks: number;
  negativePointWeeks: number;
  floorPoints: number;
  medianRangePoints: number;
  ceilingPoints: number;
  bestThreeWeekAverage: number | null;
  worstThreeWeekAverage: number | null;
  topThreeShare: number;
  weeklyFinishDistribution: WeeklyFinishDistribution;
  componentShares: ComponentShares;
  scoringCompleteness: ScoringCompleteness;
  ranks: DraftRanks;
  replacement: {
    replacementPointsPerGame: number | null;
    pointsAboveReplacement: number | null;
  };
  situationProfile: PlayerSituationProfile;
  limitations: ProfileLimitation[];
};

export type ScoredWeeklyPlayer = {
  playerId: string;
  playerName: string;
  position: OffensiveDraftPosition;
  nflTeam: string | null;
  season: number;
  week: number;
  points: number;
  scoring: FantasyScoringResult;
  components: FantasyScoringComponent[];
  stats: JsonRecord;
};

export type DraftDataAggregationResult = {
  generatedAt: string;
  provenance: DraftDataProvenance;
  leagueFormat: LeagueFormatProfile;
  profiles: PlayerLeagueSeasonProfile[];
  replacementSummary: ReplacementSummary;
  leagueSummary: LeagueSummary;
  diagnostics: {
    sourceWeeklyRows: number;
    resolvedOffensiveWeeklyRows: number;
    unresolvedIdentityRows: number;
    profileCount: number;
    minimumGamesForPpgRank: number;
    knownZeroInferencesApplied: number;
    pbpDerivedBatchStatus: PbpDerivedBatchStatus;
    notes: string[];
  };
};

export type TeamContextFoundation = {
  season: number;
  teamCount: number;
  teams: Array<{
    teamId: string;
    games: number;
    pointsScoredPerGame: number | null;
    pointsAllowedPerGame: number | null;
    offensiveYardsPerGame: number | null;
    yardsAllowedPerGame: number | null;
    sourceStatus: "available_from_team_game_stats" | "missing";
  }>;
  limitations: string[];
};

export type ContextRoadmapItem = {
  area: string;
  purpose: string;
  currentStatus: "schema_only" | "foundation_available" | "not_started";
  currentSource: string;
  futureSourceCandidates: string[];
  refreshCadence: string;
  confidencePolicy: string;
};
