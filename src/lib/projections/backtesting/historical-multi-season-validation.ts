import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { HistoricalStrategyComparisonReport } from "./historical-strategy-comparison-report-types";
import type {
  HistoricalBaselineComparisonRow,
  HistoricalMultiSeasonAvailability,
  HistoricalMultiSeasonLeaderboardRow,
  HistoricalMultiSeasonValidationArtifactPaths,
  HistoricalMultiSeasonValidationReport,
  HistoricalSeasonValidationSummary,
} from "./historical-multi-season-validation-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const STRATEGIES: HistoricalMockDraftStrategy[] = ["blackbird_rank_only", "projection_only", "adp_only", "market_rank", "need_based", "random_within_adp_band"];
const BASELINES = STRATEGIES.filter((strategy) => strategy !== "blackbird_rank_only") as Array<Exclude<HistoricalMockDraftStrategy, "blackbird_rank_only">>;

export function runHistoricalMultiSeasonValidation(input: {
  seasons: number[];
  cwd?: string;
  generatedAt?: string;
}): HistoricalMultiSeasonValidationReport {
  const cwd = input.cwd ?? process.cwd();
  const seasons = [...new Set(input.seasons)].sort((a, b) => a - b);
  const perSeasonSummaries = seasons.map((season) => buildSeasonSummary({ cwd, season }));
  const availableSummaries = perSeasonSummaries.filter((summary) => summary.status === "available");
  const multiSeasonLeaderboard = buildMultiSeasonLeaderboard(availableSummaries);
  const baselineComparison = buildBaselineComparison(availableSummaries);
  const reliabilitySummaryBase = buildReliabilitySummary(perSeasonSummaries);
  const productConfidenceRecommendation = recommendProductConfidence(availableSummaries, reliabilitySummaryBase);
  const reliabilitySummary = {
    ...reliabilitySummaryBase,
    productConfidenceClaimSupported: productConfidenceRecommendation === "multi_season_validation_supports_blackbird_confidence",
  };
  const dataLeakageGuardBySeason = availableSummaries.map((summary) => {
    const passed = Object.values(summary.dataLeakageGuard).every(Boolean);
    return {
      season: summary.season,
      passed,
      detail: passed
        ? "Draft simulation and season outcome scoring phases are separated for this season."
        : "One or more data leakage guard checks failed for this season.",
    };
  });
  const safetyGates = buildSafetyGates({
    availableSeasonCount: availableSummaries.length,
    dataLeakagePassed: dataLeakageGuardBySeason.every((row) => row.passed),
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    seasonsRequested: seasons,
    seasonsAvailable: availableSummaries.map((summary) => summary.season),
    seasonsNotAvailable: perSeasonSummaries.filter((summary) => summary.status === "not_available").map((summary) => summary.season),
    sourceAvailability: perSeasonSummaries.map((summary) => ({ season: summary.season, availability: summary.availability })),
    perSeasonSummaries,
    multiSeasonLeaderboard,
    blackbirdSummary: buildBlackbirdSummary(availableSummaries),
    baselineComparison,
    reliabilitySummary,
    productConfidenceRecommendation,
    dataLeakageGuard: {
      allAvailableSeasonsPassed: dataLeakageGuardBySeason.every((row) => row.passed),
      bySeason: dataLeakageGuardBySeason,
    },
    safetyGates,
    artifactPaths: {
      strategyComparisonArtifacts: seasons.map((season) => {
        const artifactPath = path.join(OUTPUT_DIR, `historical-strategy-comparison-${season}.json`);
        return { season, path: artifactPath, present: existsSync(path.resolve(cwd, artifactPath)) };
      }),
    },
    limitations: buildLimitations(perSeasonSummaries, productConfidenceRecommendation),
  };
}

export function writeHistoricalMultiSeasonValidationArtifacts(
  report: HistoricalMultiSeasonValidationReport,
  cwd = process.cwd(),
): HistoricalMultiSeasonValidationArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const seasonRange = `${Math.min(...report.seasonsRequested)}-${Math.max(...report.seasonsRequested)}`;
  const base = `historical-multi-season-validation-${seasonRange}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildSeasonSummary(input: { cwd: string; season: number }): HistoricalSeasonValidationSummary {
  const availability = discoverSeasonAvailability(input);
  const strategyArtifactPath = path.resolve(input.cwd, OUTPUT_DIR, `historical-strategy-comparison-${input.season}.json`);
  const strategyReport = availability.strategyComparisonArtifactPresent
    ? readJson<HistoricalStrategyComparisonReport>(strategyArtifactPath)
    : null;
  const status = strategyReport ? "available" : "not_available";
  const dataLeakageGuard = {
    draftRostersCameFromPreseasonOnlyEngine: strategyReport?.dataLeakageGuard.draftRostersCameFromH36PreseasonOnlyEngine === true,
    weeklyRegistryOutcomesUsedOnlyAfterDraft: strategyReport?.dataLeakageGuard.outcomesCameFromH37ScoringPhase === true,
    zeroWeekAndZeroSeasonDidNotAlterDraftRankings: true,
    strategyComparisonDidNotRecomputeDraftDecisionsFromOutcomes: strategyReport?.dataLeakageGuard.strategyComparisonDidNotRecomputeRankingsFromOutcomes === true,
    actualSeasonPointsUsedOnlyAfterDraftsComplete: strategyReport?.dataLeakageGuard.actualSeasonPointsUsedOnlyAfterDraftsWereComplete === true,
  };
  const blackbird = strategyReport?.strategyLeaderboard.find((row) => row.strategy === "blackbird_rank_only");

  return {
    season: input.season,
    status,
    availability,
    strategyLeaderboard: strategyReport?.strategyLeaderboard ?? [],
    blackbirdRank: blackbird?.rank ?? "not_available",
    blackbirdAveragePoints: blackbird?.average_team_points ?? "not_available",
    blackbirdDeltaVsBaseline: strategyReport?.blackbirdFocus.blackbirdPointDeltaVsBaseline ?? {},
    missingScoreRate: strategyReport?.missingScoreCoverage.finalMissingScoreRate ?? strategyReport?.missingScoreCoverage.missingScoreRate ?? "not_available",
    reliabilityGrade: strategyReport?.missingScoreCoverage.reliabilityGrade ?? "not_available",
    safetyGates: strategyReport?.safetyGates ?? [],
    dataLeakageGuard,
    notes: [
      ...(status === "not_available" ? availability.missingInputs.map((item) => `Missing input: ${item}`) : []),
      ...(strategyReport?.limitations ?? []),
    ],
  };
}

function discoverSeasonAvailability(input: { cwd: string; season: number }): HistoricalMultiSeasonAvailability {
  const paths = {
    preseasonSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${input.season}.json`),
    weeklyResultsSource: path.join("data", "nflverse", `player_stats_${input.season}.csv`),
    playerRegistry: path.join("data", "nflverse", "players.csv"),
    rosterSource: path.join("data", "nflverse", `rosters_${input.season}.csv`),
    generatedDraftUniverse: path.join(OUTPUT_DIR, `historical-draft-universe-${input.season}.json`),
    historicalMockDraftScenario: path.join("data", "backtesting", `historical-mock-draft-scenario.${input.season}.generated.json`),
    fallbackHistoricalMockDraftScenario: path.join("data", "backtesting", "historical-mock-draft-scenario.template.json"),
    seasonOutcomeScoringArtifact: path.join(OUTPUT_DIR, `historical-season-outcome-scorer-${input.season}.json`),
    seasonOutcomeScenario: path.join("data", "backtesting", "historical-season-outcome-scenario.template.json"),
    strategyComparisonArtifact: path.join(OUTPUT_DIR, `historical-strategy-comparison-${input.season}.json`),
  };
  const present = (relativePath: string) => existsSync(path.resolve(input.cwd, relativePath));
  const preseasonSnapshotPresent = present(paths.preseasonSnapshot);
  const weeklyResultsSourcePresent = present(paths.weeklyResultsSource);
  const playerRegistryPresent = present(paths.playerRegistry);
  const rosterSourcePresent = present(paths.rosterSource);
  const generatedDraftUniversePresent = present(paths.generatedDraftUniverse);
  const generatedDraftUniverseBuildable = preseasonSnapshotPresent && weeklyResultsSourcePresent;
  const historicalMockDraftScenarioPresent = present(paths.historicalMockDraftScenario);
  const historicalMockDraftScenarioBuildable = generatedDraftUniversePresent && present(paths.fallbackHistoricalMockDraftScenario);
  const seasonOutcomeScoringArtifactPresent = present(paths.seasonOutcomeScoringArtifact);
  const seasonOutcomeScoringArtifactBuildable = present(paths.seasonOutcomeScenario) && weeklyResultsSourcePresent && playerRegistryPresent;
  const strategyComparisonArtifactPresent = present(paths.strategyComparisonArtifact);
  const strategyComparisonArtifactBuildable = generatedDraftUniversePresent && seasonOutcomeScoringArtifactPresent;
  const requiredForAvailable = [
    ["preseason snapshot", preseasonSnapshotPresent],
    ["weekly results source", weeklyResultsSourcePresent],
    ["player registry", playerRegistryPresent],
    ["generated draft universe", generatedDraftUniversePresent || generatedDraftUniverseBuildable],
    ["historical mock draft scenario", historicalMockDraftScenarioPresent || historicalMockDraftScenarioBuildable],
    ["season outcome scoring artifact", seasonOutcomeScoringArtifactPresent || seasonOutcomeScoringArtifactBuildable],
    ["strategy comparison artifact", strategyComparisonArtifactPresent || strategyComparisonArtifactBuildable],
  ] as const;

  return {
    preseasonSnapshotPresent,
    weeklyResultsSourcePresent,
    playerRegistryPresent,
    rosterSourcePresent,
    generatedDraftUniversePresent,
    generatedDraftUniverseBuildable,
    historicalMockDraftScenarioPresent,
    historicalMockDraftScenarioBuildable,
    seasonOutcomeScoringArtifactPresent,
    seasonOutcomeScoringArtifactBuildable,
    strategyComparisonArtifactPresent,
    strategyComparisonArtifactBuildable,
    missingInputs: requiredForAvailable.filter(([, ok]) => !ok).map(([name]) => name),
  };
}

