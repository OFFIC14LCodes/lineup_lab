import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildWarRoomRecommendations, type BuildWarRoomRecommendationsInput } from "./war-room-recommendations";
import { auditRecommendationRow, buildRecommendationQualityCalibrationArtifact, compareRecommendationStability } from "./recommendation-quality-calibration";

describe("recommendation quality calibration", () => {
  it("keeps an elite value faller ahead of moderate roster need", () => {
    const result = build({
      players: [player("wr1", "WR", 14), player("dl1", "DL", 38), player("dl2", "DL", 44), player("dl3", "DL", 50)],
      overlays: [overlay("wr1", "WR", 62, 1), overlay("dl1", "DL", 28, 1), overlay("dl2", "DL", 26, 1), overlay("dl3", "DL", 24, 1)],
      rosterSlots: ["WR", "DL", "LB", "DB", "BN"],
      positionCounts: { WR: 0, DL: 0 },
    });

    expect(result.rows[0].entityId).toBe("wr1");
    expect(result.rows.find((row) => row.entityId === "dl1")?.needTimingAction).not.toBe("fill_now");
  });

  it("lets critical starter need beat a small value edge", () => {
    const result = build({
      players: [player("lb1", "LB", 22), player("wr1", "WR", 24)],
      overlays: [overlay("lb1", "LB", 36, 1), overlay("wr1", "WR", 37, 1)],
      rosterSlots: ["LB", "LB", "DB", "BN"],
      positionCounts: { LB: 0 },
      currentRound: 10,
    });

    expect(result.rows[0].entityId).toBe("lb1");
    expect(result.rows[0].needTimingAction).toBe("fill_now");
  });

  it("acknowledges a need while waiting when comparable options should remain", () => {
    const result = build({
      players: [player("dl1", "DL", 48), player("wr1", "WR", 15), player("dl2", "DL", 54), player("dl3", "DL", 60), player("dl4", "DL", 66)],
      overlays: [overlay("dl1", "DL", 28, 1), overlay("wr1", "WR", 54, 1), overlay("dl2", "DL", 27, 1), overlay("dl3", "DL", 26, 1), overlay("dl4", "DL", 25, 1)],
      rosterSlots: ["DL", "LB", "DB", "WR", "BN"],
      positionCounts: { DL: 0, WR: 0 },
    });
    const dl = result.rows.find((row) => row.entityId === "dl1")!;

    expect(result.rows[0].entityId).toBe("wr1");
    expect(dl.needTimingAction).toBe("wait_one_turn");
    expect([...dl.explanationFragments, ...dl.needTimingReasons].join(" ")).toMatch(/need is acknowledged|likely to be available/i);
  });

  it("does not force K or DST early just because the slot is empty", () => {
    const result = build({
      players: [player("k1", "K", 40), player("dst1", "DEF", 42), player("rb1", "RB", 28)],
      overlays: [overlay("k1", "K", 35, 1), overlay("dst1", "DEF", 35, 1, { entityType: "TEAM_DEFENSE", overlayStatus: "dst_dry_run", valueReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY" }), overlay("rb1", "RB", 32, 1)],
      rosterSlots: ["RB", "K", "DEF", "BN"],
      positionCounts: { K: 0, DEF: 0 },
      currentRound: 5,
    });

    const k = result.rows.find((row) => row.position === "K")!;
    const dst = result.rows.find((row) => row.position === "DEF")!;
    expect(k.needTimingAction).toBe("wait_multiple_turns");
    expect(dst.needTimingAction).toBe("wait_multiple_turns");
    expect([k.recommendationTier, dst.recommendationTier]).not.toContain("priority_target");
  });

  it("keeps low-confidence IDP useful but cautious", () => {
    const result = build({
      players: [player("db1", "DB", 20)],
      overlays: [overlay("db1", "DB", 70, 1, { overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] })],
      rosterSlots: ["DB", "IDP_FLEX", "BN"],
      positionCounts: { DB: 0 },
    });
    const audit = auditRecommendationRow(result.rows[0]);

    expect(result.rows[0].status).toBe("watch_only");
    expect(result.rows[0].recommendationTier).not.toBe("priority_target");
    expect(audit.explanationQuality.hasRiskCaveat).toBe(true);
    expect(audit.guardrailFindings).toEqual([]);
  });

  it("does not automatically suppress a filled position with elite value", () => {
    const result = build({
      players: [player("rb1", "RB", 12), player("lb1", "LB", 28)],
      overlays: [overlay("rb1", "RB", 72, 1), overlay("lb1", "LB", 34, 1)],
      rosterSlots: ["RB", "RB", "FLEX", "LB", "BN"],
      positionCounts: { RB: 4, LB: 0 },
    });

    expect(result.rows[0].entityId).toBe("rb1");
    expect(result.rows[0].needTimingAction).toBe("monitor");
  });

  it("allows a high tier cliff to override a slight raw value edge", () => {
    const result = build({
      players: [player("te1", "TE", 23), player("wr1", "WR", 24), player("wr2", "WR", 30), player("wr3", "WR", 36)],
      overlays: [overlay("te1", "TE", 36, 1), overlay("wr1", "WR", 37, 1), overlay("wr2", "WR", 36, 1), overlay("wr3", "WR", 35, 1)],
      rosterSlots: ["TE", "WR", "WR", "FLEX", "BN"],
      positionCounts: { TE: 0, WR: 1 },
    });

    expect(result.rows[0].entityId).toBe("te1");
    expect(result.rows[0].tierDropRisk).toBe("high");
  });

  it("emits calibration diagnostics without banned language", () => {
    const result = build();
    const artifact = buildRecommendationQualityCalibrationArtifact({
      generatedAt: "2026-06-15T00:00:00.000Z",
      rooms: [{ source: "scenario", draftRoomId: "draft", leagueId: "league", leagueName: "Scenario", rows: result.rows }],
    });

    expect(artifact.aggregate.verdict).toBe("ready");
    expect(artifact.rooms[0].topRecommendationExamples[0].explanationQuality.bannedLanguage).toEqual([]);
    expect(artifact.rooms[0].topRecommendationExamples[0].componentBreakdown).toHaveProperty("projectionValue");
  });

  it("reports rank and score instability across compared states", () => {
    const before = build({
      players: [player("a", "RB", 10), player("b", "WR", 11)],
      overlays: [overlay("a", "RB", 45, 1), overlay("b", "WR", 44, 1)],
    }).rows;
    const after = before.map((row) => row.entityId === "a" ? { ...row, recommendationRank: 8, recommendationScore: row.recommendationScore - 10 } : row);

    expect(compareRecommendationStability({ before, after }).join(" ")).toMatch(/large rank jump|unstable score change/);
  });
});

type BuildOverrides = Partial<BuildWarRoomRecommendationsInput> & {
  rosterSlots?: string[];
  players?: DraftTargetScorePlayer[];
  overlays?: WarRoomValueOverlayRow[];
};

function build(overrides: BuildOverrides = {}) {
  return buildWarRoomRecommendations({
    leagueId: "league",
    draftRoomId: "draft",
    remainingPlayers: overrides.players ?? [player("rb1", "RB", 20), player("wr1", "WR", 24)],
    h10ValueOverlay: overrides.overlays ?? [overlay("rb1", "RB", 40, 1), overlay("wr1", "WR", 35, 1)],
    rosterRequirements: buildNormalizedRosterRequirements(overrides.rosterSlots ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"]),
    positionCounts: overrides.positionCounts ?? {},
    currentPickNumber: overrides.currentPickNumber ?? 24,
    currentRound: overrides.currentRound ?? 3,
    picksUntilMyNextPick: overrides.picksUntilMyNextPick ?? 12,
    draftedPlayerIds: overrides.draftedPlayerIds,
    includeDstDryRun: overrides.includeDstDryRun,
    matchCoverageSummary: overrides.matchCoverageSummary,
    positionNeeds: overrides.positionNeeds,
    topNeeds: overrides.topNeeds,
    myRoster: overrides.myRoster,
    picks: overrides.picks,
  });
}

function player(id: string, position: string, adp: number): DraftTargetScorePlayer {
  return {
    sleeper_player_id: `s-${id}`,
    matched_player_id: id,
    player_name: id,
    position,
    team: "DAL",
    rank: adp,
    adp,
    projected_points: 100,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
  };
}

function overlay(id: string, position: string, value: number, tier: number, overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: id,
    entityType: position === "DEF" ? "TEAM_DEFENSE" : "PLAYER",
    displayName: id,
    team: "DAL",
    position,
    medianPoints: 100,
    pointsAboveReplacement: value,
    pointsAboveStarterCutline: value / 2,
    riskAdjustedValue: value,
    confidenceAdjustedValue: value,
    tier,
    tierLabel: `Tier ${tier}`,
    positionScarcityScore: value,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: 0,
    confidenceLabel: "medium",
    riskLabel: "medium",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
  };
}
