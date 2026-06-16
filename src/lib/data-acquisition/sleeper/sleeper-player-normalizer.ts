import { normalizeTeam } from "@/lib/players/normalize";
import { normalizeNflversePosition, type BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

import type { SleeperNormalizedPlayer, SleeperRawPlayer } from "./sleeper-player-types";

const EXTERNAL_ID_KEYS = [
  "gsis_id",
  "espn_id",
  "pfr_id",
  "nfl_id",
  "smart_id",
  "yahoo_id",
  "rotowire_id",
  "sportradar_id",
  "stats_id",
  "fantasy_data_id",
  "pff_id",
  "swish_id",
  "oddsjam_id",
];

export function normalizeSleeperPlayer(raw: SleeperRawPlayer): SleeperNormalizedPlayer | null {
  const sleeperId = stringValue(raw.player_id);
  const playerName = stringValue(raw.full_name) ?? [raw.first_name, raw.last_name].map(stringValue).filter(Boolean).join(" ").trim();
  if (!sleeperId || !playerName) return null;

  const rawFantasyPositions = Array.isArray(raw.fantasy_positions) ? raw.fantasy_positions : [];
  const fantasyPositions = uniquePositions(rawFantasyPositions.map((position) => normalizeSleeperPosition(position)));
  const position = normalizeSleeperPosition(stringValue(raw.position)) ?? fantasyPositions[0] ?? null;

  return {
    sleeperId,
    playerName,
    firstName: stringValue(raw.first_name),
    lastName: stringValue(raw.last_name),
    searchFullName: stringValue(raw.search_full_name),
    position,
    rawPosition: stringValue(raw.position),
    fantasyPositions,
    team: normalizeTeam(stringValue(raw.team)),
    status: stringValue(raw.status),
    active: raw.active === true,
    age: numberValue(raw.age),
    birthDate: stringValue(raw.birth_date),
    height: heightValue(raw.height),
    weight: numberValue(raw.weight),
    college: stringValue(raw.college),
    yearsExperience: numberValue(raw.years_exp),
    injuryStatus: stringValue(raw.injury_status),
    searchRank: numberValue(raw.search_rank),
    externalIds: extractExternalIds(raw),
  };
}

export function normalizeSleeperPlayers(rawPlayers: SleeperRawPlayer[]): SleeperNormalizedPlayer[] {
  return rawPlayers.map(normalizeSleeperPlayer).filter((player): player is SleeperNormalizedPlayer => Boolean(player));
}

export function isSleeperFantasyRelevant(player: SleeperNormalizedPlayer): boolean {
  return Boolean(player.position && ["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"].includes(player.position));
}

export function normalizeSleeperPosition(position: string | null | undefined): BlackbirdNflversePosition | null {
  return normalizeNflversePosition(position, null);
}

function extractExternalIds(raw: SleeperRawPlayer): Record<string, string> {
  const externalIds: Record<string, string> = {};
  for (const key of EXTERNAL_ID_KEYS) {
    const value = stringValue(raw[key]);
    if (value) externalIds[key] = value;
  }
  const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  for (const key of EXTERNAL_ID_KEYS) {
    const value = stringValue(metadata[key]);
    if (value) externalIds[key] = value;
  }
  return externalIds;
}

function uniquePositions(values: Array<BlackbirdNflversePosition | null>): BlackbirdNflversePosition[] {
  return Array.from(new Set(values.filter((value): value is BlackbirdNflversePosition => Boolean(value))));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function heightValue(value: unknown): number | null {
  const numeric = numberValue(value);
  if (numeric !== null) return numeric;
  const raw = stringValue(value);
  if (!raw) return null;
  const match = raw.match(/^(\d+)[-'](\d+)/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]);
}