function buildMultiSeasonLeaderboard(summaries: HistoricalSeasonValidationSummary[]): HistoricalMultiSeasonLeaderboardRow[] {
  return STRATEGIES.map((strategy) => {
    const rows = summaries.flatMap((summary) => {
      const row = summary.strategyLeaderboard.find((entry) => entry.strategy === strategy);
      return row ? [{ rank: row.rank, points: row.average_team_points }] : [];
    });
    return {
      strategy,
      averageRank: round(average(rows.map((row) => row.rank))),
      averagePoints: round(average(rows.map((row) => row.points))),
      medianPoints: round(median(rows.map((row) => row.points))),
      wins: rows.filter((row) => row.rank === 1).length,
      top2Finishes: rows.filter((row) => row.rank <= 2).length,
      seasonsAvailable: rows.length,
    };
  }).filter((row) => row.seasonsAvailable > 0)
    .sort((a, b) => a.averageRank - b.averageRank || b.averagePoints - a.averagePoints || a.strategy.localeCompare(b.strategy));
}

function buildBaselineComparison(summaries: HistoricalSeasonValidationSummary[]): HistoricalBaselineComparisonRow[] {
  return BASELINES.map((baseline) => {
    const deltas = summaries.flatMap((summary) => {
      const delta = summary.blackbirdDeltaVsBaseline[baseline];
      return typeof delta === "number" ? [delta] : [];
    });
    return {
      baseline,
      seasonsWon: deltas.filter((delta) => delta > 0).length,
      seasonsLost: deltas.filter((delta) => delta < 0).length,
      seasonsTied: deltas.filter((delta) => delta === 0).length,
      averagePointDelta: round(average(deltas)),
      medianPointDelta: round(median(deltas)),
      largestWin: round(deltas.length ? Math.max(...deltas) : 0),
      largestLoss: round(deltas.length ? Math.min(...deltas) : 0),
    };
  });
}

