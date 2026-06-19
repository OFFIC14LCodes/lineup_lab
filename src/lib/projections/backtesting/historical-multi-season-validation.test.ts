import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  runHistoricalMultiSeasonValidation,
  writeHistoricalMultiSeasonValidationArtifacts,
} from "./historical-multi-season-validation";
import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { HistoricalStrategyComparisonReport } from "./historical-strategy-comparison-report-types";

describe("historical multi-season validation", () => {
  it("discovers season availability and preserves partial availability behavior", () => {
    const cwd = tempProject();
    writeSourceInputs(cwd, 2025);
    writeStrategyComparison(cwd, strategyReport(2025));

    const report = runHistoricalMultiSeasonValidation({
      cwd,
      seasons: [2023, 2024, 2025],
      generatedAt: "2026-06-19T00:00:00.000Z",
    });

    expect(report.seasonsAvailable).toEqual([2025]);
    expect(report.seasonsNotAvailable).toEqual([2023, 2024]);
    expect(report.perSeasonSummaries.find((summary) => summary.season === 2023)?.status).toBe("not_available");
    expect(report.perSeasonSummaries.find((summary) => summary.season === 2025)?.availability.preseasonSnapshotPresent).toBe(true);
    expect(report.perSeasonSummaries.find((summary) => summary.season === 2025)?.availability.weeklyResultsSourcePresent).toBe(true);
    expect(report.perSeasonSummaries.find((summary) => summary.season === 2025)?.availability.playerRegistryPresent).toBe(true);
  });

  it("aggregates per-season summaries into a multi-season leaderboard", () => {
    const cwd = tempProject();
    for (const season of [2023, 2024, 2025]) {
      writeSourceInputs(cwd, season);
      writeStrategyComparison(cwd, strategyReport(season, {
        blackbirdPoints: season === 2024 ? 330 : 310,
        needBasedPoints: season === 2024 ? 320 : 325,
      }));
    }

    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2023, 2024, 2025] });
    const blackbird = report.multiSeasonLeaderboard.find((row) => row.strategy === "blackbird_rank_only");
    const needBased = report.multiSeasonLeaderboard.find((row) => row.strategy === "need_based");

    expect(blackbird).toMatchObject({ seasonsAvailable: 3, wins: 1, top2Finishes: 3 });
    expect(blackbird?.averagePoints).toBe(316.67);
    expect(needBased?.wins).toBe(2);
    expect(report.blackbirdSummary.averageRank).toBe(1.67);
    expect(report.blackbirdSummary.bestSeason).toBe(2024);
    expect(report.blackbirdSummary.worstSeason).toBe(2023);
  });

  it("computes Blackbird baseline deltas across seasons", () => {
    const cwd = tempProject();
    writeSourceInputs(cwd, 2024);
    writeStrategyComparison(cwd, strategyReport(2024, { blackbirdPoints: 330, needBasedPoints: 320, adpPoints: 150 }));
    writeSourceInputs(cwd, 2025);
    writeStrategyComparison(cwd, strategyReport(2025, { blackbirdPoints: 310, needBasedPoints: 325, adpPoints: 140 }));

    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2024, 2025] });
    const needBased = report.baselineComparison.find((row) => row.baseline === "need_based");
    const adp = report.baselineComparison.find((row) => row.baseline === "adp_only");

    expect(needBased).toMatchObject({
      seasonsWon: 1,
      seasonsLost: 1,
      seasonsTied: 0,
      averagePointDelta: -2.5,
      largestWin: 10,
      largestLoss: -15,
    });
    expect(adp).toMatchObject({ seasonsWon: 2, seasonsLost: 0, averagePointDelta: 175 });
  });

  it("aggregates reliability and recommends more seasons when only one season is available", () => {
    const cwd = tempProject();
    writeSourceInputs(cwd, 2025);
    writeStrategyComparison(cwd, strategyReport(2025));

    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2023, 2024, 2025] });

    expect(report.reliabilitySummary.highReliabilitySeasons).toEqual([2025]);
    expect(report.reliabilitySummary.averageMissingScoreRate).toBe(0);
    expect(report.productConfidenceRecommendation).toBe("multi_season_validation_needs_more_seasons");
    expect(report.reliabilitySummary.productConfidenceClaimSupported).toBe(false);
  });

  it("supports product confidence with three high-reliability top-two Blackbird seasons", () => {
    const cwd = tempProject();
    for (const season of [2023, 2024, 2025]) {
      writeSourceInputs(cwd, season);
      writeStrategyComparison(cwd, strategyReport(season, { blackbirdPoints: 330, needBasedPoints: 320 }));
    }

    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2023, 2024, 2025] });

    expect(report.productConfidenceRecommendation).toBe("multi_season_validation_supports_blackbird_confidence");
    expect(report.reliabilitySummary.productConfidenceClaimSupported).toBe(true);
  });

  it("reports data leakage guard aggregation and safety gates", () => {
    const cwd = tempProject();
    writeSourceInputs(cwd, 2025);
    writeStrategyComparison(cwd, strategyReport(2025));

    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2025] });

    expect(report.dataLeakageGuard.allAvailableSeasonsPassed).toBe(true);
    expect(report.safetyGates.map((gate) => gate.name)).toEqual(expect.arrayContaining([
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "v8_2_not_enabled",
      "historical_backtest_no_future_leakage",
      "outcomes_used_only_after_draft",
      "registry_zero_season_exact_id_only",
      "loose_fuzzy_not_confirmed",
      "dry_run_only",
    ]));
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("writes json, markdown, and csv artifacts", () => {
    const cwd = tempProject();
    writeSourceInputs(cwd, 2025);
    writeStrategyComparison(cwd, strategyReport(2025));
    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2025] });

    const artifacts = writeHistoricalMultiSeasonValidationArtifacts(report, cwd);

    expect(existsSync(artifacts.jsonPath)).toBe(true);
    expect(existsSync(artifacts.markdownPath)).toBe(true);
    expect(existsSync(artifacts.csvPath)).toBe(true);
    expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("# Historical Multi-Season Validation 2025-2025");
    expect(readFileSync(artifacts.csvPath, "utf8")).toContain("season,status,blackbird_rank");
  });

  it("does not expose live mutation behavior", () => {
    const cwd = tempProject();
    writeSourceInputs(cwd, 2025);
    writeStrategyComparison(cwd, strategyReport(2025));

    const report = runHistoricalMultiSeasonValidation({ cwd, seasons: [2025] });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "no_supabase_writes")?.passed).toBe(true);
  });
});

