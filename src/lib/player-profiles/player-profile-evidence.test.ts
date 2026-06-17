import { describe, expect, it } from "vitest";

import { buildPlayerProfileEvidence } from "./player-profile-evidence";
import type { PlayerProfileScoringMetadata } from "./player-profile-rescoring";
import type { PlayerProfileReadModel } from "./player-profile-read-model";

describe("buildPlayerProfileEvidence", () => {
  it("creates positive signals for high consistency and availability", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({ consistency_score: 86, availability_score: 100, points_per_game: 18.7 }),
      scoring: scoring("draft_room"),
      maxSignals: 8,
    });

    expect(evidence.status).toBe("available");
    expect(evidence.positiveSignals).toContain("86 consistency score");
    expect(evidence.positiveSignals).toContain("100 availability score");
    expect(evidence.positiveSignals).toContain("18.7 PPG under this league's scoring");
    expect(evidence.badges).toContain("consistent");
    expect(evidence.badges).toContain("available");
    expect(evidence.badges).toContain("league-scored");
    expect(evidence.note).toBe("Historical evidence only; not yet included in Blackbird Rank.");
  });

  it("creates caution signals for weak identity confidence and low sample size", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({
        match_confidence: "weak",
        games: 3,
        warnings: ["weak_identity_match", "low_sample_size"],
      }),
      scoring: scoring("draft_room"),
    });

    expect(evidence.cautionSignals).toContain("Profile match confidence is weak; review may be needed");
    expect(evidence.cautionSignals).toContain("Small historical sample: 3 games");
    expect(evidence.badges).toContain("review");
  });

  it("creates IDP tackle floor and sack/big-play evidence", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({
        position: "LB",
        points_per_game: 13,
        floor: 8,
        ceiling: 18,
        idpSummary: { solo_tkl: 72, ast_tkl: 31, sack: 8, int: 1, ff: 2, fr: 1, pd: 5, def_td: 0 },
        keyStatTotals: { solo_tkl: 72, ast_tkl: 31, sack: 8, int: 1, ff: 2, fr: 1, pd: 5 },
      }),
      scoring: scoring("draft_room"),
      maxSignals: 10,
    });

    expect(evidence.positiveSignals).toContain("72 solo tackles in profile sample");
    expect(evidence.positiveSignals).toContain("8 sacks with 9 splash plays");
    expect(evidence.badges).toContain("idp-floor");
    expect(evidence.badges).toContain("big-play");
  });

  it("creates QB rushing and RB receiving evidence", () => {
    const qbEvidence = buildPlayerProfileEvidence({
      profile: profile({ position: "QB", keyStatTotals: { rush_yd: 420, rush_td: 5 } }),
      scoring: scoring("draft_room"),
      maxSignals: 8,
    });
    const rbEvidence = buildPlayerProfileEvidence({
      profile: profile({ position: "RB", keyStatTotals: { rec: 48, rec_yd: 390 } }),
      scoring: scoring("draft_room"),
      maxSignals: 8,
    });

    expect(qbEvidence.positiveSignals).toContain("420 QB rushing yards in profile sample");
    expect(qbEvidence.badges).toContain("rushing");
    expect(rbEvidence.positiveSignals).toContain("48 RB receptions in profile sample");
    expect(rbEvidence.badges).toContain("receiving");
  });

  it("flags fallback scoring as caution evidence", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile(),
      scoring: scoring("fallback"),
      maxSignals: 8,
    });

    expect(evidence.scoringSource).toBe("fallback");
    expect(evidence.cautionSignals).toContain("League scoring unavailable; default profile scoring used");
    expect(evidence.badges).toContain("fallback-scored");
  });

  it("adds role and usage evidence without changing scoring semantics", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({ roleLabel: "workhorse", usageConsistency: 88 }),
      scoring: scoring("draft_room"),
      maxSignals: 12,
    });

    expect(evidence.positiveSignals).toContain("Role profile: workhorse");
    expect(evidence.positiveSignals).toContain("88 usage consistency score");
    expect(evidence.badges).toContain("role");
    expect(evidence.badges).toContain("usage");
    expect(evidence.note).toBe("Historical evidence only; not yet included in Blackbird Rank.");
  });

  it("adds high-value usage evidence without changing scoring semantics", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({ highValue: true }),
      scoring: scoring("draft_room"),
      maxSignals: 12,
    });

    expect(evidence.positiveSignals).toContain("2.6 high-value touches/targets per game");
    expect(evidence.positiveSignals).toContain("0.5 goal-line carries per game");
    expect(evidence.badges).toContain("high-value");
    expect(evidence.badges).toContain("goal-line");
    expect(evidence.note).toBe("Historical evidence only; not yet included in Blackbird Rank.");
  });

  it("adds caution evidence when high-value usage is unavailable", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({ highValueUnavailable: true }),
      scoring: scoring("draft_room"),
      maxSignals: 12,
    });

    expect(evidence.cautionSignals).toContain("High-value usage source unavailable");
  });

  it("keeps evidence concise and capped", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: profile({
        points_per_game: 30,
        consistency_score: 99,
        spike_score: 92,
        availability_score: 100,
        floor: 20,
        ceiling: 35,
        keyStatTotals: { rec: 90, rec_yd: 1200, targets: 140 },
      }),
      scoring: scoring("draft_room"),
      maxSignals: 3,
    });

    expect(evidence.positiveSignals).toHaveLength(3);
    expect(evidence.cautionSignals.length).toBeLessThanOrEqual(3);
    expect(evidence.badges.length).toBeLessThanOrEqual(8);
  });

  it("returns clean unavailable evidence when no profile is found", () => {
    const evidence = buildPlayerProfileEvidence({
      profile: null,
      scoring: null,
      unavailableReason: "profile_not_found",
    });

    expect(evidence.status).toBe("unavailable");
    expect(evidence.summary).toBe("Historical profile not available yet.");
    expect(evidence.cautionSignals).toEqual(["No profile found for this player"]);
    expect(evidence.positiveSignals).toEqual([]);
  });
});

