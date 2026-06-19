import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import type { HistoricalDraftUniverseReport } from "./historical-draft-universe-builder-types";
import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { HistoricalOutcomeCoverageDiagnosticsReport, HistoricalOutcomeCoverageMissingScoreRow } from "./historical-outcome-coverage-diagnostics-types";
import type { HistoricalSeasonOutcomeScorerReport } from "./historical-season-outcome-scorer-types";
import type { HistoricalStrategyComparisonReport } from "./historical-strategy-comparison-report-types";
import type { HistoricalWeeklyResultsReport } from "./historical-weekly-results-source-types";
import type {
  HistoricalWeeklySourceAvailability,
  HistoricalWeeklySourceExpansionFinalRecommendation,
  HistoricalWeeklySourceExpansionIntegrationRecommendation,
  HistoricalWeeklySourceExpansionPlayerRow,
  HistoricalWeeklySourceExpansionProjection,
  HistoricalWeeklySourceExpansionReason,
  HistoricalWeeklySourceExpansionReviewArtifactPaths,
  HistoricalWeeklySourceExpansionReviewReport,
  HistoricalWeeklySourceExpansionStrategyDistortion,
  HistoricalWeeklySourceExpansionTreatment,
} from "./historical-weekly-source-expansion-review-types";

type CsvRow = Record<string, unknown>;
type SourceBundle = {
  rosters: SourceData;
  players: SourceData;
  snap_counts: SourceData;
  injuries: SourceData;
  depth_charts: SourceData;
};
type SourceData = { path: string; exists: boolean; rows: CsvRow[] };
type MissingPlayerAggregate = {
  rows: HistoricalOutcomeCoverageMissingScoreRow[];
  player_id: string;
  sleeper_id: string | null;
  gsis_id: string | null;
  player_name: string;
  position: string;
  team: string | null;
};

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const STRATEGIES: HistoricalMockDraftStrategy[] = ["blackbird_rank_only", "projection_only", "adp_only", "market_rank", "need_based", "random_within_adp_band"];

