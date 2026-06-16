import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { serializeCsv } from "@/lib/projections/rookie-enrichment-workflow";
import { SOURCE_SCHEMAS, type RookieSourceKind } from "./source-file-validation";

export type ProviderExportColumnMap = Record<string, string>;

export type ProviderExportNormalizeResult = {
  inputPath: string;
  outputPath: string | null;
  kind: RookieSourceKind;
  dryRun: boolean;
  sourceRows: number;
  normalizedRows: number;
  missingMappedColumns: string[];
  unmappedRequiredColumns: string[];
  verdict: "passed" | "failed";
  rows: Array<Record<string, string>>;
};

export function normalizeProviderExport(input: {
  kind: RookieSourceKind;
  inputPath: string;
  columnMap: ProviderExportColumnMap;
  outputPath?: string | null;
  apply?: boolean;
}): ProviderExportNormalizeResult {
  if (!existsSync(input.inputPath)) {
    return { inputPath: input.inputPath, outputPath: input.outputPath ?? null, kind: input.kind, dryRun: !input.apply, sourceRows: 0, normalizedRows: 0, missingMappedColumns: [], unmappedRequiredColumns: SOURCE_SCHEMAS[input.kind].columns, verdict: "failed", rows: [] };
  }
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(input.inputPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Provider export parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  const fields = parsed.meta.fields ?? [];
  const mappedInputs = new Set(Object.values(input.columnMap));
  const missingMappedColumns = Array.from(mappedInputs).filter((column) => !fields.includes(column));
  const unmappedRequiredColumns = SOURCE_SCHEMAS[input.kind].columns.filter((column) => !input.columnMap[column]);
  const rows = parsed.data.map((row) => Object.fromEntries(SOURCE_SCHEMAS[input.kind].columns.map((column) => {
    const providerColumn = input.columnMap[column];
    return [column, providerColumn ? String(row[providerColumn] ?? "").trim() : ""];
  })));
  const verdict = missingMappedColumns.length ? "failed" : "passed";
  if (input.apply && verdict === "passed" && input.outputPath) {
    writeFileSync(input.outputPath, serializeCsv(rows, SOURCE_SCHEMAS[input.kind].columns));
  }
  return {
    inputPath: input.inputPath,
    outputPath: input.outputPath ?? null,
    kind: input.kind,
    dryRun: !input.apply,
    sourceRows: parsed.data.length,
    normalizedRows: rows.length,
    missingMappedColumns,
    unmappedRequiredColumns,
    verdict,
    rows,
  };
}

export function defaultImportDirectory(): string {
  return path.join(process.cwd(), "data", "rookies", "sources", "imports");
}
