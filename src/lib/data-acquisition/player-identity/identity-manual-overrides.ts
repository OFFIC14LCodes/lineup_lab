import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

export const DEFAULT_IDENTITY_MANUAL_OVERRIDES_PATH = path.join("data", "player-identity", "manual-overrides.csv");

export type IdentityManualOverrideReviewStatus = "approved" | "pending" | "rejected" | "unknown";

export type IdentityManualOverride = {
  sleeperId: string;
  gsisId: string;
  reason: string | null;
  reviewStatus: IdentityManualOverrideReviewStatus;
  sourceRow: number;
};

export type IdentityManualOverrideLoadResult = {
  path: string;
  exists: boolean;
  rows: number;
  approvedRows: number;
  skippedRows: number;
  missingColumns: string[];
  issues: string[];
  approved: IdentityManualOverride[];
  skipped: IdentityManualOverride[];
};

const REQUIRED_COLUMNS = ["sleeper_id", "gsis_id", "reason", "review_status"] as const;

export function loadIdentityManualOverrides(projectRoot = process.cwd(), relativePath = DEFAULT_IDENTITY_MANUAL_OVERRIDES_PATH): IdentityManualOverrideLoadResult {
  const filePath = path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath);
  if (!existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
      rows: 0,
      approvedRows: 0,
      skippedRows: 0,
      missingColumns: REQUIRED_COLUMNS.slice(),
      issues: ["manual override file missing; no overrides applied"],
      approved: [],
      skipped: [],
    };
  }

  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  const fields = parsed.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
  const issues = parsed.errors.map((error) => `CSV parse error: ${error.message}`);
  if (missingColumns.length) issues.push(`missing required columns: ${missingColumns.join(", ")}`);

  const overrides = missingColumns.length ? [] : parsed.data.map((row, index) => normalizeManualOverride(row, index + 2)).filter((row): row is IdentityManualOverride => Boolean(row));
  const approved = overrides.filter((override) => override.reviewStatus === "approved");
  const skipped = overrides.filter((override) => override.reviewStatus !== "approved");

  for (const duplicate of duplicateSleeperOverrides(approved)) {
    issues.push(`duplicate approved sleeper_id override skipped by matcher risk: ${duplicate}`);
  }

  return {
    path: filePath,
    exists: true,
    rows: parsed.data.length,
    approvedRows: approved.length,
    skippedRows: skipped.length,
    missingColumns,
    issues,
    approved,
    skipped,
  };
}

export function buildManualOverrideIndex(overrides: IdentityManualOverride[]): Map<string, IdentityManualOverride[]> {
  const index = new Map<string, IdentityManualOverride[]>();
  for (const override of overrides) {
    index.set(override.sleeperId, [...(index.get(override.sleeperId) ?? []), override]);
  }
  return index;
}

function normalizeManualOverride(row: Record<string, unknown>, sourceRow: number): IdentityManualOverride | null {
  const sleeperId = stringValue(row.sleeper_id);
  const gsisId = stringValue(row.gsis_id);
  if (!sleeperId || !gsisId) return null;
  return {
    sleeperId,
    gsisId,
    reason: stringValue(row.reason),
    reviewStatus: reviewStatus(row.review_status),
    sourceRow,
  };
}

function duplicateSleeperOverrides(overrides: IdentityManualOverride[]): string[] {
  const counts = new Map<string, number>();
  for (const override of overrides) counts.set(override.sleeperId, (counts.get(override.sleeperId) ?? 0) + 1);
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([sleeperId]) => sleeperId);
}

function reviewStatus(value: unknown): IdentityManualOverrideReviewStatus {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === "approved" || normalized === "pending" || normalized === "rejected") return normalized;
  return "unknown";
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
