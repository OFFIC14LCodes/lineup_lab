import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { serializeCsv } from "@/lib/projections/rookie-enrichment-workflow";
import { defaultSourcePath, priorityFillPath, SOURCE_SCHEMAS, type RookieSourceKind, validateSourceFile } from "./source-file-validation";

const SOURCE_DIR = path.join(process.cwd(), "data", "rookies", "sources");
const PRIORITY_PATH = path.join(process.cwd(), "data", "rookies", "rookie-enrichment-priority.csv");

export type SourceFilesBuildReport = {
  generatedAt: string;
  dryRun: boolean;
  apply: boolean;
  generatedPriorityFillFiles: Array<{ kind: RookieSourceKind; path: string; rows: number }>;
  mergeResults: Array<{
    kind: RookieSourceKind;
    sourcePath: string;
    fillPath: string;
    fillRows: number;
    rowsWithData: number;
    appliedRows: number;
    conflicts: number;
    invalidRows: number;
  }>;
  verdict: "passed" | "needs_source_data" | "failed";
};

const KINDS: RookieSourceKind[] = ["draft-capital", "college-production", "role-notes"];
const HELPER_COLUMNS = ["priorityTier", "priorityScore", "priorityReasons", "missingFields"];

export function generatePriorityFillFiles(limit = 100): SourceFilesBuildReport["generatedPriorityFillFiles"] {
  mkdirSync(SOURCE_DIR, { recursive: true });
  const priorityRows = readCsv(PRIORITY_PATH).slice(0, limit);
  return KINDS.map((kind) => {
    const columns = [...HELPER_COLUMNS, ...SOURCE_SCHEMAS[kind].columns];
    const rows = priorityRows.map((row) => fillRow(kind, row));
    const filePath = priorityFillPath(kind);
    if (!existsSync(filePath) || !priorityFillHasUserData(filePath, kind)) {
      writeFileSync(filePath, serializeCsv(rows, columns));
    }
    return { kind, path: filePath, rows: rows.length };
  });
}

export function buildRookieSourceFiles(input: { apply?: boolean; dryRun?: boolean; limit?: number } = {}): SourceFilesBuildReport {
  const apply = Boolean(input.apply);
  const dryRun = input.dryRun ?? !apply;
  const generatedPriorityFillFiles = generatePriorityFillFiles(input.limit ?? 100);
  const mergeResults = KINDS.map((kind) => mergeKind(kind, apply && !dryRun));
  const invalidRows = mergeResults.reduce((sum, row) => sum + row.invalidRows, 0);
  const conflicts = mergeResults.reduce((sum, row) => sum + row.conflicts, 0);
  const rowsWithData = mergeResults.reduce((sum, row) => sum + row.rowsWithData, 0);
  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    apply,
    generatedPriorityFillFiles,
    mergeResults,
    verdict: invalidRows || conflicts ? "failed" : rowsWithData ? "passed" : "needs_source_data",
  };
}

function mergeKind(kind: RookieSourceKind, write: boolean) {
  const sourcePath = defaultSourcePath(kind);
  const fillPath = priorityFillPath(kind);
  const sourceValidation = validateSourceFile(kind, sourcePath);
  const fillValidation = validateSourceFile(kind, fillPath);
  const sourceRows = sourceValidation.rows;
  const outputRows = [...sourceRows];
  let appliedRows = 0;
  let conflicts = sourceValidation.conflicts + fillValidation.conflicts;
  const index = new Map(sourceRows.map((row, rowIndex) => [rowKey(row), rowIndex]));
  for (const row of fillValidation.rows) {
    if (!SOURCE_SCHEMAS[kind].dataFields.some((field) => Boolean(row[field]?.trim()))) continue;
    const existingIndex = index.get(rowKey(row));
    if (existingIndex === undefined) {
      outputRows.push(stripHelperColumns(row, kind));
      appliedRows += 1;
      continue;
    }
    const existing = outputRows[existingIndex];
    const merged = { ...existing };
    let hasConflict = false;
    let hasAppliedValue = false;
    for (const field of SOURCE_SCHEMAS[kind].columns) {
      const value = row[field]?.trim();
      if (!value) continue;
      if (existing[field]?.trim() && existing[field] !== value) {
        hasConflict = true;
        continue;
      }
      if (!existing[field]?.trim()) {
        merged[field] = value;
        hasAppliedValue = true;
      }
    }
    if (hasConflict) conflicts += 1;
    if (hasAppliedValue && !hasConflict) {
      outputRows[existingIndex] = merged;
      appliedRows += 1;
    }
  }
  if (write && fillValidation.invalidRows === 0 && conflicts === 0) {
    writeFileSync(sourcePath, serializeCsv(outputRows, SOURCE_SCHEMAS[kind].columns));
  }
  return {
    kind,
    sourcePath,
    fillPath,
    fillRows: fillValidation.rowCount,
    rowsWithData: fillValidation.rowsWithData,
    appliedRows,
    conflicts,
    invalidRows: fillValidation.invalidRows + sourceValidation.invalidRows,
  };
}

function fillRow(kind: RookieSourceKind, row: Record<string, unknown>) {
  const output: Record<string, string> = {
    priorityTier: String(row.priorityTier ?? ""),
    priorityScore: String(row.priorityScore ?? ""),
    priorityReasons: String(row.priorityReasons ?? ""),
    missingFields: String(row.missingFields ?? ""),
  };
  for (const column of SOURCE_SCHEMAS[kind].columns) {
    output[column] = ["playerId", "playerName", "position", "team", "season"].includes(column) ? String(row[column] ?? "") : "";
  }
  return output;
}

function priorityFillHasUserData(filePath: string, kind: RookieSourceKind): boolean {
  const validation = validateSourceFile(kind, filePath);
  return validation.rowsWithData > 0;
}

function stripHelperColumns(row: Record<string, string>, kind: RookieSourceKind) {
  return Object.fromEntries(SOURCE_SCHEMAS[kind].columns.map((column) => [column, row[column] ?? ""]));
}

function rowKey(row: Record<string, string>) {
  return `${row.playerId}|${row.playerName.toLowerCase()}|${row.position.toUpperCase()}|${row.team.toUpperCase()}|${row.season}`;
}

function readCsv(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) return [];
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`CSV parse failed for ${filePath}: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}
