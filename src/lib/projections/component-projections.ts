// H9.2 — football-stat component projections.
//
// Computation only. No league scoring, ADP, ranks, or persistence.

import { sha256 } from "./hash";
import { buildRoleProjectionFoundation, type PlayerRoleProjectionFoundation } from "./foundation";
import type { HistoricalPlayerProjectionInput, ProjectionPosition, StatComponents, WeeklyStatRow } from "./types";
import type { ReasonCode } from "./reason-codes";
import {
  CATCH_RATE_K,
  EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS,
  FUMBLES_LOST_RATE_K,
  LOW_SAMPLE_WEIGHT_THRESHOLD,
  OPPORTUNITY_REFERENCE_POOL_MIN_PLAYERS,
  MATERIAL_REGRESSION_PCT_DIFF,
  OPPORTUNITY_CAP_PERCENTILE,
  OPPORTUNITY_REGRESSION_ROLE_WEEK_K,
  OPPORTUNITY_TINY_SAMPLE_CAP_MULTIPLIER,
  OPPORTUNITY_TINY_SAMPLE_ROLE_WEEKS,
  PLAYER_VOLATILITY_LONG_TD,
  QB_COMPLETION_RATE_K,
  QB_EFFICIENCY_REF_FALLBACK_ATTEMPTS,
  QB_EFFICIENCY_REF_MIN_ATTEMPTS,
  QB_INT_RATE_K,
  QB_PASSING_TD_K,
  QB_PASSING_TD_REF_FALLBACK_ATTEMPTS,
  QB_PASSING_TD_REF_MIN_ATTEMPTS,
  QB_PASSING_TD_REF_MIN_WEEKS,
  QB_RUSH_EFFICIENCY_REF_MIN_CARRIES,
  QB_RUSHING_TD_K,
  QB_RUSHING_TD_REF_MIN_CARRIES,
  QB_YPA_K,
  RB_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS,
  RB_RECEIVING_EFFICIENCY_REF_MIN_TARGETS,
  RB_RECEIVING_TD_K,
  RB_RECEIVING_TD_REF_FALLBACK_TARGETS,
  RB_RECEIVING_TD_REF_MIN_TARGETS,
  RB_RUSH_EFFICIENCY_REF_FALLBACK_CARRIES,
  RB_RUSH_EFFICIENCY_REF_MIN_CARRIES,
  RB_RUSHING_TD_K,
  RB_RUSHING_TD_REF_FALLBACK_CARRIES,
  RB_RUSHING_TD_REF_MIN_CARRIES,
  RB_RUSHING_TD_REF_MIN_WEEKS,
  REF_POOL_MIN_PLAYERS,
  RUSH_YPC_K,
  SCENARIO_EFFICIENCY_RANGE_SHARE,
  SCENARIO_OPPORTUNITY_RANGE_SHARE,
  SCENARIO_TD_RANGE_SHARE,
  TOTAL_RANGE_WIDTH_MAX,
  TE_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS,
  TE_RECEIVING_EFFICIENCY_REF_MIN_TARGETS,
  TE_RECEIVING_TD_K,
  TE_RECEIVING_TD_REF_FALLBACK_TARGETS,
  TE_RECEIVING_TD_REF_MIN_TARGETS,
  TE_RECEIVING_TD_REF_MIN_WEEKS,
  WR_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS,
  WR_RECEIVING_EFFICIENCY_REF_MIN_TARGETS,
  WR_RECEIVING_TD_K,
  WR_RECEIVING_TD_REF_FALLBACK_TARGETS,
  WR_RECEIVING_TD_REF_MIN_TARGETS,
  WR_RECEIVING_TD_REF_MIN_WEEKS,
  WR_TE_RUSHING_MATERIAL_CARRIES,
  WR_TE_RUSHING_MATERIAL_CARRIES_PER_ROLE_WEEK,
  YPT_K,
  MODEL_CONFIG,
} from "./constants";

export type ReferenceMetric =
  | "completionRate"
  | "passingYardsPerAttempt"
  | "passingTdRate"
  | "interceptionRate"
  | "rushingYardsPerCarry"
  | "rushingTdRate"
  | "catchRate"
  | "receivingYardsPerTarget"
  | "receivingTdRate"
  | "fumblesLostPerTouch";

export type ReferenceRateDiagnostic = {
  referenceName: ReferenceMetric;
  position: ProjectionPosition;
  eligiblePlayerCount: number;
  totalOpportunity: number;
  totalEvents: number;
  rate: number;
  zeroRateObserved: boolean;
  fallbackTierUsed: "primary" | "fallback" | "all_valid";
  smallPool: boolean;
  method: "pooled_rate";
};

export type RoleWeekRates = {
  roleWeeks: number;
  passAttemptsPerRoleWeek: number | null;
  completionsPerAttempt: number | null;
  passingYardsPerAttempt: number | null;
  passingTdsPerAttempt: number | null;
  interceptionsPerAttempt: number | null;
  carriesPerRoleWeek: number | null;
  rushingYardsPerCarry: number | null;
  rushingTdsPerCarry: number | null;
  targetsPerRoleWeek: number | null;
  receptionsPerTarget: number | null;
  receivingYardsPerTarget: number | null;
  receivingTdsPerTarget: number | null;
  fumblesLostPerTouch: number | null;
};

export type RegressionDiagnostic = {
  metric: ReferenceMetric;
  historicalRate: number;
  referenceRate: number;
  sampleWeight: number;
  regressedRate: number;
  opportunity: number;
  stabilizationConstant: number;
  reasonCodes: ReasonCode[];
};

export type OpportunityDiagnostic = {
  metric: "passAttempts" | "carries" | "targets";
  opportunityReferenceName: string;
  position: ProjectionPosition;
  eligiblePlayerCount: number;
  rawOpportunityRate: number | null;
  referenceRate: number;
  regressedOpportunityRate: number;
  regressedTowardReference: boolean;
  percentileUsed: number | null;
  capApplied: boolean;
  capValue: number | null;
  capReason: ReasonCode | null;
  fallbackTierUsed: "primary" | "fallback" | "all_valid";
  smallPool: boolean;
  method: "median_role_week_rate";
};

export type ComponentValidationResult = {
  ok: boolean;
  failures: string[];
};

export type PlayerStatProjection = {
  canonicalPlayerId: string;
  position: ProjectionPosition;
  h8SnapshotId?: string | null;
  roleFoundation: PlayerRoleProjectionFoundation;
  roleWeekRates: RoleWeekRates;
  referenceRatesUsed: ReferenceRateDiagnostic[];
  regressionDiagnostics: RegressionDiagnostic[];
  opportunityDiagnostics: OpportunityDiagnostic[];
  medianComponents: StatComponents;
  floorComponents: StatComponents;
  ceilingComponents: StatComponents;
  downsideComponents: StatComponents;
  upsideComponents: StatComponents;
  scenarioMultipliers: {
    opportunity: { downside: number; floor: number; median: number; ceiling: number; upside: number };
    efficiency: { downside: number; floor: number; median: number; ceiling: number; upside: number };
    td: { downside: number; floor: number; median: number; ceiling: number; upside: number };
  };
  componentReasons: ReasonCode[];
  validation: ComponentValidationResult;
  playerDataHash: string;
  playerProjectionInputHash: string;
};

