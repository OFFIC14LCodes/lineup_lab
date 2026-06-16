import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";

export type RookieSourceKind = "draft-capital" | "college-production" | "role-notes";

export type SourceFileValidationIssue = {
  severity: "error" | "warning";
  rowNumber: number | null;
  field: string | null;
  message: string;
};

export type SourceFileValidationResult = {
  kind: RookieSourceKind;
  filePath: string;
  exists: boolean;
  headerOnly: boolean;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  conflicts: number;
  rowsWithData: number;
  issues: SourceFileValidationIssue[];
  rows: Array<Record<string, string>>;
};

export const SOURCE_SCHEMAS: Record<RookieSourceKind, { columns: string[]; numeric: string[]; dataFields: string[] }> = {
  "draft-capital": {
    columns: ["playerId", "playerName", "position", "team", "season", "nflDraftRound", "nflDraftPick", "nflDraftOverall", "nflDraftTeam", "source", "sourceLabel", "sourceConfidence"],
    numeric: ["season", "nflDraftRound", "nflDraftPick", "nflDraftOverall"],
    dataFields: ["nflDraftRound", "nflDraftPick", "nflDraftOverall", "nflDraftTeam"],
  },
  "college-production": {
    columns: ["playerId", "playerName", "position", "team", "season", "college", "collegeConference", "collegeGames", "collegePassingAttempts", "collegeCompletions", "collegePassingYards", "collegePassingTouchdowns", "collegeInterceptions", "collegeRushingAttempts", "collegeRushingYards", "collegeRushingTouchdowns", "collegeTargets", "collegeReceptions", "collegeReceivingYards", "collegeReceivingTouchdowns", "collegeSoloTackles", "collegeAssistedTackles", "collegeTotalTackles", "collegeTacklesForLoss", "collegeSacks", "collegeInterceptionsDef", "collegePassesDefended", "collegeForcedFumbles", "collegeFumbleRecoveries", "source", "sourceLabel", "sourceConfidence"],
    numeric: ["season", "collegeGames", "collegePassingAttempts", "collegeCompletions", "collegePassingYards", "collegePassingTouchdowns", "collegeInterceptions", "collegeRushingAttempts", "collegeRushingYards", "collegeRushingTouchdowns", "collegeTargets", "collegeReceptions", "collegeReceivingYards", "collegeReceivingTouchdowns", "collegeSoloTackles", "collegeAssistedTackles", "collegeTotalTackles", "collegeTacklesForLoss", "collegeSacks", "collegeInterceptionsDef", "collegePassesDefended", "collegeForcedFumbles", "collegeFumbleRecoveries"],
    dataFields: ["college", "collegeConference", "collegeGames", "collegePassingAttempts", "collegePassingYards", "collegeRushingAttempts", "collegeRushingYards", "collegeTargets", "collegeReceptions", "collegeReceivingYards", "collegeSoloTackles", "collegeTotalTackles", "collegeSacks"],
  },
  "role-notes": {
    columns: ["playerId", "playerName", "position", "team", "season", "landingSpotRole", "opportunityNotes", "roleSourceLabel", "source", "sourceLabel", "sourceConfidence"],
    numeric: ["season"],
    dataFields: ["landingSpotRole", "opportunityNotes"],
  },
};

const SOURCE_CONFIDENCE = new Set(["low", "medium", "high"]);
const LANDING_SPOT_ROLE = new Set(["clear_starter", "probable_starter", "committee", "rotational", "backup", "unknown"]);
const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DEF"]);

