import { ProviderRepositoryValidationError } from "@/lib/providers/repositories/shared";
import { resolveIdentityDecision } from "@/lib/providers/adapters/identity-resolution";
import type { IdentityLookupDependencies } from "@/lib/providers/orchestration/dependencies";
import type {
  AdapterNormalizationIssue,
  AdapterSourceRecord
} from "@/lib/providers/adapters/types";
import type {
  DatasetIngestionPlan,
  IngestionPlanningOptions,
  MappingRequiredRecord,
  OrchestrationErrorCode,
  PlannedReadyRecord,
  RejectedOrchestrationRecord,
  UnresolvedOrchestrationRecord
} from "@/lib/providers/orchestration/types";
import { prepareInjuryCanonicalInput, prepareProjectionCanonicalInput, prepareSeasonStatsCanonicalInput, prepareWeeklyStatsCanonicalInput } from "@/lib/providers/adapters/normalize";

const DEFAULT_OPTIONS: Required<IngestionPlanningOptions> = {
  allowCandidateMatching: true,
  allowAutoResolvedCandidateMatch: true,
  requireVerifiedExternalMapping: false,
  maxRecords: 250
};

export async function planWeeklyStatsIngestion(
  records: import("@/lib/providers/adapters/types").AdapterWeeklyStatsRecord[],
  issues: AdapterNormalizationIssue[] = [],
  dependencies: IdentityLookupDependencies,
  options: IngestionPlanningOptions = {}
) {
  return buildDatasetPlan("weekly_stats", records, issues, dependencies, options);
}

export async function planSeasonStatsIngestion(
  records: import("@/lib/providers/adapters/types").AdapterSeasonStatsRecord[],
  issues: AdapterNormalizationIssue[] = [],
  dependencies: IdentityLookupDependencies,
  options: IngestionPlanningOptions = {}
) {
  return buildDatasetPlan("season_stats", records, issues, dependencies, options);
}

export async function planProjectionIngestion(
  records: import("@/lib/providers/adapters/types").AdapterProjectionRecord[],
  issues: AdapterNormalizationIssue[] = [],
  dependencies: IdentityLookupDependencies,
  options: IngestionPlanningOptions = {}
) {
  return buildDatasetPlan("projection", records, issues, dependencies, options);
}

export async function planInjuryIngestion(
  records: import("@/lib/providers/adapters/types").AdapterInjuryRecord[],
  issues: AdapterNormalizationIssue[] = [],
  dependencies: IdentityLookupDependencies,
  options: IngestionPlanningOptions = {}
) {
  return buildDatasetPlan("injury", records, issues, dependencies, options);
}

