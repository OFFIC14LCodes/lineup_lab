import "server-only";

import { createClient } from "@/lib/supabase/server";
import { compareProviderPoints } from "@/lib/scoring/server/compare-provider-points";
import { SCORING_INSPECTOR_ERROR_CODES, ScoringInspectorError } from "@/lib/scoring/server/errors";
import { getLeagueScoringContext } from "@/lib/scoring/server/league-settings";
import { buildStoredRowScoringError, buildStoredRowScoringResult, resolveStoredRowPositionGroup } from "@/lib/scoring/server/score-stored-row";
import type { LeagueScoringContext, StoredRowBatchItem, StoredRowScoringResult } from "@/lib/scoring/server/types";
import { scoreFantasyStats } from "@/lib/scoring";
import type { PositionGroup, ScoringWarning } from "@/lib/scoring/types";
import type { PlayerWeeklyStatsRow } from "@/lib/providers/data-types";
import type { ProviderName } from "@/lib/providers/types";

type WeeklyStatsRow = Pick<
  PlayerWeeklyStatsRow,
  | "id"
  | "player_id"
  | "provider"
  | "provider_external_id"
  | "season"
  | "week"
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
  loadWeeklyStatsRow: (rowId: string) => Promise<WeeklyStatsRow | null>;
  listWeeklyStatsRows: (input: {
    season: number;
    week: number;
    provider?: ProviderName | null;
    positionGroup?: PositionGroup | null;
    playerIds?: string[] | null;
    limit: number;
  }) => Promise<WeeklyStatsRow[]>;
  loadPlayersByIds: (playerIds: string[]) => Promise<Map<string, PlayerRow>>;
};

const defaultDependencies: Dependencies = {
  getLeagueScoringContext,
  async loadWeeklyStatsRow(rowId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("player_weekly_stats")
      .select("id,player_id,provider,provider_external_id,season,week,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at")
      .eq("id", rowId)
      .maybeSingle();

    if (error) {
      throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.internalError, "Unable to load weekly stats row.", 500);
    }

    return (data as WeeklyStatsRow | null) ?? null;
  },
  async listWeeklyStatsRows(input) {
    const supabase = await createClient();
    let query = supabase
      .from("player_weekly_stats")
      .select("id,player_id,provider,provider_external_id,season,week,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at")
      .eq("season", input.season)
      .eq("week", input.week)
      .order("provider", { ascending: true })
      .order("player_id", { ascending: true })
      .limit(input.limit);

    if (input.provider) query = query.eq("provider", input.provider);
    if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
    if (input.playerIds?.length) query = query.in("player_id", input.playerIds);

    const { data, error } = await query;
    if (error) {
      throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.internalError, "Unable to list weekly stats rows.", 500);
    }

    return (data ?? []) as WeeklyStatsRow[];
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

export async function scoreStoredWeeklyStatsForLeague(
  args: { userId: string; leagueId: string; weeklyStatsRowId: string },
  dependencyOverrides: Partial<Dependencies> = {}
): Promise<StoredRowScoringResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const league = await dependencies.getLeagueScoringContext({ userId: args.userId, leagueId: args.leagueId });
  const row = await dependencies.loadWeeklyStatsRow(args.weeklyStatsRowId);

  if (!row) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.rowNotFound, "Weekly stats row not found.", 404);
  }

  const playerMap = await dependencies.loadPlayersByIds([row.player_id]);
  return scoreWeeklyRow(league, row, playerMap.get(row.player_id) ?? null);
}

export async function scoreWeeklyStatsRowsForLeague(
  args: {
    userId: string;
    leagueId: string;
    season: number;
    week: number;
    provider?: ProviderName | null;
    positionGroup?: PositionGroup | null;
    playerIds?: string[] | null;
    limit?: number;
  },
  dependencyOverrides: Partial<Dependencies> = {}
): Promise<{ league: LeagueScoringContext; results: StoredRowBatchItem[] }> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const league = await dependencies.getLeagueScoringContext({ userId: args.userId, leagueId: args.leagueId });
  const rows = await dependencies.listWeeklyStatsRows({
    season: args.season,
    week: args.week,
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
          result: scoreWeeklyRow(league, row, playerMap.get(row.player_id) ?? null)
        };
      } catch (error) {
        return {
          ok: false as const,
          error: buildStoredRowScoringError({
            rowId: row.id,
            table: "player_weekly_stats",
            provider: row.provider,
            season: row.season,
            week: row.week,
            code: error instanceof ScoringInspectorError ? error.code : SCORING_INSPECTOR_ERROR_CODES.internalError,
            message: error instanceof Error ? error.message : "Unable to score weekly stats row."
          })
        };
      }
    })
  };
}

function scoreWeeklyRow(league: LeagueScoringContext, row: WeeklyStatsRow, player: PlayerRow | null) {
  if (!player) {
    throw new ScoringInspectorError(SCORING_INSPECTOR_ERROR_CODES.rowNotFound, "Canonical player record not found for weekly stats row.", 404);
  }

  const position = resolveStoredRowPositionGroup({
    rowPositionGroup: row.position_group,
    player
  });
  const blackbird = scoreFantasyStats({
    stats: row.stats_json,
    scoringSettings: league.scoringSettings,
    positionGroup: position.positionGroup,
    statSource: "actual",
    context: {
      season: row.season,
      week: row.week,
      playerId: row.player_id
    }
  });
  const blackbirdWithWarnings = mergeContextWarnings(blackbird, position.warnings);

  return buildStoredRowScoringResult({
    league,
    player,
    source: {
      table: "player_weekly_stats",
      rowId: row.id,
      provider: row.provider,
      providerExternalId: row.provider_external_id,
      season: row.season,
      week: row.week,
      projectionType: null,
      sourceUpdatedAt: row.source_updated_at,
      ingestedAt: row.ingested_at
    },
    blackbird: blackbirdWithWarnings,
    providerComparison: compareProviderPoints({
      providerPoints: row.provider_fantasy_points,
      blackbird: blackbirdWithWarnings
    }),
    aggregateCompatibility: null,
    contextWarnings: position.warnings
  });
}

function mergeContextWarnings(
  result: import("@/lib/scoring/types").FantasyScoringResult,
  warnings: ScoringWarning[]
) {
  if (warnings.length === 0) return result;
  return {
    ...result,
    warnings: [...result.warnings, ...warnings]
  };
}
