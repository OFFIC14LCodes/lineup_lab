import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import type {
  RookieTeamConfirmationCanonicalField,
  RookieTeamConfirmationSourceArtifactPaths,
  RookieTeamConfirmationSourceInspectReport,
  RookieTeamConfirmationSourceIssue,
  RookieTeamConfirmationSourceOptions,
  RookieTeamConfirmationSourceReport,
  RookieTeamConfirmationSourceRow,
} from "./rookie-team-confirmation-source-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "rookies");
const CANONICAL_FIELDS: RookieTeamConfirmationCanonicalField[] = [
  "player_id",
  "sleeper_id",
  "gsis_id",
  "player_name",
  "position",
  "college",
  "nfl_team",
  "draft_club",
  "draft_round",
  "draft_pick",
  "source",
  "source_updated_at",
  "notes",
];
const REQUIRED_FIELDS: RookieTeamConfirmationCanonicalField[] = ["player_name", "position", "nfl_team"];
const RECOMMENDED_FIELDS: RookieTeamConfirmationCanonicalField[] = ["player_id", "sleeper_id", "gsis_id", "college", "source", "source_updated_at"];
const NFL_TEAMS = new Set([
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS", "FA",
]);

export function normalizeRookieTeamConfirmationSource(options: RookieTeamConfirmationSourceOptions): RookieTeamConfirmationSourceReport {
  return buildRookieTeamConfirmationSourceReport({
    season: options.season,
    inputPath: options.inputPath,
    rawRows: readSourceRows(options.inputPath),
  });
}

export function buildRookieTeamConfirmationSourceReport(input: {
  season: number;
  inputPath: string;
  rawRows: Array<Record<string, unknown>>;
}): RookieTeamConfirmationSourceReport {
  const issues: RookieTeamConfirmationSourceIssue[] = [];
  const candidates: RookieTeamConfirmationSourceRow[] = [];

  input.rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = canonicalRow(rawRow);
    const playerName = stringValue(row.player_name);
    if (!playerName) {
      issues.push({ rowNumber, playerName: null, issue: "missing_player_name", detail: "player_name is required." });
      return;
    }
    const position = normalizePosition(row.position);
    if (!position) {
      issues.push({ rowNumber, playerName, issue: "missing_position", detail: "position is required." });
      return;
    }
    const nflTeam = normalizeTeam(row.nfl_team);
    const draftClub = normalizeTeam(row.draft_club);
    if (stringValue(row.nfl_team) && !nflTeam) {
      issues.push({ rowNumber, playerName, issue: "invalid_nfl_team", detail: String(row.nfl_team) });
      return;
    }
    if (stringValue(row.draft_club) && !draftClub) {
      issues.push({ rowNumber, playerName, issue: "invalid_draft_club", detail: String(row.draft_club) });
      return;
    }
    const draftRound = optionalInteger(row.draft_round);
    const draftPick = optionalInteger(row.draft_pick);
    if (draftRound !== null && (!Number.isInteger(draftRound) || draftRound < 1 || draftRound > 7)) {
      issues.push({ rowNumber, playerName, issue: "invalid_draft_round", detail: String(row.draft_round) });
      return;
    }
    if (draftPick !== null && (!Number.isInteger(draftPick) || draftPick < 1)) {
      issues.push({ rowNumber, playerName, issue: "invalid_draft_pick", detail: String(row.draft_pick) });
      return;
    }

    const normalized: RookieTeamConfirmationSourceRow = {
      playerId: stringValue(row.player_id),
      sleeperId: stringValue(row.sleeper_id),
      gsisId: stringValue(row.gsis_id),
      playerName,
      normalizedName: normalizeName(playerName),
      position,
      college: stringValue(row.college),
      normalizedCollege: stringValue(row.college) ? normalizeName(String(row.college)) : null,
      nflTeam,
      draftClub,
      draftRound,
      draftPick,
      source: stringValue(row.source) ?? "file",
      sourceUpdatedAt: stringValue(row.source_updated_at),
      notes: stringValue(row.notes),
      matchKey: "",
    };
    normalized.matchKey = rookieMatchKey(normalized);
    if (!normalized.playerId && !normalized.sleeperId && !normalized.gsisId) {
      issues.push({ rowNumber, playerName, issue: "missing_identifier", detail: "No player_id, sleeper_id, or gsis_id supplied; fallback matching will use name/position or name/college/position." });
    }
    candidates.push(normalized);
  });

  const rows = dedupeRows(candidates);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    inputPath: input.inputPath,
    sourceRows: input.rawRows.length,
    normalizedRows: rows.length,
    duplicateRowsRemoved: candidates.length - rows.length,
    invalidRows: input.rawRows.length - candidates.length,
    missingIdentifierRows: rows.filter((row) => !row.playerId && !row.sleeperId && !row.gsisId).length,
    positionCounts: countBy(rows, (row) => row.position),
    teamCounts: countBy(rows, (row) => row.nflTeam ?? "missing_team"),
    rows,
    issues,
    notes: [
      "Rookie team confirmation source normalization is dry-run/read-only and writes only local artifacts.",
      "Rows without ids are retained for fallback matching; confirm name and position carefully before using as policy evidence.",
    ],
  };
}

