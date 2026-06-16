import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

export const NFLVERSE_DATA_DIR = path.join(process.cwd(), "data", "nflverse");

export const NFLVERSE_FILES = {
  players: "players.csv",
  rosters: "rosters_2025.csv",
  playerStats: "player_stats_2025.csv",
  schedules: "schedules_2025.csv",
} as const;

export type NflverseFileKey = keyof typeof NFLVERSE_FILES;

export type NflverseCsvReadResult = {
  filePath: string;
  exists: boolean;
  fields: string[];
  rows: Array<Record<string, string>>;
  parseErrors: string[];
};

export function nflverseFilePath(fileKey: NflverseFileKey, dataDir = NFLVERSE_DATA_DIR): string {
  return path.join(dataDir, NFLVERSE_FILES[fileKey]);
}

export function readNflverseCsv(fileKey: NflverseFileKey, dataDir = NFLVERSE_DATA_DIR): NflverseCsvReadResult {
  const filePath = nflverseFilePath(fileKey, dataDir);
  if (!existsSync(filePath)) {
    return { filePath, exists: false, fields: [], rows: [], parseErrors: [] };
  }

  const parsed = Papa.parse<Record<string, string>>(readFileSync(filePath, "utf8"), {
    header: true,
    skipEmptyLines: true,
    transform: (value) => normalizeRawCsvValue(value),
  });

  return {
    filePath,
    exists: true,
    fields: parsed.meta.fields ?? [],
    rows: parsed.data,
    parseErrors: parsed.errors.map((error) => `${error.code}: ${error.message}`),
  };
}

export function normalizeRawCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const trimmed = String(value).trim();
  return trimmed === "NA" || trimmed === "N/A" || trimmed.toLowerCase() === "null" ? "" : trimmed;
}

export function nflverseString(value: unknown): string | null {
  const normalized = normalizeRawCsvValue(value);
  return normalized ? normalized : null;
}

export function nflverseNumber(value: unknown): number | null {
  const normalized = nflverseString(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
