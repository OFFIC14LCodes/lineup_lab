import { auditLeagueRoster, IDP_SCORING_KEYS, KICKER_SCORING_KEYS } from "@/lib/projections/idp-dst-k-audit";
import { normalizePositionGroup } from "@/lib/players/normalize";
import { scoreFantasyStats } from "@/lib/scoring";

export type H910Scenario = "downside" | "floor" | "median" | "ceiling" | "upside";
export type H910Position = "DL" | "LB" | "DB" | "K";
export type H910Category = "idp" | "kicker";
export type H910IdpRoleClass =
  | "IDP_ESTABLISHED_FULL_SEASON"
  | "IDP_ESTABLISHED_PARTIAL_SEASON"
  | "IDP_ROTATIONAL"
  | "IDP_BIG_PLAY_ONLY"
  | "IDP_MINIMAL_SAMPLE"
  | "IDP_ROLE_UNKNOWN";
export type H910KRoleClass =
  | "K_ESTABLISHED_FULL_SEASON"
  | "K_ESTABLISHED_PARTIAL_SEASON"
  | "K_LOW_SAMPLE"
  | "K_ROLE_UNKNOWN";
export type H910ReasonCode =
  | "IDP_TACKLE_VOLUME_PROJECTED"
  | "IDP_BIG_PLAY_REGRESSION"
  | "IDP_LOW_SAMPLE"
  | "IDP_UNRESOLVED_ROWS_EXCLUDED"
  | "IDP_ROLE_LOW_CONFIDENCE"
  | "IDP_DEFENSIVE_TD_VOLATILITY"
  | "K_VOLUME_PROJECTED_FROM_HISTORY"
  | "K_MAKE_RATE_REGRESSION"
  | "K_DISTANCE_BUCKET_LIMITED"
  | "K_LOW_SAMPLE"
  | "K_TEAM_ENVIRONMENT_NOT_MODELED";

export type H910WeeklyRow = {
  player_id: string | null;
  week: number;
  position_group: string | null;
  stats_json: Record<string, unknown> | null;
};

export type H910PlayerProjection = {
  projectionLabel: "low-confidence baseline";
  canonicalPlayerId: string;
  category: H910Category;
  position: H910Position;
  roleClass: H910IdpRoleClass | H910KRoleClass;
  historicalActiveWeeks: number;
  historicalRoleWeeks: number;
  historicalMeaningfulRoleWeeks: number;
  projectedActiveWeeks: number;
  projectedRoleWeeks: number;
  roleParticipation: number;
  confidence: "low" | "very_low";
  volatility: "medium" | "high" | "extreme";
  reasonCodes: H910ReasonCode[];
  componentsByScenario: Record<H910Scenario, Record<string, number>>;
};

export type H910LeagueInput = {
  leagueId: string;
  leagueName: string;
  season: number;
  rosterPositions: string[];
  scoringSettings: Record<string, unknown>;
};

export type H910LeagueOutput = {
  leagueId: string;
  leagueName: string;
  category: H910Category;
  playerId: string;
  position: H910Position;
  rank: number;
  playersRankedAtPosition: number;
  downsidePoints: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  upsidePoints: number;
  confidence: H910PlayerProjection["confidence"];
  reasonCodes: H910ReasonCode[];
  unsupportedScoringKeys: string[];
  missingStatsForSupportedKeys: Array<{ scoringKey: string; requiredStats: string[] }>;
};

export type H910UnresolvedExclusionSummary = {
  unresolvedRowsExcluded: { idp: number; kicker: number; total: number };
  unresolvedPlayersExcluded: number;
  unresolvedStatVolumeExcluded: { idpPercent: number; kickerPercent: number };
  highPriorityUnresolvedExcluded: number;
};

export const H910_SCENARIOS: H910Scenario[] = ["downside", "floor", "median", "ceiling", "upside"];

