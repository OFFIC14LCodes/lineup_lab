import { readNflverseCsv, type NflverseFileKey } from "./nflverse-csv-loader";
import {
  defensiveStatColumns,
  hasPositiveStat,
  isFantasyRelevantNflversePosition,
  normalizeNflversePlayer,
  normalizeNflverseRoster,
  normalizeNflverseWeeklyStat,
  offensiveStatColumns,
  kickingStatColumns,
  type BlackbirdNflversePosition,
} from "./nflverse-normalizer";
import { validateAllNflverseFiles, type NflverseFileValidationResult } from "./nflverse-validation";

export type NflverseDiagnosticsReport = {
  generatedAt: string;
  dataDir: string | null;
  files: Record<NflverseFileKey, NflverseFileValidationResult>;
  rowCounts: Record<NflverseFileKey, number>;
  fantasyRelevantPlayers: number;
  positionCounts: Partial<Record<BlackbirdNflversePosition, number>>;
  identityCoverage: {
    playersWithGsisId: number;
    playersWithEspnId: number;
    playersWithPfrId: number;
    playersWithNflId: number;
    playersWithSmartId: number;
  };
  weeklyStatRows2025: number;
  rosterRows2025: number;
  statColumnCoverage: {
    offensiveColumnsPresent: string[];
    offensiveColumnsMissing: string[];
    defensiveColumnsPresent: string[];
    defensiveColumnsMissing: string[];
    kickingColumnsPresent: string[];
    kickingColumnsMissing: string[];
    idpRowsWithPositiveDefensiveStats: number;
    offensiveRowsWithPositiveOffensiveStats: number;
    kickerRowsWithPositiveKickingStats: number;
  };
  limitations: string[];
  verdict: "passed" | "needs_source_data" | "failed";
};

export function buildNflverseDiagnostics(dataDir?: string): NflverseDiagnosticsReport {
  const files = validateAllNflverseFiles(dataDir);
  const playersCsv = readNflverseCsv("players", dataDir);
  const rostersCsv = readNflverseCsv("rosters", dataDir);
  const playerStatsCsv = readNflverseCsv("playerStats", dataDir);

  const players = playersCsv.rows.map(normalizeNflversePlayer);
  const fantasyRelevantPlayers = players.filter((player) => isFantasyRelevantNflversePosition(player.position)).length;
  const positionCounts = countBy(
    players
      .map((player) => player.position)
      .filter(isFantasyRelevantNflversePosition),
  );

  const weeklyStats = playerStatsCsv.rows.map(normalizeNflverseWeeklyStat);
  const rosterRows2025 = rostersCsv.rows.map(normalizeNflverseRoster).filter((row) => row.season === 2025).length;
  const weeklyStatRows2025 = weeklyStats.filter((row) => row.season === 2025).length;

  const fieldSet = new Set(playerStatsCsv.fields);
  const offensiveColumnsPresent = offensiveStatColumns().filter((column) => fieldSet.has(column));
  const defensiveColumnsPresent = defensiveStatColumns().filter((column) => fieldSet.has(column));
  const kickingColumnsPresent = kickingStatColumns().filter((column) => fieldSet.has(column));

  const statColumnCoverage = {
    offensiveColumnsPresent,
    offensiveColumnsMissing: offensiveStatColumns().filter((column) => !fieldSet.has(column)),
    defensiveColumnsPresent,
    defensiveColumnsMissing: defensiveStatColumns().filter((column) => !fieldSet.has(column)),
    kickingColumnsPresent,
    kickingColumnsMissing: kickingStatColumns().filter((column) => !fieldSet.has(column)),
    idpRowsWithPositiveDefensiveStats: weeklyStats.filter((row) => ["DL", "LB", "DB"].includes(row.position ?? "") && hasPositiveStat(row.defensiveStats)).length,
    offensiveRowsWithPositiveOffensiveStats: weeklyStats.filter((row) => ["QB", "RB", "WR", "TE"].includes(row.position ?? "") && hasPositiveStat(row.offensiveStats)).length,
    kickerRowsWithPositiveKickingStats: weeklyStats.filter((row) => row.position === "K" && hasPositiveStat(row.kickingStats)).length,
  };

  const missingFileOrColumn = Object.values(files).some((file) => !file.exists || file.missingColumns.length > 0 || file.parseErrors.length > 0);
  const missingStatDetail = statColumnCoverage.defensiveColumnsPresent.length === 0 || statColumnCoverage.idpRowsWithPositiveDefensiveStats === 0;
  const limitations = buildLimitations(files, statColumnCoverage);

  return {
    generatedAt: new Date().toISOString(),
    dataDir: dataDir ?? null,
    files,
    rowCounts: {
      players: files.players.rowCount,
      rosters: files.rosters.rowCount,
      playerStats: files.playerStats.rowCount,
      schedules: files.schedules.rowCount,
    },
    fantasyRelevantPlayers,
    positionCounts,
    identityCoverage: {
      playersWithGsisId: players.filter((player) => Boolean(player.ids.gsisId)).length,
      playersWithEspnId: players.filter((player) => Boolean(player.ids.espnId)).length,
      playersWithPfrId: players.filter((player) => Boolean(player.ids.pfrId)).length,
      playersWithNflId: players.filter((player) => Boolean(player.ids.nflId)).length,
      playersWithSmartId: players.filter((player) => Boolean(player.ids.smartId)).length,
    },
    weeklyStatRows2025,
    rosterRows2025,
    statColumnCoverage,
    limitations,
    verdict: missingFileOrColumn ? "failed" : missingStatDetail ? "needs_source_data" : "passed",
  };
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function buildLimitations(
  files: Record<NflverseFileKey, NflverseFileValidationResult>,
  statColumnCoverage: NflverseDiagnosticsReport["statColumnCoverage"],
): string[] {
  const limitations: string[] = [];
  for (const file of Object.values(files)) {
    if (!file.exists) limitations.push(`${file.fileName} is missing.`);
    if (file.missingColumns.length) limitations.push(`${file.fileName} is missing required columns: ${file.missingColumns.join(", ")}.`);
    if (file.parseErrors.length) limitations.push(`${file.fileName} has CSV parse errors: ${file.parseErrors.join("; ")}.`);
  }
  if (statColumnCoverage.defensiveColumnsMissing.length) {
    limitations.push(`Weekly stats export lacks defensive columns: ${statColumnCoverage.defensiveColumnsMissing.join(", ")}.`);
  }
  if (statColumnCoverage.idpRowsWithPositiveDefensiveStats === 0) {
    limitations.push("Weekly stats export contains no positive IDP defensive stat rows; IDP projections must not infer missing detail.");
  }
  limitations.push("No Supabase writes are performed by this diagnostic.");
  limitations.push("Depth chart role, injury status, snap share, and coaching context are not confirmed by these four files.");
  return limitations;
}
