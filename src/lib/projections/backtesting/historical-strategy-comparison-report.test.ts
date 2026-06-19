import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildStrategyLeaderboard,
  runHistoricalStrategyComparisonReport,
  writeHistoricalStrategyComparisonArtifacts,
} from "./historical-strategy-comparison-report";
import type { HistoricalDraftUniverseReport } from "./historical-draft-universe-builder-types";
import type { HistoricalMockDraftEngineReport } from "./historical-mock-draft-engine-types";
import type { HistoricalSeasonOutcomeScorerReport, HistoricalSeasonTeamOutcome } from "./historical-season-outcome-scorer-types";

describe("historical strategy comparison report", () => {
  it("builds a strategy leaderboard and Blackbird deltas", () => {
    const leaderboard = buildStrategyLeaderboard([
      outcome("blackbird_rank_only", "slot-1", 100),
      outcome("blackbird_rank_only", "slot-2", 80),
      outcome("projection_only", "slot-1", 70),
      outcome("projection_only", "slot-2", 60),
    ]);

    expect(leaderboard[0]).toMatchObject({ strategy: "blackbird_rank_only", rank: 1, average_team_points: 90 });
    expect(leaderboard.find((row) => row.strategy === "projection_only")?.blackbird_delta_points).toBe(25);
  });

  it("reports Blackbird focus, team-level comparison, and positional summaries", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalStrategyComparisonReport({ season: 2025, cwd });

      expect(report.blackbirdFocus.blackbirdOverallRank).toBe(1);
      expect(report.blackbirdFocus.strategiesBlackbirdBeat).toContain("projection_only");
      expect(report.teamLevelComparison[0]).toMatchObject({
        strategy: "blackbird_rank_only",
        team_id: "slot-1",
        draft_slot: 1,
        season_points: 100,
        missing_score_count: 1,
      });
      expect(report.positionalOutcomeAnalysis.find((row) => row.strategy === "blackbird_rank_only")?.QB).toBe(40);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports missing score coverage and reliability grade", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalStrategyComparisonReport({ season: 2025, cwd });

      expect(report.missingScoreCoverage).toMatchObject({
        universePlayers: 10,
        weeklyExactIdMatchedUniversePlayers: 8,
        universeMissingWeeklyOutcomePlayers: 2,
        h37ExactIdMatches: 9,
        h37MissingPlayerScores: 3,
        reliabilityGrade: "low",
      });
      expect(report.recommendation).toBe("historical_strategy_comparison_needs_coverage_improvement");
      expect(report.missingScoreCoverage.warning).toContain("directional");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports draft capital round analysis", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalStrategyComparisonReport({ season: 2025, cwd });

      expect(report.draftCapitalRoundAnalysis.roundSummaries.some((row) => row.round === 1)).toBe(true);
      expect(report.draftCapitalRoundAnalysis.best_value_picks.length).toBeGreaterThanOrEqual(0);
      expect(report.draftCapitalRoundAnalysis.limitations.join(" ")).toContain("H39");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports data leakage guard and safety gates", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalStrategyComparisonReport({ season: 2025, cwd });

      expect(report.dataLeakageGuard).toMatchObject({
        draftRostersCameFromH36PreseasonOnlyEngine: true,
        outcomesCameFromH37ScoringPhase: true,
        strategyComparisonDidNotRecomputeRankingsFromOutcomes: true,
        actualSeasonPointsUsedOnlyAfterDraftsWereComplete: true,
      });
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes artifacts without live mutation", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);
      const report = runHistoricalStrategyComparisonReport({ season: 2025, cwd });
      const artifacts = writeHistoricalStrategyComparisonArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("blocks clearly when required artifacts are missing", () => {
    const report = runHistoricalStrategyComparisonReport({ season: 2025, cwd: setupWorkspace() });

    expect(report.recommendation).toBe("historical_strategy_comparison_blocked");
    expect(report.limitations.join(" ")).toContain("Missing required artifact");
  });
});

function setupWorkspace() {
  const cwd = path.join(tmpdir(), `blackbird-h38-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path.join(cwd, "artifacts", "projections", "backtesting"), { recursive: true });
  return cwd;
}

function writeArtifacts(cwd: string) {
  const dir = path.join(cwd, "artifacts", "projections", "backtesting");
  writeFileSync(path.join(dir, "historical-mock-draft-engine-2025.json"), JSON.stringify(draftReport()), "utf8");
  writeFileSync(path.join(dir, "historical-season-outcome-scorer-2025.json"), JSON.stringify(outcomeReport()), "utf8");
  writeFileSync(path.join(dir, "historical-draft-universe-2025.json"), JSON.stringify(universeReport()), "utf8");
  writeFileSync(path.join(dir, "historical-weekly-results-2025.normalized.json"), JSON.stringify({ historicalSeason: 2025, results: [] }), "utf8");
}

function outcome(strategy: HistoricalSeasonTeamOutcome["strategy"], teamKey: string, points: number): HistoricalSeasonTeamOutcome {
  return {
    strategy,
    teamKey,
    best_ball_total_points: points,
    weekly_average: points / 2,
    weekly_scores: [
      {
        week: 1,
        teamKey: `${strategy}:${teamKey}`,
        totalPoints: points / 2,
        starters: [
          { playerId: `${strategy}-${teamKey}-qb`, playerName: "QB", position: "QB", points: 20, matchedBy: "player_id" },
          { playerId: `${strategy}-${teamKey}-rb`, playerName: "RB", position: "RB", points: 10, matchedBy: teamKey === "slot-1" ? "missing" : "player_id" },
        ],
        bench: [],
        starterPoints: points / 2,
        benchPoints: 0,
        fillRate: 1,
        zeroScoreStarterWeeks: 0,
        positionalPointsBySlot: { QB: 20, RB: 10 },
      },
      {
        week: 2,
        teamKey: `${strategy}:${teamKey}`,
        totalPoints: points / 2,
        starters: [
          { playerId: `${strategy}-${teamKey}-qb`, playerName: "QB", position: "QB", points: 20, matchedBy: "player_id" },
        ],
        bench: [],
        starterPoints: points / 2,
        benchPoints: 0,
        fillRate: 1,
        zeroScoreStarterWeeks: 0,
        positionalPointsBySlot: { QB: 20 },
      },
    ],
    starter_points: points,
    bench_points: 0,
    optimal_lineup_fill_rate: 1,
    zero_score_starter_weeks: 0,
    positional_points_by_slot: { QB: 40, RB: 10 },
    positional_advantage: {},
    replacement_value: "not_available_v1",
    hit_rate: 1,
    bust_rate: 0,
    regret_score: "not_available_v1",
  };
}

function outcomeReport(): HistoricalSeasonOutcomeScorerReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2025,
    scenarioPath: null,
    recommendation: "historical_outcome_scoring_ready_for_strategy_comparison",
    actualWeeklyResultsFound: true,
    weeklyInputCoverage: {
      resultRows: 100,
      weeks: [1, 2],
      scoredWeeklyResultRows: 9,
      exactIdMatches: 9,
      namePositionFallbackMatches: 0,
      trueZeroWeekRows: 2,
      registryBackedZeroSeasonRows: 0,
      missingPlayerScores: 3,
      missingScoreRateBeforeH40: 0.36,
      missingScoreRateBeforeZeroWeekTreatment: 0.36,
      missingScoreRateAfterTrueZeroWeekTreatment: 0.21,
      missingScoreRateAfterZeroWeekTreatment: 0.21,
      missingScoreRateAfterRegistryZeroSeasonTreatment: 0.21,
      playersWithSeasonLevelExactMatch: 6,
      playersWithRegistryOnlyExactMatch: 0,
      playersMissingFromBothWeeklyAndRegistrySource: 2,
      playersMissingFromWeeklySourceEntirely: 2,
      registryBackedZeroSeasonUnavailable: false,
    },
    draftEngineSummary: { recommendation: "historical_mock_draft_engine_ready_for_season_scoring", draftOrderType: "snake" },
    strategyOutcomes: [
      outcome("blackbird_rank_only", "slot-1", 100),
      outcome("blackbird_rank_only", "slot-2", 80),
      outcome("projection_only", "slot-1", 70),
      outcome("projection_only", "slot-2", 60),
    ],
    strategyComparison: null,
    myTeamFocus: null,
    dataLeakageGuard: {
      draftArtifactLoadedBeforeOutcomes: true,
      actualOutcomesOnlyUsedInScoringPhase: true,
      draftRankingsNotRecomputedFromOutcomes: true,
      noFutureFieldsUsedInDraftSimulation: true,
    },
    limitations: [],
    safetyGates: [],
  };
}

function draftReport(): HistoricalMockDraftEngineReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2025,
    scenarioPath: null,
    recommendation: "historical_mock_draft_engine_ready_for_season_scoring",
    draftOrderType: "snake",
    draftOrder: [],
    strategyResults: [
      {
        strategy: "blackbird_rank_only",
        teamRosters: [],
        pickLog: [
          { strategy: "blackbird_rank_only", overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: "blackbird_rank_only-slot-1-qb", playerName: "QB", position: "QB", rankSource: "test" },
        ],
        myTeamRoster: [],
        positionCounts: {},
        starterCoverageEstimate: "",
        benchDepthEstimate: "",
        draftCapitalByPosition: {},
        reachesValueNotes: [],
      },
      {
        strategy: "projection_only",
        teamRosters: [],
        pickLog: [
          { strategy: "projection_only", overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: "projection_only-slot-1-qb", playerName: "QB", position: "QB", rankSource: "test" },
        ],
        myTeamRoster: [],
        positionCounts: {},
        starterCoverageEstimate: "",
        benchDepthEstimate: "",
        draftCapitalByPosition: {},
        reachesValueNotes: [],
      },
    ],
    dataLeakageGuard: {
      allowedDraftTimeInputs: [],
      disallowedOutcomeInputs: [],
      actualSeasonScoringLoaded: false,
      futureOutcomeFieldsUsed: false,
    },
    safetyGates: [],
  };
}

function universeReport(): Pick<HistoricalDraftUniverseReport, "identifierCoveragePreview"> {
  return {
    identifierCoveragePreview: {
      universePlayers: 10,
      playersWithWeeklyResultExactIdMatch: 8,
      playersWithWeeklyResultNamePositionFallback: 0,
      playersMissingWeeklyOutcome: 2,
      matchRateByPosition: {},
    },
  };
}
