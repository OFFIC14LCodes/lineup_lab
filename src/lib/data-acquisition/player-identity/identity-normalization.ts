import { normalizePlayerName, normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import { nflverseNumber, nflverseString } from "@/lib/data-acquisition/nflverse";
import { normalizeNflversePosition, type BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

import type { PlayerIdentityIds, PlayerIdentityRecord, PlayerIdentitySource } from "./identity-match-types";

export function normalizeIdentityName(name: string | null | undefined): string {
  return normalizePlayerName(name ?? "");
}

export function normalizeIdentityPosition(position: string | null | undefined, fallbackGroup?: string | null): BlackbirdNflversePosition | null {
  return normalizeNflversePosition(position, fallbackGroup) ?? normalizeBlackbirdPosition(position);
}

export function emptyIdentityIds(overrides: Partial<PlayerIdentityIds> = {}): PlayerIdentityIds {
  return {
    blackbirdPlayerId: null,
    sleeperId: null,
    gsisId: null,
    espnId: null,
    pfrId: null,
    nflId: null,
    smartId: null,
    ...overrides,
  };
}

export function makeIdentityRecord(input: {
  source: PlayerIdentitySource;
  playerId?: string | null;
  playerName?: string | null;
  position?: string | null;
  positionGroup?: string | null;
  team?: string | null;
  rookieSeason?: unknown;
  birthDate?: unknown;
  height?: unknown;
  weight?: unknown;
  age?: unknown;
  yearsExperience?: unknown;
  college?: unknown;
  active?: boolean | null;
  status?: unknown;
  searchRank?: unknown;
  ids?: Partial<PlayerIdentityIds>;
  externalIds?: Record<string, string>;
  sourceRefs?: string[];
}): PlayerIdentityRecord | null {
  const playerName = nflverseString(input.playerName);
  const normalizedName = normalizeIdentityName(playerName);
  const position = normalizeIdentityPosition(input.position, input.positionGroup ?? null);
  if (!playerName || !normalizedName) return null;

  const ids = emptyIdentityIds(input.ids);
  const playerId = input.playerId ?? ids.blackbirdPlayerId ?? ids.sleeperId ?? ids.gsisId ?? ids.smartId ?? `${normalizedName}:${position ?? "unknown"}`;

  return {
    source: input.source,
    playerId,
    playerName,
    normalizedName,
    position,
    rawPosition: nflverseString(input.position),
    team: normalizeTeam(nflverseString(input.team)),
    rookieSeason: nflverseNumber(input.rookieSeason),
    birthDate: nflverseString(input.birthDate),
    height: nflverseNumber(input.height),
    weight: nflverseNumber(input.weight),
    age: nflverseNumber(input.age),
    yearsExperience: nflverseNumber(input.yearsExperience),
    college: nflverseString(input.college),
    active: input.active ?? null,
    status: nflverseString(input.status),
    searchRank: nflverseNumber(input.searchRank),
    ids,
    externalIds: input.externalIds ?? {},
    sourceRefs: input.sourceRefs ?? [input.source],
  };
}

export function mergeIdentityRecords(primary: PlayerIdentityRecord, secondary: PlayerIdentityRecord): PlayerIdentityRecord {
  return {
    ...primary,
    team: primary.team ?? secondary.team,
    rookieSeason: primary.rookieSeason ?? secondary.rookieSeason,
    birthDate: primary.birthDate ?? secondary.birthDate,
    height: primary.height ?? secondary.height,
    weight: primary.weight ?? secondary.weight,
    age: primary.age ?? secondary.age,
    yearsExperience: primary.yearsExperience ?? secondary.yearsExperience,
    college: primary.college ?? secondary.college,
    active: primary.active ?? secondary.active,
    status: primary.status ?? secondary.status,
    searchRank: primary.searchRank ?? secondary.searchRank,
    ids: {
      blackbirdPlayerId: primary.ids.blackbirdPlayerId ?? secondary.ids.blackbirdPlayerId,
      sleeperId: primary.ids.sleeperId ?? secondary.ids.sleeperId,
      gsisId: primary.ids.gsisId ?? secondary.ids.gsisId,
      espnId: primary.ids.espnId ?? secondary.ids.espnId,
      pfrId: primary.ids.pfrId ?? secondary.ids.pfrId,
      nflId: primary.ids.nflId ?? secondary.ids.nflId,
      smartId: primary.ids.smartId ?? secondary.ids.smartId,
    },
    externalIds: { ...secondary.externalIds, ...primary.externalIds },
    sourceRefs: Array.from(new Set([...primary.sourceRefs, ...secondary.sourceRefs])),
  };
}

function normalizeBlackbirdPosition(position: string | null | undefined): BlackbirdNflversePosition | null {
  const normalized = normalizePrimaryPosition(position);
  if (normalized === "DEF") return "DST";
  return normalized;
}
