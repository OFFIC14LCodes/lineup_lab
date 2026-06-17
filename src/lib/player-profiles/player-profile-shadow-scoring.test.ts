import { describe, expect, it } from "vitest";

import {
  buildProfileShadowScoring,
  renderProfileShadowScoringCsv,
  type ProfileShadowScoringRow,
} from "./player-profile-shadow-scoring";
import type { ProfileEvidenceDiagnosticRow } from "./player-profile-evidence-diagnostics";

describe("buildProfileShadowScoring", () => {
  it("caps adjustments to the new conservative range", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({ playerName: "Everything Positive", profileEvidenceScore: 100, profileMetrics: metrics({ consistencyScore: 100, availabilityScore: 100, spikeScore: 100, floor: 20, ceiling: 40 }), badges: ["idp-floor", "big-play", "ceiling"], positiveSignals: ["100 solo tackles", "rushing profile"] }),
        row({ playerName: "Everything Negative", profileEvidenceScore: -100, profileMatchConfidence: "weak", profileMetrics: metrics({ games: 1, consistencyScore: 10, availabilityScore: 20, spikeScore: 90, floor: 0 }), cautionSignals: ["Low floor and volatility"], severity: "insufficient_sample" }),
      ],
    });

    expect(Math.max(...result.rows.map((item) => item.profileShadowAdjustment))).toBeLessThanOrEqual(6);
    expect(Math.min(...result.rows.map((item) => item.profileShadowAdjustment))).toBeGreaterThanOrEqual(-6);
  });

  it("caps insufficient sample positive adjustment instead of applying a huge penalty", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({
          playerName: "Limited Rookie",
          severity: "insufficient_sample",
          profileEvidenceScore: 80,
          profileMetrics: metrics({ games: 3, consistencyScore: 92, availabilityScore: 100, spikeScore: 96, floor: 12 }),
        }),
      ],
    });

    expect(result.rows[0].profileShadowAdjustment).toBeGreaterThanOrEqual(-2);
    expect(result.rows[0].profileShadowAdjustment).toBeLessThanOrEqual(1.3);
    expect(result.rows[0].adjustmentReasons.join(" ")).toContain("Insufficient sample caps positive");
  });

  it("dampens elite high-ranked player adjustments", () => {
    const elite = buildProfileShadowScoring({
      rows: [row({ playerName: "Elite QB", position: "QB", draftSuggestionRank: 3, recommendationScore: 90, profileEvidenceScore: 100, profileMetrics: metrics({ consistencyScore: 99, availabilityScore: 100, spikeScore: 99, floor: 18, ceiling: 35 }), positiveSignals: ["rushing profile"] })],
    }).rows[0];
    const mid = buildProfileShadowScoring({
      rows: [row({ playerName: "Mid QB", position: "QB", draftSuggestionRank: 180, recommendationScore: 55, profileEvidenceScore: 100, profileMetrics: metrics({ consistencyScore: 99, availabilityScore: 100, spikeScore: 99, floor: 18, ceiling: 35 }), positiveSignals: ["rushing profile"] })],
    }).rows[0];

    expect(elite.profileShadowAdjustment).toBeLessThan(mid.profileShadowAdjustment);
    expect(elite.componentAdjustments.rankZoneDampening).toBeLessThan(1);
  });

  it("excludes fringe players in relevant pool mode", () => {
    const result = buildProfileShadowScoring({
      poolMode: "relevant",
      rows: [
        row({ playerName: "Relevant Player", draftSuggestionRank: 25 }),
        row({ playerName: "Fringe Player", draftSuggestionRank: 800 }),
      ],
    });

    expect(result.rows.map((item) => item.playerName)).toEqual(["Relevant Player"]);
    expect(result.pool.filteredOutAsFringe).toBe(1);
  });

  it("keeps fringe players in all pool mode with dampened impact", () => {
    const result = buildProfileShadowScoring({
      poolMode: "all",
      rows: [row({ playerName: "Fringe Player", draftSuggestionRank: 800, profileEvidenceScore: 100 })],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].componentAdjustments.rankZoneDampening).toBeLessThan(1);
  });

  it("boosts IDP tackle-floor signals but keeps them capped", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({
          playerName: "IDP LB",
          position: "LB",
          badges: ["idp-floor"],
          positiveSignals: ["88 solo tackles in profile sample"],
          profileEvidenceScore: 70,
        }),
      ],
    });

    expect(result.rows[0].profileShadowAdjustment).toBeGreaterThan(0);
    expect(result.rows[0].componentAdjustments.positionSpecificEdge).toBeLessThanOrEqual(2);
    expect(result.categories.idpBoosts[0].playerName).toBe("IDP LB");
  });

  it("does not overboost DL big-play profiles without floor", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({
          playerName: "Sack DL",
          position: "DL",
          positiveSignals: ["9 sacks with splash plays"],
          profileMetrics: metrics({ floor: 0, spikeScore: 90 }),
          profileEvidenceScore: 40,
        }),
      ],
    });

    expect(result.rows[0].componentAdjustments.positionSpecificEdge).toBeLessThanOrEqual(1);
    expect(result.rows[0].profileShadowAdjustment).toBeLessThan(6);
  });

  it("gives QB rushing a capped boost", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({
          playerName: "Rushing QB",
          position: "QB",
          positiveSignals: ["QB rushing profile adds weekly floor"],
          profileEvidenceScore: 60,
        }),
      ],
    });

    expect(result.rows[0].componentAdjustments.positionSpecificEdge).toBeGreaterThan(0);
    expect(result.rows[0].profileShadowAdjustment).toBeLessThanOrEqual(6);
  });

  it("classifies strong profiles within conservative thresholds", () => {
    const result = buildProfileShadowScoring({
      rows: [row({ playerName: "Strong RB", profileEvidenceScore: 72 })],
    });

    expect(["mild_boost", "strong_boost"]).toContain(result.rows[0].movementClassification);
    expect(result.rows[0].profileShadowAdjustment).toBeLessThanOrEqual(6);
  });

  it("creates capped weak identity penalty", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({
          playerName: "Weak Match",
          profileMatchConfidence: "weak",
          profileEvidenceScore: -35,
        }),
      ],
    });

    expect(result.rows[0].profileShadowAdjustment).toBeLessThan(0);
    expect(result.rows[0].profileShadowAdjustment).toBeGreaterThanOrEqual(-6);
  });

  it("keeps movement count sanity", () => {
    const result = buildProfileShadowScoring({
      rows: [
        row({ playerName: "Boost", profileEvidenceScore: 80 }),
        row({ playerName: "Penalty", profileEvidenceScore: -60, profileMatchConfidence: "weak" }),
        row({ playerName: "Neutral", profileEvidenceScore: 0, profileMetrics: metrics({ consistencyScore: 70, availabilityScore: 80, floor: 6, spikeScore: 50 }) }),
      ],
    });

    expect(result.totals.boostedPlayers + result.totals.penalizedPlayers + result.totals.unchangedPlayers).toBe(result.totals.playersEvaluated);
    expect(result.totals.strongBoostCount).toBeLessThanOrEqual(result.totals.boostedPlayers);
    expect(result.totals.strongPenaltyCount).toBeLessThanOrEqual(result.totals.penalizedPlayers);
    expect(result.sanity.movementCountsReconcile).toBe(true);
    expect(result.sanity.strongBoostsWithinBoosted).toBe(true);
    expect(result.sanity.strongPenaltiesWithinPenalized).toBe(true);
  });

  it("does not mutate baseline recommendation data and outputs deterministic CSV", () => {
    const input = [
      row({ playerName: "Immutable Player", draftSuggestionRank: 2 }),
      row({ playerName: "Other Player", draftSuggestionRank: 1 }),
    ];
    const before = JSON.stringify(input);
    const result = buildProfileShadowScoring({ rows: input, generatedAt: "2026-01-01T00:00:00.000Z" });

    expect(JSON.stringify(input)).toBe(before);
    expect(renderProfileShadowScoringCsv(result)).toContain("sample_confidence_component");
    expect(byName(result.rows, "Immutable Player").shadowRank).toBeGreaterThan(0);
  });
});

