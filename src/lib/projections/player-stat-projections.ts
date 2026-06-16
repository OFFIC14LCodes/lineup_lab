import { normalizePrimaryPosition } from "@/lib/players/normalize";
import { normalizeProjectionStats } from "@/lib/projections/stat-aliases";

export type ProjectionRange = {
  floor: number | null;
  median: number | null;
  ceiling: number | null;
};

export type ProjectionConfidence = "very_low" | "low" | "medium" | "high";

export type PlayerStatProjection = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  season: number;
  projectionVersion: string;
  projectionUnit: "season";
  projectionType: "veteran" | "rookie" | "fallback" | "unknown";
  confidence: ProjectionConfidence;
  dataGaps: string[];
  reasons: string[];
  stats: Record<string, ProjectionRange>;
  fantasyPointsByLeague?: Record<string, {
    scoringFingerprint: string;
    floor: number | null;
    median: number | null;
    ceiling: number | null;
    scoringKeysApplied: string[];
    unsupportedScoringKeys: string[];
    missingProjectedStats: string[];
    warnings: string[];
  }>;
};

export type HistoricalStatInput = {
  season: number;
  gamesPlayed?: number | null;
  stats: Record<string, unknown>;
};

export type PlayerStatProjectionInput = {
  playerId: string;
  playerName: string;
  position: string | null;
  team?: string | null;
  season: number;
  age?: number | null;
  yearsExperience?: number | null;
  historical?: HistoricalStatInput[];
  rookieContext?: {
    rookieYear?: number | null;
    draftCapitalScore?: number | null;
    collegeStatsAvailable?: boolean;
    dataGaps?: string[];
  } | null;
};

export const COMPREHENSIVE_STAT_PROJECTION_VERSION = "comprehensive-stat-projections-v1";

const POSITION_KEYS: Record<string, string[]> = {
  QB: ["pass_att", "pass_cmp", "pass_yd", "pass_td", "pass_int", "rush_att", "rush_yd", "rush_td", "fum", "fum_lost", "pass_fd", "rush_fd", "two_pt"],
  RB: ["rush_att", "rush_yd", "rush_td", "target", "rec", "rec_yd", "rec_td", "fum", "fum_lost", "rush_fd", "rec_fd", "two_pt"],
  WR: ["target", "rec", "rec_yd", "rec_td", "rush_att", "rush_yd", "rush_td", "fum", "fum_lost", "rec_fd", "two_pt"],
  TE: ["target", "rec", "rec_yd", "rec_td", "fum", "fum_lost", "rec_fd", "two_pt"],
  K: ["pat_att", "pat_made", "pat_miss", "fg_att", "fg_made", "fg_miss", "fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50p"],
  DEF: ["sack", "def_int", "fr", "ff", "def_td", "st_td", "safety", "blk_kick"],
  DL: ["solo_tkl", "ast_tkl", "total_tkl", "tfl", "sack", "qb_hit", "ff", "fr", "pass_def", "def_td"],
  LB: ["solo_tkl", "ast_tkl", "total_tkl", "tfl", "sack", "qb_hit", "ff", "fr", "pass_def", "def_int", "def_td"],
  DB: ["solo_tkl", "ast_tkl", "total_tkl", "pass_def", "def_int", "sack", "tfl", "ff", "fr", "def_td"],
};

const ROOKIE_BASELINES: Record<string, Record<string, number>> = {
  QB: { pass_att: 260, pass_cmp: 158, pass_yd: 1800, pass_td: 10, pass_int: 8, rush_att: 45, rush_yd: 210, rush_td: 2, fum: 5, fum_lost: 2 },
  RB: { rush_att: 115, rush_yd: 495, rush_td: 4, target: 35, rec: 24, rec_yd: 180, rec_td: 1, fum: 2, fum_lost: 1 },
  WR: { target: 72, rec: 43, rec_yd: 545, rec_td: 3, rush_att: 3, rush_yd: 18, rush_td: 0.1, fum: 1, fum_lost: 0.4 },
  TE: { target: 45, rec: 28, rec_yd: 310, rec_td: 2, fum: 0.8, fum_lost: 0.3 },
  DL: { solo_tkl: 24, ast_tkl: 14, total_tkl: 38, tfl: 5, sack: 4, qb_hit: 8, ff: 1, fr: 0.4, pass_def: 1 },
  LB: { solo_tkl: 55, ast_tkl: 32, total_tkl: 87, tfl: 5, sack: 2.5, qb_hit: 5, pass_def: 3, def_int: 0.5, ff: 1 },
  DB: { solo_tkl: 45, ast_tkl: 22, total_tkl: 67, pass_def: 5, def_int: 1.2, sack: 0.5, tfl: 2, ff: 0.8 },
  K: { pat_att: 34, pat_made: 32, fg_att: 26, fg_made: 21, fg_miss: 5 },
};

export function buildPlayerStatProjection(input: PlayerStatProjectionInput): PlayerStatProjection {
  const position = normalizePrimaryPosition(input.position) ?? input.position?.toUpperCase() ?? "UNK";
  const historical = [...(input.historical ?? [])].sort((a, b) => b.season - a.season);
  const isRookie = (input.yearsExperience ?? input.rookieContext?.rookieYear ?? null) === 0 || Boolean(input.rookieContext && !historical.length);
  if (isRookie && !historical.length) return buildRookieProjection(input, position);
  if (historical.length) return buildVeteranProjection(input, position, historical);
  return buildFallbackProjection(input, position);
}

export function projectionMedianStats(projection: PlayerStatProjection): Record<string, number> {
  return Object.fromEntries(
    Object.entries(projection.stats)
      .filter((entry): entry is [string, ProjectionRange & { median: number }] => entry[1].median !== null)
      .map(([key, range]) => [key, range.median])
  );
}

