import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { aggregateLeagueDraftData } from "@/lib/draft-data/aggregate";
import type {
  DraftDataDerivedWeeklyRow,
  DraftDataLeague,
  DraftDataPlayer,
  DraftDataWeeklyRow,
  PbpDerivedBatchStatus,
} from "@/lib/draft-data/types";
import { buildHistoricalLeagueValues } from "@/lib/adp/value";
import type { HistoricalLeagueValue } from "@/lib/adp/types";

// --------------------------------------------------------------------------
// Result type
// --------------------------------------------------------------------------

export type H6ProfilesForBoard = {
  hlv: HistoricalLeagueValue[];
  // Diagnostic stats
  weeklyRowCount: number;
  derivedRowCount: number;
  pbpDerivedBatchStatus: PbpDerivedBatchStatus;
  profileCount: number;
  positionBreakdown: Record<string, number>;
};

// --------------------------------------------------------------------------
// Main computation
// --------------------------------------------------------------------------

// Loads 2025 weekly stats from the DB and computes H6 historical profiles
// under the target league's 2026 scoring configuration.
//
// Key design facts:
//   - performanceSeason: the year of actual stats (e.g. 2025)
//   - leagueConfigSeason: the scoring rules year applied (e.g. 2026)
//   - season_type stored as 'regular' in player_weekly_stats (not 'REG')
//   - This is deterministic recomputation, not a projection
//
export async function computeH6ProfilesForBoard(opts: {
  supabase: SupabaseClient;
  league: DraftDataLeague;
  performanceSeason: number;
  leagueConfigSeason: number;
}): Promise<H6ProfilesForBoard> {
  const { supabase, league, performanceSeason, leagueConfigSeason } = opts;

  // Load weekly stats — season_type is stored as 'regular', not 'REG'
  const weeklyRows = await loadAllPages<DraftDataWeeklyRow>((from, to) =>
    supabase
      .from("player_weekly_stats")
      .select("player_id,season,week,season_type,game_id,team,opponent,position_group,stats_json")
      .eq("season", performanceSeason)
      .eq("season_type", "regular")
      .range(from, to)
  );

  // Load PBP derived stats for the same season
  const derivedRows = await loadAllPages<DraftDataDerivedWeeklyRow>((from, to) =>
    supabase
      .from("player_weekly_derived_stats")
      .select("player_id,season,week,season_type,stat_scope,stats_json,completeness")
      .eq("season", performanceSeason)
      .range(from, to)
  );

  const pbpDerivedBatchStatus: PbpDerivedBatchStatus =
    derivedRows.length === 0 ? "not_run"
    : derivedRows.some((r) => r.completeness === "partial") ? "partial"
    : "complete";

  // Load canonical player records for all player IDs in the weekly stats
  const playerIds = [...new Set(weeklyRows.map((r) => r.player_id))];
  const players = await loadPlayersById(supabase, playerIds);

  // Aggregate H6 profiles — deterministic recomputation, not persisted
  // leagueConfigSeason is passed explicitly (may differ from league.season)
  const result = aggregateLeagueDraftData({
    league,
    performanceSeason,
    leagueConfigSeason,
    weeklyRows,
    players,
    derivedRows,
    pbpDerivedBatchStatus,
    analysisMode: "historical_under_current_format",
    generatedAt: new Date().toISOString(),
  });

  const hlv = buildHistoricalLeagueValues(result.profiles, performanceSeason, league.id);

  const positionBreakdown: Record<string, number> = {};
  for (const h of hlv) {
    const pos = h.position ?? "??";
    positionBreakdown[pos] = (positionBreakdown[pos] ?? 0) + 1;
  }

  return {
    hlv,
    weeklyRowCount: weeklyRows.length,
    derivedRowCount: derivedRows.length,
    pbpDerivedBatchStatus,
    profileCount: result.profiles.length,
    positionBreakdown,
  };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`DB query failed: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function loadPlayersById(supabase: SupabaseClient, ids: string[]): Promise<DraftDataPlayer[]> {
  if (ids.length === 0) return [];
  const players: DraftDataPlayer[] = [];
  const pageSize = 500;
  for (let i = 0; i < ids.length; i += pageSize) {
    const batch = ids.slice(i, i + pageSize);
    const { data, error } = await supabase
      .from("players")
      .select("id,full_name,position,team,primary_position,position_group,raw_position")
      .in("id", batch);
    if (error) throw new Error(`Failed to load players: ${error.message}`);
    players.push(...((data ?? []) as DraftDataPlayer[]));
  }
  return players;
}