function scoring(scoringSource: PlayerProfileScoringMetadata["scoringSource"]): PlayerProfileScoringMetadata {
  return {
    scoringSource,
    scoringProfileName: "Test scoring",
    scoringSettingsSummary: {
      reception: 1,
      passingYard: 0.04,
      passingTd: 4,
      interception: -2,
      rushingYard: 0.1,
      rushingTd: 6,
      receivingYard: 0.1,
      receivingTd: 6,
      fumbleLost: -2,
      soloTackle: 2,
      assistedTackle: 1,
      sack: 6,
      interceptionDefense: 4,
      forcedFumble: 2,
      fumbleRecovery: 2,
      passDefended: 1,
      defensiveTd: 6,
      tightEndReceptionBonus: null,
    },
    warnings: [],
  };
}

function profile(input: Partial<{
  position: string;
  match_confidence: string;
  games: number;
  total_points: number;
  points_per_game: number | null;
  floor: number | null;
  median: number | null;
  ceiling: number | null;
  consistency_score: number;
  spike_score: number;
  availability_score: number;
  warnings: PlayerProfileReadModel["warnings"];
  idpSummary: Record<string, number> | null;
  keyStatTotals: Record<string, number>;
  roleLabel: NonNullable<PlayerProfileReadModel["roleMetrics"]>["roleLabel"];
  usageConsistency: number;
  highValue: boolean;
  highValueUnavailable: boolean;
}> = {}): PlayerProfileReadModel {
  const position = input.position ?? "WR";
  const keyStatTotals = input.keyStatTotals ?? { rec: 70, rec_yd: 900, targets: 110 };
  const hasUsageProfile = input.roleLabel !== undefined || input.usageConsistency !== undefined;
  return {
    header: {
      name: "Test Player",
      position,
      team: "DET",
      status: "Active",
      headshot: null,
    },
    identity: {
      sleeper_id: "s1",
      gsis_id: "00-1",
      blackbird_player_id: null,
      match_confidence: input.match_confidence ?? "strong",
      match_reasons: ["match"],
    },
    bio: {
      age: 24,
      birth_date: "2002-01-01",
      height: 72,
      weight: 205,
      college: "Example",
      rookie_season: 2024,
      years_experience: 2,
    },
    summaryMetrics: {
      games: input.games ?? 17,
      total_points: input.total_points ?? 250,
      points_per_game: input.points_per_game ?? 14.7,
      floor: input.floor ?? 9.2,
      median: input.median ?? 14,
      ceiling: input.ceiling ?? 24,
      consistency_score: input.consistency_score ?? 82,
      spike_score: input.spike_score ?? 68,
      availability_score: input.availability_score ?? 100,
    },
    seasonSummaries: [
      {
        season: 2025,
        gamesPlayed: input.games ?? 17,
        totalFantasyPoints: input.total_points ?? 250,
        pointsPerGame: input.points_per_game ?? 14.7,
        positionRank: null,
        keyStatTotals,
      },
    ],
    careerMetadata: null,
    careerSummary: null,
    trendMetrics: null,
    usageSummary: hasUsageProfile
      ? {
          sourceBasis: "weekly_stats",
          gamesWithUsage: input.games ?? 17,
          opportunitiesPerGame: position === "QB" ? 0 : 8,
          touchesPerGame: position === "QB" ? 0 : 6,
          carriesPerGame: position === "QB" ? 5 : position === "RB" ? 8 : 0,
          targetsPerGame: position === "QB" ? 0 : 8,
          receptionsPerGame: position === "QB" ? 0 : 5,
          passAttemptsPerGame: position === "QB" ? 30 : 0,
          yardsPerTouch: 10,
          touchdownDependency: 4,
          receivingUsageShare: 80,
          rushingUsageShare: 20,
          targetVolumePerGame: position === "QB" ? 0 : 8,
          tackleFloorScore: position === "LB" ? 80 : null,
          bigPlayDependencyScore: position === "LB" ? 20 : null,
          sackDependencyScore: position === "LB" ? 10 : null,
          gamesWithSnapData: 0,
          gamesWithParticipationData: 0,
          weeklyUsageConsistency: input.usageConsistency ?? 82,
          offensiveSnapShare: null,
          defensiveSnapShare: null,
          specialTeamsSnapShare: null,
          gamesOver70PercentSnaps: null,
          gamesUnder40PercentSnaps: null,
          trendLabel: "stable",
        }
      : null,
    seasonUsageSummaries: [],
    highValueUsageSummary: input.highValue || input.highValueUnavailable
      ? {
          sourceStatus: input.highValueUnavailable ? "unavailable" : "available",
          gamesWithHighValueUsage: input.highValueUnavailable ? 0 : 12,
          highValueTouchesPerGame: input.highValueUnavailable ? null : 2.1,
          highValueTargetsPerGame: input.highValueUnavailable ? null : 0.5,
          redZoneCarriesPerGame: input.highValueUnavailable ? null : 1.4,
          inside10CarriesPerGame: input.highValueUnavailable ? null : 0.8,
          inside5CarriesPerGame: input.highValueUnavailable ? null : 0.6,
          goalLineCarriesPerGame: input.highValueUnavailable ? null : 0.5,
          redZoneTargetsPerGame: input.highValueUnavailable ? null : 0.2,
          inside10TargetsPerGame: input.highValueUnavailable ? null : 0.1,
          endZoneTargetsPerGame: input.highValueUnavailable ? null : 0.1,
          deepTargetsPerGame: input.highValueUnavailable ? null : 0,
          thirdDownTargetsPerGame: input.highValueUnavailable ? null : 0.2,
          twoMinuteTargetsPerGame: input.highValueUnavailable ? null : 0.1,
          airYardsPerTarget: input.highValueUnavailable ? null : 4.2,
          redZonePassAttemptsPerGame: input.highValueUnavailable ? null : 0,
          designedQbRushesPerGame: input.highValueUnavailable ? null : 0,
          scramblesPerGame: input.highValueUnavailable ? null : 0,
          highValueUsageShare: input.highValueUnavailable ? null : 28,
          targetHighValueShare: input.highValueUnavailable ? null : 18,
          touchdownDependency: input.highValueUnavailable ? null : 10,
          trendLabel: "stable",
          modifiers: input.highValueUnavailable ? [] : ["goal_line_role", "high_value_touch_role"],
        }
      : null,
    seasonHighValueUsageSummaries: [],
    highValueRoleWarnings: input.highValueUnavailable ? ["play_by_play_data_unavailable"] : [],
    roleMetrics: hasUsageProfile
      ? {
          roleLabel: input.roleLabel ?? "volume_receiver",
          roleConfidence: "medium",
          roleStabilityLabel: "medium",
          idpArchetype: position === "LB" ? "tackle_floor" : null,
          roleModifiers: [],
          roleTrend: "stable",
          keySignals: ["Role label: volume receiver"],
          dataGaps: ["snap counts"],
        }
      : null,
    roleWarnings: hasUsageProfile ? ["weekly_stat_usage_only", "snap_data_unavailable"] : [],
    weeklyGameLog: [],
    weeklyGameLogTruncated: false,
    idpSummary: input.idpSummary ?? null,
    recommendationSignals: {
      floorScore: 60,
      ceilingScore: 70,
      consistencyScore: input.consistency_score ?? 82,
      spikeScore: input.spike_score ?? 68,
      availabilityScore: input.availability_score ?? 100,
      volatilityLabel: "medium",
      formatFitHints: { redraft: "usable", dynasty: "bio", bestBall: "spike", idp: null },
    },
    warnings: input.warnings ?? [],
  };
}
