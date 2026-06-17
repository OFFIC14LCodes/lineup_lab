import { describe, expect, it } from "vitest";

import type { PlayerProfileEvidence } from "./player-profile-evidence";
import {
  buildProfileEvidenceDiagnostics,
  renderProfileEvidenceDiagnosticsCsv,
  type ProfileEvidenceDiagnosticBoardRow,
  type ProfileEvidenceDiagnosticInputRow,
} from "./player-profile-evidence-diagnostics";
import type { PlayerProfileReadModel } from "./player-profile-read-model";

describe("buildProfileEvidenceDiagnostics", () => {
  it("classifies strong profile plus high recommendation as strong support", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [row({ boardRow: boardRow({ playerName: "Support RB", draftSuggestionRank: 3 }), profile: profile(), evidence: evidence() })],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.rows[0].classification).toBe("support");
    expect(result.rows[0].severity).toBe("strong_support");
    expect(result.rows[0].profileEvidenceScore).toBeGreaterThanOrEqual(result.thresholds.strongSupportScore);
    expect(result.totals.profileSupportCount).toBe(1);
    expect(result.categories.strongSupport[0].playerName).toBe("Support RB");
  });

  it("treats default scoring as a note and not an automatic major caution", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Default Player", draftSuggestionRank: 10 }),
          profile: profile(),
          evidence: evidence({ scoringSource: "default", badges: ["default-scored", "sample", "consistent", "available"] }),
        }),
      ],
    });

    expect(result.rows[0].severity).not.toBe("major_caution");
    expect(result.rows[0].scoringNotes[0]).toContain("Default scoring used");
    expect(result.totals.fallbackOrDefaultScoringCount).toBe(1);
  });

  it("classifies weak identity confidence as a major caution", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Weak Match WR", draftSuggestionRank: 80, blackbirdBoardRank: 90 }),
          profile: profile({ matchConfidence: "weak", availabilityScore: 42, ppg: 6, consistencyScore: 42 }),
          evidence: evidence({
            positiveSignals: [],
            cautionSignals: ["Profile match confidence is weak; review may be needed", "42 availability score"],
            badges: ["league-scored", "review"],
          }),
        }),
      ],
    });

    expect(result.rows[0].classification).toBe("caution");
    expect(result.rows[0].severity).toBe("major_caution");
    expect(result.categories.majorCautions[0].playerName).toBe("Weak Match WR");
  });

  it("classifies low sample as insufficient sample", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Low Sample RB" }),
          profile: profile({ games: 3 }),
          evidence: evidence({ positiveSignals: ["Strong profile identity match"], cautionSignals: ["Small historical sample: 3 games"] }),
        }),
      ],
    });

    expect(result.rows[0].classification).toBe("insufficient_sample");
    expect(result.rows[0].severity).toBe("insufficient_sample");
    expect(result.totals.insufficientSampleCount).toBe(1);
  });

  it("classifies strong profile plus low current rank as strong hidden value", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Hidden TE", blackbirdBoardRank: 420, draftSuggestionRank: 410, draftSuggestionScore: 55 }),
          profile: profile({ position: "TE", ppg: 18.8, consistencyScore: 91, availabilityScore: 100 }),
          evidence: evidence({ positiveSignals: ["Strong profile identity match", "14 game historical sample", "91 consistency score"], badges: ["league-scored", "sample", "consistent", "available", "floor", "ceiling"] }),
        }),
      ],
    });

    expect(result.rows[0].classification).toBe("hidden_value");
    expect(result.rows[0].severity).toBe("strong_hidden_value");
    expect(result.totals.hiddenValueCount).toBe(1);
    expect(result.categories.strongHiddenValues[0].playerName).toBe("Hidden TE");
  });

  it("classifies weak profile plus high current rank as profile disagreement", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Disagree QB", position: "QB", blackbirdBoardRank: 5, draftSuggestionRank: 3, draftSuggestionScore: 88 }),
          profile: profile({ position: "QB", ppg: 4.5, consistencyScore: 30, availabilityScore: 35, matchConfidence: "weak" }),
          evidence: evidence({ positiveSignals: [], cautionSignals: ["Profile match confidence is weak; review may be needed", "35 availability score", "4.5 PPG historical scoring profile"], badges: ["league-scored", "review"] }),
        }),
      ],
    });

    expect(result.rows[0].classification).toBe("profile_disagreement");
    expect(result.rows[0].severity).toBe("profile_disagreement");
    expect(result.totals.disagreementCount).toBe(1);
  });

  it("classifies middling profile as neutral", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Neutral WR", draftSuggestionRank: 60, blackbirdBoardRank: 70 }),
          profile: profile({ position: "WR", matchConfidence: "medium", games: 6, ppg: 9.5, consistencyScore: 66, availabilityScore: 72, floor: 6, ceiling: 14, spikeScore: 50 }),
          evidence: evidence({ positiveSignals: ["Strong profile identity match", "12 game historical sample"], cautionSignals: [], badges: ["league-scored", "sample"] }),
        }),
      ],
    });

    expect(result.rows[0].classification).toBe("neutral");
    expect(result.rows[0].severity).toBe("neutral");
  });

  it("classifies unavailable and ambiguous profiles correctly", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({ boardRow: boardRow({ playerName: "Missing Profile" }), profile: null, evidence: unavailableEvidence("No profile found for this player") }),
        row({
          boardRow: boardRow({ playerName: "Ambiguous Profile" }),
          profile: null,
          evidence: unavailableEvidence("Profile lookup ambiguous; no evidence shown"),
          duplicateKey: "name|rb",
        }),
      ],
    });

    expect(result.rows.every((item) => item.classification === "profile_unavailable")).toBe(true);
    expect(result.rows.every((item) => item.severity === "profile_unavailable")).toBe(true);
    expect(result.totals.profilesUnavailable).toBe(2);
  });

  it("surfaces IDP evidence standouts", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "IDP LB", position: "LB", draftSuggestionRank: 40 }),
          profile: profile({ position: "LB", ppg: 16, consistencyScore: 84 }),
          evidence: evidence({ badges: ["league-scored", "sample", "idp-floor", "big-play"], positiveSignals: ["82 solo tackles in profile sample", "9 sacks with 13 splash plays", "84 consistency score"] }),
        }),
      ],
    });

    expect(result.categories.idpEvidenceStandouts).toHaveLength(1);
    expect(result.categories.idpEvidenceStandouts[0].playerName).toBe("IDP LB");
  });

  it("notes fallback and default scoring", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({ boardRow: boardRow({ playerName: "Default Player" }), profile: profile(), evidence: evidence({ scoringSource: "default", badges: ["default-scored"] }) }),
        row({ boardRow: boardRow({ playerName: "Fallback Player" }), profile: profile(), evidence: evidence({ scoringSource: "fallback", badges: ["fallback-scored"], cautionSignals: ["League scoring unavailable; default profile scoring used"] }) }),
      ],
    });

    expect(result.totals.fallbackOrDefaultScoringCount).toBe(2);
    expect(result.categories.fallbackOrDefaultScoring.map((item) => item.playerName)).toEqual(["Default Player", "Fallback Player"]);
    expect(result.rows.find((item) => item.playerName === "Fallback Player")?.severity).not.toBe("major_caution");
  });

  it("caps category output deterministically", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      row({
        boardRow: boardRow({ playerName: `Player ${String(index).padStart(2, "0")}`, draftSuggestionRank: index + 1 }),
        profile: profile(),
        evidence: evidence(),
      })
    );

    const result = buildProfileEvidenceDiagnostics({ rows });

    expect(result.categories.strongSupport).toHaveLength(25);
    expect(result.categories.strongSupport[0].playerName).toBe("Player 00");
    expect(result.categories.strongSupport[24].playerName).toBe("Player 24");
  });

  it("does not mutate input recommendations", () => {
    const input = [
      row({ boardRow: boardRow({ playerName: "Immutable RB" }), profile: profile(), evidence: evidence() }),
    ];
    const before = JSON.stringify(input);

    buildProfileEvidenceDiagnostics({ rows: input });

    expect(JSON.stringify(input)).toBe(before);
  });

  it("renders CSV-safe signals and candidates", () => {
    const result = buildProfileEvidenceDiagnostics({
      rows: [
        row({
          boardRow: boardRow({ playerName: "Comma, Player" }),
          profile: profile(),
          evidence: evidence({ positiveSignals: ['Signal with "quotes"', "Signal, with comma"] }),
        }),
      ],
    });

    expect(renderProfileEvidenceDiagnosticsCsv(result)).toContain('"Comma, Player"');
    expect(renderProfileEvidenceDiagnosticsCsv(result)).toContain('""quotes""');
    expect(renderProfileEvidenceDiagnosticsCsv(result)).toContain("profile_evidence_score");
  });
});

