export type HistoricalWideAdpScoringFormat = "HALF_PPR" | "PPR" | "SUPERFLEX";

export type HistoricalWideAdpRecommendation =
  | "wide_adp_source_ready_for_market_anchor"
  | "wide_adp_source_needs_input_file"
  | "wide_adp_source_needs_header_mapping"
  | "wide_adp_source_blocked";

export type HistoricalWideAdpNormalizedRow = {
  season: number;
  source: string;
  asOfDate: string;
  scoringFormat: HistoricalWideAdpScoringFormat;
  playerName: string;
  position: string;
  team: string | null;
  adp: number | null;
  rank: number | null;
  posRank: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  playerId: string | null;
  notes: string[];
};

export type HistoricalWideAdpFormatSelection = {
  selectedFormat: HistoricalWideAdpScoringFormat;
  fallbackUsed: boolean;
  reason: string;
};

export type HistoricalWideAdpReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  inputExists: boolean;
  recommendation: HistoricalWideAdpRecommendation;
  sourcePlayerRows: number;
  normalizedRows: number;
  rowsByScoringFormat: Record<HistoricalWideAdpScoringFormat, number>;
  rowsByPosition: Record<string, number>;
  rowsMissingAdp: number;
  rowsMissingOrderRank: number;
  duplicatePlayerFormatRows: number;
  invalidRows: Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }>;
  normalizedAdpRows: HistoricalWideAdpNormalizedRow[];
  dataLeakageGuard: {
    sourceAsOfDate: string;
    sourceIsPreseason: boolean;
    adpNotUsedAsValue: boolean;
    actualSeasonOutcomesNotUsed: boolean;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalWideAdpArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