export type ComponentProjectionPopulation = {
  projections: PlayerStatProjection[];
  referenceRates: ReferenceRateDiagnostic[];
  invariantFailures: Array<{ canonicalPlayerId: string; failures: string[] }>;
};

type PlayerProfile = {
  input: HistoricalPlayerProjectionInput;
  foundation: PlayerRoleProjectionFoundation;
  roleRows: WeeklyStatRow[];
  roleWeekRates: RoleWeekRates;
  roleTotals: {
    passAttempts: number;
    completions: number;
    passingYards: number;
    passingTds: number;
    interceptions: number;
    carries: number;
    rushingYards: number;
    rushingTds: number;
    targets: number;
    receptions: number;
    receivingYards: number;
    receivingTds: number;
    fumblesLost: number;
    passingFirstDowns: number;
    rushingFirstDowns: number;
    receivingFirstDowns: number;
    sacksTaken: number;
    passPick6: number;
    recTd40p: number;
    recTd50p: number;
    rushTd40p: number;
    rushTd50p: number;
  };
};

type RefDef = {
  metric: ReferenceMetric;
  numerator: keyof PlayerProfile["roleTotals"];
  denominator?: keyof PlayerProfile["roleTotals"];
  denominatorValue?: (profile: PlayerProfile) => number;
  primaryMin: number;
  fallbackMin: number;
  minWeeks?: number;
  poolMin: number;
};

const ZERO_COMPONENTS: StatComponents = {
  passAttempts: 0,
  completions: 0,
  passingYards: 0,
  passingTds: 0,
  interceptions: 0,
  carries: 0,
  rushingYards: 0,
  rushingTds: 0,
  targets: 0,
  receptions: 0,
  receivingYards: 0,
  receivingTds: 0,
  fumblesLost: 0,
  twoPointConversions: 0,
  miscTds: 0,
  passingFirstDowns: 0,
  rushingFirstDowns: 0,
  receivingFirstDowns: 0,
  sacksTaken: 0,
  passPick6: 0,
  passTd40p: 0,
  passTd50p: 0,
  recTd40p: 0,
  recTd50p: 0,
  rushTd40p: 0,
  rushTd50p: 0,
  passCmp40p: 0,
  rec40p: 0,
  rec20_29: 0,
  rec30_39: 0,
  rush40p: 0,
  bonusPassCmp25: 0,
  bonusPassYd300: 0,
  bonusPassYd400: 0,
  bonusRushAtt20: 0,
  bonusRushYd100: 0,
  bonusRushYd200: 0,
  bonusRecYd100: 0,
  bonusRecYd200: 0,
  bonusRushRecYd100: 0,
  bonusRushRecYd200: 0,
  fumbleRecoveries: 0,
  fumbleRecoveryTds: 0,
};

const BENEFICIAL_COMPONENTS: Array<keyof StatComponents> = [
  "passAttempts",
  "completions",
  "passingTds",
  "carries",
  "rushingYards",
  "rushingTds",
  "targets",
  "receptions",
  "receivingYards",
  "receivingTds",
];

const HARMFUL_COMPONENTS: Array<keyof StatComponents> = ["interceptions", "fumblesLost"];

const STAT_ROW_NUMBER_FIELDS: Array<keyof WeeklyStatRow> = [
  "week",
  "passAttempts",
  "completions",
  "passingTds",
  "interceptions",
  "carries",
  "rushingYards",
  "rushingTds",
  "targets",
  "receptions",
  "receivingYards",
  "receivingTds",
  "fumRetTd",
  "passingFirstDowns",
  "rushingFirstDowns",
  "receivingFirstDowns",
  "sacksTaken",
  "passPick6",
  "recTd40p",
  "recTd50p",
  "rushTd40p",
  "rushTd50p",
  "twoPointConversions",
  "fumblesLost",
];

const STAT_ROW_NONNEGATIVE_FIELDS = new Set<keyof WeeklyStatRow>([
  "week",
  "passAttempts",
  "completions",
  "passingYards",
  "passingTds",
  "interceptions",
  "carries",
  "rushingTds",
  "targets",
  "receptions",
  "receivingTds",
  "fumRetTd",
  "passingFirstDowns",
  "rushingFirstDowns",
  "receivingFirstDowns",
  "sacksTaken",
  "passPick6",
  "recTd40p",
  "recTd50p",
  "rushTd40p",
  "rushTd50p",
  "twoPointConversions",
  "fumblesLost",
]);

function rate(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000000) / 1000000;
}

function sortedJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${sortedJson(o[k])}`).join(",")}}`;
}

function sumRows(rows: WeeklyStatRow[]): PlayerProfile["roleTotals"] {
  return rows.reduce<PlayerProfile["roleTotals"]>((acc, row) => {
    acc.passAttempts += row.passAttempts;
    acc.completions += row.completions;
    acc.passingYards += row.passingYards;
    acc.passingTds += row.passingTds;
    acc.interceptions += row.interceptions;
    acc.carries += row.carries;
    acc.rushingYards += row.rushingYards;
    acc.rushingTds += row.rushingTds;
    acc.targets += row.targets;
    acc.receptions += row.receptions;
    acc.receivingYards += row.receivingYards;
    acc.receivingTds += row.receivingTds;
    acc.fumblesLost += row.fumblesLost;
    acc.passingFirstDowns += row.passingFirstDowns ?? 0;
    acc.rushingFirstDowns += row.rushingFirstDowns ?? 0;
    acc.receivingFirstDowns += row.receivingFirstDowns ?? 0;
    acc.sacksTaken += row.sacksTaken ?? 0;
    acc.passPick6 += row.passPick6 ?? 0;
    acc.recTd40p += row.recTd40p ?? 0;
    acc.recTd50p += row.recTd50p ?? 0;
    acc.rushTd40p += row.rushTd40p ?? 0;
    acc.rushTd50p += row.rushTd50p ?? 0;
    return acc;
  }, {
    passAttempts: 0,
    completions: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    carries: 0,
    rushingYards: 0,
    rushingTds: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
    fumblesLost: 0,
    passingFirstDowns: 0,
    rushingFirstDowns: 0,
    receivingFirstDowns: 0,
    sacksTaken: 0,
    passPick6: 0,
    recTd40p: 0,
    recTd50p: 0,
    rushTd40p: 0,
    rushTd50p: 0,
  });
}

function validateWeeklyRows(input: HistoricalPlayerProjectionInput): void {
  input.weeklyStats.forEach((row, index) => {
    for (const field of STAT_ROW_NUMBER_FIELDS) {
      const value = row[field];
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || (STAT_ROW_NONNEGATIVE_FIELDS.has(field) && value < 0)) {
        throw new Error(
          `Invalid H9.2 weekly stat: player=${input.canonicalPlayerId} week=${row.week} rowIndex=${index} field=${String(field)} value=${String(value)}`
        );
      }
    }
    if (row.longTds !== undefined && (!Number.isFinite(row.longTds) || row.longTds < 0)) {
      throw new Error(
        `Invalid H9.2 weekly stat: player=${input.canonicalPlayerId} week=${row.week} rowIndex=${index} field=longTds value=${String(row.longTds)}`
      );
    }
  });
}

