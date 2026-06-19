import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalDraftUniverseReport, HistoricalDraftUniverseRow } from "./historical-draft-universe-builder-types";
import type { HistoricalMockDraftEngineReport, HistoricalMockDraftPickLog, HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { HistoricalSeasonOutcomeScorerReport, HistoricalSeasonTeamOutcome } from "./historical-season-outcome-scorer-types";
import type { HistoricalWeeklyResultsReport, HistoricalWeeklyResultsNormalizedRow } from "./historical-weekly-results-source-types";
import type {
  HistoricalOutcomeCoverageCandidateStatus,
  HistoricalOutcomeCoverageDiagnosticsArtifactPaths,
  HistoricalOutcomeCoverageDiagnosticsReport,
  HistoricalOutcomeCoverageFinalRecommendation,
  HistoricalOutcomeCoverageImprovementPreview,
  HistoricalOutcomeCoverageIntegrationRecommendation,
  HistoricalOutcomeCoverageMissingReason,
  HistoricalOutcomeCoverageMissingScoreRow,
  HistoricalOutcomeCoverageRateRow,
  HistoricalOutcomeCoverageSeasonPlayerRow,
} from "./historical-outcome-coverage-diagnostics-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const STRATEGIES: HistoricalMockDraftStrategy[] = ["blackbird_rank_only", "projection_only", "adp_only", "market_rank", "need_based", "random_within_adp_band"];

type DraftedPlayer = {
  pick: HistoricalMockDraftPickLog;
  sleeperId: string | null;
  gsisId: string | null;
};

type Indexes = {
  universeByAnyId: Map<string, HistoricalDraftUniverseRow>;
  weeklyByAnyId: Map<string, HistoricalWeeklyResultsNormalizedRow[]>;
  weeklyByNamePosition: Map<string, HistoricalWeeklyResultsNormalizedRow[]>;
  weeklyByNameTeamPosition: Map<string, HistoricalWeeklyResultsNormalizedRow[]>;
  weeklyByName: Map<string, HistoricalWeeklyResultsNormalizedRow[]>;
  picksByStrategySlotPlayer: Map<string, DraftedPlayer>;
};

export function runHistoricalOutcomeCoverageDiagnostics(input: {
  season: number;
  cwd?: string;
  generatedAt?: string;
}): HistoricalOutcomeCoverageDiagnosticsReport {
  const cwd = input.cwd ?? process.cwd();
  const sourceArtifacts = {
    draftUniverse: path.join(OUTPUT_DIR, `historical-draft-universe-${input.season}.json`),
    mockDraftEngine: path.join(OUTPUT_DIR, `historical-mock-draft-engine-${input.season}.json`),
    seasonOutcomeScorer: path.join(OUTPUT_DIR, `historical-season-outcome-scorer-${input.season}.json`),
    strategyComparison: path.join(OUTPUT_DIR, `historical-strategy-comparison-${input.season}.json`),
    weeklyResults: path.join(OUTPUT_DIR, `historical-weekly-results-${input.season}.normalized.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${input.season}.json`),
    nflversePlayerStatsCsv: path.join("data", "nflverse", `player_stats_${input.season}.csv`),
  };
  const requiredArtifacts = [sourceArtifacts.draftUniverse, sourceArtifacts.mockDraftEngine, sourceArtifacts.seasonOutcomeScorer, sourceArtifacts.weeklyResults];
  const missingArtifacts = requiredArtifacts.filter((artifactPath) => !existsSync(path.resolve(cwd, artifactPath)));
  const draftReport = missingArtifacts.length ? null : readJson<HistoricalMockDraftEngineReport>(path.resolve(cwd, sourceArtifacts.mockDraftEngine));
  const outcomeReport = missingArtifacts.length ? null : readJson<HistoricalSeasonOutcomeScorerReport>(path.resolve(cwd, sourceArtifacts.seasonOutcomeScorer));
  const universeReport = missingArtifacts.length ? null : readJson<HistoricalDraftUniverseReport>(path.resolve(cwd, sourceArtifacts.draftUniverse));
  const weeklyReport = missingArtifacts.length ? null : readJson<HistoricalWeeklyResultsReport>(path.resolve(cwd, sourceArtifacts.weeklyResults));

  const indexes = buildIndexes(draftReport, universeReport, weeklyReport?.results ?? []);
  const expectedWeeks = outcomeReport?.weeklyInputCoverage.weeks.length ? outcomeReport.weeklyInputCoverage.weeks : unique((weeklyReport?.results ?? []).map((row) => row.week));
  const totalPlayerWeeks = outcomeReport?.strategyOutcomes.reduce((sum, outcome) => sum + outcome.weekly_scores.reduce((weekSum, week) => weekSum + week.starters.length + week.bench.length, 0), 0) ?? 0;
  const missingScoreRows = outcomeReport ? buildMissingScoreRows(outcomeReport.strategyOutcomes, indexes) : [];
  const seasonLevelCoverage = draftReport ? buildSeasonLevelCoverage(draftReport, indexes, expectedWeeks) : [];
  const improvementPreview = buildImprovementPreview(missingScoreRows, totalPlayerWeeks);
  const strategyImpactPreview = buildStrategyImpactPreview(outcomeReport?.strategyOutcomes ?? [], missingScoreRows, draftReport);
  const h37IntegrationRecommendation = recommendH37(missingArtifacts.length, improvementPreview, missingScoreRows);
  const recommendation = recommendFinal(h37IntegrationRecommendation, missingScoreRows);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    recommendation,
    h37IntegrationRecommendation,
    sourceArtifacts,
    missingScoreRows,
    missingReasonSummary: summarizeReasons(missingScoreRows),
    seasonLevelCoverage,
    trueZeroVsIdentifierMismatch: {
      true_zero_week_rows: missingScoreRows.filter((row) => row.score_should_be_zero_for_week).length,
      identifier_mismatch_suspected_rows: missingScoreRows.filter((row) => row.mapping_failure_suspected).length,
      source_expansion_needed_rows: missingScoreRows.filter((row) => row.missing_reason === "player_not_in_weekly_source").length,
      manual_review_candidate_rows: missingScoreRows.filter((row) => row.candidate_match_status.includes("candidate")).length,
    },
    improvementPreview,
    strategyImpactPreview,
    dataLeakageGuard: {
      draftRostersCameFromH36PreseasonOnlyEngine: draftReport?.dataLeakageGuard.actualSeasonScoringLoaded === false,
      outcomesCameFromH37ScoringPhase: outcomeReport?.dataLeakageGuard.actualOutcomesOnlyUsedInScoringPhase === true,
      actualSeasonPointsUsedOnlyAfterDraftsWereComplete: true,
      noLooseFuzzyConfirmedMatches: true,
    },
    limitations: buildLimitations(missingArtifacts, improvementPreview),
    safetyGates: [
      gate("no_live_outputs_changed", true, "Diagnostics reads historical artifacts and writes local reports only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("historical_backtest_no_future_leakage", true, "Diagnostics consumes completed H36 and H37/H38 artifacts only."),
      gate("outcomes_used_only_after_draft", true, "Outcome data is used only after draft rosters already exist."),
      gate("loose_fuzzy_not_confirmed", true, "Name-only and loose fuzzy candidates are not confirmed scoring identities."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeHistoricalOutcomeCoverageDiagnosticsArtifacts(
  report: HistoricalOutcomeCoverageDiagnosticsReport,
  cwd = process.cwd(),
): HistoricalOutcomeCoverageDiagnosticsArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-outcome-coverage-diagnostics-${report.season}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildIndexes(
  draftReport: HistoricalMockDraftEngineReport | null,
  universeReport: HistoricalDraftUniverseReport | null,
  weeklyRows: HistoricalWeeklyResultsNormalizedRow[],
): Indexes {
  const universeByAnyId = new Map<string, HistoricalDraftUniverseRow>();
  for (const row of universeReport?.rows ?? []) {
    for (const id of [row.player_id, row.sleeper_id, row.gsis_id].filter(Boolean) as string[]) universeByAnyId.set(id, row);
  }
  const weeklyByAnyId = new Map<string, HistoricalWeeklyResultsNormalizedRow[]>();
  const weeklyByNamePosition = new Map<string, HistoricalWeeklyResultsNormalizedRow[]>();
  const weeklyByNameTeamPosition = new Map<string, HistoricalWeeklyResultsNormalizedRow[]>();
  const weeklyByName = new Map<string, HistoricalWeeklyResultsNormalizedRow[]>();
  for (const row of weeklyRows) {
    for (const id of [row.player_id, row.sleeper_id, row.gsis_id].filter(Boolean) as string[]) add(weeklyByAnyId, id, row);
    add(weeklyByNamePosition, namePositionKey(row.player_name, row.position), row);
    if (row.team) add(weeklyByNameTeamPosition, nameTeamPositionKey(row.player_name, row.team, row.position), row);
    add(weeklyByName, normalize(row.player_name), row);
  }
  const picksByStrategySlotPlayer = new Map<string, DraftedPlayer>();
  for (const strategy of draftReport?.strategyResults ?? []) {
    for (const pick of strategy.pickLog) {
      const universe = universeByAnyId.get(pick.playerId) ?? universeReport?.rows.find((row) => namePositionKey(row.player_name, row.position) === namePositionKey(pick.playerName, pick.position));
      picksByStrategySlotPlayer.set(pickKey(pick.strategy, pick.draftSlot, pick.playerId), {
        pick,
        sleeperId: universe?.sleeper_id ?? null,
        gsisId: universe?.gsis_id ?? null,
      });
    }
  }
  return { universeByAnyId, weeklyByAnyId, weeklyByNamePosition, weeklyByNameTeamPosition, weeklyByName, picksByStrategySlotPlayer };
}

function buildMissingScoreRows(outcomes: HistoricalSeasonTeamOutcome[], indexes: Indexes): HistoricalOutcomeCoverageMissingScoreRow[] {
  const rows: HistoricalOutcomeCoverageMissingScoreRow[] = [];
  for (const outcome of outcomes) {
    const draftSlot = draftSlotFromTeamKey(outcome.teamKey);
    for (const week of outcome.weekly_scores) {
      for (const player of [...week.starters, ...week.bench].filter((item) => item.matchedBy === "missing")) {
        const drafted = draftSlot ? indexes.picksByStrategySlotPlayer.get(pickKey(outcome.strategy, draftSlot, player.playerId)) : undefined;
        const universe = indexes.universeByAnyId.get(player.playerId);
        const team = drafted?.pick.nflTeam ?? universe?.team ?? null;
        const ids = [player.playerId, drafted?.sleeperId, drafted?.gsisId, universe?.player_id, universe?.sleeper_id, universe?.gsis_id].filter(Boolean) as string[];
        const exactSeasonRows = uniqueRows(ids.flatMap((id) => indexes.weeklyByAnyId.get(id) ?? []));
        const exactWeekRows = exactSeasonRows.filter((row) => row.week === week.week);
        const nameTeamRows = team ? indexes.weeklyByNameTeamPosition.get(nameTeamPositionKey(player.playerName, team, player.position)) ?? [] : [];
        const namePositionRows = indexes.weeklyByNamePosition.get(namePositionKey(player.playerName, player.position)) ?? [];
        const nameRows = indexes.weeklyByName.get(normalize(player.playerName)) ?? [];
        const candidateStatus = candidateStatusFor(player.playerId, drafted?.sleeperId ?? null, drafted?.gsisId ?? null, exactWeekRows, nameTeamRows, namePositionRows, nameRows, week.week);
        const reason = missingReason({
          playerId: player.playerId,
          playerName: player.playerName,
          exactSeasonRows,
          exactWeekRows,
          nameTeamRows,
          namePositionRows,
          nameRows,
          candidateStatus,
          week: week.week,
        });
        rows.push({
          strategy: outcome.strategy,
          team_id: outcome.teamKey,
          draft_slot: draftSlot,
          week: week.week,
          player_id: player.playerId,
          sleeper_id: drafted?.sleeperId ?? universe?.sleeper_id ?? null,
          gsis_id: drafted?.gsisId ?? universe?.gsis_id ?? null,
          player_name: player.playerName,
          position: player.position,
          team,
          draft_round: drafted?.pick.round ?? null,
          draft_pick: drafted?.pick.overallPick ?? null,
          missing_reason: reason,
          candidate_match_status: candidateStatus,
          season_level_player_found_in_weekly_source: exactSeasonRows.length > 0,
          week_level_row_found: exactWeekRows.length > 0,
          score_should_be_zero_for_week: exactSeasonRows.length > 0 && exactWeekRows.length === 0,
          mapping_failure_suspected: candidateStatus.includes("candidate") || reason === "identifier_mismatch_possible",
          candidate_count: uniqueRows([...nameTeamRows, ...namePositionRows, ...nameRows]).filter((row) => row.week === week.week).length,
        });
      }
    }
  }
  return rows;
}

function buildSeasonLevelCoverage(
  draftReport: HistoricalMockDraftEngineReport,
  indexes: Indexes,
  expectedWeeks: number[],
): HistoricalOutcomeCoverageSeasonPlayerRow[] {
  const drafted = new Map<string, { player: DraftedPlayer; strategies: Set<string>; teams: Set<string> }>();
  for (const strategy of draftReport.strategyResults) {
    for (const pick of strategy.pickLog) {
      const player = indexes.picksByStrategySlotPlayer.get(pickKey(pick.strategy, pick.draftSlot, pick.playerId)) ?? { pick, sleeperId: null, gsisId: null };
      const current = drafted.get(pick.playerId) ?? { player, strategies: new Set<string>(), teams: new Set<string>() };
      current.strategies.add(pick.strategy);
      current.teams.add(`slot-${pick.draftSlot}`);
      drafted.set(pick.playerId, current);
    }
  }
  return [...drafted.entries()].map(([playerId, item]) => {
    const ids = [playerId, item.player.sleeperId, item.player.gsisId].filter(Boolean) as string[];
    const rows = uniqueRows(ids.flatMap((id) => indexes.weeklyByAnyId.get(id) ?? []));
    const weeksWithScores = unique(rows.map((row) => row.week)).filter((week) => expectedWeeks.includes(week)).length;
    const matchType = seasonMatchType(playerId, item.player.sleeperId, item.player.gsisId, rows);
    return {
      drafted_player_id: playerId,
      player_name: item.player.pick.playerName,
      position: normalizePosition(item.player.pick.position),
      team: item.player.pick.nflTeam ?? null,
      strategy_count: item.strategies.size,
      team_count: item.teams.size,
      weeks_expected: expectedWeeks.length,
      weeks_with_scores: weeksWithScores,
      weeks_missing: Math.max(expectedWeeks.length - weeksWithScores, 0),
      season_total_points: round(rows.reduce((sum, row) => sum + row.fantasy_points, 0)),
      weekly_source_match_type: matchType,
      coverage_rate: expectedWeeks.length ? round(weeksWithScores / expectedWeeks.length) : 0,
    };
  }).sort((a, b) => a.coverage_rate - b.coverage_rate || a.player_name.localeCompare(b.player_name));
}

function buildImprovementPreview(rows: HistoricalOutcomeCoverageMissingScoreRow[], totalPlayerWeeks: number): HistoricalOutcomeCoverageImprovementPreview {
  const trueZeros = rows.filter((row) => row.score_should_be_zero_for_week).length;
  const exactPossible = rows.filter((row) => row.week_level_row_found && ["exact_player_id", "exact_sleeper_id", "exact_gsis_id"].includes(row.candidate_match_status)).length;
  const strictReview = rows.filter((row) => row.candidate_match_status === "normalized_name_position_team_candidate").length;
  const remaining = Math.max(rows.length - trueZeros - exactPossible, 0);
  return {
    current_missing_rows: rows.length,
    new_exact_matches_possible: exactPossible,
    new_strict_name_position_team_review_candidates: strictReview,
    true_zero_week_rows_to_synthesize: trueZeros,
    remaining_missing_after_preview: remaining,
    current_missing_score_rate: totalPlayerWeeks ? round(rows.length / totalPlayerWeeks) : 0,
    projected_missing_score_rate_after_preview: totalPlayerWeeks ? round(remaining / totalPlayerWeeks) : 0,
  };
}

function buildStrategyImpactPreview(
  outcomes: HistoricalSeasonTeamOutcome[],
  missingRows: HistoricalOutcomeCoverageMissingScoreRow[],
  draftReport: HistoricalMockDraftEngineReport | null,
) {
  const pickRoundByPlayerWeek = new Map<string, number>();
  for (const strategy of draftReport?.strategyResults ?? []) {
    for (const pick of strategy.pickLog) {
      pickRoundByPlayerWeek.set(pickKey(pick.strategy, pick.draftSlot, pick.playerId), pick.round);
    }
  }
  const totalRows = outcomes.flatMap((outcome) => outcome.weekly_scores.flatMap((week) => [...week.starters, ...week.bench].map((player) => ({
    strategy: outcome.strategy,
    position: player.position,
    round: pickRoundByPlayerWeek.get(pickKey(outcome.strategy, draftSlotFromTeamKey(outcome.teamKey) ?? 0, player.playerId)) ?? null,
  }))));
  const byStrategy = rateRows(STRATEGIES, (key) => totalRows.filter((row) => row.strategy === key).length, (key) => missingRows.filter((row) => row.strategy === key).length);
  const positions = unique(totalRows.map((row) => row.position));
  const byPosition = rateRows(positions, (key) => totalRows.filter((row) => row.position === key).length, (key) => missingRows.filter((row) => row.position === key).length);
  const rounds = unique(totalRows.map((row) => row.round).filter((round): round is number => round !== null)).sort((a, b) => a - b);
  const byRound = rateRows(rounds.map(String), (key) => totalRows.filter((row) => String(row.round) === key).length, (key) => missingRows.filter((row) => String(row.draft_round) === key).length);
  const blackbirdRate = byStrategy.find((row) => row.key === "blackbird_rank_only")?.missing_rate ?? 0;
  const baselineRates = Object.fromEntries(byStrategy.filter((row) => row.key !== "blackbird_rank_only").map((row) => [row.key, row.missing_rate]));
  const baselineAverage = average(Object.values(baselineRates));
  return {
    missing_score_rate_by_strategy: byStrategy,
    missing_score_rate_by_position: byPosition,
    missing_score_rate_by_draft_round: byRound,
    blackbird_missing_score_rate: blackbirdRate,
    baseline_missing_score_rates: baselineRates,
    blackbird_rank_may_be_distorted_by_coverage: Math.abs(blackbirdRate - baselineAverage) >= 0.05,
  };
}

function missingReason(input: {
  playerId: string;
  playerName: string;
  exactSeasonRows: HistoricalWeeklyResultsNormalizedRow[];
  exactWeekRows: HistoricalWeeklyResultsNormalizedRow[];
  nameTeamRows: HistoricalWeeklyResultsNormalizedRow[];
  namePositionRows: HistoricalWeeklyResultsNormalizedRow[];
  nameRows: HistoricalWeeklyResultsNormalizedRow[];
  candidateStatus: HistoricalOutcomeCoverageCandidateStatus;
  week: number;
}): HistoricalOutcomeCoverageMissingReason {
  if (!input.playerId || !input.playerName) return "draft_universe_synthetic_or_invalid";
  if (input.exactSeasonRows.length && !input.exactWeekRows.length) return "player_did_not_record_stats";
  if (input.exactWeekRows.length) return "identifier_mismatch_possible";
  if (input.nameTeamRows.some((row) => row.week === input.week)) return "identifier_mismatch_possible";
  if (input.namePositionRows.some((row) => row.week === input.week)) return "name_position_candidate_exists";
  if (input.nameRows.some((row) => row.week === input.week && normalizePosition(row.position) !== normalizePosition(input.namePositionRows[0]?.position ?? ""))) return "position_mismatch_candidate";
  if (input.namePositionRows.length || input.nameTeamRows.length) return "no_weekly_row_for_player";
  if (input.nameRows.length) return "team_mismatch_candidate";
  return "player_not_in_weekly_source";
}

function candidateStatusFor(
  playerId: string,
  sleeperId: string | null,
  gsisId: string | null,
  exactWeekRows: HistoricalWeeklyResultsNormalizedRow[],
  nameTeamRows: HistoricalWeeklyResultsNormalizedRow[],
  namePositionRows: HistoricalWeeklyResultsNormalizedRow[],
  nameRows: HistoricalWeeklyResultsNormalizedRow[],
  week: number,
): HistoricalOutcomeCoverageCandidateStatus {
  if (exactWeekRows.some((row) => row.player_id === playerId)) return "exact_player_id";
  if (sleeperId && exactWeekRows.some((row) => row.sleeper_id === sleeperId)) return "exact_sleeper_id";
  if (gsisId && exactWeekRows.some((row) => row.gsis_id === gsisId)) return "exact_gsis_id";
  if (nameTeamRows.some((row) => row.week === week)) return "normalized_name_position_team_candidate";
  if (namePositionRows.some((row) => row.week === week)) return "normalized_name_position_candidate";
  if (nameRows.some((row) => row.week === week)) return "normalized_name_position_mismatch_candidate";
  return "none";
}

function seasonMatchType(playerId: string, sleeperId: string | null, gsisId: string | null, rows: HistoricalWeeklyResultsNormalizedRow[]): HistoricalOutcomeCoverageCandidateStatus {
  if (rows.some((row) => row.player_id === playerId)) return "exact_player_id";
  if (sleeperId && rows.some((row) => row.sleeper_id === sleeperId)) return "exact_sleeper_id";
  if (gsisId && rows.some((row) => row.gsis_id === gsisId)) return "exact_gsis_id";
  return "none";
}

function recommendH37(
  missingArtifactCount: number,
  preview: HistoricalOutcomeCoverageImprovementPreview,
  rows: HistoricalOutcomeCoverageMissingScoreRow[],
): HistoricalOutcomeCoverageIntegrationRecommendation {
  if (missingArtifactCount > 0) return "coverage_blocked";
  if (!rows.length) return "coverage_ready_to_treat_missing_weeks_as_zero";
  if (preview.true_zero_week_rows_to_synthesize / rows.length >= 0.5) return "coverage_ready_to_treat_missing_weeks_as_zero";
  if (preview.new_exact_matches_possible > 0) return "coverage_needs_identifier_crosswalk";
  if (preview.new_strict_name_position_team_review_candidates > 0) return "coverage_needs_name_review_candidates";
  return "coverage_needs_weekly_source_expansion";
}

function recommendFinal(
  h37: HistoricalOutcomeCoverageIntegrationRecommendation,
  rows: HistoricalOutcomeCoverageMissingScoreRow[],
): HistoricalOutcomeCoverageFinalRecommendation {
  if (h37 === "coverage_blocked") return "historical_outcome_coverage_blocked";
  if (h37 === "coverage_ready_to_treat_missing_weeks_as_zero") return "historical_outcome_coverage_ready_for_h37_fix";
  if (h37 === "coverage_needs_identifier_crosswalk") return "historical_outcome_coverage_needs_identifier_mapping";
  if (h37 === "coverage_needs_name_review_candidates" || rows.some((row) => row.candidate_match_status.includes("candidate"))) return "historical_outcome_coverage_needs_manual_review";
  return "historical_outcome_coverage_needs_source_expansion";
}

function summarizeReasons(rows: HistoricalOutcomeCoverageMissingScoreRow[]) {
  const counts = new Map<HistoricalOutcomeCoverageMissingReason, number>();
  for (const row of rows) counts.set(row.missing_reason, (counts.get(row.missing_reason) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

function buildLimitations(missingArtifacts: string[], preview: HistoricalOutcomeCoverageImprovementPreview): string[] {
  const limitations = ["Strict candidates are reported for review; loose fuzzy/name-only matches are never confirmed as scoring identity."];
  if (missingArtifacts.length) limitations.push(`Missing required artifacts: ${missingArtifacts.join(", ")}`);
  if (preview.remaining_missing_after_preview > 0) limitations.push("Some missing rows remain after the zero-week preview and may need identifier mapping or source expansion.");
  return limitations;
}

function rateRows(keys: string[], total: (key: string) => number, missing: (key: string) => number): HistoricalOutcomeCoverageRateRow[] {
  return keys.map((key) => {
    const totalRows = total(key);
    const missingRows = missing(key);
    return { key, missing_rows: missingRows, total_rows: totalRows, missing_rate: totalRows ? round(missingRows / totalRows) : 0 };
  }).filter((row) => row.total_rows > 0 || row.missing_rows > 0).sort((a, b) => b.missing_rate - a.missing_rate || b.missing_rows - a.missing_rows);
}

function renderMarkdown(report: HistoricalOutcomeCoverageDiagnosticsReport): string {
  const reasons = report.missingReasonSummary.map((row) => `- ${row.reason}: ${row.count}`).join("\n") || "- none";
  const strategies = report.strategyImpactPreview.missing_score_rate_by_strategy.map((row) => `- ${row.key}: ${row.missing_rate} (${row.missing_rows}/${row.total_rows})`).join("\n") || "- none";
  return `${[
    "# Historical Outcome Coverage Diagnostics",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Season: ${report.season}`,
    `- Recommendation: ${report.recommendation}`,
    `- H37 integration: ${report.h37IntegrationRecommendation}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Missing Reason Summary",
    "",
    reasons,
    "",
    "## True Zero vs Mapping",
    "",
    `- True zero week rows: ${report.trueZeroVsIdentifierMismatch.true_zero_week_rows}`,
    `- Identifier mismatch suspected rows: ${report.trueZeroVsIdentifierMismatch.identifier_mismatch_suspected_rows}`,
    `- Source expansion needed rows: ${report.trueZeroVsIdentifierMismatch.source_expansion_needed_rows}`,
    `- Manual review candidate rows: ${report.trueZeroVsIdentifierMismatch.manual_review_candidate_rows}`,
    "",
    "## Improvement Preview",
    "",
    `- Current missing rows: ${report.improvementPreview.current_missing_rows}`,
    `- True zero week rows to synthesize: ${report.improvementPreview.true_zero_week_rows_to_synthesize}`,
    `- Remaining missing after preview: ${report.improvementPreview.remaining_missing_after_preview}`,
    `- Projected missing score rate after preview: ${report.improvementPreview.projected_missing_score_rate_after_preview}`,
    "",
    "## Strategy Impact",
    "",
    strategies,
    "",
    "## Safety Gates",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed}`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalOutcomeCoverageDiagnosticsReport): string {
  const rows = [["strategy", "team_id", "draft_slot", "week", "player_id", "player_name", "position", "team", "draft_round", "missing_reason", "candidate_match_status", "score_should_be_zero_for_week", "mapping_failure_suspected"]];
  for (const row of report.missingScoreRows) {
    rows.push([
      row.strategy,
      row.team_id,
      String(row.draft_slot ?? ""),
      String(row.week),
      row.player_id,
      row.player_name,
      row.position,
      row.team ?? "",
      String(row.draft_round ?? ""),
      row.missing_reason,
      row.candidate_match_status,
      String(row.score_should_be_zero_for_week),
      String(row.mapping_failure_suspected),
    ]);
  }
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}

function pickKey(strategy: HistoricalMockDraftStrategy, draftSlot: number, playerId: string): string {
  return `${strategy}:${draftSlot}:${playerId}`;
}

function draftSlotFromTeamKey(teamKey: string): number | null {
  const match = teamKey.match(/slot-(\d+)/);
  return match ? Number(match[1]) : null;
}

function namePositionKey(name: string, position: string): string {
  return `${normalize(name)}:${normalizePosition(position)}`;
}

function nameTeamPositionKey(name: string, team: string, position: string): string {
  return `${normalize(name)}:${normalize(team)}:${normalizePosition(position)}`;
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

function uniqueRows(rows: HistoricalWeeklyResultsNormalizedRow[]): HistoricalWeeklyResultsNormalizedRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.week}:${row.player_id ?? ""}:${row.sleeper_id ?? ""}:${row.gsis_id ?? ""}:${row.player_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add<T>(map: Map<string, T[]>, key: string, value: T): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
