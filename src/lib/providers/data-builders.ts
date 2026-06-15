import { normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";
import { normalizeProviderName } from "@/lib/providers/constants";
import { getCanonicalStatDefinitions } from "@/lib/scoring/stat-aliases";
import {
  HOME_AWAY_VALUES,
  PROJECTION_TYPES,
  SEASON_TYPES,
  type HomeAway,
  type PlayerInjuryInsert,
  type PlayerProjectionInsert,
  type PlayerSeasonStatsInsert,
  type PlayerWeeklyStatsInsert,
  type ProjectionType,
  type ProviderStatsJson,
  type ProviderStatsJsonValue,
  type SeasonType
} from "@/lib/providers/data-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSeasonType(value?: string | null): SeasonType {
  const normalized = value?.trim().toLowerCase() || "regular";
  if (!(SEASON_TYPES as readonly string[]).includes(normalized)) {
    throw new Error(`Unsupported season type: ${value}`);
  }
  return normalized as SeasonType;
}

export function validateProjectionType(value: string): ProjectionType {
  const normalized = value.trim().toLowerCase();
  if (!(PROJECTION_TYPES as readonly string[]).includes(normalized)) {
    throw new Error(`Unsupported projection type: ${value}`);
  }
  return normalized as ProjectionType;
}

export function validateHomeAway(value?: string | null): HomeAway | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!(HOME_AWAY_VALUES as readonly string[]).includes(normalized)) {
    throw new Error(`Unsupported home/away value: ${value}`);
  }
  return normalized as HomeAway;
}

export function normalizeStatsJson(stats: Record<string, unknown>): ProviderStatsJson {
  const normalized: ProviderStatsJson = {};

  for (const [key, value] of Object.entries(stats)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    normalized[normalizedKey] = normalizeStatsJsonValue(value, normalizedKey);
  }

  addCanonicalStatAliases(normalized);

  return normalized;
}

export function buildWeeklyStatsInsert(input: PlayerWeeklyStatsInsert): PlayerWeeklyStatsInsert {
  return {
    player_id: normalizeUuid(input.player_id, "player_id"),
    provider: normalizeProviderName(input.provider),
    provider_external_id: normalizeNullableText(input.provider_external_id),
    season: normalizeSeason(input.season),
    week: normalizeWeek(input.week),
    season_type: validateSeasonType(input.season_type),
    game_id: normalizeNullableText(input.game_id),
    team: normalizeTeam(input.team),
    opponent: normalizeTeam(input.opponent),
    position_group: normalizeNullablePositionGroup(input.position_group),
    home_away: validateHomeAway(input.home_away),
    game_date: normalizeNullableIsoString(input.game_date, "game_date"),
    stats_json: normalizeStatsJson(input.stats_json),
    provider_fantasy_points: normalizeNullableFiniteNumber(input.provider_fantasy_points, "provider_fantasy_points"),
    source_updated_at: normalizeNullableIsoString(input.source_updated_at, "source_updated_at"),
    ingested_at: normalizeOptionalIsoString(input.ingested_at, "ingested_at"),
    data_version: normalizeNullableText(input.data_version),
    metadata_json: normalizeMetadata(input.metadata_json)
  };
}

export function buildSeasonStatsInsert(input: PlayerSeasonStatsInsert): PlayerSeasonStatsInsert {
  return {
    player_id: normalizeUuid(input.player_id, "player_id"),
    provider: normalizeProviderName(input.provider),
    provider_external_id: normalizeNullableText(input.provider_external_id),
    season: normalizeSeason(input.season),
    season_type: validateSeasonType(input.season_type),
    team: normalizeTeam(input.team),
    position_group: normalizeNullablePositionGroup(input.position_group),
    games_played: normalizeNullableNonNegativeInteger(input.games_played, "games_played"),
    games_started: normalizeNullableNonNegativeInteger(input.games_started, "games_started"),
    stats_json: normalizeStatsJson(input.stats_json),
    provider_fantasy_points: normalizeNullableFiniteNumber(input.provider_fantasy_points, "provider_fantasy_points"),
    source_updated_at: normalizeNullableIsoString(input.source_updated_at, "source_updated_at"),
    ingested_at: normalizeOptionalIsoString(input.ingested_at, "ingested_at"),
    data_version: normalizeNullableText(input.data_version),
    metadata_json: normalizeMetadata(input.metadata_json)
  };
}