function makeRoleWeekRates(t: PlayerProfile["roleTotals"], roleWeeks: number): RoleWeekRates {
  if (roleWeeks === 0) {
    return {
      roleWeeks,
      passAttemptsPerRoleWeek: null,
      completionsPerAttempt: null,
      passingYardsPerAttempt: null,
      passingTdsPerAttempt: null,
      interceptionsPerAttempt: null,
      carriesPerRoleWeek: null,
      rushingYardsPerCarry: null,
      rushingTdsPerCarry: null,
      targetsPerRoleWeek: null,
      receptionsPerTarget: null,
      receivingYardsPerTarget: null,
      receivingTdsPerTarget: null,
      fumblesLostPerTouch: null,
    };
  }
  const touches = t.carries + t.receptions;
  return {
    roleWeeks,
    passAttemptsPerRoleWeek: rate(t.passAttempts, roleWeeks),
    completionsPerAttempt: rate(t.completions, t.passAttempts),
    passingYardsPerAttempt: rate(t.passingYards, t.passAttempts),
    passingTdsPerAttempt: rate(t.passingTds, t.passAttempts),
    interceptionsPerAttempt: rate(t.interceptions, t.passAttempts),
    carriesPerRoleWeek: rate(t.carries, roleWeeks),
    rushingYardsPerCarry: rate(t.rushingYards, t.carries),
    rushingTdsPerCarry: rate(t.rushingTds, t.carries),
    targetsPerRoleWeek: rate(t.targets, roleWeeks),
    receptionsPerTarget: rate(t.receptions, t.targets),
    receivingYardsPerTarget: rate(t.receivingYards, t.targets),
    receivingTdsPerTarget: rate(t.receivingTds, t.targets),
    fumblesLostPerTouch: rate(t.fumblesLost, touches),
  };
}

export function buildRoleWeekProfile(input: HistoricalPlayerProjectionInput): PlayerProfile {
  validateWeeklyRows(input);
  const foundation = buildRoleProjectionFoundation(input);
  const roleWeeks = new Set(foundation.roleWeekNumbers);
  const roleRows = input.weeklyStats.filter(row => roleWeeks.has(row.week));
  const roleTotals = sumRows(roleRows);
  return {
    input,
    foundation,
    roleRows,
    roleTotals,
    roleWeekRates: makeRoleWeekRates(roleTotals, foundation.historicalRoleWeeks),
  };
}

function touches(profile: PlayerProfile): number {
  return profile.roleTotals.carries + profile.roleTotals.receptions;
}

function refDenominator(def: RefDef, profile: PlayerProfile): number {
  return def.denominatorValue ? def.denominatorValue(profile) : profile.roleTotals[def.denominator!];
}

function refDefinitions(position: ProjectionPosition): RefDef[] {
  switch (position) {
    case "QB":
      return [
        { metric: "completionRate", numerator: "completions", denominator: "passAttempts", primaryMin: QB_EFFICIENCY_REF_MIN_ATTEMPTS, fallbackMin: QB_EFFICIENCY_REF_FALLBACK_ATTEMPTS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "passingYardsPerAttempt", numerator: "passingYards", denominator: "passAttempts", primaryMin: QB_EFFICIENCY_REF_MIN_ATTEMPTS, fallbackMin: QB_EFFICIENCY_REF_FALLBACK_ATTEMPTS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "passingTdRate", numerator: "passingTds", denominator: "passAttempts", primaryMin: QB_PASSING_TD_REF_MIN_ATTEMPTS, fallbackMin: QB_PASSING_TD_REF_FALLBACK_ATTEMPTS, minWeeks: QB_PASSING_TD_REF_MIN_WEEKS, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "interceptionRate", numerator: "interceptions", denominator: "passAttempts", primaryMin: QB_EFFICIENCY_REF_MIN_ATTEMPTS, fallbackMin: QB_EFFICIENCY_REF_FALLBACK_ATTEMPTS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "rushingYardsPerCarry", numerator: "rushingYards", denominator: "carries", primaryMin: QB_RUSH_EFFICIENCY_REF_MIN_CARRIES, fallbackMin: 1, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "rushingTdRate", numerator: "rushingTds", denominator: "carries", primaryMin: QB_RUSHING_TD_REF_MIN_CARRIES, fallbackMin: 1, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "fumblesLostPerTouch", numerator: "fumblesLost", denominatorValue: touches, primaryMin: QB_RUSH_EFFICIENCY_REF_MIN_CARRIES, fallbackMin: 1, poolMin: REF_POOL_MIN_PLAYERS },
      ];
    case "RB":
      return [
        { metric: "rushingYardsPerCarry", numerator: "rushingYards", denominator: "carries", primaryMin: RB_RUSH_EFFICIENCY_REF_MIN_CARRIES, fallbackMin: RB_RUSH_EFFICIENCY_REF_FALLBACK_CARRIES, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "rushingTdRate", numerator: "rushingTds", denominator: "carries", primaryMin: RB_RUSHING_TD_REF_MIN_CARRIES, fallbackMin: RB_RUSHING_TD_REF_FALLBACK_CARRIES, minWeeks: RB_RUSHING_TD_REF_MIN_WEEKS, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "catchRate", numerator: "receptions", denominator: "targets", primaryMin: RB_RECEIVING_EFFICIENCY_REF_MIN_TARGETS, fallbackMin: RB_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "receivingYardsPerTarget", numerator: "receivingYards", denominator: "targets", primaryMin: RB_RECEIVING_EFFICIENCY_REF_MIN_TARGETS, fallbackMin: RB_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "receivingTdRate", numerator: "receivingTds", denominator: "targets", primaryMin: RB_RECEIVING_TD_REF_MIN_TARGETS, fallbackMin: RB_RECEIVING_TD_REF_FALLBACK_TARGETS, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "fumblesLostPerTouch", numerator: "fumblesLost", denominatorValue: touches, primaryMin: RB_RUSHING_TD_REF_MIN_CARRIES, fallbackMin: RB_RUSHING_TD_REF_FALLBACK_CARRIES, poolMin: REF_POOL_MIN_PLAYERS },
      ];
    case "WR":
      return [
        { metric: "catchRate", numerator: "receptions", denominator: "targets", primaryMin: WR_RECEIVING_EFFICIENCY_REF_MIN_TARGETS, fallbackMin: WR_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "receivingYardsPerTarget", numerator: "receivingYards", denominator: "targets", primaryMin: WR_RECEIVING_EFFICIENCY_REF_MIN_TARGETS, fallbackMin: WR_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "receivingTdRate", numerator: "receivingTds", denominator: "targets", primaryMin: WR_RECEIVING_TD_REF_MIN_TARGETS, fallbackMin: WR_RECEIVING_TD_REF_FALLBACK_TARGETS, minWeeks: WR_RECEIVING_TD_REF_MIN_WEEKS, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "rushingYardsPerCarry", numerator: "rushingYards", denominator: "carries", primaryMin: WR_TE_RUSHING_MATERIAL_CARRIES, fallbackMin: 1, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "rushingTdRate", numerator: "rushingTds", denominator: "carries", primaryMin: WR_TE_RUSHING_MATERIAL_CARRIES, fallbackMin: 1, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "fumblesLostPerTouch", numerator: "fumblesLost", denominatorValue: touches, primaryMin: WR_RECEIVING_TD_REF_MIN_TARGETS, fallbackMin: WR_RECEIVING_TD_REF_FALLBACK_TARGETS, poolMin: REF_POOL_MIN_PLAYERS },
      ];
    case "TE":
      return [
        { metric: "catchRate", numerator: "receptions", denominator: "targets", primaryMin: TE_RECEIVING_EFFICIENCY_REF_MIN_TARGETS, fallbackMin: TE_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "receivingYardsPerTarget", numerator: "receivingYards", denominator: "targets", primaryMin: TE_RECEIVING_EFFICIENCY_REF_MIN_TARGETS, fallbackMin: TE_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "receivingTdRate", numerator: "receivingTds", denominator: "targets", primaryMin: TE_RECEIVING_TD_REF_MIN_TARGETS, fallbackMin: TE_RECEIVING_TD_REF_FALLBACK_TARGETS, minWeeks: TE_RECEIVING_TD_REF_MIN_WEEKS, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "rushingYardsPerCarry", numerator: "rushingYards", denominator: "carries", primaryMin: WR_TE_RUSHING_MATERIAL_CARRIES, fallbackMin: 1, poolMin: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS },
        { metric: "rushingTdRate", numerator: "rushingTds", denominator: "carries", primaryMin: WR_TE_RUSHING_MATERIAL_CARRIES, fallbackMin: 1, poolMin: REF_POOL_MIN_PLAYERS },
        { metric: "fumblesLostPerTouch", numerator: "fumblesLost", denominatorValue: touches, primaryMin: TE_RECEIVING_TD_REF_MIN_TARGETS, fallbackMin: TE_RECEIVING_TD_REF_FALLBACK_TARGETS, poolMin: REF_POOL_MIN_PLAYERS },
      ];
  }
}

