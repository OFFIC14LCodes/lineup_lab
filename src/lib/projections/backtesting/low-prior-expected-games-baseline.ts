import type { ProjectionBacktestPriorDataGroup } from "./projection-backtest-types";

export type LowPriorExpectedGamesBaselineInput = {
  position: string;
  priorDataGroup: ProjectionBacktestPriorDataGroup;
  cohortLabels: string[];
};

export type LowPriorExpectedGamesBaselineResult = {
  expectedGames: number;
  protocol: "conservative_position_prior";
  basis: "rookie_position_prior" | "second_year_low_prior_position_prior" | "no_prior_stats_position_prior";
  reasons: string[];
};

const ROOKIE_POSITION_GAMES: Record<string, number> = {
  QB: 7,
  RB: 7,
  WR: 7,
  TE: 6,
  K: 10,
  DL: 5,
  LB: 5,
  DB: 5,
};

const SECOND_YEAR_LOW_PRIOR_POSITION_GAMES: Record<string, number> = {
  QB: 5,
  RB: 6,
  WR: 6,
  TE: 5,
  K: 10,
  DL: 5,
  LB: 5,
  DB: 5,
};

const NO_PRIOR_STATS_POSITION_GAMES: Record<string, number> = {
  QB: 2,
  RB: 5,
  WR: 5,
  TE: 5,
  K: 10,
  DL: 4,
  LB: 4,
  DB: 4,
};

export function calculateLowPriorExpectedGamesBaseline(
  input: LowPriorExpectedGamesBaselineInput
): LowPriorExpectedGamesBaselineResult | null {
  const position = input.position.toUpperCase();
  if (!isLowPriorBaselineEligible(input)) return null;

  if (input.priorDataGroup === "rookie") {
    return {
      expectedGames: ROOKIE_POSITION_GAMES[position] ?? 5,
      protocol: "conservative_position_prior",
      basis: "rookie_position_prior",
      reasons: ["Rookie/no-prior rows are evaluated against a conservative position prior, separate from weighted recent PPG."],
    };
  }

  if (input.priorDataGroup === "second_year") {
    return {
      expectedGames: SECOND_YEAR_LOW_PRIOR_POSITION_GAMES[position] ?? 5,
      protocol: "conservative_position_prior",
      basis: "second_year_low_prior_position_prior",
      reasons: ["Second-year low-prior rows use a conservative position prior because weighted recent PPG is not apples-to-apples."],
    };
  }

  if (input.priorDataGroup === "no_prior_stats") {
    return {
      expectedGames: NO_PRIOR_STATS_POSITION_GAMES[position] ?? 4,
      protocol: "conservative_position_prior",
      basis: "no_prior_stats_position_prior",
      reasons: ["No-prior-stat rows use a conservative position prior and are not merged into weighted baseline comparisons."],
    };
  }

  return null;
}

export function isLowPriorBaselineEligible(input: LowPriorExpectedGamesBaselineInput): boolean {
  return input.cohortLabels.includes("low_prior_sample")
    && (input.priorDataGroup === "rookie"
      || input.priorDataGroup === "second_year"
      || input.priorDataGroup === "no_prior_stats");
}
