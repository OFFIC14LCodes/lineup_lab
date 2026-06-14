// H7: Provider-neutral ADP type system
// All types are serialization-friendly (no class instances, no Date objects).

export type AdpProvider = "mfl" | "fantasypros" | "underdog" | "manual_csv";

export type AdpDraftType = "redraft" | "dynasty_startup" | "dynasty_rookie" | "best_ball";

export type AdpScoringFormat = "standard" | "ppr" | "half_ppr" | "custom";

export type AdpSourceConfidence = "high" | "medium" | "low" | "unknown";

// How the player was matched to a canonical player record
export type AdpIdentityMatchMethod =
  | "exact_id"                    // Matched via provider's external ID in player_external_ids
  | "normalized_name_position_team"
  | "normalized_name_position"
  | "ambiguous"                   // Multiple candidates — record left unresolved
  | "unresolved";                 // No candidate found

// Full provenance for one ADP format dimension.
// Every field is required so snapshots are self-describing.
export type AdpFormatProfile = {
  draftType: AdpDraftType;
  platform: string;               // e.g. "mfl", "sleeper", "underdog"
  scoringFormat: AdpScoringFormat;
  pprValue: number;               // 0 | 0.5 | 1.0
  tePremiumValue: number;         // extra PPR for TE only (0 | 0.25 | 0.5 | 0.75 | 1.0)
  rosterPositions: string[];      // e.g. ["QB","RB","RB","WR","WR","WR","TE","FLEX","K","DEF","BN","BN","BN","BN","BN","BN"]
  teamCount: number;
  isBestBall: boolean;
  isDynasty: boolean;
  isStartup: boolean;             // Dynasty startup vs ongoing dynasty
  isSuperflex: boolean;
  isTePremium: boolean;           // true when tePremiumValue > 0
};

// Immutable metadata for one ADP snapshot.
export type AdpSourceMeta = {
  provider: AdpProvider;
  sourceIdentifier: string;       // Slug: "{provider}-{season}-{format}-{date}"
  sourceUrl: string | null;       // URL where data was fetched (null for CSV uploads)
  capturedAt: string;             // ISO 8601 UTC when data was fetched/uploaded
  effectiveDate: string;          // ISO 8601 date the ADP values reflect (e.g. "2026-06-01")
  season: number;
  formatProfile: AdpFormatProfile;
  sampleSize: number | null;      // Number of drafts included; null if unknown
  sourceVersion: string | null;   // Provider version tag / date label
  fileHash: string;               // SHA-256 of raw source bytes; deduplication key
  parserVersion: string;          // e.g. "h7-mfl-parser-v1"
};

// Raw ADP data from a provider before identity resolution.
export type RawAdpRecord = {
  rawId: string | null;           // Provider's internal player ID
  rawName: string;                // Player name as returned by provider
  rawPosition: string | null;
  rawTeam: string | null;
  overallAdp: number;
  overallRank: number | null;
  positionalAdp: number | null;
  positionalRank: number | null;
  minPick: number | null;
  maxPick: number | null;
  stddev: number | null;
  sampleSize: number | null;
  extraFields: Record<string, unknown>;
};

// Resolved ADP record with canonical player identity attached.
export type PlayerAdpRecord = RawAdpRecord & {
  canonicalPlayerId: string | null;
  sleeperPlayerId: string | null;
  resolvedName: string | null;
  resolvedPosition: string | null;
  resolvedTeam: string | null;
  identityMatchMethod: AdpIdentityMatchMethod | null;
  identityMatchConfidence: number | null;   // 0–1
  isRookie: boolean;
  hasHistoricalProfile: boolean;
};

// A complete ADP snapshot (in-memory form; use adp_snapshots table for persistence).
export type AdpSnapshot = {
  id: string;
  sourceMeta: AdpSourceMeta;
  sourceConfidence: AdpSourceConfidence;
  importedAt: string;
  records: PlayerAdpRecord[];
  resolvedCount: number;
  unresolvedCount: number;
  ambiguousCount: number;
  rookieCount: number;
  totalRecords: number;
};

