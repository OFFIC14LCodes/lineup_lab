import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHistoricalSeasonOutcomeScorerReport,
  optimizeBestBallLineup,
  writeHistoricalSeasonOutcomeScorerArtifacts,
} from "./historical-season-outcome-scorer";
import type { HistoricalMockDraftEngineReport } from "./historical-mock-draft-engine-types";
import type { HistoricalPlayerRegistryRow, HistoricalSeasonOutcomeScenario, HistoricalWeeklyResult } from "./historical-season-outcome-scorer-types";

describe("historical season outcome scorer", () => {
  it("parses scenario and loads H36 draft artifact shape", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: draftReport(),
      weeklyResults: weeklyResults(),
    });

    expect(report.draftEngineSummary).toMatchObject({ recommendation: "historical_mock_draft_engine_ready_for_season_scoring" });
    expect(report.recommendation).toBe("historical_outcome_scoring_ready_for_strategy_comparison");
  });

  it("reports needs_actual_weekly_results when weekly results are missing", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: draftReport(),
      weeklyResults: null,
    });

    expect(report.actualWeeklyResultsFound).toBe(false);
    expect(report.recommendation).toBe("historical_outcome_scoring_needs_actual_weekly_results");
  });

  it("matches exact IDs and tracks missing player scoring", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: draftReport(),
      weeklyResults: weeklyResults().filter((row) => row.player_id !== "bb-rb"),
    });

    expect(report.weeklyInputCoverage.exactIdMatches).toBeGreaterThan(0);
    expect(report.weeklyInputCoverage.missingPlayerScores).toBeGreaterThan(0);
  });

  it("treats exact season-level matched players with absent week rows as true zero weeks", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: singlePlayerDraft("season-match", "Season Match", "RB"),
      weeklyResults: [result(1, "season-match", "Season Match", "RB", 12)],
    });
    const weekTwoPlayer = report.strategyOutcomes[0]?.weekly_scores[1]?.starters[0];

    expect(weekTwoPlayer).toMatchObject({ points: 0, matchedBy: "player_id", scoreStatus: "true_zero_week" });
    expect(report.weeklyInputCoverage.trueZeroWeekRows).toBe(1);
    expect(report.weeklyInputCoverage.missingPlayerScores).toBe(0);
    expect(report.weeklyInputCoverage.missingScoreRateBeforeZeroWeekTreatment).toBe(0.5);
    expect(report.weeklyInputCoverage.missingScoreRateAfterZeroWeekTreatment).toBe(0);
  });

  it("requires exact season-level identity before applying true zero weeks", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: singlePlayerDraft("draft-id", "Name Candidate", "RB"),
      weeklyResults: [
        result(1, "other-id", "Name Candidate", "RB", 9),
        result(2, "wrong-position", "Name Candidate", "WR", 7),
      ],
    });
    const weekTwoPlayer = report.strategyOutcomes[0]?.weekly_scores[1]?.starters[0];

    expect(report.strategyOutcomes[0]?.weekly_scores[0]?.starters[0]).toMatchObject({ matchedBy: "name_position", scoreStatus: "scored_from_weekly_result" });
    expect(weekTwoPlayer).toMatchObject({ matchedBy: "missing", scoreStatus: "missing_weekly_source" });
    expect(report.weeklyInputCoverage.trueZeroWeekRows).toBe(0);
    expect(report.weeklyInputCoverage.missingPlayerScores).toBe(1);
  });

  it("treats exact registry-only players with no season weekly rows as registry-backed zero-season", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: singlePlayerDraft("registry-id", "Registry Player", "RB"),
      weeklyResults: [result(1, "other-weekly-id", "Other Player", "WR", 4)],
      playerRegistry: [registryRow("registry-id", "Registry Player", "RB")],
    });
    const player = report.strategyOutcomes[0]?.weekly_scores[0]?.starters[0];

    expect(player).toMatchObject({ points: 0, matchedBy: "gsis_id", scoreStatus: "registry_backed_zero_season" });
    expect(report.weeklyInputCoverage.registryBackedZeroSeasonRows).toBe(2);
    expect(report.weeklyInputCoverage.missingPlayerScores).toBe(0);
    expect(report.weeklyInputCoverage.missingScoreRateAfterRegistryZeroSeasonTreatment).toBe(0);
    expect(report.weeklyInputCoverage.playersWithRegistryOnlyExactMatch).toBe(1);
  });

  it("does not score name-only registry candidates or conflicting registry identities", () => {
    const report = buildHistoricalSeasonOutcomeScorerReport({
      projectionSeason: 2026,
      scenario: scenario(),
      draftReport: singlePlayerDraft("draft-id", "Registry Candidate", "RB"),
      weeklyResults: [result(1, "other-weekly-id", "Other Player", "WR", 4)],
      playerRegistry: [
        registryRow("other-id", "Registry Candidate", "RB"),
        registryRow("draft-id", "Registry Candidate", "WR"),
      ],
    });
    const player = report.strategyOutcomes[0]?.weekly_scores[0]?.starters[0];

    expect(player).toMatchObject({ matchedBy: "missing", scoreStatus: "review_candidate_not_scored" });
    expect(report.weeklyInputCoverage.registryBackedZeroSeasonRows).toBe(0);
    expect(report.weeklyInputCoverage.missingPlayerScores).toBe(2);
  });

  it("optimizes best-ball lineups with FLEX and SUPERFLEX eligibility", () => {
    const optimized = optimizeBestBallLineup({
      lineupSettings: { QB: 1, RB: 1, WR: 1, TE: 0, FLEX: 1, SUPERFLEX: 1, K: 0, DST: 0 },
      roster: [
        player("qb", "QB", 20),
        player("rb", "RB", 15),
        player("wr", "WR", 18),
        player("te", "TE", 12),
        player("qb2", "QB", 14),
      ],
    });

    expect(optimized.totalPoints).toBe(79);
    expect(optimized.starters.map((item) => item.playerId)).toEqual(["qb", "rb", "wr", "te", "qb2"]);
    expect(optimized.fillRate).toBe(1);
  });

  it("aggregates weekly team scores and season totals", () => {
    const blackbird = reportWithResults().strategyOutcomes.find((outcome) => outcome.strategy === "blackbird_rank_only" && outcome.teamKey === "slot-1");

    expect(blackbird?.weekly_scores).toHaveLength(2);
    expect(blackbird?.best_ball_total_points).toBeGreaterThan(0);
    expect(blackbird?.weekly_average).toBeGreaterThan(0);
    expect(blackbird?.starter_points).toBe(blackbird?.best_ball_total_points);
  });

  it("computes strategy comparison deltas and my-team focus", () => {
    const report = reportWithResults();

    expect(report.strategyComparison?.blackbirdRankAmongStrategies).toBe(1);
    expect(report.strategyComparison?.blackbirdTotalPointsDeltaVsBaseline.projection_only).toBeGreaterThan(0);
    expect(report.myTeamFocus?.finalDraftedRoster).toBeTruthy();
    expect(report.myTeamFocus?.weeklyBestBallLineupExamples).toBeTruthy();
  });

  it("reports data leakage guard and safety gates", () => {
    const report = reportWithResults();

    expect(report.dataLeakageGuard).toMatchObject({
      draftArtifactLoadedBeforeOutcomes: true,
      actualOutcomesOnlyUsedInScoringPhase: true,
      draftRankingsNotRecomputedFromOutcomes: true,
      noFutureFieldsUsedInDraftSimulation: true,
    });
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("writes artifacts without live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "season-outcome-"));
    try {
      const artifacts = writeHistoricalSeasonOutcomeScorerArtifacts(reportWithResults(), cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function reportWithResults() {
  return buildHistoricalSeasonOutcomeScorerReport({
    projectionSeason: 2026,
    scenario: scenario(),
    draftReport: draftReport(),
    weeklyResults: weeklyResults(),
  });
}

function scenario(): HistoricalSeasonOutcomeScenario {
  return {
    historicalSeason: 2026,
    draftEngineArtifactPath: "artifact.json",
    weeklyResultsInputPath: "weekly.json",
    leagueType: "best_ball",
    rosterSettings: {},
    scoringSettings: {},
    lineupSettings: { QB: 1, RB: 1, WR: 1, TE: 0, FLEX: 1, SUPERFLEX: 0, K: 0, DST: 0 },
    strategiesToScore: ["blackbird_rank_only", "projection_only"],
    weeksToScore: [1, 2],
  };
}

function draftReport(): HistoricalMockDraftEngineReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    scenarioPath: null,
    recommendation: "historical_mock_draft_engine_ready_for_season_scoring",
    draftOrderType: "snake",
    draftOrder: [],
    dataLeakageGuard: {
      allowedDraftTimeInputs: [],
      disallowedOutcomeInputs: [],
      actualSeasonScoringLoaded: false,
      futureOutcomeFieldsUsed: false,
    },
    safetyGates: [],
    strategyResults: [
      strategy("blackbird_rank_only", [
        pick("bb-qb", "Blackbird QB", "QB"),
        pick("bb-rb", "Blackbird RB", "RB"),
        pick("bb-wr", "Blackbird WR", "WR"),
        pick("bb-flex", "Blackbird Flex", "RB"),
      ]),
      strategy("projection_only", [
        pick("pr-qb", "Projection QB", "QB"),
        pick("pr-rb", "Projection RB", "RB"),
        pick("pr-wr", "Projection WR", "WR"),
        pick("pr-flex", "Projection Flex", "TE"),
      ]),
    ],
  };
}

function singlePlayerDraft(playerId: string, playerName: string, position: string): HistoricalMockDraftEngineReport {
  return {
    ...draftReport(),
    strategyResults: [
      strategy("blackbird_rank_only", [
        { ...pick(playerId, playerName, position), strategy: "blackbird_rank_only", overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1 },
      ]),
    ],
  };
}

function strategy(strategyName: "blackbird_rank_only" | "projection_only", picks: ReturnType<typeof pick>[]) {
  return {
    strategy: strategyName,
    teamRosters: [{ draftSlot: 1, picks }],
    pickLog: picks,
    myTeamRoster: picks,
    positionCounts: {},
    starterCoverageEstimate: "",
    benchDepthEstimate: "",
    draftCapitalByPosition: {},
    reachesValueNotes: [],
    rosterReview: null,
  };
}

function pick(playerId: string, playerName: string, position: string) {
  return {
    strategy: "blackbird_rank_only" as const,
    overallPick: 1,
    round: 1,
    pickInRound: 1,
    draftSlot: 1,
    playerId,
    playerName,
    position,
    nflTeam: "TBD",
    rankSource: "test",
  };
}

function weeklyResults(): HistoricalWeeklyResult[] {
  return [
    result(1, "bb-qb", "Blackbird QB", "QB", 24),
    result(1, "bb-rb", "Blackbird RB", "RB", 16),
    result(1, "bb-wr", "Blackbird WR", "WR", 18),
    result(1, "bb-flex", "Blackbird Flex", "RB", 14),
    result(2, "bb-qb", "Blackbird QB", "QB", 22),
    result(2, "bb-rb", "Blackbird RB", "RB", 18),
    result(2, "bb-wr", "Blackbird WR", "WR", 17),
    result(2, "bb-flex", "Blackbird Flex", "RB", 13),
    result(1, "pr-qb", "Projection QB", "QB", 18),
    result(1, "pr-rb", "Projection RB", "RB", 10),
    result(1, "pr-wr", "Projection WR", "WR", 14),
    result(1, "pr-flex", "Projection Flex", "TE", 9),
    result(2, "pr-qb", "Projection QB", "QB", 19),
    result(2, "pr-rb", "Projection RB", "RB", 11),
    result(2, "pr-wr", "Projection WR", "WR", 13),
    result(2, "pr-flex", "Projection Flex", "TE", 8),
  ];
}

function result(week: number, playerId: string, playerName: string, position: string, points: number): HistoricalWeeklyResult {
  return { week, player_id: playerId, player_name: playerName, position, fantasy_points: points };
}

function registryRow(gsis_id: string, display_name: string, position: string): HistoricalPlayerRegistryRow {
  return { gsis_id, display_name, position };
}

function player(playerId: string, position: string, points: number) {
  return { playerId, playerName: playerId, position, points, matchedBy: "player_id" as const };
}
