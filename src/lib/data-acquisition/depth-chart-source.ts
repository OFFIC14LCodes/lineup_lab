import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import type {
  DepthChartSourceArtifactPaths,
  DepthChartSourceIssue,
  DepthChartSourceOptions,
  DepthChartSourceReport,
  DepthChartSourceRole,
  DepthChartSourceRow,
  DepthChartSourceStatus,
} from "./depth-chart-source-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "depth-charts");
const STATUSES: DepthChartSourceStatus[] = ["active", "starter", "backup", "reserve", "practice_squad", "injured", "inactive", "unknown"];
const ROLES: DepthChartSourceRole[] = ["starter", "backup", "rotational", "handcuff", "depth", "practice_squad", "special_teams", "unknown"];

export function normalizeDepthChartSource(options: DepthChartSourceOptions): DepthChartSourceReport {
  return buildDepthChartSourceReport({
    season: options.season,
    inputPath: options.inputPath,
    rawRows: readSourceRows(options.inputPath),
  });
}

export function buildDepthChartSourceReport(input: { season: number; inputPath: string; rawRows: Array<Record<string, unknown>> }): DepthChartSourceReport {
  const issues: DepthChartSourceIssue[] = [];
  const candidates: DepthChartSourceRow[] = [];

  input.rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const playerName = stringValue(raw.player_name);
    const status = normalizeDepthChartStatus(raw.status);
    const role = normalizeDepthChartRole(raw.role);
    const team = normalizeDepthChartTeam(raw.team);
    const position = normalizeDepthChartPosition(raw.position);

    if (!playerName) {
      issues.push({ rowNumber, playerName: null, issue: "missing_player_name", detail: "player_name is required." });
      return;
    }
    if (!team) issues.push({ rowNumber, playerName, issue: "missing_team", detail: "team is required for depth chart matching." });
    if (!position || position === "UNK") issues.push({ rowNumber, playerName, issue: "missing_position", detail: "position is required for depth chart matching." });
    if (!status) {
      issues.push({ rowNumber, playerName, issue: "invalid_status", detail: String(raw.status ?? "") });
      return;
    }
    if (!role) {
      issues.push({ rowNumber, playerName, issue: "invalid_role", detail: String(raw.role ?? "") });
      return;
    }

    const row: DepthChartSourceRow = {
      season: numberValue(raw.season) ?? input.season,
      team,
      playerName,
      normalizedName: normalizeName(playerName),
      position,
      depthPosition: stringValue(raw.depth_position),
      depthRank: numberValue(raw.depth_rank),
      role,
      status,
      sleeperId: stringValue(raw.sleeper_id),
      gsisId: stringValue(raw.gsis_id),
      playerId: stringValue(raw.player_id),
      source: stringValue(raw.source) ?? "file",
      sourceUpdatedAt: stringValue(raw.source_updated_at),
      notes: stringValue(raw.notes),
      matchKey: "",
    };
    row.matchKey = matchKeyFor(row);
    if (!row.playerId && !row.sleeperId && !row.gsisId) {
      issues.push({ rowNumber, playerName, issue: "missing_identity", detail: "No player_id, sleeper_id, or gsis_id supplied; fallback matching is review-candidate only." });
    }
    candidates.push(row);
  });

  const { rows, duplicateRowsRemoved, conflictRows } = dedupeRows(candidates, issues);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    inputPath: input.inputPath,
    sourceRows: input.rawRows.length,
    normalizedRows: rows.length,
    duplicateRowsRemoved,
    invalidRows: input.rawRows.length - candidates.length,
    missingIdentityRows: rows.filter((row) => !row.playerId && !row.sleeperId && !row.gsisId).length,
    conflictRows,
    statusCounts: countByFixed(rows, STATUSES, (row) => row.status),
    roleCounts: countByFixed(rows, ROLES, (row) => row.role),
    positionCounts: countBy(rows.map((row) => row.position || "unknown_position")),
    teamCounts: countBy(rows.map((row) => row.team ?? "missing_team")),
    rows,
    issues,
    notes: [
      "Depth chart source normalization is dry-run/read-only and writes only local artifacts.",
      "Rows without exact ids are retained for review-candidate matching by normalized name, team, and compatible position.",
    ],
  };
}

export function writeDepthChartSourceArtifacts(report: DepthChartSourceReport): DepthChartSourceArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `depth-chart-${report.season}.normalized`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function normalizeDepthChartStatus(value: unknown): DepthChartSourceStatus | null {
  const raw = normalizeToken(value);
  if (!raw) return "unknown";
  if (raw === "ps" || raw === "practice") return "practice_squad";
  if (raw === "ir" || raw === "injured_reserve") return "injured";
  return STATUSES.includes(raw as DepthChartSourceStatus) ? raw as DepthChartSourceStatus : null;
}

