import type { HistoricalMockDraftPlayer } from "./historical-mock-draft-engine-types";

export type HistoricalAdpSourceRecommendation =
  | "historical_adp_source_ready_for_market_anchor_retest"
  | "historical_adp_source_needs_real_csv"
  | "historical_adp_source_needs_historical_universe"
  | "historical_adp_source_needs_identifier_mapping"
  | "historical_adp_source_blocked";

export type HistoricalAdpNormalizedRow = {
  season: number;
  source: string;
  asOfDate: string | null;
  scoringFormat?: string | null;
  playerName: string;
  normalizedPlayerName: string;
  position: string;
  team: string | null;
  adp: number | null;
  rank: number;
  sleeperId: string | null;
  gsisId: string | null;
  playerId: string | null;
  notes: string[];
};

export type HistoricalAdpMatchMethod =
  | "player_id_exact"
  | "sleeper_id_exact"
  | "gsis_id_exact"
  | "name_position_team_unique"
  | "name_position_review_candidate"
  | "unmatched";

export type HistoricalAdpUniverseMatch = {
  adpRow: HistoricalAdpNormalizedRow;
  universePlayerId: string | null;
  universePlayerName: string | null;
  matchMethod: HistoricalAdpMatchMethod;
  confidence: "exact" | "high" | "review" | "none";
  notes: string[];
};

export type HistoricalAdpCoverageReport = {
  adpSourceRows: number;
  normalizedRows: number;
  invalidRows: number;
  duplicateRowsRemoved: number;
  conflictRows: number;
  universeExists: boolean;
  universeRows: number;
  universeUsableRows: number;
  matchedByExactId: number;
  matchedByNameTeamPosition: number;
  reviewCandidates: number;
  unmatchedAdpRows: number;
  universeRowsWithoutAdp: number;
  coverageByPosition: Record<string, { universeRows: number; matchedRows: number; coverageRate: number }>;
  coverageByRankBucket: Record<string, { universeRows: number; matchedRows: number; coverageRate: number }>;
};

export type HistoricalAdpEnrichedUniversePlayer = HistoricalMockDraftPlayer & {
  adp: number | null;
  external_market_rank: number | null;
  external_market_source: string | null;
  external_market_match_confidence: string | null;
  external_market_notes: string[];
};

export type HistoricalAdpSourceReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  universePath: string;
  universeExists: boolean;
  universeRows: number;
  universeUsableRows: number;
  adpRows: number;
  normalizedAdpRows: number;
  recommendation: HistoricalAdpSourceRecommendation;
  normalizedRows: HistoricalAdpNormalizedRow[];
  invalidRows: Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }>;
  duplicateRowsRemoved: number;
  conflictRows: Array<{ key: string; rows: HistoricalAdpNormalizedRow[]; reason: string }>;
  matches: HistoricalAdpUniverseMatch[];
  enrichedUniversePlayers: HistoricalAdpEnrichedUniversePlayer[];
  coverage: HistoricalAdpCoverageReport;
  dataLeakageGuard: {
    asOfDates: string[];
    sourceIsPreseasonHistorical: boolean;
    adpNotGeneratedFromActualSeasonOutcomes: boolean;
    actualWeeklyOutcomesNotUsedInMatching: boolean;
    adpUsedOnlyInDraftSimulation: boolean;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalAdpSourceArtifactPaths = {
  normalizedJsonPath: string;
  normalizedMarkdownPath: string;
  normalizedCsvPath: string;
  enrichedJsonPath: string;
  enrichedMarkdownPath: string;
  enrichedCsvPath: string;
};
