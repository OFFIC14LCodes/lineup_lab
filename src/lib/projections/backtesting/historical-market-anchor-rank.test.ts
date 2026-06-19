import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildMarketAnchorRankedPlayers,
  confidenceBucketForMarketAnchor,
  discoverHistoricalMarketFields,
  normalizeRankScore,
  runHistoricalMarketAnchorExperiment,
  writeHistoricalMarketAnchorExperimentArtifacts,
} from "./historical-market-anchor-rank";
import type { HistoricalMockDraftPlayer } from "./historical-mock-draft-engine-types";

describe("historical market anchor rank", () => {
  it("discovers ADP before market rank when both are available", () => {
    const discovery = discoverHistoricalMarketFields([
      player("p1", { adpRank: 2, marketRank: 3 }),
      player("p2", { marketRank: 4 }),
    ]);

    expect(discovery.sourceUsed).toBe("adpRank");
    expect(discovery.playersWithAdpRank).toBe(1);
    expect(discovery.playersWithMarketRank).toBe(2);
  });

  it("falls back to market rank and reports unavailable when no market source exists", () => {
    expect(discoverHistoricalMarketFields([player("p1", { marketRank: 9 })]).sourceUsed).toBe("marketRank");
    expect(discoverHistoricalMarketFields([player("p1", {})]).sourceUsed).toBe("market_anchor_unavailable");
  });

  it("normalizes rank scores with rank one strongest", () => {
    expect(normalizeRankScore(1, 10)).toBe(1);
    expect(normalizeRankScore(10, 10)).toBe(0.1);
    expect(normalizeRankScore(null, 10)).toBeNull();
  });

  it("uses confidence bucket weights and caps rank movement", () => {
    const ranked = buildMarketAnchorRankedPlayers([
      player("high", { blackbirdRank: 100, marketRank: 1, confidence: "high" }),
      player("low", { blackbirdRank: 100, marketRank: 1, confidence: "low" }),
    ]);

    expect(ranked.find((row) => row.playerId === "high")?.marketAnchorRank).toBeCloseTo(90.1);
    expect(ranked.find((row) => row.playerId === "low")?.marketAnchorRank).toBe(76);
    expect(ranked.find((row) => row.playerId === "low")?.marketAnchorMovement).toBe(-24);
  });

  it("keeps model rank when market rank is missing", () => {
    const [ranked] = buildMarketAnchorRankedPlayers([player("p1", { blackbirdRank: 7, marketRank: null })]);

    expect(ranked.marketAnchorRank).toBe(7);
    expect(ranked.marketAnchorSource).toBe("market_anchor_unavailable");
  });

  it("infers confidence conservatively from available projection fields", () => {
    expect(confidenceBucketForMarketAnchor(player("p1", { projectedPoints: 100, projectionRank: 1 }))).toBe("high");
    expect(confidenceBucketForMarketAnchor(player("p2", { projectionRank: 2 }))).toBe("medium");
    expect(confidenceBucketForMarketAnchor(player("p3", { blackbirdRank: 3, projectionRank: null }))).toBe("low");
  });

  it("writes dry-run artifacts and safety gates without live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-anchor-"));
    try {
      const dir = path.join(cwd, "artifacts", "projections", "backtesting");
      mkdirp(dir);
      writeFileSync(path.join(dir, "historical-draft-universe-2025.json"), JSON.stringify({ h36PlayerUniverse: [player("p1", { marketRank: 1 })] }));
      writeFileSync(path.join(dir, "historical-strategy-comparison-2025.json"), JSON.stringify({
        strategyLeaderboard: [
          { strategy: "blackbird_rank_only", rank: 1, average_team_points: 10 },
          { strategy: "blackbird_market_anchor", rank: 1, average_team_points: 10 },
        ],
      }));

      const report = runHistoricalMarketAnchorExperiment({ season: 2025, cwd });
      const artifacts = writeHistoricalMarketAnchorExperimentArtifacts(report, cwd);

      expect(report.dataLeakageGuard.rankBlendDidNotUseFinalSeasonResults).toBe(true);
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function player(playerId: string, overrides: Partial<HistoricalMockDraftPlayer> & { confidence?: string | number | null } = {}): HistoricalMockDraftPlayer {
  return {
    playerId,
    playerName: playerId,
    position: "WR",
    blackbirdRank: 10,
    projectionRank: 10,
    adpRank: null,
    marketRank: null,
    projectedPoints: null,
    ...overrides,
  };
}

function mkdirp(dir: string) {
  mkdirSync(dir, { recursive: true });
}
