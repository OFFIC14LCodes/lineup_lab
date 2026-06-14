import { NFL_TEAM_IDS } from "@/lib/providers/nflverse/teams/registry";

export type StoredTeamGameRow = {
  game_id: string;
  season: number;
  week: number;
  season_type: string;
  team_id: string;
  opponent_id: string | null;
  is_home: boolean;
  points_scored: number | null;
  points_allowed: number | null;
  offensive_yards: number | null;
  yards_allowed: number | null;
  is_final: boolean;
  reconciliation_status: string;
};

export type TeamGameReconciliationViolation = {
  code:
    | "duplicate_natural_key"
    | "missing_opponent"
    | "invalid_team_identity"
    | "negative_value"
    | "fractional_value"
    | "final_status_violation"
    | "rows_per_game_violation"
    | "reciprocal_opponent_mismatch"
    | "points_allowed_mismatch"
    | "yards_allowed_mismatch"
    | "home_away_mismatch";
  gameId: string;
  teamId?: string;
  detail: string;
};

export type TeamGameReconciliationReport = {
  totalRows: number;
  totalDistinctGames: number;
  rowsPerGame: Record<string, number>;
  rowsPerGameDistribution: Record<string, number>;
  duplicateNaturalKeys: number;
  missingOpponents: number;
  reciprocalOpponentMismatches: number;
  pointsAllowedMismatches: number;
  yardsAllowedMismatches: number;
  homeAwayMismatches: number;
  invalidTeamIdentities: number;
  negativeOrFractionalValues: number;
  negativeValues: number;
  fractionalValues: number;
  finalStatusViolations: number;
  reconciliationStatusDistribution: Record<string, number>;
  violations: TeamGameReconciliationViolation[];
};

const NUMERIC_FIELDS = [
  "points_scored",
  "points_allowed",
  "offensive_yards",
  "yards_allowed",
] as const;

