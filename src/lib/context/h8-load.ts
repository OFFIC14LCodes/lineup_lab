// H8: Pure (non-DB) helpers for loading and validating historical player context data.
// All functions here are testable without a database connection.
// DB-specific query logic lives in the dry-run script.

import path from "node:path";
import { mkdirSync } from "node:fs";

import { REGULAR_SEASON_PLAYER, SKILL_POSITIONS, isSkillPosition } from "./season-type";
import type { SkillPosition } from "./season-type";

// --------------------------------------------------------------------------
// Row types (match DB schema column selection)
// --------------------------------------------------------------------------

/** A row from player_weekly_stats selected for H8 population and team aggregation */
export type HistoricalWeeklyRow = {
  player_id: string;
  season: number;
  week: number;
  season_type: string;
  team: string | null;
  position_group: string | null;
  stats_json: Record<string, number>;
};

/** A row from team_game_stats selected for team-season context */
export type TeamGameRow = {
  team_id: string;
  season: number;
  points_scored: number | null;
  points_allowed: number | null;
  offensive_yards: number | null;
  yards_allowed: number | null;
};

// --------------------------------------------------------------------------
// Season model
// --------------------------------------------------------------------------

/** Explicit terminology: we derive from historical performance, target context season */
export type H8SeasonModel = {
  historicalPerformanceSeason: number;  // Season whose stats are used to derive context
  contextTargetSeason: number;          // Season the context will be used for
  asOfDate: string;                     // ISO date: when context was derived
};

export function buildSeasonModel(
  historicalSeason: number,
  contextSeason: number,
  asOfDate: string = new Date().toISOString().slice(0, 10)
): H8SeasonModel {
  return { historicalPerformanceSeason: historicalSeason, contextTargetSeason: contextSeason, asOfDate };
}

// --------------------------------------------------------------------------
// Eligible player selection
// --------------------------------------------------------------------------

export type EligiblePlayer = {
  playerId: string;
  position: string;
  primaryTeam: string | null;       // Team with most appearances in the season
  teamsPlayedFor: string[];         // All distinct teams in order of first appearance
  games: number;                    // Distinct weeks with a row
  totalTargets: number;             // Sum of rec_tgt from stats_json
  totalCarries: number;             // Sum of rush_att from stats_json
};

/**
 * Derive the eligible player population from weekly stats rows.
 * Only players with at least one row in the historical season are included.
 * Retired players with no rows in the season are automatically excluded.
 */
export function selectEligiblePlayers(
  weeklyRows: HistoricalWeeklyRow[],
  opts: {
    season: number;
    position?: string | null;
    limit?: number;
    playerId?: string | null;
  }
): EligiblePlayer[] {
  const regularRows = weeklyRows.filter(
    (r) => r.season === opts.season && r.season_type === REGULAR_SEASON_PLAYER
  );

  // Group by player
  const byPlayer = new Map<string, HistoricalWeeklyRow[]>();
  for (const row of regularRows) {
    if (opts.playerId && row.player_id !== opts.playerId) continue;
    const pos = row.position_group?.toUpperCase();
    if (opts.position && pos !== opts.position.toUpperCase()) continue;
    if (!isSkillPosition(pos)) continue;
    if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, []);
    byPlayer.get(row.player_id)!.push(row);
  }

  const eligible: EligiblePlayer[] = [];
  for (const [playerId, rows] of byPlayer) {
    const position = rows[0]?.position_group?.toUpperCase() ?? "??";
    const weeks = new Set(rows.map((r) => r.week));

    // Resolve historical team: track in order of first appearance
    const teamFirstSeen = new Map<string, number>();
    const teamGameCount = new Map<string, number>();
    for (const row of rows) {
      const t = row.team;
      if (!t) continue;
      if (!teamFirstSeen.has(t)) teamFirstSeen.set(t, row.week);
      teamGameCount.set(t, (teamGameCount.get(t) ?? 0) + 1);
    }

    const teamsPlayedFor = [...teamFirstSeen.keys()].sort(
      (a, b) => teamFirstSeen.get(a)! - teamFirstSeen.get(b)!
    );

    // Primary team = most appearances; ties broken by first appearance
    let primaryTeam: string | null = null;
    let maxGames = 0;
    for (const [team, count] of teamGameCount) {
      if (count > maxGames || (count === maxGames && (teamFirstSeen.get(team) ?? 999) < (teamFirstSeen.get(primaryTeam ?? "") ?? 999))) {
        primaryTeam = team;
        maxGames = count;
      }
    }

    const totalTargets = rows.reduce((s, r) => s + (r.stats_json["rec_tgt"] ?? 0), 0);
    const totalCarries = rows.reduce((s, r) => s + (r.stats_json["rush_att"] ?? 0), 0);

    eligible.push({
      playerId,
      position,
      primaryTeam,
      teamsPlayedFor,
      games: weeks.size,
      totalTargets,
      totalCarries,
    });
  }

  // Sort: position order (QB→RB→WR→TE), then within position:
  //   1. games played desc  2. opportunity (targets+carries) desc  3. playerId asc
  eligible.sort((a, b) => {
    const posOrder = SKILL_POSITIONS.indexOf(a.position as SkillPosition) - SKILL_POSITIONS.indexOf(b.position as SkillPosition);
    if (posOrder !== 0) return posOrder;
    if (b.games !== a.games) return b.games - a.games;
    const oppA = a.totalTargets + a.totalCarries;
    const oppB = b.totalTargets + b.totalCarries;
    if (oppB !== oppA) return oppB - oppA;
    return a.playerId.localeCompare(b.playerId);
  });

  return opts.limit ? eligible.slice(0, opts.limit) : eligible;
}

