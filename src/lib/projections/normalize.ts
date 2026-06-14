// H9.1 — stat normalization from player_weekly_stats.stats_json.
//
// stats_json uses Sleeper canonical key names (pass_att, rec_tgt, rush_att, …).
// This module maps those keys to WeeklyStatRow fields, validates values, and
// assembles sorted, duplicate-checked row arrays.
//
// Rules:
//   absent key       → 0 (not an error)
//   non-numeric key  → validation error (NaN/Infinity/non-number)
//   negative opp     → validation error (passAttempts, carries, targets < 0)
//   fumblesLost < 0  → validation error
//   fumRetTd         → from player_weekly_derived_stats, defaults to 0

import type { WeeklyStatRow } from "./types";

// --------------------------------------------------------------------------
// Sleeper canonical key → WeeklyStatRow field mapping
// --------------------------------------------------------------------------

const PASS_ATT_KEY = "pass_att";
const PASS_CMP_KEY = "pass_cmp";
const PASS_YD_KEY = "pass_yd";
const PASS_TD_KEY = "pass_td";
const PASS_INT_KEY = "pass_int";
const PASS_2PT_KEY = "pass_2pt";
const RUSH_ATT_KEY = "rush_att";
const RUSH_YD_KEY = "rush_yd";
const RUSH_TD_KEY = "rush_td";
const RUSH_2PT_KEY = "rush_2pt";
const REC_TGT_KEY = "rec_tgt";
const REC_KEY = "rec";
const REC_YD_KEY = "rec_yd";
const REC_TD_KEY = "rec_td";
const REC_2PT_KEY = "rec_2pt";
const FUM_LOST_KEY = "fum_lost";

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

function extractNumber(json: Record<string, unknown>, key: string): { value: number; error: null } | { value: null; error: string } {
  const raw = json[key];
  if (raw === undefined || raw === null) {
    return { value: 0, error: null };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { value: null, error: `Key "${key}" has non-finite value: ${String(raw)}` };
  }
  return { value: n, error: null };
}

// --------------------------------------------------------------------------
// Single-row normalization
// --------------------------------------------------------------------------

export type NormalizeRowResult =
  | { ok: true; row: WeeklyStatRow }
  | { ok: false; errors: string[] };

export function normalizeStatsRow(
  statsJson: Record<string, unknown>,
  week: number,
  fumRetTd = 0
): NormalizeRowResult {
  const errors: string[] = [];

  const passAttempts = extractNumber(statsJson, PASS_ATT_KEY);
  const completions = extractNumber(statsJson, PASS_CMP_KEY);
  const passingYards = extractNumber(statsJson, PASS_YD_KEY);
  const passingTds = extractNumber(statsJson, PASS_TD_KEY);
  const interceptions = extractNumber(statsJson, PASS_INT_KEY);
  const pass2pt = extractNumber(statsJson, PASS_2PT_KEY);
  const carries = extractNumber(statsJson, RUSH_ATT_KEY);
  const rushingYards = extractNumber(statsJson, RUSH_YD_KEY);
  const rushingTds = extractNumber(statsJson, RUSH_TD_KEY);
  const rush2pt = extractNumber(statsJson, RUSH_2PT_KEY);
  const targets = extractNumber(statsJson, REC_TGT_KEY);
  const receptions = extractNumber(statsJson, REC_KEY);
  const receivingYards = extractNumber(statsJson, REC_YD_KEY);
  const receivingTds = extractNumber(statsJson, REC_TD_KEY);
  const rec2pt = extractNumber(statsJson, REC_2PT_KEY);
  const fumblesLost = extractNumber(statsJson, FUM_LOST_KEY);

  for (const r of [passAttempts, completions, passingYards, passingTds, interceptions,
    pass2pt, carries, rushingYards, rushingTds, rush2pt, targets, receptions,
    receivingYards, receivingTds, rec2pt, fumblesLost]) {
    if (r.error) errors.push(r.error);
  }

  if (errors.length === 0) {
    // Negative opportunity counts are invalid.
    if ((passAttempts.value as number) < 0)
      errors.push(`passAttempts (${passAttempts.value}) must be >= 0`);
    if ((carries.value as number) < 0)
      errors.push(`carries (${carries.value}) must be >= 0`);
    if ((targets.value as number) < 0)
      errors.push(`targets (${targets.value}) must be >= 0`);
    if ((fumblesLost.value as number) < 0)
      errors.push(`fumblesLost (${fumblesLost.value}) must be >= 0`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const twoPointConversions =
    (pass2pt.value as number) + (rush2pt.value as number) + (rec2pt.value as number);

  return {
    ok: true,
    row: {
      week,
      passAttempts: passAttempts.value as number,
      completions: completions.value as number,
      passingYards: passingYards.value as number,
      passingTds: passingTds.value as number,
      interceptions: interceptions.value as number,
      carries: carries.value as number,
      rushingYards: rushingYards.value as number,
      rushingTds: rushingTds.value as number,
      targets: targets.value as number,
      receptions: receptions.value as number,
      receivingYards: receivingYards.value as number,
      receivingTds: receivingTds.value as number,
      fumblesLost: fumblesLost.value as number,
      fumRetTd,
      twoPointConversions,
    },
  };
}

// --------------------------------------------------------------------------
// Multi-row normalization
// --------------------------------------------------------------------------

export type RawStatRow = {
  week: number;
  statsJson: Record<string, unknown>;
  fumRetTd?: number;
};

export type DuplicateWeekReport = {
  week: number;
  count: number;
};

export type NormalizedPlayerStats = {
  rows: WeeklyStatRow[];           // sorted ascending by week
  duplicateWeeks: DuplicateWeekReport[];
};

export type NormalizePlayerResult =
  | { ok: true; stats: NormalizedPlayerStats }
  | { ok: false; errors: string[] };

export function normalizePlayerStats(rawRows: RawStatRow[]): NormalizePlayerResult {
  const errors: string[] = [];
  const normalized: WeeklyStatRow[] = [];

  for (const raw of rawRows) {
    const result = normalizeStatsRow(raw.statsJson, raw.week, raw.fumRetTd ?? 0);
    if (!result.ok) {
      errors.push(...result.errors.map(e => `week ${raw.week}: ${e}`));
    } else {
      normalized.push(result.row);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Detect duplicate weeks
  const weekCounts = new Map<number, number>();
  for (const row of normalized) {
    weekCounts.set(row.week, (weekCounts.get(row.week) ?? 0) + 1);
  }
  const duplicateWeeks: DuplicateWeekReport[] = [];
  for (const [week, count] of weekCounts) {
    if (count > 1) duplicateWeeks.push({ week, count });
  }

  // Sort rows ascending by week
  const rows = [...normalized].sort((a, b) => a.week - b.week);

  return { ok: true, stats: { rows, duplicateWeeks } };
}
