import { describe, expect, it } from "vitest";

import {
  buildLeagueMarketConsensus,
  buildMarketComparison,
  classifyMarketCompatibility,
  marketDiscrepancyLabel,
  summarizeMarketInspection,
} from "./market-comparison";
import type { AdpFormatProfile, LeagueFormatInput, PlayerAdpRecord } from "@/lib/adp/types";

const league: LeagueFormatInput = {
  leagueId: "league-1",
  pprValue: 1,
  tePremiumValue: 0,
  teamCount: 12,
  isDynasty: false,
  isBestBall: false,
  isSuperflex: false,
};

const profile: AdpFormatProfile = {
  draftType: "redraft",
  platform: "mfl",
  scoringFormat: "ppr",
  pprValue: 1,
  tePremiumValue: 0,
  rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"],
  teamCount: 12,
  isBestBall: false,
  isDynasty: false,
  isStartup: false,
  isSuperflex: false,
  isTePremium: false,
};

function record(overrides: Partial<PlayerAdpRecord> = {}): PlayerAdpRecord {
  return {
    rawId: "raw-1",
    rawName: "Test Player",
    rawPosition: "WR",
    rawTeam: "DAL",
    overallAdp: 24,
    overallRank: null,
    positionalAdp: 10,
    positionalRank: null,
    minPick: null,
    maxPick: null,
    stddev: null,
    sampleSize: null,
    extraFields: {},
    canonicalPlayerId: "player-1",
    sleeperPlayerId: null,
    resolvedName: "Test Player",
    resolvedPosition: "WR",
    resolvedTeam: "DAL",
    identityMatchMethod: "exact_id",
    identityMatchConfidence: 1,
    isRookie: false,
    hasHistoricalProfile: true,
    ...overrides,
  };
}

describe("H9.6 market compatibility", () => {
  it("allows an exact format match", () => {
    const result = classifyMarketCompatibility({ snapshot: profile, league, position: "WR" });
    expect(result.label).toBe("EXACT_MATCH");
    expect(result.weight).toBe(1);
  });

  it("uses partial/weak matching with warnings for superflex mismatch", () => {
    const result = classifyMarketCompatibility({
      snapshot: { ...profile, isSuperflex: false },
      league: { ...league, isSuperflex: true },
      position: "QB",
    });
    expect(["PARTIAL_MATCH", "WEAK_MATCH"]).toContain(result.label);
    expect(result.warnings.join(" ")).toContain("Superflex");
  });

  it("excludes dynasty and redraft blends", () => {
    const result = classifyMarketCompatibility({
      snapshot: { ...profile, isDynasty: true, draftType: "dynasty_startup", isStartup: true },
      league,
      position: "RB",
    });
    expect(result.label).toBe("INCOMPATIBLE");
    expect(result.weight).toBe(0);
  });

  it("excludes rookie-only ADP from baseline projection comparisons", () => {
    const result = classifyMarketCompatibility({
      snapshot: { ...profile, isDynasty: true, draftType: "dynasty_rookie" },
      league: { ...league, isDynasty: true },
      position: "WR",
    });
    expect(result.label).toBe("INCOMPATIBLE");
  });

  it("excludes best-ball and managed-league blends", () => {
    const result = classifyMarketCompatibility({
      snapshot: { ...profile, isBestBall: true, draftType: "best_ball" },
      league,
      position: "WR",
    });
    expect(result.label).toBe("INCOMPATIBLE");
  });
});

describe("H9.6 inspection metrics", () => {
  it("splits zero-compatible players from players with at least one no-market league", () => {
    const summary = summarizeMarketInspection([
      { canonical_player_id: "p1", league_id: "l1", compatibility_label: "EXACT_MATCH", reason_codes: [], provider_count: 1 },
      { canonical_player_id: "p1", league_id: "l2", compatibility_label: "INCOMPATIBLE", reason_codes: ["MARKET_DATA_UNAVAILABLE"], provider_count: 0 },
      { canonical_player_id: "p2", league_id: "l1", compatibility_label: "INCOMPATIBLE", reason_codes: ["MARKET_DATA_UNAVAILABLE"], provider_count: 0 },
      { canonical_player_id: "p2", league_id: "l2", compatibility_label: "NO_MARKET_DATA", reason_codes: ["MARKET_DATA_UNAVAILABLE"], provider_count: 0 },
      { canonical_player_id: "p3", league_id: "l1", compatibility_label: "STRONG_MATCH", reason_codes: [], provider_count: 2 },
      { canonical_player_id: "p3", league_id: "l2", compatibility_label: "PARTIAL_MATCH", reason_codes: [], provider_count: 1 },
    ], 6);

    expect(summary.compatibleComparisonCount).toBe(3);
    expect(summary.noMarketCount).toBe(3);
    expect(summary.incompatibleOnlyCount).toBe(2);
    expect(summary.playersWithZeroCompatibleMarketAcrossAllLeagues).toBe(1);
    expect(summary.playersWithAtLeastOneNoMarketLeague).toBe(2);
    expect(summary.playersWithCompatibleMarketInAtLeastOneLeague).toBe(2);
    expect(summary.leaguesWithZeroCompatibleMarket).toBe(0);
    expect(summary.leaguesWithAtLeastOneNoMarketPlayer).toBe(2);
    expect(summary.providerCountDistribution).toEqual({ "0": 3, "1": 2, "2": 1 });
    expect(summary.reconciliation).toEqual({
      comparisonRowsEqualCompatiblePlusNoMarket: true,
      providerZeroEqualsNoMarketCount: true,
      missingAndDuplicateFree: true,
    });
  });

  it("reports a league with zero compatible market separately from a mixed league", () => {
    const summary = summarizeMarketInspection([
      { canonical_player_id: "p1", league_id: "l1", compatibility_label: "INCOMPATIBLE", reason_codes: ["MARKET_DATA_UNAVAILABLE"], provider_count: 0 },
      { canonical_player_id: "p2", league_id: "l1", compatibility_label: "NO_MARKET_DATA", reason_codes: ["MARKET_DATA_UNAVAILABLE"], provider_count: 0 },
      { canonical_player_id: "p1", league_id: "l2", compatibility_label: "EXACT_MATCH", reason_codes: [], provider_count: 1 },
      { canonical_player_id: "p2", league_id: "l2", compatibility_label: "INCOMPATIBLE", reason_codes: ["MARKET_DATA_UNAVAILABLE"], provider_count: 0 },
    ], 4);

    expect(summary.leaguesWithZeroCompatibleMarket).toBe(1);
    expect(summary.leaguesWithAtLeastOneNoMarketPlayer).toBe(2);
    expect(summary.playersWithZeroCompatibleMarketAcrossAllLeagues).toBe(1);
    expect(summary.playersWithCompatibleMarketInAtLeastOneLeague).toBe(1);
  });
});