// --------------------------------------------------------------------------
// Team season aggregation from player weekly stats
// --------------------------------------------------------------------------

export type TeamSeasonAggregates = {
  teamId: string;
  season: number;
  totalTargets: number;
  totalCarries: number;
  gamesPlayed: number;           // From team_game_stats
  pointsScored: number;          // From team_game_stats
  pointsAllowed: number;         // From team_game_stats
  offensiveYards: number;        // From team_game_stats
  yardsAllowed: number;          // From team_game_stats
  topTargetShare: number | null; // max(playerTargets) / totalTargets
};

/**
 * Aggregate per-team target and carry totals from all players' weekly rows.
 * Used to compute target share (player / team total).
 */
export function buildTeamWeeklyAggregates(
  allWeeklyRows: HistoricalWeeklyRow[],
  season: number
): Map<string, { totalTargets: number; totalCarries: number; playerTargets: Map<string, number> }> {
  const byTeam = new Map<string, { totalTargets: number; totalCarries: number; playerTargets: Map<string, number> }>();

  for (const row of allWeeklyRows) {
    if (row.season !== season || row.season_type !== REGULAR_SEASON_PLAYER) continue;
    if (!row.team) continue;

    if (!byTeam.has(row.team)) {
      byTeam.set(row.team, { totalTargets: 0, totalCarries: 0, playerTargets: new Map() });
    }
    const agg = byTeam.get(row.team)!;
    const tgt = row.stats_json["rec_tgt"] ?? 0;
    const att = row.stats_json["rush_att"] ?? 0;
    agg.totalTargets += tgt;
    agg.totalCarries += att;
    agg.playerTargets.set(
      row.player_id,
      (agg.playerTargets.get(row.player_id) ?? 0) + tgt
    );
  }

  return byTeam;
}

/**
 * Merge per-team weekly aggregates with team_game_stats game rows to produce
 * a full TeamSeasonAggregates. Game rows may be empty (non-fatal warning).
 */
