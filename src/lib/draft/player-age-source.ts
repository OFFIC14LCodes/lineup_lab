import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { normalizePlayerName } from "@/lib/players/normalize";

export type PlayerAgeMetadata = {
  age: number | null;
  yearsExperience: number | null;
  fantasyPositions: string[];
};

type SleeperMetadataRow = {
  sleeperId?: string | null;
  playerName?: string | null;
  position?: string | null;
  age?: number | null;
  yearsExperience?: number | null;
  fantasyPositions?: unknown;
};

export type PlayerAgeLookup = {
  bySleeperId: Map<string, PlayerAgeMetadata>;
  byNamePosition: Map<string, PlayerAgeMetadata>;
  rows: number;
  rowsWithAge: number;
};

export function loadPlayerAgeLookup(season: number, rootDir = process.cwd()): PlayerAgeLookup {
  const artifactPath = path.join(rootDir, "artifacts", "projections", "sleeper", `sleeper-player-metadata-${season}.normalized.json`);
  if (!existsSync(artifactPath)) {
    return { bySleeperId: new Map(), byNamePosition: new Map(), rows: 0, rowsWithAge: 0 };
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: SleeperMetadataRow[] };
  const rows = artifact.rows ?? [];
  const bySleeperId = new Map<string, PlayerAgeMetadata>();
  const byNamePosition = new Map<string, PlayerAgeMetadata>();
  for (const row of rows) {
    const metadata = {
      age: finiteNumber(row.age),
      yearsExperience: finiteNumber(row.yearsExperience),
      fantasyPositions: Array.isArray(row.fantasyPositions)
        ? row.fantasyPositions.filter((value): value is string => typeof value === "string")
        : [],
    };
    if (metadata.age === null && metadata.yearsExperience === null) continue;
    if (row.sleeperId) bySleeperId.set(row.sleeperId, metadata);
    if (row.playerName && row.position) byNamePosition.set(ageKey(row.playerName, row.position), metadata);
  }
  return {
    bySleeperId,
    byNamePosition,
    rows: rows.length,
    rowsWithAge: rows.filter((row) => finiteNumber(row.age) !== null).length,
  };
}

export function findPlayerAgeMetadata(
  lookup: PlayerAgeLookup,
  player: { sleeperId?: string | null; sleeper_player_id?: string | null; playerName?: string | null; player_name?: string | null; position?: string | null }
): PlayerAgeMetadata {
  const sleeperId = player.sleeperId ?? player.sleeper_player_id ?? null;
  if (sleeperId && lookup.bySleeperId.has(sleeperId)) return lookup.bySleeperId.get(sleeperId) as PlayerAgeMetadata;
  const playerName = player.playerName ?? player.player_name ?? null;
  if (playerName && player.position) {
    return lookup.byNamePosition.get(ageKey(playerName, player.position)) ?? emptyPlayerAgeMetadata();
  }
  return emptyPlayerAgeMetadata();
}

function emptyPlayerAgeMetadata(): PlayerAgeMetadata {
  return { age: null, yearsExperience: null, fantasyPositions: [] };
}

function ageKey(playerName: string, position: string): string {
  return `${normalizePlayerName(playerName)}|${position.trim().toUpperCase()}`;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
