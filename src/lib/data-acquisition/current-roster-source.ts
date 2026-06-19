import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import type {
  CurrentRosterCanonicalField,
  CurrentRosterSourceArtifactPaths,
  CurrentRosterSourceInspectReport,
  CurrentRosterSourceIssue,
  CurrentRosterSourceMapping,
  CurrentRosterSourceOptions,
  CurrentRosterSourceReport,
  CurrentRosterSourceRow,
  CurrentRosterStatus,
} from "./current-roster-source-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const STATUSES: CurrentRosterStatus[] = ["active", "practice_squad", "injured_reserve", "pup", "nfi", "suspended", "free_agent", "retired", "unknown"];
const CANONICAL_FIELDS: CurrentRosterCanonicalField[] = ["player_id", "sleeper_id", "gsis_id", "player_name", "position", "team", "status", "roster_status", "depth_chart_position", "depth_chart_order", "source", "source_updated_at", "notes"];
const REQUIRED_FIELDS: CurrentRosterCanonicalField[] = ["player_name", "position", "team", "status"];
const RECOMMENDED_FIELDS: CurrentRosterCanonicalField[] = ["player_id", "sleeper_id", "gsis_id", "roster_status", "source", "source_updated_at"];

export function normalizeCurrentRosterSource(options: CurrentRosterSourceOptions): CurrentRosterSourceReport {
  const mapping = options.mappingPath ? readMapping(options.mappingPath) : {};
  return buildCurrentRosterSourceReport({
    season: options.season,
    inputPath: options.inputPath,
    mappingPath: options.mappingPath ?? null,
    mapping,
    rawRows: readSourceRows(options.inputPath),
  });
}

export function buildCurrentRosterSourceReport(input: {
  season: number;
  inputPath: string;
  mappingPath?: string | null;
  mapping?: CurrentRosterSourceMapping;
  rawRows: Array<Record<string, unknown>>;
}): CurrentRosterSourceReport {
  const issues: CurrentRosterSourceIssue[] = [];
  const normalizedCandidates: CurrentRosterSourceRow[] = [];
  const mapping = input.mapping ?? {};
  input.rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const canonical = applyMapping(row, mapping);
    const status = normalizeStatus(canonical.status);
    const playerName = stringValue(canonical.player_name);
    if (!status) {
      issues.push({ rowNumber, playerName, issue: "invalid_status", detail: String(row.status ?? "") });
      return;
    }
    if (!playerName) {
      issues.push({ rowNumber, playerName: null, issue: "missing_player_name", detail: "player_name is required." });
      return;
    }
    const normalized: CurrentRosterSourceRow = {
      playerId: stringValue(canonical.player_id),
      sleeperId: stringValue(canonical.sleeper_id),
      gsisId: stringValue(canonical.gsis_id),
      playerName,
      normalizedName: normalizeName(playerName),
      position: normalizePosition(canonical.position),
      team: normalizeTeam(canonical.team),
      status,
      rosterStatus: stringValue(canonical.roster_status),
      depthChartPosition: stringValue(canonical.depth_chart_position),
      depthChartOrder: numberValue(canonical.depth_chart_order),
      source: stringValue(canonical.source) ?? "file",
      sourceUpdatedAt: stringValue(canonical.source_updated_at),
      notes: stringValue(canonical.notes),
      matchKey: "",
    };
    normalized.matchKey = rosterMatchKey(normalized);
    if (!normalized.playerId && !normalized.sleeperId && !normalized.gsisId) {
      issues.push({ rowNumber, playerName, issue: "missing_best_id", detail: "No player_id, sleeper_id, or gsis_id supplied; fallback matching will require name/team/position." });
    }
    normalizedCandidates.push(normalized);
  });

  const rows = dedupeRows(normalizedCandidates);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    inputPath: input.inputPath,
    mappingPath: input.mappingPath ?? null,
    mapping,
    sourceRows: input.rawRows.length,
    normalizedRows: rows.length,
    duplicateRowsRemoved: normalizedCandidates.length - rows.length,
    invalidRows: input.rawRows.length - normalizedCandidates.length,
    missingIdRows: rows.filter((row) => !row.playerId && !row.sleeperId && !row.gsisId).length,
    statusCounts: countByStatus(rows),
    positionCounts: countBy(rows.map((row) => row.position || "unknown_position")),
    teamCounts: countBy(rows.map((row) => row.team ?? "missing_team")),
    rows,
    issues,
    notes: [
      "Current roster source normalization is dry-run/read-only and writes only local artifacts.",
      "Rows without ids are retained for later fallback matching by normalized name, team, and position.",
    ],
  };
}