export function validateSourceFile(kind: RookieSourceKind, filePath: string): SourceFileValidationResult {
  const schema = SOURCE_SCHEMAS[kind];
  const issues: SourceFileValidationIssue[] = [];
  if (!existsSync(filePath)) {
    return { kind, filePath, exists: false, headerOnly: false, rowCount: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, conflicts: 0, rowsWithData: 0, issues: [{ severity: "error", rowNumber: null, field: null, message: "source file missing" }], rows: [] };
  }
  const text = readFileSync(filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  for (const error of parsed.errors) issues.push({ severity: "error", rowNumber: error.row ? error.row + 2 : null, field: null, message: error.message });
  const fields = parsed.meta.fields ?? [];
  for (const column of schema.columns) {
    if (!fields.includes(column)) issues.push({ severity: "error", rowNumber: null, field: column, message: `required column missing: ${column}` });
  }
  const rows = parsed.data.map((row) => normalizeRow(row, schema.columns));
  const duplicateKeys = new Set<string>();
  const seen = new Map<string, number>();
  const valueByPlayerField = new Map<string, string>();
  let invalidRows = 0;
  let rowsWithData = 0;
  let conflicts = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowIssues = validateRow(kind, row, rowNumber, schema);
    for (const issue of rowIssues) issues.push(issue);
    if (rowIssues.some((issue) => issue.severity === "error")) invalidRows += 1;
    const key = identityKey(row);
    if (seen.has(key)) duplicateKeys.add(key);
    seen.set(key, rowNumber);
    if (schema.dataFields.some((field) => Boolean(row[field]?.trim()))) rowsWithData += 1;
    for (const field of schema.dataFields) {
      const value = row[field]?.trim();
      if (!value) continue;
      const conflictKey = `${key}|${field}`;
      const previous = valueByPlayerField.get(conflictKey);
      if (previous && previous !== value) {
        conflicts += 1;
        issues.push({ severity: "error", rowNumber, field, message: `conflicting value for ${field}: ${previous} vs ${value}` });
      }
      valueByPlayerField.set(conflictKey, value);
    }
  });

  return {
    kind,
    filePath,
    exists: true,
    headerOnly: rows.length === 0,
    rowCount: rows.length,
    validRows: rows.length - invalidRows,
    invalidRows,
    duplicateRows: duplicateKeys.size,
    conflicts,
    rowsWithData,
    issues,
    rows,
  };
}

export function defaultSourcePath(kind: RookieSourceKind): string {
  const file = kind === "draft-capital" ? "draft-capital.csv" : kind === "college-production" ? "college-production.csv" : "role-notes.csv";
  return path.join(process.cwd(), "data", "rookies", "sources", file);
}

export function priorityFillPath(kind: RookieSourceKind): string {
  const file = kind === "draft-capital" ? "draft-capital-priority-fill.csv" : kind === "college-production" ? "college-production-priority-fill.csv" : "role-notes-priority-fill.csv";
  return path.join(process.cwd(), "data", "rookies", "sources", file);
}

function validateRow(kind: RookieSourceKind, row: Record<string, string>, rowNumber: number, schema: typeof SOURCE_SCHEMAS[RookieSourceKind]): SourceFileValidationIssue[] {
  const issues: SourceFileValidationIssue[] = [];
  if (!row.playerId?.trim() && !row.playerName?.trim()) issues.push({ severity: "error", rowNumber, field: "playerId/playerName", message: "playerId or playerName is required" });
  if (!row.playerId?.trim() && !row.position?.trim()) issues.push({ severity: "error", rowNumber, field: "position", message: "position is required when playerId is absent" });
  const normalizedPosition = normalizePrimaryPosition(row.position) ?? row.position?.trim().toUpperCase();
  if (row.position?.trim() && !VALID_POSITIONS.has(normalizedPosition)) issues.push({ severity: "error", rowNumber, field: "position", message: `invalid position: ${row.position}` });
  if (row.team?.trim() && !normalizeTeam(row.team)) issues.push({ severity: "warning", rowNumber, field: "team", message: `team did not normalize: ${row.team}` });
  for (const field of schema.numeric) {
    const value = row[field]?.trim();
    if (!value) continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) issues.push({ severity: "error", rowNumber, field, message: `invalid number: ${value}` });
    if (field === "season" && (parsed < 1900 || parsed > 2100)) issues.push({ severity: "error", rowNumber, field, message: `invalid season: ${value}` });
  }
  if (row.sourceConfidence?.trim() && !SOURCE_CONFIDENCE.has(row.sourceConfidence.trim().toLowerCase())) issues.push({ severity: "error", rowNumber, field: "sourceConfidence", message: `invalid sourceConfidence: ${row.sourceConfidence}` });
  if (kind === "role-notes" && row.landingSpotRole?.trim() && !LANDING_SPOT_ROLE.has(row.landingSpotRole.trim())) issues.push({ severity: "error", rowNumber, field: "landingSpotRole", message: `invalid landingSpotRole: ${row.landingSpotRole}` });
  const hasData = schema.dataFields.some((field) => Boolean(row[field]?.trim()));
  if (hasData) {
    for (const field of ["source", "sourceLabel", "sourceConfidence"]) {
      if (!row[field]?.trim()) issues.push({ severity: "error", rowNumber, field, message: `${field} is required when source data is present` });
    }
  }
  return issues;
}

function normalizeRow(row: Record<string, string>, columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, String(row[column] ?? "").trim()]));
}

function identityKey(row: Record<string, string>): string {
  return `${row.playerId}|${row.playerName.toLowerCase()}|${row.position.toUpperCase()}|${row.team.toUpperCase()}`;
}
