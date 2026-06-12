export type GsisBootstrapStatus =
  | "existing"       // already has a gsis mapping in player_external_ids
  | "ready"          // canonical player found via bridge, eligible for write
  | "manual_review"  // only a name-position candidate (no auto-map)
  | "conflict"       // two independent bridges returned different players
  | "unresolved"     // no match found
  | "rejected";      // team-defense entity, blank gsis_id, etc.

export type GsisBootstrapBridgeMethod =
  | "existing_mapping"
  | "stats_id"      // players.metadata_json->>'gsis_id' direct GSIS ID match
  | "espn_id"       // players.metadata_json->>'espn_id' vs nflverse espn_id
  | "name_position" // name + position candidate (manual_review only, never auto-mapped)
  | null;

export type GsisBootstrapMode = "dry_run" | "execute";

export type GsisBootstrapOptions = {
  projectRoot: string;
  mode: GsisBootstrapMode;
};

export type GsisBootstrapPlayerRow = {
  gsisId: string;
  displayName: string;
  normalizedName: string;
  positionGroup: string | null;   // Blackbird canonical (FB→RB, NT→DL, etc.)
  rawPositionGroup: string;       // nflverse original value
  espnId: string | null;
  latestTeam: string | null;
  status: string;
  lastSeason: number | null;
};

export type GsisBootstrapResult = {
  gsisId: string;
  displayName: string;
  positionGroup: string | null;
  bootstrapStatus: GsisBootstrapStatus;
  playerId: string | null;
  bridgeMethod: GsisBootstrapBridgeMethod;
  conflictPlayerIds?: string[];
  rejectReason?: string;
};

export type GsisBootstrapCoverage = {
  totalSourceRows: number;
  rejectedRows: number;
  existingMappings: number;
  readyViaGsisId: number;  // matched via metadata_json.gsis_id direct bridge
  readyViaEspnId: number;  // matched via metadata_json.espn_id bridge
  manualReviewRows: number;
  conflictRows: number;
  unresolvedRows: number;
  writtenRows: number;
  errorRows: number;
};

export type GsisBootstrapReport = {
  mode: GsisBootstrapMode;
  sourceUrl: string;
  filePath: string;
  sha256: string;
  alreadyArchived: boolean;
  schemaValid: boolean;
  missingColumns: string[];
  coverage: GsisBootstrapCoverage;
  manualReviewList: GsisBootstrapResult[];
  durationMs: number;
  completedAt: string;
};
