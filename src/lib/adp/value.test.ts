import { describe, expect, it } from "vitest";

import { buildHistoricalLeagueValues, buildPositionalTiers, buildValueVsMarket } from "./value";
import type { ConsensusAdpRecord } from "./types";
import type { PlayerLeagueSeasonProfile } from "@/lib/draft-data/types";

function makeProfile(overrides: Partial<PlayerLeagueSeasonProfile> = {}): PlayerLeagueSeasonProfile {
  return {
    leagueId: "league-1",
    performanceSeason: 2025,
    leagueConfigSeason: 2025,
    analysisMode: "historical_under_current_format",
    provenance: {
      performanceSeason: 2025,
      leagueConfigSeason: 2025,
      leagueId: "league-1",
      leagueName: "Test League",
      analysisAsOfDate: "2026-01-01",
      analysisMode: "historical_under_current_format",
      leagueConfigurationSnapshotId: null,
      scoringSettingsHash: "abc",
      rosterSettingsHash: "def",
      formatProfileVersion: "h6-format-profile-v1",
      metricDefinitionVersion: "h6-metric-definitions-v1",
      sourceWeeklyStatRows: 100,
      sourceWeeklyStatHash: "xyz",
      derivedStatRows: 20,
      derivedStatHash: "uvw",
    },
    playerId: "p1",
    playerName: "Test Player",
    position: "WR",
    nflTeam: "SF",
    gamesWithValidScoringData: 15,
    gamesPlayed: 17,
    gamesStarted: 17,
    totalPoints: 220,
    pointsPerGame: 14.67,
    medianPoints: 14,
    minPoints: 5,
    maxPoints: 30,
    stddevPoints: 6,
    coefficientOfVariation: 0.41,
    zeroPointWeeks: 0,
    negativePointWeeks: 0,
    floorPoints: 8,
    medianRangePoints: 14,
    ceilingPoints: 28,
    bestThreeWeekAverage: 26,
    worstThreeWeekAverage: 7,
    topThreeShare: 0.34,
    weeklyFinishDistribution: { weeks: 15, buckets: {}, rates: {} },
    componentShares: { touchdowns: 0.3, receptions: 0.5, passingYardage: 0, rushingYardage: 0.1, receivingYardage: 0.5, other: 0.1 },
    scoringCompleteness: {
      validScoredWeeksOnly: true,
      gamesWithValidScoringData: 15,
      applicableKeyCount: 20,
      evaluatedKeyCount: 18,
      knownZeroKeyCount: 2,
      unsupportedEngineKeyCount: 0,
      unavailableDatasetKeyCount: 0,
      incompleteSourceKeyCount: 0,
      missingMergeKeyCount: 0,
      scoringCompletenessRatio: 0.95,
      historicalScoreConfidence: "complete",
      coverageRatio: 0.95,
      validationStatus: "complete_for_stored_rows",
      unsupportedScoringKeys: [],
      missingStatsForSupportedKeys: [],
      knownZeroStatsForSupportedKeys: [],
      warnings: [],
    },
    ranks: {
      overallTotal: 12,
      positionTotal: 4,
      positionPpg: 4,
      positionMedian: 5,
      positionConsistency: 3,
      positionCeiling: 4,
      ppgSmallSample: false,
    },
    replacement: {
      replacementPointsPerGame: 10,
      pointsAboveReplacement: 70.05,
    },
    situationProfile: {
      playerId: "p1",
      performanceSeason: 2025,
      team: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      depthChartRole: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      projectedRole: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      injuryStatus: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      offensiveLineContext: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      quarterbackContext: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      teammateCompetition: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
      coachingScheme: { status: "unknown", value: null, source: null, updatedAt: null, confidence: "unknown" },
    },
    limitations: [],
    ...overrides,
  };
}