export function writeRookieTeamConfirmationSourceArtifacts(report: RookieTeamConfirmationSourceReport): RookieTeamConfirmationSourceArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `rookie-team-confirmation-${report.season}.normalized`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function inspectRookieTeamConfirmationSource(inputPath: string, sampleSize = 3): RookieTeamConfirmationSourceInspectReport {
  const { headers, rows } = readSourceRowsWithHeaders(inputPath);
  const directMappedFields = Object.fromEntries(CANONICAL_FIELDS.filter((field) => headers.includes(field)).map((field) => [field, field]));
  const suggestedMapping = suggestMapping(headers);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    inputPath,
    headers,
    sampleRows: rows.slice(0, sampleSize),
    directMappedFields,
    missingRequiredFields: REQUIRED_FIELDS.filter((field) => !suggestedMapping[field]),
    missingRecommendedFields: RECOMMENDED_FIELDS.filter((field) => !suggestedMapping[field]),
    suggestedMapping,
    notes: [
      "Inspection reads only source headers/sample rows and does not write artifacts.",
      "Suggested mapping is heuristic; verify it before preparing the canonical rookie team confirmation CSV.",
    ],
  };
}

export function normalizeRookieTeamValue(value: unknown): string | null {
  return normalizeTeam(value);
}

export function normalizeRookiePositionValue(value: unknown): string | null {
  return normalizePosition(value);
}

export function normalizeRookieNameValue(value: string): string {
  return normalizeName(value);
}

function readSourceRows(inputPath: string) {
  return readSourceRowsWithHeaders(inputPath).rows;
}

