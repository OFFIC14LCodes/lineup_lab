// Generic CSV ADP parser with FantasyPros format support.
// FantasyPros ADP CSV columns (typical):
//   Player Team (Bye), POS, Team, BYE, AVG, BEST, WORST, STDEV, ADP, %DRAFTED
//   or: Rank, Player, Team, Pos, Best, Worst, Avg, Std Dev
//
// Also supports a simple generic format: Name, Position, Team, ADP
// Headers are detected automatically.

import { createHash } from "node:crypto";

import { normalizeTeam } from "@/lib/players/normalize";
import type { AdpFormatProfile, AdpSourceMeta, RawAdpRecord } from "@/lib/adp/types";

const PARSER_VERSION = "h7-csv-parser-v1";

// Strip BOM and normalize line endings.
function normalizeText(raw: string): string {
  return raw.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseLines(text: string): string[][] {
  const lines = normalizeText(text).split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

// Detect which columns hold the key values.
type ColumnMap = {
  name: number;
  position: number | null;
  team: number | null;
  avg: number;
  best: number | null;
  worst: number | null;
  stddev: number | null;
  sampleSize: number | null;
  rank: number | null;
  posRank: number | null;
};

function findColumns(header: string[]): ColumnMap | null {
  const h = header.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const idx = (candidates: string[]) => {
    for (const c of candidates) {
      const i = h.findIndex((col) => col === c || col.startsWith(c));
      if (i >= 0) return i;
    }
    return null;
  };

  const avg = idx(["avg", "averagepick", "adp", "average"]);
  if (avg === null) return null;

  const name = idx(["player", "playername", "name"]) ?? 0;

  return {
    name,
    position: idx(["pos", "position"]),
    team: idx(["team", "nflteam", "nfl"]),
    avg,
    best: idx(["best", "min", "minpick", "lo"]),
    worst: idx(["worst", "max", "maxpick", "hi"]),
    stddev: idx(["stddev", "std", "stdev", "deviation"]),
    sampleSize: idx(["drafted", "timesdrafted", "count", "sample"]),
    rank: idx(["rank", "rk", "ovr", "orank"]),
    posRank: idx(["posrank", "positionrank", "pranks", "prank"]),
  };
}

// Extract player name from FantasyPros "Player Team (Bye)" format.
// e.g. "Patrick Mahomes KC (7)" → "Patrick Mahomes"
function extractFPName(raw: string): { name: string; team: string | null } {
  // Pattern: "Name TEA (Bye)" or "Name (Bye)" or "Name TEA"
  const withTeamBye = raw.match(/^(.+?)\s+([A-Z]{2,4})\s*\(\d+\)\s*$/);
  if (withTeamBye) return { name: withTeamBye[1].trim(), team: withTeamBye[2].trim() };
  const withBye = raw.match(/^(.+?)\s*\(\d+\)\s*$/);
  if (withBye) return { name: withBye[1].trim(), team: null };
  return { name: raw.trim(), team: null };
}

function num(val: string | undefined): number | null {
  if (!val || val.trim() === "" || val.trim() === "-") return null;
  const n = parseFloat(val.trim().replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

export type CsvParseResult = {
  raw: RawAdpRecord[];
  fileHash: string;
  detectedFormat: "fantasypros" | "generic";
  rowCount: number;
  skippedRows: number;
};

export function parseCsvAdp(csvText: string): CsvParseResult {
  const fileHash = createHash("sha256").update(csvText).digest("hex");
  const rows = parseLines(csvText);
  if (rows.length < 2) return { raw: [], fileHash, detectedFormat: "generic", rowCount: 0, skippedRows: 0 };

  const header = rows[0];
  const cols = findColumns(header);
  if (!cols) {
    return { raw: [], fileHash, detectedFormat: "generic", rowCount: 0, skippedRows: rows.length - 1 };
  }

  const isFP = header.some((h) => h.toLowerCase().includes("bye") || h.toLowerCase().includes("fantasypros"));

  const records: RawAdpRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) { skipped++; continue; }

    const rawCell = row[cols.name] ?? "";
    const { name, team: fpTeam } = isFP ? extractFPName(rawCell) : { name: rawCell, team: null };
    if (!name) { skipped++; continue; }

    const avgVal = num(row[cols.avg] ?? "");
    if (avgVal === null || avgVal <= 0) { skipped++; continue; }

    const rawPosition = cols.position !== null ? (row[cols.position] ?? null) : null;
    const rawTeam =
      cols.team !== null
        ? normalizeTeam(row[cols.team] ?? null)
        : fpTeam
        ? normalizeTeam(fpTeam)
        : null;

    records.push({
      rawId: null,
      rawName: name,
      rawPosition: rawPosition?.trim() || null,
      rawTeam,
      overallAdp: avgVal,
      overallRank: cols.rank !== null ? (num(row[cols.rank] ?? "") ? Math.round(num(row[cols.rank] ?? "")!) : null) : null,
      positionalAdp: null,
      positionalRank: cols.posRank !== null ? (num(row[cols.posRank] ?? "") ? Math.round(num(row[cols.posRank] ?? "")!) : null) : null,
      minPick: cols.best !== null ? (num(row[cols.best] ?? "") ? Math.round(num(row[cols.best] ?? "")!) : null) : null,
      maxPick: cols.worst !== null ? (num(row[cols.worst] ?? "") ? Math.round(num(row[cols.worst] ?? "")!) : null) : null,
      stddev: cols.stddev !== null ? num(row[cols.stddev] ?? "") : null,
      sampleSize: cols.sampleSize !== null ? (num(row[cols.sampleSize] ?? "") ? Math.round(num(row[cols.sampleSize] ?? "")!) : null) : null,
      extraFields: {},
    });
  }

  records.sort((a, b) => a.overallAdp - b.overallAdp);

  return {
    raw: records,
    fileHash,
    detectedFormat: isFP ? "fantasypros" : "generic",
    rowCount: records.length,
    skippedRows: skipped,
  };
}

// Build AdpSourceMeta for a CSV upload.
export function buildCsvSourceMeta(opts: {
  filename: string;
  fileHash: string;
  capturedAt: string;
  effectiveDate: string;
  season: number;
  formatProfile: AdpFormatProfile;
  sampleSize?: number | null;
  sourceVersion?: string | null;
  provider?: "fantasypros" | "manual_csv";
}): AdpSourceMeta {
  const provider = opts.provider ?? "manual_csv";
  const identifier = [
    provider,
    opts.season,
    opts.formatProfile.isDynasty ? "dynasty" : "redraft",
    opts.formatProfile.pprValue === 1 ? "ppr" : opts.formatProfile.pprValue === 0.5 ? "halfppr" : "std",
    `${opts.formatProfile.teamCount}team`,
    opts.effectiveDate.slice(0, 10).replace(/-/g, ""),
  ].join("-");

  return {
    provider,
    sourceIdentifier: identifier,
    sourceUrl: null,
    capturedAt: opts.capturedAt,
    effectiveDate: opts.effectiveDate,
    season: opts.season,
    formatProfile: opts.formatProfile,
    sampleSize: opts.sampleSize ?? null,
    sourceVersion: opts.sourceVersion ?? opts.filename,
    fileHash: opts.fileHash,
    parserVersion: PARSER_VERSION,
  };
}
