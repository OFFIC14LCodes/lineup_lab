import type { NormalizedScoringSettings } from "@/lib/scoring/types";

export function normalizeSleeperScoringSettings(raw: Record<string, unknown> | NormalizedScoringSettings): NormalizedScoringSettings {
  if (isNormalizedScoringSettings(raw)) {
    return {
      values: { ...raw.values },
      originalKeys: [...raw.originalKeys],
      ignoredKeys: [...raw.ignoredKeys],
      invalidKeys: raw.invalidKeys.map((entry) => ({ ...entry }))
    };
  }

  const values: Record<string, number> = {};
  const originalKeys: string[] = [];
  const ignoredKeys: string[] = [];
  const invalidKeys: NormalizedScoringSettings["invalidKeys"] = [];

  for (const [rawKey, rawValue] of Object.entries(raw ?? {})) {
    const key = rawKey.trim().toLowerCase();
    if (!key) {
      invalidKeys.push({
        key: rawKey,
        value: rawValue,
        reason: "Scoring key is empty after normalization."
      });
      continue;
    }

    originalKeys.push(key);
    const numericValue = toFiniteNumber(rawValue);
    if (numericValue === null) {
      invalidKeys.push({
        key,
        value: rawValue,
        reason: "Scoring value is not a finite number."
      });
      continue;
    }

    values[key] = numericValue;
    if (numericValue === 0) {
      ignoredKeys.push(key);
    }
  }

  return {
    values,
    originalKeys,
    ignoredKeys,
    invalidKeys
  };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isNormalizedScoringSettings(value: unknown): value is NormalizedScoringSettings {
  return Boolean(
    value &&
      typeof value === "object" &&
      "values" in value &&
      "originalKeys" in value &&
      "ignoredKeys" in value &&
      "invalidKeys" in value
  );
}