function tempProject() {
  return mkdtempSync(path.join(os.tmpdir(), "h43-"));
}

function writeSourceInputs(cwd: string, season: number) {
  writeFile(cwd, path.join("artifacts", "projections", "backtesting", `preseason-projection-snapshot-${season}.json`), "{}");
  writeFile(cwd, path.join("data", "nflverse", `player_stats_${season}.csv`), "player_id,week\n");
  writeFile(cwd, path.join("data", "nflverse", "players.csv"), "player_id,player_name\n");
  writeFile(cwd, path.join("data", "nflverse", `rosters_${season}.csv`), "player_id,team\n");
  writeFile(cwd, path.join("artifacts", "projections", "backtesting", `historical-draft-universe-${season}.json`), "{}");
  writeFile(cwd, path.join("artifacts", "projections", "backtesting", `historical-season-outcome-scorer-${season}.json`), "{}");
  writeFile(cwd, path.join("data", "backtesting", `historical-mock-draft-scenario.${season}.generated.json`), "{}");
}

function writeStrategyComparison(cwd: string, report: HistoricalStrategyComparisonReport) {
  writeFile(
    cwd,
    path.join("artifacts", "projections", "backtesting", `historical-strategy-comparison-${report.season}.json`),
    JSON.stringify(report, null, 2),
  );
}