export function mergeTeamSeasonContext(
  teamWeeklyAgg: Map<string, { totalTargets: number; totalCarries: number; playerTargets: Map<string, number> }>,
  gameRows: TeamGameRow[],
  season: number
): Map<string, TeamSeasonAggregates> {
  const gamesByTeam = new Map<string, TeamGameRow[]>();
  for (const row of gameRows) {
    if (!gamesByTeam.has(row.team_id)) gamesByTeam.set(row.team_id, []);
    gamesByTeam.get(row.team_id)!.push(row);
  }

  const result = new Map<string, TeamSeasonAggregates>();
  const allTeams = new Set([...teamWeeklyAgg.keys(), ...gamesByTeam.keys()]);

  for (const teamId of allTeams) {
    const weekly = teamWeeklyAgg.get(teamId);
    const games = gamesByTeam.get(teamId) ?? [];
    const totalTargets = weekly?.totalTargets ?? 0;
    const totalCarries = weekly?.totalCarries ?? 0;

    let topTargetShare: number | null = null;
    if (totalTargets > 0 && weekly) {
      const maxPlayerTargets = Math.max(...weekly.playerTargets.values());
      topTargetShare = Math.round((maxPlayerTargets / totalTargets) * 1000) / 1000;
    }

    const pointsScored = games.reduce((s, g) => s + (g.points_scored ?? 0), 0);
    const pointsAllowed = games.reduce((s, g) => s + (g.points_allowed ?? 0), 0);
    const offensiveYards = games.reduce((s, g) => s + (g.offensive_yards ?? 0), 0);
    const yardsAllowed = games.reduce((s, g) => s + (g.yards_allowed ?? 0), 0);

    result.set(teamId, {
      teamId,
      season,
      totalTargets,
      totalCarries,
      gamesPlayed: games.length,
      pointsScored,
      pointsAllowed,
      offensiveYards,
      yardsAllowed,
      topTargetShare,
    });
  }

  return result;
}

// --------------------------------------------------------------------------
// Player team resolution
// --------------------------------------------------------------------------

export type PlayerTeamResolution = {
  playerId: string;
  primaryTeam: string | null;
  teamsPlayedFor: string[];
  multiTeamSeason: boolean;
};

export function resolvePlayerHistoricalTeam(
  weeklyRows: HistoricalWeeklyRow[],
  playerId: string,
  season: number
): PlayerTeamResolution {
  const playerRows = weeklyRows.filter(
    (r) => r.player_id === playerId && r.season === season && r.season_type === REGULAR_SEASON_PLAYER
  );

  const teamFirstSeen = new Map<string, number>();
  const teamGames = new Map<string, number>();
  for (const row of playerRows) {
    if (!row.team) continue;
    if (!teamFirstSeen.has(row.team)) teamFirstSeen.set(row.team, row.week);
    teamGames.set(row.team, (teamGames.get(row.team) ?? 0) + 1);
  }

  const teamsPlayedFor = [...teamFirstSeen.keys()].sort(
    (a, b) => teamFirstSeen.get(a)! - teamFirstSeen.get(b)!
  );

  let primaryTeam: string | null = null;
  let maxGames = 0;
  for (const [team, count] of teamGames) {
    if (count > maxGames) {
      primaryTeam = team;
      maxGames = count;
    }
  }

  return {
    playerId,
    primaryTeam,
    teamsPlayedFor,
    multiTeamSeason: teamsPlayedFor.length > 1,
  };
}

// --------------------------------------------------------------------------
// Fail-fast validation
// --------------------------------------------------------------------------

export type HistoricalLoadResult =
  | { ok: true; eligibleCount: number; selectedCount: number; weeklyRowCount: number }
  | { ok: false; reason: string; exitCode: number };

export function validateHistoricalLoad(
  eligiblePlayerIds: string[],
  selectedPlayerIds: string[],
  weeklyRowCount: number
): HistoricalLoadResult {
  if (eligiblePlayerIds.length === 0) {
    return {
      ok: false,
      reason: "No eligible players found with historical weekly stats for the requested season and position. Verify season_type='regular' and that H1 ingest has run.",
      exitCode: 2,
    };
  }
  if (selectedPlayerIds.length === 0) {
    return {
      ok: false,
      reason: "Player population selection produced zero players. Check position filter and limit args.",
      exitCode: 3,
    };
  }
  if (weeklyRowCount === 0) {
    return {
      ok: false,
      reason: "Zero weekly rows loaded for the selected player population. Verify player_id join and season_type filter.",
      exitCode: 4,
    };
  }
  return { ok: true, eligibleCount: eligiblePlayerIds.length, selectedCount: selectedPlayerIds.length, weeklyRowCount };
}

// --------------------------------------------------------------------------
// Artifact path helper
// --------------------------------------------------------------------------

export function buildArtifactPath(historicalSeason: number, contextSeason: number, projectRoot: string): string {
  return path.join(projectRoot, "artifacts", "player-context", `h8-context-${historicalSeason}-to-${contextSeason}-dry-run.json`);
}

