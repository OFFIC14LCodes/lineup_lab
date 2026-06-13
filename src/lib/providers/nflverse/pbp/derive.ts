import { parsePbpFlag, parsePbpNumeric, parsePbpString, PBP_REGULAR_SEASON_TYPE } from "./schema";
import type { NflversePbpRaw } from "./schema";

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

// Accumulated derived statistics for one player / season / week combination.
// All counters are integers ≥ 0.
export type PlayerWeekDerivedStats = {
  rec_td_40p: number;
  rec_td_50p: number;
  rush_td_40p: number;
  rush_td_50p: number;
  pass_pick6: number;
};

export function emptyDerivedStats(): PlayerWeekDerivedStats {
  return { rec_td_40p: 0, rec_td_50p: 0, rush_td_40p: 0, rush_td_50p: 0, pass_pick6: 0 };
}

export type PlayEligibilityOutcome =
  | "eligible"
  | "excluded_non_regular_season"
  | "excluded_nullified_play"
  | "excluded_two_point_attempt"
  | "excluded_no_scoring_event"
  | "excluded_no_applicable_event"
  | "excluded_missing_player_id"
  | "excluded_wrong_team_td"
  | "info_non_offensive_return_td";

export type ExcludedEventRecord = {
  gameId: string;
  playId: string;
  week: number;
  reason: PlayEligibilityOutcome;
  detail: string;
};

export type ResolvedEventRecord = {
  gameId: string;
  playId: string;
  week: number;
  gsisId: string;
  eventType: "rec_td_long" | "rush_td_long" | "pick_six";
  yardsGained: number | null;
};

export type UnresolvedEventRecord = {
  gameId: string;
  playId: string;
  week: number;
  eventType: "rec_td_long" | "rush_td_long" | "pick_six";
  reason: "missing_player_id";
};

export type DerivePlayResult = {
  // Natural key for accumulation
  gsisId: string | null;
  week: number;
  // Increments to apply (any subset of the derived keys)
  increments: Partial<PlayerWeekDerivedStats>;
  // Outcome metadata
  resolved: ResolvedEventRecord[];
  unresolved: UnresolvedEventRecord[];
  excluded: ExcludedEventRecord[];
};

// ---------------------------------------------------------------------------
// Play eligibility predicate — shared across all derivation paths
// ---------------------------------------------------------------------------

export type PlayEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: PlayEligibilityOutcome; detail: string };

export function checkPlayEligibility(
  raw: NflversePbpRaw,
  week: number,
  gameId: string,
  playId: string
): PlayEligibilityResult {
  const seasonType = raw["season_type"]?.trim().toUpperCase();
  if (seasonType !== PBP_REGULAR_SEASON_TYPE) {
    return { eligible: false, reason: "excluded_non_regular_season", detail: `season_type=${raw["season_type"]}` };
  }

  const playDeleted = parsePbpFlag(raw["play_deleted"]);
  if (playDeleted) {
    return { eligible: false, reason: "excluded_nullified_play", detail: `play_id=${playId}` };
  }

  const twoPointAttempt = parsePbpFlag(raw["two_point_attempt"]);
  if (twoPointAttempt) {
    return { eligible: false, reason: "excluded_two_point_attempt", detail: `play_id=${playId}` };
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// TD-distance derivation (rec_td_40p / 50p, rush_td_40p / 50p)
// ---------------------------------------------------------------------------

const LONG_TD_THRESHOLD_40 = 40;
const LONG_TD_THRESHOLD_50 = 50;

export function deriveReceivingTdDistance(raw: NflversePbpRaw): DerivePlayResult {
  const week = parsePbpNumeric(raw["week"]) ?? 0;
  const gameId = parsePbpString(raw["game_id"]) ?? "";
  const playId = parsePbpString(raw["play_id"]) ?? "";

  const eligibility = checkPlayEligibility(raw, week, gameId, playId);
  if (!eligibility.eligible) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: eligibility.reason, detail: eligibility.detail }] };
  }

  const passTouch = parsePbpFlag(raw["pass_touchdown"]);
  if (!passTouch) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: "excluded_no_applicable_event", detail: "pass_touchdown=0" }] };
  }

  const receiverGsisId = parsePbpString(raw["receiver_player_id"]);
  const yardsGained = parsePbpNumeric(raw["yards_gained"]);

  if (!receiverGsisId) {
    const unresolved: UnresolvedEventRecord = { gameId, playId, week, eventType: "rec_td_long", reason: "missing_player_id" };
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [unresolved], excluded: [] };
  }

  if (yardsGained === null || yardsGained < LONG_TD_THRESHOLD_40) {
    // Under 40 yards — no long-TD increment needed, but play is otherwise valid.
    return { gsisId: receiverGsisId, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: "excluded_no_scoring_event", detail: `yards_gained=${yardsGained}` }] };
  }

  const increments: Partial<PlayerWeekDerivedStats> = { rec_td_40p: 1 };
  if (yardsGained >= LONG_TD_THRESHOLD_50) {
    increments.rec_td_50p = 1;
  }

  const resolved: ResolvedEventRecord = { gameId, playId, week, gsisId: receiverGsisId, eventType: "rec_td_long", yardsGained };
  return { gsisId: receiverGsisId, week, increments, resolved: [resolved], unresolved: [], excluded: [] };
}