const IDP_POSITIONS = new Set<H910Position>(["DL", "LB", "DB"]);
const IDP_STABLE = ["solo_tkl", "ast_tkl", "tkl", "tkl_loss", "qb_hit", "pd"] as const;
const IDP_BIG = ["sack", "int", "ff", "fr", "fr_ret_yd", "int_ret_yd"] as const;
const IDP_EXTREME = ["def_td", "safe", "blk_kick", "def_st_td"] as const;
const K_BUCKET_MADE = ["fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50_59", "fgm_50p", "fgm_60p"] as const;
const K_BUCKET_MISS = ["fgmiss_0_19", "fgmiss_20_29", "fgmiss_30_39", "fgmiss_40_49", "fgmiss_50p"] as const;
const BENEFICIAL = new Set([...IDP_STABLE, ...IDP_BIG, ...IDP_EXTREME, "bonus_sack_2p", "fga", "fgm", "xpa", "xpm", ...K_BUCKET_MADE]);
const HARMFUL = new Set(["fgmiss", "xpmiss", ...K_BUCKET_MISS]);

function num(stats: Record<string, unknown> | null | undefined, key: string): number {
  const value = stats?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 10000) / 10000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sumStats(rows: H910WeeklyRow[], key: string): number {
  return rows.reduce((sum, row) => sum + num(row.stats_json, key), 0);
}

function groupRows(rows: H910WeeklyRow[]): Map<string, H910WeeklyRow[]> {
  const grouped = new Map<string, H910WeeklyRow[]>();
  for (const row of rows) {
    if (!row.player_id) continue;
    const position = normalizeH910Position(row.position_group);
    if (!position) continue;
    grouped.set(row.player_id, [...(grouped.get(row.player_id) ?? []), { ...row, position_group: position }]);
  }
  return grouped;
}

export function normalizeH910Position(position: string | null | undefined): H910Position | null {
  const normalized = normalizePositionGroup(position);
  return normalized === "DL" || normalized === "LB" || normalized === "DB" || normalized === "K" ? normalized : null;
}

function activeWeeks(rows: H910WeeklyRow[]): number {
  return new Set(rows.map((row) => row.week)).size;
}

function idpRoleWeek(row: H910WeeklyRow): boolean {
  const keys = [...IDP_STABLE, ...IDP_BIG, ...IDP_EXTREME];
  return keys.some((key) => num(row.stats_json, key) > 0);
}

function idpMeaningfulWeek(row: H910WeeklyRow): boolean {
  const tackles = num(row.stats_json, "solo_tkl") + num(row.stats_json, "ast_tkl");
  return tackles >= 2 || num(row.stats_json, "sack") >= 0.5 || ["int", "pd", "ff", "fr"].some((key) => num(row.stats_json, key) > 0);
}

function kRoleWeek(row: H910WeeklyRow): boolean {
  return num(row.stats_json, "fga") > 0 || num(row.stats_json, "xpa") > 0 || num(row.stats_json, "fgm") > 0 || num(row.stats_json, "xpm") > 0;
}

function classifyIdp(active: number, role: number, meaningful: number, stats: Record<string, number>): H910IdpRoleClass {
  const bigPlays = (stats.sack ?? 0) + (stats.int ?? 0) + (stats.ff ?? 0) + (stats.fr ?? 0) + (stats.def_td ?? 0);
  const tackles = (stats.solo_tkl ?? 0) + (stats.ast_tkl ?? 0) + (stats.tkl ?? 0);
  if (active < 4) return "IDP_MINIMAL_SAMPLE";
  if (role >= 12 || meaningful >= 10) return "IDP_ESTABLISHED_FULL_SEASON";
  if (role >= 8 || meaningful >= 6) return "IDP_ESTABLISHED_PARTIAL_SEASON";
  if (role >= 4) return "IDP_ROTATIONAL";
  if (bigPlays > 0 && tackles < 10) return "IDP_BIG_PLAY_ONLY";
  return "IDP_ROLE_UNKNOWN";
}

function classifyK(active: number, kickingWeeks: number): H910KRoleClass {
  if (kickingWeeks >= 14) return "K_ESTABLISHED_FULL_SEASON";
  if (kickingWeeks >= 8) return "K_ESTABLISHED_PARTIAL_SEASON";
  if (active > 0 || kickingWeeks > 0) return "K_LOW_SAMPLE";
  return "K_ROLE_UNKNOWN";
}

