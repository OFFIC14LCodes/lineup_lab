export type CurrentRosterStatus =
  | "active"
  | "practice_squad"
  | "injured_reserve"
  | "pup"
  | "nfi"
  | "suspended"
  | "free_agent"
  | "retired"
  | "unknown";

export type CurrentRosterSourceOptions = {
  season: number;
  inputPath: string;
  mappingPath?: string | null;
};

export type CurrentRosterCanonicalField =
  | "player_id"
  | "sleeper_id"
  | "gsis_id"
  | "player_name"
  | "position"
  | "team"
  | "status"
  | "roster_status"
  | "depth_chart_position"
  | "depth_chart_order"
  | "source"
  | "source_updated_at"
  | "notes";

export type CurrentRosterSourceMapping = Partial<Record<CurrentRosterCanonicalField, string>>;

export type CurrentRosterSourceRow = {
  playerId: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  normalizedName: string;
  position: string;
  team: string | null;
  status: CurrentRosterStatus;
  rosterStatus: string | null;
  depthChartPosition: string | null;
  depthChartOrder: number | null;
  source: string;
  sourceUpdatedAt: string | null;
  notes: string | null;
  matchKey: string;
};

export type CurrentRosterSourceIssue = {
  rowNumber: number;
  playerName: string | null;
  issue: string;
  detail: string;
};

export type CurrentRosterSourceReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  mappingPath: string | null;
  mapping: CurrentRosterSourceMapping;
  sourceRows: number;
  normalizedRows: number;
  duplicateRowsRemoved: number;
  invalidRows: number;
  missingIdRows: number;
  statusCounts: Record<CurrentRosterStatus, number>;
  positionCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  rows: CurrentRosterSourceRow[];
  issues: CurrentRosterSourceIssue[];
  notes: string[];
};

export type CurrentRosterSourceInspectReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  inputPath: string;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
  directMappedFields: CurrentRosterSourceMapping;
  missingRequiredFields: CurrentRosterCanonicalField[];
  missingRecommendedFields: CurrentRosterCanonicalField[];
  suggestedMapping: CurrentRosterSourceMapping;
  notes: string[];
};

export type CurrentRosterSourceArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
