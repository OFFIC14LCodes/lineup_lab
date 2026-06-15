// H9.3 — league-specific fantasy projection outputs.
//
// Computation only. No persistence, ADP comparison, draft valuation, or UI changes.

import {
  auditLeagueScoringSettings,
  normalizeSleeperScoringSettings,
  scoreFantasyStats,
} from "@/lib/scoring";
import { getScoringKeyDefinition } from "@/lib/scoring/sleeper-keys";
import type {
  FantasyScoringResult,
  ScoringCoverageReport,
} from "@/lib/scoring/types";

import type { PlayerStatProjection } from "./component-projections";
import { hashScoringConfig, sha256 } from "./hash";
import type { ReasonCode } from "./reason-codes";
import type { ProjectionPosition, StatComponents } from "./types";

export type ProjectionScenario = "downside" | "floor" | "median" | "ceiling" | "upside";

export type LeagueScoringReadiness =
  | "SCORING_READY"
  | "SCORING_PARTIAL"
  | "SCORING_UNSUPPORTED";

export type LeagueProjectionLeagueInput = {
  leagueId: string;
  leagueName: string;
  season: number;
  teamCount: number | null;
  scoringType: string | null;
  superflex: boolean;
  tePremium: boolean;
  startingRosterSettings: string[];
  scoringSettings: Record<string, unknown>;
};

export type LeagueProjectionLeagueDiagnostic = {
  leagueId: string;
  leagueName: string;
  season: number;
  teamCount: number | null;
  scoringType: string | null;
  superflex: boolean;
  tePremium: boolean;
  startingRosterSettings: string[];
  scoringRuleCount: number;
  unsupportedScoringKeys: string[];
  unsupportedOffensiveScoringKeys: string[];
  projectionUnsupportedScoringKeys: string[];
  readiness: LeagueScoringReadiness;
};

export type ProjectedScoringStats = Record<string, number>;

export type LeagueProjectionScoringDiagnostics = {
  scoringKeysUsed: string[];
  ignoredNotApplicableScoringKeys: string[];
  unsupportedScoringKeys: string[];
  projectionUnsupportedScoringKeys: string[];
  missingStatsForSupportedKeys: Array<{ scoringKey: string; requiredStats: string[] }>;
  fumblesAffectedScore: boolean;
  pprAffectedScore: boolean;
  tePremiumAffectedScore: boolean;
  superflexValuationOnly: boolean;
  negativeScoringEvents: string[];
  formulaVersion: string;
  warnings: Array<{ code: string; scoringKey?: string; statKey?: string; message: string }>;
};

export type LeagueProjectionOutput = {
  dryRunId: string;
  leagueId: string;
  leagueName: string;
  leagueSeason: number;
  canonicalPlayerId: string;
  position: ProjectionPosition;
  projectedPositionRank: number;
  playersRankedAtPosition: number;
  downsidePoints: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  upsidePoints: number;
  projectedPPGWhenInRole: number | null;
  floorPPGWhenInRole: number | null;
  ceilingPPGWhenInRole: number | null;
  scoringDiagnostics: LeagueProjectionScoringDiagnostics;
  leagueSpecificReasons: ReasonCode[];
  componentProjectionHash: string;
  semanticInputHash: string;
  validation: {
    ok: boolean;
    failures: string[];
  };
};

export type LeagueProjectionPopulationResult = {
  outputs: LeagueProjectionOutput[];
  leagueDiagnostics: LeagueProjectionLeagueDiagnostic[];
  invariantFailures: Array<{
    leagueId: string;
    canonicalPlayerId: string;
    failures: string[];
  }>;
};

const SCENARIOS: ProjectionScenario[] = ["downside", "floor", "median", "ceiling", "upside"];
const OFFENSIVE_POSITIONS: ProjectionPosition[] = ["QB", "RB", "WR", "TE"];

