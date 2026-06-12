import {
  buildInjuryInsert,
  buildProjectionInsert,
  buildSeasonStatsInsert,
  buildWeeklyStatsInsert,
  normalizeStatsJson,
  validateProjectionType,
  validateSeasonType
} from "@/lib/providers/data-builders";
import { normalizeExternalEntityType, normalizeProviderName } from "@/lib/providers/constants";
import type {
  AdapterInjuryRecord,
  AdapterNormalizationIssue,
  AdapterNormalizationResult,
  AdapterProjectionRecord,
  AdapterRecordBase,
  AdapterSeasonStatsRecord,
  AdapterSourceRecord,
  AdapterWeeklyStatsRecord,
  PositionGroup,
  PreparedCanonicalRecord
} from "@/lib/providers/adapters/types";
import { normalizePlayerName, normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";

export function normalizeAdapterRecords<T extends AdapterSourceRecord>(
  input: unknown,
  mapRecord: (value: unknown, index: number) => T
): AdapterNormalizationResult<T[]> {
  const rawRecords = Array.isArray(input) ? input : [input];
  const issues: AdapterNormalizationIssue[] = [];
  const records: T[] = [];

  rawRecords.forEach((value, index) => {
    try {
      records.push(mapRecord(value, index));
    } catch (error) {
      issues.push({
        index,
        code: "INVALID_SOURCE_RECORD",
        message: error instanceof Error ? error.message : "Invalid source record.",
        severity: "error"
      });
    }
  });

  return {
    records,
    issues,
    rejectedCount: issues.filter((issue) => issue.severity === "error").length,
    acceptedCount: records.length
  };
}

export function normalizeAdapterBase(
  input: Record<string, unknown>,
  defaults: { provider: string; externalType?: string; kind?: string }
): AdapterRecordBase {
  const fullName = asNullableString(input.fullName ?? input.full_name);
  const firstName = asNullableString(input.firstName ?? input.first_name);
  const lastName = asNullableString(input.lastName ?? input.last_name);
  const rawPosition = asNullableString(input.rawPosition ?? input.position);
  const team = normalizeTeam(asNullableString(input.team));
  const externalType = normalizeExternalEntityType(asNullableString(input.externalType) ?? defaults.externalType ?? "player");
  const explicitGroup = asNullableString(input.positionGroup ?? input.position_group);
  const positionGroup = normalizePositionGroup(explicitGroup ?? rawPosition) as PositionGroup | null;

  return {
    provider: normalizeProviderName(asNullableString(input.provider) ?? defaults.provider),
    providerExternalId: asNullableString(input.providerExternalId ?? input.provider_external_id),
    externalType,
    fullName,
    firstName,
    lastName,
    team,
    rawPosition,
    positionGroup,
    season: asNullableInteger(input.season),
    sourceUpdatedAt: asNullableString(input.sourceUpdatedAt ?? input.source_updated_at),
    sourceRecordId: asNullableString(input.sourceRecordId ?? input.source_record_id),
    metadata: asRecord(input.metadata) ?? {}
  };
}

export function normalizeWeeklyStatsRecord(input: unknown, provider: string): AdapterWeeklyStatsRecord {
  const record = asRecordRequired(input);
  const base = normalizeAdapterBase(record, { provider, externalType: "player" });
  const season = asIntegerRequired(record.season, "season");
  const week = asIntegerRequired(record.week, "week");

  return {
    ...base,
    kind: "weekly_stats",
    season,
    week,
    seasonType: validateSeasonType(asNullableString(record.seasonType ?? record.season_type)),
    gameId: asNullableString(record.gameId ?? record.game_id),
    opponent: normalizeTeam(asNullableString(record.opponent)),
    homeAway: normalizeHomeAway(record.homeAway ?? record.home_away),
    gameDate: asNullableString(record.gameDate ?? record.game_date),
    stats: normalizeStatsJson(asRecord(record.stats) ?? {}),
    providerFantasyPoints: asNullableNumber(record.providerFantasyPoints ?? record.provider_fantasy_points),
    dataVersion: asNullableString(record.dataVersion ?? record.data_version)
  };
}

export function normalizeSeasonStatsRecord(input: unknown, provider: string): AdapterSeasonStatsRecord {
  const record = asRecordRequired(input);
  const base = normalizeAdapterBase(record, { provider, externalType: "player" });
  const season = asIntegerRequired(record.season, "season");

  return {
    ...base,
    kind: "season_stats",
    season,
    seasonType: validateSeasonType(asNullableString(record.seasonType ?? record.season_type)),
    gamesPlayed: asNullableInteger(record.gamesPlayed ?? record.games_played),
    gamesStarted: asNullableInteger(record.gamesStarted ?? record.games_started),
    stats: normalizeStatsJson(asRecord(record.stats) ?? {}),
    providerFantasyPoints: asNullableNumber(record.providerFantasyPoints ?? record.provider_fantasy_points),
    dataVersion: asNullableString(record.dataVersion ?? record.data_version)
  };
}

export function normalizeProjectionRecord(input: unknown, provider: string): AdapterProjectionRecord {
  const record = asRecordRequired(input);
  const base = normalizeAdapterBase(record, { provider, externalType: "player" });
  const season = asIntegerRequired(record.season, "season");

  return {
    ...base,
    kind: "projection",
    season,
    week: asNullableInteger(record.week),
    seasonType: validateSeasonType(asNullableString(record.seasonType ?? record.season_type)),
    projectionType: validateProjectionType(asStringRequired(record.projectionType ?? record.projection_type, "projectionType")),
    scoringFormat: asNullableString(record.scoringFormat ?? record.scoring_format),
    opponent: normalizeTeam(asNullableString(record.opponent)),
    stats: normalizeStatsJson(asRecord(record.stats) ?? {}),
    providerFantasyPoints: asNullableNumber(record.providerFantasyPoints ?? record.provider_fantasy_points),
    version: asNullableString(record.version) ?? "current"
  };
}

export function normalizeInjuryRecord(input: unknown, provider: string): AdapterInjuryRecord {
  const record = asRecordRequired(input);
  const base = normalizeAdapterBase(record, { provider, externalType: "player" });

  return {
    ...base,
    kind: "injury",
    season: asNullableInteger(record.season),
    week: asNullableInteger(record.week),
    status: asNullableString(record.status),
    practiceStatus: asNullableString(record.practiceStatus ?? record.practice_status),
    gameStatus: asNullableString(record.gameStatus ?? record.game_status),
    bodyPart: asNullableString(record.bodyPart ?? record.body_part),
    injuryType: asNullableString(record.injuryType ?? record.injury_type),
    description: asNullableString(record.description),
    expectedReturn: asNullableString(record.expectedReturn ?? record.expected_return),
    observedAt: asNullableString(record.observedAt ?? record.observed_at),
    isCurrent: typeof record.isCurrent === "boolean" ? record.isCurrent : true
  };
}

export function prepareWeeklyStatsCanonicalInput(record: AdapterWeeklyStatsRecord, playerId: string): PreparedCanonicalRecord {
  return {
    kind: "weekly_stats",
    playerId,
    input: buildWeeklyStatsInsert({
      player_id: playerId,
      provider: record.provider,
      provider_external_id: record.providerExternalId,
      season: record.season,
      week: record.week,
      season_type: record.seasonType,
      game_id: record.gameId,
      team: record.team,
      opponent: record.opponent,
      position_group: record.positionGroup,
      home_away: record.homeAway,
      game_date: record.gameDate,
      stats_json: record.stats,
      provider_fantasy_points: record.providerFantasyPoints,
      source_updated_at: record.sourceUpdatedAt,
      data_version: record.dataVersion,
      metadata_json: withAdapterMetadata(record)
    })
  };
}

export function prepareSeasonStatsCanonicalInput(record: AdapterSeasonStatsRecord, playerId: string): PreparedCanonicalRecord {
  return {
    kind: "season_stats",
    playerId,
    input: buildSeasonStatsInsert({
      player_id: playerId,
      provider: record.provider,
      provider_external_id: record.providerExternalId,
      season: record.season,
      season_type: record.seasonType,
      team: record.team,
      position_group: record.positionGroup,
      games_played: record.gamesPlayed,
      games_started: record.gamesStarted,
      stats_json: record.stats,
      provider_fantasy_points: record.providerFantasyPoints,
      source_updated_at: record.sourceUpdatedAt,
      data_version: record.dataVersion,
      metadata_json: withAdapterMetadata(record)
    })
  };
}

export function prepareProjectionCanonicalInput(record: AdapterProjectionRecord, playerId: string): PreparedCanonicalRecord {
  return {
    kind: "projection",
    playerId,
    input: buildProjectionInsert({
      player_id: playerId,
      provider: record.provider,
      provider_external_id: record.providerExternalId,
      season: record.season,
      week: record.week,
      season_type: record.seasonType,
      projection_type: record.projectionType,
      scoring_format: record.scoringFormat,
      position_group: record.positionGroup,
      team: record.team,
      opponent: record.opponent,
      stats_json: record.stats,
      provider_fantasy_points: record.providerFantasyPoints,
      source_updated_at: record.sourceUpdatedAt,
      version: record.version,
      metadata_json: withAdapterMetadata(record)
    })
  };
}

export function prepareInjuryCanonicalInput(record: AdapterInjuryRecord, playerId: string): PreparedCanonicalRecord {
  return {
    kind: "injury",
    playerId,
    executionMode: "append_observation",
    input: buildInjuryInsert({
      player_id: playerId,
      provider: record.provider,
      provider_external_id: record.providerExternalId,
      season: record.season,
      week: record.week,
      team: record.team,
      status: record.status,
      practice_status: record.practiceStatus,
      game_status: record.gameStatus,
      body_part: record.bodyPart,
      injury_type: record.injuryType,
      description: record.description,
      expected_return: record.expectedReturn,
      source_updated_at: record.sourceUpdatedAt,
      observed_at: record.observedAt ?? undefined,
      is_current: record.isCurrent,
      metadata_json: withAdapterMetadata(record)
    })
  };
}

export function buildIdentitySearchName(record: Pick<AdapterRecordBase, "fullName" | "firstName" | "lastName">) {
  return normalizePlayerName(record.fullName ?? [record.firstName, record.lastName].filter(Boolean).join(" "));
}

function withAdapterMetadata(record: AdapterSourceRecord) {
  return {
    ...record.metadata,
    adapter_source_record_id: record.sourceRecordId,
    adapter_raw_position: record.rawPosition,
    adapter_full_name: record.fullName,
    adapter_first_name: record.firstName,
    adapter_last_name: record.lastName
  };
}

function asRecordRequired(input: unknown) {
  const record = asRecord(input);
  if (!record) {
    throw new Error("Source record must be an object.");
  }
  return record;
}

function asRecord(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Expected string value.");
  const normalized = value.trim();
  return normalized || null;
}

function asStringRequired(value: unknown, field: string) {
  const normalized = asNullableString(value);
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function asIntegerRequired(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer.`);
  }
  return value;
}

function asNullableInteger(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Expected integer value.");
  }
  return value;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Expected finite numeric value.");
  }
  return value;
}

function normalizeHomeAway(value: unknown): "home" | "away" | null {
  const normalized = asNullableString(value);
  if (!normalized) return null;
  if (normalized.toLowerCase() === "home") return "home";
  if (normalized.toLowerCase() === "away") return "away";
  throw new Error("homeAway must be home or away.");
}
