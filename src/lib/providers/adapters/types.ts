import type { NormalizedFantasyPosition } from "@/lib/players/normalize";
import type { ProjectionType, ProviderStatsJson, SeasonType } from "@/lib/providers/data-types";
import type { ExternalEntityType, MappingMethod, MappingStatus, ProviderName } from "@/lib/providers/types";

export type PositionGroup = NormalizedFantasyPosition;

export type AdapterRecordBase = {
  provider: ProviderName;
  providerExternalId: string | null;
  externalType: ExternalEntityType;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  team: string | null;
  rawPosition: string | null;
  positionGroup: PositionGroup | null;
  season: number | null;
  sourceUpdatedAt: string | null;
  sourceRecordId: string | null;
  metadata: Record<string, unknown>;
};

export type AdapterWeeklyStatsRecord = AdapterRecordBase & {
  kind: "weekly_stats";
  season: number;
  week: number;
  seasonType: SeasonType;
  gameId: string | null;
  opponent: string | null;
  homeAway: "home" | "away" | null;
  gameDate: string | null;
  stats: ProviderStatsJson;
  providerFantasyPoints: number | null;
  dataVersion: string | null;
};

export type AdapterSeasonStatsRecord = AdapterRecordBase & {
  kind: "season_stats";
  season: number;
  seasonType: SeasonType;
  gamesPlayed: number | null;
  gamesStarted: number | null;
  stats: ProviderStatsJson;
  providerFantasyPoints: number | null;
  dataVersion: string | null;
};

export type AdapterProjectionRecord = AdapterRecordBase & {
  kind: "projection";
  season: number;
  week: number | null;
  seasonType: SeasonType;
  projectionType: ProjectionType;
  scoringFormat: string | null;
  opponent: string | null;
  stats: ProviderStatsJson;
  providerFantasyPoints: number | null;
  version: string;
};

export type AdapterInjuryRecord = AdapterRecordBase & {
  kind: "injury";
  season: number | null;
  week: number | null;
  status: string | null;
  practiceStatus: string | null;
  gameStatus: string | null;
  bodyPart: string | null;
  injuryType: string | null;
  description: string | null;
  expectedReturn: string | null;
  observedAt: string | null;
  isCurrent: boolean;
};

export type AdapterSourceRecord =
  | AdapterWeeklyStatsRecord
  | AdapterSeasonStatsRecord
  | AdapterProjectionRecord
  | AdapterInjuryRecord;

export type AdapterNormalizationIssue = {
  index?: number;
  code: string;
  message: string;
  field?: string;
  severity: "warning" | "error";
  sourceRecordId?: string | null;
};

export type AdapterNormalizationResult<T> = {
  records: T;
  issues: AdapterNormalizationIssue[];
  rejectedCount: number;
  acceptedCount: number;
};

export type ProviderCapabilities = {
  weeklyStats: boolean;
  seasonStats: boolean;
  weeklyProjections: boolean;
  seasonProjections: boolean;
  restOfSeasonProjections: boolean;
  injuries: boolean;
  offense: boolean;
  kicker: boolean;
  teamDefense: boolean;
  idp: boolean;
  rawStats: boolean;
  providerFantasyPoints: boolean;
  scheduleContext: boolean;
  supportedPositionGroups: PositionGroup[];
};

export type UnsupportedCapabilityResult = {
  supported: false;
  code: "UNSUPPORTED_CAPABILITY";
  message: string;
};

export type IdentityResolutionStatus =
  | "resolved"
  | "unresolved"
  | "manual_review"
  | "conflicting_mapping"
  | "invalid_identity"
  | "team_defense_resolved";

export type IdentityResolutionResult = {
  status: IdentityResolutionStatus;
  playerId: string | null;
  provider: ProviderName;
  providerExternalId: string | null;
  externalType: ExternalEntityType;
  mappingStatus: MappingStatus | null;
  mappingMethod: MappingMethod | null;
  confidence: number | null;
  reasons: string[];
  warnings: string[];
  candidatePlayerIds: string[];
};

export type PreparedCanonicalRecord =
  | {
      kind: "weekly_stats";
      playerId: string;
      input: import("@/lib/providers/data-types").PlayerWeeklyStatsInsert;
    }
  | {
      kind: "season_stats";
      playerId: string;
      input: import("@/lib/providers/data-types").PlayerSeasonStatsInsert;
    }
  | {
      kind: "projection";
      playerId: string;
      input: import("@/lib/providers/data-types").PlayerProjectionInsert;
    }
  | {
      kind: "injury";
      playerId: string;
      executionMode: "append_observation" | "replace_current";
      input: import("@/lib/providers/data-types").PlayerInjuryInsert;
    };

export type UnresolvedAdapterRecord = {
  record: AdapterSourceRecord;
  identity: IdentityResolutionResult;
  sourceIndex?: number;
  sourceRecordId?: string | null;
  reasons: string[];
  warnings: string[];
};

export type RejectedAdapterRecord = {
  record: AdapterSourceRecord | unknown;
  issues: AdapterNormalizationIssue[];
  sourceIndex?: number;
  sourceRecordId?: string | null;
};

export type IngestionPlan = {
  ready: PreparedCanonicalRecord[];
  unresolved: UnresolvedAdapterRecord[];
  manualReview: UnresolvedAdapterRecord[];
  rejected: RejectedAdapterRecord[];
  warnings: AdapterNormalizationIssue[];
  summary: {
    total: number;
    ready: number;
    unresolved: number;
    manualReview: number;
    rejected: number;
  };
};
