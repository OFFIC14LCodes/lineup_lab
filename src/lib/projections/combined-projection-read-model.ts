import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { H912_PROJECTION_METHOD, type H912LeagueOutput } from "@/lib/projections/dst-baseline-projections";
import { H911_PROJECTION_METHOD } from "@/lib/projections/idp-k-persistence";
import { PROJECTION_METHOD } from "@/lib/projections/constants";

export type CombinedProjectionEntityType = "PLAYER" | "TEAM_DEFENSE";
export type CombinedProjectionSource = "OFFENSE_BASELINE_V1" | "IDP_K_BASELINE_V1" | "DST_ALLOWANCE_BASELINE_V1_DRY_RUN";
export type MarketComparisonStatus = "AVAILABLE" | "NO_COMPATIBLE_MARKET" | "NOT_IMPLEMENTED_FOR_SOURCE";
export type ProjectionReadiness = "READY" | "LOW_CONFIDENCE_BASELINE" | "SCORING_PARTIAL_ALLOWANCE_ONLY";
export type CombinedProjectionSort = "medianPoints" | "projectedPositionRank" | "position" | "confidence" | "marketRankDelta";

export type ProjectionRunReadRow = {
  projection_run_id: string;
  method: string;
  projection_version: number;
  selection_scope: string | null;
  run_status: string;
  completed_at: string | null;
};

export type ProjectionOutputReadRow = {
  projection_run_id: string;
  canonical_player_id: string;
  league_id: string;
  position: string;
  projected_ppg_when_in_role: number | null;
  floor_ppg: number | null;
  ceiling_ppg: number | null;
  downside_points: number;
  floor_points: number;
  median_points: number;
  ceiling_points: number;
  upside_points: number;
  projection_confidence_label: string;
  projected_position_rank: number | null;
  projection_method: string | null;
};

export type PlayerReadRow = {
  id: string;
  full_name: string | null;
  team: string | null;
  position: string | null;
  position_group: string | null;
};

export type LeagueReadRow = {
  id: string;
  name: string | null;
  season: number | string | null;
  roster_positions_json: unknown;
  scoring_settings_json: Record<string, unknown> | null;
};

export type ProjectionReasonReadRow = {
  projection_run_id: string;
  canonical_player_id: string;
  league_id: string | null;
  reason_code: string;
  explanation: string | null;
};

export type MarketComparisonReadRow = {
  projection_run_id: string;
  canonical_player_id: string;
  league_id: string;
  market_overall_adp: number | null;
  market_position_rank: number | null;
  rank_delta: number | null;
  market_discrepancy_label: string | null;
  compatibility_label: string | null;
  market_confidence_label: string | null;
  reason_codes: string[] | null;
  format_warnings_json: unknown;
};

export type CombinedProjectionRow = {
  leagueId: string;
  leagueName: string;
  entityType: CombinedProjectionEntityType;
  entityId: string;
  displayName: string;
  team: string | null;
  position: string;
  positionGroup: string;
  projectionSource: CombinedProjectionSource;
  projectionRunId: string | null;
  projectionMethod: string;
  projectionReadiness: ProjectionReadiness;
  confidenceLabel: string;
  medianPoints: number;
  floorPoints: number;
  ceilingPoints: number;
  downsidePoints: number;
  upsidePoints: number;
  projectedPpgWhenInRole: number | null;
  projectedPositionRank: number | null;
  marketComparisonStatus: MarketComparisonStatus;
  marketOverallAdp: number | null;
  marketPositionRank: number | null;
  marketRankDelta: number | null;
  marketDiscrepancyLabel: string | null;
  marketCompatibility: string | null;
  marketConfidence: string | null;
  reasonCodes: string[];
  warningCodes: string[];
  explanationFragments: string[];
  isPersisted: boolean;
  isDraftRelevant: boolean;
};

export type LeagueCoverageSummary = {
  leagueId: string;
  leagueName: string;
  offenseIncluded: boolean;
  idpIncluded: boolean;
  kickerIncluded: boolean;
  dstIncluded: boolean;
  positionsIncluded: string[];
  positionsExcluded: string[];
  exclusionReasons: string[];
  missingProjectionCategories: string[];
};