export function reconcileStoredTeamGameRows(
  rows: StoredTeamGameRow[],
  validTeamIds: Set<string> = NFL_TEAM_IDS
): TeamGameReconciliationReport {
  const violations: TeamGameReconciliationViolation[] = [];
  const rowsByGame = new Map<string, StoredTeamGameRow[]>();
  const naturalKeys = new Set<string>();

  let duplicateNaturalKeys = 0;
  let missingOpponents = 0;
  let invalidTeamIdentities = 0;
  let negativeValues = 0;
  let fractionalValues = 0;
  let finalStatusViolations = 0;
  const reconciliationStatusDistribution: Record<string, number> = {};

  for (const row of rows) {
    rowsByGame.set(row.game_id, [...(rowsByGame.get(row.game_id) ?? []), row]);
    reconciliationStatusDistribution[row.reconciliation_status] =
      (reconciliationStatusDistribution[row.reconciliation_status] ?? 0) + 1;

    const naturalKey = `${row.game_id}|${row.team_id}`;
    if (naturalKeys.has(naturalKey)) {
      duplicateNaturalKeys += 1;
      violations.push({
        code: "duplicate_natural_key",
        gameId: row.game_id,
        teamId: row.team_id,
        detail: `Duplicate team_game_stats natural key ${naturalKey}.`,
      });
    }
    naturalKeys.add(naturalKey);

    if (!row.opponent_id) {
      missingOpponents += 1;
      violations.push({
        code: "missing_opponent",
        gameId: row.game_id,
        teamId: row.team_id,
        detail: "opponent_id is missing.",
      });
    }

    for (const teamField of ["team_id", "opponent_id"] as const) {
      const teamId = row[teamField];
      if (!teamId || !validTeamIds.has(teamId)) {
        invalidTeamIdentities += 1;
        violations.push({
          code: "invalid_team_identity",
          gameId: row.game_id,
          teamId: row.team_id,
          detail: `${teamField}=${teamId ?? "null"} is not a valid NFL team id.`,
        });
      }
    }

    for (const field of NUMERIC_FIELDS) {
      const value = row[field];
      if (value === null) continue;
      if (value < 0) {
        negativeValues += 1;
        violations.push({
          code: "negative_value",
          gameId: row.game_id,
          teamId: row.team_id,
          detail: `${field}=${value} is negative.`,
        });
      }
      if (!Number.isInteger(value)) {
        fractionalValues += 1;
        violations.push({
          code: "fractional_value",
          gameId: row.game_id,
          teamId: row.team_id,
          detail: `${field}=${value} is fractional.`,
        });
      }
    }

    if (!row.is_final) {
      finalStatusViolations += 1;
      violations.push({
        code: "final_status_violation",
        gameId: row.game_id,
        teamId: row.team_id,
        detail: "Completed regular-season import row is not marked final.",
      });
    }
  }

  let reciprocalOpponentMismatches = 0;
  let pointsAllowedMismatches = 0;
  let yardsAllowedMismatches = 0;
  let homeAwayMismatches = 0;
  const rowsPerGame: Record<string, number> = {};
  const rowsPerGameDistribution: Record<string, number> = {};

  for (const [gameId, gameRows] of rowsByGame) {
    rowsPerGame[gameId] = gameRows.length;
    rowsPerGameDistribution[String(gameRows.length)] = (rowsPerGameDistribution[String(gameRows.length)] ?? 0) + 1;

    if (gameRows.length !== 2) {
      violations.push({
        code: "rows_per_game_violation",
        gameId,
        detail: `Expected exactly two team-game rows; found ${gameRows.length}.`,
      });
      continue;
    }

    const [a, b] = gameRows;
    if (!a || !b) continue;

    if (a.opponent_id !== b.team_id || b.opponent_id !== a.team_id) {
      reciprocalOpponentMismatches += 1;
      violations.push({
        code: "reciprocal_opponent_mismatch",
        gameId,
        detail: `${a.team_id}.opponent_id=${a.opponent_id}; ${b.team_id}.opponent_id=${b.opponent_id}.`,
      });
    }

    if (a.points_allowed !== b.points_scored || b.points_allowed !== a.points_scored) {
      pointsAllowedMismatches += 1;
      violations.push({
        code: "points_allowed_mismatch",
        gameId,
        detail: `${a.team_id} PA=${a.points_allowed}, ${b.team_id} PS=${b.points_scored}; ${b.team_id} PA=${b.points_allowed}, ${a.team_id} PS=${a.points_scored}.`,
      });
    }

    if (a.yards_allowed !== b.offensive_yards || b.yards_allowed !== a.offensive_yards) {
      yardsAllowedMismatches += 1;
      violations.push({
        code: "yards_allowed_mismatch",
        gameId,
        detail: `${a.team_id} YA=${a.yards_allowed}, ${b.team_id} OY=${b.offensive_yards}; ${b.team_id} YA=${b.yards_allowed}, ${a.team_id} OY=${a.offensive_yards}.`,
      });
    }

    const homeCount = gameRows.filter((row) => row.is_home).length;
    const awayCount = gameRows.length - homeCount;
    if (homeCount !== 1 || awayCount !== 1) {
      homeAwayMismatches += 1;
      violations.push({
        code: "home_away_mismatch",
        gameId,
        detail: `Expected one home and one away row; found home=${homeCount}, away=${awayCount}.`,
      });
    }
  }

  return {
    totalRows: rows.length,
    totalDistinctGames: rowsByGame.size,
    rowsPerGame,
    rowsPerGameDistribution,
    duplicateNaturalKeys,
    missingOpponents,
    reciprocalOpponentMismatches,
    pointsAllowedMismatches,
    yardsAllowedMismatches,
    homeAwayMismatches,
    invalidTeamIdentities,
    negativeOrFractionalValues: negativeValues + fractionalValues,
    negativeValues,
    fractionalValues,
    finalStatusViolations,
    reconciliationStatusDistribution,
    violations,
  };
}