export function buildProjectionInsert(input: PlayerProjectionInsert): PlayerProjectionInsert {
  const projectionType = validateProjectionType(input.projection_type);
  const week = input.week === undefined ? undefined : normalizeNullableWeek(input.week);

  if (projectionType === "weekly" && week == null) {
    throw new Error("Weekly projections require a week.");
  }

  if (projectionType !== "weekly" && week !== null && week !== undefined) {
    throw new Error(`${projectionType} projections must not include a week.`);
  }

  return {
    player_id: normalizeUuid(input.player_id, "player_id"),
    provider: normalizeProviderName(input.provider),
    provider_external_id: normalizeNullableText(input.provider_external_id),
    season: normalizeSeason(input.season),
    week,
    season_type: validateSeasonType(input.season_type),
    projection_type: projectionType,
    scoring_format: normalizeNullableText(input.scoring_format),
    position_group: normalizeNullablePositionGroup(input.position_group),
    team: normalizeTeam(input.team),
    opponent: normalizeTeam(input.opponent),
    stats_json: normalizeStatsJson(input.stats_json),
    provider_fantasy_points: normalizeNullableFiniteNumber(input.provider_fantasy_points, "provider_fantasy_points"),
    source_updated_at: normalizeNullableIsoString(input.source_updated_at, "source_updated_at"),
    ingested_at: normalizeOptionalIsoString(input.ingested_at, "ingested_at"),
    version: normalizeNullableText(input.version) || "current",
    metadata_json: normalizeMetadata(input.metadata_json)
  };
}

export function buildInjuryInsert(input: PlayerInjuryInsert): PlayerInjuryInsert {
  return {
    player_id: normalizeUuid(input.player_id, "player_id"),
    provider: normalizeProviderName(input.provider),
    provider_external_id: normalizeNullableText(input.provider_external_id),
    season: input.season === undefined ? undefined : normalizeNullableSeason(input.season),
    week: input.week === undefined ? undefined : normalizeNullableWeek(input.week),
    team: normalizeTeam(input.team),
    status: normalizeNullableText(input.status),
    practice_status: normalizeNullableText(input.practice_status),
    game_status: normalizeNullableText(input.game_status),
    body_part: normalizeNullableText(input.body_part),
    injury_type: normalizeNullableText(input.injury_type),
    description: normalizeNullableText(input.description),
    expected_return: normalizeNullableText(input.expected_return),
    source_updated_at: normalizeNullableIsoString(input.source_updated_at, "source_updated_at"),
    observed_at: normalizeOptionalIsoString(input.observed_at, "observed_at"),
    ingested_at: normalizeOptionalIsoString(input.ingested_at, "ingested_at"),
    is_current: input.is_current ?? true,
    metadata_json: normalizeMetadata(input.metadata_json)
  };
}

function normalizeUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return value;
}

function normalizeSeason(value: number) {
  if (!Number.isInteger(value) || value < 1900 || value > 3000) {
    throw new Error("Season must be a four-digit year.");
  }
  return value;
}

function normalizeNullableSeason(value: number | null) {
  if (value === null) return null;
  return normalizeSeason(value);
}

function normalizeWeek(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw new Error("Week must be an integer between 1 and 25.");
  }
  return value;
}

function normalizeNullableWeek(value: number | null) {
  if (value === null) return null;
  return normalizeWeek(value);
}

function normalizeNullableFiniteNumber(value: number | null | undefined, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function normalizeNullableNonNegativeInteger(value: number | null | undefined, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalIsoString(value: string | undefined, label: string) {
  return value ? normalizeNullableIsoString(value, label) ?? undefined : undefined;
}

function normalizeNullableIsoString(value: string | null | undefined, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return date.toISOString();
}

function normalizeNullablePositionGroup(value?: string | null) {
  if (!value) return null;
  const normalized = normalizePositionGroup(value);
  return normalized ?? normalizeNullableText(value);
}

function normalizeMetadata(value?: Record<string, unknown>) {
  return value ?? {};
}

function normalizeStatsJsonValue(value: unknown, key: string): ProviderStatsJsonValue {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Stat ${key} must be a finite number.`);
    }
    return value;
  }

  throw new Error(`Stat ${key} must be a string, number, boolean, or null.`);
}

function addCanonicalStatAliases(stats: ProviderStatsJson) {
  const lowerKeyLookup = new Map(Object.keys(stats).map((key) => [key.trim().toLowerCase(), key]));

  for (const definition of getCanonicalStatDefinitions()) {
    if (lowerKeyLookup.has(definition.canonicalKey)) continue;

    const matchingAlias = definition.aliases
      .map((alias) => lowerKeyLookup.get(alias))
      .find((key): key is string => Boolean(key));
    if (!matchingAlias) continue;

    const value = stats[matchingAlias];
    if (typeof value === "number" || typeof value === "string") {
      stats[definition.canonicalKey] = value;
    }
  }
}