export type CombinedProjectionReadModel = {
  rows: CombinedProjectionRow[];
  leagueCoverage: LeagueCoverageSummary[];
  selectedRuns: Record<CombinedProjectionSource, ProjectionRunReadRow | null>;
};

export type BuildCombinedProjectionReadModelOptions = {
  leagueIds?: string[] | null;
  includeDstDryRun?: boolean;
  includeAllPositions?: boolean;
  position?: string | null;
  sortBy?: CombinedProjectionSort | null;
};

const OFFENSE_POSITIONS = ["QB", "RB", "WR", "TE"];
const IDP_POSITIONS = ["DL", "LB", "DB"];
const KICKER_POSITIONS = ["K"];
const DST_POSITIONS = ["DST", "DEF"];

export function buildCombinedProjectionReadModel(input: {
  runs: ProjectionRunReadRow[];
  outputs: ProjectionOutputReadRow[];
  players: PlayerReadRow[];
  leagues: LeagueReadRow[];
  reasons: ProjectionReasonReadRow[];
  marketComparisons: MarketComparisonReadRow[];
  dstOutputs?: H912LeagueOutput[];
  options?: BuildCombinedProjectionReadModelOptions;
}): CombinedProjectionReadModel {
  const options = input.options ?? {};
  const leagueFilter = new Set(options.leagueIds ?? []);
  const selectedRuns = {
    OFFENSE_BASELINE_V1: selectLatestCompleteRun(input.runs, PROJECTION_METHOD),
    IDP_K_BASELINE_V1: selectLatestCompleteRun(input.runs, H911_PROJECTION_METHOD),
    DST_ALLOWANCE_BASELINE_V1_DRY_RUN: null,
  } satisfies Record<CombinedProjectionSource, ProjectionRunReadRow | null>;
  const playerById = new Map(input.players.map((player) => [player.id, player]));
  const leagueById = new Map(input.leagues.map((league) => [league.id, league]));
  const reasonsByKey = groupReasons(input.reasons);
  const marketByKey = new Map(input.marketComparisons.map((row) => [rowKey(row.projection_run_id, row.canonical_player_id, row.league_id), row]));

  const persistedRows = input.outputs
    .filter((output) => !leagueFilter.size || leagueFilter.has(output.league_id))
    .filter((output) => output.projection_run_id === selectedRuns.OFFENSE_BASELINE_V1?.projection_run_id || output.projection_run_id === selectedRuns.IDP_K_BASELINE_V1?.projection_run_id)
    .map((output) => {
      const source = output.projection_run_id === selectedRuns.OFFENSE_BASELINE_V1?.projection_run_id ? "OFFENSE_BASELINE_V1" : "IDP_K_BASELINE_V1";
      const player = playerById.get(output.canonical_player_id);
      const league = leagueById.get(output.league_id);
      const market = source === "OFFENSE_BASELINE_V1" ? marketByKey.get(rowKey(output.projection_run_id, output.canonical_player_id, output.league_id)) ?? null : null;
      const reasonRows = reasonsByKey.get(reasonKey(output.projection_run_id, output.canonical_player_id, output.league_id)) ?? [];
      const globalReasons = reasonsByKey.get(reasonKey(output.projection_run_id, output.canonical_player_id, null)) ?? [];
      return normalizePersistedRow({
        output,
        player,
        league,
        source,
        market,
        reasons: [...globalReasons, ...reasonRows],
      });
    });

  const dstRows = options.includeDstDryRun
    ? (input.dstOutputs ?? [])
      .filter((output) => !leagueFilter.size || leagueFilter.has(output.leagueId))
      .map((output) => normalizeDstRow(output, leagueById.get(output.leagueId)))
    : [];

  const allRows = [...persistedRows, ...dstRows]
    .filter((row) => !options.position || normalizePositionFilter(row.position) === normalizePositionFilter(options.position))
    .filter((row) => options.includeAllPositions || isLeagueRelevant(row, leagueById.get(row.leagueId)));

  return {
    rows: sortRows(allRows, options.sortBy ?? null),
    leagueCoverage: buildCoverage(input.leagues.filter((league) => !leagueFilter.size || leagueFilter.has(league.id)), allRows, options.includeDstDryRun ?? false, options.includeAllPositions ?? false),
    selectedRuns,
  };
}

