import { normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import type { ContextConfidence, CurrentRole, FloorRole, CeilingRole, PaceTendency, Tendency } from "./player-context-types";

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

export function normalizePosition(value: unknown): string {
  return normalizePrimaryPosition(stringValue(value)) ?? stringValue(value)?.toUpperCase() ?? "UNK";
}

export function normalizedTeam(value: unknown): string | null {
  return normalizeTeam(stringValue(value));
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(/[|;]/g).map((item) => item.trim()).filter(Boolean);
}

export function normalizeConfidence(value: unknown): ContextConfidence {
  const normalized = stringValue(value)?.toLowerCase();
  return normalized === "high" || normalized === "medium" || normalized === "low" || normalized === "very_low" ? normalized : "low";
}

export function currentRole(value: unknown): CurrentRole {
  const normalized = stringValue(value)?.toLowerCase();
  return isIn(normalized, ["locked_starter", "probable_starter", "committee", "rotational", "backup", "handcuff", "rookie_unknown", "deep_reserve", "unknown"]) ? normalized : "unknown";
}

export function floorRole(value: unknown): FloorRole {
  const normalized = stringValue(value)?.toLowerCase();
  return isIn(normalized, ["starter", "committee", "rotational", "backup", "inactive", "unknown"]) ? normalized : "unknown";
}

export function ceilingRole(value: unknown): CeilingRole {
  const normalized = stringValue(value)?.toLowerCase();
  return isIn(normalized, ["elite_starter", "starter", "committee_lead", "rotational_plus", "backup", "unknown"]) ? normalized : "unknown";
}

export function tendency(value: unknown): Tendency {
  const normalized = stringValue(value)?.toLowerCase();
  return isIn(normalized, ["low", "neutral", "high", "unknown"]) ? normalized : "unknown";
}

export function paceTendency(value: unknown): PaceTendency {
  const normalized = stringValue(value)?.toLowerCase();
  return isIn(normalized, ["slow", "neutral", "fast", "unknown"]) ? normalized : "unknown";
}

export function shareValue(value: unknown): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

export function bmi(heightInches: number | null, weightPounds: number | null): number | null {
  if (!heightInches || !weightPounds) return null;
  return Math.round((weightPounds / (heightInches * heightInches)) * 703 * 10) / 10;
}

function isIn<T extends string>(value: string | undefined, allowed: readonly T[]): value is T {
  return Boolean(value && (allowed as readonly string[]).includes(value));
}
