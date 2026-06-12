export const PROVIDER_NAMES = [
  "sleeper",
  "sportsdataio",
  "fantasydata",
  "sportradar",
  "nflverse",
  "gsis",
  "espn",
  "yahoo",
  "manual"
] as const;

export const EXTERNAL_ENTITY_TYPES = [
  "player",
  "team_defense",
  "team",
  "gsis",
  "provider_player"
] as const;

export const MAPPING_STATUSES = [
  "verified",
  "auto_matched",
  "manual_review",
  "rejected",
  "unverified"
] as const;

export const MAPPING_METHODS = [
  "direct_bridge",
  "exact_name_team_position",
  "exact_name_position",
  "exact_name_team",
  "manual",
  "provider_supplied",
  "imported"
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];
export type ExternalEntityType = (typeof EXTERNAL_ENTITY_TYPES)[number];
export type MappingStatus = (typeof MAPPING_STATUSES)[number];
export type MappingMethod = (typeof MAPPING_METHODS)[number];

export type PlayerExternalIdRow = {
  id: string;
  player_id: string;
  provider: ProviderName;
  external_id: string;
  external_type: ExternalEntityType;
  season: number | null;
  team: string | null;
  position_group: string | null;
  mapping_status: MappingStatus;
  mapping_method: MappingMethod | null;
  confidence: number | null;
  metadata_json: Record<string, unknown>;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerExternalIdInsert = {
  player_id: string;
  provider: ProviderName;
  external_id: string;
  external_type?: ExternalEntityType;
  season?: number | null;
  team?: string | null;
  position_group?: string | null;
  mapping_status?: MappingStatus;
  mapping_method?: MappingMethod | null;
  confidence?: number | null;
  metadata_json?: Record<string, unknown>;
  verified_at?: string | null;
};

export type PlayerExternalIdUpdate = Partial<Omit<PlayerExternalIdInsert, "player_id" | "provider" | "external_id">>;

export type PlayerExternalIdLookup = {
  provider: ProviderName;
  externalId: string;
  externalType?: ExternalEntityType;
  season?: number | null;
};

export type ExternalPlayerCandidate = {
  provider: ProviderName;
  externalId: string;
  externalType?: ExternalEntityType;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  team?: string | null;
  rawPosition?: string | null;
  normalizedPositionGroup?: string | null;
  birthDate?: string | null;
  metadata?: Record<string, unknown>;
};

export type ExternalMappingResult = {
  playerId: string | null;
  status: MappingStatus;
  method: MappingMethod | null;
  confidence: number;
  reasons: string[];
  candidatePlayerIds: string[];
  warnings: string[];
};

export type ExternalIdPlayerSummary = {
  id: string;
  sleeper_player_id: string | null;
  full_name: string | null;
  team: string | null;
  primary_position: string | null;
  position_group: string | null;
  side_of_ball: string | null;
};
