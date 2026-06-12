import Papa from "papaparse";

import { mockAdapter } from "@/lib/providers/adapters/mock-adapter";
import type { AdapterNormalizationResult, AdapterSourceRecord } from "@/lib/providers/adapters/types";
import type { ImportPreviewRequest, ParsedImportPayload, ParsedImportRecord } from "@/lib/providers/import/types";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "@/lib/providers/import/constants";
import { ProviderRepositoryValidationError } from "@/lib/providers/repositories/shared";

const SUPPORTED_JSON_MIME_TYPES = new Set(["application/json", "text/json"]);
const SUPPORTED_CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);

export function parseImportPayload(request: ImportPreviewRequest): ParsedImportPayload {
  validateImportRequest(request);

  const parser = detectParser(request);
  const parsedRecords = parser === "json" ? parseJsonRecords(request.fileContent) : parseCsvRecords(request.fileContent);

  if (parsedRecords.length > MAX_IMPORT_ROWS) {
    throw new ProviderRepositoryValidationError(`Parsed row count exceeds maximum of ${MAX_IMPORT_ROWS}.`);
  }

  return {
    datasetKind: request.datasetKind,
    provider: request.provider,
    records: parsedRecords,
    sourceWarnings: []
  };
}

export function normalizeImportRecords(parsed: ParsedImportPayload): AdapterNormalizationResult<AdapterSourceRecord[]> {
  switch (parsed.datasetKind) {
    case "weekly_stats":
      return runNormalization("weekly_stats", parsed.records);
    case "season_stats":
      return runNormalization("season_stats", parsed.records);
    case "projection":
      return runNormalization("projection", parsed.records);
    case "injury":
      return runNormalization("injury", parsed.records);
  }
}

function validateImportRequest(request: ImportPreviewRequest) {
  const bytes = Buffer.byteLength(request.fileContent ?? "", "utf8");
  if (!request.filename.trim()) {
    throw new ProviderRepositoryValidationError("filename is required.");
  }
  if (!request.fileContent.trim()) {
    throw new ProviderRepositoryValidationError("Uploaded file is empty.");
  }
  if (bytes > MAX_IMPORT_FILE_BYTES) {
    throw new ProviderRepositoryValidationError(`Uploaded file exceeds ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB.`);
  }
}

function detectParser(request: ImportPreviewRequest) {
  const mime = request.fileMimeType?.toLowerCase() ?? null;
  const filename = request.filename.toLowerCase();
  const trimmed = request.fileContent.trim();

  if (mime && SUPPORTED_JSON_MIME_TYPES.has(mime)) return "json" as const;
  if (mime && SUPPORTED_CSV_MIME_TYPES.has(mime)) return "csv" as const;
  if (filename.endsWith(".json")) return "json" as const;
  if (filename.endsWith(".csv")) return "csv" as const;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json" as const;
  return "csv" as const;
}

function parseJsonRecords(fileContent: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new ProviderRepositoryValidationError("Invalid JSON file.");
  }

  const rawRecords = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown[] }).records)
      ? (parsed as { records: unknown[] }).records
      : [parsed];

  return rawRecords.map((record, index) => normalizeParsedRecord(record, index + 1));
}

function parseCsvRecords(fileContent: string) {
  const result = Papa.parse<Record<string, unknown>>(fileContent, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    transformHeader(header) {
      return header.trim();
    }
  });

  if (result.errors.length > 0) {
    throw new ProviderRepositoryValidationError(`Invalid CSV file: ${result.errors[0]?.message ?? "parse error"}.`);
  }

  return (result.data ?? []).map((record, index) => normalizeParsedRecord(transformCsvRecord(record), index + 2));
}

function normalizeParsedRecord(record: unknown, sourceRowNumber: number): ParsedImportRecord {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new ProviderRepositoryValidationError(`Row ${sourceRowNumber} must be an object.`);
  }

  const baseRecord = { ...(record as Record<string, unknown>) };
  if (!baseRecord.sourceRecordId && !baseRecord.source_record_id) {
    baseRecord.sourceRecordId = `row-${sourceRowNumber}`;
  }

  return {
    ...baseRecord,
    _sourceRowNumber: sourceRowNumber
  };
}

function transformCsvRecord(record: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  const stats: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;

    if (trimmedKey.startsWith("stat_")) {
      stats[trimmedKey.slice(5)] = value;
      continue;
    }

    if (trimmedKey.startsWith("meta_")) {
      metadata[trimmedKey.slice(5)] = value;
      continue;
    }

    if (trimmedKey === "stats_json" && typeof value === "string" && value.trim()) {
      normalized.stats = parseEmbeddedJson(value, "stats_json");
      continue;
    }

    if (trimmedKey === "metadata_json" && typeof value === "string" && value.trim()) {
      normalized.metadata = parseEmbeddedJson(value, "metadata_json");
      continue;
    }

    normalized[trimmedKey] = value;
  }

  if (Object.keys(stats).length > 0) {
    normalized.stats = { ...(asObject(normalized.stats) ?? {}), ...stats };
  }

  if (Object.keys(metadata).length > 0) {
    normalized.metadata = { ...(asObject(normalized.metadata) ?? {}), ...metadata };
  }

  return normalized;
}

function parseEmbeddedJson(value: string, fieldName: string) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ProviderRepositoryValidationError(`${fieldName} must contain a JSON object.`);
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function runNormalization(datasetKind: ImportPreviewRequest["datasetKind"], records: ParsedImportRecord[]) {
  const normalizer =
    datasetKind === "weekly_stats"
      ? mockAdapter.normalizeWeeklyStats
      : datasetKind === "season_stats"
        ? mockAdapter.normalizeSeasonStats
        : datasetKind === "projection"
          ? mockAdapter.normalizeProjections
          : mockAdapter.normalizeInjuries;

  if (!normalizer) {
    throw new ProviderRepositoryValidationError(`Manual adapter does not support ${datasetKind}.`);
  }

  const result = normalizer(records);
  if ("supported" in result && result.supported === false) {
    throw new ProviderRepositoryValidationError(result.message);
  }

  return result as AdapterNormalizationResult<AdapterSourceRecord[]>;
}
