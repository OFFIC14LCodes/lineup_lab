import { existsSync, readFileSync } from "node:fs";
import Papa from "papaparse";

import type { SourceConfidence } from "./data-source-types";

export function readLocalRows(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) return [];
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error(`Local JSON source must be an array: ${filePath}`);
    return parsed as Array<Record<string, unknown>>;
  }
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    throw new Error(`Local CSV source parse failed for ${filePath}: ${parsed.errors.map((error) => error.message).join("; ")}`);
  }
  return parsed.data;
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function sourceConfidence(value: unknown): SourceConfidence {
  const normalized = stringValue(value)?.toLowerCase();
  return normalized === "high" || normalized === "medium" || normalized === "low" ? normalized : "low";
}

export function importedAt(value: unknown): string {
  return stringValue(value) ?? new Date().toISOString();
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(/[|;]/g).map((item) => item.trim()).filter(Boolean);
}

export function hasAny(values: Array<unknown>): boolean {
  return values.some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}
