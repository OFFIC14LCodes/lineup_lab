import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import type { HistoricalMockDraftEngineReport, HistoricalMockDraftPickLog } from "./historical-mock-draft-engine-types";
import type {
  HistoricalLineupPlayer,
  HistoricalLineupSettings,
  HistoricalLineupScoreStatus,
  HistoricalPlayerRegistryRow,
  HistoricalSeasonOutcomeScenario,
  HistoricalSeasonOutcomeScorerArtifactPaths,
  HistoricalSeasonOutcomeScorerReport,
  HistoricalSeasonTeamOutcome,
  HistoricalStrategyComparison,
  HistoricalWeeklyResult,
  HistoricalWeeklyResultsInput,
  HistoricalWeeklyTeamScore,
} from "./historical-season-outcome-scorer-types";

const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);
const SUPERFLEX_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const IDP_POSITIONS = new Set(["DL", "LB", "DB", "IDP"]);

export function buildHistoricalSeasonOutcomeScorerReport(input: {
  projectionSeason: number;
  scenario: HistoricalSeasonOutcomeScenario;
  draftReport: HistoricalMockDraftEngineReport | null;
  weeklyResults: HistoricalWeeklyResult[] | null;
  playerRegistry?: HistoricalPlayerRegistryRow[] | null;
  scenarioPath?: string;
  generatedAt?: string;
}): HistoricalSeasonOutcomeScorerReport {
  const actualWeeklyResultsFound = Boolean(input.weeklyResults?.length);
  const strategyOutcomes = actualWeeklyResultsFound && input.draftReport
    ? scoreDraftReport(input.draftReport, input.weeklyResults ?? [], input.playerRegistry ?? [], input.scenario)
    : [];
  const coverage = summarizeCoverage(input.draftReport, input.weeklyResults ?? [], input.playerRegistry ?? [], strategyOutcomes);
  const strategyComparison = strategyOutcomes.length ? compareStrategies(strategyOutcomes) : null;
  const myTeamFocus = strategyOutcomes.length && input.draftReport ? buildMyTeamFocus(input.draftReport, strategyOutcomes) : null;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    scenarioPath: input.scenarioPath ?? null,
    recommendation: recommend(Boolean(input.draftReport), actualWeeklyResultsFound, coverage.missingPlayerScores, coverage.exactIdMatches + coverage.namePositionFallbackMatches + coverage.trueZeroWeekRows),
    actualWeeklyResultsFound,
    weeklyInputCoverage: coverage,
    draftEngineSummary: input.draftReport
      ? { recommendation: input.draftReport.recommendation, draftOrderType: input.draftReport.draftOrderType }
      : null,
    strategyOutcomes,
    strategyComparison,
    myTeamFocus,
    dataLeakageGuard: {
      draftArtifactLoadedBeforeOutcomes: Boolean(input.draftReport),
      actualOutcomesOnlyUsedInScoringPhase: true,
      draftRankingsNotRecomputedFromOutcomes: true,
      noFutureFieldsUsedInDraftSimulation: input.draftReport?.dataLeakageGuard.futureOutcomeFieldsUsed === false,
    },
    limitations: limitations(input.scenario, actualWeeklyResultsFound),
    safetyGates: [
      gate("no_live_outputs_changed", true, "Outcome scorer reads local artifacts and writes local reports only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("historical_backtest_no_future_leakage", true, "H36 draft artifact is loaded before outcomes and not recomputed."),
      gate("outcomes_used_only_after_draft", true, "Actual outcomes and zero-week treatment are consumed only after H36 draft rosters exist."),
      gate("registry_zero_season_exact_id_only", true, "Registry-backed zero-season treatment uses exact player_id, sleeper_id, or gsis_id only."),
      gate("loose_fuzzy_not_confirmed", true, "Loose fuzzy/name-only candidates are not confirmed as scoring identities."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function runHistoricalSeasonOutcomeScorer(input: {
  projectionSeason: number;
  scenarioPath: string;
  cwd?: string;
}): HistoricalSeasonOutcomeScorerReport {
  const cwd = input.cwd ?? process.cwd();
  const scenario = readJson<HistoricalSeasonOutcomeScenario>(path.resolve(cwd, input.scenarioPath));
  const draftPath = path.resolve(cwd, scenario.draftEngineArtifactPath);
  const draftReport = existsSync(draftPath) ? readJson<HistoricalMockDraftEngineReport>(draftPath) : null;
  const weeklyPath = scenario.weeklyResultsInputPath ? path.resolve(cwd, scenario.weeklyResultsInputPath) : null;
  const weeklyResults = weeklyPath && existsSync(weeklyPath)
    ? readJson<HistoricalWeeklyResultsInput>(weeklyPath).results
    : null;
  const registryPath = scenario.playerRegistryInputPath
    ? path.resolve(cwd, scenario.playerRegistryInputPath)
    : path.resolve(cwd, "data", "nflverse", "players.csv");
  const playerRegistry = existsSync(registryPath) ? readPlayerRegistryRows(registryPath) : null;
  return buildHistoricalSeasonOutcomeScorerReport({
    projectionSeason: input.projectionSeason,
    scenario,
    draftReport,
    weeklyResults,
    playerRegistry,
    scenarioPath: input.scenarioPath,
  });
}

export function writeHistoricalSeasonOutcomeScorerArtifacts(
  report: HistoricalSeasonOutcomeScorerReport,
  cwd = process.cwd(),
): HistoricalSeasonOutcomeScorerArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `historical-season-outcome-scorer-${report.projectionSeason}.json`);
  const markdownPath = path.join(artifactDir, `historical-season-outcome-scorer-${report.projectionSeason}.md`);
  const csvPath = path.join(artifactDir, `historical-season-outcome-scorer-${report.projectionSeason}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  writeFileSync(csvPath, renderCsv(report));
  return { jsonPath, markdownPath, csvPath };
}

export function optimizeBestBallLineup(input: {
  roster: HistoricalLineupPlayer[];
  lineupSettings: HistoricalLineupSettings;
}): Omit<HistoricalWeeklyTeamScore, "week" | "teamKey"> {
  const remaining = [...input.roster].sort((a, b) => b.points - a.points);
  const starters: HistoricalLineupPlayer[] = [];
  const positionalPointsBySlot: Record<string, number> = {};
  const fillSlot = (slot: string, count: number, eligible: (player: HistoricalLineupPlayer) => boolean) => {
    for (let i = 0; i < count; i += 1) {
      const index = remaining.findIndex(eligible);
      if (index === -1) continue;
      const [player] = remaining.splice(index, 1);
      starters.push(player);
      positionalPointsBySlot[slot] = (positionalPointsBySlot[slot] ?? 0) + player.points;
    }
  };

  fillSlot("QB", input.lineupSettings.QB, (player) => player.position === "QB");
  fillSlot("RB", input.lineupSettings.RB, (player) => player.position === "RB");
  fillSlot("WR", input.lineupSettings.WR, (player) => player.position === "WR");
  fillSlot("TE", input.lineupSettings.TE, (player) => player.position === "TE");
  fillSlot("K", input.lineupSettings.K, (player) => player.position === "K");
  fillSlot("DST", input.lineupSettings.DST, (player) => player.position === "DST");
  fillSlot("DL", input.lineupSettings.DL ?? 0, (player) => player.position === "DL");
  fillSlot("LB", input.lineupSettings.LB ?? 0, (player) => player.position === "LB");
  fillSlot("DB", input.lineupSettings.DB ?? 0, (player) => player.position === "DB");
  fillSlot("FLEX", input.lineupSettings.FLEX, (player) => FLEX_POSITIONS.has(player.position));
  fillSlot("SUPERFLEX", input.lineupSettings.SUPERFLEX, (player) => SUPERFLEX_POSITIONS.has(player.position));
  fillSlot("IDP", input.lineupSettings.IDP ?? 0, (player) => IDP_POSITIONS.has(player.position));

  const requiredSlots = Object.values(input.lineupSettings).reduce((sum, value) => sum + (value ?? 0), 0);
  const starterPoints = starters.reduce((sum, player) => sum + player.points, 0);
  const benchPoints = remaining.reduce((sum, player) => sum + player.points, 0);
  return {
    totalPoints: starterPoints,
    starters,
    bench: remaining,
    starterPoints,
    benchPoints,
    fillRate: requiredSlots ? starters.length / requiredSlots : 1,
    zeroScoreStarterWeeks: starters.some((player) => player.points === 0) ? 1 : 0,
    positionalPointsBySlot,
  };
}

function scoreDraftReport(
  draftReport: HistoricalMockDraftEngineReport,
  weeklyResults: HistoricalWeeklyResult[],
  playerRegistry: HistoricalPlayerRegistryRow[],
  scenario: HistoricalSeasonOutcomeScenario,
): HistoricalSeasonTeamOutcome[] {
  const resultByWeek = groupWeeklyResults(weeklyResults);
  const resultByExactId = groupWeeklyResultsByExactId(weeklyResults);
  const registryByExactId = groupRegistryByExactId(playerRegistry);
  return draftReport.strategyResults
    .filter((strategy) => scenario.strategiesToScore.includes(strategy.strategy))
    .flatMap((strategy) =>
      strategy.teamRosters.map((team) => {
        const weekly_scores = scenario.weeksToScore.map((week) => {
          const roster = team.picks.map((pick) => matchPlayerWeek(pick, resultByWeek.get(week) ?? [], resultByExactId, registryByExactId));
          const optimized = optimizeBestBallLineup({ roster, lineupSettings: scenario.lineupSettings });
          return { week, teamKey: `${strategy.strategy}:slot-${team.draftSlot}`, ...optimized };
        });
        const total = weekly_scores.reduce((sum, week) => sum + week.totalPoints, 0);
        const starterPoints = weekly_scores.reduce((sum, week) => sum + week.starterPoints, 0);
        const benchPoints = weekly_scores.reduce((sum, week) => sum + week.benchPoints, 0);
        return {
          strategy: strategy.strategy,
          teamKey: `slot-${team.draftSlot}`,
          best_ball_total_points: total,
          weekly_average: weekly_scores.length ? total / weekly_scores.length : 0,
          weekly_scores,
          starter_points: starterPoints,
          bench_points: benchPoints,
          optimal_lineup_fill_rate: average(weekly_scores.map((week) => week.fillRate)),
          zero_score_starter_weeks: weekly_scores.reduce((sum, week) => sum + week.zeroScoreStarterWeeks, 0),
          positional_points_by_slot: sumPositionalPoints(weekly_scores),
          positional_advantage: {},
          replacement_value: "not_available_v1" as const,
          hit_rate: hitRate(weekly_scores),
          bust_rate: bustRate(weekly_scores),
          regret_score: "not_available_v1" as const,
        };
      }),
    );
}

function matchPlayerWeek(
  pick: HistoricalMockDraftPickLog,
  rows: HistoricalWeeklyResult[],
  resultByExactId: Map<string, HistoricalWeeklyResult[]>,
  registryByExactId: Map<string, HistoricalPlayerRegistryRow[]>,
): HistoricalLineupPlayer {
  const exact = rows.find((row) => row.player_id === pick.playerId || row.sleeper_id === pick.playerId || row.gsis_id === pick.playerId);
  if (exact) return lineupPlayer(pick, exact, exact.player_id === pick.playerId ? "player_id" : exact.sleeper_id === pick.playerId ? "sleeper_id" : "gsis_id");
  const seasonExactRows = resultByExactId.get(pick.playerId) ?? [];
  if (seasonExactRows.length) {
    const matchedBy = seasonExactRows.some((row) => row.player_id === pick.playerId)
      ? "player_id"
      : seasonExactRows.some((row) => row.sleeper_id === pick.playerId)
        ? "sleeper_id"
        : "gsis_id";
    return { playerId: pick.playerId, playerName: pick.playerName, position: normalizePosition(pick.position), points: 0, matchedBy, scoreStatus: "true_zero_week" };
  }
  const registryRows = registryByExactId.get(pick.playerId) ?? [];
  const registry = registryRows.find((row) => !registryConflict(row, pick));
  if (registry) {
    const matchedBy = registry.player_id === pick.playerId
      ? "player_id"
      : registry.sleeper_id === pick.playerId
        ? "sleeper_id"
        : "gsis_id";
    return { playerId: pick.playerId, playerName: pick.playerName, position: normalizePosition(pick.position), points: 0, matchedBy, scoreStatus: "registry_backed_zero_season" };
  }
  if (registryRows.length) {
    return { playerId: pick.playerId, playerName: pick.playerName, position: normalizePosition(pick.position), points: 0, matchedBy: "missing", scoreStatus: "review_candidate_not_scored" };
  }
  const fallback = rows.find((row) => normalize(row.player_name) === normalize(pick.playerName) && normalizePosition(row.position) === normalizePosition(pick.position));
  if (fallback) return lineupPlayer(pick, fallback, "name_position");
  return { playerId: pick.playerId, playerName: pick.playerName, position: normalizePosition(pick.position), points: 0, matchedBy: "missing", scoreStatus: "missing_weekly_source" };
}

function compareStrategies(outcomes: HistoricalSeasonTeamOutcome[]): HistoricalStrategyComparison {
  const preferredTeamKey = outcomes.some((outcome) => outcome.strategy === "blackbird_rank_only" && outcome.teamKey === "slot-2")
    ? "slot-2"
    : outcomes.find((outcome) => outcome.strategy === "blackbird_rank_only")?.teamKey;
  const myTeam = outcomes.filter((outcome) => outcome.teamKey === preferredTeamKey);
  const blackbird = myTeam.find((outcome) => outcome.strategy === "blackbird_rank_only");
  if (!blackbird) {
    return {
      blackbirdRankAmongStrategies: "not_available",
      blackbirdTotalPointsDeltaVsBaseline: {},
      blackbirdWeeklyAverageDeltaVsBaseline: {},
      blackbirdPositionalStrengthsWeaknesses: ["Blackbird my-team outcome missing."],
      blackbirdRosterConstructionOutcomeNotes: [],
    };
  }
  const ranked = [...myTeam].sort((a, b) => b.best_ball_total_points - a.best_ball_total_points);
  const deltas = Object.fromEntries(myTeam.filter((item) => item.strategy !== "blackbird_rank_only").map((item) => [item.strategy, round(blackbird.best_ball_total_points - item.best_ball_total_points)]));
  const avgDeltas = Object.fromEntries(myTeam.filter((item) => item.strategy !== "blackbird_rank_only").map((item) => [item.strategy, round(blackbird.weekly_average - item.weekly_average)]));
  return {
    blackbirdRankAmongStrategies: ranked.findIndex((item) => item.strategy === "blackbird_rank_only") + 1,
    blackbirdTotalPointsDeltaVsBaseline: deltas,
    blackbirdWeeklyAverageDeltaVsBaseline: avgDeltas,
    blackbirdPositionalStrengthsWeaknesses: Object.entries(blackbird.positional_points_by_slot).map(([slot, points]) => `${slot}: ${round(points)} points`),
    blackbirdRosterConstructionOutcomeNotes: [`Blackbird scored ${round(blackbird.best_ball_total_points)} best-ball points for my-team slot.`],
  };
}

function buildMyTeamFocus(draftReport: HistoricalMockDraftEngineReport, outcomes: HistoricalSeasonTeamOutcome[]): Record<string, unknown> {
  const blackbirdDraft = draftReport.strategyResults.find((strategy) => strategy.strategy === "blackbird_rank_only");
  const blackbirdOutcome =
    outcomes.find((outcome) => outcome.strategy === "blackbird_rank_only" && outcome.teamKey === "slot-2") ??
    outcomes.find((outcome) => outcome.strategy === "blackbird_rank_only");
  const contributors = (blackbirdOutcome?.weekly_scores.flatMap((week) => week.starters) ?? [])
    .reduce<Record<string, number>>((acc, player) => {
      acc[player.playerName] = (acc[player.playerName] ?? 0) + player.points;
      return acc;
    }, {});
  return {
    finalDraftedRoster: blackbirdDraft?.myTeamRoster.map((pick) => `${pick.playerName} (${pick.position})`) ?? [],
    weeklyBestBallLineupExamples: blackbirdOutcome?.weekly_scores.slice(0, 3).map((week) => ({
      week: week.week,
      starters: week.starters.map((player) => `${player.playerName} ${player.points}`),
      totalPoints: week.totalPoints,
    })) ?? [],
    topSeasonContributors: Object.entries(contributors).sort((a, b) => b[1] - a[1]).slice(0, 5),
    unusedBenchPoints: blackbirdOutcome?.bench_points ?? 0,
    positionStrengths: blackbirdOutcome ? Object.keys(blackbirdOutcome.positional_points_by_slot) : [],
    positionWeaknesses: blackbirdOutcome?.optimal_lineup_fill_rate === 1 ? [] : ["Lineup fill rate below 100%."],
    biggestHits: Object.entries(contributors).filter(([, points]) => points >= 20).map(([name]) => name),
    biggestMisses: Object.entries(contributors).filter(([, points]) => points === 0).map(([name]) => name),
  };
}

function recommend(draftFound: boolean, weeklyFound: boolean, missingScores: number, matches: number): HistoricalSeasonOutcomeScorerReport["recommendation"] {
  if (!draftFound) return "historical_outcome_scoring_blocked";
  if (!weeklyFound) return "historical_outcome_scoring_needs_actual_weekly_results";
  if (matches === 0 || missingScores > matches) return "historical_outcome_scoring_needs_identifier_mapping";
  return "historical_outcome_scoring_ready_for_strategy_comparison";
}

function summarizeCoverage(
  draftReport: HistoricalMockDraftEngineReport | null,
  weeklyResults: HistoricalWeeklyResult[],
  playerRegistry: HistoricalPlayerRegistryRow[],
  outcomes: HistoricalSeasonTeamOutcome[],
) {
  const allPlayers = outcomes.flatMap((outcome) => outcome.weekly_scores.flatMap((week) => [...week.starters, ...week.bench]));
  const exactIdMatches = allPlayers.filter((player) => scoreStatus(player) === "scored_from_weekly_result" && ["player_id", "sleeper_id", "gsis_id"].includes(player.matchedBy)).length;
  const trueZeroWeekRows = allPlayers.filter((player) => scoreStatus(player) === "true_zero_week").length;
  const registryBackedZeroSeasonRows = allPlayers.filter((player) => scoreStatus(player) === "registry_backed_zero_season").length;
  const missingPlayerScores = draftReport && weeklyResults.length
    ? allPlayers.filter((player) => ["missing_weekly_source", "missing_identifier_mapping", "review_candidate_not_scored"].includes(scoreStatus(player))).length
    : 0;
  const seasonExactPlayerIds = new Set<string>();
  const registryOnlyExactPlayerIds = new Set<string>();
  const missingWeeklySourcePlayerIds = new Set<string>();
  for (const player of allPlayers) {
    if (scoreStatus(player) === "scored_from_weekly_result" || scoreStatus(player) === "true_zero_week") seasonExactPlayerIds.add(player.playerId);
    if (scoreStatus(player) === "registry_backed_zero_season") registryOnlyExactPlayerIds.add(player.playerId);
    if (["missing_weekly_source", "missing_identifier_mapping", "review_candidate_not_scored"].includes(scoreStatus(player))) missingWeeklySourcePlayerIds.add(player.playerId);
  }
  const missingBeforeZeroTreatment = missingPlayerScores + trueZeroWeekRows + registryBackedZeroSeasonRows;
  const missingAfterTrueZeroTreatment = missingPlayerScores + registryBackedZeroSeasonRows;
  const denominator = exactIdMatches + trueZeroWeekRows + registryBackedZeroSeasonRows + missingPlayerScores;
  return {
    resultRows: weeklyResults.length,
    weeks: [...new Set(weeklyResults.map((row) => row.week))].sort((a, b) => a - b),
    scoredWeeklyResultRows: exactIdMatches,
    exactIdMatches,
    namePositionFallbackMatches: allPlayers.filter((player) => scoreStatus(player) === "scored_from_weekly_result" && player.matchedBy === "name_position").length,
    trueZeroWeekRows,
    registryBackedZeroSeasonRows,
    missingPlayerScores,
    missingScoreRateBeforeH40: denominator ? round(missingBeforeZeroTreatment / denominator) : 0,
    missingScoreRateBeforeZeroWeekTreatment: denominator ? round(missingBeforeZeroTreatment / denominator) : 0,
    missingScoreRateAfterTrueZeroWeekTreatment: denominator ? round(missingAfterTrueZeroTreatment / denominator) : 0,
    missingScoreRateAfterZeroWeekTreatment: denominator ? round(missingAfterTrueZeroTreatment / denominator) : 0,
    missingScoreRateAfterRegistryZeroSeasonTreatment: denominator ? round(missingPlayerScores / denominator) : 0,
    playersWithSeasonLevelExactMatch: seasonExactPlayerIds.size,
    playersWithRegistryOnlyExactMatch: registryOnlyExactPlayerIds.size,
    playersMissingFromBothWeeklyAndRegistrySource: missingWeeklySourcePlayerIds.size,
    playersMissingFromWeeklySourceEntirely: missingWeeklySourcePlayerIds.size,
    registryBackedZeroSeasonUnavailable: playerRegistry.length === 0,
  };
}

function limitations(scenario: HistoricalSeasonOutcomeScenario, weeklyFound: boolean): string[] {
  const items = ["replacement_value, regret_score, and full positional_advantage are not_available_v1."];
  if (!weeklyFound) items.push("Actual weekly fantasy scoring input was not supplied.");
  if ((scenario.lineupSettings.DL ?? 0) || (scenario.lineupSettings.LB ?? 0) || (scenario.lineupSettings.DB ?? 0) || (scenario.lineupSettings.IDP ?? 0)) {
    items.push("IDP slots are supported by optimizer shape but depend on weekly IDP scoring rows being present.");
  }
  return items;
}

function groupWeeklyResults(rows: HistoricalWeeklyResult[]): Map<number, HistoricalWeeklyResult[]> {
  return rows.reduce((acc, row) => {
    acc.set(row.week, [...(acc.get(row.week) ?? []), row]);
    return acc;
  }, new Map<number, HistoricalWeeklyResult[]>());
}

function groupWeeklyResultsByExactId(rows: HistoricalWeeklyResult[]): Map<string, HistoricalWeeklyResult[]> {
  const grouped = new Map<string, HistoricalWeeklyResult[]>();
  for (const row of rows) {
    for (const id of [row.player_id, row.sleeper_id, row.gsis_id].filter(Boolean) as string[]) {
      grouped.set(id, [...(grouped.get(id) ?? []), row]);
    }
  }
  return grouped;
}

function groupRegistryByExactId(rows: HistoricalPlayerRegistryRow[]): Map<string, HistoricalPlayerRegistryRow[]> {
  const grouped = new Map<string, HistoricalPlayerRegistryRow[]>();
  for (const row of rows) {
    for (const id of [row.player_id, row.sleeper_id, row.gsis_id].filter(Boolean) as string[]) {
      grouped.set(id, [...(grouped.get(id) ?? []), row]);
    }
  }
  return grouped;
}

function registryConflict(row: HistoricalPlayerRegistryRow, pick: HistoricalMockDraftPickLog): boolean {
  const registryPosition = normalizePosition(row.position ?? "");
  return Boolean(registryPosition && registryPosition !== normalizePosition(pick.position));
}

function lineupPlayer(pick: HistoricalMockDraftPickLog, row: HistoricalWeeklyResult, matchedBy: HistoricalLineupPlayer["matchedBy"]): HistoricalLineupPlayer {
  return { playerId: pick.playerId, playerName: pick.playerName, position: normalizePosition(pick.position), points: row.fantasy_points, matchedBy, scoreStatus: "scored_from_weekly_result" };
}

function scoreStatus(player: HistoricalLineupPlayer): HistoricalLineupScoreStatus {
  if (player.scoreStatus) return player.scoreStatus;
  return player.matchedBy === "missing" ? "missing_weekly_source" : "scored_from_weekly_result";
}

function sumPositionalPoints(weeks: HistoricalWeeklyTeamScore[]): Record<string, number> {
  return weeks.reduce<Record<string, number>>((acc, week) => {
    for (const [slot, points] of Object.entries(week.positionalPointsBySlot)) acc[slot] = (acc[slot] ?? 0) + points;
    return acc;
  }, {});
}

function hitRate(weeks: HistoricalWeeklyTeamScore[]): number {
  const starters = weeks.flatMap((week) => week.starters);
  return starters.length ? starters.filter((player) => player.points >= 10).length / starters.length : 0;
}

function bustRate(weeks: HistoricalWeeklyTeamScore[]): number {
  const starters = weeks.flatMap((week) => week.starters);
  return starters.length ? starters.filter((player) => player.points < 5).length / starters.length : 0;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizePosition(position: string): string {
  const upper = position.toUpperCase();
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  return upper;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readPlayerRegistryRows(filePath: string): HistoricalPlayerRegistryRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(`Failed to parse ${filePath}: ${parsed.errors[0]?.message}`);
  return parsed.data.map((row) => ({
    player_id: stringValue(row.player_id),
    sleeper_id: stringValue(row.sleeper_id),
    gsis_id: stringValue(row.gsis_id),
    player_name: stringValue(row.player_name),
    display_name: stringValue(row.display_name),
    full_name: stringValue(row.full_name),
    position: stringValue(row.position),
    team: stringValue(row.team),
    latest_team: stringValue(row.latest_team),
    status: stringValue(row.status),
  }));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : value === null || value === undefined ? null : String(value).trim() || null;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function renderMarkdown(report: HistoricalSeasonOutcomeScorerReport): string {
  return `${[
    "# Historical Season Outcome Scorer",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Projection season: ${report.projectionSeason}`,
    `- Recommendation: ${report.recommendation}`,
    `- Actual weekly results found: ${report.actualWeeklyResultsFound}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Coverage",
    "",
    `- Result rows: ${report.weeklyInputCoverage.resultRows}`,
    `- Weeks: ${report.weeklyInputCoverage.weeks.join(", ") || "none"}`,
    `- Scored weekly result rows: ${report.weeklyInputCoverage.scoredWeeklyResultRows}`,
    `- Exact ID matches: ${report.weeklyInputCoverage.exactIdMatches}`,
    `- Name/position fallback matches: ${report.weeklyInputCoverage.namePositionFallbackMatches}`,
    `- True zero-week rows: ${report.weeklyInputCoverage.trueZeroWeekRows}`,
    `- Registry-backed zero-season rows: ${report.weeklyInputCoverage.registryBackedZeroSeasonRows}`,
    `- Missing player scores: ${report.weeklyInputCoverage.missingPlayerScores}`,
    `- Missing score rate before H40: ${report.weeklyInputCoverage.missingScoreRateBeforeH40}`,
    `- Missing score rate after true zero-week treatment: ${report.weeklyInputCoverage.missingScoreRateAfterTrueZeroWeekTreatment}`,
    `- Missing score rate after registry zero-season treatment: ${report.weeklyInputCoverage.missingScoreRateAfterRegistryZeroSeasonTreatment}`,
    `- Players with season-level exact match: ${report.weeklyInputCoverage.playersWithSeasonLevelExactMatch}`,
    `- Players with registry-only exact match: ${report.weeklyInputCoverage.playersWithRegistryOnlyExactMatch}`,
    `- Players missing from both weekly and registry source: ${report.weeklyInputCoverage.playersMissingFromBothWeeklyAndRegistrySource}`,
    `- Registry-backed zero-season unavailable: ${report.weeklyInputCoverage.registryBackedZeroSeasonUnavailable}`,
    "",
    "## Strategy Comparison",
    "",
    report.strategyComparison ? `- Blackbird rank: ${report.strategyComparison.blackbirdRankAmongStrategies}` : "- Not available.",
    report.strategyComparison ? `- Total deltas: ${JSON.stringify(report.strategyComparison.blackbirdTotalPointsDeltaVsBaseline)}` : "",
    "",
    "## Data Leakage Guard",
    "",
    `- Draft artifact loaded before outcomes: ${report.dataLeakageGuard.draftArtifactLoadedBeforeOutcomes}`,
    `- Actual outcomes scoring phase only: ${report.dataLeakageGuard.actualOutcomesOnlyUsedInScoringPhase}`,
    `- Draft rankings not recomputed from outcomes: ${report.dataLeakageGuard.draftRankingsNotRecomputedFromOutcomes}`,
    `- No future fields used in draft simulation: ${report.dataLeakageGuard.noFutureFieldsUsedInDraftSimulation}`,
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalSeasonOutcomeScorerReport): string {
  const rows = [["strategy", "team", "total_points", "weekly_average", "starter_points", "bench_points", "fill_rate"]];
  for (const outcome of report.strategyOutcomes) {
    rows.push([
      outcome.strategy,
      outcome.teamKey,
      String(round(outcome.best_ball_total_points)),
      String(round(outcome.weekly_average)),
      String(round(outcome.starter_points)),
      String(round(outcome.bench_points)),
      String(round(outcome.optimal_lineup_fill_rate)),
    ]);
  }
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}
