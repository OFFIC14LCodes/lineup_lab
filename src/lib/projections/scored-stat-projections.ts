import { scoreFantasyStats } from "@/lib/scoring";
import { hashScoringConfig } from "@/lib/projections/hash";
import { projectionMedianStats, type PlayerStatProjection, type ProjectionRange } from "@/lib/projections/player-stat-projections";
import { normalizePrimaryPosition } from "@/lib/players/normalize";

export type ScoredProjection = {
  playerId: string;
  leagueId: string;
  scoringFingerprint: string;
  floorFantasyPoints: number | null;
  medianFantasyPoints: number | null;
  ceilingFantasyPoints: number | null;
  statContributions: Array<{
    statKey: string;
    projectedFloor: number | null;
    projectedMedian: number | null;
    projectedCeiling: number | null;
    scoringValue: number;
    floorPoints: number | null;
    medianPoints: number | null;
    ceilingPoints: number | null;
  }>;
  unsupportedScoringKeys: string[];
  missingProjectedStats: string[];
  warnings: string[];
};

export type LeagueScoringProjectionInput = {
  leagueId: string;
  scoringSettings: Record<string, unknown>;
};

export function scorePlayerStatProjectionForLeague(
  projection: PlayerStatProjection,
  league: LeagueScoringProjectionInput
): ScoredProjection {
  const scoringSettings = normalizeProjectionScoringSettings(league.scoringSettings);
  const floorStats = scenarioStats(projection.stats, "floor");
  const medianStats = expandScoringAliases(projectionMedianStats(projection));
  const ceilingStats = scenarioStats(projection.stats, "ceiling");
  const positionGroup = normalizePrimaryPosition(projection.position);
  const floor = Object.keys(floorStats).length ? scoreFantasyStats({ stats: floorStats, scoringSettings, positionGroup, statSource: "projection" }) : null;
  const median = Object.keys(medianStats).length ? scoreFantasyStats({ stats: medianStats, scoringSettings, positionGroup, statSource: "projection" }) : null;
  const ceiling = Object.keys(ceilingStats).length ? scoreFantasyStats({ stats: ceilingStats, scoringSettings, positionGroup, statSource: "projection" }) : null;
  const coverage = median?.coverage ?? floor?.coverage ?? ceiling?.coverage ?? null;
  const contributionByStat = new Map<string, ScoredProjection["statContributions"][number]>();
  const floorByStat = componentPointsByStat(floor);
  const medianByStat = componentPointsByStat(median);
  const ceilingByStat = componentPointsByStat(ceiling);
  for (const [statKey, range] of Object.entries(projection.stats)) {
    const scoringValue = median?.components.find((component) => component.statKey === statKey)?.scoringValue ?? 0;
    contributionByStat.set(statKey, {
      statKey,
      projectedFloor: range.floor,
      projectedMedian: range.median,
      projectedCeiling: range.ceiling,
      scoringValue,
      floorPoints: floorByStat.get(statKey) ?? null,
      medianPoints: medianByStat.get(statKey) ?? null,
      ceilingPoints: ceilingByStat.get(statKey) ?? null,
    });
  }
  const orderedPoints = orderedFantasyPoints(
    roundPoints(floor?.totalPoints ?? null),
    roundPoints(median?.totalPoints ?? null),
    roundPoints(ceiling?.totalPoints ?? null)
  );
  return {
    playerId: projection.playerId,
    leagueId: league.leagueId,
    scoringFingerprint: hashScoringConfig(league.leagueId, scoringSettings),
    floorFantasyPoints: orderedPoints.floor,
    medianFantasyPoints: orderedPoints.median,
    ceilingFantasyPoints: orderedPoints.ceiling,
    statContributions: Array.from(contributionByStat.values()).filter((row) => row.scoringValue !== 0 || row.medianPoints !== null),
    unsupportedScoringKeys: coverage?.unsupportedScoringKeys ?? [],
    missingProjectedStats: coverage?.missingStatsForSupportedKeys.flatMap((row) => row.requiredStats.map((stat) => `${row.scoringKey}:${stat}`)) ?? [],
    warnings: [
      ...(floor?.warnings ?? []),
      ...(median?.warnings ?? []),
      ...(ceiling?.warnings ?? []),
    ].map((warning) => warning.message),
  };
}

