import type { NflversePbpRaw } from "@/lib/providers/nflverse/pbp/schema";
import { parsePbpFlag, parsePbpNumeric, parsePbpString } from "@/lib/providers/nflverse/pbp/schema";

// Offensive play types that contribute to net offensive yards.
// Excludes kickoffs, punts, field goals, extra points, no_play, and 2PT attempts.
const OFFENSIVE_PLAY_TYPES = new Set(["pass", "run", "qb_spike", "qb_kneel"]);

// Accumulates offensive yards per (game_id, posteam) across all plays in the PBP.
// Returns a map keyed by `${gameId}|${teamId}` → net offensive yards.
export function accumulateTeamYards(plays: NflversePbpRaw[]): Map<string, number> {
  const acc = new Map<string, number>();

  for (const play of plays) {
    const gameId = parsePbpString(play["game_id"]);
    const posteam = parsePbpString(play["posteam"]);
    const playType = parsePbpString(play["play_type"]);

    if (!gameId || !posteam || !playType) continue;
    if (!OFFENSIVE_PLAY_TYPES.has(playType)) continue;

    // Exclude 2PT conversion attempts — not counted in standard offensive yardage.
    if (parsePbpFlag(play["two_point_attempt"])) continue;

    // Exclude deleted plays.
    if (parsePbpFlag(play["play_deleted"])) continue;

    // Exclude defensive 2PT attempts.
    if (parsePbpFlag(play["defensive_two_point_attempt"])) continue;

    const yards = parsePbpNumeric(play["yards_gained"]) ?? 0;
    const key = `${gameId}|${posteam}`;
    acc.set(key, (acc.get(key) ?? 0) + yards);
  }

  return acc;
}

// Look up the net offensive yards for a specific team in a specific game.
// Returns null if the game/team pair has no PBP data (game not yet played or missing).
export function getTeamOffensiveYards(
  acc: Map<string, number>,
  gameId: string,
  teamId: string
): number | null {
  const key = `${gameId}|${teamId}`;
  return acc.has(key) ? (acc.get(key) ?? 0) : null;
}

// Verify PBP yard accumulation invariants for a completed game.
// Returns a list of violation strings (empty = clean).
export function verifyYardInvariants(
  acc: Map<string, number>,
  gameId: string,
  homeTeamId: string,
  awayTeamId: string
): string[] {
  const violations: string[] = [];

  const homeYards = getTeamOffensiveYards(acc, gameId, homeTeamId);
  const awayYards = getTeamOffensiveYards(acc, gameId, awayTeamId);

  if (homeYards === null) {
    violations.push(`Missing PBP yards for home team ${homeTeamId} in game ${gameId}`);
  }
  if (awayYards === null) {
    violations.push(`Missing PBP yards for away team ${awayTeamId} in game ${gameId}`);
  }
  if (homeYards !== null && homeYards < -200) {
    violations.push(`Implausibly low offensive yards for ${homeTeamId} in ${gameId}: ${homeYards}`);
  }
  if (awayYards !== null && awayYards < -200) {
    violations.push(`Implausibly low offensive yards for ${awayTeamId} in ${gameId}: ${awayYards}`);
  }

  return violations;
}