function writeFile(cwd: string, relativePath: string, content: string) {
  const filePath = path.join(cwd, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

function strategyReport(
  season: number,
  overrides: { blackbirdPoints?: number; needBasedPoints?: number; adpPoints?: number; reliability?: "high" | "medium" | "low" | "insufficient"; missingScoreRate?: number } = {},
): HistoricalStrategyComparisonReport {
  const blackbirdPoints = overrides.blackbirdPoints ?? 310;
  const needBasedPoints = overrides.needBasedPoints ?? 325;
  const adpPoints = overrides.adpPoints ?? 145;
  const rows = [
    row("blackbird_rank_only", blackbirdPoints),
    row("projection_only", 300),
    row("adp_only", adpPoints),
    row("market_rank", 300),
    row("need_based", needBasedPoints),
    row("random_within_adp_band", 140),
  ].sort((a, b) => b.average_team_points - a.average_team_points || a.strategy.localeCompare(b.strategy))
    .map((entry, index) => ({ ...entry, rank: index + 1, blackbird_delta_points: round(blackbirdPoints - entry.average_team_points) }));

  return {
    generatedAt: "2026-06-19T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season,
    recommendation: "historical_strategy_comparison_ready_for_review",
    sourceArtifacts: {
      mockDraftEngine: "",
      seasonOutcomeScorer: "",
      draftUniverse: "",
      weeklyResults: "",
    },
    strategyLeaderboard: rows,
    blackbirdFocus: {
      blackbirdOverallRank: rows.find((entry) => entry.strategy === "blackbird_rank_only")?.rank ?? "not_available",
      strategiesBlackbirdBeat: rows.filter((entry) => entry.strategy !== "blackbird_rank_only" && blackbirdPoints > entry.average_team_points).map((entry) => entry.strategy),
      strategiesThatBeatBlackbird: rows.filter((entry) => entry.strategy !== "blackbird_rank_only" && entry.average_team_points > blackbirdPoints).map((entry) => entry.strategy),
      blackbirdPointDeltaVsBaseline: Object.fromEntries(rows.filter((entry) => entry.strategy !== "blackbird_rank_only").map((entry) => [entry.strategy, round(blackbirdPoints - entry.average_team_points)])),
      blackbirdWeeklyAverageDeltaVsBaseline: {},
      blackbirdBestTeamRank: 1,
      blackbirdWorstTeamRank: 12,
    },
    teamLevelComparison: [],
    positionalOutcomeAnalysis: [],
    draftCapitalRoundAnalysis: {
      roundSummaries: [],
      early_round_efficiency: {} as Record<HistoricalMockDraftStrategy, number>,
      middle_round_efficiency: {} as Record<HistoricalMockDraftStrategy, number>,
      late_round_efficiency: {} as Record<HistoricalMockDraftStrategy, number>,
      best_value_picks: [],
      worst_misses: [],
      limitations: [],
    },
    missingScoreCoverage: {
      universePlayers: 1,
      weeklyExactIdMatchedUniversePlayers: 1,
      universeMissingWeeklyOutcomePlayers: 0,
      h37ExactIdMatches: 1,
      trueZeroWeekRows: 0,
      registryBackedZeroSeasonRows: 0,
      h37MissingPlayerScores: 0,
      missingScoreRate: overrides.missingScoreRate ?? 0,
      missingScoreRateBeforeZeroWeekTreatment: 0,
      adjustedMissingScoreRate: overrides.missingScoreRate ?? 0,
      finalMissingScoreRate: overrides.missingScoreRate ?? 0,
      positionsMostAffectedByMissingScores: [],
      strategiesMostAffectedByMissingScores: [],
      adjustedMissingScoreRateByStrategy: [],
      reliabilityGrade: overrides.reliability ?? "high",
      warning: null,
    },
    dataLeakageGuard: {
      draftRostersCameFromH36PreseasonOnlyEngine: true,
      outcomesCameFromH37ScoringPhase: true,
      strategyComparisonDidNotRecomputeRankingsFromOutcomes: true,
      actualSeasonPointsUsedOnlyAfterDraftsWereComplete: true,
    },
    limitations: [],
    safetyGates: [{ name: "dry_run_only", passed: true, detail: "test fixture" }],
  };
}

function row(strategy: HistoricalMockDraftStrategy, points: number) {
  return {
    strategy,
    rank: 0,
    best_ball_total_points: points,
    weekly_average: round(points / 3),
    best_team_points: points + 10,
    worst_team_points: points - 10,
    average_team_points: points,
    median_team_points: points,
    team_count: 12,
    blackbird_delta_points: 0,
    blackbird_delta_weekly_average: 0,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
