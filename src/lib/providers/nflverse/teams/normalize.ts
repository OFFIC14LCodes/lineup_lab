import { NFL_TEAM_IDS } from "./registry";

// Provider abbreviation aliases → canonical nflverse team IDs.
// nflverse uses its own canonical abbreviations in schedules and PBP CSVs.
// Other data sources (Sleeper, ESPN, older nflverse releases) may differ.
const TEAM_ALIAS_MAP: Record<string, string> = {
  // Jacksonville: nflverse uses JAX; some old providers use JAC
  JAC: "JAX",
  // Washington: nflverse uses WAS; Sleeper and some sources use WSH
  WSH: "WAS",
  // LA Rams: nflverse uses LA; Sleeper and many sources use LAR
  LAR: "LA",
  // Las Vegas Raiders: nflverse uses LV; historical OAK still appears in old data
  OAK: "LV",
  // San Diego Chargers: historical; now LAC
  SD: "LAC",
  // St. Louis Rams: historical; now LA
  STL: "LA",
};

// Normalize a raw team abbreviation from any provider to its canonical nflverse ID.
// Returns null for free-agent markers, empty strings, or unrecognized values.
export function normalizeNflTeamId(raw: string | null | undefined): string | null {
  const upper = raw?.trim().toUpperCase();
  if (!upper || upper === "FA" || upper === "NONE" || upper === "NULL") return null;

  // Resolve alias first, then check canonical set.
  const resolved = TEAM_ALIAS_MAP[upper] ?? upper;
  return NFL_TEAM_IDS.has(resolved) ? resolved : null;
}

// Strict variant: throws if the value is non-null but unrecognized.
export function requireNflTeamId(raw: string | null | undefined, context?: string): string {
  const result = normalizeNflTeamId(raw);
  if (result === null) {
    throw new Error(
      `Unrecognized NFL team abbreviation: ${JSON.stringify(raw)}${context ? ` (${context})` : ""}`
    );
  }
  return result;
}