function buildReference(def: RefDef, position: ProjectionPosition, profiles: PlayerProfile[]): ReferenceRateDiagnostic {
  const samePosition = profiles.filter(p => p.input.position === position);
  const eligible = (min: number, requireWeeks: boolean) => samePosition.filter(p =>
    refDenominator(def, p) >= min &&
    (!requireWeeks || !def.minWeeks || p.foundation.historicalRoleWeeks >= def.minWeeks)
  );

  let pool = eligible(def.primaryMin, true);
  let fallbackTierUsed: ReferenceRateDiagnostic["fallbackTierUsed"] = "primary";
  const smallPrimary = pool.length < def.poolMin;
  if (smallPrimary) {
    pool = eligible(def.fallbackMin, false);
    fallbackTierUsed = "fallback";
  }
  if (pool.length < def.poolMin) {
    pool = samePosition.filter(p => refDenominator(def, p) > 0);
    fallbackTierUsed = "all_valid";
  }

  const totalOpportunity = pool.reduce((sum, p) => sum + refDenominator(def, p), 0);
  const totalNumerator = pool.reduce((sum, p) => sum + p.roleTotals[def.numerator], 0);
  const pooledRate = totalOpportunity > 0 ? totalNumerator / totalOpportunity : 0;
  return {
    referenceName: def.metric,
    position,
    eligiblePlayerCount: pool.length,
    totalOpportunity,
    totalEvents: totalNumerator,
    rate: round(pooledRate),
    zeroRateObserved: totalOpportunity > 0 && totalNumerator === 0,
    fallbackTierUsed,
    smallPool: smallPrimary,
    method: "pooled_rate",
  };
}

export function buildReferenceRates(profiles: PlayerProfile[]): ReferenceRateDiagnostic[] {
  const refs: ReferenceRateDiagnostic[] = [];
  for (const position of ["QB", "RB", "WR", "TE"] as const) {
    for (const def of refDefinitions(position)) {
      refs.push(buildReference(def, position, profiles));
    }
  }
  return refs.sort((a, b) =>
    a.position.localeCompare(b.position) || a.referenceName.localeCompare(b.referenceName)
  );
}

function refFor(
  refs: ReferenceRateDiagnostic[],
  position: ProjectionPosition,
  metric: ReferenceMetric,
  playerId: string,
  component: string
): ReferenceRateDiagnostic {
  const ref = refs.find(r => r.position === position && r.referenceName === metric);
  if (!ref) {
    const available = refs.map(r => `${r.position}:${r.referenceName}`).sort().join(",");
    throw new Error(
      `Missing H9.2 reference rate: referenceName=${metric} position=${position} playerId=${playerId} component=${component} availableReferenceKeys=${available}`
    );
  }
  return ref;
}

function regressRate(
  metric: ReferenceMetric,
  historicalRate: number | null,
  reference: ReferenceRateDiagnostic,
  opportunity: number,
  k: number,
  isTd: boolean
): RegressionDiagnostic | null {
  if (historicalRate === null || opportunity <= 0) return null;
  const sampleWeight = opportunity / (opportunity + k);
  const regressedRate = sampleWeight * historicalRate + (1 - sampleWeight) * reference.rate;
  const reasonCodes = new Set<ReasonCode>();
  const diffBase = Math.max(Math.abs(historicalRate), 0.000001);
  if (Math.abs(regressedRate - historicalRate) / diffBase >= MATERIAL_REGRESSION_PCT_DIFF) {
    if (metric === "fumblesLostPerTouch") {
      reasonCodes.add(regressedRate > historicalRate ? "FUMBLE_RATE_REGRESSION_UP" : "FUMBLE_RATE_REGRESSION_DOWN");
    } else if (isTd) {
      reasonCodes.add(regressedRate > historicalRate ? "TD_RATE_REGRESSION_UP" : "TD_RATE_REGRESSION_DOWN");
    } else {
      reasonCodes.add(regressedRate > historicalRate ? "EFFICIENCY_REGRESSION_UP" : "EFFICIENCY_REGRESSION_DOWN");
    }
  }
  if (sampleWeight < LOW_SAMPLE_WEIGHT_THRESHOLD) {
    reasonCodes.add(isTd ? "LOW_SAMPLE_TD_REGRESSION" : "LOW_SAMPLE_EFFICIENCY_REGRESSION");
  }
  if (reference.smallPool) {
    reasonCodes.add(isTd ? "TD_REFERENCE_POOL_SMALL" : "EFFICIENCY_REFERENCE_POOL_SMALL");
  }
  return {
    metric,
    historicalRate: round(historicalRate),
    referenceRate: reference.rate,
    sampleWeight: round(clamp01(sampleWeight)),
    regressedRate: round(Math.max(0, regressedRate)),
    opportunity,
    stabilizationConstant: k,
    reasonCodes: [...reasonCodes],
  };
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[idx];
}

function opportunityRate(profile: PlayerProfile, metric: OpportunityDiagnostic["metric"]): number | null {
  if (profile.foundation.historicalRoleWeeks === 0) return null;
  switch (metric) {
    case "passAttempts": return profile.roleWeekRates.passAttemptsPerRoleWeek;
    case "carries": return profile.roleWeekRates.carriesPerRoleWeek;
    case "targets": return profile.roleWeekRates.targetsPerRoleWeek;
  }
}

