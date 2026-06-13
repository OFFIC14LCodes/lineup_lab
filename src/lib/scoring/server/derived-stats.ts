import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type DerivedStatsRow = {
  player_id: string;
  week: number;
  stats_json: Record<string, number>;
};

// Key format used for Map lookups: "playerId|week"
export function derivedStatsKey(playerId: string, week: number): string {
  return `${playerId}|${week}`;
}

// Batch-fetch derived stats for the given player/season/week combinations.
// Returns a Map keyed by derivedStatsKey(playerId, week) → merged stats object.
// Only returns rows from the nflverse PBP derivation scope.
export async function loadDerivedStatsForRows(
  rows: { player_id: string; season: number; week: number }[],
  supabase: SupabaseClient
): Promise<Map<string, Record<string, number>>> {
  if (rows.length === 0) return new Map();

  // Collect unique seasons to build efficient queries.
  const bySeason = new Map<number, { playerIds: Set<string>; weeks: Set<number> }>();
  for (const row of rows) {
    if (!bySeason.has(row.season)) {
      bySeason.set(row.season, { playerIds: new Set(), weeks: new Set() });
    }
    bySeason.get(row.season)!.playerIds.add(row.player_id);
    bySeason.get(row.season)!.weeks.add(row.week);
  }

  const result = new Map<string, Record<string, number>>();

  for (const [season, { playerIds, weeks }] of bySeason) {
    const { data, error } = await supabase
      .from("player_weekly_derived_stats")
      .select("player_id,week,stats_json")
      .eq("season", season)
      .eq("season_type", "regular")
      .eq("stat_scope", "nflverse_pbp_derived")
      .in("player_id", [...playerIds])
      .in("week", [...weeks]);

    if (error) {
      // Non-fatal: derived stats are additive — log and return empty for this season.
      console.warn(`[derived-stats] Failed to load derived stats for season ${season}: ${error.message}`);
      continue;
    }

    for (const row of data ?? []) {
      const key = derivedStatsKey(row.player_id as string, row.week as number);
      result.set(key, (row.stats_json ?? {}) as Record<string, number>);
    }
  }

  return result;
}

// Merge derived stats on top of base stats_json.
// Derived keys (rec_td_40p etc.) do not overlap with base keys — no base-stat duplication.
export function mergeWithDerivedStats(
  baseStats: Record<string, unknown>,
  derivedStats: Record<string, number> | undefined
): Record<string, unknown> {
  if (!derivedStats || Object.keys(derivedStats).length === 0) return baseStats;
  return { ...baseStats, ...derivedStats };
}
