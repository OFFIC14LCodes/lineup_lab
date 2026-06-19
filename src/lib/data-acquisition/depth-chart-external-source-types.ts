export type ExternalDepthChartInspectReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  inputPath: string;
  headers: string[];
  rowCount: number;
  sampleRows: Array<Record<string, unknown>>;
  uniqueTeams: string[];
  uniquePositions: string[];
  likelyColumns: {
    playerName: string[];
    team: string[];
    position: string[];
    depthRank: string[];
    depthPosition: string[];
    status: string[];
  };
  missingBlankRates: Record<string, { blankRows: number; blankRate: number }>;
  notes: string[];
};

export type ScrapePlayersDepthChartAdapterOptions = {
  inputPath: string;
  outputPath: string;
  season: number;
};

export type ScrapePlayersDepthChartAdapterReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  inputPath: string;
  outputPath: string;
  season: number;
  sourceRows: number;
  convertedRows: number;
  skippedRows: number;
  outputHeaders: string[];
  inferredColumns: {
    playerName: string | null;
    team: string | null;
    position: string | null;
    depthRank: string | null;
    depthPosition: string | null;
    status: string | null;
  };
  roleCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  positionCounts: Record<string, number>;
  issues: Array<{ rowNumber: number; issue: string; detail: string }>;
  notes: string[];
};