function readSourceRowsWithHeaders(inputPath: string) {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Rookie team confirmation CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

function canonicalRow(row: Record<string, unknown>) {
  const canonical: Record<RookieTeamConfirmationCanonicalField, unknown> = {} as Record<RookieTeamConfirmationCanonicalField, unknown>;
  for (const field of CANONICAL_FIELDS) canonical[field] = row[field];
  return canonical;
}

function dedupeRows(rows: RookieTeamConfirmationSourceRow[]) {
  const byKey = new Map<string, RookieTeamConfirmationSourceRow>();
  for (const row of rows) {
    const existing = byKey.get(row.matchKey);
    if (!existing || rowScore(row) > rowScore(existing)) byKey.set(row.matchKey, row);
  }
  return [...byKey.values()].sort((a, b) => a.playerName.localeCompare(b.playerName) || a.position.localeCompare(b.position));
}

function rowScore(row: RookieTeamConfirmationSourceRow) {
  return (row.playerId ? 100 : 0)
    + (row.sleeperId ? 50 : 0)
    + (row.gsisId ? 25 : 0)
    + (row.nflTeam ? 10 : 0)
    + (row.sourceUpdatedAt ? Date.parse(row.sourceUpdatedAt) / 1_000_000_000 : 0);
}

function rookieMatchKey(row: RookieTeamConfirmationSourceRow) {
  if (row.playerId) return `player:${row.playerId}`;
  if (row.sleeperId) return `sleeper:${row.sleeperId}`;
  if (row.gsisId) return `gsis:${row.gsisId}`;
  if (row.normalizedCollege) return `name_college_position:${row.normalizedName}|${row.normalizedCollege}|${row.position}`;
  return `name_position:${row.normalizedName}|${row.position}`;
}

function normalizeTeam(value: unknown) {
  const raw = stringValue(value)?.toUpperCase().replaceAll(" ", "_");
  if (!raw) return null;
  const aliases: Record<string, string> = {
    ARZ: "ARI",
    JAC: "JAX",
    LA: "LAR",
    STL: "LAR",
    OAK: "LV",
    SD: "LAC",
    WSH: "WAS",
    FREE_AGENT: "FA",
  };
  const normalized = aliases[raw] ?? raw;
  return NFL_TEAMS.has(normalized) ? normalized : null;
}

function normalizePosition(value: unknown) {
  const raw = stringValue(value)?.toUpperCase();
  if (!raw) return null;
  if (raw === "D/ST" || raw === "DST" || raw === "DEFENSE") return "DEF";
  if (raw === "PK") return "K";
  return raw;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function optionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function suggestMapping(headers: string[]) {
  const normalizedHeaderByValue = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const aliases: Record<RookieTeamConfirmationCanonicalField, string[]> = {
    player_id: ["player_id", "id", "gsis_id", "gsis"],
    sleeper_id: ["sleeper_id"],
    gsis_id: ["gsis_id", "gsis"],
    player_name: ["player_name", "full_name", "display_name", "name"],
    position: ["position", "pos"],
    college: ["college", "college_name", "school"],
    nfl_team: ["nfl_team", "team", "recent_team", "club"],
    draft_club: ["draft_club", "draft_team", "drafted_by"],
    draft_round: ["draft_round", "round"],
    draft_pick: ["draft_pick", "draft_number", "overall_pick", "pick"],
    source: ["source"],
    source_updated_at: ["source_updated_at", "updated_at"],
    notes: ["notes"],
  };
  const mapping: Partial<Record<RookieTeamConfirmationCanonicalField, string>> = {};
  for (const field of CANONICAL_FIELDS) {
    const match = aliases[field].map(normalizeHeader).map((alias) => normalizedHeaderByValue.get(alias)).find(Boolean);
    if (match) mapping[field] = match;
  }
  return mapping;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function countBy<Key extends string>(rows: RookieTeamConfirmationSourceRow[], keyFor: (row: RookieTeamConfirmationSourceRow) => Key) {
  const counts: Record<Key, number> = {} as Record<Key, number>;
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function renderMarkdown(report: RookieTeamConfirmationSourceReport) {
  return `# Rookie Team Confirmation Source ${report.season}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Source rows: ${report.sourceRows}
Normalized rows: ${report.normalizedRows}
Duplicate rows removed: ${report.duplicateRowsRemoved}
Invalid rows: ${report.invalidRows}
Missing-identifier rows: ${report.missingIdentifierRows}

## Team Counts

\`\`\`json
${JSON.stringify(report.teamCounts, null, 2)}
\`\`\`

## Issues

${report.issues.length ? report.issues.map((issue) => `- row ${issue.rowNumber}: ${issue.issue} (${issue.detail})`).join("\n") : "No issues."}
`;
}

function renderCsv(report: RookieTeamConfirmationSourceReport) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player_name", "position", "college", "nfl_team", "draft_club", "draft_round", "draft_pick", "source", "source_updated_at", "notes", "match_key"];
  const rows = report.rows.map((row) => [
    row.playerId ?? "",
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.playerName,
    row.position,
    row.college ?? "",
    row.nflTeam ?? "",
    row.draftClub ?? "",
    row.draftRound ?? "",
    row.draftPick ?? "",
    row.source,
    row.sourceUpdatedAt ?? "",
    row.notes ?? "",
    row.matchKey,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
