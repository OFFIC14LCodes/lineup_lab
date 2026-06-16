export type AcquisitionMethod =
  | "local_csv"
  | "local_json"
  | "remote_csv"
  | "remote_parquet"
  | "api"
  | "manual"
  | "provider_export";

export type SourceCategory =
  | "nfl_draft_capital"
  | "college_player_stats"
  | "college_rosters"
  | "college_recruiting"
  | "nfl_rosters"
  | "nfl_snap_counts"
  | "nfl_depth_charts"
  | "nfl_injuries"
  | "manual_role_notes"
  | "provider_projection_context";

export type SourceConfidence = "low" | "medium" | "high";

export type DataSourceDescriptor = {
  sourceId: string;
  sourceName: string;
  sourceCategory: SourceCategory;
  acquisitionMethod: AcquisitionMethod;
  requiresApiKey: boolean;
  apiKeyEnvName?: string | null;
  localPath?: string | null;
  remoteUrl?: string | null;
  enabled: boolean;
  priority: number;
  notes: string[];
};

export type DataSourceStatus = DataSourceDescriptor & {
  configured: boolean;
  available: boolean;
  skippedReason: string | null;
};

export type SourceAttribution = {
  source: string;
  sourceLabel: string;
  acquisitionMethod: AcquisitionMethod;
  sourceConfidence: SourceConfidence;
  importedAt: string;
};

export type SourceMatchStatus =
  | "matched_player_id"
  | "matched_name_position_team"
  | "matched_name_position"
  | "ambiguous"
  | "unmatched";

export type SourceMatchResult = {
  playerId: string | null;
  rowIndex: number | null;
  matchStatus: SourceMatchStatus;
  unresolvedReason: string | null;
};