export function inspectCurrentRosterSource(inputPath: string, sampleSize = 3): CurrentRosterSourceInspectReport {
  const { headers, rows } = readSourceRowsWithHeaders(inputPath);
  const directMappedFields = Object.fromEntries(CANONICAL_FIELDS.filter((field) => headers.includes(field)).map((field) => [field, field])) as CurrentRosterSourceMapping;
  const suggestedMapping = suggestMapping(headers);
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !suggestedMapping[field]);
  const missingRecommendedFields = RECOMMENDED_FIELDS.filter((field) => !suggestedMapping[field]);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    inputPath,
    headers,
    sampleRows: rows.slice(0, sampleSize),
    directMappedFields,
    missingRequiredFields,
    missingRecommendedFields,
    suggestedMapping,
    notes: [
      "Inspection reads only the source file header/sample rows and does not write artifacts.",
      "Suggested mapping is heuristic; verify it against the exported file header before normalizing a real roster source.",
    ],
  };
}

export function writeCurrentRosterSourceArtifacts(report: CurrentRosterSourceReport): CurrentRosterSourceArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `current-rosters-${report.season}.normalized`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function normalizeRosterStatusValue(value: unknown): CurrentRosterStatus | null {
  return normalizeStatus(value);
}

export function normalizeRosterTeamValue(value: unknown): string | null {
  return normalizeTeam(value);
}

export function normalizeRosterPositionValue(value: unknown): string {
  return normalizePosition(value);
}

function readSourceRows(inputPath: string) {
  return readSourceRowsWithHeaders(inputPath).rows;
}

