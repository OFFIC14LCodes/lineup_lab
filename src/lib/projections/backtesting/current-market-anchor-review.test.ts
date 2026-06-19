import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  runCurrentMarketAnchorReview,
  writeCurrentMarketAnchorReviewArtifacts,
} from "./current-market-anchor-review";
import type { CurrentSeasonAdpEnrichedPlayer, CurrentSeasonAdpEnrichmentReport } from "./current-season-adp-enrichment-types";

describe("current market anchor review", () => {
  it("summarizes movement quality and movement by position", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });

      expect(report.movementQuality.playersWithMarketAdp).toBe(7);
      expect(report.movementQuality.playersMovedUp).toBeGreaterThan(0);
      expect(report.movementQuality.playersMovedDown).toBeGreaterThan(0);
      expect(report.movementQuality.medianRankMovement).toBeGreaterThan(0);
      expect(report.movementQuality.movementByPosition.QB.players).toBe(4);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds top moved up/down and position tables", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-top-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });

      expect(report.topMovementTables.top50MovedUp[0]?.rankDelta).toBeLessThan(0);
      expect(report.topMovementTables.top50MovedDown[0]?.rankDelta).toBeGreaterThan(0);
      expect(report.topMovementTables.top50QbMovement.map((row) => row.playerName)).toContain("Josh Allen");
      expect(report.topMovementTables.top50WrMovement.map((row) => row.playerName)).toContain("Ja'Marr Chase");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("checks Superflex QB sanity and movement cap", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-qb-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });

      expect(report.superflexSanity.eliteQbsPulledUpward).toBe(true);
      expect(report.superflexSanity.nonSuperflexPprOnlyBehaviorNotUsed).toBe(true);
      expect(report.superflexSanity.qbsHaveMateriallyDifferentMarketOrderThanOneQb).toBe(true);
      expect(report.superflexSanity.maxMovementCapRespected).toBe(true);
      expect(report.superflexSanity.examples.find((row) => row.playerName === "Josh Allen")).toMatchObject({
        actualSuperflexOrder: 1,
        passed: true,
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("warns when exact ID matches are zero", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-warning-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });

      expect(report.matchQualityAudit.exactIdMatches).toBe(0);
      expect(report.matchQualityAudit.matchQualityRiskGrade).toBe("medium");
      expect(report.matchQualityAudit.warnings[0]).toContain("relies on name/team/position matching");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("lists review candidates and unmatched rows", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-candidates-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });

      expect(report.reviewCandidates.candidateRows).toHaveLength(1);
      expect(report.reviewCandidates.unmatchedRows).toHaveLength(2);
      expect(report.reviewCandidates.mismatchCandidates).toHaveLength(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports unsupported position filtering", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-eligibility-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });

      expect(report.rosterEligibilitySafety.kRowsPresentInAdpSource).toBe(true);
      expect(report.rosterEligibilitySafety.kRowsFilteredForNoKLeague).toBe(true);
      expect(report.rosterEligibilitySafety.dstRowsFilteredIfUnsupported).toBe(true);
      expect(report.rosterEligibilitySafety.idpRowsFilteredIfUnsupported).toBe(true);
      expect(report.rosterEligibilitySafety.noUnsupportedPositionsInMarketAnchorDraftablePreview).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("recommends feature-flag preview and writes artifacts without live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "market-review-artifacts-"));
    try {
      const paths = writeReviewFixture(cwd);
      const report = runCurrentMarketAnchorReview({ season: 2026, marketFormat: "SUPERFLEX", ...paths, cwd });
      const artifacts = writeCurrentMarketAnchorReviewArtifacts(report, cwd);

      expect(report.recommendation).toBe("current_market_anchor_ready_for_feature_flag_preview");
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
      expect(report.recommendationImpactPreview.status).toBe("available");
      expect(typeof report.recommendationImpactPreview.topRecommendationChanged).toBe("boolean");
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function writeReviewFixture(cwd: string) {
  const enrichmentPath = path.join(cwd, "current-season-adp-enrichment-2026.json");
  const enrichedUniversePath = path.join(cwd, "current-season-adp-enriched-universe-2026.json");
  const wideAdpPath = path.join(cwd, "historical-adp-2026.normalized.json");
  const snapshotPath = path.join(cwd, "preseason-projection-snapshot-2026.json");
  const activePolicyPath = path.join(cwd, "projection-active-policy-refresh-final-2026.json");
  const rows = fixturePlayers();
  const enrichment: CurrentSeasonAdpEnrichmentReport = {
    generatedAt: "2026-06-19T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season: 2026,
    marketFormat: "SUPERFLEX",
    recommendation: "current_adp_enrichment_ready_for_market_anchor_review",
    sourceArtifacts: { adpPath: "adp.csv", snapshotPath: "snapshot.json", activePolicyPath: "policy.json" },
    sourceDiscovery: { adpExists: true, snapshotExists: true, activePolicyExists: true, currentUniverseRows: rows.length },
    matchQuality: {
      currentUniverseRows: rows.length,
      adpRowsForSelectedMarketFormat: 10,
      exactIdMatches: 0,
      nameTeamPositionMatches: 7,
      uniqueNamePositionMatches: 0,
      reviewCandidates: 1,
      unmatchedAdpRows: 2,
      universeRowsWithoutAdp: 3,
      coverageByPosition: {},
      coverageByActivePolicyGroup: {},
      coverageByConfidenceBucket: {},
    },
    marketSanityPreview: {
      playersWithMarketAdp: 7,
      playersWithoutMarketAdp: 3,
      averageRankMovement: 10,
      maxRankMovement: 24,
      top25MovedUp: [],
      top25MovedDown: [],
      movementByPosition: {},
      movementByConfidenceBucket: {},
      movementByActivePolicyGroup: {},
      unsupportedPositionsFiltered: ["DEF", "K", "LB"],
      unsupportedPlayersFiltered: 3,
      kRowsPresentInAdp: true,
      kExcludedByNoKLeague: true,
    },
    warRoomSafetyPreview: {
      adpMarketSourceParsed: true,
      superflexMarketRowsAvailable: true,
      kRowsExistInAdpSource: true,
      kExcludedByRosterEligibilityWhenNoKSlot: true,
      dstIdpExcludedWhenUnsupported: true,
      liveDraftSuggestionsUnchanged: true,
      liveBlackbirdRankUnchanged: true,
    },
    matches: [
      match("Josh Allen", "name_position_team_unique", "high"),
      match("Lamar Jackson", "name_position_team_unique", "high"),
      match("Jayden Daniels", "name_position_team_unique", "high"),
      match("Joe Burrow", "name_position_team_unique", "high"),
      match("Review Player", "review_candidate", "review", ["name_position_team_conflict"]),
      match("Missing One", "unmatched", "none"),
      match("Missing Two", "unmatched", "none"),
    ],
    enrichedUniverse: rows,
    safetyGates: [],
  };
  writeFileSync(enrichmentPath, `${JSON.stringify(enrichment, null, 2)}\n`);
  writeFileSync(enrichedUniversePath, `${JSON.stringify({ rows }, null, 2)}\n`);
  writeFileSync(wideAdpPath, "{}\n");
  writeFileSync(snapshotPath, "{}\n");
  writeFileSync(activePolicyPath, "{}\n");
  return { enrichmentPath, enrichedUniversePath, wideAdpPath, snapshotPath, activePolicyPath };
}

function fixturePlayers(): CurrentSeasonAdpEnrichedPlayer[] {
  return [
    player("Josh Allen", "QB", "BUF", 20, 1, -19, "high"),
    player("Lamar Jackson", "QB", "BAL", 18, 2, -16, "high"),
    player("Jayden Daniels", "QB", "WAS", 24, 4, -20, "medium"),
    player("Joe Burrow", "QB", "CIN", 30, 6, -24, "high"),
    player("Ja'Marr Chase", "WR", "CIN", 2, 3, 1, "high"),
    player("Value RB", "RB", "DET", 12, 40, 14, "low"),
    player("Tight End", "TE", "ARI", 35, 55, 10, "medium"),
    player("Top Kicker", "K", "BAL", 60, 140, 24, "medium"),
    player("Top Defense", "DST", "DAL", 70, 150, 24, "medium"),
    player("Top Linebacker", "LB", "SF", 80, 210, 24, "medium"),
  ];
}

function player(name: string, position: string, team: string, modelRank: number, marketRank: number, movement: number, confidence: string): CurrentSeasonAdpEnrichedPlayer {
  return {
    playerId: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    sleeperId: null,
    gsisId: null,
    playerName: name,
    normalizedPlayerName: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    position,
    team,
    projectedPoints: 100 - modelRank,
    modelRank,
    confidence,
    confidenceScore: confidence === "high" ? 90 : confidence === "medium" ? 70 : 30,
    policyGroup: "current_active",
    activePolicyClass: "final_policy_active",
    sourceVariant: "test",
    adp: marketRank,
    marketRank,
    marketFormat: "SUPERFLEX",
    externalMarketSource: "test",
    externalMarketMatchConfidence: "high",
    externalMarketNotes: ["fixture"],
    marketAnchorRank: modelRank + movement,
    marketAnchorMovement: movement,
    marketAnchorConfidenceBucket: confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low",
  };
}

function match(playerName: string, method: CurrentSeasonAdpEnrichmentReport["matches"][number]["matchMethod"], confidence: CurrentSeasonAdpEnrichmentReport["matches"][number]["confidence"], notes = ["fixture"]) {
  return {
    adpRow: {
      season: 2026,
      source: "test",
      asOfDate: "2026-06-19",
      scoringFormat: "SUPERFLEX",
      playerName,
      normalizedPlayerName: playerName.toLowerCase().replace(/[^a-z0-9]/g, ""),
      position: "QB",
      team: null,
      adp: 1,
      rank: 1,
      sleeperId: null,
      gsisId: null,
      playerId: null,
      notes: [],
    },
    universePlayerId: method === "unmatched" || method === "review_candidate" ? null : playerName,
    universePlayerName: method === "unmatched" || method === "review_candidate" ? null : playerName,
    matchMethod: method,
    confidence,
    notes,
  };
}
