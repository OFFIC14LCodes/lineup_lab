import { auditLeagueRoster } from "@/lib/projections/idp-dst-k-audit";
import { POINTS_ALLOWED_BUCKETS, YARDS_ALLOWED_BUCKETS, selectPointsAllowedBucket, selectYardsAllowedBucket } from "@/lib/scoring/team-defense-allowance";

export const H912_PROJECTION_METHOD = "blackbird_dst_allowance_baseline_v1";
export const H912_PROJECTION_VERSION = 1;
export const H912_SELECTION_SCOPE = "dst";

export const H912_BIG_PLAY_COMPONENTS = [
  "sacks",
  "interceptions",
  "fumble_recoveries",
  "forced_fumbles",
  "defensive_tds",
  "safeties",
  "blocked_kicks",
  "return_tds",
  "two_point_returns",
] as const;

export type H912TeamGameRow = {
  game_id: string;
  season: number;
  week: number;
  season_type: string;
  team_id: string;
  opponent_id: string | null;
  points_allowed: number | null;
  yards_allowed: number | null;
  reconciliation_status: string | null;
};

export type H912LeagueInput = {
  leagueId: string;
  leagueName: string;
  season: number;
  rosterPositions: string[];
  scoringSettings: Record<string, unknown>;
};

export type H912DataCoverageRow = {
  dst_component: string;
  source_available: boolean;
  projectable_now: boolean;
  projection_policy: "PROJECTED_FROM_TEAM_GAME_STATS" | "EXPLICITLY_UNAVAILABLE_ZEROED_LOW_CONFIDENCE";
  reason_code: "DST_ALLOWANCE_FROM_TEAM_GAME_STATS" | "DST_BIG_PLAY_COMPONENTS_UNAVAILABLE";
  notes: string;
};

export type H912TeamProjection = {
  team: string;
  position: "DST";
  historicalGames: number;
  projectedGames: number;
  pointsAllowedPerGame: number;
  yardsAllowedPerGame: number;
  pointsAllowedDistribution: Record<string, number>;
  yardsAllowedDistribution: Record<string, number>;
  expectedPointsAllowedBucketHits: Record<string, number>;
  expectedYardsAllowedBucketHits: Record<string, number>;
  projectedComponents: Record<string, number>;
  confidence: "low" | "very_low";
  reasonCodes: string[];
};

export type H912LeagueOutput = {
  leagueId: string;
  leagueName: string;
  team: string;
  position: "DST";
  downsidePoints: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  upsidePoints: number;
  projectedPositionRank: number;
  confidence: "low" | "very_low";
  scoringReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY";
  reasonCodes: string[];
  materialMissingScoringKeys: string[];
  projectedComponents: Record<string, number>;
};

export type H912ProjectionResult = {
  dataCoverage: H912DataCoverageRow[];
  teamProjections: H912TeamProjection[];
  leagueOutputs: H912LeagueOutput[];
  invariantFailures: string[];
  persistenceRecommendation: {
    implemented: false;
    verdict: "H9.12 DST DRY RUN READY — PERSISTENCE DEFERRED";
    reason: string;
  };
};

const PROJECTED_GAMES = 17;
const SHRINKAGE_PRIOR_GAMES = 4;
const ALLOWANCE_REASON_CODES = ["DST_SCHEDULE_NOT_MODELED", "DST_LOW_CONFIDENCE_BASELINE", "DST_BIG_PLAY_COMPONENTS_UNAVAILABLE"] as const;
const POINT_BUCKET_KEYS = POINTS_ALLOWED_BUCKETS.map((bucket) => bucket.key);
const YARD_BUCKET_KEYS = YARDS_ALLOWED_BUCKETS.map((bucket) => bucket.key);

export function buildH912DataCoverage(): H912DataCoverageRow[] {
  return [
    {
      dst_component: "points_allowed",
      source_available: true,
      projectable_now: true,
      projection_policy: "PROJECTED_FROM_TEAM_GAME_STATS",
      reason_code: "DST_ALLOWANCE_FROM_TEAM_GAME_STATS",
      notes: "Available per team-game row and projected as expected weekly bucket hits.",
    },
    {
      dst_component: "yards_allowed",
      source_available: true,
      projectable_now: true,
      projection_policy: "PROJECTED_FROM_TEAM_GAME_STATS",
      reason_code: "DST_ALLOWANCE_FROM_TEAM_GAME_STATS",
      notes: "Available per team-game row and projected as expected weekly bucket hits.",
    },
    ...H912_BIG_PLAY_COMPONENTS.map((component) => ({
      dst_component: component,
      source_available: false,
      projectable_now: false,
      projection_policy: "EXPLICITLY_UNAVAILABLE_ZEROED_LOW_CONFIDENCE" as const,
      reason_code: "DST_BIG_PLAY_COMPONENTS_UNAVAILABLE" as const,
      notes: "Not available in team_game_stats or current player weekly/derived DST rows; H9.12 does not fabricate this component.",
    })),
  ];
}

