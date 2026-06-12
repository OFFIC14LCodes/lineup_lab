import type {
  PlayerInjuryInsert,
  PlayerProjectionInsert,
  PlayerSeasonStatsInsert,
  PlayerWeeklyStatsInsert
} from "@/lib/providers/data-types";
import type { ExternalEntityType, ProviderName } from "@/lib/providers/types";
import {
  MAX_BATCH_SIZE,
  ProviderRepositoryConflictError,
  ProviderRepositoryValidationError,
  normalizeLimitOffset,
  validateBatchSize
} from "@/lib/providers/repositories/shared";

export type WeeklyStatsConflictScope =
  | {
      mode: "with_game";
      playerId: string;
      provider: string;
      season: number;
      week: number;
      seasonType: string;
      gameId: string;
      dataVersion: string | null;
    }
  | {
      mode: "without_game";
      playerId: string;
      provider: string;
      season: number;
      week: number;
      seasonType: string;
      dataVersion: string | null;
    };

export type SeasonStatsScope = {
  playerId: string;
  provider: string;
  season: number;
  seasonType: string;
};

export type ProjectionScope =
  | {
      mode: "weekly";
      playerId: string;
      provider: string;
      season: number;
      week: number;
      seasonType: string;
      projectionType: string;
      scoringFormat: string | null;
      version: string;
    }
  | {
      mode: "non_weekly";
      playerId: string;
      provider: string;
      season: number;
      seasonType: string;
      projectionType: string;
      scoringFormat: string | null;
      version: string;
    };

export type InjuryTransitionPlan = {
  playerId: string;
  provider: string;
  rowsToDeactivate: string[];
};

export type ExternalMappingDecision =
  | { ok: true; playerId: string; provider: ProviderName; providerExternalId: string | null }
  | { ok: false; code: "mapping_required" | "mapping_conflict"; message: string };

export function buildWeeklyStatsConflictScope(row: PlayerWeeklyStatsInsert): WeeklyStatsConflictScope {
  if (row.game_id) {
    return {
      mode: "with_game",
      playerId: row.player_id,
      provider: row.provider,
      season: row.season,
      week: row.week,
      seasonType: row.season_type ?? "regular",
      gameId: row.game_id,
      dataVersion: row.data_version ?? null
    };
  }

  return {
    mode: "without_game",
    playerId: row.player_id,
    provider: row.provider,
    season: row.season,
    week: row.week,
    seasonType: row.season_type ?? "regular",
    dataVersion: row.data_version ?? null
  };
}

export function buildSeasonStatsScope(row: PlayerSeasonStatsInsert): SeasonStatsScope {
  return {
    playerId: row.player_id,
    provider: row.provider,
    season: row.season,
    seasonType: row.season_type ?? "regular"
  };
}

export function buildProjectionScope(row: PlayerProjectionInsert): ProjectionScope {
  const scoringFormat = row.scoring_format ?? null;
  const version = row.version ?? "current";

  if (row.week !== null && row.week !== undefined) {
    return {
      mode: "weekly",
      playerId: row.player_id,
      provider: row.provider,
      season: row.season,
      week: row.week,
      seasonType: row.season_type ?? "regular",
      projectionType: row.projection_type,
      scoringFormat,
      version
    };
  }

  return {
    mode: "non_weekly",
    playerId: row.player_id,
    provider: row.provider,
    season: row.season,
    seasonType: row.season_type ?? "regular",
    projectionType: row.projection_type,
    scoringFormat,
    version
  };
}

export function buildInjuryDedupeKey(row: PlayerInjuryInsert) {
  if (!row.source_updated_at) {
    return null;
  }

  return {
    playerId: row.player_id,
    provider: row.provider,
    sourceUpdatedAt: row.source_updated_at,
    team: row.team ?? null,
    status: row.status ?? null,
    practiceStatus: row.practice_status ?? null,
    gameStatus: row.game_status ?? null,
    bodyPart: row.body_part ?? null,
    injuryType: row.injury_type ?? null
  };
}

export function planCurrentInjuryTransition(args: {
  playerId: string;
  provider: string;
  existingCurrentRows: Array<{ id: string; player_id: string; provider: string; is_current: boolean }>;
}): InjuryTransitionPlan {
  return {
    playerId: args.playerId,
    provider: args.provider,
    rowsToDeactivate: args.existingCurrentRows
      .filter((row) => row.player_id === args.playerId && row.provider === args.provider && row.is_current)
      .map((row) => row.id)
  };
}

export function verifyExternalMappingDecision(args: {
  playerId: string;
  provider: ProviderName;
  providerExternalId: string | null;
  requireVerifiedMapping: boolean;
  matches: Array<{ player_id: string; external_type: ExternalEntityType }>;
}): ExternalMappingDecision {
  if (!args.providerExternalId) {
    return {
      ok: true,
      playerId: args.playerId,
      provider: args.provider,
      providerExternalId: null
    };
  }

  if (args.matches.length === 0) {
    if (!args.requireVerifiedMapping) {
      return {
        ok: true,
        playerId: args.playerId,
        provider: args.provider,
        providerExternalId: args.providerExternalId
      };
    }

    return {
      ok: false,
      code: "mapping_required",
      message: `No external ID mapping exists for ${args.provider}:${args.providerExternalId}.`
    };
  }

  const hasConflict = args.matches.some((match) => match.player_id !== args.playerId);
  if (hasConflict) {
    return {
      ok: false,
      code: "mapping_conflict",
      message: `External ID ${args.provider}:${args.providerExternalId} is mapped to a different player.`
    };
  }

  return {
    ok: true,
    playerId: args.playerId,
    provider: args.provider,
    providerExternalId: args.providerExternalId
  };
}

export function ensureDistinctScopes<T>(rows: T[], scopeBuilder: (row: T) => string) {
  const seen = new Set<string>();

  for (const row of rows) {
    const scope = scopeBuilder(row);
    if (seen.has(scope)) {
      throw new ProviderRepositoryConflictError(`Duplicate logical row detected for scope ${scope}.`);
    }
    seen.add(scope);
  }
}

export function normalizeListQueryOptions(input: { limit?: number; offset?: number }) {
  return normalizeLimitOffset(input.limit, input.offset);
}

export function validateBatchPlan<T>(rows: T[], scopeBuilder: (row: T) => string) {
  validateBatchSize(rows.length, MAX_BATCH_SIZE);
  ensureDistinctScopes(rows, scopeBuilder);
  return rows;
}

export function scopeToKey(scope: WeeklyStatsConflictScope | SeasonStatsScope | ProjectionScope) {
  return JSON.stringify(scope);
}

export function rejectIfEmptyIds(ids: string[], label: string) {
  if (ids.length === 0) {
    throw new ProviderRepositoryValidationError(`${label} must contain at least one value.`);
  }
  return ids;
}

