import type { ExternalEntityType, MappingMethod, MappingStatus, ProviderName } from "@/lib/providers/types";
import type {
  AdapterNormalizationIssue,
  AdapterSourceRecord,
  PositionGroup,
  PreparedCanonicalRecord
} from "@/lib/providers/adapters/types";
import type { ExternalMatchablePlayer } from "@/lib/providers/match-external-player";

export const REQUIRED_PROVIDER_MIGRATIONS = [
  "004_player_external_ids",
  "005_provider_football_data"
] as const;

export type OrchestrationErrorCode =
  | "PLANNING_BATCH_TOO_LARGE"
  | "MIXED_PROVIDER_BATCH"
  | "IDENTITY_LOOKUP_FAILED"
  | "EXTERNAL_MAPPING_CONFLICT"
  | "PLAYER_UNRESOLVED"
  | "PLAYER_MANUAL_REVIEW"
  | "EXTERNAL_MAPPING_REQUIRED"
  | "CANONICAL_PREPARATION_FAILED"
  | "PLAN_NOT_EXECUTABLE"
  | "REPOSITORY_WRITE_FAILED"
  | "EXECUTION_STOPPED"
  | "NON_TRANSACTIONAL_PARTIAL_FAILURE";

export type WriteEligibility = "eligible" | "requires_external_mapping" | "blocked";
export type DatasetKind = PreparedCanonicalRecord["kind"];

export type ExternalMappingLookupResult = {
  playerId: string;
  provider: ProviderName;
  externalId: string;
  externalType: ExternalEntityType;
  mappingStatus: MappingStatus | null;
  mappingMethod: MappingMethod | null;
  confidence: number | null;
  verifiedAt: string | null;
  team: string | null;
  positionGroup: PositionGroup | null;
};

export type MappingRequiredRecord = {
  record: AdapterSourceRecord;
  playerId: string;
  provider: ProviderName;
  providerExternalId: string;
  externalType: ExternalEntityType;
  suggestedMappingMethod: MappingMethod | null;
  confidence: number | null;
  reasons: string[];
  warnings: string[];
  proposedExternalMapping: {
    player_id: string;
    provider: ProviderName;
    external_id: string;
    external_type: ExternalEntityType;
    team?: string | null;
    position_group?: PositionGroup | null;
    mapping_method?: MappingMethod | null;
    confidence?: number | null;
    mapping_status?: MappingStatus;
  };
  sourceIndex?: number;
  sourceRecordId?: string | null;
};

export type RejectedOrchestrationRecord = {
  record: AdapterSourceRecord;
  code: OrchestrationErrorCode;
  message: string;
  sourceIndex?: number;
  sourceRecordId?: string | null;
  details?: unknown;
};

export type UnresolvedOrchestrationRecord = {
  record: AdapterSourceRecord;
  code: OrchestrationErrorCode;
  reasons: string[];
  warnings: string[];
  candidatePlayerIds: string[];
  sourceIndex?: number;
  sourceRecordId?: string | null;
};

export type ManualReviewRecord = UnresolvedOrchestrationRecord & {
  resolvedPlayerId?: string | null;
};

export type PlannedReadyRecord = {
  record: AdapterSourceRecord;
  prepared: PreparedCanonicalRecord;
  writeEligibility: WriteEligibility;
  sourceIndex?: number;
  sourceRecordId?: string | null;
  warnings: string[];
};

export type DatasetIngestionPlan = {
  datasetKind: DatasetKind;
  provider: ProviderName;
  generatedAt: string;
  sourceIssueCount: number;
  identityConflictCount: number;
  limitedDataWarnings: string[];
  ready: PlannedReadyRecord[];
  mappingRequired: MappingRequiredRecord[];
  manualReview: ManualReviewRecord[];
  unresolved: UnresolvedOrchestrationRecord[];
  rejected: RejectedOrchestrationRecord[];
  warnings: AdapterNormalizationIssue[];
  summary: {
    total: number;
    ready: number;
    mappingRequired: number;
    manualReview: number;
    unresolved: number;
    rejected: number;
  };
};

export type IngestionPlanningOptions = {
  allowCandidateMatching?: boolean;
  allowAutoResolvedCandidateMatch?: boolean;
  requireVerifiedExternalMapping?: boolean;
  maxRecords?: number;
};

export type IngestionWriteOutcome = {
  sourceRecordId: string | null;
  kind: DatasetKind;
  playerId: string;
  provider: ProviderName;
  status: "written" | "updated" | "reused" | "failed";
  rowId: string | null;
  error: { code: string; message: string } | null;
};

export type IngestionExecutionResult = {
  outcomes: IngestionWriteOutcome[];
  summary: {
    total: number;
    written: number;
    updated: number;
    reused: number;
    failed: number;
  };
  nonTransactional: true;
  startedAt: string;
  completedAt: string;
  warnings: string[];
};

export type IdentityLookupInput = {
  provider: ProviderName;
  providerExternalId: string;
  externalType: ExternalEntityType;
};

export type CandidatePlayerLookupInput = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  team: string | null;
  rawPosition: string | null;
  positionGroup: PositionGroup | null;
  externalType: ExternalEntityType;
};

export type ProviderCandidatePlayer = ExternalMatchablePlayer;
