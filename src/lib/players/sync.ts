import {
  buildPlayerSearchName,
  classifySideOfBall,
  displayPlayerName,
  normalizeEligiblePositions,
  normalizePrimaryPosition,
  normalizePosition,
  normalizePositionGroup,
  normalizeTeam
} from "@/lib/players/normalize";
import { getAllPlayers } from "@/lib/sleeper/client";
import type { SleeperPlayer } from "@/lib/sleeper/types";
import { createAdminClient } from "@/lib/supabase/admin";

type PlayerSyncCounts = {
  total: number;
  upserted: number;
  skipped: number;
  errors: number;
  lastSyncedAt: string;
};

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"]);

export async function syncSleeperPlayers() {
  const supabase = createAdminClient();
  const playersById = await getAllPlayers("nfl");
  const now = new Date().toISOString();
  const counts: PlayerSyncCounts = {
    total: Object.keys(playersById).length,
    upserted: 0,
    skipped: 0,
    errors: 0,
    lastSyncedAt: now
  };

  const rows = Object.entries(playersById)
    .map(([sleeperPlayerId, player]) => toPlayerRow(sleeperPlayerId, player, now))
    .filter((row): row is NonNullable<typeof row> => {
      if (!row) counts.skipped += 1;
      return Boolean(row);
    });

  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500);
    const { error } = await supabase.from("players").upsert(batch, { onConflict: "sleeper_player_id" });
    if (error) {
      counts.errors += batch.length;
    } else {
      counts.upserted += batch.length;
    }
  }

  return counts;
}

function toPlayerRow(sleeperPlayerId: string, player: SleeperPlayer, updatedAt: string) {
  try {
    const fullName = displayPlayerName(player);
    const normalizedName = buildPlayerSearchName(player);
    const rawPosition = player.position?.trim().toUpperCase() || null;
    const primaryPosition = normalizePrimaryPosition(player.position);
    const positionGroup = normalizePositionGroup(player.position);
    const position = normalizePosition(player.position);
    const team = normalizeTeam(player.team);
    const fantasyPositions = normalizeEligiblePositions([
      ...(Array.isArray(player.fantasy_positions) ? player.fantasy_positions : []),
      primaryPosition
    ]);
    const sideOfBall = classifySideOfBall(player.position);

    if (!sleeperPlayerId || !normalizedName) return null;

    const active =
      player.status !== "Inactive" &&
      (fantasyPositions.some((pos) => FANTASY_POSITIONS.has(pos)) || (positionGroup ? FANTASY_POSITIONS.has(positionGroup) : false));

    return {
      sleeper_player_id: sleeperPlayerId,
      full_name: fullName || null,
      first_name: player.first_name ?? null,
      last_name: player.last_name ?? null,
      raw_position: rawPosition,
      primary_position: primaryPosition,
      position_group: positionGroup,
      position,
      fantasy_positions_json: fantasyPositions,
      eligible_positions_json: fantasyPositions,
      side_of_ball: sideOfBall,
      team,
      age: typeof player.age === "number" ? player.age : null,
      years_exp: typeof player.years_exp === "number" ? player.years_exp : null,
      status: player.status ?? null,
      active,
      search_name: normalizedName,
      normalized_name: normalizedName,
      metadata_json: player,
      updated_at: updatedAt
    };
  } catch {
    return null;
  }
}
