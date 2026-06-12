import type { AdapterNormalizationIssue, AdapterSourceRecord } from "@/lib/providers/adapters/types";
import type { DatasetIngestionPlan, IngestionExecutionResult } from "@/lib/providers/orchestration/types";
import type { ExternalEntityType, MappingMethod, ProviderName } from "@/lib/providers/types";

export const IMPORT_DATASET_KINDS = ["weekly_stats", "season_stats", "projection", "injury"] as const;
export const IMPORT_PROVIDERS = ["manual"] as const;
export const IMPORT_SESSION_STATUSES = [
  "previewed",
  "mapping_review",
  "ready",
  "executing",
  "completed",
  "partially_failed",
  "failed",
  "expired",
  "cancelled"
] as const;
export const INJURY_IMPORT_MODES = ["append_observation", "replace_current"] as const;

export type ImportDatasetKind = (typeof IMPORT_DATASET_KINDS)[number];
export type ImportProvider = ProviderName;
export type ImportSessionStatus = (typeof IMPORT_SESSION_STATUSES)[number];
export type InjuryImportMode = (typeof INJURY_IMPORT_MODES)[number];

export type ParsedImportRecord = Record<string, unknown> & {
  _sourceRowNumber: number;
};

export type ParsedImportPayload = {
  datasetKind: ImportDatasetKind;
  provider: ImportProvider;
  records: ParsedImportRecord[];
  sourceWarnings: string[];
};

export type ImportSessionPayload = {
  filename: string;
  sourceHash: string;
  datasetKind: ImportDatasetKind;
  provider: ImportProvider;
  injuryImportMode: InjuryImportMode;
  normalizationIssues: AdapterNormalizationIssue[];
  normalizedRecords: AdapterSourceRecord[];
  plan: DatasetIngestionPlan;
  totalRows: number;
  sourceWarnings: string[];
  executedAt?: string | null;
  executionResult?: IngestionExecutionResult | null;
};

export type ProviderImportSessionRow = {
  id: string;
  user_id: string;
  provider: string;
  dataset_kind: string;
  filename: string;
  source_hash: string;
  session_payload_json: ImportSessionPayload;
  status: ImportSessionStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ImportPreviewSummary = {
  totalRows: number;
  ready: number;
  mappingRequired: number;
  manualReview: number;
  unresolved: number;
  rejected: number;
};

export type ImportPreviewResponse = {
  sessionId: string;
  datasetKind: ImportDatasetKind;
  provider: ImportProvider;
  filename: string;
  totalRows: number;
  normalizationIssues: AdapterNormalizationIssue[];
  readyRows: DatasetIngestionPlan["ready"];
  mappingRequiredRows: Array<DatasetIngestionPlan["mappingRequired"][number] & { candidatePlayers?: ImportCandidatePlayer[] }>;
  manualReviewRows: Array<DatasetIngestionPlan["manualReview"][number] & { candidatePlayers?: ImportCandidatePlayer[] }>;
  unresolvedRows: Array<DatasetIngestionPlan["unresolved"][number] & { candidatePlayers?: ImportCandidatePlayer[] }>;
  rejectedRows: DatasetIngestionPlan["rejected"];
  summary: ImportPreviewSummary;
  generatedAt: string;
  expiresAt: string;
  sourceHash: string;
  injuryImportMode: InjuryImportMode;
  sourceWarnings: string[];
};

export type ImportPreviewRequest = {
  datasetKind: ImportDatasetKind;
  provider: ImportProvider;
  filename: string;
  fileContent: string;
  fileMimeType?: string | null;
  injuryImportMode?: InjuryImportMode;
};

export type MappingApprovalRequest = {
  sessionId: string;
  sourceRecordId: string;
  action: "approve" | "skip";
  playerId?: string;
};

export type ExecuteImportRequest = {
  sessionId: string;
  confirm: boolean;
  failureMode?: "stop_on_first_error" | "continue";
};

export type MappingApprovalResponse = ImportPreviewResponse;

export type ExecuteImportResponse = {
  sessionId: string;
  status: ImportSessionStatus;
  blockedCounts: Pick<ImportPreviewSummary, "mappingRequired" | "manualReview" | "unresolved" | "rejected">;
  readyCount: number;
  execution: IngestionExecutionResult | null;
  warnings: string[];
};

export type ImportTemplateField = {
  name: string;
  required?: boolean;
  description?: string;
};

export type ImportTemplateDefinition = {
  datasetKind: ImportDatasetKind;
  title: string;
  csvHeaders: string[];
  requiredFields: ImportTemplateField[];
  optionalFields: ImportTemplateField[];
};

export type MappingApprovalCandidate = {
  playerId: string;
  provider: ImportProvider;
  externalId: string;
  externalType: ExternalEntityType;
  team?: string | null;
  positionGroup?: string | null;
  mappingMethod?: MappingMethod | null;
  confidence?: number | null;
};

export type ImportCandidatePlayer = {
  id: string;
  fullName: string | null;
  team: string | null;
  positionGroup: string | null;
  primaryPosition: string | null;
};