function byName(rows: ProfileShadowScoringRow[], name: string) {
  const found = rows.find((row) => row.playerName === name);
  if (!found) throw new Error(`Missing row ${name}`);
  return found;
}

function row(overrides: Partial<ProfileEvidenceDiagnosticRow> = {}): ProfileEvidenceDiagnosticRow {
  return {
    playerId: "p1",
    playerName: "Player",
    position: "RB",
    team: "TST",
    sleeperId: "p1",
    gsisId: "00-TEST",
    blackbirdRank: 10,
    draftSuggestionRank: 8,
    recommendationScore: 75,
    valueScore: 72,
    projection: { floor: 140, median: 200, ceiling: 260 },
    profileAvailable: true,
    profileMatchedBy: "sleeper_id",
    profileDuplicateKey: null,
    profileMatchConfidence: "strong",
    scoringSource: "draft_room",
    profileMetrics: metrics(),
    positiveSignals: ["Strong profile identity match", "14 game historical sample"],
    cautionSignals: [],
    badges: ["league-scored", "sample", "consistent", "available"],
    profileEvidenceScore: 45,
    severity: "strong_support",
    classification: "support",
    classificationReason: "Test row",
    scoringNotes: [],
    ...overrides,
  };
}

function metrics(overrides: Partial<ProfileEvidenceDiagnosticRow["profileMetrics"]> = {}): ProfileEvidenceDiagnosticRow["profileMetrics"] {
  return {
    games: 14,
    ppg: 18,
    floor: 9,
    median: 16,
    ceiling: 28,
    consistencyScore: 86,
    spikeScore: 74,
    availabilityScore: 95,
    ...overrides,
  };
}