export function selectLatestCompleteRun(runs: ProjectionRunReadRow[], method: string): ProjectionRunReadRow | null {
  return runs
    .filter((run) => run.method === method && run.run_status === "complete")
    .sort((a, b) =>
      b.projection_version - a.projection_version ||
      compareNullableDateDesc(a.completed_at, b.completed_at) ||
      a.projection_run_id.localeCompare(b.projection_run_id)
    )[0] ?? null;
}

export function sortRows(rows: CombinedProjectionRow[], sortBy: CombinedProjectionSort | null = null): CombinedProjectionRow[] {
  const sorted = [...rows];
  if (sortBy === "medianPoints") return sorted.sort((a, b) => b.medianPoints - a.medianPoints || defaultCompare(a, b));
  if (sortBy === "projectedPositionRank") return sorted.sort((a, b) => nullLast(a.projectedPositionRank, b.projectedPositionRank) || defaultCompare(a, b));
  if (sortBy === "position") return sorted.sort((a, b) => a.positionGroup.localeCompare(b.positionGroup) || defaultCompare(a, b));
  if (sortBy === "confidence") return sorted.sort((a, b) => confidenceRank(a.confidenceLabel) - confidenceRank(b.confidenceLabel) || defaultCompare(a, b));
  if (sortBy === "marketRankDelta") return sorted.sort((a, b) => nullLast(a.marketRankDelta, b.marketRankDelta) || defaultCompare(a, b));
  return sorted.sort(defaultCompare);
}

function normalizePersistedRow(input: {
  output: ProjectionOutputReadRow;
  player: PlayerReadRow | undefined;
  league: LeagueReadRow | undefined;
  source: "OFFENSE_BASELINE_V1" | "IDP_K_BASELINE_V1";
  market: MarketComparisonReadRow | null;
  reasons: ProjectionReasonReadRow[];
}): CombinedProjectionRow {
  const marketStatus: MarketComparisonStatus = input.source === "IDP_K_BASELINE_V1"
    ? "NOT_IMPLEMENTED_FOR_SOURCE"
    : isCompatibleMarketLabel(input.market?.compatibility_label ?? null)
      ? "AVAILABLE"
      : "NO_COMPATIBLE_MARKET";
  const marketReasons = input.market?.reason_codes ?? [];
  const marketWarnings = formatWarningCodes(input.market?.format_warnings_json);
  return {
    leagueId: input.output.league_id,
    leagueName: input.league?.name ?? input.output.league_id,
    entityType: "PLAYER",
    entityId: input.output.canonical_player_id,
    displayName: input.player?.full_name ?? input.output.canonical_player_id,
    team: input.player?.team ?? null,
    position: input.output.position,
    positionGroup: input.output.position,
    projectionSource: input.source,
    projectionRunId: input.output.projection_run_id,
    projectionMethod: input.output.projection_method ?? (input.source === "OFFENSE_BASELINE_V1" ? PROJECTION_METHOD : H911_PROJECTION_METHOD),
    projectionReadiness: input.source === "OFFENSE_BASELINE_V1" ? "READY" : "LOW_CONFIDENCE_BASELINE",
    confidenceLabel: input.output.projection_confidence_label,
    medianPoints: Number(input.output.median_points),
    floorPoints: Number(input.output.floor_points),
    ceilingPoints: Number(input.output.ceiling_points),
    downsidePoints: Number(input.output.downside_points),
    upsidePoints: Number(input.output.upside_points),
    projectedPpgWhenInRole: nullableNumber(input.output.projected_ppg_when_in_role),
    projectedPositionRank: input.output.projected_position_rank,
    marketComparisonStatus: marketStatus,
    marketOverallAdp: nullableNumber(input.market?.market_overall_adp),
    marketPositionRank: input.market?.market_position_rank ?? null,
    marketRankDelta: input.market?.rank_delta ?? null,
    marketDiscrepancyLabel: input.market?.market_discrepancy_label ?? null,
    marketCompatibility: input.market?.compatibility_label ?? null,
    marketConfidence: input.market?.market_confidence_label ?? null,
    reasonCodes: uniqueSorted([...input.reasons.map((reason) => reason.reason_code), ...marketReasons]),
    warningCodes: uniqueSorted(marketWarnings),
    explanationFragments: uniqueSorted(input.reasons.map((reason) => reason.explanation).filter((value): value is string => Boolean(value))),
    isPersisted: true,
    isDraftRelevant: true,
  };
}

