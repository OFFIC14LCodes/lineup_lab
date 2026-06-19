import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import {
  normalizeDepthChartPosition,
  normalizeDepthChartStatus,
  normalizeDepthChartTeam,
} from "./depth-chart-source";
import type { DepthChartSourceRole, DepthChartSourceStatus } from "./depth-chart-source-types";
import type {
  ExternalDepthChartInspectReport,
  ScrapePlayersDepthChartAdapterOptions,
  ScrapePlayersDepthChartAdapterReport,
} from "./depth-chart-external-source-types";

export const H31_DEPTH_CHART_HEADERS = [
  "season",
  "team",
  "player_name",
  "position",
  "depth_position",
  "depth_rank",
  "role",
  "status",
  "sleeper_id",
  "gsis_id",
  "player_id",
  "source",
  "source_updated_at",
  "notes",
];

const SCRAPEPLAYERS_SOURCE = "scrapeplayers_espn_depth_chart_2025_06_11";
const SCRAPEPLAYERS_SOURCE_UPDATED_AT = "2025-06-11";
const STALE_SOURCE_NOTE = "stale_source_trial_not_current_2026_truth";
const COLUMN_ALIASES = {
  playerName: ["player_name", "player", "name", "full_name", "display_name", "athlete", "playername"],
  team: ["team", "nfl_team", "club", "franchise"],
  position: ["position", "pos", "fantasy_position"],
  depthRank: ["depth_rank", "rank", "depth", "order", "depth_order", "depth_chart_order", "depthchartorder"],
  depthPosition: ["depth_position", "depth chart position", "depth_chart_position", "depthchartposition", "slot", "role_position"],
  status: ["status", "roster_status", "player_status", "availability"],
};

export function inspectExternalDepthChartCsv(inputPath: string, sampleSize = 5): ExternalDepthChartInspectReport {
  const { headers, rows } = readCsv(inputPath);
  const likelyColumns = {
    playerName: likelyHeaders(headers, COLUMN_ALIASES.playerName),
    team: likelyHeaders(headers, COLUMN_ALIASES.team),
    position: likelyHeaders(headers, COLUMN_ALIASES.position),
    depthRank: likelyHeaders(headers, COLUMN_ALIASES.depthRank),
    depthPosition: likelyHeaders(headers, COLUMN_ALIASES.depthPosition),
    status: likelyHeaders(headers, COLUMN_ALIASES.status),
  };
  const teamColumn = likelyColumns.team[0] ?? null;
  const positionColumn = likelyColumns.position[0] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    inputPath,
    headers,
    rowCount: rows.length,
    sampleRows: rows.slice(0, sampleSize),
    uniqueTeams: uniqueNormalized(rows, teamColumn, normalizeDepthChartTeam),
    uniquePositions: uniqueNormalized(rows, positionColumn, normalizeExternalPosition),
    likelyColumns,
    missingBlankRates: Object.fromEntries(headers.map((header) => [header, blankRate(rows, header)])),
    notes: [
      "External depth chart inspection is dry-run/read-only and does not write artifacts.",
      "Column detection is heuristic; inspect the output before converting.",
      "ScrapePlayers data is documented as collected on 2025-06-11 and must not be treated as current 2026 production truth.",
    ],
  };
}

export function convertScrapePlayersDepthChart(options: ScrapePlayersDepthChartAdapterOptions): ScrapePlayersDepthChartAdapterReport {
  const { headers, rows } = readCsv(options.inputPath);
  const report = buildScrapePlayersDepthChartAdapterReport({
    season: options.season,
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    headers,
    rawRows: rows,
  });
  mkdirSync(path.dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, renderH31Csv(report.rowsForWrite), "utf8");
  return withoutRowsForWrite(report);
}