function row(overrides: Partial<ProfileEvidenceDiagnosticInputRow> = {}): ProfileEvidenceDiagnosticInputRow {
  return {
    boardRow: boardRow(),
    profile: profile(),
    evidence: evidence(),
    matchedBy: "sleeper_id",
    duplicateKey: null,
    ...overrides,
  };
}

function boardRow(overrides: Partial<ProfileEvidenceDiagnosticBoardRow> = {}): ProfileEvidenceDiagnosticBoardRow {
  return {
    playerId: "p1",
    playerName: "Player",
    position: "RB",
    team: "TST",
    blackbirdBoardRank: 8,
    draftSuggestionRank: 6,
    draftSuggestionScore: 82,
    blackbirdValueScore: 78,
    projectionPoints: 220,
    projectionLow: 170,
    projectionHigh: 270,
    ...overrides,
  };
}

function evidence(overrides: Partial<PlayerProfileEvidence> = {}): PlayerProfileEvidence {
  return {
    status: "available",
    scoringSource: "league",
    summary: "Strong historical profile under this league's scoring.",
    positiveSignals: ["Strong profile identity match", "14 game historical sample", "18.4 PPG under this league's scoring", "88 consistency score"],
    cautionSignals: [],
    badges: ["league-scored", "sample", "consistent", "available"],
    note: "Historical evidence only; not yet included in Blackbird Rank.",
    ...overrides,
  };
}

