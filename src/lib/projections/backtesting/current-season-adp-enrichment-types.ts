import type { HistoricalAdpNormalizedRow } from "./historical-adp-source-types";
import type { HistoricalMarketAnchorConfidenceBucket } from "./historical-market-anchor-rank-types";

export type CurrentSeasonAdpEnrichmentRecommendation =
  | "current_adp_enrichment_ready_for_market_anchor_review"
  | "current_adp_enrichment_needs_current_universe"
  | "current_adp_enrichment_needs_identifier_mapping"
  | "current_adp_enrichment_blocked";

export type CurrentSeasonAdpMatchMethod =
  | "player_id_exact"
  | "sleeper_id_exact"
  | "gsis_id_exact"
  | "name_position_team_unique"
  | "unique_name_position"
  | "review_candidate"
  | "unmatched";

export type CurrentSeasonUniversePlayer = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  normalizedPlayerName: string;
  position: string;
  team: string | null;
  projectedPoints: number | null;
  modelRank: number | null;
  confidence: string | null;
  confidenceScore: number | null;
  policyGroup: string | null;
  activePolicyClass: string | null;
  sourceVariant: string | null;
};

export type CurrentSeasonAdpMatch = {
  adpRow: HistoricalAdpNormalizedRow;
  universePlayerId: string | null;
  universePlayerName: string | null;
  matchMethod: CurrentSeasonAdpMatchMethod;
  confidence: "exact" | "high" | "review" | "none";
  notes: string[];
};

export type CurrentSeasonAdpEnrichedPlayer = CurrentSeasonUniversePlayer & {
  adp: number | null;
  marketRank: number | null;
  marketFormat: string;
  externalMarketSource: string | null;
  externalMarketMatchConfidence: string | null;
  externalMarketNotes: string[];
  marketAnchorRank: number | null;
  marketAnchorMovement: number;
  marketAnchorConfidenceBucket: HistoricalMarketAnchorConfidenceBucket;
};

export type CurrentSeasonAdpMovementRow = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  modelRank: number | null;
  marketRank: number | null;
  marketAnchorRank: number | null;
  movement: number;
  confidenceBucket: HistoricalMarketAnchorConfidenceBucket;
  policyGroup: string | null;
};

export type CurrentSeasonAdpEnrichmentReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  marketFormat: string;
  recommendation: CurrentSeasonAdpEnrichmentRecommendation;
  sourceArtifacts: {
    adpPath: string;
    snapshotPath: string;
    activePolicyPath: string;
  };
  sourceDiscovery: {
    adpExists: boolean;
    snapshotExists: boolean;
    activePolicyExists: boolean;
    currentUniverseRows: number;
  };
  matchQuality: {
    currentUniverseRows: number;
    adpRowsForSelectedMarketFormat: number;
    exactIdMatches: number;
    nameTeamPositionMatches: number;
    uniqueNamePositionMatches: number;
    reviewCandidates: number;
    unmatchedAdpRows: number;
    universeRowsWithoutAdp: number;
    coverageByPosition: Record<string, { universeRows: number; matchedRows: number; coverageRate: number }>;
    coverageByActivePolicyGroup: Record<string, { universeRows: number; matchedRows: number; coverageRate: number }>;
    coverageByConfidenceBucket: Record<string, { universeRows: number; matchedRows: number; coverageRate: number }>;
  };
  marketSanityPreview: {
    playersWithMarketAdp: number;
    playersWithoutMarketAdp: number;
    averageRankMovement: number;
    maxRankMovement: number;
    top25MovedUp: CurrentSeasonAdpMovementRow[];
    top25MovedDown: CurrentSeasonAdpMovementRow[];
    movementByPosition: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
    movementByConfidenceBucket: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
    movementByActivePolicyGroup: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
    unsupportedPositionsFiltered: string[];
    unsupportedPlayersFiltered: number;
    kRowsPresentInAdp: boolean;
    kExcludedByNoKLeague: boolean;
  };
  warRoomSafetyPreview: {
    adpMarketSourceParsed: boolean;
    superflexMarketRowsAvailable: boolean;
    kRowsExistInAdpSource: boolean;
    kExcludedByRosterEligibilityWhenNoKSlot: boolean;
    dstIdpExcludedWhenUnsupported: boolean;
    liveDraftSuggestionsUnchanged: true;
    liveBlackbirdRankUnchanged: true;
  };
  matches: CurrentSeasonAdpMatch[];
  enrichedUniverse: CurrentSeasonAdpEnrichedPlayer[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type CurrentSeasonAdpEnrichmentArtifactPaths = {
  reportJsonPath: string;
  reportMarkdownPath: string;
  reportCsvPath: string;
  enrichedJsonPath: string;
  enrichedCsvPath: string;
};
