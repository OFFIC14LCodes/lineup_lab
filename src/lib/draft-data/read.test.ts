import { describe, expect, it } from "vitest";

import {
  getBatchPlayerProfiles,
  getPlayerLeagueSeasonProfile,
  getProfilesByPosition,
  getReplacementSummary,
  getTopPlayersByMetric
} from "@/lib/draft-data/read";
import type { PlayerLeagueSeasonProfile, ReplacementSummary } from "@/lib/draft-data/types";

describe("draft-data read helpers", () => {
  const profiles = [
    profile("p1", "QB", 20, 100),
    profile("p2", "QB", 18, 90),
    profile("p3", "RB", 15, 75)
  ];

  it("reads single, batch, position, and top-player slices", () => {
    expect(getPlayerLeagueSeasonProfile(profiles, { leagueId: "l1", season: 2025, playerId: "p1" })?.playerName).toBe("Player p1");
    expect(getBatchPlayerProfiles(profiles, { leagueId: "l1", season: 2025, playerIds: ["p1", "p3"] })).toHaveLength(2);
    expect(getProfilesByPosition(profiles, { leagueId: "l1", season: 2025, position: "QB" })).toHaveLength(2);
    expect(getTopPlayersByMetric(profiles, { leagueId: "l1", season: 2025, metric: "pointsPerGame", limit: 1 })[0]?.playerId).toBe("p1");
  });

  it("reads replacement summaries by league and season", () => {
    const summaries: ReplacementSummary[] = [
      {
        leagueId: "l1",
        performanceSeason: 2025,
        leagueConfigSeason: 2026,
        methodVersion: "h6-preliminary-v1",
        methodology: "test",
        positionSummaries: {
          QB: replacement("p2"),
          RB: replacement("p3"),
          WR: replacement(null),
          TE: replacement(null)
        }
      }
    ];

    expect(getReplacementSummary(summaries, { leagueId: "l1", season: 2025 })?.positionSummaries.QB.replacementPlayerId).toBe("p2");
  });
});

function profile(playerId: string, position: "QB" | "RB", ppg: number, total: number): PlayerLeagueSeasonProfile {
  return {
    leagueId: "l1",
    performanceSeason: 2025,
    leagueConfigSeason: 2026,
    analysisMode: "historical_under_current_format",
    provenance: {
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      leagueId: "l1",
      leagueName: "League",
      analysisAsOfDate: "2026-06-14T00:00:00.000Z",
      analysisMode: "historical_under_current_format",
      leagueConfigurationSnapshotId: null,
      scoringSettingsHash: "hash",
      rosterSettingsHash: "hash",
      formatProfileVersion: "h6-format-profile-v1",
      metricDefinitionVersion: "h6-metric-definitions-v1",
      sourceWeeklyStatRows: 1,
      sourceWeeklyStatHash: "hash",
      derivedStatRows: 0,
      derivedStatHash: "hash"
    },
    playerId,
    playerName: `Player ${playerId}`,
    position,
    nflTeam: "DAL",
    gamesWithValidScoringData: 5,
    gamesPlayed: 5,
    gamesStarted: null,
    totalPoints: total,
    pointsPerGame: ppg,
    medianPoints: ppg,
    minPoints: ppg,
    maxPoints: ppg,
    stddevPoints: 0,
    coefficientOfVariation: 0,
    zeroPointWeeks: 0,
    negativePointWeeks: 0,
    floorPoints: ppg,
    medianRangePoints: ppg,
    ceilingPoints: ppg,
    bestThreeWeekAverage: ppg,
    worstThreeWeekAverage: ppg,
    topThreeShare: 0.6,
    weeklyFinishDistribution: { weeks: 5, buckets: {}, rates: {} },
    componentShares: { touchdowns: 0, receptions: 0, passingYardage: 0, rushingYardage: 0, receivingYardage: 0, other: 0 },
    scoringCompleteness: {
      validScoredWeeksOnly: true,
      gamesWithValidScoringData: 5,
      applicableKeyCount: 7,
      evaluatedKeyCount: 7,
      knownZeroKeyCount: 0,
      unsupportedEngineKeyCount: 0,
      unavailableDatasetKeyCount: 0,
      incompleteSourceKeyCount: 0,
      missingMergeKeyCount: 0,
      scoringCompletenessRatio: 1,
      historicalScoreConfidence: "complete",
      coverageRatio: 1,
      validationStatus: "complete_for_stored_rows",
      unsupportedScoringKeys: [],
      missingStatsForSupportedKeys: [],
      knownZeroStatsForSupportedKeys: [],
      warnings: []
    },
    ranks: {
      overallTotal: null,
      positionTotal: null,
      positionPpg: null,
      positionMedian: null,
      positionConsistency: null,
      positionCeiling: null,
      ppgSmallSample: false
    },
    replacement: { replacementPointsPerGame: 10, pointsAboveReplacement: 50 },
    limitations: [],
    situationProfile: {
      playerId,
      performanceSeason: 2025,
      team: unknownSignal(),
      depthChartRole: unknownSignal(),
      projectedRole: unknownSignal(),
      injuryStatus: unknownSignal(),
      offensiveLineContext: unknownSignal(),
      quarterbackContext: unknownSignal(),
      teammateCompetition: unknownSignal(),
      coachingScheme: unknownSignal()
    }
  };
}

function unknownSignal() {
  return { status: "unknown" as const, value: null, source: null, updatedAt: null, confidence: "unknown" as const };
}

function replacement(playerId: string | null) {
  return {
    starterDemand: 1,
    replacementRank: 2,
    replacementPlayerId: playerId,
    replacementPlayerName: playerId,
    replacementPointsPerGame: playerId ? 10 : null,
    eligiblePlayerCount: playerId ? 2 : 0
  };
}