function makeConsensus(overrides: Partial<ConsensusAdpRecord> = {}): ConsensusAdpRecord {
  return {
    canonicalPlayerId: "p1",
    playerName: "Test Player",
    position: "WR",
    nflTeam: "SF",
    isRookie: false,
    hasHistoricalProfile: true,
    overallAdp: 30,
    overallRank: 30,
    positionalAdp: null,
    positionalRank: 6,
    adpStddev: null,
    minPick: null,
    maxPick: null,
    providerCount: 1,
    totalSampleSize: null,
    recencyWeight: 1,
    formatWeight: 1,
    sourceSnapshots: ["snap-1"],
    ...overrides,
  };
}

describe("buildHistoricalLeagueValues", () => {
  it("returns empty array when no profiles", () => {
    expect(buildHistoricalLeagueValues([], 2025, "league-1")).toHaveLength(0);
  });

  it("computes HLV for a profile with complete confidence", () => {
    const profiles = [makeProfile()];
    const hlv = buildHistoricalLeagueValues(profiles, 2025, "league-1");
    expect(hlv).toHaveLength(1);
    expect(hlv[0].hlvScore).toBe(100); // Only player → max → 100
    expect(hlv[0].hlvRank).toBe(1);
    expect(hlv[0].hlvPositionalRank).toBe(1);
    expect(hlv[0].confidencePenaltyFactor).toBe(1.0);
    expect(hlv[0].adjustedParPerGame).toBeGreaterThan(0);
  });

  it("applies confidence penalty for moderate confidence", () => {
    const profile = makeProfile({
      scoringCompleteness: {
        ...makeProfile().scoringCompleteness,
        historicalScoreConfidence: "moderate",
      }
    });
    const hlv = buildHistoricalLeagueValues([profile], 2025, "league-1");
    expect(hlv[0].confidencePenaltyFactor).toBe(0.88);
    expect(hlv[0].adjustedParPerGame).toBeLessThan(5); // Original PAR/G ≈ 70.05/15=4.67, × 0.88 ≈ 4.11
  });

  it("excludes players with zero valid games", () => {
    const profile = makeProfile({ gamesWithValidScoringData: 0 });
    expect(buildHistoricalLeagueValues([profile], 2025, "league-1")).toHaveLength(0);
  });

  it("unusable confidence gives zero adjustedParPerGame", () => {
    const profile = makeProfile({
      scoringCompleteness: {
        ...makeProfile().scoringCompleteness,
        historicalScoreConfidence: "unusable",
      }
    });
    expect(buildHistoricalLeagueValues([profile], 2025, "league-1")).toHaveLength(0);
  });

  it("ranks multiple players correctly", () => {
    const p1 = makeProfile({ playerId: "p1", replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 100 } });
    const p2 = makeProfile({ playerId: "p2", replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 50 } });
    const hlv = buildHistoricalLeagueValues([p1, p2], 2025, "league-1");
    const byId = Object.fromEntries(hlv.map((h) => [h.canonicalPlayerId, h]));
    expect(byId["p1"].hlvRank).toBe(1);
    expect(byId["p2"].hlvRank).toBe(2);
    expect(byId["p1"].hlvScore).toBe(100);
    expect(byId["p2"].hlvScore).toBeLessThan(100);
  });
});