function positionReferenceRates(rows: H910WeeklyRow[]) {
  const byPosition = new Map<H910Position, H910WeeklyRow[]>();
  for (const row of rows) {
    const position = normalizeH910Position(row.position_group);
    if (!position) continue;
    byPosition.set(position, [...(byPosition.get(position) ?? []), row]);
  }
  const refs = new Map<H910Position, Record<string, number>>();
  for (const [position, scoped] of byPosition.entries()) {
    const denominator = Math.max(1, scoped.filter((row) => position === "K" ? kRoleWeek(row) : idpRoleWeek(row)).length);
    const keys = position === "K" ? ["fga", "fgm", "fgmiss", "xpa", "xpm", "xpmiss", ...K_BUCKET_MADE, ...K_BUCKET_MISS] : [...IDP_STABLE, ...IDP_BIG, ...IDP_EXTREME];
    refs.set(position, Object.fromEntries(keys.map((key) => [key, sumStats(scoped, key) / denominator])));
  }
  return refs;
}

function scenarioStats(median: Record<string, number>, kind: H910Category): Record<H910Scenario, Record<string, number>> {
  const idpMultipliers = {
    downside: { stable: 0.65, big: 0.35, extreme: 0 },
    floor: { stable: 0.8, big: 0.55, extreme: 0 },
    median: { stable: 1, big: 1, extreme: 1 },
    ceiling: { stable: 1.2, big: 1.6, extreme: 2.5 },
    upside: { stable: 1.35, big: 2.2, extreme: 4 },
  } satisfies Record<H910Scenario, Record<string, number>>;
  const kVolume = { downside: 0.75, floor: 0.88, median: 1, ceiling: 1.12, upside: 1.25 } satisfies Record<H910Scenario, number>;
  const output = {} as Record<H910Scenario, Record<string, number>>;
  for (const scenario of H910_SCENARIOS) {
    output[scenario] = {};
    for (const [key, value] of Object.entries(median)) {
      if (kind === "idp") {
        const band = (IDP_BIG as readonly string[]).includes(key) ? "big" : (IDP_EXTREME as readonly string[]).includes(key) ? "extreme" : "stable";
        output[scenario][key] = round(value * idpMultipliers[scenario][band]);
      } else {
        const harmful = HARMFUL.has(key);
        const missMultiplier = { downside: 1.35, floor: 1.15, median: 1, ceiling: 0.88, upside: 0.75 }[scenario];
        output[scenario][key] = round(value * (harmful ? missMultiplier : kVolume[scenario]));
      }
    }
  }
  return output;
}