export function normalizeDepthChartRole(value: unknown): DepthChartSourceRole | null {
  const raw = normalizeToken(value);
  if (!raw) return "unknown";
  if (raw === "ps" || raw === "practice") return "practice_squad";
  return ROLES.includes(raw as DepthChartSourceRole) ? raw as DepthChartSourceRole : null;
}

export function normalizeDepthChartTeam(value: unknown): string | null {
  const raw = stringValue(value)?.toUpperCase();
  if (!raw) return null;
  const aliases: Record<string, string> = { JAC: "JAX", LA: "LAR", STL: "LAR", OAK: "LV", SD: "LAC", WSH: "WAS" };
  return aliases[raw] ?? raw;
}

export function normalizeDepthChartPosition(value: unknown): string {
  const raw = (stringValue(value) ?? "").toUpperCase();
  if (raw === "D/ST" || raw === "DST" || raw === "DEFENSE") return "DEF";
  if (raw === "PK") return "K";
  return raw || "UNK";
}

export function normalizeDepthChartName(value: string): string {
  return normalizeName(value);
}

function readSourceRows(inputPath: string): Array<Record<string, unknown>> {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Depth chart CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function dedupeRows(rows: DepthChartSourceRow[], issues: DepthChartSourceIssue[]) {
  const byKey = new Map<string, DepthChartSourceRow>();
  let conflictRows = 0;
  let duplicateRowsRemoved = 0;
  for (const row of rows) {
    const existing = byKey.get(row.matchKey);
    if (!existing) {
      byKey.set(row.matchKey, row);
      continue;
    }
    duplicateRowsRemoved += 1;
    if (isConflict(existing, row)) {
      conflictRows += 1;
      issues.push({ rowNumber: 0, playerName: row.playerName, issue: "duplicate_conflict", detail: `Duplicate key ${row.matchKey} has conflicting team/position/status/role.` });
    }
    if (rowScore(row) > rowScore(existing)) byKey.set(row.matchKey, row);
  }
  return {
    rows: [...byKey.values()].sort((a, b) => a.playerName.localeCompare(b.playerName) || a.position.localeCompare(b.position)),
    duplicateRowsRemoved,
    conflictRows,
  };
}

function isConflict(a: DepthChartSourceRow, b: DepthChartSourceRow) {
  return a.team !== b.team || a.position !== b.position || a.status !== b.status || a.role !== b.role;
}

function rowScore(row: DepthChartSourceRow) {
  return (row.playerId ? 100 : 0) + (row.sleeperId ? 50 : 0) + (row.gsisId ? 25 : 0) - (row.depthRank ?? 99);
}

function matchKeyFor(row: DepthChartSourceRow) {
  if (row.playerId) return `player:${row.playerId}`;
  if (row.sleeperId) return `sleeper:${row.sleeperId}`;
  if (row.gsisId) return `gsis:${row.gsisId}`;
  return `name:${row.normalizedName}|${row.team ?? ""}|${row.position}`;
}

function renderMarkdown(report: DepthChartSourceReport) {
  return `# Depth Chart Source ${report.season}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Source rows: ${report.sourceRows}
Normalized rows: ${report.normalizedRows}
Duplicate rows removed: ${report.duplicateRowsRemoved}
Invalid rows: ${report.invalidRows}
Missing identity rows: ${report.missingIdentityRows}
Conflict rows: ${report.conflictRows}

## Status Counts

\`\`\`json
${JSON.stringify(report.statusCounts, null, 2)}
\`\`\`

## Role Counts

\`\`\`json
${JSON.stringify(report.roleCounts, null, 2)}
\`\`\`

## Issues

${report.issues.length ? report.issues.map((issue) => `- row ${issue.rowNumber}: ${issue.issue} (${issue.detail})`).join("\n") : "No issues."}
`;
}

function renderCsv(report: DepthChartSourceReport) {
  const headers = ["season", "team", "player_name", "position", "depth_position", "depth_rank", "role", "status", "sleeper_id", "gsis_id", "player_id", "source", "source_updated_at", "notes", "match_key"];
  const rows = report.rows.map((row) => [row.season, row.team ?? "", row.playerName, row.position, row.depthPosition ?? "", row.depthRank ?? "", row.role, row.status, row.sleeperId ?? "", row.gsisId ?? "", row.playerId ?? "", row.source, row.sourceUpdatedAt ?? "", row.notes ?? "", row.matchKey]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function normalizeToken(value: unknown) {
  return stringValue(value)?.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_") ?? null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function countByFixed<T, Key extends string>(rows: T[], keys: Key[], keyFor: (row: T) => Key) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) counts[keyFor(row)] += 1;
  return counts;
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