function normalizeProjectionScoringSettings(scoringSettings: Record<string, unknown>): Record<string, unknown> {
  const aliases: Record<string, string> = {
    tkl_solo: "solo_tkl",
    tkl_ast: "ast_tkl",
    tackles_for_loss: "tkl_loss",
    pass_def: "pd",
    passes_defended: "pd",
    def_int: "int",
    idp_tkl_solo: "solo_tkl",
    idp_tkl_ast: "ast_tkl",
    idp_tkl: "tkl",
    idp_tkl_loss: "tkl_loss",
    idp_qb_hit: "qb_hit",
    idp_pass_def: "pd",
    idp_int: "int",
    idp_sack: "sack",
    idp_ff: "ff",
    idp_fum_rec: "fr",
    idp_def_td: "def_td",
    idp_safe: "safe",
    idp_blk_kick: "blk_kick",
    idp_int_ret_yd: "int_ret_yd",
    idp_fum_ret_yd: "fr_ret_yd",
    st_td: "def_st_td",
    pat_made: "xpm",
    pat_miss: "xpmiss",
    fg_made: "fgm",
    fg_miss: "fgmiss",
  };
  const normalized: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(scoringSettings)) {
    const key = rawKey.trim().toLowerCase();
    normalized[aliases[key] ?? key] = value;
  }
  return normalized;
}

export function attachFantasyPointsByLeague(
  projections: PlayerStatProjection[],
  leagues: LeagueScoringProjectionInput[]
): PlayerStatProjection[] {
  return projections.map((projection) => {
    const fantasyPointsByLeague: NonNullable<PlayerStatProjection["fantasyPointsByLeague"]> = {};
    for (const league of leagues) {
      const scored = scorePlayerStatProjectionForLeague(projection, league);
      fantasyPointsByLeague[league.leagueId] = {
        scoringFingerprint: scored.scoringFingerprint,
        floor: scored.floorFantasyPoints,
        median: scored.medianFantasyPoints,
        ceiling: scored.ceilingFantasyPoints,
        scoringKeysApplied: scored.statContributions.filter((row) => row.scoringValue !== 0).map((row) => row.statKey).sort(),
        unsupportedScoringKeys: scored.unsupportedScoringKeys,
        missingProjectedStats: scored.missingProjectedStats,
        warnings: scored.warnings,
      };
    }
    return { ...projection, fantasyPointsByLeague };
  });
}

function scenarioStats(stats: Record<string, ProjectionRange>, scenario: keyof ProjectionRange): Record<string, number> {
  const raw = Object.fromEntries(
    Object.entries(stats)
      .filter((entry): entry is [string, ProjectionRange & Record<typeof scenario, number>] => entry[1][scenario] !== null)
      .map(([key, range]) => [key, range[scenario]])
  );
  return expandScoringAliases(raw);
}

function expandScoringAliases(stats: Record<string, number>): Record<string, number> {
  const expanded = { ...stats };
  const aliases: Record<string, string> = {
    target: "rec_tgt",
    total_tkl: "tkl",
    tfl: "tkl_loss",
    pass_def: "pd",
    def_int: "int",
    safety: "safe",
    fg_made: "fgm",
    fg_miss: "fgmiss",
    pat_made: "xpm",
    pat_miss: "xpmiss",
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (expanded[from] !== undefined && expanded[to] === undefined) expanded[to] = expanded[from];
  }
  return expanded;
}

function componentPointsByStat(result: ReturnType<typeof scoreFantasyStats> | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const component of result?.components ?? []) {
    map.set(component.statKey, (map.get(component.statKey) ?? 0) + component.points);
  }
  return map;
}

function roundPoints(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function orderedFantasyPoints(floor: number | null, median: number | null, ceiling: number | null) {
  if (floor === null || median === null || ceiling === null) return { floor, median, ceiling };
  const ordered = [floor, median, ceiling].sort((a, b) => a - b);
  return { floor: ordered[0], median: ordered[1], ceiling: ordered[2] };
}
