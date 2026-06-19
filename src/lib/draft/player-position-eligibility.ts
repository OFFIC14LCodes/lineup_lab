import { normalizeDraftEligiblePosition } from "./league-position-eligibility";
import type { PositionGroup } from "./roster-slots";

export type PlayerPositionEligibility = {
  primaryPosition: PositionGroup | null;
  rawEligiblePositions: PositionGroup[];
  displayPositions: PositionGroup[];
  filterPositions: PositionGroup[];
  rosterFitPositions: PositionGroup[];
  valueModelPositions: PositionGroup[];
  displayPosition: string;
  positionBadges: string[];
  eligibilityClass:
    | "single_position"
    | "trusted_idp_multi_position"
    | "travis_hunter_wr_db"
    | "suppressed_unsupported_combo"
    | "invalid_cross_family_combo"
    | "unknown_multi_position";
  eligibilityWarnings: string[];
  eligiblePositions: PositionGroup[];
};

export type PlayerPositionEligibilityLike = {
  player_name?: string | null;
  playerName?: string | null;
  fullName?: string | null;
  full_name?: string | null;
  position?: string | null;
  fantasyPositions?: string[] | null;
  fantasy_positions?: string[] | null;
  fantasy_positions_json?: string[] | null;
  eligiblePositions?: string[] | null;
  eligible_positions?: string[] | null;
  eligible_positions_json?: string[] | null;
};

export function buildPlayerPositionEligibility(player: PlayerPositionEligibilityLike): PlayerPositionEligibility {
  const primaryPosition = normalizeDraftEligiblePosition(player.position);
  const candidates = [
    ...(primaryPosition ? [primaryPosition] : []),
    ...positionArray(player.fantasyPositions),
    ...positionArray(player.fantasy_positions),
    ...positionArray(player.fantasy_positions_json),
    ...positionArray(player.eligiblePositions),
    ...positionArray(player.eligible_positions),
    ...positionArray(player.eligible_positions_json),
  ];
  const rawEligiblePositions = uniquePositions(candidates);
  const classified = classifyEligibility(player, primaryPosition, rawEligiblePositions);
  const badges = classified.displayPositions.length ? classified.displayPositions : primaryPosition ? [primaryPosition] : [];
  return {
    primaryPosition,
    rawEligiblePositions,
    displayPositions: classified.displayPositions,
    filterPositions: classified.filterPositions,
    rosterFitPositions: classified.rosterFitPositions,
    valueModelPositions: classified.valueModelPositions,
    displayPosition: badges.join("/") || player.position?.trim().toUpperCase() || "UNK",
    positionBadges: badges,
    eligibilityClass: classified.eligibilityClass,
    eligibilityWarnings: classified.eligibilityWarnings,
    eligiblePositions: classified.rosterFitPositions,
  };
}

export function playerIsEligibleForPosition(player: PlayerPositionEligibilityLike, position: string): boolean {
  const normalized = normalizeDraftEligiblePosition(position);
  if (!normalized) return false;
  return buildPlayerPositionEligibility(player).rosterFitPositions.includes(normalized);
}

function positionArray(values: string[] | null | undefined): PositionGroup[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeDraftEligiblePosition(value))
    .filter((value): value is PositionGroup => Boolean(value));
}

function uniquePositions(values: Array<PositionGroup | null>): PositionGroup[] {
  const seen = new Set<PositionGroup>();
  const result: PositionGroup[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function classifyEligibility(
  player: PlayerPositionEligibilityLike,
  primaryPosition: PositionGroup | null,
  rawEligiblePositions: PositionGroup[]
): Omit<PlayerPositionEligibility, "primaryPosition" | "rawEligiblePositions" | "displayPosition" | "positionBadges" | "eligiblePositions"> {
  const primaryOnly = primaryPosition ? [primaryPosition] : [];
  if (!primaryPosition || rawEligiblePositions.length <= 1) {
    const positions = rawEligiblePositions.length ? rawEligiblePositions : primaryOnly;
    return {
      displayPositions: positions,
      filterPositions: positions,
      rosterFitPositions: positions,
      valueModelPositions: positions,
      eligibilityClass: "single_position",
      eligibilityWarnings: [],
    };
  }

  if (isTravisHunterWrDb(player, rawEligiblePositions)) {
    return trusted("travis_hunter_wr_db", orderWithPrimary(rawEligiblePositions, primaryPosition));
  }

  if (rawEligiblePositions.some((position) => position === "K" || position === "DEF")) {
    return suppressed("invalid_cross_family_combo", primaryOnly, "suppressed unsupported Sleeper multi-position combo");
  }

  const allIdp = rawEligiblePositions.every((position) => positionFamily(position) === "idp");
  if (allIdp) {
    const positions = orderWithPrimary(rawEligiblePositions, primaryPosition);
    if (isTrustedIdpCombo(positions)) return trusted("trusted_idp_multi_position", positions);
    return suppressed("unknown_multi_position", primaryOnly, "suppressed unsupported Sleeper multi-position combo");
  }

  const allOffense = rawEligiblePositions.every((position) => positionFamily(position) === "offense");
  if (allOffense) {
    return suppressed("suppressed_unsupported_combo", primaryOnly, "suppressed unsupported Sleeper multi-position combo");
  }

  return suppressed("invalid_cross_family_combo", primaryOnly, "suppressed unsupported Sleeper multi-position combo");
}

function trusted(
  eligibilityClass: PlayerPositionEligibility["eligibilityClass"],
  positions: PositionGroup[]
): Omit<PlayerPositionEligibility, "primaryPosition" | "rawEligiblePositions" | "displayPosition" | "positionBadges" | "eligiblePositions"> {
  return {
    displayPositions: positions,
    filterPositions: positions,
    rosterFitPositions: positions,
    valueModelPositions: positions,
    eligibilityClass,
    eligibilityWarnings: [],
  };
}

function suppressed(
  eligibilityClass: PlayerPositionEligibility["eligibilityClass"],
  positions: PositionGroup[],
  warning: string
): Omit<PlayerPositionEligibility, "primaryPosition" | "rawEligiblePositions" | "displayPosition" | "positionBadges" | "eligiblePositions"> {
  return {
    displayPositions: positions,
    filterPositions: positions,
    rosterFitPositions: positions,
    valueModelPositions: positions,
    eligibilityClass,
    eligibilityWarnings: [warning],
  };
}

function positionFamily(position: PositionGroup): "offense" | "idp" | "special" {
  if (position === "DL" || position === "LB" || position === "DB") return "idp";
  if (position === "K" || position === "DEF") return "special";
  return "offense";
}

function isTrustedIdpCombo(positions: PositionGroup[]): boolean {
  if (positions.length !== 2) return false;
  const combo = positions.join("/");
  return combo === "LB/DL" || combo === "DL/LB" || combo === "LB/DB" || combo === "DB/LB" || combo === "DL/DB" || combo === "DB/DL";
}

function isTravisHunterWrDb(player: PlayerPositionEligibilityLike, positions: PositionGroup[]): boolean {
  const name = (player.player_name ?? player.playerName ?? player.fullName ?? player.full_name ?? "").trim().toLowerCase();
  return name === "travis hunter" && positions.length === 2 && positions.includes("WR") && positions.includes("DB");
}

function orderWithPrimary(positions: PositionGroup[], primaryPosition: PositionGroup): PositionGroup[] {
  return uniquePositions([primaryPosition, ...positions]);
}