export function projectH912DstPopulation(rows: H912TeamGameRow[], teamFilter: string | null = null): H912TeamProjection[] {
  const regularRows = rows
    .filter((row) => isRegularSeason(row.season_type))
    .filter((row) => row.points_allowed !== null && row.yards_allowed !== null)
    .filter((row) => !teamFilter || row.team_id.toUpperCase() === teamFilter.toUpperCase());
  const population = bucketRates(regularRows);
  const byTeam = groupBy(regularRows, (row) => row.team_id);

  return [...byTeam.entries()]
    .map(([team, teamRows]) => {
      const pointsDistribution = countBuckets(teamRows, "points_allowed");
      const yardsDistribution = countBuckets(teamRows, "yards_allowed");
      const pointsHits = shrinkHits(pointsDistribution, teamRows.length, population.pointsRates, PROJECTED_GAMES);
      const yardsHits = shrinkHits(yardsDistribution, teamRows.length, population.yardsRates, PROJECTED_GAMES);
      const projectedComponents = Object.fromEntries([
        ...Object.entries(pointsHits),
        ...Object.entries(yardsHits),
        ...H912_BIG_PLAY_COMPONENTS.map((component) => [bigPlayScoringKey(component), 0]),
      ]);

      return {
        team,
        position: "DST" as const,
        historicalGames: teamRows.length,
        projectedGames: PROJECTED_GAMES,
        pointsAllowedPerGame: round(avg(teamRows.map((row) => row.points_allowed ?? 0)), 2),
        yardsAllowedPerGame: round(avg(teamRows.map((row) => row.yards_allowed ?? 0)), 2),
        pointsAllowedDistribution: pointsDistribution,
        yardsAllowedDistribution: yardsDistribution,
        expectedPointsAllowedBucketHits: pointsHits,
        expectedYardsAllowedBucketHits: yardsHits,
        projectedComponents,
        confidence: "very_low" as const,
        reasonCodes: [...ALLOWANCE_REASON_CODES],
      };
    })
    .sort((a, b) => a.team.localeCompare(b.team));
}

export function scoreH912DstLeagues(projections: H912TeamProjection[], leagues: H912LeagueInput[], leagueId: string | null = null): H912LeagueOutput[] {
  const dstLeagues = leagues.filter((league) => (!leagueId || league.leagueId === leagueId) && auditLeagueRoster({
    leagueId: league.leagueId,
    leagueName: league.leagueName,
    season: league.season,
    rosterPositions: league.rosterPositions,
    scoringSettings: league.scoringSettings,
  }).uses_dst);

  return dstLeagues.flatMap((league) => {
    const outputs = projections.map((projection) => {
      const medianPoints = scoreAllowanceComponents(projection.projectedComponents, league.scoringSettings);
      const range = Math.max(2, Math.abs(medianPoints) * 0.25);
      const materialMissingScoringKeys = activeDstBigPlayKeys(league.scoringSettings);
      return {
        leagueId: league.leagueId,
        leagueName: league.leagueName,
        team: projection.team,
        position: "DST" as const,
        downsidePoints: round(medianPoints - range * 1.2, 2),
        floorPoints: round(medianPoints - range * 0.6, 2),
        medianPoints: round(medianPoints, 2),
        ceilingPoints: round(medianPoints + range * 0.6, 2),
        upsidePoints: round(medianPoints + range * 1.2, 2),
        projectedPositionRank: 0,
        confidence: projection.confidence,
        scoringReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY" as const,
        reasonCodes: materialMissingScoringKeys.length > 0
          ? [...projection.reasonCodes, "SCORING_PARTIAL_ALLOWANCE_ONLY"]
          : projection.reasonCodes,
        materialMissingScoringKeys,
        projectedComponents: projection.projectedComponents,
      };
    });
    return outputs
      .sort((a, b) => b.medianPoints - a.medianPoints || a.team.localeCompare(b.team))
      .map((output, index) => ({ ...output, projectedPositionRank: index + 1 }));
  });
}

