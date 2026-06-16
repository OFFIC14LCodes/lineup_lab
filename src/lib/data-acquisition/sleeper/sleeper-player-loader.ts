import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SleeperRawPlayer } from "./sleeper-player-types";

export const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
export const SLEEPER_RAW_DIR = path.join(process.cwd(), "data", "sleeper", "raw");
export const SLEEPER_PLAYERS_PATH = path.join(SLEEPER_RAW_DIR, "players-nfl.json");

export type SleeperPlayersLoadResult = {
  filePath: string;
  exists: boolean;
  players: SleeperRawPlayer[];
  rawCount: number;
};

export async function exportSleeperPlayers(filePath = SLEEPER_PLAYERS_PATH): Promise<{ filePath: string; playerCount: number; exportedAt: string }> {
  const response = await fetch(SLEEPER_PLAYERS_URL, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Sleeper players export failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json() as Record<string, SleeperRawPlayer>;
  const exportedAt = new Date().toISOString();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { filePath, playerCount: Object.keys(payload).length, exportedAt };
}

export function loadSleeperPlayers(filePath = SLEEPER_PLAYERS_PATH): SleeperPlayersLoadResult {
  if (!existsSync(filePath)) {
    return { filePath, exists: false, players: [], rawCount: 0 };
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, SleeperRawPlayer>;
  const players = Object.entries(parsed).map(([playerId, player]) => ({
    ...player,
    player_id: player.player_id ?? playerId,
  }));
  return { filePath, exists: true, players, rawCount: players.length };
}