function buildVeteranProjection(input: PlayerStatProjectionInput, position: string, historical: HistoricalStatInput[]): PlayerStatProjection {
  const weights = [0.62, 0.28, 0.1];
  const weighted: Record<string, { sum: number; weight: number }> = {};
  historical.slice(0, 3).forEach((season, index) => {
    const stats = normalizeProjectionStats(season.stats, { position });
    const weight = weights[index] ?? 0.05;
    for (const [key, value] of Object.entries(stats)) {
      weighted[key] = weighted[key] ?? { sum: 0, weight: 0 };
      weighted[key].sum += value * weight;
      weighted[key].weight += weight;
    }
  });
  const keys = new Set([...(POSITION_KEYS[position] ?? []), ...Object.keys(weighted)]);
  const stats: Record<string, ProjectionRange> = {};
  for (const key of keys) {
    const median = weighted[key]?.weight ? weighted[key].sum / weighted[key].weight : null;
    if (median === null) continue;
    stats[key] = makeRange(regressSparse(key, median), position, "veteran");
  }
  addDerivedRateStats(stats);
  return {
    playerId: input.playerId,
    playerName: input.playerName,
    position,
    team: input.team ?? null,
    season: input.season,
    projectionVersion: COMPREHENSIVE_STAT_PROJECTION_VERSION,
    projectionUnit: "season",
    projectionType: "veteran",
    confidence: historical.length >= 2 ? "medium" : "low",
    dataGaps: historical.length >= 2 ? [] : ["limited historical seasons"],
    reasons: ["Weighted recent historical stat production.", "Sparse touchdown/turnover events are regressed."],
    stats,
  };
}

function buildRookieProjection(input: PlayerStatProjectionInput, position: string): PlayerStatProjection {
  const baseline = ROOKIE_BASELINES[position] ?? {};
  const draftCapital = input.rookieContext?.draftCapitalScore ?? null;
  const opportunity = draftCapital === null ? 0.68 : 0.55 + Math.max(0, Math.min(1, draftCapital / 100)) * 0.55;
  const stats = Object.fromEntries(
    Object.entries(baseline).map(([key, value]) => [key, makeRange(value * opportunity, position, "rookie")])
  );
  addDerivedRateStats(stats);
  const dataGaps = [
    ...(input.rookieContext?.dataGaps ?? []),
    input.rookieContext?.collegeStatsAvailable ? null : "missing college production profile",
    draftCapital === null ? "missing NFL draft capital" : null,
    "rookie role uncertainty",
  ].filter((gap): gap is string => Boolean(gap));
  return {
    playerId: input.playerId,
    playerName: input.playerName,
    position,
    team: input.team ?? null,
    season: input.season,
    projectionVersion: COMPREHENSIVE_STAT_PROJECTION_VERSION,
    projectionUnit: "season",
    projectionType: "rookie",
    confidence: draftCapital !== null || input.rookieContext?.collegeStatsAvailable ? "low" : "very_low",
    dataGaps,
    reasons: [
      "Rookie projection uses conservative position baseline.",
      draftCapital === null ? "Draft capital unavailable; opportunity is conservative." : "Draft capital informs opportunity, not elite outcome.",
    ],
    stats,
  };
}

function buildFallbackProjection(input: PlayerStatProjectionInput, position: string): PlayerStatProjection {
  return {
    playerId: input.playerId,
    playerName: input.playerName,
    position,
    team: input.team ?? null,
    season: input.season,
    projectionVersion: COMPREHENSIVE_STAT_PROJECTION_VERSION,
    projectionUnit: "season",
    projectionType: "fallback",
    confidence: "very_low",
    dataGaps: ["missing historical stats", "missing rookie projection inputs"],
    reasons: ["No safe stat projection source was available."],
    stats: {},
  };
}

function makeRange(median: number, position: string, type: "veteran" | "rookie"): ProjectionRange {
  const spread = type === "rookie" ? 0.48 : position === "K" || position === "DEF" ? 0.34 : 0.26;
  const roundedMedian = roundStat(median);
  return {
    floor: Math.max(0, roundStat(median * (1 - spread))),
    median: roundedMedian,
    ceiling: Math.max(roundedMedian, roundStat(median * (1 + spread))),
  };
}

function regressSparse(key: string, value: number): number {
  if (["def_td", "fr_td", "safety", "blk_kick", "st_td", "two_pt"].includes(key)) return value * 0.55;
  if (key.endsWith("_td") || key === "pass_td" || key === "rush_td" || key === "rec_td") return value * 0.9;
  return value;
}

function addDerivedRateStats(stats: Record<string, ProjectionRange>) {
  deriveRate(stats, "ypc", "rush_yd", "rush_att");
  deriveRate(stats, "ypr", "rec_yd", "rec");
  deriveRate(stats, "cmp_pct", "pass_cmp", "pass_att", 100);
  deriveRate(stats, "fg_pct", "fg_made", "fg_att", 100);
  deriveRate(stats, "pat_pct", "pat_made", "pat_att", 100);
}

function deriveRate(stats: Record<string, ProjectionRange>, key: string, numerator: string, denominator: string, multiplier = 1) {
  const n = stats[numerator]?.median;
  const d = stats[denominator]?.median;
  if (n === null || n === undefined || !d) return;
  const median = (n / d) * multiplier;
  stats[key] = { floor: roundStat(median), median: roundStat(median), ceiling: roundStat(median) };
}

function roundStat(value: number): number {
  return Math.round(value * 10) / 10;
}
