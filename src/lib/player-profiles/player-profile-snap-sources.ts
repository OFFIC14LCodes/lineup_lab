import { existsSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import { readNflverseCsvFile, nflverseNumber, nflverseString } from "@/lib/data-acquisition/nflverse";
import { normalizeNflversePosition, type BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";
import { normalizeTeam } from "@/lib/players/normalize";

export type PlayerProfileSnapCountRow = {
  season: number | null;
  week: number | null;
  pfrId: string;
  playerName: string;
  position: BlackbirdNflversePosition | null;
  team: string | null;
  offenseSnaps: number | null;
  offenseSnapShare: number | null;
  defenseSnaps: number | null;
  defenseSnapShare: number | null;
  specialTeamsSnaps: number | null;
  specialTeamsSnapShare: number | null;
};

export type PlayerProfileParticipationRow = {
  season: number | null;
  week: number | null;
  gsisId: string;
  offensePlays: number;
  defensePlays: number;
};

export type PlayerProfileSourceValidation = {
  exists: boolean;
  filePath: string;
  fields: string[];
  requiredColumns: string[];
  missingColumns: string[];
  rowCount: number;
  seasons: number[];
};

export type PlayerProfileSnapSourceDiagnostics = {
  snapCounts: PlayerProfileSourceValidation & {
    playersWithPfrId: number;
    matchedRows: number;
    unmatchedRows: number;
  };
  participation: PlayerProfileSourceValidation & {
    playersWithGsisId: number;
    matchedRows: number;
    unmatchedRows: number;
  };
};

export type PlayerProfileSnapSources = {
  snapCountsByPfrId: Map<string, PlayerProfileSnapCountRow[]>;
  participationByGsisId: Map<string, PlayerProfileParticipationRow[]>;
  diagnostics: PlayerProfileSnapSourceDiagnostics;
};

const SNAP_COUNT_REQUIRED_COLUMNS = [
  "season",
  "week",
  "player",
  "pfr_player_id",
  "position",
  "team",
  "offense_snaps",
  "offense_pct",
  "defense_snaps",
  "defense_pct",
  "st_snaps",
  "st_pct",
];

const PARTICIPATION_REQUIRED_COLUMNS = [
  "nflverse_game_id",
  "play_id",
  "offense_players",
  "defense_players",
];

export function loadPlayerProfileSnapSources(projectRoot = process.cwd()): PlayerProfileSnapSources {
  const dataDir = path.join(projectRoot, "data", "nflverse");
  const snapFilePath = path.join(dataDir, "snap_counts_2018_2025.csv");
  const participationFilePath = path.join(dataDir, "participation_2018_2025.csv");
  const snap = loadSnapCounts(snapFilePath);
  const participation = loadParticipation(participationFilePath);

  return {
    snapCountsByPfrId: groupRows(snap.rows, (row) => row.pfrId),
    participationByGsisId: groupRows(participation.rows, (row) => row.gsisId),
    diagnostics: {
      snapCounts: {
        ...snap.diagnostics,
        playersWithPfrId: new Set(snap.rows.map((row) => row.pfrId).filter(Boolean)).size,
        matchedRows: 0,
        unmatchedRows: snap.rows.length,
      },
      participation: {
        ...participation.diagnostics,
        playersWithGsisId: new Set(participation.rows.map((row) => row.gsisId).filter(Boolean)).size,
        matchedRows: 0,
        unmatchedRows: participation.rows.length,
      },
    },
  };
}

export function markSnapSourceMatches(
  sources: PlayerProfileSnapSources,
  input: { matchedPfrIds: Set<string>; matchedGsisIds: Set<string> }
): PlayerProfileSnapSourceDiagnostics {
  const snapRows = Array.from(sources.snapCountsByPfrId.values()).flat();
  const participationRows = Array.from(sources.participationByGsisId.values()).flat();
  const snapMatchedRows = snapRows.filter((row) => input.matchedPfrIds.has(row.pfrId)).length;
  const participationMatchedRows = participationRows.filter((row) => input.matchedGsisIds.has(row.gsisId)).length;
  return {
    snapCounts: {
      ...sources.diagnostics.snapCounts,
      matchedRows: snapMatchedRows,
      unmatchedRows: Math.max(0, snapRows.length - snapMatchedRows),
    },
    participation: {
      ...sources.diagnostics.participation,
      matchedRows: participationMatchedRows,
      unmatchedRows: Math.max(0, participationRows.length - participationMatchedRows),
    },
  };
}

function loadSnapCounts(filePath: string): {
  rows: PlayerProfileSnapCountRow[];
  diagnostics: PlayerProfileSourceValidation;
} {
  const source = readNflverseCsvFile(filePath);
  const missing = missingColumns(source.fields, SNAP_COUNT_REQUIRED_COLUMNS);
  if (!source.exists || missing.length) {
    return {
      rows: [],
      diagnostics: sourceDiagnostics({
        exists: source.exists,
        filePath,
        fields: source.fields,
        requiredColumns: SNAP_COUNT_REQUIRED_COLUMNS,
        missingColumns: missing,
        rowCount: source.rows.length,
        seasons: [],
      }),
    };
  }

  const rows = source.rows.map(normalizeSnapCountRow).filter((row): row is PlayerProfileSnapCountRow => Boolean(row));
  return {
    rows,
    diagnostics: sourceDiagnostics({
      exists: source.exists,
      filePath,
      fields: source.fields,
      requiredColumns: SNAP_COUNT_REQUIRED_COLUMNS,
      missingColumns: missing,
      rowCount: source.rows.length,
      seasons: uniqueNumbers(rows.map((row) => row.season)),
    }),
  };
}

function loadParticipation(filePath: string): {
  rows: PlayerProfileParticipationRow[];
  diagnostics: PlayerProfileSourceValidation;
} {
  if (!existsSync(filePath)) {
    return {
      rows: [],
      diagnostics: sourceDiagnostics({
        exists: false,
        filePath,
        fields: [],
        requiredColumns: PARTICIPATION_REQUIRED_COLUMNS,
        missingColumns: PARTICIPATION_REQUIRED_COLUMNS,
        rowCount: 0,
        seasons: [],
      }),
    };
  }

  let header: string[] = [];
  let rowCount = 0;
  const aggregates = new Map<string, PlayerProfileParticipationRow>();
  const seasons = new Set<number>();

  forEachCsvLine(filePath, (row, index) => {
    if (index === 0) {
      header = row;
      return;
    }
    rowCount += 1;
    const record = Object.fromEntries(header.map((field, fieldIndex) => [field, row[fieldIndex] ?? ""]));
    const game = gameParts(nflverseString(record.nflverse_game_id));
    if (!game) return;
    seasons.add(game.season);
    addParticipationPlayers(aggregates, {
      ids: splitIds(record.offense_players),
      season: game.season,
      week: game.week,
      side: "offense",
    });
    addParticipationPlayers(aggregates, {
      ids: splitIds(record.defense_players),
      season: game.season,
      week: game.week,
      side: "defense",
    });
  });

  const missing = missingColumns(header, PARTICIPATION_REQUIRED_COLUMNS);
  const rows = missing.length ? [] : Array.from(aggregates.values());
  return {
    rows,
    diagnostics: sourceDiagnostics({
      exists: true,
      filePath,
      fields: header,
      requiredColumns: PARTICIPATION_REQUIRED_COLUMNS,
      missingColumns: missing,
      rowCount,
      seasons: Array.from(seasons).sort((a, b) => a - b),
    }),
  };
}

function normalizeSnapCountRow(row: Record<string, string>): PlayerProfileSnapCountRow | null {
  const pfrId = nflverseString(row.pfr_player_id);
  if (!pfrId) return null;
  return {
    season: nflverseNumber(row.season),
    week: nflverseNumber(row.week),
    pfrId,
    playerName: nflverseString(row.player) ?? "Unknown player",
    position: normalizeNflversePosition(nflverseString(row.position), null),
    team: normalizeTeam(nflverseString(row.team)),
    offenseSnaps: nflverseNumber(row.offense_snaps),
    offenseSnapShare: pct(row.offense_pct),
    defenseSnaps: nflverseNumber(row.defense_snaps),
    defenseSnapShare: pct(row.defense_pct),
    specialTeamsSnaps: nflverseNumber(row.st_snaps),
    specialTeamsSnapShare: pct(row.st_pct),
  };
}

function addParticipationPlayers(
  aggregates: Map<string, PlayerProfileParticipationRow>,
  input: { ids: string[]; season: number; week: number; side: "offense" | "defense" }
) {
  for (const id of input.ids) {
    const key = `${id}|${input.season}|${input.week}`;
    const row = aggregates.get(key) ?? {
      season: input.season,
      week: input.week,
      gsisId: id,
      offensePlays: 0,
      defensePlays: 0,
    };
    if (input.side === "offense") row.offensePlays += 1;
    else row.defensePlays += 1;
    aggregates.set(key, row);
  }
}

function forEachCsvLine(filePath: string, onRow: (row: string[], index: number) => void) {
  const fd = openSync(filePath, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  let leftover = "";
  let rowIndex = 0;
  try {
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      const chunk = leftover + buffer.toString("utf8", 0, bytesRead);
      const lines = chunk.split(/\r?\n/);
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        onRow(parseCsvLine(line), rowIndex);
        rowIndex += 1;
      }
    }
    if (leftover) onRow(parseCsvLine(leftover), rowIndex);
  } finally {
    closeSync(fd);
  }
}

function parseCsvLine(line: string): string[] {
  const parsed = Papa.parse<string[]>(line, { transform: (value) => String(value ?? "").trim() });
  return Array.isArray(parsed.data[0]) ? parsed.data[0] : [];
}

function splitIds(value: unknown): string[] {
  const raw = nflverseString(value);
  if (!raw) return [];
  return raw.split(";").map((id) => id.trim()).filter((id) => /^00-\d+/.test(id));
}

function gameParts(gameId: string | null): { season: number; week: number } | null {
  const match = /^(\d{4})_(\d{2})_/.exec(gameId ?? "");
  if (!match) return null;
  return { season: Number(match[1]), week: Number(match[2]) };
}

function pct(value: unknown): number | null {
  const number = nflverseNumber(value);
  if (number === null) return null;
  return number > 1 ? round(number / 100) : round(number);
}

function missingColumns(fields: string[], requiredColumns: string[]) {
  const present = new Set(fields);
  return requiredColumns.filter((column) => !present.has(column));
}

function sourceDiagnostics(input: PlayerProfileSourceValidation): PlayerProfileSourceValidation {
  return {
    ...input,
    requiredColumns: [...input.requiredColumns],
    missingColumns: [...input.missingColumns],
    seasons: [...input.seasons],
  };
}

function groupRows<T>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return [...new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)))].sort((a, b) => a - b);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