function opportunityRef(profiles: PlayerProfile[], position: ProjectionPosition, metric: OpportunityDiagnostic["metric"]) {
  const values = profiles
    .filter(p => p.input.position === position)
    .map(p => ({ profile: p, value: opportunityRate(p, metric) }))
    .filter((v): v is { profile: PlayerProfile; value: number } => v.value !== null && v.value > 0);
  let pool = values.filter(v => v.profile.foundation.historicalRoleWeeks > OPPORTUNITY_TINY_SAMPLE_ROLE_WEEKS);
  let fallbackTierUsed: OpportunityDiagnostic["fallbackTierUsed"] = "primary";
  const smallPrimary = pool.length < OPPORTUNITY_REFERENCE_POOL_MIN_PLAYERS;
  if (smallPrimary) {
    pool = values;
    fallbackTierUsed = "fallback";
  }
  if (pool.length < OPPORTUNITY_REFERENCE_POOL_MIN_PLAYERS) {
    fallbackTierUsed = "all_valid";
  }
  const capValues = profiles
    .filter(p => p.input.position === position && p.foundation.historicalRoleWeeks > OPPORTUNITY_TINY_SAMPLE_ROLE_WEEKS)
    .map(p => opportunityRate(p, metric))
    .filter((v): v is number => v !== null && v > 0);
  const referenceValues = pool.map(v => v.value);
  return {
    eligiblePlayerCount: pool.length,
    median: percentile(referenceValues, 0.5) ?? 0,
    cap: percentile(capValues.length ? capValues : values.map(v => v.value), OPPORTUNITY_CAP_PERCENTILE),
    fallbackTierUsed,
    smallPool: smallPrimary,
  };
}

function projectOpportunity(
  profile: PlayerProfile,
  profiles: PlayerProfile[],
  metric: OpportunityDiagnostic["metric"],
  reasons: Set<ReasonCode>
): OpportunityDiagnostic {
  const raw = opportunityRate(profile, metric);
  if (raw === null) {
    reasons.add("ROLE_WEEK_RATE_UNAVAILABLE");
    return {
      metric,
      opportunityReferenceName: `${profile.input.position}.${metric}.perRoleWeek`,
      position: profile.input.position,
      eligiblePlayerCount: 0,
      rawOpportunityRate: null,
      referenceRate: 0,
      regressedOpportunityRate: 0,
      regressedTowardReference: false,
      percentileUsed: null,
      capApplied: false,
      capValue: null,
      capReason: null,
      fallbackTierUsed: "all_valid",
      smallPool: true,
      method: "median_role_week_rate",
    };
  }
  const ref = opportunityRef(profiles, profile.input.position, metric);
  const weight = profile.foundation.historicalRoleWeeks / (profile.foundation.historicalRoleWeeks + OPPORTUNITY_REGRESSION_ROLE_WEEK_K);
  let regressed = weight * raw + (1 - weight) * ref.median;
  const regressedTowardReference = Math.abs(regressed - raw) > 0.000001;
  if (profile.foundation.historicalRoleWeeks < OPPORTUNITY_REGRESSION_ROLE_WEEK_K && regressedTowardReference) {
    reasons.add("OPPORTUNITY_RATE_REGRESSION");
  }

  let capApplied = false;
  let capReason: ReasonCode | null = null;
  const capValue = ref.cap === null ? null : ref.cap * OPPORTUNITY_TINY_SAMPLE_CAP_MULTIPLIER;
  if (
    capValue !== null &&
    profile.foundation.historicalRoleWeeks <= OPPORTUNITY_TINY_SAMPLE_ROLE_WEEKS &&
    regressed > capValue
  ) {
    regressed = capValue;
    capApplied = true;
    capReason = "OPPORTUNITY_RATE_CAPPED";
    reasons.add("OPPORTUNITY_RATE_CAPPED");
  }
  return {
    metric,
    opportunityReferenceName: `${profile.input.position}.${metric}.perRoleWeek`,
    position: profile.input.position,
    eligiblePlayerCount: ref.eligiblePlayerCount,
    rawOpportunityRate: round(raw),
    referenceRate: round(ref.median),
    regressedOpportunityRate: round(Math.max(0, regressed)),
    regressedTowardReference,
    percentileUsed: OPPORTUNITY_CAP_PERCENTILE,
    capApplied,
    capValue: capValue === null ? null : round(capValue),
    capReason,
    fallbackTierUsed: ref.fallbackTierUsed,
    smallPool: ref.smallPool,
    method: "median_role_week_rate",
  };
}

function diagnosticValue(diags: RegressionDiagnostic[], metric: ReferenceMetric): number {
  return diags.find(d => d.metric === metric)?.regressedRate ?? 0;
}

function add(a: StatComponents, b: Partial<StatComponents>): StatComponents {
  return { ...a, ...b };
}

function historicalRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function roleWeekHitRate(rows: WeeklyStatRow[], predicate: (row: WeeklyStatRow) => boolean): number {
  if (rows.length === 0) return 0;
  return rows.filter(predicate).length / rows.length;
}

function sparseRegressedCount(events: number, opportunities: number, projectedOpportunity: number, shrink = 0.25): number {
  if (events <= 0 || opportunities <= 0 || projectedOpportunity <= 0) return 0;
  return (events / opportunities) * projectedOpportunity * shrink;
}