describe("H9.6 market consensus and comparison", () => {
  it("builds weighted multi-provider consensus and detects disagreement", () => {
    const consensus = buildLeagueMarketConsensus({
      league,
      position: "WR",
      snapshots: [
        {
          snapshotId: "s1",
          provider: "mfl",
          capturedAt: new Date().toISOString(),
          sourceConfidence: "high",
          sampleSize: 800,
          formatProfile: profile,
          records: [record({ overallAdp: 20 })],
        },
        {
          snapshotId: "s2",
          provider: "fantasypros",
          capturedAt: new Date().toISOString(),
          sourceConfidence: "high",
          sampleSize: 800,
          formatProfile: profile,
          records: [record({ overallAdp: 40 })],
        },
      ],
    });
    expect(consensus.records[0].overallAdp).toBe(30);
    expect(consensus.breakdowns.get("player-1")?.providerDisagreement).toBe(20);
  });

  it("marks single-provider consensus as lower confidence", () => {
    const consensus = buildLeagueMarketConsensus({
      league,
      position: "WR",
      snapshots: [{
        snapshotId: "s1",
        provider: "mfl",
        capturedAt: new Date().toISOString(),
        sourceConfidence: "medium",
        sampleSize: null,
        formatProfile: profile,
        records: [record()],
      }],
    });
    const comparison = buildMarketComparison({
      projection: {
        projectionRunId: "run-1",
        canonicalPlayerId: "player-1",
        leagueId: "league-1",
        position: "WR",
        projectedPositionRank: 12,
      },
      consensus: consensus.records[0],
      breakdown: consensus.breakdowns.get("player-1") ?? null,
      compatibilityLabels: [...consensus.compatibilityBySnapshot.values()],
      formatWarnings: [],
    });
    expect(comparison.reasonCodes).toContain("MARKET_SINGLE_PROVIDER");
    expect(comparison.marketConfidenceLabel).toBe("low");
  });

  it("uses correct rankDelta sign for above and below market", () => {
    expect(marketDiscrepancyLabel(12)).toBe("slight_disagreement");
    const above = buildMarketComparison({
      projection: { projectionRunId: "run", canonicalPlayerId: "p", leagueId: "l", position: "WR", projectedPositionRank: 12 },
      consensus: { canonicalPlayerId: "p", playerName: null, position: "WR", nflTeam: null, isRookie: false, hasHistoricalProfile: true, overallAdp: 50, overallRank: 50, positionalAdp: 24, positionalRank: 24, adpStddev: null, minPick: null, maxPick: null, providerCount: 1, totalSampleSize: null, recencyWeight: 1, formatWeight: 1, sourceSnapshots: ["s"] },
      breakdown: null,
      compatibilityLabels: ["EXACT_MATCH"],
      formatWarnings: [],
    });
    expect(above.rankDelta).toBe(12);
    expect(above.reasonCodes).toContain("PROJECTED_ABOVE_MARKET");

    const below = buildMarketComparison({
      projection: { projectionRunId: "run", canonicalPlayerId: "p", leagueId: "l", position: "WR", projectedPositionRank: 24 },
      consensus: { canonicalPlayerId: "p", playerName: null, position: "WR", nflTeam: null, isRookie: false, hasHistoricalProfile: true, overallAdp: 20, overallRank: 20, positionalAdp: 12, positionalRank: 12, adpStddev: null, minPick: null, maxPick: null, providerCount: 1, totalSampleSize: null, recencyWeight: 1, formatWeight: 1, sourceSnapshots: ["s"] },
      breakdown: null,
      compatibilityLabels: ["EXACT_MATCH"],
      formatWarnings: [],
    });
    expect(below.rankDelta).toBe(-12);
    expect(below.reasonCodes).toContain("PROJECTED_BELOW_MARKET");
  });

  it("returns null market fields when no compatible provider exists", () => {
    const comparison = buildMarketComparison({
      projection: { projectionRunId: "run", canonicalPlayerId: "p", leagueId: "l", position: "WR", projectedPositionRank: 1 },
      consensus: null,
      breakdown: null,
      compatibilityLabels: [],
      formatWarnings: [],
    });
    expect(comparison.marketOverallAdp).toBeNull();
    expect(comparison.marketConfidenceLabel).toBe("none");
    expect(comparison.reasonCodes).toContain("MARKET_DATA_UNAVAILABLE");
  });
});
