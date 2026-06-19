import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import type {
  PlayerIdCrosswalkCanonicalField,
  PlayerIdCrosswalkConfidence,
  PlayerIdCrosswalkSourceArtifactPaths,
  PlayerIdCrosswalkSourceIssue,
  PlayerIdCrosswalkSourceOptions,
  PlayerIdCrosswalkSourceReport,
  PlayerIdCrosswalkSourceRow,
} from "./player-id-crosswalk-source-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "player-crosswalk");
const CANONICAL_FIELDS: PlayerIdCrosswalkCanonicalField[] = ["sleeper_id", "gsis_id", "player_id", "player_name", "position", "team", "source", "source_updated_at", "confidence", "notes"];
const CONFIDENCES: PlayerIdCrosswalkConfidence[] = ["exact_id", "source_declared", "name_team_position", "manual_review", "unknown"];

export function normalizePlayerIdCrosswalkSource(options: PlayerIdCrosswalkSourceOptions): PlayerIdCrosswalkSourceReport {
  return buildPlayerIdCrosswalkSourceReport({
    season: options.season,
    inputPath: options.inputPath,
    rawRows: readSourceRows(options.inputPath),
  });
}

export function buildPlayerIdCrosswalkSourceReport(input: {
  season: number;
  inputPath: string;
  rawRows: Array<Record<string, unknown>>;
}): PlayerIdCrosswalkSourceReport {
  const issues: PlayerIdCrosswalkSourceIssue[] = [];
  const candidates: PlayerIdCrosswalkSourceRow[] = [];
  input.rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = canonicalRow(rawRow);
    const sleeperId = stringValue(row.sleeper_id);
    const playerName = stringValue(row.player_name);
    const confidence = normalizeConfidence(row.confidence);
    if (!sleeperId) {
      issues.push({ rowNumber, sleeperId: null, playerName, issue: "missing_sleeper_id", detail: "sleeper_id is required for crosswalk review." });
      return;
    }
    if (!confidence) {
      issues.push({ rowNumber, sleeperId, playerName, issue: "invalid_confidence", detail: String(row.confidence ?? "") });
      return;
    }
    const normalized: PlayerIdCrosswalkSourceRow = {
      sleeperId,
      gsisId: stringValue(row.gsis_id),
      playerId: stringValue(row.player_id),
      playerName,
      normalizedName: playerName ? normalizeName(playerName) : null,
      position: normalizePosition(row.position),
      team: normalizeTeam(row.team),
      source: stringValue(row.source) ?? "file",
      sourceUpdatedAt: stringValue(row.source_updated_at),
      confidence,
      notes: stringValue(row.notes),
      matchKey: "",
    };
    normalized.matchKey = `${normalized.sleeperId}|${normalized.gsisId ?? ""}`;
    if (!normalized.gsisId) {
      issues.push({ rowNumber, sleeperId, playerName, issue: "missing_gsis_id", detail: "Row retained as review evidence but cannot confirm a crosswalk." });
    }
    candidates.push(normalized);
  });

  const rows = dedupeRows(candidates);
  const conflictGroups = buildConflictGroups(rows);
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
    missingGsisRows: rows.filter((row) => !row.gsisId).length,
    conflictGroups,
    confidenceCounts: countByConfidence(rows),
    rows,
    issues,
    notes: [
      "Player ID crosswalk normalization is dry-run/read-only and writes only local artifacts.",
      "Only exact_id and source_declared rows can be used as confirmed crosswalk evidence.",
      "Name/team/position rows are retained as review candidates and never treated as confirmed identity.",
    ],
  };
}

