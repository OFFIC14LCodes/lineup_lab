import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildMarketAnchorBoardPreview } from "./market-anchor-board-preview";
import type { BlackbirdBoardRow } from "./blackbird-board";
import { buildProjectionTrust } from "../projections/projection-trust";

describe("market anchor board preview", () => {
  it("keeps board ordering identical when flag is disabled", () => {
    const rows = [boardRow("a", "Alpha", "WR", 1), boardRow("b", "Beta", "RB", 2)];
    const result = buildMarketAnchorBoardPreview({
      rows,
      rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"],
      marketFormat: "SUPERFLEX",
      flagEnabled: false,
    });

    expect(result.rows).toBe(rows);
    expect(result.rows.map((row) => row.playerName)).toEqual(["Alpha", "Beta"]);
    expect(result.diagnostics).toMatchObject({
      flagEnabled: false,
      status: "disabled",
      label: "Market Anchor Rank: disabled",
    });
  });

  it("fails closed when artifacts are missing", () => {
    const rows = [boardRow("a", "Alpha", "WR", 1)];
    const result = buildMarketAnchorBoardPreview({
      rows,
      rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"],
      marketFormat: "SUPERFLEX",
      flagEnabled: true,
      cwd: mkdtempSync(path.join(tmpdir(), "missing-market-anchor-")),
    });

    expect(result.rows).toBe(rows);
    expect(result.diagnostics.status).toBe("artifacts_missing");
    expect(result.diagnostics.warnings).toContain("Market anchor artifacts missing — current Blackbird Rank path used.");
  });

  it("applies preview only to eligible accepted market matches", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-anchor-"));
    try {
      const artifacts = writeArtifacts(cwd);
      const rows = [
        boardRow("alpha", "Alpha", "WR", 1),
        boardRow("beta", "Beta", "RB", 2),
        boardRow("review", "Review Only", "WR", 3),
      ];

      const result = buildMarketAnchorBoardPreview({
        rows,
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"],
        marketFormat: "SUPERFLEX",
        flagEnabled: true,
        cwd,
        ...artifacts,
      });

      expect(result.rows[0].playerName).toBe("Beta");
      expect(result.rows.find((row) => row.playerName === "Beta")?.marketAnchorPreview).toMatchObject({
        label: "Market Anchor Preview",
        marketAnchorRank: 1,
        matchConfidence: "high",
      });
      expect(result.rows.find((row) => row.playerName === "Review Only")?.marketAnchorPreview).toBeUndefined();
      expect(result.diagnostics.playersApplied).toBe(2);
      expect(result.diagnostics.matchQualityWarning).toContain("name/team/position");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not let K, DST, or IDP appear in no-K/no-defense preview", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-anchor-eligibility-"));
    try {
      const artifacts = writeArtifacts(cwd);
      const rows = [
        boardRow("alpha", "Alpha", "WR", 1),
        boardRow("k", "Top Kicker", "K", 2),
        boardRow("dst", "Top Defense", "DEF", 3),
        boardRow("lb", "Top LB", "LB", 4),
      ];

      const result = buildMarketAnchorBoardPreview({
        rows,
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"],
        marketFormat: "SUPERFLEX",
        flagEnabled: true,
        cwd,
        ...artifacts,
      });

      expect(result.rows.find((row) => row.position === "K")?.marketAnchorPreview).toBeUndefined();
      expect(result.rows.find((row) => row.position === "DEF")?.marketAnchorPreview).toBeUndefined();
      expect(result.rows.find((row) => row.position === "LB")?.marketAnchorPreview).toBeUndefined();
      expect(result.diagnostics.unsupportedPositionsFiltered).toEqual(["DEF", "K", "LB"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not let market anchor reintroduce blocked archive players", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-anchor-archive-"));
    try {
      const artifacts = writeArtifacts(cwd);
      const rows = [
        boardRow("luck", "Andrew Luck", "QB", 1),
        boardRow("alpha", "Alpha", "WR", 2),
      ];

      const result = buildMarketAnchorBoardPreview({
        rows,
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX"],
        marketFormat: "SUPERFLEX",
        flagEnabled: true,
        cwd,
        ...artifacts,
      });

      expect(result.rows.find((row) => row.playerName === "Andrew Luck")?.marketAnchorPreview).toBeUndefined();
      expect(result.rows.find((row) => row.playerName === "Alpha")?.marketAnchorPreview).toBeDefined();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not apply movement beyond cap or wrong market format", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-anchor-cap-"));
    try {
      const artifacts = writeArtifacts(cwd);
      const rows = [
        boardRow("cap", "Cap Breaker", "WR", 1),
        boardRow("ppr", "PPR Only", "WR", 2),
      ];

      const result = buildMarketAnchorBoardPreview({
        rows,
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"],
        marketFormat: "SUPERFLEX",
        flagEnabled: true,
        cwd,
        ...artifacts,
      });

      expect(result.rows.find((row) => row.playerName === "Cap Breaker")?.marketAnchorPreview).toBeUndefined();
      expect(result.rows.find((row) => row.playerName === "PPR Only")?.marketAnchorPreview).toBeUndefined();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function writeArtifacts(cwd: string) {
  const enrichedUniversePath = path.join(cwd, "enriched.json");
  const reviewPath = path.join(cwd, "review.json");
  writeFileSync(enrichedUniversePath, JSON.stringify({
    rows: [
      market("alpha", "Alpha", "WR", "DAL", 20, 2, -1, "SUPERFLEX", "high", ["unique_name_position_team_match"]),
      market("beta", "Beta", "RB", "DET", 3, 1, -1, "SUPERFLEX", "high", ["unique_name_position_team_match"]),
      market("review", "Review Only", "WR", "SEA", 4, 1, -2, "SUPERFLEX", "high", ["unique_name_position_without_team"]),
      market("k", "Top Kicker", "K", "BAL", 100, 1, -1, "SUPERFLEX", "high", ["unique_name_position_team_match"]),
      market("dst", "Top Defense", "DST", "DAL", 101, 1, -1, "SUPERFLEX", "high", ["unique_name_position_team_match"]),
      market("lb", "Top LB", "LB", "SF", 102, 1, -1, "SUPERFLEX", "high", ["unique_name_position_team_match"]),
      market("cap", "Cap Breaker", "WR", "NYG", 2, 1, -25, "SUPERFLEX", "high", ["unique_name_position_team_match"]),
      market("ppr", "PPR Only", "WR", "NYG", 2, 1, -1, "PPR", "high", ["unique_name_position_team_match"]),
      market("luck", "Andrew Luck", "QB", "IND", 1, 1, 0, "SUPERFLEX", "high", ["unique_name_position_team_match"], "final_policy_blocked_archive", "legacy_blocked"),
    ],
  }), "utf8");
  writeFileSync(reviewPath, JSON.stringify({
    matchQualityAudit: {
      exactIdMatches: 0,
      warnings: ["Market source currently relies on name/team/position matching. This is acceptable for dry-run review but should be ID-backed or reviewed before live activation."],
    },
    rosterEligibilitySafety: {
      unsupportedPositionsFiltered: ["DEF", "K", "LB"],
    },
  }), "utf8");
  return { enrichedUniversePath, reviewPath };
}

function market(
  playerId: string,
  playerName: string,
  position: string,
  team: string,
  marketRank: number,
  marketAnchorRank: number,
  movement: number,
  marketFormat: string,
  confidence: string,
  notes: string[],
  activePolicyClass?: string | null,
  policyGroup?: string | null,
) {
  return {
    playerId,
    playerName,
    position,
    team,
    adp: marketRank,
    marketRank,
    marketFormat,
    externalMarketMatchConfidence: confidence,
    externalMarketNotes: notes,
    marketAnchorRank,
    marketAnchorMovement: movement,
    activePolicyClass: activePolicyClass ?? null,
    policyGroup: policyGroup ?? null,
  };
}

function boardRow(playerId: string, playerName: string, position: string, rank: number): BlackbirdBoardRow {
  return {
    playerId,
    playerName,
    position,
    team: position === "RB" ? "DET" : position === "K" ? "BAL" : position === "DEF" ? "DAL" : position === "LB" ? "SF" : "DAL",
    blackbirdBoardRank: rank,
    draftSuggestionRank: null,
    draftSuggestionScore: null,
    draftSuggestionType: null,
    blackbirdValueScore: null,
    projectionPoints: null,
    projectionLow: null,
    projectionHigh: null,
    projectionUnit: "unknown",
    projectionSource: "test",
    projectionTrust: buildProjectionTrust({
      playerId,
      playerName,
      position,
      projectionUnit: "unknown",
      projectionSource: "unknown",
    }),
    role: null,
    roleConfidence: null,
    replacementMedianPoints: null,
    replacementRank: null,
    pointsAboveReplacement: null,
    adp: null,
    marketRank: rank,
    rankDelta: null,
    confidence: "medium",
    risk: "low",
    blackbirdTier: null,
    suggestedDraftSpot: {
      pickMin: null,
      pickMax: null,
      round: null,
      label: "unknown",
      marketEdgePicks: null,
      reachRisk: "unknown",
      waitRisk: "unknown",
      reason: "Test fixture row has no draft timing estimate.",
    },
    valueScoreComponents: null,
    contextualReasons: [],
    contextualDataGaps: [],
    planFit: "insufficient_data",
    planFitReasons: [],
    needTimingAction: null,
    waitPlanTargetCount: null,
    drafted: false,
    dataStatus: { projection: "unavailable", adp: "unavailable", marketRank: "available", h10: "unavailable", ordering: "blackbird" },
    source: {
      h10RecommendationRank: null,
      h10RecommendationScore: null,
      draftTargetScore: null,
      originalIndex: rank - 1,
      player: {} as BlackbirdBoardRow["source"]["player"],
      overlay: null,
      recommendation: null,
      leagueRank: null,
    },
  };
}