const ADAPTER_STAT_KEYS = new Set([
  "pass_att",
  "pass_cmp",
  "pass_inc",
  "pass_yd",
  "pass_td",
  "pass_int",
  "pass_2pt",
  "rush_att",
  "rush_yd",
  "rush_td",
  "rush_2pt",
  "rec_tgt",
  "rec",
  "rec_yd",
  "rec_td",
  "rec_2pt",
  "fum_lost",
  "pass_fd",
  "rush_fd",
  "rec_fd",
  "pass_sack",
  "pass_pick6",
  "pass_int_td",
  "pass_td_40p",
  "pass_td_50p",
  "rec_td_40p",
  "rec_td_50p",
  "rush_td_40p",
  "rush_td_50p",
  "pass_cmp_40p",
  "rec_40p",
  "rec_20_29",
  "rec_30_39",
  "rush_40p",
  "bonus_pass_cmp_25",
  "bonus_pass_yd_300",
  "bonus_pass_yd_400",
  "bonus_rush_att_20",
  "bonus_rush_yd_100",
  "bonus_rush_yd_200",
  "bonus_rec_yd_100",
  "bonus_rec_yd_200",
  "bonus_rush_rec_yd_100",
  "bonus_rush_rec_yd_200",
  "fum",
  "fum_rec",
  "fum_rec_td",
  "fum_ret_td",
]);

const H93_PROJECTION_UNSUPPORTED_KEYS = new Set([
  "kick_ret_yd",
  "punt_ret_yd",
  "return_td",
  "return_fd",
]);

const H93_KNOWN_ZERO_OR_EXCLUDED_KEYS = new Set([
  "fum",
  "fum_rec",
  "fum_rec_td",
  "fum_ret_td",
  "kick_ret_yd",
  "punt_ret_yd",
  "return_td",
  "return_fd",
  "kr_yd",
  "pr_yd",
]);

