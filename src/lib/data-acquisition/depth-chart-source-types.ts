export type DepthChartSourceStatus =
  | "active"
  | "starter"
  | "backup"
  | "reserve"
  | "practice_squad"
  | "injured"
  | "inactive"
  | "unknown";

export type DepthChartSourceRole =
  | "starter"
  | "backup"
  | "rotational"
  | "handcuff"
  | "depth"
  | "practice_squad"
  | "special_teams"
  | "unknown";

export type DepthChartSourceOptions = {
  season: number;
  inputPath: string;
};

export type DepthChartSourceRow = {
  season: number;
  team: string | null;
  playerName: string;
  normalizedName: string;
  position: string;
  depthPosition: string | null;
  depthRank: number | null;
  role: DepthChartSourceRole;
  status: DepthChartSourceStatus;
  sleeperId: string | null;
  gsisId: string | null;
  playerId: string | null;
  source: string;
  sourceUpdatedAt: string | null;
  notes: string | null;
  matchKey: string;
};

export type DepthChartSourceIssue = {
  rowNumber: number;
  playerName: string | null;
  issue: "missing_player_name" | "missing_team" | "missing_position" | "invalid_status" | "invalid_role" | "missing_identity" | "duplicate_conflict";
  detail: string;
};

export type DepthChartSourceReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  sourceRows: number;
  normalizedRows: number;
  duplicateRowsRemoved: number;
  invalidRows: number;
  missingIdentityRows: number;
  conflictRows: number;
  statusCounts: Record<DepthChartSourceStatus, number>;
  roleCounts: Record<DepthChartSourceRole, number>;
  positionCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  rows: DepthChartSourceRow[];
  issues: DepthChartSourceIssue[];
  notes: string[];
};

export type DepthChartSourceArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
