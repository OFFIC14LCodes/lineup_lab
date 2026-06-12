import type { PositionGroup } from "@/lib/scoring/types";
import type { ProviderName } from "@/lib/providers/types";
import type { ProjectionType } from "@/lib/providers/data-types";
import type { ScoringInspectorQuery, ScoringInspectorSourceType } from "@/lib/scoring/server/types";
import { SCORING_INSPECTOR_ERROR_CODES, ScoringInspectorError } from "@/lib/scoring/server/errors";
import { normalizePositionGroup } from "@/lib/players/normalize";

const MAX_LIMIT = 100;
const SOURCE_TYPES: ScoringInspectorSourceType[] = ["weekly_stats", "season_stats", "projections"];

export function parseScoringInspectorQuery(searchParams: URLSearchParams): ScoringInspectorQuery {
  const leagueId = searchParams.get("leagueId")?.trim();
  const sourceType = searchParams.get("sourceType")?.trim() as ScoringInspectorSourceType | null;
  if (!leagueId) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.invalidRequest, "leagueId is required.", 400);
  }
  if (!sourceType || !SOURCE_TYPES.includes(sourceType)) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.invalidRequest, "sourceType is invalid.", 400);
  }

  const season = parseOptionalInteger(searchParams.get("season"), "season");
  const week = parseOptionalInteger(searchParams.get("week"), "week");
  if (week !== null && (week < 1 || week > 25)) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.invalidRequest, "week must be between 1 and 25.", 400);
  }

  const positionGroup = parsePositionGroup(searchParams.get("positionGroup"));
  const provider = parseProvider(searchParams.get("provider"));
  const projectionType = parseProjectionType(searchParams.get("projectionType"));
  const rowId = searchParams.get("rowId")?.trim() || null;
  const limit = parseLimit(searchParams.get("limit"));

  return {
    leagueId,
    sourceType,
    rowId,
    season,
    week,
    provider,
    positionGroup,
    projectionType,
    limit
  };
}

function parseOptionalInteger(value: string | null, label: string) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      `${label} must be an integer.`,
      400
    );
  }
  return parsed;
}

function parseLimit(value: string | null) {
  if (!value?.trim()) return 25;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      `limit must be between 1 and ${MAX_LIMIT}.`,
      400
    );
  }
  return parsed;
}

function parsePositionGroup(value: string | null): PositionGroup | null {
  if (!value?.trim()) return null;
  const normalized = normalizePositionGroup(value);
  if (!normalized) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      "positionGroup is invalid.",
      400
    );
  }
  return normalized;
}

function parseProvider(value: string | null): ProviderName | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const supportedProviders = new Set<ProviderName>([
    "sleeper",
    "sportsdataio",
    "fantasydata",
    "sportradar",
    "nflverse",
    "gsis",
    "espn",
    "yahoo",
    "manual"
  ]);
  if (!supportedProviders.has(normalized as ProviderName)) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      "provider is invalid.",
      400
    );
  }
  return normalized as ProviderName;
}

function parseProjectionType(value: string | null): ProjectionType | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const supportedProjectionTypes = new Set<ProjectionType>([
    "preseason",
    "season",
    "weekly",
    "rest_of_season"
  ]);
  if (!supportedProjectionTypes.has(normalized as ProjectionType)) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      "projectionType is invalid.",
      400
    );
  }
  return normalized as ProjectionType;
}