function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000000) / 1000000;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function assertFinite(name: keyof StatComponents, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid H9.3 projected component: ${String(name)} must be finite`);
  }
}

function assertNonnegative(name: keyof StatComponents, value: number): void {
  assertFinite(name, value);
  if (value < 0) {
    throw new Error(`Invalid H9.3 projected component: ${String(name)} must be nonnegative`);
  }
}

export function projectedComponentsToScoringStats(components: StatComponents): ProjectedScoringStats {
  for (const key of Object.keys(components) as Array<keyof StatComponents>) {
    const value = components[key] ?? 0;
    if (key === "passingYards" || key === "rushingYards" || key === "receivingYards") {
      assertFinite(key, value);
    } else {
      assertNonnegative(key, value);
    }
  }
  if (components.completions > components.passAttempts + 0.000001) {
    throw new Error("Invalid H9.3 projected component: completions exceed passAttempts");
  }
  if (components.receptions > components.targets + 0.000001) {
    throw new Error("Invalid H9.3 projected component: receptions exceed targets");
  }

  return {
    pass_att: round(components.passAttempts),
    pass_cmp: round(components.completions),
    pass_inc: round(Math.max(0, components.passAttempts - components.completions)),
    pass_yd: round(components.passingYards),
    pass_td: round(components.passingTds),
    pass_int: round(components.interceptions),
    pass_2pt: 0,
    rush_att: round(components.carries),
    rush_yd: round(components.rushingYards),
    rush_td: round(components.rushingTds),
    rush_2pt: 0,
    rec_tgt: round(components.targets),
    rec: round(components.receptions),
    rec_yd: round(components.receivingYards),
    rec_td: round(components.receivingTds),
    rec_2pt: 0,
    fum_lost: round(components.fumblesLost),
    pass_fd: round(components.passingFirstDowns ?? 0),
    rush_fd: round(components.rushingFirstDowns ?? 0),
    rec_fd: round(components.receivingFirstDowns ?? 0),
    pass_sack: round(components.sacksTaken ?? 0),
    pass_pick6: round(components.passPick6 ?? 0),
    pass_td_40p: round(components.passTd40p ?? 0),
    pass_td_50p: round(components.passTd50p ?? 0),
    rec_td_40p: round(components.recTd40p ?? 0),
    rec_td_50p: round(components.recTd50p ?? 0),
    rush_td_40p: round(components.rushTd40p ?? 0),
    rush_td_50p: round(components.rushTd50p ?? 0),
    pass_cmp_40p: round(components.passCmp40p ?? 0),
    rec_40p: round(components.rec40p ?? 0),
    rec_20_29: round(components.rec20_29 ?? 0),
    rec_30_39: round(components.rec30_39 ?? 0),
    rush_40p: round(components.rush40p ?? 0),
    bonus_pass_cmp_25: round(components.bonusPassCmp25 ?? 0),
    bonus_pass_yd_300: round(components.bonusPassYd300 ?? 0),
    bonus_pass_yd_400: round(components.bonusPassYd400 ?? 0),
    bonus_rush_att_20: round(components.bonusRushAtt20 ?? 0),
    bonus_rush_yd_100: round(components.bonusRushYd100 ?? 0),
    bonus_rush_yd_200: round(components.bonusRushYd200 ?? 0),
    bonus_rec_yd_100: round(components.bonusRecYd100 ?? 0),
    bonus_rec_yd_200: round(components.bonusRecYd200 ?? 0),
    bonus_rush_rec_yd_100: round(components.bonusRushRecYd100 ?? 0),
    bonus_rush_rec_yd_200: round(components.bonusRushRecYd200 ?? 0),
    fum: 0,
    fum_rec: 0,
    fum_rec_td: 0,
    fum_ret_td: 0,
  };
}

function activeKeys(scoringSettings: Record<string, unknown>): string[] {
  return Object.entries(normalizeSleeperScoringSettings(scoringSettings).values)
    .filter(([, value]) => value !== 0)
    .map(([key]) => key)
    .sort();
}

function isOffensiveKey(scoringKey: string): boolean {
  const definition = getScoringKeyDefinition(scoringKey);
  if (!definition) {
    return (
      /^(pass|rush|rec)_/.test(scoringKey) ||
      /^bonus_(pass|rush|rec|fd)/.test(scoringKey) ||
      ["fum", "fum_lost", "fum_rec", "fum_rec_td"].includes(scoringKey)
    );
  }
  if (!definition.allowedPositions?.length) return true;
  return definition.allowedPositions.some((position) =>
    OFFENSIVE_POSITIONS.includes(position as ProjectionPosition)
  );
}

function projectionUnsupportedActiveKeys(scoringSettings: Record<string, unknown>): string[] {
  return activeKeys(scoringSettings)
    .filter((key) => H93_PROJECTION_UNSUPPORTED_KEYS.has(key) && isOffensiveKey(key))
    .sort();
}

export function buildLeagueScoringDiagnostic(
  league: LeagueProjectionLeagueInput
): LeagueProjectionLeagueDiagnostic {
  const audit = auditLeagueScoringSettings(league.scoringSettings);
  const active = activeKeys(league.scoringSettings);
  const unsupportedOffensive = uniqueSorted([
    ...audit.unknownKeys.filter(isOffensiveKey),
    ...audit.unsupportedKeys.filter(isOffensiveKey),
  ]);
  const projectionUnsupported = projectionUnsupportedActiveKeys(league.scoringSettings);
  const readiness: LeagueScoringReadiness =
    unsupportedOffensive.length > 0 || projectionUnsupported.length > 0
      ? "SCORING_UNSUPPORTED"
      : audit.unsupportedKeys.length > 0
        ? "SCORING_PARTIAL"
        : "SCORING_READY";

  return {
    leagueId: league.leagueId,
    leagueName: league.leagueName,
    season: league.season,
    teamCount: league.teamCount,
    scoringType: league.scoringType,
    superflex: league.superflex,
    tePremium: league.tePremium,
    startingRosterSettings: [...league.startingRosterSettings],
    scoringRuleCount: active.length,
    unsupportedScoringKeys: uniqueSorted([...audit.unsupportedKeys, ...audit.unknownKeys]),
    unsupportedOffensiveScoringKeys: unsupportedOffensive,
    projectionUnsupportedScoringKeys: projectionUnsupported,
    readiness,
  };
}

function scenarioComponents(player: PlayerStatProjection, scenario: ProjectionScenario): StatComponents {
  switch (scenario) {
    case "downside":
      return player.downsideComponents;
    case "floor":
      return player.floorComponents;
    case "median":
      return player.medianComponents;
    case "ceiling":
      return player.ceilingComponents;
    case "upside":
      return player.upsideComponents;
  }
}

function scoreScenario(
  player: PlayerStatProjection,
  league: LeagueProjectionLeagueInput,
  scenario: ProjectionScenario
): FantasyScoringResult {
  return scoreFantasyStats({
    stats: projectedComponentsToScoringStats(scenarioComponents(player, scenario)),
    scoringSettings: league.scoringSettings,
    positionGroup: player.position,
    statSource: "projection",
    context: {
      season: league.season,
      playerId: player.canonicalPlayerId,
    },
  });
}

function componentPoints(result: FantasyScoringResult, scoringKeys: string[]): number {
  const keySet = new Set(scoringKeys);
  return result.components
    .filter((component) => keySet.has(component.scoringKey))
    .reduce((sum, component) => sum + component.points, 0);
}

function hasPositiveComponent(result: FantasyScoringResult, scoringKeys: string[]): boolean {
  const keySet = new Set(scoringKeys);
  return result.components.some((component) => keySet.has(component.scoringKey) && component.points !== 0);
}

function coverageUnion(results: FantasyScoringResult[]): Pick<
  ScoringCoverageReport,
  "activeScoringKeys" | "evaluatedScoringKeys" | "notApplicableScoringKeys" | "unsupportedScoringKeys" | "missingStatsForSupportedKeys"
> {
  return {
    activeScoringKeys: uniqueSorted(results.flatMap((result) => result.coverage.activeScoringKeys)),
    evaluatedScoringKeys: uniqueSorted(results.flatMap((result) => result.coverage.evaluatedScoringKeys)),
    notApplicableScoringKeys: uniqueSorted(results.flatMap((result) => result.coverage.notApplicableScoringKeys)),
    unsupportedScoringKeys: uniqueSorted(results.flatMap((result) => result.coverage.unsupportedScoringKeys)),
    missingStatsForSupportedKeys: [
      ...new Map(
        results
          .flatMap((result) => result.coverage.missingStatsForSupportedKeys)
          .map((missing) => [`${missing.scoringKey}:${missing.requiredStats.join(",")}`, missing])
      ).values(),
    ].sort((a, b) => a.scoringKey.localeCompare(b.scoringKey)),
  };
}

function negativeScoringEvents(result: FantasyScoringResult): string[] {
  return uniqueSorted(
    result.components
      .filter((component) => component.points < 0)
      .map((component) => component.scoringKey)
  );
}

function ppg(points: number, roleGames: number): number | null {
  return roleGames > 0 ? round(points / roleGames) : null;
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function validateScenarioOrdering(points: Record<ProjectionScenario, number>): string[] {
  const failures: string[] = [];
  for (let i = 1; i < SCENARIOS.length; i++) {
    const prev = SCENARIOS[i - 1];
    const current = SCENARIOS[i];
    if (points[prev] > points[current] + 0.000001) {
      failures.push(`scenario ordering violated: ${prev}=${points[prev]} > ${current}=${points[current]}`);
    }
  }
  return failures;
}

function buildScoringDiagnostics(
  league: LeagueProjectionLeagueInput,
  results: Record<ProjectionScenario, FantasyScoringResult>
): LeagueProjectionScoringDiagnostics {
  const scenarioResults = SCENARIOS.map((scenario) => results[scenario]);
  const coverage = coverageUnion(scenarioResults);
  const projectionUnsupported = projectionUnsupportedActiveKeys(league.scoringSettings);
  const median = results.median;
  return {
    scoringKeysUsed: coverage.evaluatedScoringKeys,
    ignoredNotApplicableScoringKeys: coverage.notApplicableScoringKeys,
    unsupportedScoringKeys: coverage.unsupportedScoringKeys,
    projectionUnsupportedScoringKeys: projectionUnsupported,
    missingStatsForSupportedKeys: coverage.missingStatsForSupportedKeys,
    fumblesAffectedScore: hasPositiveComponent(median, ["fum_lost"]) || componentPoints(median, ["fum_lost"]) < 0,
    pprAffectedScore: hasPositiveComponent(median, ["rec", "rec_rb_bonus", "rec_wr_bonus", "rec_te_bonus", "bonus_rec_rb", "bonus_rec_wr", "bonus_rec_te"]),
    tePremiumAffectedScore: hasPositiveComponent(median, ["rec_te_bonus", "bonus_rec_te"]),
    superflexValuationOnly: league.superflex,
    negativeScoringEvents: negativeScoringEvents(median),
    formulaVersion: median.formulaVersion,
    warnings: scenarioResults.flatMap((result) =>
      result.warnings.map((warning) => ({
        code: warning.code,
        scoringKey: warning.scoringKey,
        statKey: warning.statKey,
        message: warning.message,
      }))
    ),
  };
}

function buildReasons(
  output: {
    position: ProjectionPosition;
    points: Record<ProjectionScenario, number>;
    diagnostics: LeagueProjectionScoringDiagnostics;
  }
): ReasonCode[] {
  const reasons = new Set<ReasonCode>(["LEAGUE_SCORING_APPLIED"]);
  if (output.diagnostics.pprAffectedScore) reasons.add("PPR_SCORING_IMPACT");
  if (output.position === "TE" && output.diagnostics.tePremiumAffectedScore) reasons.add("TE_PREMIUM_SCORING_IMPACT");
  if (output.diagnostics.negativeScoringEvents.includes("fum_lost")) reasons.add("FUMBLE_PENALTY_IMPACT");
  if (output.diagnostics.negativeScoringEvents.includes("pass_int")) reasons.add("INTERCEPTION_PENALTY_IMPACT");
  if (output.points.floor < 0 || output.points.downside < 0) reasons.add("NEGATIVE_FLOOR_VALID");
  if (
    output.diagnostics.missingStatsForSupportedKeys.length > 0 ||
    output.diagnostics.projectionUnsupportedScoringKeys.length > 0
  ) {
    reasons.add("SCORING_PARTIAL_COVERAGE");
  }
  if (output.diagnostics.unsupportedScoringKeys.length > 0) reasons.add("SCORING_UNSUPPORTED_KEY");
  return [...reasons].sort();
}

function semanticInputHash(
  player: PlayerStatProjection,
  league: LeagueProjectionLeagueInput,
  points: Record<ProjectionScenario, number>
): string {
  return sha256(canonicalJson({
    componentProjectionHash: player.playerProjectionInputHash,
    leagueId: league.leagueId,
    method: "h9_league_projection",
    points,
    position: player.position,
    scoringConfigHash: hashScoringConfig(league.leagueId, league.scoringSettings),
  }));
}

export function scorePlayerForLeague(
  player: PlayerStatProjection,
  league: LeagueProjectionLeagueInput,
  dryRunId: string
): LeagueProjectionOutput {
  const results = Object.fromEntries(
    SCENARIOS.map((scenario) => [scenario, scoreScenario(player, league, scenario)])
  ) as Record<ProjectionScenario, FantasyScoringResult>;
  const points = Object.fromEntries(
    SCENARIOS.map((scenario) => [scenario, round(results[scenario].totalPoints)])
  ) as Record<ProjectionScenario, number>;
  const diagnostics = buildScoringDiagnostics(league, results);
  const failures = validateScenarioOrdering(points);
  const output = {
    dryRunId,
    leagueId: league.leagueId,
    leagueName: league.leagueName,
    leagueSeason: league.season,
    canonicalPlayerId: player.canonicalPlayerId,
    position: player.position,
    projectedPositionRank: 0,
    playersRankedAtPosition: 0,
    downsidePoints: points.downside,
    floorPoints: points.floor,
    medianPoints: points.median,
    ceilingPoints: points.ceiling,
    upsidePoints: points.upside,
    projectedPPGWhenInRole: ppg(points.median, player.roleFoundation.projectedAvailability.projectedRoleGames.median),
    floorPPGWhenInRole: ppg(points.floor, player.roleFoundation.projectedAvailability.projectedRoleGames.floor),
    ceilingPPGWhenInRole: ppg(points.ceiling, player.roleFoundation.projectedAvailability.projectedRoleGames.ceiling),
    scoringDiagnostics: diagnostics,
    leagueSpecificReasons: buildReasons({ position: player.position, points, diagnostics }),
    componentProjectionHash: player.playerProjectionInputHash,
    semanticInputHash: semanticInputHash(player, league, points),
    validation: {
      ok: failures.length === 0,
      failures,
    },
  };
  return output;
}

function rankOutputs(outputs: LeagueProjectionOutput[]): LeagueProjectionOutput[] {
  const groups = new Map<string, LeagueProjectionOutput[]>();
  for (const output of outputs) {
    const key = `${output.leagueId}:${output.position}`;
    groups.set(key, [...(groups.get(key) ?? []), output]);
  }
  const ranked: LeagueProjectionOutput[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) =>
      b.medianPoints - a.medianPoints ||
      b.ceilingPoints - a.ceilingPoints ||
      compareNullableDesc(a.projectedPPGWhenInRole, b.projectedPPGWhenInRole) ||
      a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)
    );
    sorted.forEach((output, index) => {
      ranked.push({
        ...output,
        projectedPositionRank: index + 1,
        playersRankedAtPosition: sorted.length,
      });
    });
  }
  return ranked.sort((a, b) =>
    a.leagueId.localeCompare(b.leagueId) ||
    a.position.localeCompare(b.position) ||
    a.projectedPositionRank - b.projectedPositionRank ||
    a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)
  );
}

export function projectLeagueProjectionPopulation(input: {
  players: PlayerStatProjection[];
  leagues: LeagueProjectionLeagueInput[];
  dryRunId: string;
}): LeagueProjectionPopulationResult {
  const leagues = [...input.leagues].sort((a, b) => a.leagueId.localeCompare(b.leagueId));
  const players = [...input.players].sort((a, b) => a.canonicalPlayerId.localeCompare(b.canonicalPlayerId));
  const leagueDiagnostics = leagues.map(buildLeagueScoringDiagnostic);
  const outputs = rankOutputs(
    leagues.flatMap((league) =>
      players.map((player) => scorePlayerForLeague(player, league, input.dryRunId))
    )
  );

  return {
    outputs,
    leagueDiagnostics,
    invariantFailures: outputs
      .filter((output) => !output.validation.ok)
      .map((output) => ({
        leagueId: output.leagueId,
        canonicalPlayerId: output.canonicalPlayerId,
        failures: output.validation.failures,
      })),
  };
}

export function h93ProjectionUnsupportedScoringKeys(): string[] {
  return [...H93_PROJECTION_UNSUPPORTED_KEYS].sort();
}

export function h93AdapterStatKeys(): string[] {
  return [...ADAPTER_STAT_KEYS].sort();
}

export function h94ProjectionUnsupportedBlockingKeys(): string[] {
  return [...H93_PROJECTION_UNSUPPORTED_KEYS].sort();
}

export function h94KnownZeroOrExcludedKeys(): string[] {
  return [...H93_KNOWN_ZERO_OR_EXCLUDED_KEYS].sort();
}