function buildReliabilitySummary(summaries: HistoricalSeasonValidationSummary[]) {
  const available = summaries.filter((summary) => summary.status === "available");
  const seasonsByReliability = (grade: HistoricalSeasonValidationSummary["reliabilityGrade"]) =>
    available.filter((summary) => summary.reliabilityGrade === grade).map((summary) => summary.season);
  const missingRates = available.flatMap((summary) => typeof summary.missingScoreRate === "number" ? [summary.missingScoreRate] : []);
  return {
    highReliabilitySeasons: seasonsByReliability("high"),
    mediumReliabilitySeasons: seasonsByReliability("medium"),
    lowReliabilitySeasons: seasonsByReliability("low"),
    insufficientReliabilitySeasons: seasonsByReliability("insufficient"),
    averageMissingScoreRate: round(average(missingRates)),
    coverageLimitationsBySeason: summaries.map((summary) => ({ season: summary.season, limitations: summary.notes })),
    productConfidenceClaimSupported: false,
  };
}

function recommendProductConfidence(
  summaries: HistoricalSeasonValidationSummary[],
  reliability: ReturnType<typeof buildReliabilitySummary>,
): HistoricalMultiSeasonValidationReport["productConfidenceRecommendation"] {
  if (!summaries.length) return "multi_season_validation_needs_source_data";
  if (summaries.length === 1) return "multi_season_validation_needs_more_seasons";
  const highReliabilityCount = reliability.highReliabilitySeasons.length;
  if (highReliabilityCount < summaries.length) return "multi_season_validation_directional_only";
  const blackbirdRanks = summaries.flatMap((summary) => typeof summary.blackbirdRank === "number" ? [summary.blackbirdRank] : []);
  const averageBlackbirdRank = average(blackbirdRanks);
  const baselineRows = buildBaselineComparison(summaries);
  const baselinesBeatenOrTied = baselineRows.filter((row) => row.seasonsWon + row.seasonsTied >= row.seasonsLost).length;
  if (summaries.length >= 3 && averageBlackbirdRank <= 2 && baselinesBeatenOrTied >= 4) {
    return "multi_season_validation_supports_blackbird_confidence";
  }
  return "multi_season_validation_directional_only";
}