function projectIdp(playerId: string, rows: H910WeeklyRow[], refs: Record<string, number>, hasUnresolved: boolean): H910PlayerProjection {
  const position = normalizeH910Position(rows[0]?.position_group) as Exclude<H910Position, "K">;
  const active = activeWeeks(rows);
  const role = rows.filter(idpRoleWeek).length;
  const meaningful = rows.filter(idpMeaningfulWeek).length;
  const totals = Object.fromEntries([...IDP_STABLE, ...IDP_BIG, ...IDP_EXTREME].map((key) => [key, sumStats(rows, key)]));
  const roleClass = classifyIdp(active, role, meaningful, totals);
  const participation = active > 0 ? clamp(role / active, 0, 1) : 0;
  const projectedActiveWeeks = roleClass === "IDP_ESTABLISHED_FULL_SEASON" ? 15 : roleClass === "IDP_ESTABLISHED_PARTIAL_SEASON" ? 12 : roleClass === "IDP_ROTATIONAL" ? 8 : Math.max(2, Math.min(6, active));
  const projectedRoleWeeks = round(projectedActiveWeeks * (participation || 0.35));
  const sampleWeight = clamp(role / 12, 0.15, 0.75);
  const median: Record<string, number> = {};
  for (const key of [...IDP_STABLE, ...IDP_BIG, ...IDP_EXTREME]) {
    const playerRate = totals[key] / Math.max(1, role);
    const refRate = refs[key] ?? 0;
    const weight = (IDP_STABLE as readonly string[]).includes(key) ? sampleWeight : (IDP_BIG as readonly string[]).includes(key) ? sampleWeight * 0.45 : sampleWeight * 0.2;
    median[key] = round(((playerRate * weight) + (refRate * (1 - weight))) * projectedRoleWeeks);
  }
  median.tkl = round(Math.max(median.tkl ?? 0, (median.solo_tkl ?? 0) + (median.ast_tkl ?? 0)));
  median.bonus_sack_2p = round((median.sack ?? 0) / 2.5);
  const reasonCodes = new Set<H910ReasonCode>(["IDP_TACKLE_VOLUME_PROJECTED", "IDP_BIG_PLAY_REGRESSION", "IDP_DEFENSIVE_TD_VOLATILITY"]);
  if (hasUnresolved) reasonCodes.add("IDP_UNRESOLVED_ROWS_EXCLUDED");
  if (role < 4) reasonCodes.add("IDP_LOW_SAMPLE");
  if (roleClass === "IDP_ROLE_UNKNOWN" || roleClass === "IDP_BIG_PLAY_ONLY" || roleClass === "IDP_MINIMAL_SAMPLE") reasonCodes.add("IDP_ROLE_LOW_CONFIDENCE");
  return {
    projectionLabel: "low-confidence baseline",
    canonicalPlayerId: playerId,
    category: "idp",
    position,
    roleClass,
    historicalActiveWeeks: active,
    historicalRoleWeeks: role,
    historicalMeaningfulRoleWeeks: meaningful,
    projectedActiveWeeks,
    projectedRoleWeeks,
    roleParticipation: round(participation),
    confidence: role >= 8 ? "low" : "very_low",
    volatility: roleClass === "IDP_ESTABLISHED_FULL_SEASON" ? "high" : "extreme",
    reasonCodes: [...reasonCodes].sort(),
    componentsByScenario: scenarioStats(median, "idp"),
  };
}

function projectK(playerId: string, rows: H910WeeklyRow[], refs: Record<string, number>): H910PlayerProjection {
  const active = activeWeeks(rows);
  const kickingWeeks = rows.filter(kRoleWeek).length;
  const roleClass = classifyK(active, kickingWeeks);
  const projectedActiveWeeks = roleClass === "K_ESTABLISHED_FULL_SEASON" ? 16 : roleClass === "K_ESTABLISHED_PARTIAL_SEASON" ? 12 : Math.max(4, Math.min(8, active));
  const projectedRoleWeeks = projectedActiveWeeks;
  const fga = sumStats(rows, "fga");
  const fgm = sumStats(rows, "fgm");
  const xpa = sumStats(rows, "xpa");
  const xpm = sumStats(rows, "xpm");
  const fgaRate = ((fga / Math.max(1, kickingWeeks)) * 0.65) + ((refs.fga ?? 0) * 0.35);
  const xpaRate = ((xpa / Math.max(1, kickingWeeks)) * 0.65) + ((refs.xpa ?? 0) * 0.35);
  const fgRate = (fgm + 0.84 * 10) / Math.max(1, fga + 10);
  const xpRate = (xpm + 0.94 * 15) / Math.max(1, xpa + 15);
  const projectedFga = round(fgaRate * projectedRoleWeeks);
  const projectedXpa = round(xpaRate * projectedRoleWeeks);
  const median: Record<string, number> = {
    fga: projectedFga,
    fgm: round(projectedFga * fgRate),
    fgmiss: round(projectedFga * (1 - fgRate)),
    xpa: projectedXpa,
    xpm: round(projectedXpa * xpRate),
    xpmiss: round(projectedXpa * (1 - xpRate)),
  };
  for (const key of [...K_BUCKET_MADE, ...K_BUCKET_MISS]) {
    median[key] = 0;
  }
  for (const key of K_BUCKET_MADE) {
    const bucketMade = sumStats(rows, key);
    if (bucketMade > 0 && fgm > 0) median[key] = round(median.fgm * (bucketMade / fgm));
  }
  for (const key of K_BUCKET_MISS) {
    const bucketMiss = sumStats(rows, key);
    const totalMiss = sumStats(rows, "fgmiss");
    if (bucketMiss > 0 && totalMiss > 0) median[key] = round(median.fgmiss * (bucketMiss / totalMiss));
  }
  const reasonCodes = new Set<H910ReasonCode>(["K_VOLUME_PROJECTED_FROM_HISTORY", "K_MAKE_RATE_REGRESSION", "K_DISTANCE_BUCKET_LIMITED", "K_TEAM_ENVIRONMENT_NOT_MODELED"]);
  if (kickingWeeks < 8) reasonCodes.add("K_LOW_SAMPLE");
  return {
    projectionLabel: "low-confidence baseline",
    canonicalPlayerId: playerId,
    category: "kicker",
    position: "K",
    roleClass,
    historicalActiveWeeks: active,
    historicalRoleWeeks: kickingWeeks,
    historicalMeaningfulRoleWeeks: kickingWeeks,
    projectedActiveWeeks,
    projectedRoleWeeks,
    roleParticipation: active > 0 ? round(kickingWeeks / active) : 0,
    confidence: kickingWeeks >= 8 ? "low" : "very_low",
    volatility: kickingWeeks >= 8 ? "medium" : "high",
    reasonCodes: [...reasonCodes].sort(),
    componentsByScenario: scenarioStats(median, "kicker"),
  };
}