export function buildScrapePlayersDepthChartAdapterReport(input: {
  season: number;
  inputPath: string;
  outputPath: string;
  headers: string[];
  rawRows: Array<Record<string, unknown>>;
}): ScrapePlayersDepthChartAdapterReport & { rowsForWrite: Array<Record<string, unknown>> } {
  const inferredColumns = {
    playerName: firstLikely(input.headers, COLUMN_ALIASES.playerName),
    team: firstLikely(input.headers, COLUMN_ALIASES.team),
    position: firstLikely(input.headers, COLUMN_ALIASES.position),
    depthRank: firstLikely(input.headers, COLUMN_ALIASES.depthRank),
    depthPosition: firstLikely(input.headers, COLUMN_ALIASES.depthPosition),
    status: firstLikely(input.headers, COLUMN_ALIASES.status),
  };
  const issues: ScrapePlayersDepthChartAdapterReport["issues"] = [];
  const rowsForWrite: Array<Record<string, unknown>> = [];

  input.rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const playerName = readString(rawRow, inferredColumns.playerName);
    if (!playerName) {
      issues.push({ rowNumber, issue: "missing_player_name", detail: "No inferred player-name column value." });
      return;
    }
    const team = normalizeDepthChartTeam(readString(rawRow, inferredColumns.team));
    const position = normalizeExternalPosition(readString(rawRow, inferredColumns.position));
    const depthPosition = readString(rawRow, inferredColumns.depthPosition);
    const depthRank = parseDepthRank(readString(rawRow, inferredColumns.depthRank), depthPosition);
    const role = roleForDepthRank(depthRank);
    const status = statusForExplicitSource(readString(rawRow, inferredColumns.status));

    if (!team) issues.push({ rowNumber, issue: "missing_or_unknown_team", detail: playerName });
    if (!position || position === "UNK") issues.push({ rowNumber, issue: "missing_or_unknown_position", detail: playerName });

    rowsForWrite.push({
      season: input.season,
      team: team ?? "",
      player_name: playerName,
      position: position === "UNK" ? "" : position,
      depth_position: depthPosition ?? "",
      depth_rank: depthRank ?? "",
      role,
      status,
      sleeper_id: "",
      gsis_id: "",
      player_id: "",
      source: SCRAPEPLAYERS_SOURCE,
      source_updated_at: SCRAPEPLAYERS_SOURCE_UPDATED_AT,
      notes: STALE_SOURCE_NOTE,
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    inputPath: input.inputPath,
    outputPath: input.outputPath,
    season: input.season,
    sourceRows: input.rawRows.length,
    convertedRows: rowsForWrite.length,
    skippedRows: input.rawRows.length - rowsForWrite.length,
    outputHeaders: H31_DEPTH_CHART_HEADERS,
    inferredColumns,
    roleCounts: countBy(rowsForWrite.map((row) => String(row.role))),
    statusCounts: countBy(rowsForWrite.map((row) => String(row.status))),
    teamCounts: countBy(rowsForWrite.map((row) => String(row.team || "missing_team"))),
    positionCounts: countBy(rowsForWrite.map((row) => String(row.position || "missing_position"))),
    issues,
    rowsForWrite,
    notes: [
      "ScrapePlayers adapter is a dry-run/read-only local source-format trial.",
      "The source is documented as collected on 2025-06-11 and is stale for 2026 production truth.",
      "Converted rows are not live projections, ranks, suggestions, War Room scoring inputs, Supabase writes, or v8.2 promotions.",
      "Rows without exact IDs can only become H31 review candidates if later matched by normalized name/team/position.",
    ],
  };
}

function withoutRowsForWrite(report: ScrapePlayersDepthChartAdapterReport & { rowsForWrite: Array<Record<string, unknown>> }): ScrapePlayersDepthChartAdapterReport {
  const { rowsForWrite, ...rest } = report;
  void rowsForWrite;
  return rest;
}

function readCsv(inputPath: string) {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`External depth chart CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

function renderH31Csv(rows: Array<Record<string, unknown>>) {
  return [H31_DEPTH_CHART_HEADERS, ...rows.map((row) => H31_DEPTH_CHART_HEADERS.map((header) => row[header] ?? ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n") + "\n";
}

function firstLikely(headers: string[], aliases: string[]) {
  return likelyHeaders(headers, aliases)[0] ?? null;
}

function likelyHeaders(headers: string[], aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  return headers.filter((header) => normalizedAliases.has(normalizeHeader(header)));
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueNormalized(rows: Array<Record<string, unknown>>, column: string | null, normalize: (value: unknown) => string | null) {
  if (!column) return [];
  return [...new Set(rows.map((row) => normalize(row[column])).filter((value): value is string => Boolean(value)))].sort();
}

function blankRate(rows: Array<Record<string, unknown>>, header: string) {
  const blankRows = rows.filter((row) => !readRawString(row[header])).length;
  return { blankRows, blankRate: rows.length ? blankRows / rows.length : 0 };
}

function normalizeExternalPosition(value: unknown) {
  const normalized = normalizeDepthChartPosition(value);
  const aliases: Record<string, string> = {
    S: "DB",
    SS: "DB",
    FS: "DB",
    CB: "DB",
  };
  return aliases[normalized] ?? normalized;
}

function parseDepthRank(value: string | null, depthPosition: string | null) {
  const explicit = parseFirstInteger(value);
  if (explicit !== null) return explicit;
  return parseFirstInteger(depthPosition);
}

function roleForDepthRank(depthRank: number | null): DepthChartSourceRole {
  if (depthRank === 1) return "starter";
  if (depthRank === 2) return "backup";
  if (depthRank !== null && depthRank >= 3) return "depth";
  return "unknown";
}

function statusForExplicitSource(value: string | null): DepthChartSourceStatus {
  const normalized = normalizeDepthChartStatus(value);
  if (!normalized) return "unknown";
  if (normalized === "starter" || normalized === "backup") return "unknown";
  return normalized;
}

function parseFirstInteger(value: string | null) {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : null;
}

function readString(row: Record<string, unknown>, column: string | null) {
  return column ? readRawString(row[column]) : null;
}

function readRawString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