async function buildDatasetPlan(
  datasetKind: DatasetIngestionPlan["datasetKind"],
  records: AdapterSourceRecord[],
  sourceIssues: AdapterNormalizationIssue[],
  dependencies: IdentityLookupDependencies,
  options: IngestionPlanningOptions
): Promise<DatasetIngestionPlan> {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  if (records.length > resolvedOptions.maxRecords) {
    throw new ProviderRepositoryValidationError("Planning batch exceeds maximum size.", {
      code: "PLANNING_BATCH_TOO_LARGE"
    });
  }

  const provider = validateSingleProvider(records);
  const ready: PlannedReadyRecord[] = [];
  const mappingRequired: MappingRequiredRecord[] = [];
  const manualReview: DatasetIngestionPlan["manualReview"] = [];
  const unresolved: UnresolvedOrchestrationRecord[] = [];
  const rejected: RejectedOrchestrationRecord[] = [];
  let identityConflictCount = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    try {
      const lookupMappings =
        record.providerExternalId
          ? await dependencies.getExistingExternalMappings({
              provider: record.provider,
              providerExternalId: record.providerExternalId,
              externalType: record.externalType
            })
          : [];

      const candidatePlayers =
        lookupMappings.length === 0 && resolvedOptions.allowCandidateMatching && shouldLookupCandidates(record)
          ? await dependencies.findCandidatePlayers({
              fullName: record.fullName,
              firstName: record.firstName,
              lastName: record.lastName,
              team: record.team,
              rawPosition: record.rawPosition,
              positionGroup: record.positionGroup,
              externalType: record.externalType
            })
          : [];

      const identity = resolveIdentityDecision({
        record,
        existingExternalMappings: lookupMappings.map((mapping) => ({
          id: `${mapping.provider}:${mapping.externalId}:${mapping.playerId}`,
          player_id: mapping.playerId,
          provider: mapping.provider,
          external_id: mapping.externalId,
          external_type: mapping.externalType,
          season: null,
          team: mapping.team,
          position_group: mapping.positionGroup,
          mapping_status: mapping.mappingStatus ?? "unverified",
          mapping_method: mapping.mappingMethod,
          confidence: mapping.confidence,
          metadata_json: {},
          verified_at: mapping.verifiedAt,
          created_at: "",
          updated_at: ""
        })),
        candidatePlayers
      });

      if (identity.status === "invalid_identity") {
        rejected.push(buildRejected(record, "CANONICAL_PREPARATION_FAILED", identity.reasons.join(" "), index));
        continue;
      }

      if (identity.status === "conflicting_mapping") {
        identityConflictCount += 1;
        rejected.push(buildRejected(record, "EXTERNAL_MAPPING_CONFLICT", identity.reasons.join(" "), index));
        continue;
      }

      if (identity.status === "manual_review") {
        manualReview.push({
          record,
          code: "PLAYER_MANUAL_REVIEW",
          reasons: identity.reasons,
          warnings: identity.warnings,
          candidatePlayerIds: identity.candidatePlayerIds,
          resolvedPlayerId: identity.playerId,
          sourceIndex: index,
          sourceRecordId: record.sourceRecordId
        });
        continue;
      }

      if (identity.status === "unresolved") {
        unresolved.push({
          record,
          code: "PLAYER_UNRESOLVED",
          reasons: identity.reasons,
          warnings: identity.warnings,
          candidatePlayerIds: identity.candidatePlayerIds,
          sourceIndex: index,
          sourceRecordId: record.sourceRecordId
        });
        continue;
      }

      if (!identity.playerId) {
        unresolved.push({
          record,
          code: "PLAYER_UNRESOLVED",
          reasons: identity.reasons,
          warnings: identity.warnings,
          candidatePlayerIds: identity.candidatePlayerIds,
          sourceIndex: index,
          sourceRecordId: record.sourceRecordId
        });
        continue;
      }

      const prepared = prepareCanonical(datasetKind, record, identity.playerId);
      const writeEligibility = getWriteEligibility(record, lookupMappings);
      const warnings = [...identity.warnings];

      if (writeEligibility === "requires_external_mapping") {
        warnings.push("Resolved candidate is not write-eligible until an external mapping is persisted.");
        mappingRequired.push({
          record,
          playerId: identity.playerId,
          provider: record.provider,
          providerExternalId: record.providerExternalId as string,
          externalType: record.externalType,
          suggestedMappingMethod: identity.mappingMethod,
          confidence: identity.confidence,
          reasons: identity.reasons,
          warnings,
          proposedExternalMapping: {
            player_id: identity.playerId,
            provider: record.provider,
            external_id: record.providerExternalId as string,
            external_type: record.externalType,
            team: record.team,
            position_group: record.positionGroup,
            mapping_method: identity.mappingMethod ?? "exact_name_team_position",
            confidence: identity.confidence ?? undefined,
            mapping_status: "auto_matched"
          },
          sourceIndex: index,
          sourceRecordId: record.sourceRecordId
        });
        continue;
      }

      ready.push({
        record,
        prepared,
        writeEligibility,
        sourceIndex: index,
        sourceRecordId: record.sourceRecordId,
        warnings
      });
    } catch (error) {
      rejected.push(buildRejected(record, "IDENTITY_LOOKUP_FAILED", error instanceof Error ? error.message : "Identity lookup failed.", index, error));
    }
  }

  return {
    datasetKind,
    provider,
    generatedAt: new Date().toISOString(),
    sourceIssueCount: sourceIssues.length,
    identityConflictCount,
    limitedDataWarnings: sourceIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    ready,
    mappingRequired,
    manualReview,
    unresolved,
    rejected,
    warnings: sourceIssues,
    summary: {
      total: records.length,
      ready: ready.length,
      mappingRequired: mappingRequired.length,
      manualReview: manualReview.length,
      unresolved: unresolved.length,
      rejected: rejected.length
    }
  };
}

function validateSingleProvider(records: AdapterSourceRecord[]) {
  if (records.length === 0) {
    throw new ProviderRepositoryValidationError("Planning batch must contain at least one record.", {
      code: "PLANNING_BATCH_TOO_LARGE"
    });
  }
  const providers = [...new Set(records.map((record) => record.provider))];
  if (providers.length > 1) {
    throw new ProviderRepositoryValidationError("Planning batch must contain only one provider.", {
      code: "MIXED_PROVIDER_BATCH"
    });
  }
  return providers[0];
}

function shouldLookupCandidates(record: AdapterSourceRecord) {
  if (record.externalType === "team_defense") {
    return Boolean(record.team);
  }
  return Boolean(record.fullName || record.firstName || record.lastName);
}

function getWriteEligibility(record: AdapterSourceRecord, existingMappings: unknown[]) {
  if (!record.providerExternalId) return "eligible" as const;
  return existingMappings.length > 0 ? ("eligible" as const) : ("requires_external_mapping" as const);
}

function prepareCanonical(datasetKind: DatasetIngestionPlan["datasetKind"], record: AdapterSourceRecord, playerId: string) {
  switch (datasetKind) {
    case "weekly_stats":
      return prepareWeeklyStatsCanonicalInput(record as import("@/lib/providers/adapters/types").AdapterWeeklyStatsRecord, playerId);
    case "season_stats":
      return prepareSeasonStatsCanonicalInput(record as import("@/lib/providers/adapters/types").AdapterSeasonStatsRecord, playerId);
    case "projection":
      return prepareProjectionCanonicalInput(record as import("@/lib/providers/adapters/types").AdapterProjectionRecord, playerId);
    case "injury":
      return prepareInjuryCanonicalInput(record as import("@/lib/providers/adapters/types").AdapterInjuryRecord, playerId);
  }
}

function buildRejected(
  record: AdapterSourceRecord,
  code: OrchestrationErrorCode,
  message: string,
  sourceIndex: number,
  details?: unknown
): RejectedOrchestrationRecord {
  return {
    record,
    code,
    message,
    sourceIndex,
    sourceRecordId: record.sourceRecordId,
    details
  };
}