function buildBlackbirdSummary(summaries: HistoricalSeasonValidationSummary[]): HistoricalMultiSeasonValidationReport["blackbirdSummary"] {
  const ranked = summaries.flatMap((summary) => typeof summary.blackbirdRank === "number" ? [{ season: summary.season, rank: summary.blackbirdRank }] : []);
  const averageDeltaVsBaseline = Object.fromEntries(BASELINES.map((baseline) => {
    const deltas = summaries.flatMap((summary) => typeof summary.blackbirdDeltaVsBaseline[baseline] === "number" ? [summary.blackbirdDeltaVsBaseline[baseline]] : []);
    return [baseline, round(average(deltas))];
  }));
  return {
    averageRank: ranked.length ? round(average(ranked.map((row) => row.rank))) : "not_available",
    bestSeason: ranked.length ? ranked.sort((a, b) => a.rank - b.rank || a.season - b.season)[0].season : "not_available",
    worstSeason: ranked.length ? ranked.sort((a, b) => b.rank - a.rank || a.season - b.season)[0].season : "not_available",
    averageDeltaVsBaseline,
  };
}

function buildSafetyGates(input: { availableSeasonCount: number; dataLeakagePassed: boolean }) {
  return [
    gate("no_live_outputs_changed", true, "Report reads and writes local backtesting artifacts only."),
    gate("no_supabase_writes", true, "No Supabase client is imported or called."),
    gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
    gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
    gate("historical_backtest_no_future_leakage", input.dataLeakagePassed, "Available seasons report draft/outcome phase separation."),
    gate("outcomes_used_only_after_draft", input.dataLeakagePassed, "Weekly outcomes are consumed from H37/H38 artifacts after H36 draft rosters exist."),
    gate("registry_zero_season_exact_id_only", true, "This report trusts H42 scorer policy and does not add matching logic."),
    gate("loose_fuzzy_not_confirmed", true, "No fuzzy matching is performed by this multi-season report."),
    gate("dry_run_only", true, "Report is dry-run/read-only historical validation infrastructure."),
    gate("at_least_one_available_season", input.availableSeasonCount > 0, "At least one season has a strategy comparison artifact."),
  ];
}

function buildLimitations(
  summaries: HistoricalSeasonValidationSummary[],
  recommendation: HistoricalMultiSeasonValidationReport["productConfidenceRecommendation"],
) {
  return [
    ...summaries.filter((summary) => summary.status === "not_available").map((summary) => `${summary.season} not available: ${summary.availability.missingInputs.join(", ") || "strategy artifact missing"}.`),
    ...(recommendation === "multi_season_validation_needs_more_seasons" ? ["Only one season is currently available, so product-confidence claims need more seasons."] : []),
  ];
}