export function deriveRushingTdDistance(raw: NflversePbpRaw): DerivePlayResult {
  const week = parsePbpNumeric(raw["week"]) ?? 0;
  const gameId = parsePbpString(raw["game_id"]) ?? "";
  const playId = parsePbpString(raw["play_id"]) ?? "";

  const eligibility = checkPlayEligibility(raw, week, gameId, playId);
  if (!eligibility.eligible) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: eligibility.reason, detail: eligibility.detail }] };
  }

  const rushTouch = parsePbpFlag(raw["rush_touchdown"]);
  if (!rushTouch) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: "excluded_no_applicable_event", detail: "rush_touchdown=0" }] };
  }

  const rusherGsisId = parsePbpString(raw["rusher_player_id"]);
  const yardsGained = parsePbpNumeric(raw["yards_gained"]);

  if (!rusherGsisId) {
    const unresolved: UnresolvedEventRecord = { gameId, playId, week, eventType: "rush_td_long", reason: "missing_player_id" };
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [unresolved], excluded: [] };
  }

  if (yardsGained === null || yardsGained < LONG_TD_THRESHOLD_40) {
    return { gsisId: rusherGsisId, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: "excluded_no_scoring_event", detail: `yards_gained=${yardsGained}` }] };
  }

  const increments: Partial<PlayerWeekDerivedStats> = { rush_td_40p: 1 };
  if (yardsGained >= LONG_TD_THRESHOLD_50) {
    increments.rush_td_50p = 1;
  }

  const resolved: ResolvedEventRecord = { gameId, playId, week, gsisId: rusherGsisId, eventType: "rush_td_long", yardsGained };
  return { gsisId: rusherGsisId, week, increments, resolved: [resolved], unresolved: [], excluded: [] };
}

// ---------------------------------------------------------------------------
// Pick-six derivation (pass_pick6)
// ---------------------------------------------------------------------------

export function derivePickSix(raw: NflversePbpRaw): DerivePlayResult {
  const week = parsePbpNumeric(raw["week"]) ?? 0;
  const gameId = parsePbpString(raw["game_id"]) ?? "";
  const playId = parsePbpString(raw["play_id"]) ?? "";

  const eligibility = checkPlayEligibility(raw, week, gameId, playId);
  if (!eligibility.eligible) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: eligibility.reason, detail: eligibility.detail }] };
  }

  // Must be an interception play with a return touchdown.
  const isInterception = parsePbpFlag(raw["interception"]);
  const isReturnTd = parsePbpFlag(raw["return_touchdown"]);

  if (!isInterception || !isReturnTd) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: "excluded_no_applicable_event", detail: `interception=${raw["interception"]} return_touchdown=${raw["return_touchdown"]}` }] };
  }

  // Verify the TD was scored by the defending team (defteam), not a special-teams
  // play misclassified here.
  const tdTeam = parsePbpString(raw["td_team"]);
  const defteam = parsePbpString(raw["defteam"]);
  if (tdTeam && defteam && tdTeam !== defteam) {
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [], excluded: [{ gameId, playId, week, reason: "excluded_wrong_team_td", detail: `td_team=${tdTeam} defteam=${defteam}` }] };
  }

  // The passer (the QB who threw the interception) is penalized.
  const passerGsisId = parsePbpString(raw["passer_player_id"]);

  if (!passerGsisId) {
    // Cannot attribute to a QB — report as unresolved without guessing from team context.
    const unresolved: UnresolvedEventRecord = { gameId, playId, week, eventType: "pick_six", reason: "missing_player_id" };
    return { gsisId: null, week, increments: {}, resolved: [], unresolved: [unresolved], excluded: [] };
  }

  const resolved: ResolvedEventRecord = { gameId, playId, week, gsisId: passerGsisId, eventType: "pick_six", yardsGained: null };
  return {
    gsisId: passerGsisId,
    week,
    increments: { pass_pick6: 1 },
    resolved: [resolved],
    unresolved: [],
    excluded: []
  };
}

// ---------------------------------------------------------------------------
// Play router — decides which derivation paths apply to a given play.
// A single play may contribute to multiple paths (e.g., a 55-yard passing TD
// does NOT also produce a pick-six, but this design stays open to future keys).
// ---------------------------------------------------------------------------

export type PlayDerivationSummary = {
  totalIncrementsApplied: number;
  resolved: ResolvedEventRecord[];
  unresolved: UnresolvedEventRecord[];
  excluded: ExcludedEventRecord[];
};