function readSourceRowsWithHeaders(inputPath: string): { headers: string[]; rows: Array<Record<string, unknown>> } {
  if (inputPath.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Current roster JSON source must be an array.");
    const rows = parsed as Array<Record<string, unknown>>;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return { headers, rows };
  }
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Current roster CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

function readMapping(mappingPath: string): CurrentRosterSourceMapping {
  return JSON.parse(readFileSync(mappingPath, "utf8")) as CurrentRosterSourceMapping;
}

function applyMapping(row: Record<string, unknown>, mapping: CurrentRosterSourceMapping) {
  const canonical: Record<CurrentRosterCanonicalField, unknown> = {} as Record<CurrentRosterCanonicalField, unknown>;
  for (const field of CANONICAL_FIELDS) canonical[field] = row[mapping[field] ?? field];
  return canonical;
}

function suggestMapping(headers: string[]): CurrentRosterSourceMapping {
  const normalizedHeaderByValue = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const aliases: Record<CurrentRosterCanonicalField, string[]> = {
    player_id: ["player_id", "id", "espn_id", "esb_id", "gsis_it_id"],
    sleeper_id: ["sleeper_id"],
    gsis_id: ["gsis_id", "gsis"],
    player_name: ["player_name", "full_name", "display_name", "name"],
    position: ["position", "pos"],
    team: ["team", "recent_team", "club"],
    status: ["status", "roster_status"],
    roster_status: ["roster_status", "status"],
    depth_chart_position: ["depth_chart_position", "depth_position"],
    depth_chart_order: ["depth_chart_order", "depth_order"],
    source: ["source"],
    source_updated_at: ["source_updated_at", "updated_at"],
    notes: ["notes"],
  };
  const mapping: CurrentRosterSourceMapping = {};
  for (const field of CANONICAL_FIELDS) {
    const match = aliases[field].map(normalizeHeader).map((alias) => normalizedHeaderByValue.get(alias)).find(Boolean);
    if (match) mapping[field] = match;
  }
  return mapping;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dedupeRows(rows: CurrentRosterSourceRow[]) {
  const byKey = new Map<string, CurrentRosterSourceRow>();
  for (const row of rows) {
    const existing = byKey.get(row.matchKey);
    if (!existing || rowScore(row) > rowScore(existing)) byKey.set(row.matchKey, row);
  }
  return [...byKey.values()].sort((a, b) => a.playerName.localeCompare(b.playerName) || a.position.localeCompare(b.position));
}

function rowScore(row: CurrentRosterSourceRow) {
  return (row.playerId ? 100 : 0)
    + (row.sleeperId ? 50 : 0)
    + (row.gsisId ? 25 : 0)
    + (row.sourceUpdatedAt ? Date.parse(row.sourceUpdatedAt) / 1_000_000_000 : 0);
}

function rosterMatchKey(row: CurrentRosterSourceRow) {
  if (row.playerId) return `player:${row.playerId}`;
  if (row.sleeperId) return `sleeper:${row.sleeperId}`;
  if (row.gsisId) return `gsis:${row.gsisId}`;
  return `name:${row.normalizedName}|${row.team ?? ""}|${row.position}`;
}

function normalizeStatus(value: unknown): CurrentRosterStatus | null {
  const raw = stringValue(value)?.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (!raw) return "unknown";
  if (raw === "ir") return "injured_reserve";
  if (raw === "ps" || raw === "practice") return "practice_squad";
  if (raw === "fa") return "free_agent";
  if (STATUSES.includes(raw as CurrentRosterStatus)) return raw as CurrentRosterStatus;
  return null;
}

function normalizePosition(value: unknown) {
  const raw = (stringValue(value) ?? "").toUpperCase();
  if (raw === "D/ST" || raw === "DST" || raw === "DEFENSE") return "DEF";
  if (raw === "PK") return "K";
  return raw || "UNK";
}

function normalizeTeam(value: unknown) {
  const raw = stringValue(value)?.toUpperCase();
  if (!raw) return null;
  const aliases: Record<string, string | null> = {
    FA: "FA",
    FREE_AGENT: "FA",
    JAC: "JAX",
    LA: "LAR",
    STL: "LAR",
    OAK: "LV",
    SD: "LAC",
    WAS: "WAS",
    WSH: "WAS",
  };
  return aliases[raw] ?? raw;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function renderMarkdown(report: CurrentRosterSourceReport) {
  return `# Current Roster Source ${report.season}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Source rows: ${report.sourceRows}
Normalized rows: ${report.normalizedRows}
Duplicate rows removed: ${report.duplicateRowsRemoved}
Invalid rows: ${report.invalidRows}
Missing-id rows: ${report.missingIdRows}

## Status Counts

\`\`\`json
${JSON.stringify(report.statusCounts, null, 2)}
\`\`\`

## Issues

${report.issues.length ? report.issues.map((issue) => `- row ${issue.rowNumber}: ${issue.issue} (${issue.detail})`).join("\n") : "No issues."}
`;
}

function renderCsv(report: CurrentRosterSourceReport) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player_name", "position", "team", "status", "roster_status", "depth_chart_position", "depth_chart_order", "source", "source_updated_at", "notes", "match_key"];
  const rows = report.rows.map((row) => [
    row.playerId ?? "",
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.playerName,
    row.position,
    row.team ?? "",
    row.status,
    row.rosterStatus ?? "",
    row.depthChartPosition ?? "",
    row.depthChartOrder ?? "",
    row.source,
    row.sourceUpdatedAt ?? "",
    row.notes ?? "",
    row.matchKey,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function countByStatus(rows: CurrentRosterSourceRow[]) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<CurrentRosterStatus, number>;
  for (const row of rows) counts[row.status] += 1;
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