function renderMarkdown(report: HistoricalMultiSeasonValidationReport) {
  return `${[
    `# Historical Multi-Season Validation ${Math.min(...report.seasonsRequested)}-${Math.max(...report.seasonsRequested)}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Recommendation: ${report.productConfidenceRecommendation}`,
    `- Available seasons: ${report.seasonsAvailable.join(", ") || "none"}`,
    `- Not available seasons: ${report.seasonsNotAvailable.join(", ") || "none"}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Source Availability",
    "",
    "| Season | Status | Preseason | Weekly | Registry | Roster | Draft Universe | Mock Scenario | H37 | H38 |",
    "|---:|---|---|---|---|---|---|---|---|---|",
    ...report.perSeasonSummaries.map((summary) => `| ${summary.season} | ${summary.status} | ${yes(summary.availability.preseasonSnapshotPresent)} | ${yes(summary.availability.weeklyResultsSourcePresent)} | ${yes(summary.availability.playerRegistryPresent)} | ${yes(summary.availability.rosterSourcePresent)} | ${yes(summary.availability.generatedDraftUniversePresent)} | ${yes(summary.availability.historicalMockDraftScenarioPresent || summary.availability.historicalMockDraftScenarioBuildable)} | ${yes(summary.availability.seasonOutcomeScoringArtifactPresent)} | ${yes(summary.availability.strategyComparisonArtifactPresent)} |`),
    "",
    "## Per-Season Blackbird",
    "",
    "| Season | Rank | Avg Points | Missing Rate | Reliability | Deltas |",
    "|---:|---:|---:|---:|---|---|",
    ...report.perSeasonSummaries.map((summary) => `| ${summary.season} | ${summary.blackbirdRank} | ${summary.blackbirdAveragePoints} | ${summary.missingScoreRate} | ${summary.reliabilityGrade} | ${Object.entries(summary.blackbirdDeltaVsBaseline).map(([key, value]) => `${key}: ${value}`).join("; ") || "not_available"} |`),
    "",
    "## Multi-Season Leaderboard",
    "",
    "| Strategy | Avg Rank | Avg Points | Median Points | Wins | Top-2 | Seasons |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...report.multiSeasonLeaderboard.map((row) => `| ${row.strategy} | ${row.averageRank} | ${row.averagePoints} | ${row.medianPoints} | ${row.wins} | ${row.top2Finishes} | ${row.seasonsAvailable} |`),
    "",
    "## Baseline Comparison",
    "",
    "| Baseline | Won | Lost | Tied | Avg Delta | Median Delta | Largest Win | Largest Loss |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...report.baselineComparison.map((row) => `| ${row.baseline} | ${row.seasonsWon} | ${row.seasonsLost} | ${row.seasonsTied} | ${row.averagePointDelta} | ${row.medianPointDelta} | ${row.largestWin} | ${row.largestLoss} |`),
    "",
    "## Reliability",
    "",
    `- High reliability seasons: ${report.reliabilitySummary.highReliabilitySeasons.join(", ") || "none"}`,
    `- Medium reliability seasons: ${report.reliabilitySummary.mediumReliabilitySeasons.join(", ") || "none"}`,
    `- Low reliability seasons: ${report.reliabilitySummary.lowReliabilitySeasons.join(", ") || "none"}`,
    `- Insufficient reliability seasons: ${report.reliabilitySummary.insufficientReliabilitySeasons.join(", ") || "none"}`,
    `- Average missing score rate: ${report.reliabilitySummary.averageMissingScoreRate}`,
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalMultiSeasonValidationReport) {
  const headers = ["season", "status", "blackbird_rank", "blackbird_average_points", "missing_score_rate", "reliability_grade", "recommendation"];
  const rows = report.perSeasonSummaries.map((summary) => [
    summary.season,
    summary.status,
    summary.blackbirdRank,
    summary.blackbirdAveragePoints,
    summary.missingScoreRate,
    summary.reliabilityGrade,
    report.productConfidenceRecommendation,
  ]);
  return [headers, ...rows].map((row) => row.map((value) => csvCell(String(value))).join(",")).join("\n") + "\n";
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function yes(value: boolean) {
  return value ? "yes" : "no";
}

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
