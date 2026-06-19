export type SleeperPlayerMetadataSourceOptions = {
  season: number;
  inputPath: string;
};

export type SleeperPlayerMetadataRow = {
  sleeperId: string;
  playerName: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  team: string | null;
  status: string | null;
  normalizedStatus: string;
  active: boolean;
  injuryStatus: string | null;
  fantasyPositions: string[];
  searchRank: number | null;
  yearsExperience: number | null;
  age: number | null;
  source: string;
  sourceUpdatedAt: string | null;
  notes: string | null;
};

export type SleeperPlayerMetadataIssue = {
  rowNumber: number;
  sleeperId: string | null;
  playerName: string | null;
  issue: string;
  detail: string;
};

export type SleeperPlayerMetadataReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  sourceRows: number;
  normalizedRows: number;
  invalidRows: number;
  activeRows: number;
  inactiveRows: number;
  missingTeamRows: number;
  positionCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  rows: SleeperPlayerMetadataRow[];
  issues: SleeperPlayerMetadataIssue[];
  notes: string[];
};

export type SleeperPlayerMetadataArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