export function derivePlayEvents(raw: NflversePbpRaw): {
  contributions: Map<string, Partial<PlayerWeekDerivedStats>>;
  week: number;
  summary: PlayDerivationSummary;
} {
  const week = parsePbpNumeric(raw["week"]) ?? 0;
  const contributions = new Map<string, Partial<PlayerWeekDerivedStats>>();
  const allResolved: ResolvedEventRecord[] = [];
  const allUnresolved: UnresolvedEventRecord[] = [];
  const allExcluded: ExcludedEventRecord[] = [];

  // Check for passing TD (receiving TD attribution).
  if (parsePbpFlag(raw["pass_touchdown"])) {
    const result = deriveReceivingTdDistance(raw);
    allResolved.push(...result.resolved);
    allUnresolved.push(...result.unresolved);
    allExcluded.push(...result.excluded);
    if (result.gsisId && Object.keys(result.increments).length > 0) {
      mergeIncrements(contributions, result.gsisId, result.increments);
    }
  }

  // Check for rushing TD.
  if (parsePbpFlag(raw["rush_touchdown"])) {
    const result = deriveRushingTdDistance(raw);
    allResolved.push(...result.resolved);
    allUnresolved.push(...result.unresolved);
    allExcluded.push(...result.excluded);
    if (result.gsisId && Object.keys(result.increments).length > 0) {
      mergeIncrements(contributions, result.gsisId, result.increments);
    }
  }

  // Check for pick-six.
  if (parsePbpFlag(raw["interception"]) && parsePbpFlag(raw["return_touchdown"])) {
    const result = derivePickSix(raw);
    allResolved.push(...result.resolved);
    allUnresolved.push(...result.unresolved);
    allExcluded.push(...result.excluded);
    if (result.gsisId && Object.keys(result.increments).length > 0) {
      mergeIncrements(contributions, result.gsisId, result.increments);
    }
  }

  const totalIncrementsApplied = [...contributions.values()].reduce(
    (total, increments) => total + Object.values(increments).reduce((s, v) => s + (v ?? 0), 0),
    0
  );

  return {
    contributions,
    week,
    summary: {
      totalIncrementsApplied,
      resolved: allResolved,
      unresolved: allUnresolved,
      excluded: allExcluded
    }
  };
}

// ---------------------------------------------------------------------------
// Accumulator — merges per-play contributions into a player-week map
// ---------------------------------------------------------------------------

// Key format: "<gsisId>|<week>"
export type DerivedStatsAccumulator = Map<string, PlayerWeekDerivedStats>;

export function makeAccumulatorKey(gsisId: string, week: number): string {
  return `${gsisId}|${week}`;
}

function mergeIncrements(
  target: Map<string, Partial<PlayerWeekDerivedStats>>,
  gsisId: string,
  increments: Partial<PlayerWeekDerivedStats>
): void {
  const existing = target.get(gsisId) ?? {};
  for (const [key, value] of Object.entries(increments) as [keyof PlayerWeekDerivedStats, number][]) {
    existing[key] = (existing[key] ?? 0) + value;
  }
  target.set(gsisId, existing);
}

export function accumulatePlayEvents(
  accumulator: DerivedStatsAccumulator,
  raw: NflversePbpRaw
): PlayDerivationSummary {
  const { contributions, week, summary } = derivePlayEvents(raw);
  for (const [gsisId, increments] of contributions) {
    const accKey = makeAccumulatorKey(gsisId, week);
    const existing = accumulator.get(accKey) ?? emptyDerivedStats();
    for (const [key, value] of Object.entries(increments) as [keyof PlayerWeekDerivedStats, number][]) {
      existing[key] += value;
    }
    accumulator.set(accKey, existing);
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Invariant verification
// ---------------------------------------------------------------------------

export type InvariantViolation = {
  gsisId: string;
  week: number;
  rule: string;
  values: Record<string, number>;
};

export function verifyDerivedStatsInvariants(
  accumulator: DerivedStatsAccumulator
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const [accKey, stats] of accumulator) {
    const [gsisId, weekStr] = accKey.split("|");
    const week = parseInt(weekStr ?? "0", 10);

    if (stats.rec_td_50p > stats.rec_td_40p) {
      violations.push({ gsisId, week, rule: "rec_td_50p <= rec_td_40p", values: { rec_td_40p: stats.rec_td_40p, rec_td_50p: stats.rec_td_50p } });
    }
    if (stats.rush_td_50p > stats.rush_td_40p) {
      violations.push({ gsisId, week, rule: "rush_td_50p <= rush_td_40p", values: { rush_td_40p: stats.rush_td_40p, rush_td_50p: stats.rush_td_50p } });
    }

    // All values must be non-negative integers.
    for (const [key, value] of Object.entries(stats) as [keyof PlayerWeekDerivedStats, number][]) {
      if (!Number.isInteger(value) || value < 0) {
        violations.push({ gsisId, week, rule: `${key} must be a non-negative integer`, values: { [key]: value } });
      }
    }
  }

  return violations;
}