export function writePlayerIdCrosswalkSourceArtifacts(report: PlayerIdCrosswalkSourceReport): PlayerIdCrosswalkSourceArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `sleeper-nflverse-crosswalk-${report.season}.normalized`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function readSourceRows(inputPath: string) {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Player ID crosswalk CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function canonicalRow(row: Record<string, unknown>) {
  const canonical: Record<PlayerIdCrosswalkCanonicalField, unknown> = {} as Record<PlayerIdCrosswalkCanonicalField, unknown>;
  for (const field of CANONICAL_FIELDS) canonical[field] = row[field];
  return canonical;
}

function dedupeRows(rows: PlayerIdCrosswalkSourceRow[]) {
  const byKey = new Map<string, PlayerIdCrosswalkSourceRow>();
  for (const row of rows) {
    const existing = byKey.get(row.matchKey);
    if (!existing || rowScore(row) > rowScore(existing)) byKey.set(row.matchKey, row);
  }
  return [...byKey.values()].sort((a, b) => a.sleeperId.localeCompare(b.sleeperId) || (a.gsisId ?? "").localeCompare(b.gsisId ?? ""));
}

function rowScore(row: PlayerIdCrosswalkSourceRow) {
  return (row.gsisId ? 100 : 0)
    + (row.confidence === "exact_id" ? 50 : 0)
    + (row.confidence === "source_declared" ? 40 : 0)
    + (row.sourceUpdatedAt ? Date.parse(row.sourceUpdatedAt) / 1_000_000_000 : 0);
}

function buildConflictGroups(rows: PlayerIdCrosswalkSourceRow[]) {
  return {
    sleeperIdToMultipleGsis: conflictMap(rows.filter((row) => row.gsisId), (row) => row.sleeperId, (row) => row.gsisId ?? ""),
    gsisIdToMultipleSleeper: conflictMap(rows.filter((row) => row.gsisId), (row) => row.gsisId ?? "", (row) => row.sleeperId),
  };
}

function conflictMap(rows: PlayerIdCrosswalkSourceRow[], keyFor: (row: PlayerIdCrosswalkSourceRow) => string, valueFor: (row: PlayerIdCrosswalkSourceRow) => string) {
  const grouped = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = keyFor(row);
    grouped.set(key, (grouped.get(key) ?? new Set()).add(valueFor(row)));
  }
  return Object.fromEntries([...grouped.entries()].filter(([, values]) => values.size > 1).map(([key, values]) => [key, [...values].sort()]));
}

function normalizeConfidence(value: unknown): PlayerIdCrosswalkConfidence | null {
  const raw = stringValue(value)?.toLowerCase() ?? "unknown";
  return CONFIDENCES.includes(raw as PlayerIdCrosswalkConfidence) ? raw as PlayerIdCrosswalkConfidence : null;
}

function normalizePosition(value: unknown) {
  const raw = stringValue(value)?.toUpperCase();
  if (!raw) return null;
  if (raw === "D/ST" || raw === "DST" || raw === "DEFENSE") return "DEF";
  if (raw === "PK") return "K";
  return raw;
}

function normalizeTeam(value: unknown) {
  const raw = stringValue(value)?.toUpperCase();
  if (!raw) return null;
  const aliases: Record<string, string> = { ARZ: "ARI", JAC: "JAX", LA: "LAR", STL: "LAR", OAK: "LV", SD: "LAC", WSH: "WAS" };
  return aliases[raw] ?? raw;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function countByConfidence(rows: PlayerIdCrosswalkSourceRow[]) {
  const counts = Object.fromEntries(CONFIDENCES.map((confidence) => [confidence, 0])) as Record<PlayerIdCrosswalkConfidence, number>;
  for (const row of rows) counts[row.confidence] += 1;
  return counts;
}

function renderMarkdown(report: PlayerIdCrosswalkSourceReport) {
  return `# Player ID Crosswalk Source ${report.season}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Source rows: ${report.sourceRows}
Normalized rows: ${report.normalizedRows}
Duplicate rows removed: ${report.duplicateRowsRemoved}
Invalid rows: ${report.invalidRows}
Missing GSIS rows: ${report.missingGsisRows}

## Confidence Counts

\`\`\`json
${JSON.stringify(report.confidenceCounts, null, 2)}
\`\`\`

## Conflict Groups

\`\`\`json
${JSON.stringify(report.conflictGroups, null, 2)}
\`\`\`

## Issues

${report.issues.length ? report.issues.map((issue) => `- row ${issue.rowNumber}: ${issue.issue} (${issue.detail})`).join("\n") : "No issues."}
`;
}

function renderCsv(report: PlayerIdCrosswalkSourceReport) {
  const headers = ["sleeper_id", "gsis_id", "player_id", "player_name", "position", "team", "source", "source_updated_at", "confidence", "notes", "match_key"];
  const rows = report.rows.map((row) => [row.sleeperId, row.gsisId ?? "", row.playerId ?? "", row.playerName ?? "", row.position ?? "", row.team ?? "", row.source, row.sourceUpdatedAt ?? "", row.confidence, row.notes ?? "", row.matchKey]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