export function runHistoricalWeeklySourceExpansionReview(input: {
  season: number;
  cwd?: string;
  generatedAt?: string;
}): HistoricalWeeklySourceExpansionReviewReport {
  const cwd = input.cwd ?? process.cwd();
  const sourceArtifacts = {
    seasonOutcomeScorer: path.join(OUTPUT_DIR, `historical-season-outcome-scorer-${input.season}.json`),
    outcomeCoverageDiagnostics: path.join(OUTPUT_DIR, `historical-outcome-coverage-diagnostics-${input.season}.json`),
    strategyComparison: path.join(OUTPUT_DIR, `historical-strategy-comparison-${input.season}.json`),
    draftUniverse: path.join(OUTPUT_DIR, `historical-draft-universe-${input.season}.json`),
    weeklyResults: path.join(OUTPUT_DIR, `historical-weekly-results-${input.season}.normalized.json`),
    playerStatsCsv: path.join("data", "nflverse", `player_stats_${input.season}.csv`),
    rostersCsv: path.join("data", "nflverse", `rosters_${input.season}.csv`),
    playersCsv: path.join("data", "nflverse", "players.csv"),
    snapCountsCsv: path.join("data", "nflverse", `snap_counts_${input.season}.csv`),
    snapCountsMultiSeasonCsv: path.join("data", "nflverse", "snap_counts_2018_2025.csv"),
    injuriesCsv: path.join("data", "nflverse", `injuries_${input.season}.csv`),
    depthChartsCsv: path.join("data", "nflverse", `depth_charts_${input.season}.csv`),
  };
  const requiredArtifacts = [
    sourceArtifacts.seasonOutcomeScorer,
    sourceArtifacts.outcomeCoverageDiagnostics,
    sourceArtifacts.strategyComparison,
    sourceArtifacts.draftUniverse,
    sourceArtifacts.weeklyResults,
  ];
  const missingArtifacts = requiredArtifacts.filter((artifactPath) => !existsSync(path.resolve(cwd, artifactPath)));
  const h37 = missingArtifacts.length ? null : readJson<HistoricalSeasonOutcomeScorerReport>(path.resolve(cwd, sourceArtifacts.seasonOutcomeScorer));
  const h39 = missingArtifacts.length ? null : readJson<HistoricalOutcomeCoverageDiagnosticsReport>(path.resolve(cwd, sourceArtifacts.outcomeCoverageDiagnostics));
  const h38 = missingArtifacts.length ? null : readJson<HistoricalStrategyComparisonReport>(path.resolve(cwd, sourceArtifacts.strategyComparison));
  const universe = missingArtifacts.length ? null : readJson<HistoricalDraftUniverseReport>(path.resolve(cwd, sourceArtifacts.draftUniverse));
  const weekly = missingArtifacts.length ? null : readJson<HistoricalWeeklyResultsReport>(path.resolve(cwd, sourceArtifacts.weeklyResults));
  const sources = readSources(cwd, sourceArtifacts, input.season);
  const missingRows = h39?.missingScoreRows ?? [];
  const aggregates = aggregateMissingPlayers(missingRows);
  const sourceAvailability = summarizeSources(sources, aggregates);
  const remainingMissingPlayers = buildPlayerRows(aggregates, sources, weekly?.summary.weeksCovered.length || h37?.weeklyInputCoverage.weeks.length || 0);
  const projectedCoverageImprovement = buildProjection(h37, remainingMissingPlayers);
  const strategyDistortionSummary = buildStrategyDistortion(h38, missingRows);
  const h37IntegrationRecommendation = recommendH37(missingArtifacts.length, sourceAvailability, projectedCoverageImprovement, remainingMissingPlayers);
  const recommendation = recommendFinal(h37IntegrationRecommendation);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    recommendation,
    h37IntegrationRecommendation,
    sourceArtifacts,
    sourceAvailability,
    remainingMissingPlayers,
    reasonSummary: summarizeBy(remainingMissingPlayers, "reason"),
    treatmentSummary: summarizeBy(remainingMissingPlayers, "recommended_treatment").map((row) => ({
      treatment: row.reason as HistoricalWeeklySourceExpansionTreatment,
      players: row.count,
      missing_rows: row.missing_rows,
    })),
    projectedCoverageImprovement,
    strategyDistortionSummary,
    dataLeakageGuard: {
      draftRostersCameFromH36PreseasonOnlyEngine: universe?.dataLeakageGuard.noOutcomePointsJoinedIntoDraftUniverse === true,
      outcomesUsedOnlyAfterDraft: h37?.dataLeakageGuard.actualOutcomesOnlyUsedInScoringPhase === true,
      noDraftRankingsRecomputedFromOutcomes: h37?.dataLeakageGuard.draftRankingsNotRecomputedFromOutcomes === true,
      noLooseFuzzyConfirmedMatches: true,
    },
    limitations: buildLimitations(missingArtifacts, sourceAvailability, projectedCoverageImprovement),
    safetyGates: [
      gate("no_live_outputs_changed", true, "Review reads historical artifacts and local source files only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("historical_backtest_no_future_leakage", true, "Review consumes completed H36/H37/H38/H39 artifacts only."),
      gate("outcomes_used_only_after_draft", true, "Outcome and status sources are reviewed only after draft rosters exist."),
      gate("loose_fuzzy_not_confirmed", true, "Name-only and loose fuzzy candidates are not confirmed as scoring identity."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeHistoricalWeeklySourceExpansionReviewArtifacts(
  report: HistoricalWeeklySourceExpansionReviewReport,
  cwd = process.cwd(),
): HistoricalWeeklySourceExpansionReviewArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-weekly-source-expansion-review-${report.season}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function readSources(cwd: string, sourceArtifacts: Record<string, string>, season: number): SourceBundle {
  const snapPath = existsSync(path.resolve(cwd, sourceArtifacts.snapCountsCsv))
    ? sourceArtifacts.snapCountsCsv
    : sourceArtifacts.snapCountsMultiSeasonCsv;
  return {
    rosters: readSource(cwd, sourceArtifacts.rostersCsv, season),
    players: readSource(cwd, sourceArtifacts.playersCsv, null),
    snap_counts: readSource(cwd, snapPath, season),
    injuries: readSource(cwd, sourceArtifacts.injuriesCsv, season),
    depth_charts: readSource(cwd, sourceArtifacts.depthChartsCsv, season),
  };
}

function readSource(cwd: string, sourcePath: string, season: number | null): SourceData {
  const fullPath = path.resolve(cwd, sourcePath);
  if (!existsSync(fullPath)) return { path: sourcePath, exists: false, rows: [] };
  const rows = readCsvRows(fullPath).filter((row) => season === null || numberValue(row.season) === season);
  return { path: sourcePath, exists: true, rows };
}

function aggregateMissingPlayers(rows: HistoricalOutcomeCoverageMissingScoreRow[]): MissingPlayerAggregate[] {
  const grouped = new Map<string, HistoricalOutcomeCoverageMissingScoreRow[]>();
  for (const row of rows) grouped.set(row.player_id, [...(grouped.get(row.player_id) ?? []), row]);
  return [...grouped.entries()].map(([player_id, playerRows]) => {
    const first = playerRows[0];
    return {
      rows: playerRows,
      player_id,
      sleeper_id: first?.sleeper_id ?? null,
      gsis_id: first?.gsis_id ?? null,
      player_name: first?.player_name ?? player_id,
      position: first?.position ?? "",
      team: first?.team ?? null,
    };
  });
}

function summarizeSources(sources: SourceBundle, aggregates: MissingPlayerAggregate[]): HistoricalWeeklySourceAvailability[] {
  return [
    sourceAvailability("rosters", sources.rosters, aggregates),
    sourceAvailability("players", sources.players, aggregates),
    sourceAvailability("snap_counts", sources.snap_counts, aggregates),
    sourceAvailability("injuries", sources.injuries, aggregates),
    sourceAvailability("depth_charts", sources.depth_charts, aggregates),
  ];
}

function sourceAvailability(source: HistoricalWeeklySourceAvailability["source"], data: SourceData, aggregates: MissingPlayerAggregate[]): HistoricalWeeklySourceAvailability {
  const exact = new Set<string>();
  const strict = new Set<string>();
  for (const player of aggregates) {
    const hasExact = data.rows.some((row) => exactIdMatch(row, player));
    if (hasExact) exact.add(player.player_id);
    if (!hasExact && data.rows.some((row) => strictNamePositionTeamMatch(row, player))) strict.add(player.player_id);
  }
  return {
    source,
    path: data.path,
    exists: data.exists,
    rows: data.rows.length,
    exact_id_matches: exact.size,
    strict_name_position_team_candidates: strict.size,
  };
}

function buildPlayerRows(aggregates: MissingPlayerAggregate[], sources: SourceBundle, expectedWeeks: number): HistoricalWeeklySourceExpansionPlayerRow[] {
  return aggregates.map((player) => {
    const rosterExact = sources.rosters.rows.some((row) => exactIdMatch(row, player));
    const playerExact = sources.players.rows.some((row) => exactIdMatch(row, player));
    const snapExact = sources.snap_counts.rows.some((row) => exactIdMatch(row, player));
    const injuryExact = sources.injuries.rows.some((row) => exactIdMatch(row, player));
    const rosterStrict = sources.rosters.rows.some((row) => strictNamePositionTeamMatch(row, player));
    const playerStrict = sources.players.rows.some((row) => strictNamePositionTeamMatch(row, player));
    const snapStrict = sources.snap_counts.rows.some((row) => strictNamePositionTeamMatch(row, player));
    const reason = classifyReason({ rosterExact, playerExact, snapExact, injuryExact, rosterStrict, playerStrict, snapStrict });
    const treatment = treatmentFor(reason);
    return {
      player_id: player.player_id,
      sleeper_id: player.sleeper_id,
      gsis_id: player.gsis_id,
      player_name: player.player_name,
      position: player.position,
      team: player.team,
      drafted_by_strategies: unique(player.rows.map((row) => row.strategy)).sort() as HistoricalMockDraftStrategy[],
      drafted_count: unique(player.rows.map((row) => `${row.strategy}:${row.team_id}`)).length,
      draft_rounds: unique(player.rows.map((row) => row.draft_round).filter((round): round is number => round !== null)).sort((a, b) => a - b),
      missing_weeks: unique(player.rows.map((row) => row.week)).sort((a, b) => a - b),
      expected_weeks: expectedWeeks,
      season_level_weekly_source_present: player.rows.some((row) => row.season_level_player_found_in_weekly_source),
      roster_source_present: rosterExact,
      player_registry_present: playerExact,
      candidate_source_availability: candidateAvailability({ rosterExact, playerExact, snapExact, injuryExact, rosterStrict, playerStrict, snapStrict }),
      reason,
      recommended_treatment: treatment,
      missing_rows: player.rows.length,
    };
  }).sort((a, b) => b.missing_rows - a.missing_rows || a.player_name.localeCompare(b.player_name));
}

function classifyReason(input: {
  rosterExact: boolean;
  playerExact: boolean;
  snapExact: boolean;
  injuryExact: boolean;
  rosterStrict: boolean;
  playerStrict: boolean;
  snapStrict: boolean;
}): HistoricalWeeklySourceExpansionReason {
  if (input.rosterExact || input.playerExact) return "likely_zero_season_player";
  if (input.snapExact) return "needs_weekly_source_expansion";
  if (input.injuryExact) return "needs_injury_status_source";
  if (input.rosterStrict || input.playerStrict) return "identifier_mapping_gap";
  if (input.snapStrict) return "needs_snap_count_source";
  return "not_in_weekly_source_and_not_rostered";
}

function treatmentFor(reason: HistoricalWeeklySourceExpansionReason): HistoricalWeeklySourceExpansionTreatment {
  if (reason === "likely_zero_season_player" || reason === "not_in_weekly_source_but_in_roster_source") return "zero_season_confirmed";
  if (reason === "identifier_mapping_gap") return "needs_identifier_mapping";
  if (reason === "manual_review_required" || reason === "position_or_team_mismatch") return "manual_review";
  if (reason === "not_in_weekly_source_and_not_rostered") return "do_not_score";
  return "needs_additional_source";
}

function buildProjection(
  h37: HistoricalSeasonOutcomeScorerReport | null,
  players: HistoricalWeeklySourceExpansionPlayerRow[],
): HistoricalWeeklySourceExpansionProjection {
  const currentMissing = h37?.weeklyInputCoverage.missingPlayerScores ?? sum(players.map((player) => player.missing_rows));
  const denominator = h37
    ? h37.weeklyInputCoverage.exactIdMatches + h37.weeklyInputCoverage.trueZeroWeekRows + h37.weeklyInputCoverage.missingPlayerScores
    : currentMissing;
  const zeroRows = sum(players.filter((player) => player.recommended_treatment === "zero_season_confirmed" || player.recommended_treatment === "zero_weeks_from_roster_status").map((player) => player.missing_rows));
  const idRows = sum(players.filter((player) => player.recommended_treatment === "needs_identifier_mapping").map((player) => player.missing_rows));
  const reviewRows = sum(players.filter((player) => player.recommended_treatment === "manual_review").map((player) => player.missing_rows));
  const sourceRows = sum(players.filter((player) => player.recommended_treatment === "needs_additional_source" || player.recommended_treatment === "do_not_score").map((player) => player.missing_rows));
  const remaining = Math.max(currentMissing - zeroRows, 0);
  const projectedRate = denominator ? round(remaining / denominator) : 0;
  return {
    current_missing_rows: currentMissing,
    missing_rows_that_could_become_zero_season_rows: zeroRows,
    missing_rows_requiring_source_expansion: sourceRows,
    missing_rows_requiring_identifier_mapping: idRows,
    missing_rows_requiring_manual_review: reviewRows,
    projected_remaining_missing_rows: remaining,
    current_missing_rate: h37?.weeklyInputCoverage.missingScoreRateAfterZeroWeekTreatment ?? (denominator ? round(currentMissing / denominator) : 0),
    projected_missing_rate_after_safe_treatment: projectedRate,
    projected_reliability_grade: reliability(projectedRate),
  };
}

function buildStrategyDistortion(
  h38: HistoricalStrategyComparisonReport | null,
  missingRows: HistoricalOutcomeCoverageMissingScoreRow[],
): HistoricalWeeklySourceExpansionStrategyDistortion {
  const rows = h38?.missingScoreCoverage.adjustedMissingScoreRateByStrategy ?? STRATEGIES.map((strategy) => {
    const strategyMissing = missingRows.filter((row) => row.strategy === strategy).length;
    return { strategy, missingScoreCount: strategyMissing, totalPlayerWeeks: 0, missingScoreRate: 0 };
  });
  const remaining = rows.map((row) => ({
    strategy: row.strategy,
    missing_rows: row.missingScoreCount,
    total_player_weeks: row.totalPlayerWeeks,
    missing_rate: row.missingScoreRate,
  })).sort((a, b) => b.missing_rate - a.missing_rate || b.missing_rows - a.missing_rows);
  const maxRate = remaining[0]?.missing_rate ?? 0;
  const mostDistorted = remaining.filter((row) => row.missing_rate >= maxRate - 0.01).map((row) => row.strategy);
  const blackbird = remaining.find((row) => row.strategy === "blackbird_rank_only")?.missing_rate ?? 0;
  return {
    remaining_missing_rate_by_strategy: remaining,
    most_distorted_strategies: mostDistorted,
    blackbird_rank_likely_stable_or_uncertain: maxRate - blackbird > 0.2 ? "likely_stable" : "uncertain",
  };
}

function recommendH37(
  missingArtifactCount: number,
  sourceAvailability: HistoricalWeeklySourceAvailability[],
  projection: HistoricalWeeklySourceExpansionProjection,
  players: HistoricalWeeklySourceExpansionPlayerRow[],
): HistoricalWeeklySourceExpansionIntegrationRecommendation {
  if (missingArtifactCount > 0) return "weekly_source_expansion_blocked";
  if (!sourceAvailability.some((source) => source.source === "rosters" && source.exists) && !sourceAvailability.some((source) => source.source === "players" && source.exists)) {
    return "weekly_source_expansion_needs_roster_source";
  }
  if (projection.missing_rows_requiring_identifier_mapping > 0) return "weekly_source_expansion_needs_identifier_mapping";
  if (projection.missing_rows_that_could_become_zero_season_rows > 0 && projection.missing_rows_requiring_manual_review === 0) {
    return "weekly_source_expansion_ready_for_zero_season_treatment";
  }
  if (players.length) return "weekly_source_expansion_needs_additional_sources";
  return "weekly_source_expansion_ready_for_zero_season_treatment";
}

function recommendFinal(h37: HistoricalWeeklySourceExpansionIntegrationRecommendation): HistoricalWeeklySourceExpansionFinalRecommendation {
  if (h37 === "weekly_source_expansion_blocked") return "historical_weekly_source_expansion_blocked";
  if (h37 === "weekly_source_expansion_ready_for_zero_season_treatment") return "historical_weekly_source_expansion_ready_for_h42_fix";
  if (h37 === "weekly_source_expansion_needs_identifier_mapping") return "historical_weekly_source_expansion_needs_manual_review";
  return "historical_weekly_source_expansion_needs_source_files";
}

function summarizeBy<T extends HistoricalWeeklySourceExpansionPlayerRow, K extends "reason" | "recommended_treatment">(players: T[], key: K) {
  const counts = new Map<string, { count: number; missing_rows: number }>();
  for (const player of players) {
    const value = String(player[key]);
    const current = counts.get(value) ?? { count: 0, missing_rows: 0 };
    counts.set(value, { count: current.count + 1, missing_rows: current.missing_rows + player.missing_rows });
  }
  return [...counts.entries()].sort((a, b) => b[1].missing_rows - a[1].missing_rows).map(([reason, value]) => ({
    reason: reason as HistoricalWeeklySourceExpansionReason,
    count: value.count,
    missing_rows: value.missing_rows,
  }));
}

function candidateAvailability(input: Record<string, boolean>): string[] {
  return Object.entries(input).filter(([, present]) => present).map(([source]) => source);
}

function exactIdMatch(row: CsvRow, player: MissingPlayerAggregate): boolean {
  const rowIds = [
    stringValue(row.player_id),
    stringValue(row.gsis_id),
    stringValue(row.sleeper_id),
    stringValue(row.nfl_id),
  ].filter(Boolean);
  return [player.player_id, player.gsis_id, player.sleeper_id].filter(Boolean).some((id) => rowIds.includes(id));
}

function strictNamePositionTeamMatch(row: CsvRow, player: MissingPlayerAggregate): boolean {
  const rowName = stringValue(row.player_name) ?? stringValue(row.full_name) ?? stringValue(row.display_name) ?? stringValue(row.player);
  const rowPosition = normalizePosition(stringValue(row.position) ?? stringValue(row.depth_chart_position) ?? "");
  const rowTeam = stringValue(row.team) ?? stringValue(row.latest_team);
  return Boolean(rowName && rowPosition && normalize(rowName) === normalize(player.player_name) && rowPosition === normalizePosition(player.position) && (!player.team || !rowTeam || normalize(rowTeam) === normalize(player.team)));
}

function buildLimitations(
  missingArtifacts: string[],
  sourceAvailability: HistoricalWeeklySourceAvailability[],
  projection: HistoricalWeeklySourceExpansionProjection,
): string[] {
  const limitations = ["Zero-season treatment is preview-only; H37 is not changed by this report."];
  limitations.push(...missingArtifacts.map((artifactPath) => `Missing required artifact: ${artifactPath}`));
  for (const source of sourceAvailability.filter((item) => !item.exists)) limitations.push(`Optional source not present: ${source.path}`);
  if (projection.projected_remaining_missing_rows > 0) limitations.push("Some rows remain missing after safe treatment and require source expansion, identifier mapping, or a policy decision.");
  return limitations;
}

function renderMarkdown(report: HistoricalWeeklySourceExpansionReviewReport): string {
  const sources = report.sourceAvailability.map((source) => `- ${source.source}: exists=${source.exists}, rows=${source.rows}, exact=${source.exact_id_matches}, strict=${source.strict_name_position_team_candidates}`).join("\n");
  const reasons = report.reasonSummary.map((row) => `- ${row.reason}: ${row.count} players, ${row.missing_rows} rows`).join("\n") || "- none";
  const strategies = report.strategyDistortionSummary.remaining_missing_rate_by_strategy.map((row) => `- ${row.strategy}: ${row.missing_rate} (${row.missing_rows}/${row.total_player_weeks})`).join("\n");
  return `${[
    `# Historical Weekly Source Expansion Review ${report.season}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Recommendation: ${report.recommendation}`,
    `- H37 integration: ${report.h37IntegrationRecommendation}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Source Availability",
    "",
    sources,
    "",
    "## Missing Reason Summary",
    "",
    reasons,
    "",
    "## Projected Coverage",
    "",
    `- Current missing rows: ${report.projectedCoverageImprovement.current_missing_rows}`,
    `- Zero-season preview rows: ${report.projectedCoverageImprovement.missing_rows_that_could_become_zero_season_rows}`,
    `- Projected remaining missing rows: ${report.projectedCoverageImprovement.projected_remaining_missing_rows}`,
    `- Projected missing rate: ${report.projectedCoverageImprovement.projected_missing_rate_after_safe_treatment}`,
    `- Projected reliability grade: ${report.projectedCoverageImprovement.projected_reliability_grade}`,
    "",
    "## Strategy Distortion",
    "",
    strategies,
    "",
    "## Safety Gates",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed}`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalWeeklySourceExpansionReviewReport): string {
  const rows = [["player_id", "sleeper_id", "gsis_id", "player_name", "position", "team", "drafted_by_strategies", "drafted_count", "draft_rounds", "missing_weeks", "missing_rows", "roster_source_present", "player_registry_present", "reason", "recommended_treatment"]];
  for (const player of report.remainingMissingPlayers) {
    rows.push([
      player.player_id,
      player.sleeper_id ?? "",
      player.gsis_id ?? "",
      player.player_name,
      player.position,
      player.team ?? "",
      player.drafted_by_strategies.join("|"),
      String(player.drafted_count),
      player.draft_rounds.join("|"),
      player.missing_weeks.join("|"),
      String(player.missing_rows),
      String(player.roster_source_present),
      String(player.player_registry_present),
      player.reason,
      player.recommended_treatment,
    ]);
  }
  return `${rows.map((row) => row.map((value) => csvCell(value)).join(",")).join("\n")}\n`;
}

function readCsvRows(filePath: string): CsvRow[] {
  const parsed = Papa.parse<CsvRow>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(`Failed to parse ${filePath}: ${parsed.errors[0]?.message}`);
  return parsed.data;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function reliability(rate: number): HistoricalWeeklySourceExpansionProjection["projected_reliability_grade"] {
  if (rate < 0.05) return "high";
  if (rate < 0.2) return "medium";
  if (rate < 0.5) return "low";
  return "insufficient";
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : value === null || value === undefined ? null : String(value).trim() || null;
}

function numberValue(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizePosition(position: string): string {
  const upper = position.toUpperCase();
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  return upper;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
