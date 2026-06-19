import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalDraftUniverseReport } from "./historical-draft-universe-builder-types";
import type { HistoricalMockDraftEngineReport, HistoricalMockDraftPickLog, HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { HistoricalSeasonOutcomeScorerReport, HistoricalSeasonTeamOutcome, HistoricalWeeklyTeamScore } from "./historical-season-outcome-scorer-types";
import type {
  HistoricalBlackbirdFocus,
  HistoricalDraftCapitalAnalysis,
  HistoricalDraftCapitalRoundSummary,
  HistoricalMissingScoreCoverage,
  HistoricalPositionalOutcomeSummary,
  HistoricalStrategyComparisonArtifactPaths,
  HistoricalStrategyComparisonReport,
  HistoricalStrategyLeaderboardRow,
  HistoricalTeamComparisonRow,
} from "./historical-strategy-comparison-report-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const STRATEGIES: HistoricalMockDraftStrategy[] = ["blackbird_rank_only", "projection_only", "adp_only", "market_rank", "need_based", "random_within_adp_band"];

export function runHistoricalStrategyComparisonReport(input: {
  season: number;
  cwd?: string;
  generatedAt?: string;
}): HistoricalStrategyComparisonReport {
  const cwd = input.cwd ?? process.cwd();
  const sourceArtifacts = {
    mockDraftEngine: path.join(OUTPUT_DIR, `historical-mock-draft-engine-${input.season}.json`),
    seasonOutcomeScorer: path.join(OUTPUT_DIR, `historical-season-outcome-scorer-${input.season}.json`),
    draftUniverse: path.join(OUTPUT_DIR, `historical-draft-universe-${input.season}.json`),
    weeklyResults: path.join(OUTPUT_DIR, `historical-weekly-results-${input.season}.normalized.json`),
  };
  const missingArtifacts = Object.values(sourceArtifacts).filter((artifactPath) => !existsSync(path.resolve(cwd, artifactPath)));
  const draftReport = missingArtifacts.length ? null : readJson<HistoricalMockDraftEngineReport>(path.resolve(cwd, sourceArtifacts.mockDraftEngine));
  const outcomeReport = missingArtifacts.length ? null : readJson<HistoricalSeasonOutcomeScorerReport>(path.resolve(cwd, sourceArtifacts.seasonOutcomeScorer));
  const universeReport = missingArtifacts.length ? null : readJson<HistoricalDraftUniverseReport>(path.resolve(cwd, sourceArtifacts.draftUniverse));

  const outcomes = outcomeReport?.strategyOutcomes ?? [];
  const leaderboard = buildStrategyLeaderboard(outcomes);
  const blackbirdFocus = buildBlackbirdFocus(leaderboard, outcomes);
  const teamLevelComparison = buildTeamLevelComparison(outcomes);
  const positionalOutcomeAnalysis = buildPositionalOutcomeAnalysis(outcomes);
  const missingScoreCoverage = buildMissingScoreCoverage({ outcomes, outcomeReport, universeReport });
  const draftCapitalRoundAnalysis = buildDraftCapitalRoundAnalysis(draftReport, outcomes);
  const limitations = buildLimitations(missingArtifacts, draftCapitalRoundAnalysis, missingScoreCoverage);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    recommendation: recommend(missingArtifacts.length, outcomeReport, missingScoreCoverage),
    sourceArtifacts,
    strategyLeaderboard: leaderboard,
    blackbirdFocus,
    teamLevelComparison,
    positionalOutcomeAnalysis,
    draftCapitalRoundAnalysis,
    missingScoreCoverage,
    dataLeakageGuard: {
      draftRostersCameFromH36PreseasonOnlyEngine: draftReport?.dataLeakageGuard.actualSeasonScoringLoaded === false,
      outcomesCameFromH37ScoringPhase: outcomeReport?.dataLeakageGuard.actualOutcomesOnlyUsedInScoringPhase === true,
      strategyComparisonDidNotRecomputeRankingsFromOutcomes: true,
      actualSeasonPointsUsedOnlyAfterDraftsWereComplete: true,
    },
    limitations,
    safetyGates: [
      gate("no_live_outputs_changed", true, "Report reads local H36/H37 artifacts and writes local backtesting reports only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("historical_backtest_no_future_leakage", true, "Comparison consumes completed H36 draft artifact and H37 outcome artifact only."),
      gate("missing_score_coverage_reported", missingScoreCoverage.universePlayers > 0 || missingScoreCoverage.h37MissingPlayerScores > 0, "Missing score coverage is included in the report."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeHistoricalStrategyComparisonArtifacts(
  report: HistoricalStrategyComparisonReport,
  cwd = process.cwd(),
): HistoricalStrategyComparisonArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-strategy-comparison-${report.season}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function buildStrategyLeaderboard(outcomes: HistoricalSeasonTeamOutcome[]): HistoricalStrategyLeaderboardRow[] {
  const blackbirdAverage = average(outcomes.filter((outcome) => outcome.strategy === "blackbird_rank_only").map((outcome) => outcome.best_ball_total_points));
  const blackbirdWeeklyAverage = average(outcomes.filter((outcome) => outcome.strategy === "blackbird_rank_only").map((outcome) => outcome.weekly_average));
  const rows = STRATEGIES
    .map((strategy) => {
      const strategyOutcomes = outcomes.filter((outcome) => outcome.strategy === strategy);
      const totals = strategyOutcomes.map((outcome) => outcome.best_ball_total_points);
      const weeklyAverages = strategyOutcomes.map((outcome) => outcome.weekly_average);
      return {
        strategy,
        rank: 0,
        best_ball_total_points: round(average(totals)),
        weekly_average: round(average(weeklyAverages)),
        best_team_points: round(Math.max(...totals, 0)),
        worst_team_points: round(totals.length ? Math.min(...totals) : 0),
        average_team_points: round(average(totals)),
        median_team_points: round(median(totals)),
        team_count: strategyOutcomes.length,
        blackbird_delta_points: round(blackbirdAverage - average(totals)),
        blackbird_delta_weekly_average: round(blackbirdWeeklyAverage - average(weeklyAverages)),
      };
    })
    .filter((row) => row.team_count > 0)
    .sort((a, b) => b.average_team_points - a.average_team_points || a.strategy.localeCompare(b.strategy));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildBlackbirdFocus(leaderboard: HistoricalStrategyLeaderboardRow[], outcomes: HistoricalSeasonTeamOutcome[]): HistoricalBlackbirdFocus {
  const blackbird = leaderboard.find((row) => row.strategy === "blackbird_rank_only");
  const teamRanks = [...outcomes]
    .sort((a, b) => b.best_ball_total_points - a.best_ball_total_points)
    .map((outcome, index) => ({ outcome, rank: index + 1 }))
    .filter((item) => item.outcome.strategy === "blackbird_rank_only")
    .map((item) => item.rank);
  return {
    blackbirdOverallRank: blackbird?.rank ?? "not_available",
    strategiesBlackbirdBeat: leaderboard.filter((row) => row.strategy !== "blackbird_rank_only" && (blackbird?.average_team_points ?? 0) > row.average_team_points).map((row) => row.strategy),
    strategiesThatBeatBlackbird: leaderboard.filter((row) => row.strategy !== "blackbird_rank_only" && row.average_team_points > (blackbird?.average_team_points ?? 0)).map((row) => row.strategy),
    blackbirdPointDeltaVsBaseline: Object.fromEntries(leaderboard.filter((row) => row.strategy !== "blackbird_rank_only").map((row) => [row.strategy, row.blackbird_delta_points])),
    blackbirdWeeklyAverageDeltaVsBaseline: Object.fromEntries(leaderboard.filter((row) => row.strategy !== "blackbird_rank_only").map((row) => [row.strategy, row.blackbird_delta_weekly_average])),
    blackbirdBestTeamRank: teamRanks.length ? Math.min(...teamRanks) : "not_available",
    blackbirdWorstTeamRank: teamRanks.length ? Math.max(...teamRanks) : "not_available",
  };
}

function buildTeamLevelComparison(outcomes: HistoricalSeasonTeamOutcome[]): HistoricalTeamComparisonRow[] {
  return outcomes.map((outcome) => ({
    strategy: outcome.strategy,
    team_id: outcome.teamKey,
    draft_slot: draftSlot(outcome.teamKey),
    season_points: round(outcome.best_ball_total_points),
    weekly_average: round(outcome.weekly_average),
    weekly_scores: outcome.weekly_scores.map((week) => round(week.totalPoints)),
    position_points: roundRecord(outcome.positional_points_by_slot),
    starter_fill_rate: round(outcome.optimal_lineup_fill_rate),
    zero_score_starter_weeks: outcome.zero_score_starter_weeks,
    missing_score_count: missingCount(outcome.weekly_scores),
  }));
}

function buildPositionalOutcomeAnalysis(outcomes: HistoricalSeasonTeamOutcome[]): HistoricalPositionalOutcomeSummary[] {
  const strategyTotals = new Map<HistoricalMockDraftStrategy, Record<string, number>>();
  for (const strategy of STRATEGIES) {
    const strategyOutcomes = outcomes.filter((outcome) => outcome.strategy === strategy);
    strategyTotals.set(strategy, averagePositionPoints(strategyOutcomes));
  }
  const fieldAverage = averagePositionPoints(outcomes);
  return [...strategyTotals.entries()]
    .filter(([, totals]) => Object.keys(totals).length)
    .map(([strategy, totals]) => {
      const advantage = Object.fromEntries(["QB", "RB", "WR", "TE", "FLEX", "SUPERFLEX"].map((slot) => [slot, round((totals[slot] ?? 0) - (fieldAverage[slot] ?? 0))]));
      const sorted = Object.entries(advantage).sort((a, b) => b[1] - a[1]);
      return {
        strategy,
        QB: round(totals.QB ?? 0),
        RB: round(totals.RB ?? 0),
        WR: round(totals.WR ?? 0),
        TE: round(totals.TE ?? 0),
        FLEX: round(totals.FLEX ?? 0),
        SUPERFLEX: round(totals.SUPERFLEX ?? 0),
        positional_advantage_vs_field: advantage,
        position_that_drove_success: sorted[0]?.[0] ?? "not_available_v1",
        position_that_hurt_most: sorted.at(-1)?.[0] ?? "not_available_v1",
      };
    });
}

function buildDraftCapitalRoundAnalysis(
  draftReport: HistoricalMockDraftEngineReport | null,
  outcomes: HistoricalSeasonTeamOutcome[],
): HistoricalDraftCapitalAnalysis {
  if (!draftReport || !outcomes.length) {
    return {
      roundSummaries: [],
      early_round_efficiency: {} as Record<HistoricalMockDraftStrategy, number>,
      middle_round_efficiency: {} as Record<HistoricalMockDraftStrategy, number>,
      late_round_efficiency: {} as Record<HistoricalMockDraftStrategy, number>,
      best_value_picks: [],
      worst_misses: [],
      limitations: ["Draft capital analysis requires H36 draft logs and H37 weekly outcome rows."],
    };
  }
  const pickContributions = contributionRows(draftReport, outcomes);
  const roundSummaries: HistoricalDraftCapitalRoundSummary[] = [];
  for (const strategy of STRATEGIES) {
    for (const roundNumber of unique(pickContributions.filter((row) => row.strategy === strategy).map((row) => row.round)).sort((a, b) => a - b)) {
      const rows = pickContributions.filter((row) => row.strategy === strategy && row.round === roundNumber);
      roundSummaries.push({
        strategy,
        round: roundNumber,
        points_by_round_drafted: round(sum(rows.map((row) => row.points))),
        hits_by_round: rows.filter((row) => row.points >= 20).length,
        busts_by_round: rows.filter((row) => row.points === 0).length,
      });
    }
  }
  return {
    roundSummaries,
    early_round_efficiency: efficiencyByBand(pickContributions, 1, 4),
    middle_round_efficiency: efficiencyByBand(pickContributions, 5, 10),
    late_round_efficiency: efficiencyByBand(pickContributions, 11, 99),
    best_value_picks: pickContributions.filter((row) => row.round >= 8).sort((a, b) => b.points - a.points).slice(0, 10).map(publicContribution),
    worst_misses: pickContributions.filter((row) => row.round <= 5).sort((a, b) => a.points - b.points).slice(0, 10).map(publicContribution),
    limitations: ["Round contribution is based on H37 roster weekly scorer output; replacement value and regret score remain not_available_v1 until H39."],
  };
}

function buildMissingScoreCoverage(input: {
  outcomes: HistoricalSeasonTeamOutcome[];
  outcomeReport: HistoricalSeasonOutcomeScorerReport | null;
  universeReport: HistoricalDraftUniverseReport | null;
}): HistoricalMissingScoreCoverage {
  const h37Exact = input.outcomeReport?.weeklyInputCoverage.exactIdMatches ?? 0;
  const trueZeroWeekRows = input.outcomeReport?.weeklyInputCoverage.trueZeroWeekRows ?? 0;
  const registryBackedZeroSeasonRows = input.outcomeReport?.weeklyInputCoverage.registryBackedZeroSeasonRows ?? 0;
  const h37Missing = input.outcomeReport?.weeklyInputCoverage.missingPlayerScores ?? 0;
  const rateBeforeZeroTreatment = input.outcomeReport?.weeklyInputCoverage.missingScoreRateBeforeZeroWeekTreatment ?? (h37Exact + h37Missing ? h37Missing / (h37Exact + h37Missing) : 1);
  const adjustedRate = input.outcomeReport?.weeklyInputCoverage.missingScoreRateAfterRegistryZeroSeasonTreatment
    ?? input.outcomeReport?.weeklyInputCoverage.missingScoreRateAfterZeroWeekTreatment
    ?? (h37Exact + trueZeroWeekRows + registryBackedZeroSeasonRows + h37Missing ? h37Missing / (h37Exact + trueZeroWeekRows + registryBackedZeroSeasonRows + h37Missing) : 1);
  const missingByPosition = countMissingBy(input.outcomes, (player) => player.position);
  const missingByStrategy = Object.fromEntries(STRATEGIES.map((strategy) => [strategy, sum(input.outcomes.filter((outcome) => outcome.strategy === strategy).map((outcome) => missingCount(outcome.weekly_scores)))])) as Record<HistoricalMockDraftStrategy, number>;
  const adjustedMissingByStrategy = STRATEGIES.map((strategy) => {
    const strategyOutcomes = input.outcomes.filter((outcome) => outcome.strategy === strategy);
    const totalPlayerWeeks = sum(strategyOutcomes.map((outcome) => playerWeekCount(outcome.weekly_scores)));
    const missingScoreCount = missingByStrategy[strategy] ?? 0;
    return { strategy, missingScoreRate: totalPlayerWeeks ? round(missingScoreCount / totalPlayerWeeks) : 0, missingScoreCount, totalPlayerWeeks };
  }).filter((row) => row.totalPlayerWeeks > 0);
  const reliabilityGrade = reliability(adjustedRate, input.outcomeReport?.actualWeeklyResultsFound === true);
  return {
    universePlayers: input.universeReport?.identifierCoveragePreview.universePlayers ?? 0,
    weeklyExactIdMatchedUniversePlayers: input.universeReport?.identifierCoveragePreview.playersWithWeeklyResultExactIdMatch ?? 0,
    universeMissingWeeklyOutcomePlayers: input.universeReport?.identifierCoveragePreview.playersMissingWeeklyOutcome ?? 0,
    h37ExactIdMatches: h37Exact,
    trueZeroWeekRows,
    registryBackedZeroSeasonRows,
    h37MissingPlayerScores: h37Missing,
    missingScoreRate: round(adjustedRate),
    missingScoreRateBeforeZeroWeekTreatment: round(rateBeforeZeroTreatment),
    adjustedMissingScoreRate: round(adjustedRate),
    finalMissingScoreRate: round(adjustedRate),
    positionsMostAffectedByMissingScores: Object.entries(missingByPosition).sort((a, b) => b[1] - a[1]).map(([position, missingScoreCount]) => ({ position, missingScoreCount })),
    strategiesMostAffectedByMissingScores: Object.entries(missingByStrategy).sort((a, b) => b[1] - a[1]).map(([strategy, missingScoreCount]) => ({ strategy: strategy as HistoricalMockDraftStrategy, missingScoreCount })),
    adjustedMissingScoreRateByStrategy: adjustedMissingByStrategy.sort((a, b) => b.missingScoreRate - a.missingScoreRate || b.missingScoreCount - a.missingScoreCount),
    reliabilityGrade,
    warning: adjustedRate >= 0.1
      ? "This comparison is directional because some drafted players lacked weekly scoring matches. Strategy rankings should be reviewed with coverage context."
      : null,
  };
}

function recommend(
  missingArtifactCount: number,
  outcomeReport: HistoricalSeasonOutcomeScorerReport | null,
  coverage: HistoricalMissingScoreCoverage,
): HistoricalStrategyComparisonReport["recommendation"] {
  if (missingArtifactCount > 0) return "historical_strategy_comparison_blocked";
  if (!outcomeReport?.actualWeeklyResultsFound) return "historical_strategy_comparison_needs_outcome_data";
  if (coverage.reliabilityGrade === "low" || coverage.reliabilityGrade === "insufficient") return "historical_strategy_comparison_needs_coverage_improvement";
  return "historical_strategy_comparison_ready_for_review";
}

function buildLimitations(
  missingArtifacts: string[],
  draftCapital: HistoricalDraftCapitalAnalysis,
  coverage: HistoricalMissingScoreCoverage,
) {
  return [
    ...missingArtifacts.map((artifactPath) => `Missing required artifact: ${artifactPath}`),
    ...draftCapital.limitations,
    ...(coverage.warning ? [coverage.warning] : []),
  ];
}

function contributionRows(draftReport: HistoricalMockDraftEngineReport, outcomes: HistoricalSeasonTeamOutcome[]) {
  const picks = new Map<string, HistoricalMockDraftPickLog>();
  for (const result of draftReport.strategyResults) {
    for (const pick of result.pickLog) picks.set(`${result.strategy}|slot-${pick.draftSlot}|${pick.playerId}`, pick);
  }
  const points = new Map<string, number>();
  for (const outcome of outcomes) {
    for (const week of outcome.weekly_scores) {
      for (const player of [...week.starters, ...week.bench]) {
        const key = `${outcome.strategy}|${outcome.teamKey}|${player.playerId}`;
        points.set(key, (points.get(key) ?? 0) + player.points);
      }
    }
  }
  return [...points.entries()].flatMap(([key, value]) => {
    const pick = picks.get(key);
    if (!pick) return [];
    return [{ strategy: pick.strategy, player: pick.playerName, round: pick.round, points: round(value) }];
  });
}

function countMissingBy(outcomes: HistoricalSeasonTeamOutcome[], keyFor: (player: { position: string }) => string) {
  const counts: Record<string, number> = {};
  for (const outcome of outcomes) {
    for (const week of outcome.weekly_scores) {
      for (const player of [...week.starters, ...week.bench]) {
        if (!isMissingScore(player)) continue;
        const key = keyFor(player);
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return counts;
}

function missingCount(weeks: HistoricalWeeklyTeamScore[]) {
  return weeks.reduce((total, week) => total + [...week.starters, ...week.bench].filter(isMissingScore).length, 0);
}

function playerWeekCount(weeks: HistoricalWeeklyTeamScore[]) {
  return weeks.reduce((total, week) => total + week.starters.length + week.bench.length, 0);
}

function isMissingScore(player: { matchedBy: string; scoreStatus?: string }) {
  return player.scoreStatus ? ["missing_weekly_source", "missing_identifier_mapping"].includes(player.scoreStatus) : player.matchedBy === "missing";
}

function averagePositionPoints(outcomes: HistoricalSeasonTeamOutcome[]) {
  const totals: Record<string, number[]> = {};
  for (const outcome of outcomes) {
    for (const [slot, points] of Object.entries(outcome.positional_points_by_slot)) {
      totals[slot] = [...(totals[slot] ?? []), points];
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([slot, values]) => [slot, average(values)]));
}

function efficiencyByBand(rows: Array<{ strategy: HistoricalMockDraftStrategy; round: number; points: number }>, min: number, max: number) {
  return Object.fromEntries(STRATEGIES.map((strategy) => {
    const band = rows.filter((row) => row.strategy === strategy && row.round >= min && row.round <= max);
    return [strategy, round(average(band.map((row) => row.points)))];
  })) as Record<HistoricalMockDraftStrategy, number>;
}

function publicContribution(row: { strategy: HistoricalMockDraftStrategy; player: string; round: number; points: number }) {
  return { strategy: row.strategy, player: row.player, round: row.round, points: row.points };
}

function draftSlot(teamKey: string) {
  const match = teamKey.match(/slot-(\d+)/);
  return match ? Number(match[1]) : null;
}

function reliability(rate: number, hasOutcomes: boolean): HistoricalMissingScoreCoverage["reliabilityGrade"] {
  if (!hasOutcomes) return "insufficient";
  if (rate < 0.05) return "high";
  if (rate < 0.2) return "medium";
  if (rate < 0.5) return "low";
  return "insufficient";
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function roundRecord(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, round(value)]));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function renderMarkdown(report: HistoricalStrategyComparisonReport) {
  return `${[
    `# Historical Strategy Comparison ${report.season}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Recommendation: ${report.recommendation}`,
    `- Reliability grade: ${report.missingScoreCoverage.reliabilityGrade}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Strategy Leaderboard",
    "",
    "| Rank | Strategy | Avg Points | Weekly Avg | Best Team | Worst Team | Blackbird Delta |",
    "|---:|---|---:|---:|---:|---:|---:|",
    ...report.strategyLeaderboard.map((row) => `| ${row.rank} | ${row.strategy} | ${row.average_team_points} | ${row.weekly_average} | ${row.best_team_points} | ${row.worst_team_points} | ${row.blackbird_delta_points} |`),
    "",
    "## Blackbird Focus",
    "",
    `- Overall rank: ${report.blackbirdFocus.blackbirdOverallRank}`,
    `- Beat: ${report.blackbirdFocus.strategiesBlackbirdBeat.join(", ") || "none"}`,
    `- Beaten by: ${report.blackbirdFocus.strategiesThatBeatBlackbird.join(", ") || "none"}`,
    `- Best team rank: ${report.blackbirdFocus.blackbirdBestTeamRank}`,
    `- Worst team rank: ${report.blackbirdFocus.blackbirdWorstTeamRank}`,
    "",
    "## Missing Score Coverage",
    "",
    `- Universe players: ${report.missingScoreCoverage.universePlayers}`,
    `- Weekly exact ID matched universe players: ${report.missingScoreCoverage.weeklyExactIdMatchedUniversePlayers}`,
    `- Universe missing weekly outcome players: ${report.missingScoreCoverage.universeMissingWeeklyOutcomePlayers}`,
    `- H37 exact ID matches: ${report.missingScoreCoverage.h37ExactIdMatches}`,
    `- True zero-week rows: ${report.missingScoreCoverage.trueZeroWeekRows}`,
    `- Registry-backed zero-season rows: ${report.missingScoreCoverage.registryBackedZeroSeasonRows}`,
    `- H37 missing player scores: ${report.missingScoreCoverage.h37MissingPlayerScores}`,
    `- Missing score rate before zero-week treatment: ${report.missingScoreCoverage.missingScoreRateBeforeZeroWeekTreatment}`,
    `- Final missing score rate: ${report.missingScoreCoverage.finalMissingScoreRate}`,
    `- Reliability grade: ${report.missingScoreCoverage.reliabilityGrade}`,
    "- Note: Players with exact registry identity but no weekly production were scored as zero-season contributors.",
    report.missingScoreCoverage.warning ? `- Warning: ${report.missingScoreCoverage.warning}` : "- Warning: none",
    "",
    "## Data Leakage Guard",
    "",
    `- Draft rosters came from H36 preseason-only engine: ${report.dataLeakageGuard.draftRostersCameFromH36PreseasonOnlyEngine}`,
    `- Outcomes came from H37 scoring phase: ${report.dataLeakageGuard.outcomesCameFromH37ScoringPhase}`,
    `- Strategy comparison did not recompute rankings from outcomes: ${report.dataLeakageGuard.strategyComparisonDidNotRecomputeRankingsFromOutcomes}`,
    `- Actual season points used only after drafts were complete: ${report.dataLeakageGuard.actualSeasonPointsUsedOnlyAfterDraftsWereComplete}`,
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalStrategyComparisonReport) {
  const headers = ["rank", "strategy", "average_team_points", "weekly_average", "best_team_points", "worst_team_points", "team_count", "blackbird_delta_points", "blackbird_delta_weekly_average", "reliability_grade", "missing_score_rate"];
  const rows = report.strategyLeaderboard.map((row) => [
    row.rank,
    row.strategy,
    row.average_team_points,
    row.weekly_average,
    row.best_team_points,
    row.worst_team_points,
    row.team_count,
    row.blackbird_delta_points,
    row.blackbird_delta_weekly_average,
    report.missingScoreCoverage.reliabilityGrade,
    report.missingScoreCoverage.missingScoreRate,
  ]);
  return [headers, ...rows].map((row) => row.map((value) => csvCell(String(value))).join(",")).join("\n") + "\n";
}

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
