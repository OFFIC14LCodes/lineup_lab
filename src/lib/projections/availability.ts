// H9.1 — projected active games and projected role games.
//
// Outputs floor/median/ceiling for each game type.
// Invariants:
//   0 <= floor <= median <= ceiling <= 17
//   roleGames.{floor,median,ceiling} <= activeGames.{floor,median,ceiling}
//
// ESTABLISHED_FULL_SEASON uses fixed constants; all other classes derive
// from historicalActiveWeeks and historicalRoleWeeks with class-specific
// spread widths.

import type { ProjectionConfidenceLabel } from "./types";
import type { RoleSampleClass } from "./types";
import type { RoleWeekResult } from "./role-weeks";
import {
  FULL_SEASON_ACTIVE_GAMES_FLOOR,
  FULL_SEASON_ACTIVE_GAMES_MEDIAN,
  FULL_SEASON_ACTIVE_GAMES_CEILING,
} from "./constants";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type GameRange = {
  floor: number;
  median: number;
  ceiling: number;
};

export type ProjectedAvailability = {
  projectedActiveGames: GameRange;
  projectedRoleGames: GameRange;
  gamesConfidence: ProjectionConfidenceLabel;
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const MAX_GAMES = 17;

function clampToSeason(n: number): number {
  return Math.max(0, Math.min(MAX_GAMES, Math.round(n)));
}

function makeRange(floor: number, median: number, ceiling: number): GameRange {
  const f = clampToSeason(floor);
  const m = clampToSeason(median);
  const c = clampToSeason(ceiling);
  // Enforce ordering after clamping.
  return {
    floor: Math.min(f, m),
    median: Math.min(Math.max(f, m), c),
    ceiling: Math.max(m, c),
  };
}

function constrainRoleToActive(role: GameRange, active: GameRange): GameRange {
  return {
    floor: Math.min(role.floor, active.floor),
    median: Math.min(role.median, active.median),
    ceiling: Math.min(role.ceiling, active.ceiling),
  };
}

const CLASS_GAMES_CONFIDENCE: Record<RoleSampleClass, ProjectionConfidenceLabel> = {
  ESTABLISHED_FULL_SEASON: "high",
  ESTABLISHED_PARTIAL_SEASON: "medium",
  PART_TIME_CONTRIBUTOR: "medium",
  BACKUP_OR_SPOT_STARTER: "low",
  MINIMAL_SAMPLE: "very_low",
  ROLE_UNKNOWN: "very_low",
};

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function computeProjectedAvailability(
  roleSampleClass: RoleSampleClass,
  rw: RoleWeekResult
): ProjectedAvailability {
  const aw = rw.historicalActiveWeeks;
  const rw2 = rw.historicalRoleWeeks;
  const gamesConfidence = CLASS_GAMES_CONFIDENCE[roleSampleClass];

  let activeGames: GameRange;
  let roleGames: GameRange;

  switch (roleSampleClass) {
    case "ESTABLISHED_FULL_SEASON": {
      activeGames = {
        floor: FULL_SEASON_ACTIVE_GAMES_FLOOR,
        median: FULL_SEASON_ACTIVE_GAMES_MEDIAN,
        ceiling: FULL_SEASON_ACTIVE_GAMES_CEILING,
      };
      roleGames = makeRange(aw - 4, aw, aw + 2);
      roleGames = constrainRoleToActive(roleGames, activeGames);
      break;
    }
    case "ESTABLISHED_PARTIAL_SEASON": {
      activeGames = makeRange(aw - 2, aw, aw + 3);
      roleGames = makeRange(rw2 - 2, rw2, rw2 + 3);
      roleGames = constrainRoleToActive(roleGames, activeGames);
      break;
    }
    case "PART_TIME_CONTRIBUTOR": {
      activeGames = makeRange(aw - 3, aw, aw + 4);
      roleGames = makeRange(rw2 - 2, rw2, rw2 + 3);
      roleGames = constrainRoleToActive(roleGames, activeGames);
      break;
    }
    case "BACKUP_OR_SPOT_STARTER": {
      activeGames = makeRange(0, Math.max(aw - 2, 0), aw + 4);
      roleGames = makeRange(0, rw2, rw2 + 4);
      roleGames = constrainRoleToActive(roleGames, activeGames);
      break;
    }
    case "MINIMAL_SAMPLE": {
      activeGames = makeRange(0, aw, aw + 6);
      roleGames = makeRange(0, rw2, rw2 + 3);
      roleGames = constrainRoleToActive(roleGames, activeGames);
      break;
    }
    case "ROLE_UNKNOWN": {
      // Median is 0 — no established role.
      // Ceiling reflects the possibility the player earns a role.
      activeGames = makeRange(0, 0, 10);
      roleGames = makeRange(0, 0, 0);
      break;
    }
  }

  return { projectedActiveGames: activeGames, projectedRoleGames: roleGames, gamesConfidence };
}
