import "server-only";

import { createClient } from "@/lib/supabase/server";
import { auditAggregateScoringCompatibility, scoreFantasyStats } from "@/lib/scoring";
import { compareProviderPoints } from "@/lib/scoring/server/compare-provider-points";
import { SCORING_INSPECTOR_ERROR_CODES, ScoringInspectorError } from "@/lib/scoring/server/errors";
import { getLeagueScoringContext } from "@/lib/scoring/server/league-settings";
import { buildStoredRowScoringError, buildStoredRowScoringResult, resolveStoredRowPositionGroup } from "@/lib/scoring/server/score-stored-row";
import type { LeagueScoringContext, StoredRowBatchItem, StoredRowScoringResult } from "@/lib/scoring/server/types";
import type { PositionGroup, ScoringWarning } from "@/lib/scoring/types";
import type { PlayerSeasonStatsRow } from "@/lib/providers/data-types";
import type { ProviderName } from "@/lib/providers/types";

type SeasonStatsRow = Pick<
  PlayerSeasonStatsRow,
  | "id"
  | "player_id"
  | "provider"
  | "provider_external_id"
  | "season"
  | "position_group"
  | "stats_json"
  | "provider_fantasy_points"
  | "source_updated_at"
  | "ingested_at"
>;

type PlayerRow = {
  id: string;
  full_name: string | null;
  team: string | null;
  position: string | null;
  raw_position: string | null;
  primary_position: string | null;
  position_group: string | null;
};

type Dependencies = {
  getLeagueScoringContext: typeof getLeagueScoringContext;
  loadSeasonStatsRow: (rowId: string) => Promise<SeasonStatsRow | null>;
  listSeasonStatsRows: (input: {
    season: number;
    provider?: ProviderName | null;
    positionGroup?: PositionGroup | null;
    playerIds?: string[] | null;
    limit: number;
  }) => Promise<SeasonStatsRow[]>;
  loadPlayersByIds: (playerIds: string[]) => Promise<Map<string, PlayerRow>>;
};

const defaultDependencies: Dependencies = {
  getLeagueScoringContext,
  async loadSeasonStatsRow(rowId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("player_season_stats")
      .select("id,player_id,provider,provider_external_id,season,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at")
      .eq("id", rowId)
      .maybeSingle();
    if (error) {
      throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.internalError, "Unable to load season stats row.", 500);
    }
    return (data as SeasonStatsRow | null) ?? null;
  },
  async listSeasonStatsRows(input) {
    const supabase = await createClient();
    let query = supabase
      .from("player_season_stats")
      .select("id,player_id,provider,provider_external_id,season,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at")
      .eq("season", input.season)
      .order("provider", { ascending: true })
      .order("player_id", { ascending: true })
      .limit(input.limit);

    if (input.provider) query = query.eq("provider", input.provider);
    if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
    if (input.playerIds?.length) query = query.in("player_id", input.playerIds);

    const { data, error } = await query;
    if (error) {
      throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.internalError, "Unable to list season stats rows.", 500);
    }

    return (data ?? []) as SeasonStatsRow[];
  },
  async loadPlayersByIds(playerIds) {
    if (playerIds.length === 0) return new Map<string, PlayerRow>();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("players")
      .select("id,full_name,team,position,raw_position,primary_position,position_group")
      .in("id", playerIds);

    if (error) {
      throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.internalError, "Unable to load player context.", 500);
    }

    return new Map((data ?? []).map((row) => [row.id, row as PlayerRow]));
  }
};

export async function scoreStoredSeasonStatsForLeague(
  args: { userId: string; leagueId: string; seasonStatsRowId: string },
  dependencyOverrides: Partial<Dependencies> = {}
): Promise<StoredRowScoringResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const league = await dependencies.getLeagueScoringContext({ userId: args.userId, leagueId: args.leagueId });
  const row = await dependencies.loadSeasonStatsRow(args.seasonStatsRowId);

  if (!row) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.rowNotFound, "Season stats row not found.", 404);
  }

  const playerMap = await dependencies.loadPlayersByIds([row.player_id]);
  return scoreSeasonRow(league, row, playerMap.get(row.player_id) ?? null);
}