// Per-dimension scores comparing a snapshot's format to a league's format.
export type AdpFormatMatchDimensions = {
  pprValue: number;       // 0–1
  draftType: number;      // 0–1
  superflex: number;      // 0–1
  tePremium: number;      // 0–1
  teamCount: number;      // 0–1
  bestBall: number;       // 0–1
};

export type AdpFormatMatchScore = {
  snapshotId: string;
  leagueId: string;
  overallScore: number;           // 0–1 weighted composite
  dimensionScores: AdpFormatMatchDimensions;
  isCompatible: boolean;          // true when overallScore >= 0.55
  warnings: string[];
};

// Consensus ADP derived from one or more weighted snapshots for a player.
export type ConsensusAdpRecord = {
  canonicalPlayerId: string;
  playerName: string | null;
  position: string | null;
  nflTeam: string | null;
  isRookie: boolean;
  hasHistoricalProfile: boolean;
  overallAdp: number;
  overallRank: number;
  positionalAdp: number | null;
  positionalRank: number | null;
  adpStddev: number | null;       // Cross-snapshot std dev (null when single source)
  minPick: number | null;
  maxPick: number | null;
  providerCount: number;
  totalSampleSize: number | null;
  recencyWeight: number;          // Effective recency weight (0–1)
  formatWeight: number;           // Effective format-match weight (0–1)
  sourceSnapshots: string[];      // Snapshot IDs that contributed
};

// Historical League Value — actual past performance under a target league's scoring.
// NOT a projection. Derived from H6 profiles.
export type HistoricalLeagueValue = {
  canonicalPlayerId: string;
  playerName: string | null;
  position: string | null;
  nflTeam: string | null;
  season: number;
  leagueId: string;
  // Raw H6 inputs
  totalPoints: number;
  pointsPerGame: number;
  gamesWithValidScoringData: number;
  pointsAboveReplacement: number | null;
  replacementPointsPerGame: number | null;
  scoringCompletenessRatio: number;
  historicalScoreConfidence: "complete" | "high" | "moderate" | "low" | "unusable";
  // Derived
  adjustedParPerGame: number;     // PAR/G * confidencePenaltyFactor
  hlvScore: number;               // 0–100 normalized within position
  hlvRank: number;                // Overall rank across all positions
  hlvPositionalRank: number;
  confidencePenaltyFactor: number;
  notes: string[];
};

export type ValueSignal =
  | "strong_value"
  | "moderate_value"
  | "fair_value"
  | "slight_overdraft"
  | "clear_overdraft"
  | "insufficient_data";

export type DataQuality =
  | "complete"
  | "high"
  | "moderate"
  | "low"
  | "rookie_no_history"
  | "insufficient_data";

// Per-player value-versus-market comparison for a specific league.
export type ValueVsMarket = {
  canonicalPlayerId: string;
  playerName: string | null;
  position: string | null;
  nflTeam: string | null;
  leagueId: string;
  isRookie: boolean;
  // Market (ADP) side
  overallAdp: number | null;
  marketRank: number | null;
  // HLV side
  hlvScore: number | null;
  hlvRank: number | null;
  hlvPositionalRank: number | null;
  // Comparison
  rankDelta: number | null;       // marketRank - hlvRank; positive = HLV > market price
  adpDelta: number | null;        // overallAdp - hlvRank (same sign convention)
  valueSignal: ValueSignal;
  dataQuality: DataQuality;
};

export type AdpTierBasis = "market_adp" | "hlv_score";

// One tier within a position group (e.g. "WR Tier 1").
export type AdpTier = {
  position: string;
  tierNumber: number;
  tierLabel: string;
  playerIds: string[];
  tierBasis: AdpTierBasis;
  adpFloor: number | null;        // Highest ADP (worst) in this tier
  adpCeiling: number | null;      // Lowest ADP (best) in this tier
  tierGapAbove: number | null;    // ADP gap to the tier above (defines this tier's lower boundary)
};

