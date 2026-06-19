import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { normalizeSleeperPlayer } from "./sleeper/sleeper-player-normalizer";
import type { SleeperRawPlayer } from "./sleeper/sleeper-player-types";
import type {
  SleeperPlayerMetadataArtifactPaths,
  SleeperPlayerMetadataIssue,
  SleeperPlayerMetadataReport,
  SleeperPlayerMetadataRow,
  SleeperPlayerMetadataSourceOptions,
} from "./sleeper-player-metadata-source-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "sleeper");

export function normalizeSleeperPlayerMetadataSource(options: SleeperPlayerMetadataSourceOptions): SleeperPlayerMetadataReport {
  return buildSleeperPlayerMetadataReport({
    season: options.season,
    inputPath: options.inputPath,
    rawRows: readSourceRows(options.inputPath),
  });
}

export function buildSleeperPlayerMetadataReport(input: {
  season: number;
  inputPath: string;
  rawRows: SleeperRawPlayer[];
}): SleeperPlayerMetadataReport {
  const issues: SleeperPlayerMetadataIssue[] = [];
  const rows: SleeperPlayerMetadataRow[] = [];
  input.rawRows.forEach((rawRow, index) => {
    const normalized = normalizeSleeperPlayer(rawRow);
    if (!normalized) {
      issues.push({
        rowNumber: index + 2,
        sleeperId: stringValue(rawRow.player_id),
        playerName: stringValue(rawRow.full_name),
        issue: "invalid_player_metadata",
        detail: "Sleeper player row is missing player_id or name.",
      });
      return;
    }
    rows.push({
      sleeperId: normalized.sleeperId,
      playerName: normalized.playerName,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      position: normalized.position,
      team: normalized.team,
      status: normalized.status,
      normalizedStatus: normalizeStatus(normalized.status, normalized.active),
      active: normalized.active,
      injuryStatus: normalized.injuryStatus,
      fantasyPositions: normalized.fantasyPositions,
      searchRank: normalized.searchRank,
      yearsExperience: normalized.yearsExperience,
      age: normalized.age,
      source: stringValue(rawRow.source) ?? "sleeper",
      sourceUpdatedAt: stringValue(rawRow.source_updated_at),
      notes: stringValue(rawRow.notes),
    });
  });
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    inputPath: input.inputPath,
    sourceRows: input.rawRows.length,
    normalizedRows: rows.length,
    invalidRows: input.rawRows.length - rows.length,
    activeRows: rows.filter((row) => row.active).length,
    inactiveRows: rows.filter((row) => !row.active).length,
    missingTeamRows: rows.filter((row) => !row.team).length,
    positionCounts: countBy(rows, (row) => row.position ?? "missing_position"),
    teamCounts: countBy(rows, (row) => row.team ?? "missing_team"),
    statusCounts: countBy(rows, (row) => row.normalizedStatus),
    rows: rows.sort((a, b) => a.playerName.localeCompare(b.playerName) || a.sleeperId.localeCompare(b.sleeperId)),
    issues,
    notes: [
      "Sleeper player metadata normalization is dry-run/read-only and writes only local artifacts.",
      "The existing npm run sleeper:export output can be used as input; no app runtime network dependency is introduced.",
    ],
  };
}

export function writeSleeperPlayerMetadataArtifacts(report: SleeperPlayerMetadataReport): SleeperPlayerMetadataArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `sleeper-player-metadata-${report.season}.normalized`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function readSourceRows(inputPath: string): SleeperRawPlayer[] {
  if (inputPath.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
    if (Array.isArray(parsed)) return parsed as SleeperRawPlayer[];
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, SleeperRawPlayer>).map(([playerId, row]) => ({
        ...row,
        player_id: row.player_id ?? playerId,
      }));
    }
    throw new Error("Sleeper metadata JSON source must be an array or object keyed by sleeper player id.");
  }
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Sleeper metadata CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data.map((row) => ({
    player_id: stringValue(row.sleeper_id) ?? stringValue(row.player_id) ?? undefined,
    full_name: stringValue(row.player_name),
    first_name: stringValue(row.first_name),
    last_name: stringValue(row.last_name),
    position: stringValue(row.position),
    team: stringValue(row.team),
    status: stringValue(row.status),
    active: booleanValue(row.active),
    injury_status: stringValue(row.injury_status),
    fantasy_positions: fantasyPositionsValue(row.fantasy_positions),
    search_rank: stringValue(row.search_rank),
    years_exp: stringValue(row.years_exp),
    age: stringValue(row.age),
    source: row.source,
    source_updated_at: row.source_updated_at,
    notes: row.notes,
  }));
}

function normalizeStatus(status: string | null, active: boolean) {
  const raw = status?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (raw) return raw;
  return active ? "active" : "unknown";
}

function fantasyPositionsValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  const raw = stringValue(value);
  return raw ? raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean) : null;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const raw = stringValue(value)?.toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return null;
}

function renderMarkdown(report: SleeperPlayerMetadataReport) {
  return `# Sleeper Player Metadata Source ${report.season}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Source rows: ${report.sourceRows}
Normalized rows: ${report.normalizedRows}
Invalid rows: ${report.invalidRows}
Active rows: ${report.activeRows}
Inactive rows: ${report.inactiveRows}
Missing team rows: ${report.missingTeamRows}

## Status Counts

\`\`\`json
${JSON.stringify(report.statusCounts, null, 2)}
\`\`\`

## Issues

${report.issues.length ? report.issues.map((issue) => `- row ${issue.rowNumber}: ${issue.issue} (${issue.detail})`).join("\n") : "No issues."}
`;
}

function renderCsv(report: SleeperPlayerMetadataReport) {
  const headers = ["sleeper_id", "player_name", "first_name", "last_name", "position", "team", "status", "normalized_status", "active", "injury_status", "fantasy_positions", "search_rank", "years_exp", "age", "source", "source_updated_at", "notes"];
  const rows = report.rows.map((row) => [
    row.sleeperId,
    row.playerName,
    row.firstName ?? "",
    row.lastName ?? "",
    row.position ?? "",
    row.team ?? "",
    row.status ?? "",
    row.normalizedStatus,
    row.active,
    row.injuryStatus ?? "",
    row.fantasyPositions.join("|"),
    row.searchRank ?? "",
    row.yearsExperience ?? "",
    row.age ?? "",
    row.source,
    row.sourceUpdatedAt ?? "",
    row.notes ?? "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function countBy<T>(rows: T[], keyFor: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