export function projectH910Population(input: {
  rows: H910WeeklyRow[];
  includeIdp?: boolean;
  includeKicker?: boolean;
  position?: H910Position | null;
  limit?: number | null;
  playerId?: string | null;
  unresolvedExclusions?: H910UnresolvedExclusionSummary | null;
}): { projections: H910PlayerProjection[]; scenarioInvariantFailures: string[] } {
  const includeIdp = input.includeIdp ?? true;
  const includeKicker = input.includeKicker ?? true;
  const refs = positionReferenceRates(input.rows);
  const groups = groupRows(input.rows);
  const projections: H910PlayerProjection[] = [];
  for (const [playerId, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (input.playerId && input.playerId !== playerId) continue;
    const position = normalizeH910Position(rows[0]?.position_group);
    if (!position || (input.position && input.position !== position)) continue;
    if (position === "K") {
      if (includeKicker) projections.push(projectK(playerId, rows, refs.get("K") ?? {}));
    } else if (includeIdp && IDP_POSITIONS.has(position)) {
      projections.push(projectIdp(playerId, rows, refs.get(position) ?? {}, Boolean(input.unresolvedExclusions?.unresolvedRowsExcluded.total)));
    }
  }
  const scoped = projections.slice(0, input.limit ?? undefined);
  return {
    projections: scoped,
    scenarioInvariantFailures: scoped.flatMap(validateScenarioOrdering),
  };
}

export function validateScenarioOrdering(projection: H910PlayerProjection): string[] {
  const failures: string[] = [];
  const keys = new Set(H910_SCENARIOS.flatMap((scenario) => Object.keys(projection.componentsByScenario[scenario])));
  for (const key of keys) {
    for (let i = 1; i < H910_SCENARIOS.length; i++) {
      const prev = projection.componentsByScenario[H910_SCENARIOS[i - 1]][key] ?? 0;
      const current = projection.componentsByScenario[H910_SCENARIOS[i]][key] ?? 0;
      if (BENEFICIAL.has(key) && prev > current + 0.0001) failures.push(`${projection.canonicalPlayerId}:${key}:beneficial ordering violated`);
      if (HARMFUL.has(key) && prev < current - 0.0001) failures.push(`${projection.canonicalPlayerId}:${key}:harmful ordering violated`);
    }
  }
  return failures;
}

function activeRelevantKeys(settings: Record<string, unknown>, category: H910Category): string[] {
  const keySet = category === "idp" ? new Set<string>(IDP_SCORING_KEYS) : new Set<string>(KICKER_SCORING_KEYS);
  return Object.entries(settings).filter(([, value]) => Number(value) !== 0).map(([key]) => key).filter((key) => keySet.has(key)).sort();
}

function scoreScenario(projection: H910PlayerProjection, league: H910LeagueInput, scenario: H910Scenario) {
  return scoreFantasyStats({
    stats: projection.componentsByScenario[scenario],
    scoringSettings: league.scoringSettings,
    positionGroup: projection.position,
    statSource: "projection",
    context: { season: league.season, playerId: projection.canonicalPlayerId },
  });
}

export function scoreH910Leagues(input: { projections: H910PlayerProjection[]; leagues: H910LeagueInput[] }) {
  const relevantLeagues = input.leagues.filter((league) => {
    const audit = auditLeagueRoster({
      leagueId: league.leagueId,
      leagueName: league.leagueName,
      season: league.season,
      rosterPositions: league.rosterPositions,
      scoringSettings: league.scoringSettings,
    });
    return audit.uses_idp || audit.uses_kicker;
  });
  const outputs: H910LeagueOutput[] = [];
  const unsupportedScoringKeys = new Set<string>();
  for (const league of relevantLeagues) {
    const audit = auditLeagueRoster({
      leagueId: league.leagueId,
      leagueName: league.leagueName,
      season: league.season,
      rosterPositions: league.rosterPositions,
      scoringSettings: league.scoringSettings,
    });
    for (const projection of input.projections) {
      if (projection.category === "idp" && !audit.uses_idp) continue;
      if (projection.category === "kicker" && !audit.uses_kicker) continue;
      const scored = Object.fromEntries(H910_SCENARIOS.map((scenario) => [scenario, scoreScenario(projection, league, scenario)])) as Record<H910Scenario, ReturnType<typeof scoreScenario>>;
      const activeKeys = activeRelevantKeys(league.scoringSettings, projection.category);
      const missing = scored.median.coverage.missingStatsForSupportedKeys.filter((item) => activeKeys.includes(item.scoringKey));
      const unsupported = [...new Set([
        ...scored.median.coverage.unsupportedScoringKeys.filter((key) => activeKeys.includes(key)),
        ...activeKeys.filter((key) => missing.some((item) => item.scoringKey === key)),
      ])].sort();
      unsupported.forEach((key) => unsupportedScoringKeys.add(`${league.leagueId}:${projection.category}:${key}`));
      outputs.push({
        leagueId: league.leagueId,
        leagueName: league.leagueName,
        category: projection.category,
        playerId: projection.canonicalPlayerId,
        position: projection.position,
        rank: 0,
        playersRankedAtPosition: 0,
        downsidePoints: round(scored.downside.totalPoints),
        floorPoints: round(scored.floor.totalPoints),
        medianPoints: round(scored.median.totalPoints),
        ceilingPoints: round(scored.ceiling.totalPoints),
        upsidePoints: round(scored.upside.totalPoints),
        confidence: projection.confidence,
        reasonCodes: projection.reasonCodes,
        unsupportedScoringKeys: unsupported,
        missingStatsForSupportedKeys: missing,
      });
    }
  }
  return {
    idpLeaguesScored: relevantLeagues.filter((league) => auditLeagueRoster({ leagueId: league.leagueId, leagueName: league.leagueName, season: league.season, rosterPositions: league.rosterPositions, scoringSettings: league.scoringSettings }).uses_idp).length,
    kickerLeaguesScored: relevantLeagues.filter((league) => auditLeagueRoster({ leagueId: league.leagueId, leagueName: league.leagueName, season: league.season, rosterPositions: league.rosterPositions, scoringSettings: league.scoringSettings }).uses_kicker).length,
    outputs: rankH910Outputs(outputs),
    unsupportedScoringKeys: [...unsupportedScoringKeys].sort(),
  };
}

function rankH910Outputs(outputs: H910LeagueOutput[]): H910LeagueOutput[] {
  const groups = new Map<string, H910LeagueOutput[]>();
  for (const output of outputs) {
    const key = `${output.leagueId}:${output.position}`;
    groups.set(key, [...(groups.get(key) ?? []), output]);
  }
  return [...groups.values()].flatMap((group) => {
    const sorted = [...group].sort((a, b) => b.medianPoints - a.medianPoints || b.ceilingPoints - a.ceilingPoints || a.playerId.localeCompare(b.playerId));
    return sorted.map((output, index) => ({ ...output, rank: index + 1, playersRankedAtPosition: sorted.length }));
  }).sort((a, b) => a.leagueId.localeCompare(b.leagueId) || a.position.localeCompare(b.position) || a.rank - b.rank);
}
