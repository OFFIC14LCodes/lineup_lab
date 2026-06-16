import { loadSleeperPlayers } from "./sleeper-player-loader";
import { isSleeperFantasyRelevant, normalizeSleeperPlayers } from "./sleeper-player-normalizer";

export type SleeperPlayerDiagnosticsReport = {
  generatedAt: string;
  sourcePath: string;
  sourceExists: boolean;
  rawPlayerCount: number;
  normalizedPlayerCount: number;
  activePlayers: number;
  fantasyRelevantPlayers: number;
  activeFantasyRelevantPlayers: number;
  positionCounts: Record<string, number>;
  externalIdCoverage: Record<string, number>;
  samplePlayers: Array<{
    sleeperId: string;
    playerName: string;
    position: string | null;
    team: string | null;
    active: boolean;
    externalIds: Record<string, string>;
  }>;
  verdict: "passed" | "source_missing" | "empty_source";
};

export function buildSleeperPlayerDiagnostics(filePath?: string): SleeperPlayerDiagnosticsReport {
  const loaded = loadSleeperPlayers(filePath);
  const players = normalizeSleeperPlayers(loaded.players);
  const fantasyRelevant = players.filter(isSleeperFantasyRelevant);
  const activeFantasyRelevant = fantasyRelevant.filter((player) => player.active);

  return {
    generatedAt: new Date().toISOString(),
    sourcePath: loaded.filePath,
    sourceExists: loaded.exists,
    rawPlayerCount: loaded.rawCount,
    normalizedPlayerCount: players.length,
    activePlayers: players.filter((player) => player.active).length,
    fantasyRelevantPlayers: fantasyRelevant.length,
    activeFantasyRelevantPlayers: activeFantasyRelevant.length,
    positionCounts: countBy(fantasyRelevant.map((player) => player.position ?? "unknown")),
    externalIdCoverage: externalIdCoverage(players),
    samplePlayers: activeFantasyRelevant.slice(0, 20).map((player) => ({
      sleeperId: player.sleeperId,
      playerName: player.playerName,
      position: player.position,
      team: player.team,
      active: player.active,
      externalIds: player.externalIds,
    })),
    verdict: !loaded.exists ? "source_missing" : players.length === 0 ? "empty_source" : "passed",
  };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function externalIdCoverage(players: ReturnType<typeof normalizeSleeperPlayers>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const player of players) {
    for (const key of Object.keys(player.externalIds)) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}
