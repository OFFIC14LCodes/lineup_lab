// H9.1 — historical active weeks, role weeks, and season opportunity totals.
//
// Key definitions:
//   historicalActiveWeeks  = new Set(rows.map(r => r.week)).size
//                            Distinct canonical weekly rows, NOT confirmed NFL games.
//   historicalRoleWeeks    = count of weeks exceeding the position opportunity threshold
//   roleParticipationFactor = historicalRoleWeeks / historicalActiveWeeks (0 if both 0)

import type { WeeklyStatRow, ProjectionPosition } from "./types";
import {
  QB_ROLE_WEEK_MIN_ATTEMPTS,
  QB_ROLE_WEEK_MIN_CARRIES,
  RB_ROLE_WEEK_MIN_CARRIES,
  RB_ROLE_WEEK_MIN_TARGETS,
  WR_ROLE_WEEK_MIN_TARGETS,
  TE_ROLE_WEEK_MIN_TARGETS,
} from "./constants";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type SeasonOpportunityTotals = {
  totalPassAttempts: number;
  totalCarries: number;
  totalTargets: number;
  totalReceptions: number;
  totalPassingYards: number;
  totalRushingYards: number;
  totalReceivingYards: number;
  totalPassingTds: number;
  totalRushingTds: number;
  totalReceivingTds: number;
  totalFumblesLost: number;
  totalFumRetTd: number;
};

export type RoleWeekResult = {
  historicalActiveWeeks: number;
  historicalRoleWeeks: number;
  roleWeekNumbers: number[];
  nonRoleWeekNumbers: number[];
  roleParticipationFactor: number;
  totals: SeasonOpportunityTotals;
};

// --------------------------------------------------------------------------
// Position role-week predicate
// --------------------------------------------------------------------------

function isRoleWeek(row: WeeklyStatRow, position: ProjectionPosition): boolean {
  switch (position) {
    case "QB":
      return row.passAttempts >= QB_ROLE_WEEK_MIN_ATTEMPTS ||
             row.carries >= QB_ROLE_WEEK_MIN_CARRIES;
    case "RB":
      return row.carries >= RB_ROLE_WEEK_MIN_CARRIES ||
             row.targets >= RB_ROLE_WEEK_MIN_TARGETS;
    case "WR":
      return row.targets >= WR_ROLE_WEEK_MIN_TARGETS;
    case "TE":
      return row.targets >= TE_ROLE_WEEK_MIN_TARGETS;
  }
}

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function computeRoleWeeks(
  rows: WeeklyStatRow[],
  position: ProjectionPosition
): RoleWeekResult {
  // Use distinct week numbers — each week counted once even if duplicate rows.
  const weekSet = new Set(rows.map(r => r.week));
  const historicalActiveWeeks = weekSet.size;

  // For role-week determination and totals, include all rows (including duplicates).
  // Callers that care about duplicate rows should handle deduplication before calling.
  const roleWeekSet = new Set<number>();
  const nonRoleWeekSet = new Set<number>();

  const totals: SeasonOpportunityTotals = {
    totalPassAttempts: 0,
    totalCarries: 0,
    totalTargets: 0,
    totalReceptions: 0,
    totalPassingYards: 0,
    totalRushingYards: 0,
    totalReceivingYards: 0,
    totalPassingTds: 0,
    totalRushingTds: 0,
    totalReceivingTds: 0,
    totalFumblesLost: 0,
    totalFumRetTd: 0,
  };

  for (const row of rows) {
    totals.totalPassAttempts += row.passAttempts;
    totals.totalCarries += row.carries;
    totals.totalTargets += row.targets;
    totals.totalReceptions += row.receptions;
    totals.totalPassingYards += row.passingYards;
    totals.totalRushingYards += row.rushingYards;
    totals.totalReceivingYards += row.receivingYards;
    totals.totalPassingTds += row.passingTds;
    totals.totalRushingTds += row.rushingTds;
    totals.totalReceivingTds += row.receivingTds;
    totals.totalFumblesLost += row.fumblesLost;
    totals.totalFumRetTd += row.fumRetTd;

    if (isRoleWeek(row, position)) {
      roleWeekSet.add(row.week);
    } else {
      // Only classify as non-role if not already classified as role.
      // (Duplicate rows for same week could split; we prefer role.)
      if (!roleWeekSet.has(row.week)) {
        nonRoleWeekSet.add(row.week);
      }
    }
  }

  // Weeks classified as role supersede non-role classification.
  for (const w of roleWeekSet) nonRoleWeekSet.delete(w);

  const historicalRoleWeeks = roleWeekSet.size;
  const roleParticipationFactor =
    historicalActiveWeeks > 0 ? historicalRoleWeeks / historicalActiveWeeks : 0;

  return {
    historicalActiveWeeks,
    historicalRoleWeeks,
    roleWeekNumbers: [...roleWeekSet].sort((a, b) => a - b),
    nonRoleWeekNumbers: [...nonRoleWeekSet].sort((a, b) => a - b),
    roleParticipationFactor,
    totals,
  };
}
