import type { SleeperPlayer } from "@/lib/sleeper/types";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

const POSITION_MAP: Record<string, "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "DL" | "LB" | "DB"> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  PK: "K",
  DEF: "DEF",
  DST: "DEF",
  "D/ST": "DEF",
  DL: "DL",
  DE: "DL",
  DT: "DL",
  EDGE: "DL",
  NT: "DL",
  LB: "LB",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  DB: "DB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB"
};

export type NormalizedFantasyPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "DL" | "LB" | "DB";
export type SideOfBall = "offense" | "defense" | "special_teams" | "team_defense";

export function normalizePlayerName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''.]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ").filter(Boolean);
  while (parts.length > 1 && SUFFIXES.has(parts.at(-1) ?? "")) {
    parts.pop();
  }

  return parts.join(" ");
}

export function normalizeTeam(team?: string | null) {
  const value = team?.trim().toUpperCase();
  if (!value || value === "FA" || value === "NONE" || value === "null") {
    return null;
  }
  return value === "JAC" ? "JAX" : value;
}

export function normalizePrimaryPosition(position?: string | null): NormalizedFantasyPosition | null {
  const value = position?.trim().toUpperCase();
  if (!value) return null;
  return POSITION_MAP[value] ?? null;
}

export function normalizePositionGroup(position?: string | null): NormalizedFantasyPosition | null {
  return normalizePrimaryPosition(position);
}

export function classifySideOfBall(position?: string | null): SideOfBall | null {
  const normalized = normalizePrimaryPosition(position);
  if (!normalized) return null;
  if (["QB", "RB", "WR", "TE"].includes(normalized)) return "offense";
  if (normalized === "K") return "special_teams";
  if (normalized === "DEF") return "team_defense";
  if (["DL", "LB", "DB"].includes(normalized)) return "defense";
  return null;
}

export function normalizeEligiblePositions(positions: Array<string | null | undefined>): NormalizedFantasyPosition[] {
  const normalized = positions
    .map((position) => normalizePrimaryPosition(position))
    .filter((position): position is NormalizedFantasyPosition => Boolean(position));

  return Array.from(new Set(normalized));
}

export function normalizePosition(position?: string | null) {
  return normalizePrimaryPosition(position);
}

export function buildPlayerSearchName(player: Pick<SleeperPlayer, "full_name" | "first_name" | "last_name">) {
  const fullName = player.full_name?.trim();
  if (fullName) return normalizePlayerName(fullName);
  return normalizePlayerName([player.first_name, player.last_name].filter(Boolean).join(" "));
}

export function displayPlayerName(player: Pick<SleeperPlayer, "full_name" | "first_name" | "last_name">) {
  return player.full_name?.trim() || [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
}