export function ensureArtifactDir(artifactPath: string): void {
  mkdirSync(path.dirname(artifactPath), { recursive: true });
}

// --------------------------------------------------------------------------
// Stratified cross-position sampling
// --------------------------------------------------------------------------

/**
 * Select up to `limit` players from the eligible population with proportional
 * representation across all four skill positions.
 *
 * Algorithm: Hamilton's method (largest remainder). Each position receives
 * floor(eligible_pos / total * limit) players, with remaining slots going to
 * positions with the largest fractional remainders. Positions with zero
 * eligible players are skipped.
 *
 * Within each position, players are taken in the order returned by
 * selectEligiblePlayers: games desc, opportunity desc, playerId asc.
 *
 * Returns the full eligible slice when eligible.length <= limit.
 */
export function stratifiedSample(
  eligible: EligiblePlayer[],
  limit: number
): EligiblePlayer[] {
  if (eligible.length <= limit) return eligible;

  // Group by position; players are already sorted within position
  const byPosition = new Map<string, EligiblePlayer[]>();
  for (const pos of SKILL_POSITIONS) byPosition.set(pos, []);
  for (const p of eligible) {
    byPosition.get(p.position)?.push(p);
  }

  const nonEmpty = SKILL_POSITIONS.filter((pos) => (byPosition.get(pos)?.length ?? 0) > 0);
  const total = eligible.length;

  // Proportional float allocations
  type Slot = { pos: string; available: number; n: number; frac: number };
  const alloc: Slot[] = nonEmpty.map((pos) => {
    const available = byPosition.get(pos)!.length;
    const float = (available / total) * limit;
    return { pos, available, n: Math.floor(float), frac: float % 1 };
  });

  // Distribute remainder slots to positions with largest fractional parts;
  // tie-break by position name (deterministic)
  const remainder = limit - alloc.reduce((s, a) => s + a.n, 0);
  const byFrac = [...alloc].sort((a, b) => b.frac - a.frac || a.pos.localeCompare(b.pos));
  for (let i = 0; i < remainder && i < byFrac.length; i++) {
    byFrac[i]!.n++;
  }

  // Cap each position at available count
  for (const a of alloc) {
    a.n = Math.min(a.n, a.available);
  }

  // Build result in SKILL_POSITIONS order
  const result: EligiblePlayer[] = [];
  for (const pos of SKILL_POSITIONS) {
    const a = alloc.find((x) => x.pos === pos);
    if (!a || a.n === 0) continue;
    result.push(...(byPosition.get(pos) ?? []).slice(0, a.n));
  }

  return result;
}

// --------------------------------------------------------------------------
// Execute mode safety validation
// --------------------------------------------------------------------------

export type ExecuteValidationResult =
  | { ok: true; planSummary: string }
  | { ok: false; reason: string; exitCode: number };

/**
 * Guard against accidentally executing on a partial player population.
 *
 * Execute is only permitted when one of the following is explicitly set:
 *   --all                   → full eligible population
 *   --position=<pos>        → intentional single-position execution
 *   --allow-partial-execute → explicit acknowledgment of partial scope
 *
 * Otherwise exit code 5 is returned and the caller must abort.
 */
export function validateExecuteMode(opts: {
  execute: boolean;
  all: boolean;
  position: string | null;
  allowPartialExecute: boolean;
  selectedCount: number;
  eligibleCount: number;
}): ExecuteValidationResult {
  if (!opts.execute) {
    return { ok: true, planSummary: "dry_run — no DB writes" };
  }

  if (!opts.all && !opts.position && !opts.allowPartialExecute) {
    return {
      ok: false,
      reason: [
        "Execute mode refuses to write a partial population without explicit acknowledgment.",
        "Use one of:",
        "  --all                    (persist all eligible players)",
        "  --position=QB|RB|WR|TE   (persist one position intentionally)",
        "  --allow-partial-execute  (acknowledge partial persistence explicitly)",
      ].join("\n"),
      exitCode: 5,
    };
  }

  const scope = opts.all
    ? "full population"
    : opts.position
      ? `position=${opts.position} only`
      : "partial (--allow-partial-execute acknowledged)";

  return {
    ok: true,
    planSummary: `execute: ${opts.selectedCount}/${opts.eligibleCount} players (${scope})`,
  };
}
