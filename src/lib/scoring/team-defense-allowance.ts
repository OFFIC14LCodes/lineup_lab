import { scoreFantasyStats } from "@/lib/scoring/score-player";
import type {
  FantasyScoringResult,
  NormalizedScoringSettings,
  ScoringWarning,
} from "@/lib/scoring/types";

export const POINTS_ALLOWED_BUCKETS = [
  { key: "pts_allow_0", min: 0, max: 0 },
  { key: "pts_allow_1_6", min: 1, max: 6 },
  { key: "pts_allow_7_13", min: 7, max: 13 },
  { key: "pts_allow_14_20", min: 14, max: 20 },
  { key: "pts_allow_21_27", min: 21, max: 27 },
  { key: "pts_allow_28_34", min: 28, max: 34 },
  { key: "pts_allow_35p", min: 35, max: Number.POSITIVE_INFINITY },
] as const;

export const YARDS_ALLOWED_BUCKETS = [
  { key: "yds_allow_0_100", min: 0, max: 100 },
  { key: "yds_allow_101_199", min: 101, max: 199 },
  { key: "yds_allow_200_299", min: 200, max: 299 },
  { key: "yds_allow_300_349", min: 300, max: 349 },
  { key: "yds_allow_350_399", min: 350, max: 399 },
  { key: "yds_allow_400_449", min: 400, max: 449 },
  { key: "yds_allow_450_499", min: 450, max: 499 },
  { key: "yds_allow_500_549", min: 500, max: 549 },
  { key: "yds_allow_550p", min: 550, max: Number.POSITIVE_INFINITY },
] as const;

export type PointsAllowedBucketKey = (typeof POINTS_ALLOWED_BUCKETS)[number]["key"];
export type YardsAllowedBucketKey = (typeof YARDS_ALLOWED_BUCKETS)[number]["key"];

export type TeamDefenseAllowanceInput = {
  season: number;
  week: number;
  gameId: string;
  teamId: string;
  opponentTeamId: string;
  pointsAllowed: number | null;
  yardsAllowed: number | null;
  sourceCompleteness: "complete" | "partial" | "missing";
  reconciliationStatus: "verified" | "pending" | "conflict" | "incomplete";
};

export type TeamDefenseAllowanceStats = {
  pts_allow: number;
  yds_allow: number;
};

export type TeamDefenseAllowanceScoringResult =
  | {
      ok: true;
      input: TeamDefenseAllowanceInput;
      stats: TeamDefenseAllowanceStats;
      selectedPointsBucket: PointsAllowedBucketKey;
      selectedYardsBucket: YardsAllowedBucketKey;
      result: FantasyScoringResult;
      warnings: ScoringWarning[];
    }
  | {
      ok: false;
      input: TeamDefenseAllowanceInput;
      warnings: ScoringWarning[];
    };

export function selectPointsAllowedBucket(value: number): PointsAllowedBucketKey {
  assertValidAllowanceValue(value, "pts_allow");
  const bucket = POINTS_ALLOWED_BUCKETS.find((entry) => value >= entry.min && value <= entry.max);
  if (!bucket) throw new Error(`No points-allowed bucket matched value ${value}.`);
  return bucket.key;
}

export function selectYardsAllowedBucket(value: number): YardsAllowedBucketKey {
  assertValidAllowanceValue(value, "yds_allow");
  const bucket = YARDS_ALLOWED_BUCKETS.find((entry) => value >= entry.min && value <= entry.max);
  if (!bucket) throw new Error(`No yards-allowed bucket matched value ${value}.`);
  return bucket.key;
}

export function buildTeamDefenseAllowanceStats(input: TeamDefenseAllowanceInput):
  | { ok: true; stats: TeamDefenseAllowanceStats; warnings: ScoringWarning[] }
  | { ok: false; warnings: ScoringWarning[] } {
  const warnings = validateTeamDefenseAllowanceInput(input);
  if (warnings.length > 0) return { ok: false, warnings };

  return {
    ok: true,
    stats: {
      pts_allow: input.pointsAllowed ?? 0,
      yds_allow: input.yardsAllowed ?? 0,
    },
    warnings: [],
  };
}

export function scoreTeamDefenseAllowance(
  input: TeamDefenseAllowanceInput,
  scoringSettings: NormalizedScoringSettings | Record<string, unknown>
): TeamDefenseAllowanceScoringResult {
  const statsResult = buildTeamDefenseAllowanceStats(input);
  if (!statsResult.ok) {
    return { ok: false, input, warnings: statsResult.warnings };
  }

  const selectedPointsBucket = selectPointsAllowedBucket(statsResult.stats.pts_allow);
  const selectedYardsBucket = selectYardsAllowedBucket(statsResult.stats.yds_allow);
  const result = scoreFantasyStats({
    stats: statsResult.stats,
    scoringSettings,
    positionGroup: "DEF",
    statSource: "actual",
    context: {
      season: input.season,
      week: input.week,
    },
  });

  return {
    ok: true,
    input,
    stats: statsResult.stats,
    selectedPointsBucket,
    selectedYardsBucket,
    result,
    warnings: result.warnings,
  };
}

function validateTeamDefenseAllowanceInput(input: TeamDefenseAllowanceInput): ScoringWarning[] {
  const warnings: ScoringWarning[] = [];

  if (!input.teamId || !input.opponentTeamId) {
    warnings.push({
      code: "TEAM_CONTEXT_MISSING",
      message: "Team-defense allowance scoring requires team and opponent context.",
    });
  }

  if (input.sourceCompleteness !== "complete") {
    warnings.push({
      code: "TEAM_CONTEXT_INCOMPLETE",
      message: "Team-defense allowance scoring requires complete team-game source context.",
      details: { sourceCompleteness: input.sourceCompleteness },
    });
  }

  if (input.reconciliationStatus !== "verified") {
    warnings.push({
      code: "TEAM_CONTEXT_UNVERIFIED",
      message: "Team-defense allowance scoring requires verified team-game reconciliation.",
      details: { reconciliationStatus: input.reconciliationStatus },
    });
  }

  for (const [statKey, value] of [
    ["pts_allow", input.pointsAllowed],
    ["yds_allow", input.yardsAllowed],
  ] as const) {
    if (value === null) {
      warnings.push({
        code: "TEAM_ALLOWANCE_STAT_MISSING",
        statKey,
        message: `${statKey} is missing from the team-game context.`,
      });
      continue;
    }
    if (value < 0) {
      warnings.push({
        code: "TEAM_ALLOWANCE_NEGATIVE",
        statKey,
        message: `${statKey} must be non-negative.`,
        details: { value },
      });
    }
    if (!Number.isInteger(value)) {
      warnings.push({
        code: "TEAM_ALLOWANCE_FRACTIONAL",
        statKey,
        message: `${statKey} must be an integer bucket input.`,
        details: { value },
      });
    }
  }

  return warnings;
}

function assertValidAllowanceValue(value: number, statKey: "pts_allow" | "yds_allow") {
  if (!Number.isFinite(value)) throw new Error(`${statKey} must be finite.`);
  if (value < 0) throw new Error(`${statKey} must be non-negative.`);
  if (!Number.isInteger(value)) throw new Error(`${statKey} must be an integer.`);
}