function unavailableEvidence(caution: string): PlayerProfileEvidence {
  return {
    status: "unavailable",
    scoringSource: "none",
    summary: "Historical profile not available yet.",
    positiveSignals: [],
    cautionSignals: [caution],
    badges: [],
    note: "Historical evidence only; not yet included in Blackbird Rank.",
  };
}

function profile(overrides: {
  matchConfidence?: string;
  position?: string;
  games?: number;
  ppg?: number | null;
  consistencyScore?: number;
  spikeScore?: number;
  availabilityScore?: number;
  floor?: number | null;
  ceiling?: number | null;
} = {}): PlayerProfileReadModel {
  const position = overrides.position ?? "RB";
  const games = overrides.games ?? 14;
  return {
    header: {
      name: "Player",
      position,
      team: "TST",
      status: "Active",
      headshot: null,
    },
    identity: {
      sleeper_id: "p1",
      gsis_id: "00-TEST",
      blackbird_player_id: null,
      match_confidence: overrides.matchConfidence ?? "strong",
      match_reasons: ["test"],
    },
    bio: {
      age: 25,
      birth_date: null,
      height: null,
      weight: null,
      college: null,
      rookie_season: null,
      years_experience: null,
    },
    summaryMetrics: {
      games,
      total_points: 250,
      points_per_game: overrides.ppg ?? 18.4,
      floor: overrides.floor ?? 10,
      median: 18,
      ceiling: overrides.ceiling ?? 30,
      consistency_score: overrides.consistencyScore ?? 88,
      spike_score: overrides.spikeScore ?? 72,
      availability_score: overrides.availabilityScore ?? 96,
    },
    seasonSummaries: [],
    careerMetadata: null,
    careerSummary: null,
    trendMetrics: null,
    usageSummary: {
      sourceBasis: "weekly_stats",
      gamesWithUsage: games,
      opportunitiesPerGame: 10,
      touchesPerGame: 8,
      carriesPerGame: position === "RB" ? 8 : 0,
      targetsPerGame: position === "QB" ? 0 : 6,
      receptionsPerGame: position === "QB" ? 0 : 4,
      passAttemptsPerGame: position === "QB" ? 30 : 0,
      yardsPerTouch: 10,
      touchdownDependency: 4,
      receivingUsageShare: 60,
      rushingUsageShare: 40,
      targetVolumePerGame: 6,
      tackleFloorScore: position === "LB" ? 80 : null,
      bigPlayDependencyScore: position === "LB" ? 20 : null,
      sackDependencyScore: position === "LB" ? 10 : null,
      gamesWithSnapData: games,
      gamesWithParticipationData: games,
      weeklyUsageConsistency: 84,
      offensiveSnapShare: position === "LB" ? null : 0.72,
      defensiveSnapShare: position === "LB" ? 0.86 : null,
      specialTeamsSnapShare: null,
      gamesOver70PercentSnaps: games,
      gamesUnder40PercentSnaps: 0,
      trendLabel: "stable",
    },
    seasonUsageSummaries: [],
    highValueUsageSummary: null,
    seasonHighValueUsageSummaries: [],
    highValueRoleWarnings: [],
    roleMetrics: {
      roleLabel: position === "LB" ? "tackle_floor" : "lead_back",
      roleConfidence: "medium",
      roleStabilityLabel: "medium",
      idpArchetype: position === "LB" ? "tackle_floor" : null,
      roleModifiers: ["full_time_role"],
      roleTrend: "stable",
      keySignals: ["Role label: lead back"],
      dataGaps: ["snap counts"],
    },
    roleWarnings: ["weekly_stat_usage_only", "snap_data_unavailable"],
    weeklyGameLog: [],
    weeklyGameLogTruncated: false,
    idpSummary: position === "LB" ? { solo_tkl: 82, ast_tkl: 30, sack: 9, int: 1, ff: 2, fr: 1, pd: 5 } : null,
    recommendationSignals: {
      floorScore: 80,
      ceilingScore: 85,
      consistencyScore: overrides.consistencyScore ?? 88,
      spikeScore: overrides.spikeScore ?? 72,
      availabilityScore: overrides.availabilityScore ?? 96,
      volatilityLabel: "low",
      formatFitHints: { redraft: "test", dynasty: "test", bestBall: "test", idp: position === "LB" ? "test" : null },
    },
    warnings: [],
  };
}