function normalizeDstRow(output: H912LeagueOutput, league: LeagueReadRow | undefined): CombinedProjectionRow {
  return {
    leagueId: output.leagueId,
    leagueName: league?.name ?? output.leagueName,
    entityType: "TEAM_DEFENSE",
    entityId: output.team,
    displayName: `${output.team} DST`,
    team: output.team,
    position: "DST",
    positionGroup: "DST",
    projectionSource: "DST_ALLOWANCE_BASELINE_V1_DRY_RUN",
    projectionRunId: null,
    projectionMethod: H912_PROJECTION_METHOD,
    projectionReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY",
    confidenceLabel: output.confidence,
    medianPoints: output.medianPoints,
    floorPoints: output.floorPoints,
    ceilingPoints: output.ceilingPoints,
    downsidePoints: output.downsidePoints,
    upsidePoints: output.upsidePoints,
    projectedPpgWhenInRole: null,
    projectedPositionRank: output.projectedPositionRank,
    marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE",
    marketOverallAdp: null,
    marketPositionRank: null,
    marketRankDelta: null,
    marketDiscrepancyLabel: null,
    marketCompatibility: null,
    marketConfidence: null,
    reasonCodes: uniqueSorted(output.reasonCodes),
    warningCodes: uniqueSorted(["DST_BIG_PLAY_COMPONENTS_UNAVAILABLE", ...output.reasonCodes.filter((code) => code.includes("PARTIAL") || code.includes("UNAVAILABLE"))]),
    explanationFragments: ["DST projection is allowance-only; big-play components are not projected in H9.13."],
    isPersisted: false,
    isDraftRelevant: true,
  };
}

function isLeagueRelevant(row: CombinedProjectionRow, league: LeagueReadRow | undefined): boolean {
  if (!league) return true;
  const requirements = buildNormalizedRosterRequirements(rosterPositions(league));
  if (OFFENSE_POSITIONS.includes(row.positionGroup)) return true;
  if (IDP_POSITIONS.includes(row.positionGroup)) return requirements.hasIDP;
  if (KICKER_POSITIONS.includes(row.positionGroup)) return requirements.hasKicker;
  if (DST_POSITIONS.includes(row.positionGroup)) return requirements.hasTeamDefense;
  return false;
}