export function buildH912ProjectionResult(input: {
  rows: H912TeamGameRow[];
  leagues: H912LeagueInput[];
  team: string | null;
  leagueId: string | null;
}): H912ProjectionResult {
  const teamProjections = projectH912DstPopulation(input.rows, input.team);
  const leagueOutputs = scoreH912DstLeagues(teamProjections, input.leagues, input.leagueId);
  return {
    dataCoverage: buildH912DataCoverage(),
    teamProjections,
    leagueOutputs,
    invariantFailures: scenarioInvariantFailures(leagueOutputs),
    persistenceRecommendation: {
      implemented: false,
      verdict: "H9.12 DST DRY RUN READY — PERSISTENCE DEFERRED",
      reason: "DST projections are team-level. Existing projection persistence is player-centric and requires canonical_player_id, so H9.12 does not create fake player IDs.",
    },
  };
}

export function scoreAllowanceComponents(components: Record<string, number>, scoringSettings: Record<string, unknown>): number {
  const keys = [...POINT_BUCKET_KEYS, ...YARD_BUCKET_KEYS];
  return round(keys.reduce((sum, key) => sum + (components[key] ?? 0) * Number(scoringSettings[key] ?? 0), 0), 4);
}

export function activeDstBigPlayKeys(scoringSettings: Record<string, unknown>): string[] {
  const unavailable = new Set(["sack", "int", "fr", "ff", "def_td", "safe", "blk_kick", "def_st_td", "def_2pt_ret"]);
  return Object.entries(scoringSettings)
    .filter(([key, value]) => unavailable.has(key) && Number(value) !== 0)
    .map(([key]) => key)
    .sort();
}

function bucketRates(rows: H912TeamGameRow[]) {
  const pointsCounts = countBuckets(rows, "points_allowed");
  const yardsCounts = countBuckets(rows, "yards_allowed");
  return {
    pointsRates: Object.fromEntries(POINT_BUCKET_KEYS.map((key) => [key, (pointsCounts[key] ?? 0) / Math.max(1, rows.length)])),
    yardsRates: Object.fromEntries(YARD_BUCKET_KEYS.map((key) => [key, (yardsCounts[key] ?? 0) / Math.max(1, rows.length)])),
  };
}

function isRegularSeason(seasonType: string): boolean {
  return ["REG", "regular"].includes(seasonType);
}

function countBuckets(rows: H912TeamGameRow[], field: "points_allowed" | "yards_allowed"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = row[field];
    if (value === null) continue;
    const key = field === "points_allowed" ? selectPointsAllowedBucket(value) : selectYardsAllowedBucket(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function shrinkHits(teamCounts: Record<string, number>, games: number, populationRates: Record<string, number>, projectedGames: number): Record<string, number> {
  const keys = Object.keys(populationRates).sort();
  return Object.fromEntries(keys.map((key) => {
    const shrunkRate = ((teamCounts[key] ?? 0) + (populationRates[key] ?? 0) * SHRINKAGE_PRIOR_GAMES) / Math.max(1, games + SHRINKAGE_PRIOR_GAMES);
    return [key, round(shrunkRate * projectedGames, 4)];
  }));
}

function scenarioInvariantFailures(outputs: H912LeagueOutput[]): string[] {
  return outputs
    .filter((output) => !(output.downsidePoints <= output.floorPoints && output.floorPoints <= output.medianPoints && output.medianPoints <= output.ceilingPoints && output.ceilingPoints <= output.upsidePoints))
    .map((output) => `${output.leagueId}:${output.team}`);
}

function bigPlayScoringKey(component: (typeof H912_BIG_PLAY_COMPONENTS)[number]): string {
  const keys: Record<(typeof H912_BIG_PLAY_COMPONENTS)[number], string> = {
    sacks: "sack",
    interceptions: "int",
    fumble_recoveries: "fr",
    forced_fumbles: "ff",
    defensive_tds: "def_td",
    safeties: "safe",
    blocked_kicks: "blk_kick",
    return_tds: "def_st_td",
    two_point_returns: "def_2pt_ret",
  };
  return keys[component];
}

function groupBy<T>(values: T[], keyFn: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFn(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return grouped;
}

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function round(value: number, places: number): number {
  return Number(value.toFixed(places));
}