describe("buildValueVsMarket", () => {
  it("returns empty array when both inputs empty", () => {
    expect(buildValueVsMarket([], [], "league-1")).toHaveLength(0);
  });

  it("player with much lower market rank than HLV rank shows strong_value", () => {
    const consensus = [makeConsensus({ overallRank: 60 })];     // Market rank 60
    const profile = makeProfile({ replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 100 } });
    const hlv = buildHistoricalLeagueValues([profile], 2025, "league-1"); // HLV rank 1
    const vvm = buildValueVsMarket(consensus, hlv, "league-1");

    const record = vvm.find((v) => v.canonicalPlayerId === "p1");
    expect(record).toBeDefined();
    expect(record!.rankDelta).toBeGreaterThan(24); // 60 - 1 = 59
    expect(record!.valueSignal).toBe("strong_value");
  });

  it("player with much higher market rank than HLV rank shows clear_overdraft", () => {
    const consensus = [makeConsensus({ overallRank: 1 })];       // Market rank 1
    const profile = makeProfile({ replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 10 } });
    const hlv = buildHistoricalLeagueValues([profile, makeProfile({ playerId: "p2", replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 100 } })], 2025, "league-1");
    buildValueVsMarket(consensus, hlv, "league-1"); // p1 is fair_value here (delta -1); use extreme case below

    // Let's use a more extreme case
    const consensusExtreme = [makeConsensus({ canonicalPlayerId: "p3", overallRank: 1 })];
    const profileExtreme = makeProfile({ playerId: "p3", replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 5 } });
    const p4 = makeProfile({ playerId: "p4", replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 100 } });
    const p5 = makeProfile({ playerId: "p5", replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 90 } });
    const hlvExtreme = buildHistoricalLeagueValues([profileExtreme, p4, p5, ...Array.from({ length: 27 }, (_, i) =>
      makeProfile({ playerId: `filler-${i}`, replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 50 } })
    )], 2025, "league-1");
    const vvmExtreme = buildValueVsMarket(consensusExtreme, hlvExtreme, "league-1");
    const rec = vvmExtreme.find((v) => v.canonicalPlayerId === "p3");
    expect(rec!.rankDelta).toBeLessThan(-24); // market=1, HLV rank is near bottom
    expect(rec!.valueSignal).toBe("clear_overdraft");
  });

  it("player with no HLV has insufficient_data signal", () => {
    const consensus = [makeConsensus({ canonicalPlayerId: "no-hlv-player" })];
    const vvm = buildValueVsMarket(consensus, [], "league-1");
    const rec = vvm.find((v) => v.canonicalPlayerId === "no-hlv-player");
    expect(rec!.valueSignal).toBe("insufficient_data");
    expect(rec!.hlvRank).toBeNull();
  });
});

describe("buildPositionalTiers", () => {
  it("returns empty array for no players", () => {
    expect(buildPositionalTiers([])).toHaveLength(0);
  });

  it("groups players into tiers with gaps", () => {
    // Players with a large gap between ADP 20 and ADP 32 (12 picks > threshold of 4 at this range)
    // First three land in same tier (gaps 2 each, < threshold 4)
    const players: ConsensusAdpRecord[] = [
      makeConsensus({ canonicalPlayerId: "wr1", position: "WR", overallAdp: 8 }),
      makeConsensus({ canonicalPlayerId: "wr2", position: "WR", overallAdp: 10 }),
      makeConsensus({ canonicalPlayerId: "wr3", position: "WR", overallAdp: 12 }),
      // Gap of 12 picks here: > threshold of 4 for ADP ≤ 24 → new tier
      makeConsensus({ canonicalPlayerId: "wr4", position: "WR", overallAdp: 24 }),
      makeConsensus({ canonicalPlayerId: "wr5", position: "WR", overallAdp: 26 }),
    ];
    const tiers = buildPositionalTiers(players);
    const wrTiers = tiers.filter((t) => t.position === "WR");
    expect(wrTiers.length).toBeGreaterThan(1);
    expect(wrTiers[0].tierNumber).toBe(1);
    // Tier 1 has 3 players (ADP 8, 10, 12): ceiling=8, floor=12
    expect(wrTiers[0].playerIds).toHaveLength(3);
    expect(wrTiers[0].adpCeiling).toBe(8);
    expect(wrTiers[0].adpFloor).toBe(12);
  });

  it("tier 1 is labeled 'Elite'", () => {
    const players = [makeConsensus({ position: "QB", overallAdp: 30 })];
    const tiers = buildPositionalTiers(players);
    expect(tiers[0].tierLabel).toBe("Elite");
  });

  it("each tier has at least one player", () => {
    const players = Array.from({ length: 20 }, (_, i) =>
      makeConsensus({ canonicalPlayerId: `p${i}`, position: "RB", overallAdp: i * 12 + 5 })
    );
    const tiers = buildPositionalTiers(players);
    for (const tier of tiers) {
      expect(tier.playerIds.length).toBeGreaterThan(0);
    }
  });
});
