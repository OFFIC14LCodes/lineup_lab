import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHistoricalMockDraftEngineReport,
  generateHistoricalDraftOrder,
  writeHistoricalMockDraftEngineArtifacts,
  runHistoricalMockDraftEngine,
} from "./historical-mock-draft-engine";
import type { HistoricalMockDraftScenario } from "./historical-mock-draft-engine-types";

describe("historical mock draft engine", () => {
  it("parses scenario-shaped input and generates a ready report", () => {
    const report = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });

    expect(report.recommendation).toBe("historical_mock_draft_engine_ready_for_season_scoring");
    expect(report.strategyResults).toHaveLength(8);
  });

  it("generates 12-team snake order with round and pick metadata", () => {
    const order = generateHistoricalDraftOrder({ teams: 12, rounds: 2, draftOrderType: "snake" });

    expect(order[0]).toMatchObject({ overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1 });
    expect(order[11]).toMatchObject({ overallPick: 12, round: 1, pickInRound: 12, draftSlot: 12 });
    expect(order[12]).toMatchObject({ overallPick: 13, round: 2, pickInRound: 1, draftSlot: 12 });
    expect(order[23]).toMatchObject({ overallPick: 24, round: 2, pickInRound: 12, draftSlot: 1 });
  });

  it("generates 12-team third round reversal order", () => {
    const order = generateHistoricalDraftOrder({ teams: 12, rounds: 4, draftOrderType: "third_round_reversal" });

    expect(order[0].draftSlot).toBe(1);
    expect(order[12].draftSlot).toBe(12);
    expect(order[24].draftSlot).toBe(12);
    expect(order[36].draftSlot).toBe(1);
  });

  it("never drafts duplicate players and only drafts available players", () => {
    const result = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() }).strategyResults[0];
    const ids = result.pickLog.map((pick) => pick.playerId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(16);
  });

  it("runs rank-based baseline strategies", () => {
    const report = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });

    expect(report.strategyResults.find((result) => result.strategy === "blackbird_rank_only")?.pickLog[0].playerId).toBe("p2");
    expect(report.strategyResults.find((result) => result.strategy === "projection_only")?.pickLog[0].playerId).toBe("p3");
    expect(report.strategyResults.find((result) => result.strategy === "adp_only")?.pickLog[0].playerId).toBe("p3");
    expect(report.strategyResults.find((result) => result.strategy === "market_rank")?.pickLog[0].playerId).toBe("p3");
  });

  it("runs market-aware strategies without duplicates", () => {
    const report = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });
    const anchor = report.strategyResults.find((result) => result.strategy === "blackbird_market_anchor");
    const needAnchor = report.strategyResults.find((result) => result.strategy === "blackbird_market_anchor_need_based");

    expect(anchor?.pickLog[0].rankSource).toBe("marketAnchorRank");
    expect(anchor?.pickLog.map((pick) => pick.playerId)).toHaveLength(new Set(anchor?.pickLog.map((pick) => pick.playerId)).size);
    expect(needAnchor?.pickLog[0].rankSource).toBe("marketAnchorRank");
  });

  it("preserves roster eligibility and excludes K when no K slot even with great market rank", () => {
    const input = scenario();
    input.playerUniverseInput.players = [
      { playerId: "k1", playerName: "Kicker", position: "K", blackbirdRank: 1, projectionRank: 1, marketRank: 1, projectedPoints: 999 },
      ...(input.playerUniverseInput.players ?? []),
    ];
    const result = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: input })
      .strategyResults.find((row) => row.strategy === "blackbird_market_anchor");

    expect(result?.pickLog.some((pick) => pick.position === "K")).toBe(false);
    expect(result?.unsupportedPositionsFiltered).toContain("K");
  });

  it("runs need-based strategy and deterministic random-within-band strategy", () => {
    const reportA = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });
    const reportB = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });

    expect(reportA.strategyResults.find((result) => result.strategy === "need_based")?.myTeamRoster.length).toBeGreaterThan(0);
    expect(reportA.strategyResults.find((result) => result.strategy === "random_within_adp_band")?.pickLog.map((pick) => pick.playerId))
      .toEqual(reportB.strategyResults.find((result) => result.strategy === "random_within_adp_band")?.pickLog.map((pick) => pick.playerId));
  });

  it("reconstructs rosters and integrates H35 review for Blackbird strategy", () => {
    const blackbird = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() })
      .strategyResults.find((result) => result.strategy === "blackbird_rank_only");

    expect(blackbird?.teamRosters).toHaveLength(4);
    expect(blackbird?.positionCounts).toBeTruthy();
    expect(blackbird?.rosterReview?.recommendation).toBe("mock_draft_roster_review_ready_for_human_review");
  });

  it("reports data leakage guard and safety gates", () => {
    const report = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });

    expect(report.dataLeakageGuard.actualSeasonScoringLoaded).toBe(false);
    expect(report.dataLeakageGuard.futureOutcomeFieldsUsed).toBe(false);
    expect(report.dataLeakageGuard.disallowedOutcomeInputs.join(" ")).toContain("final season fantasy points");
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("writes artifacts without live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-mock-draft-"));
    try {
      const report = buildHistoricalMockDraftEngineReport({ projectionSeason: 2026, scenario: scenario() });
      const artifacts = writeHistoricalMockDraftEngineArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("loads a player universe from a local artifact path", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-mock-draft-artifact-"));
    try {
      const artifactPath = path.join(cwd, "universe.json");
      writeFileSync(artifactPath, JSON.stringify({ playerUniverseInput: { players: scenario().playerUniverseInput.players } }));
      const scenarioPath = path.join(cwd, "scenario.json");
      writeFileSync(scenarioPath, JSON.stringify({ ...scenario(), playerUniverseInput: { artifactPath: "universe.json" } }));

      const report = runHistoricalMockDraftEngine({ projectionSeason: 2026, scenarioPath: "scenario.json", cwd });

      expect(report.recommendation).toBe("historical_mock_draft_engine_ready_for_season_scoring");
      expect(report.strategyResults[0].pickLog).toHaveLength(16);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function scenario(): HistoricalMockDraftScenario {
  const players = Array.from({ length: 16 }, (_, index) => {
    const rank = index + 1;
    const positions = ["WR", "RB", "WR", "RB", "TE", "QB", "WR", "RB"];
    return {
      playerId: `p${rank}`,
      sleeperId: `s${rank}`,
      playerName: `Player ${rank}`,
      position: positions[index % positions.length],
      nflTeam: "TBD",
      blackbirdRank: rank === 1 ? 8 : rank === 2 ? 1 : rank,
      projectionRank: rank === 1 ? 20 : rank === 3 ? 1 : rank,
      adpRank: rank === 1 ? 20 : rank === 3 ? 1 : rank,
      marketRank: rank === 1 ? 20 : rank === 3 ? 1 : rank,
      projectedPoints: 300 - rank,
    };
  });
  return {
    historicalSeason: 2026,
    leagueType: "dynasty_best_ball",
    teams: 4,
    rounds: 4,
    draftOrderType: "third_round_reversal",
    draftSlots: [1, 2, 3, 4],
    myDraftSlot: 2,
    rosterSettings: { QB: 1, RB: 2, WR: 2, TE: 1 },
    scoringSettings: {},
    strategySet: ["blackbird_rank_only", "blackbird_market_anchor", "blackbird_market_anchor_need_based", "projection_only", "adp_only", "market_rank", "need_based", "random_within_adp_band"],
    randomSeed: 2026,
    playerUniverseInput: { players },
    projectionSnapshotInput: { asOf: "2026-08-01" },
    adpInput: { asOf: "2026-08-01" },
    marketRankInput: { asOf: "2026-08-01" },
  };
}