function projectionGapComponents(
  profile: PlayerProfile,
  components: StatComponents,
  roleGames: number,
  reasons: Set<ReasonCode>
): Partial<StatComponents> {
  const t = profile.roleTotals;
  const extras: Partial<StatComponents> = {};

  if (t.passingFirstDowns > 0) {
    extras.passingFirstDowns = components.passAttempts * historicalRate(t.passingFirstDowns, t.passAttempts);
    reasons.add("FIRST_DOWN_PROJECTED_FROM_HISTORY");
  }
  if (t.rushingFirstDowns > 0) {
    extras.rushingFirstDowns = components.carries * historicalRate(t.rushingFirstDowns, t.carries);
    reasons.add("FIRST_DOWN_PROJECTED_FROM_HISTORY");
  }
  if (t.receivingFirstDowns > 0) {
    extras.receivingFirstDowns = components.receptions * historicalRate(t.receivingFirstDowns, t.receptions);
    reasons.add("FIRST_DOWN_PROJECTED_FROM_HISTORY");
  }

  if (profile.input.position === "QB" && t.sacksTaken > 0) {
    extras.sacksTaken = components.passAttempts * historicalRate(t.sacksTaken, t.passAttempts);
    reasons.add("SACKS_PROJECTED_FROM_HISTORY");
  }

  if (profile.input.position === "QB" && t.passPick6 > 0) {
    extras.passPick6 = Math.min(
      components.interceptions,
      sparseRegressedCount(t.passPick6, Math.max(1, t.interceptions), components.interceptions, 0.35)
    );
    reasons.add("PICK_SIX_PROJECTED_REGRESSED");
  }

  if (profile.input.position === "QB" && profile.roleRows.some(row => (row.longTds ?? 0) > 0)) {
    const longTdRate = historicalRate(profile.roleRows.reduce((sum, row) => sum + (row.longTds ?? 0), 0), Math.max(1, t.passingTds));
    extras.passTd40p = Math.min(components.passingTds * 0.35, components.passingTds * longTdRate * 0.25);
    extras.passTd50p = Math.min(components.passingTds * 0.2, components.passingTds * longTdRate * 0.15);
    extras.passCmp40p = Math.min(components.completions * 0.08, components.completions * longTdRate * 0.2);
    reasons.add("LONG_PLAY_BONUS_APPROXIMATED");
  }

  if (t.recTd40p > 0) {
    extras.recTd40p = Math.min(components.receivingTds, sparseRegressedCount(t.recTd40p, Math.max(1, t.receivingTds), components.receivingTds));
    extras.rec40p = Math.min(components.receptions * 0.08, (extras.recTd40p ?? 0) * 1.5);
    reasons.add("LONG_PLAY_BONUS_PROJECTED_REGRESSED");
  }
  if (t.recTd50p > 0) {
    extras.recTd50p = Math.min(components.receivingTds, sparseRegressedCount(t.recTd50p, Math.max(1, t.receivingTds), components.receivingTds));
    reasons.add("LONG_PLAY_BONUS_PROJECTED_REGRESSED");
  }
  if (t.rushTd40p > 0) {
    extras.rushTd40p = Math.min(components.rushingTds, sparseRegressedCount(t.rushTd40p, Math.max(1, t.rushingTds), components.rushingTds));
    extras.rush40p = Math.min(components.carries * 0.04, (extras.rushTd40p ?? 0) * 1.5);
    reasons.add("LONG_PLAY_BONUS_PROJECTED_REGRESSED");
  }
  if (t.rushTd50p > 0) {
    extras.rushTd50p = Math.min(components.rushingTds, sparseRegressedCount(t.rushTd50p, Math.max(1, t.rushingTds), components.rushingTds));
    reasons.add("LONG_PLAY_BONUS_PROJECTED_REGRESSED");
  }

  extras.bonusPassCmp25 = roleGames * roleWeekHitRate(profile.roleRows, row => row.completions >= 25);
  extras.bonusPassYd300 = roleGames * roleWeekHitRate(profile.roleRows, row => row.passingYards >= 300 && row.passingYards < 400);
  extras.bonusPassYd400 = roleGames * roleWeekHitRate(profile.roleRows, row => row.passingYards >= 400);
  extras.bonusRushAtt20 = roleGames * roleWeekHitRate(profile.roleRows, row => row.carries >= 20);
  extras.bonusRushYd100 = roleGames * roleWeekHitRate(profile.roleRows, row => row.rushingYards >= 100 && row.rushingYards < 200);
  extras.bonusRushYd200 = roleGames * roleWeekHitRate(profile.roleRows, row => row.rushingYards >= 200);
  extras.bonusRecYd100 = roleGames * roleWeekHitRate(profile.roleRows, row => row.receivingYards >= 100 && row.receivingYards < 200);
  extras.bonusRecYd200 = roleGames * roleWeekHitRate(profile.roleRows, row => row.receivingYards >= 200);
  extras.bonusRushRecYd100 = roleGames * roleWeekHitRate(profile.roleRows, row => row.rushingYards + row.receivingYards >= 100 && row.rushingYards + row.receivingYards < 200);
  extras.bonusRushRecYd200 = roleGames * roleWeekHitRate(profile.roleRows, row => row.rushingYards + row.receivingYards >= 200);
  extras.rec20_29 = roleGames * roleWeekHitRate(profile.roleRows, row => row.receivingYards >= 20 && row.receivingYards < 30);
  extras.rec30_39 = roleGames * roleWeekHitRate(profile.roleRows, row => row.receivingYards >= 30 && row.receivingYards < 40);
  if (Object.entries(extras).some(([key, value]) => key.startsWith("bonus") && (value ?? 0) > 0)) {
    reasons.add("THRESHOLD_BONUS_PROJECTED_FROM_ROLE_WEEKS");
  }

  extras.fumbleRecoveries = 0;
  extras.fumbleRecoveryTds = 0;
  if (profile.input.weeklyStats.some(row => row.fumRetTd > 0)) {
    reasons.add("FUMBLE_RETURN_TD_NON_REPEATABLE");
  }
  return extras;
}

function medianComponents(
  profile: PlayerProfile,
  opportunity: OpportunityDiagnostic[],
  regressions: RegressionDiagnostic[],
  reasons: Set<ReasonCode>
): StatComponents {
  const roleGames = profile.foundation.projectedAvailability.projectedRoleGames.median;
  const opp = (m: OpportunityDiagnostic["metric"]) =>
    (opportunity.find(d => d.metric === m)?.regressedOpportunityRate ?? 0) * roleGames;
  const passAttempts = opp("passAttempts");
  const carries = opp("carries");
  const targets = opp("targets");
  const fumblesLostRate = diagnosticValue(regressions, "fumblesLostPerTouch");

  let components = { ...ZERO_COMPONENTS, passAttempts, carries, targets };
  if (profile.input.position === "QB") {
    components = add(components, {
      completions: Math.min(passAttempts, passAttempts * diagnosticValue(regressions, "completionRate")),
      passingYards: passAttempts * diagnosticValue(regressions, "passingYardsPerAttempt"),
      passingTds: passAttempts * diagnosticValue(regressions, "passingTdRate"),
      interceptions: passAttempts * diagnosticValue(regressions, "interceptionRate"),
      rushingYards: carries * diagnosticValue(regressions, "rushingYardsPerCarry"),
      rushingTds: carries * diagnosticValue(regressions, "rushingTdRate"),
      fumblesLost: carries * fumblesLostRate,
    });
  } else if (profile.input.position === "RB") {
    components = add(components, {
      rushingYards: carries * diagnosticValue(regressions, "rushingYardsPerCarry"),
      rushingTds: carries * diagnosticValue(regressions, "rushingTdRate"),
      receptions: Math.min(targets, targets * diagnosticValue(regressions, "catchRate")),
      receivingYards: targets * diagnosticValue(regressions, "receivingYardsPerTarget"),
      receivingTds: targets * diagnosticValue(regressions, "receivingTdRate"),
    });
    components.fumblesLost = (components.carries + components.receptions) * fumblesLostRate;
  } else {
    const materialRush =
      profile.roleTotals.carries >= WR_TE_RUSHING_MATERIAL_CARRIES ||
      (profile.roleWeekRates.carriesPerRoleWeek ?? 0) >= WR_TE_RUSHING_MATERIAL_CARRIES_PER_ROLE_WEEK;
    if (!materialRush && profile.roleTotals.carries > 0) reasons.add("INCIDENTAL_RUSHING_NOT_PROJECTED");
    components = add(components, {
      carries: materialRush ? carries : 0,
      rushingYards: materialRush ? carries * diagnosticValue(regressions, "rushingYardsPerCarry") : 0,
      rushingTds: materialRush ? carries * diagnosticValue(regressions, "rushingTdRate") : 0,
      receptions: Math.min(targets, targets * diagnosticValue(regressions, "catchRate")),
      receivingYards: targets * diagnosticValue(regressions, "receivingYardsPerTarget"),
      receivingTds: targets * diagnosticValue(regressions, "receivingTdRate"),
    });
    components.fumblesLost = (components.carries + components.receptions) * fumblesLostRate;
  }

  if (profile.input.weeklyStats.some(r => (r.longTds ?? 0) > 0)) reasons.add("LONG_TD_VOLATILITY");
  if (profile.input.weeklyStats.some(r => r.fumRetTd > 0)) reasons.add("NON_REPEATABLE_MISC_TD");
  if (profile.input.weeklyStats.some(r => r.twoPointConversions > 0)) reasons.add("TWO_POINT_NOT_PROJECTED");
  return normalizeComponents(add(components, projectionGapComponents(profile, components, roleGames, reasons)));
}