export async function scoreSeasonStatsRowsForLeague(
  args: {
    userId: string;
    leagueId: string;
    season: number;
    provider?: ProviderName | null;
    positionGroup?: PositionGroup | null;
    playerIds?: string[] | null;
    limit?: number;
  },
  dependencyOverrides: Partial<Dependencies> = {}
): Promise<{ league: LeagueScoringContext; results: StoredRowBatchItem[] }> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const league = await dependencies.getLeagueScoringContext({ userId: args.userId, leagueId: args.leagueId });
  const rows = await dependencies.listSeasonStatsRows({
    season: args.season,
    provider: args.provider ?? null,
    positionGroup: args.positionGroup ?? null,
    playerIds: args.playerIds ?? null,
    limit: args.limit ?? 25
  });
  const playerMap = await dependencies.loadPlayersByIds([...new Set(rows.map((row) => row.player_id))]);

  return {
    league,
    results: rows.map((row) => {
      try {
        return {
          ok: true as const,
          result: scoreSeasonRow(league, row, playerMap.get(row.player_id) ?? null)
        };
      } catch (error) {
        return {
          ok: false as const,
          error: buildStoredRowScoringError({
            rowId: row.id,
            table: "player_season_stats",
            provider: row.provider,
            season: row.season,
            week: null,
            code: error instanceof ScoringInspectorError ? error.code : SCORING_INSPECTOR_ERROR_CODES.internalError,
            message: error instanceof Error ? error.message : "Unable to score season stats row."
          })
        };
      }
    })
  };
}

function scoreSeasonRow(league: LeagueScoringContext, row: SeasonStatsRow, player: PlayerRow | null) {
  if (!player) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.rowNotFound, "Canonical player record not found for season stats row.", 404);
  }

  const position = resolveStoredRowPositionGroup({
    rowPositionGroup: row.position_group,
    player
  });
  const aggregateCompatibility = auditAggregateScoringCompatibility({
    scoringSettings: league.scoringSettings,
    positionGroup: position.positionGroup
  });
  const contextWarnings: ScoringWarning[] = [
    ...position.warnings,
    ...(aggregateCompatibility.isExact
      ? []
      : [
          {
            code: "AGGREGATE_SCORING_LIMITATION",
            message:
              "Season aggregate scoring may differ from summed weekly fantasy points when weekly bonuses, tiered defense rules, or other game-level scoring keys are active."
          }
        ]),
    ...aggregateCompatibility.warnings
  ];

  const blackbird = scoreFantasyStats({
    stats: row.stats_json,
    scoringSettings: league.scoringSettings,
    positionGroup: position.positionGroup,
    statSource: "actual",
    context: {
      season: row.season,
      playerId: row.player_id
    }
  });
  const blackbirdWithWarnings = {
    ...blackbird,
    warnings: [...blackbird.warnings, ...contextWarnings]
  };

  return buildStoredRowScoringResult({
    league,
    player,
    source: {
      table: "player_season_stats",
      rowId: row.id,
      provider: row.provider,
      providerExternalId: row.provider_external_id,
      season: row.season,
      week: null,
      projectionType: null,
      sourceUpdatedAt: row.source_updated_at,
      ingestedAt: row.ingested_at
    },
    blackbird: blackbirdWithWarnings,
    providerComparison: compareProviderPoints({
      providerPoints: row.provider_fantasy_points,
      blackbird: blackbirdWithWarnings,
      forceIncomplete: !aggregateCompatibility.isExact,
      warnings: !aggregateCompatibility.isExact
        ? [
            "Aggregate season scoring is estimated for this league configuration, so provider comparison is informational only."
          ]
        : undefined
    }),
    aggregateCompatibility,
    contextWarnings
  });
}