// Explicit season model for the ADP board — three distinct season concepts.
// adpSeason: the year the ADP data was collected (2026)
// historicalPerformanceSeason: the year of actual historical stats (2025)
// leagueConfigSeason: the year's league settings applied to score history (2026)
// HLV = historical performance (historicalPerformanceSeason) scored under
// league config (leagueConfigSeason). NOT a forward projection.
export type AdpBoardSeasonModel = {
  adpSeason: number;
  historicalPerformanceSeason: number;
  leagueConfigSeason: number;
  leagueId: string;
  analysisAsOfDate: string;
};

// --------------------------------------------------------------------------
// H7.2: Format groups, snapshot compatibility, position-specific matching
// --------------------------------------------------------------------------

// Fundamental format group key — snapshots in the SAME group may be blended.
// Snapshots in DIFFERENT groups must NOT be blended into one consensus.
export type AdpFormatGroupKey =
  | "redraft_1qb"
  | "redraft_superflex"
  | "dynasty_startup_1qb"
  | "dynasty_startup_superflex"
  | "dynasty_ongoing_1qb"
  | "dynasty_ongoing_superflex"
  | "rookie_1qb"
  | "rookie_superflex"
  | "best_ball";

export type AdpFormatGroup = {
  key: AdpFormatGroupKey;
  label: string;
  snapshotIds: string[];
  isDynasty: boolean;
  isSuperflex: boolean;
  isStartup: boolean;
  isRookieOnly: boolean;
  isBestBall: boolean;
};

// Compatibility classification for a snapshot-pair.
// "incompatible" = fundamentally different player values (dynasty vs redraft, rookie vs full startup).
// "partially_compatible" = same draft type but format dimensions differ (superflex, PPR, team count).
// "compatible" = same group; may be blended with weighting.
export type SnapshotCompatibility = "compatible" | "partially_compatible" | "incompatible";

export type SnapshotCompatibilityReport = {
  compatibility: SnapshotCompatibility;
  reasons: string[];
};

// Per-position format-match score.
// QB is heavily sensitive to Superflex; TE to TE-premium; RB/WR to PPR.
export type PositionFormatMatchScore = {
  position: string;     // "QB" | "RB" | "WR" | "TE"
  score: number;        // 0–1 position-weighted composite
  warnings: string[];
};

// Per-provider ADP contribution for one player in a consensus.
export type AdpProviderContribution = {
  snapshotId: string;
  provider: string;       // e.g. "mfl", "fantasypros"
  capturedAt: string;     // ISO 8601
  overallAdp: number;
  effectiveWeight: number;  // 0–1 normalized contribution share
};

export type ConsensusMarketConfidence = "high" | "medium" | "low";

// Per-player provider breakdown attached to a consensus record.
export type ConsensusAdpBreakdown = {
  canonicalPlayerId: string;
  providerContributions: AdpProviderContribution[];
  providerDisagreement: number | null;  // max – min ADP across providers (null when single source)
  newestSourceDate: string | null;
  oldestSourceDate: string | null;
  marketConfidence: ConsensusMarketConfidence;
};

export type DraftStageVariance = "tight" | "normal" | "wide";

// Per-player availability probability model.
export type AvailabilityModel = {
  canonicalPlayerId: string;
  playerName: string | null;
  overallAdp: number;
  rawStddev: number | null;
  effectiveStddev: number;        // Stage-adjusted
  draftStageVariance: DraftStageVariance;
  probAvailableAt: Record<string, number>;  // JSON key is pick# string; value is 0–1 probability
};

// Input shape used by format-match: a league summary (subset of DraftDataLeague).
export type LeagueFormatInput = {
  leagueId: string;
  pprValue: number;
  tePremiumValue: number;
  teamCount: number;
  isDynasty: boolean;
  isBestBall: boolean;
  isSuperflex: boolean;
};