function normalizeComponents(c: StatComponents): StatComponents {
  const out = { ...c };
  for (const key of Object.keys(out) as Array<keyof StatComponents>) {
    out[key] = round(Math.max(0, out[key] ?? 0));
  }
  out.completions = Math.min(out.completions, out.passAttempts);
  out.receptions = Math.min(out.receptions, out.targets);
  out.twoPointConversions = 0;
  out.miscTds = 0;
  return out;
}

function scenarioComponents(
  median: StatComponents,
  profile: PlayerProfile
): Pick<PlayerStatProjection, "downsideComponents" | "floorComponents" | "ceilingComponents" | "upsideComponents" | "scenarioMultipliers"> {
  const rg = profile.foundation.projectedAvailability.projectedRoleGames;
  const medianGames = Math.max(rg.median, 0);
  const gameRatio = (games: number) => medianGames > 0 ? games / medianGames : 0;
  const hasLongTd = profile.input.weeklyStats.some(row => (row.longTds ?? 0) > 0);
  const width = Math.min(
    TOTAL_RANGE_WIDTH_MAX,
    profile.foundation.totalRangeWidth + (hasLongTd ? PLAYER_VOLATILITY_LONG_TD : 0)
  );
  const opportunitySpread = width * SCENARIO_OPPORTUNITY_RANGE_SHARE;
  const efficiencySpread = width * SCENARIO_EFFICIENCY_RANGE_SHARE;
  const tdSpread = width * SCENARIO_TD_RANGE_SHARE;
  const opportunity = {
    downside: Math.max(0, gameRatio(rg.floor) * (1 - opportunitySpread)),
    floor: Math.max(0, gameRatio(rg.floor)),
    median: 1,
    ceiling: gameRatio(rg.ceiling),
    upside: gameRatio(rg.ceiling) * (1 + opportunitySpread),
  };
  const efficiency = {
    downside: Math.max(0, 1 - efficiencySpread),
    floor: Math.max(0, 1 - efficiencySpread / 2),
    median: 1,
    ceiling: 1 + efficiencySpread / 2,
    upside: 1 + efficiencySpread,
  };
  const td = {
    downside: Math.max(0, 1 - tdSpread),
    floor: Math.max(0, 1 - tdSpread / 2),
    median: 1,
    ceiling: 1 + tdSpread / 2,
    upside: 1 + tdSpread,
  };
  const make = (scenario: keyof typeof opportunity): StatComponents => {
    const oppM = opportunity[scenario];
    const effM = efficiency[scenario];
    const tdM = td[scenario];
    const harmfulM = scenario === "downside" ? 1 + tdSpread : scenario === "floor" ? 1 + tdSpread / 2 : scenario === "ceiling" ? Math.max(0, 1 - tdSpread / 2) : scenario === "upside" ? Math.max(0, 1 - tdSpread) : 1;
    return normalizeComponents({
      ...ZERO_COMPONENTS,
      passAttempts: median.passAttempts * oppM,
      carries: median.carries * oppM,
      targets: median.targets * oppM,
      completions: median.completions * oppM * effM,
      passingYards: median.passingYards * oppM * effM,
      interceptions: median.interceptions * harmfulM,
      fumblesLost: median.fumblesLost * harmfulM,
      passingTds: median.passingTds * oppM * tdM,
      rushingYards: median.rushingYards * oppM * effM,
      rushingTds: median.rushingTds * oppM * tdM,
      receptions: median.receptions * oppM * effM,
      receivingYards: median.receivingYards * oppM * effM,
      receivingTds: median.receivingTds * oppM * tdM,
      twoPointConversions: 0,
      miscTds: 0,
      passingFirstDowns: (median.passingFirstDowns ?? 0) * oppM,
      rushingFirstDowns: (median.rushingFirstDowns ?? 0) * oppM,
      receivingFirstDowns: (median.receivingFirstDowns ?? 0) * oppM,
      sacksTaken: (median.sacksTaken ?? 0) * harmfulM,
      passPick6: (median.passPick6 ?? 0) * harmfulM,
      passTd40p: (median.passTd40p ?? 0) * oppM * tdM,
      passTd50p: (median.passTd50p ?? 0) * oppM * tdM,
      recTd40p: (median.recTd40p ?? 0) * oppM * tdM,
      recTd50p: (median.recTd50p ?? 0) * oppM * tdM,
      rushTd40p: (median.rushTd40p ?? 0) * oppM * tdM,
      rushTd50p: (median.rushTd50p ?? 0) * oppM * tdM,
      passCmp40p: (median.passCmp40p ?? 0) * oppM,
      rec40p: (median.rec40p ?? 0) * oppM,
      rec20_29: (median.rec20_29 ?? 0) * oppM,
      rec30_39: (median.rec30_39 ?? 0) * oppM,
      rush40p: (median.rush40p ?? 0) * oppM,
      bonusPassCmp25: (median.bonusPassCmp25 ?? 0) * oppM,
      bonusPassYd300: (median.bonusPassYd300 ?? 0) * oppM,
      bonusPassYd400: (median.bonusPassYd400 ?? 0) * oppM,
      bonusRushAtt20: (median.bonusRushAtt20 ?? 0) * oppM,
      bonusRushYd100: (median.bonusRushYd100 ?? 0) * oppM,
      bonusRushYd200: (median.bonusRushYd200 ?? 0) * oppM,
      bonusRecYd100: (median.bonusRecYd100 ?? 0) * oppM,
      bonusRecYd200: (median.bonusRecYd200 ?? 0) * oppM,
      bonusRushRecYd100: (median.bonusRushRecYd100 ?? 0) * oppM,
      bonusRushRecYd200: (median.bonusRushRecYd200 ?? 0) * oppM,
      fumbleRecoveries: 0,
      fumbleRecoveryTds: 0,
    });
  };
  return {
    downsideComponents: make("downside"),
    floorComponents: make("floor"),
    ceilingComponents: make("ceiling"),
    upsideComponents: make("upside"),
    scenarioMultipliers: { opportunity, efficiency, td },
  };
}

function validateProjection(p: Omit<PlayerStatProjection, "validation">): ComponentValidationResult {
  const failures: string[] = [];
  const ordered = [p.downsideComponents, p.floorComponents, p.medianComponents, p.ceilingComponents, p.upsideComponents];
  for (const c of ordered) {
    for (const [key, value] of Object.entries(c)) {
      if (!Number.isFinite(value) || value < 0) failures.push(`${key} must be nonnegative`);
    }
    if (c.completions > c.passAttempts) failures.push("completions exceed passAttempts");
    if (c.receptions > c.targets) failures.push("receptions exceed targets");
  }
  for (const key of BENEFICIAL_COMPONENTS) {
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!;
      const current = ordered[i]!;
      if ((prev[key] ?? 0) > (current[key] ?? 0) + 0.000001) failures.push(`${key} beneficial ordering violated`);
    }
  }
  for (const key of HARMFUL_COMPONENTS) {
    if ((p.downsideComponents[key] ?? 0) + 0.000001 < (p.floorComponents[key] ?? 0)) failures.push(`${key} harmful downside ordering violated`);
    if ((p.floorComponents[key] ?? 0) + 0.000001 < (p.medianComponents[key] ?? 0)) failures.push(`${key} harmful floor ordering violated`);
    if ((p.medianComponents[key] ?? 0) + 0.000001 < (p.ceilingComponents[key] ?? 0)) failures.push(`${key} harmful ceiling ordering violated`);
    if ((p.ceilingComponents[key] ?? 0) + 0.000001 < (p.upsideComponents[key] ?? 0)) failures.push(`${key} harmful upside ordering violated`);
  }
  return { ok: failures.length === 0, failures };
}

