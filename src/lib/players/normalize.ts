import type { SleeperPlayer } from "@/lib/sleeper/types";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF", "DST", "DL", "LB", "DB"]);

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

export function normalizePosition(position?: string | null) {
  const value = position?.trim().toUpperCase();
  if (!value) return null;
  if (value === "PK") return "K";
  if (value === "D/ST") return "DEF";
  return VALID_POSITIONS.has(value) ? value : value;
}

export function buildPlayerSearchName(player: Pick<SleeperPlayer, "full_name" | "first_name" | "last_name">) {
  const fullName = player.full_name?.trim();
  if (fullName) return normalizePlayerName(fullName);
  return normalizePlayerName([player.first_name, player.last_name].filter(Boolean).join(" "));
}

export function displayPlayerName(player: Pick<SleeperPlayer, "full_name" | "first_name" | "last_name">) {
  return player.full_name?.trim() || [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
}