function buildCoverage(leagues: LeagueReadRow[], rows: CombinedProjectionRow[], includeDstDryRun: boolean, includeAllPositions: boolean): LeagueCoverageSummary[] {
  return leagues.map((league) => {
    const requirements = buildNormalizedRosterRequirements(rosterPositions(league));
    const leagueRows = rows.filter((row) => row.leagueId === league.id);
    const positionsIncluded = uniqueSorted(leagueRows.map((row) => row.positionGroup));
    const expectedPositions = expectedLeaguePositions(requirements, includeDstDryRun, includeAllPositions);
    const positionsExcluded = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DST"].filter((position) => !expectedPositions.includes(position));
    const missingProjectionCategories = [
      expectedPositions.some((position) => OFFENSE_POSITIONS.includes(position)) && !leagueRows.some((row) => row.projectionSource === "OFFENSE_BASELINE_V1") ? "OFFENSE_BASELINE_V1" : null,
      requirements.hasIDP && !leagueRows.some((row) => row.projectionSource === "IDP_K_BASELINE_V1" && IDP_POSITIONS.includes(row.positionGroup)) ? "IDP_K_IDP" : null,
      requirements.hasKicker && !leagueRows.some((row) => row.projectionSource === "IDP_K_BASELINE_V1" && row.positionGroup === "K") ? "IDP_K_KICKER" : null,
      requirements.hasTeamDefense && includeDstDryRun && !leagueRows.some((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN") ? "DST_ALLOWANCE_BASELINE_V1_DRY_RUN" : null,
    ].filter((value): value is string => Boolean(value));
    return {
      leagueId: league.id,
      leagueName: league.name ?? league.id,
      offenseIncluded: leagueRows.some((row) => row.projectionSource === "OFFENSE_BASELINE_V1"),
      idpIncluded: leagueRows.some((row) => row.projectionSource === "IDP_K_BASELINE_V1" && IDP_POSITIONS.includes(row.positionGroup)),
      kickerIncluded: leagueRows.some((row) => row.projectionSource === "IDP_K_BASELINE_V1" && row.positionGroup === "K"),
      dstIncluded: leagueRows.some((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN"),
      positionsIncluded,
      positionsExcluded,
      exclusionReasons: exclusionReasons(requirements, includeDstDryRun, includeAllPositions),
      missingProjectionCategories,
    };
  });
}

function expectedLeaguePositions(requirements: ReturnType<typeof buildNormalizedRosterRequirements>, includeDstDryRun: boolean, includeAllPositions: boolean): string[] {
  if (includeAllPositions) return ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", ...(includeDstDryRun ? ["DST"] : [])];
  return [
    ...OFFENSE_POSITIONS,
    ...(requirements.hasIDP ? IDP_POSITIONS : []),
    ...(requirements.hasKicker ? KICKER_POSITIONS : []),
    ...(requirements.hasTeamDefense && includeDstDryRun ? ["DST"] : []),
  ];
}

function exclusionReasons(requirements: ReturnType<typeof buildNormalizedRosterRequirements>, includeDstDryRun: boolean, includeAllPositions: boolean): string[] {
  if (includeAllPositions) return [];
  return [
    !requirements.hasIDP ? "IDP positions excluded: league does not roster IDP." : null,
    !requirements.hasKicker ? "K excluded: league does not roster kickers." : null,
    !requirements.hasTeamDefense ? "DST excluded: league does not roster team defense." : null,
    requirements.hasTeamDefense && !includeDstDryRun ? "DST excluded: dry-run DST source disabled." : null,
  ].filter((value): value is string => Boolean(value));
}

function rosterPositions(league: LeagueReadRow): string[] {
  return Array.isArray(league.roster_positions_json) ? league.roster_positions_json.map(String) : [];
}

function groupReasons(reasons: ProjectionReasonReadRow[]): Map<string, ProjectionReasonReadRow[]> {
  const grouped = new Map<string, ProjectionReasonReadRow[]>();
  for (const reason of reasons) {
    const key = reasonKey(reason.projection_run_id, reason.canonical_player_id, reason.league_id);
    grouped.set(key, [...(grouped.get(key) ?? []), reason]);
  }
  return grouped;
}

function rowKey(runId: string, entityId: string, leagueId: string): string {
  return `${runId}|${entityId}|${leagueId}`;
}

function reasonKey(runId: string, entityId: string, leagueId: string | null): string {
  return `${runId}|${entityId}|${leagueId ?? "GLOBAL"}`;
}

function defaultCompare(a: CombinedProjectionRow, b: CombinedProjectionRow): number {
  return a.leagueId.localeCompare(b.leagueId) ||
    positionOrder(a.positionGroup) - positionOrder(b.positionGroup) ||
    nullLast(a.projectedPositionRank, b.projectedPositionRank) ||
    b.medianPoints - a.medianPoints ||
    a.entityId.localeCompare(b.entityId);
}

function positionOrder(position: string): number {
  return ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DST", "DEF"].indexOf(position);
}

function compareNullableDateDesc(a: string | null, b: string | null): number {
  return Date.parse(b ?? "1970-01-01") - Date.parse(a ?? "1970-01-01");
}

function nullLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function confidenceRank(confidence: string): number {
  const ranks: Record<string, number> = { high: 0, medium: 1, low: 2, very_low: 3 };
  return ranks[confidence] ?? 4;
}

function nullableNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function formatWarningCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && "code" in entry) return String((entry as { code: unknown }).code);
    return null;
  }).filter((entry): entry is string => Boolean(entry));
}

function normalizePositionFilter(position: string): string {
  const normalized = position.toUpperCase();
  return normalized === "DEF" ? "DST" : normalized;
}

function isCompatibleMarketLabel(label: string | null): boolean {
  return Boolean(label && label !== "INCOMPATIBLE");
}