function regressionSet(profile: PlayerProfile, refs: ReferenceRateDiagnostic[]): RegressionDiagnostic[] {
  const r = profile.roleWeekRates;
  const t = profile.roleTotals;
  const pos = profile.input.position;
  const defs: Array<[ReferenceMetric, number | null, number, number, boolean]> = [];
  if (pos === "QB") {
    defs.push(
      ["completionRate", r.completionsPerAttempt, t.passAttempts, QB_COMPLETION_RATE_K, false],
      ["passingYardsPerAttempt", r.passingYardsPerAttempt, t.passAttempts, QB_YPA_K, false],
      ["passingTdRate", r.passingTdsPerAttempt, t.passAttempts, QB_PASSING_TD_K, true],
      ["interceptionRate", r.interceptionsPerAttempt, t.passAttempts, QB_INT_RATE_K, false],
      ["rushingYardsPerCarry", r.rushingYardsPerCarry, t.carries, RUSH_YPC_K, false],
      ["rushingTdRate", r.rushingTdsPerCarry, t.carries, QB_RUSHING_TD_K, true],
      ["fumblesLostPerTouch", r.fumblesLostPerTouch, t.carries + t.receptions, FUMBLES_LOST_RATE_K, false],
    );
  } else if (pos === "RB") {
    defs.push(
      ["rushingYardsPerCarry", r.rushingYardsPerCarry, t.carries, RUSH_YPC_K, false],
      ["rushingTdRate", r.rushingTdsPerCarry, t.carries, RB_RUSHING_TD_K, true],
      ["catchRate", r.receptionsPerTarget, t.targets, CATCH_RATE_K, false],
      ["receivingYardsPerTarget", r.receivingYardsPerTarget, t.targets, YPT_K, false],
      ["receivingTdRate", r.receivingTdsPerTarget, t.targets, RB_RECEIVING_TD_K, true],
      ["fumblesLostPerTouch", r.fumblesLostPerTouch, t.carries + t.receptions, FUMBLES_LOST_RATE_K, false],
    );
  } else {
    const recTdK = pos === "WR" ? WR_RECEIVING_TD_K : TE_RECEIVING_TD_K;
    defs.push(
      ["catchRate", r.receptionsPerTarget, t.targets, CATCH_RATE_K, false],
      ["receivingYardsPerTarget", r.receivingYardsPerTarget, t.targets, YPT_K, false],
      ["receivingTdRate", r.receivingTdsPerTarget, t.targets, recTdK, true],
      ["rushingYardsPerCarry", r.rushingYardsPerCarry, t.carries, RUSH_YPC_K, false],
      ["rushingTdRate", r.rushingTdsPerCarry, t.carries, RB_RUSHING_TD_K, true],
      ["fumblesLostPerTouch", r.fumblesLostPerTouch, t.carries + t.receptions, FUMBLES_LOST_RATE_K, false],
    );
  }
  return defs
    .map(([metric, historical, opportunity, k, isTd]) =>
      regressRate(metric, historical, refFor(refs, pos, metric, profile.input.canonicalPlayerId, metric), opportunity, k, isTd)
    )
    .filter((d): d is RegressionDiagnostic => d !== null);
}

function componentHashes(input: HistoricalPlayerProjectionInput, foundation: PlayerRoleProjectionFoundation): { playerDataHash: string; playerProjectionInputHash: string } {
  const payload = {
    canonicalPlayerId: input.canonicalPlayerId,
    h8Fields: input.h8Fields,
    historicalSeason: input.historicalSeason,
    modelConfig: MODEL_CONFIG,
    position: input.position,
    projectionSeason: input.projectionSeason,
    roleFoundation: {
      historicalActiveWeeks: foundation.historicalActiveWeeks,
      historicalRoleWeeks: foundation.historicalRoleWeeks,
      projectedRoleGames: foundation.projectedAvailability.projectedRoleGames,
      roleSampleClass: foundation.roleSampleClass,
      totalRangeWidth: foundation.totalRangeWidth,
    },
    weeklyStats: [...input.weeklyStats].sort((a, b) => a.week - b.week),
  };
  const playerDataHash = sha256(sortedJson({ ...payload, canonicalPlayerId: null }));
  return {
    playerDataHash,
    playerProjectionInputHash: sha256(sortedJson({ canonicalPlayerId: input.canonicalPlayerId, playerDataHash, method: "h9_component_projection" })),
  };
}

export function projectPlayer(profile: PlayerProfile, profiles: PlayerProfile[], refs: ReferenceRateDiagnostic[]): PlayerStatProjection {
  const reasons = new Set<ReasonCode>(profile.foundation.allReasonCodes);
  const opportunityMetrics: OpportunityDiagnostic["metric"][] =
    profile.input.position === "QB" ? ["passAttempts", "carries"] :
      profile.input.position === "RB" ? ["carries", "targets"] :
        ["carries", "targets"];
  const opportunityDiagnostics = opportunityMetrics.map(metric => projectOpportunity(profile, profiles, metric, reasons));
  const regressionDiagnostics = regressionSet(profile, refs);
  for (const d of regressionDiagnostics) for (const code of d.reasonCodes) reasons.add(code);
  const median = medianComponents(profile, opportunityDiagnostics, regressionDiagnostics, reasons);
  const scenarios = scenarioComponents(median, profile);
  const hashes = componentHashes(profile.input, profile.foundation);
  const projectionWithoutValidation = {
    canonicalPlayerId: profile.input.canonicalPlayerId,
    position: profile.input.position,
    h8SnapshotId: profile.input.h8SnapshotId,
    roleFoundation: profile.foundation,
    roleWeekRates: profile.roleWeekRates,
    referenceRatesUsed: refs.filter(r => r.position === profile.input.position),
    regressionDiagnostics,
    opportunityDiagnostics,
    medianComponents: median,
    floorComponents: scenarios.floorComponents,
    ceilingComponents: scenarios.ceilingComponents,
    downsideComponents: scenarios.downsideComponents,
    upsideComponents: scenarios.upsideComponents,
    scenarioMultipliers: scenarios.scenarioMultipliers,
    componentReasons: [...reasons].sort(),
    playerDataHash: hashes.playerDataHash,
    playerProjectionInputHash: hashes.playerProjectionInputHash,
  };
  return {
    ...projectionWithoutValidation,
    validation: validateProjection(projectionWithoutValidation),
  };
}

export function projectComponentPopulation(inputs: HistoricalPlayerProjectionInput[]): ComponentProjectionPopulation {
  const profiles = inputs
    .map(buildRoleWeekProfile)
    .sort((a, b) => a.input.canonicalPlayerId.localeCompare(b.input.canonicalPlayerId));
  const referenceRates = buildReferenceRates(profiles);
  const projections = profiles.map(profile => projectPlayer(profile, profiles, referenceRates));
  return {
    projections,
    referenceRates,
    invariantFailures: projections
      .filter(p => !p.validation.ok)
      .map(p => ({ canonicalPlayerId: p.canonicalPlayerId, failures: p.validation.failures })),
  };
}
