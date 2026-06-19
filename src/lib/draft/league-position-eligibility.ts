import {
  buildNormalizedRosterRequirements,
  POSITION_GROUPS,
  type NormalizedRosterRequirements,
  type PositionGroup,
} from "@/lib/draft/roster-slots";

export type LeaguePositionEligibilityInput =
  | { rosterPositions: string[] | null | undefined; rosterRequirements?: never }
  | { rosterRequirements: NormalizedRosterRequirements; rosterPositions?: never };

const POSITION_ALIASES: Record<string, PositionGroup | null> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DEF",
  DST: "DEF",
  "D/ST": "DEF",
  DL: "DL",
  DE: "DL",
  DT: "DL",
  EDGE: "DL",
  LB: "LB",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  DB: "DB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
};

export function buildEligibleDraftPositions(input: LeaguePositionEligibilityInput): Set<PositionGroup> {
  const requirements: NormalizedRosterRequirements =
    "rosterRequirements" in input && input.rosterRequirements
      ? input.rosterRequirements
      : buildNormalizedRosterRequirements(input.rosterPositions);
  const eligible = new Set<PositionGroup>();

  for (const position of POSITION_GROUPS) {
    if (requirements.directStarters[position] > 0) eligible.add(position);
  }
  if (requirements.offensiveFlexCount > 0) {
    eligible.add("RB");
    eligible.add("WR");
    eligible.add("TE");
  }
  if (requirements.superflexCount > 0) {
    eligible.add("QB");
    eligible.add("RB");
    eligible.add("WR");
    eligible.add("TE");
  }
  if (requirements.idpFlexCount > 0) {
    eligible.add("DL");
    eligible.add("LB");
    eligible.add("DB");
  }

  return eligible;
}

export function normalizeDraftEligiblePosition(position: string | null | undefined): PositionGroup | null {
  const normalized = position?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";
  return POSITION_ALIASES[normalized] ?? null;
}

export function isPositionDraftEligible(
  position: string | null | undefined,
  input: LeaguePositionEligibilityInput,
): boolean {
  const normalized = normalizeDraftEligiblePosition(position);
  if (!normalized) return false;
  return buildEligibleDraftPositions(input).has(normalized);
}

export function filterDraftEligiblePlayers<T extends { position?: string | null }>(
  players: T[],
  input: LeaguePositionEligibilityInput,
): { players: T[]; filteredPositions: string[]; filteredCount: number } {
  const eligible = buildEligibleDraftPositions(input);
  const filteredPositions = new Set<string>();
  const filteredPlayers = players.filter((player) => {
    const position = normalizeDraftEligiblePosition(player.position);
    if (position && eligible.has(position)) return true;
    if (position) filteredPositions.add(position);
    return false;
  });

  return {
    players: filteredPlayers,
    filteredPositions: [...filteredPositions].sort(),
    filteredCount: players.length - filteredPlayers.length,
  };
}
