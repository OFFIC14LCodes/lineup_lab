import type { ExternalMatchablePlayer } from "@/lib/providers/match-external-player";
import { matchExternalPlayer } from "@/lib/providers/match-external-player";
import type { AdapterSourceRecord, IdentityResolutionResult } from "@/lib/providers/adapters/types";
import type { ExternalEntityType, MappingMethod, MappingStatus, PlayerExternalIdRow } from "@/lib/providers/types";

export type IdentityResolutionContext = {
  record: AdapterSourceRecord;
  existingExternalMappings?: PlayerExternalIdRow[];
  candidatePlayers?: ExternalMatchablePlayer[];
};

export function resolveIdentityDecision(context: IdentityResolutionContext): IdentityResolutionResult {
  const { record, existingExternalMappings = [], candidatePlayers = [] } = context;

  if (record.externalType === "team_defense" && !record.team) {
    return result("unresolved", null, {
      provider: record.provider,
      providerExternalId: record.providerExternalId,
      externalType: record.externalType,
      mappingStatus: null,
      mappingMethod: null,
      confidence: null,
      reasons: ["Team defense records require a team abbreviation when no mapping exists."],
      warnings: ["Team-defense identity could not be resolved safely."],
      candidatePlayerIds: []
    });
  }

  const exactMappings = record.providerExternalId
    ? existingExternalMappings.filter(
        (mapping) =>
          mapping.provider === record.provider &&
          mapping.external_id === record.providerExternalId &&
          mapping.external_type === normalizeExternalType(record.externalType)
      )
    : [];

  if (exactMappings.length > 1) {
    return result("conflicting_mapping", null, {
      provider: record.provider,
      providerExternalId: record.providerExternalId,
      externalType: record.externalType,
      mappingStatus: null,
      mappingMethod: null,
      confidence: 0,
      reasons: ["Multiple external mappings exist for this provider identity."],
      warnings: ["Manual review required."],
      candidatePlayerIds: [...new Set(exactMappings.map((mapping) => mapping.player_id))]
    });
  }

  if (exactMappings.length === 1) {
    const mapping = exactMappings[0];
    return result(record.externalType === "team_defense" ? "team_defense_resolved" : "resolved", mapping.player_id, {
      provider: record.provider,
      providerExternalId: record.providerExternalId,
      externalType: record.externalType,
      mappingStatus: mapping.mapping_status,
      mappingMethod: mapping.mapping_method,
      confidence: mapping.confidence,
      reasons: ["Existing provider/external-ID mapping resolved identity."],
      warnings: [],
      candidatePlayerIds: [mapping.player_id]
    });
  }

  const fullName = record.fullName ?? [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  if (!fullName && record.externalType !== "team_defense") {
    return result("invalid_identity", null, {
      provider: record.provider,
      providerExternalId: record.providerExternalId,
      externalType: record.externalType,
      mappingStatus: null,
      mappingMethod: null,
      confidence: null,
      reasons: ["Missing player name and no existing provider mapping."],
      warnings: ["Record cannot be resolved safely."],
      candidatePlayerIds: []
    });
  }

  const matched = matchExternalPlayer(
    {
      provider: record.provider,
      externalId: record.providerExternalId ?? buildSyntheticExternalId(record),
      externalType: record.externalType,
      fullName: fullName || `${record.team ?? "UNKNOWN"} DEF`,
      firstName: record.firstName,
      lastName: record.lastName,
      team: record.team,
      rawPosition: record.rawPosition,
      normalizedPositionGroup: record.positionGroup,
      metadata: record.metadata
    },
    candidatePlayers
  );

  if (matched.playerId) {
    return result(record.externalType === "team_defense" ? "team_defense_resolved" : "resolved", matched.playerId, {
      provider: record.provider,
      providerExternalId: record.providerExternalId,
      externalType: record.externalType,
      mappingStatus: matched.status as MappingStatus,
      mappingMethod: matched.method as MappingMethod | null,
      confidence: matched.confidence,
      reasons: matched.reasons,
      warnings: matched.warnings,
      candidatePlayerIds: matched.candidatePlayerIds
    });
  }

  if (matched.status === "manual_review") {
    if (matched.candidatePlayerIds.length === 0) {
      return result("unresolved", null, {
        provider: record.provider,
        providerExternalId: record.providerExternalId,
        externalType: record.externalType,
        mappingStatus: null,
        mappingMethod: null,
        confidence: matched.confidence,
        reasons: matched.reasons,
        warnings: matched.warnings,
        candidatePlayerIds: matched.candidatePlayerIds
      });
    }

    return result("manual_review", null, {
      provider: record.provider,
      providerExternalId: record.providerExternalId,
      externalType: record.externalType,
      mappingStatus: "manual_review",
      mappingMethod: null,
      confidence: matched.confidence,
      reasons: matched.reasons,
      warnings: matched.warnings,
      candidatePlayerIds: matched.candidatePlayerIds
    });
  }

  return result("unresolved", null, {
    provider: record.provider,
    providerExternalId: record.providerExternalId,
    externalType: record.externalType,
    mappingStatus: null,
    mappingMethod: null,
    confidence: null,
    reasons: ["No safe identity resolution path was found."],
    warnings: matched.warnings,
    candidatePlayerIds: matched.candidatePlayerIds
  });
}

function result(
  status: IdentityResolutionResult["status"],
  playerId: string | null,
  rest: Omit<IdentityResolutionResult, "status" | "playerId">
): IdentityResolutionResult {
  return {
    status,
    playerId,
    ...rest
  };
}

function normalizeExternalType(value: ExternalEntityType) {
  return value;
}

function buildSyntheticExternalId(record: AdapterSourceRecord) {
  return `unmapped:${record.provider}:${record.sourceRecordId ?? record.team ?? record.fullName ?? "unknown"}`;
}
