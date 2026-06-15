import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildNeedTimingDiagnostic } from "./need-timing-intelligence";
import { buildWarRoomRecommendations } from "./war-room-recommendations";

describe("need timing intelligence", () => {
  it("fills an open starter DL need when the tier is unlikely to survive", () => {
    const result = timing({
      position: "DL",
      rosterSlots: ["DL", "LB", "DB", "BN"],
      positionCounts: { DL: 0 },
      players: [player("dl1", "DL", 21), player("wr1", "WR", 24)],
      overlays: [overlay("dl1", "DL", 40, 1), overlay("wr1", "WR", 42, 1)],
      picksUntilMyNextPick: 12,
    });

    expect(result.rosterNeedStatus).toBe("starter_need_open");
    expect(result.needUrgency).toBe("critical");
    expect(result.futureAvailability).toBe("unlikely_available_next_pick");
    expect(result.tierDropRisk).toBe("high");
    expect(result.needTimingAction).toBe("fill_now");
    expect(result.needTimingAdjustedBySurvival).toBe(false);
  });

  it("converts weak wait evidence to monitor instead of optimistic wait_one_turn", () => {
    const result = timing({
      position: "WR",
      rosterSlots: ["WR", "WR", "FLEX", "BN"],
      positionCounts: { WR: 1 },
      players: [player("wr1", "WR", 55), player("wr2", "WR", 30), player("rb1", "RB", 20)],
      overlays: [overlay("wr1", "WR", 20, 2), overlay("wr2", "WR", 18, 2), overlay("rb1", "RB", 50, 1)],
      picksUntilMyNextPick: 12,
    });

    expect(result.survivalConfidence).toBe("low");
    expect(result.waitRisk).toMatch(/high|severe/);
    expect(result.comparableOptionsLikelyNextPick).toBe(0);
    expect(result.needTimingAction).not.toBe("wait_one_turn");
  });

  it("waits one turn when a DL need exists but comparable options should remain", () => {
    const result = timing({
      position: "DL",
      rosterSlots: ["DL", "LB", "DB", "BN"],
      positionCounts: { DL: 0 },
      players: [player("dl1", "DL", 46), player("dl2", "DL", 50), player("dl3", "DL", 54), player("dl4", "DL", 58), player("wr1", "WR", 18)],
      overlays: [overlay("dl1", "DL", 28, 1), overlay("dl2", "DL", 27, 1), overlay("dl3", "DL", 26, 1), overlay("dl4", "DL", 25, 1), overlay("wr1", "WR", 50, 1)],
      picksUntilMyNextPick: 12,
    });

    expect(result.futureAvailability).toBe("likely_available_next_pick");
    expect(result.tierDropRisk).toBe("low");
    expect(result.opportunityCost).toBe("high");
    expect(result.survivalConfidence).not.toBe("low");
    expect(result.comparableOptionsLikelyNextPick).toBeGreaterThanOrEqual(2);
    expect(result.needTimingAction).toBe("wait_one_turn");
  });

  it("does not let an open need override elite value with later comparable options", () => {
    const recommendations = buildWarRoomRecommendations({
      leagueId: "league",
      draftRoomId: "draft",
      remainingPlayers: [player("dl1", "DL", 48), player("wr1", "WR", 14), player("dl2", "DL", 52), player("dl3", "DL", 56)],
      h10ValueOverlay: [overlay("dl1", "DL", 25, 1), overlay("wr1", "WR", 60, 1), overlay("dl2", "DL", 24, 1), overlay("dl3", "DL", 23, 1)],
      rosterRequirements: buildNormalizedRosterRequirements(["DL", "LB", "DB", "WR", "BN"]),
      positionCounts: { DL: 0, WR: 0 },
      currentPickNumber: 24,
      currentRound: 3,
      picksUntilMyNextPick: 12,
    });

    const dl = recommendations.rows.find((row) => row.entityId === "dl1")!;
    expect(recommendations.rows[0].entityId).toBe("wr1");
    expect(dl.needTimingAction).not.toBe("fill_now");
  });

  it("lets critical need override modest value", () => {
    const recommendations = buildWarRoomRecommendations({
      leagueId: "league",
      draftRoomId: "draft",
      remainingPlayers: [player("lb1", "LB", 25), player("wr1", "WR", 26)],
      h10ValueOverlay: [overlay("lb1", "LB", 34, 1), overlay("wr1", "WR", 28, 1)],
      rosterRequirements: buildNormalizedRosterRequirements(["LB", "LB", "DB", "BN"]),
      positionCounts: { LB: 0 },
      currentPickNumber: 24,
      currentRound: 10,
      picksUntilMyNextPick: 12,
    });

    expect(recommendations.rows[0].entityId).toBe("lb1");
    expect(recommendations.rows[0].needTimingAction).toBe("fill_now");
    expect(recommendations.rows[0].waitRisk).toMatch(/high|severe/);
  });

  it("blocks waiting when tier cliff risk is high", () => {
    const result = timing({
      position: "TE",
      rosterSlots: ["TE", "BN"],
      positionCounts: { TE: 0 },
      players: [player("te1", "TE", 40), player("te2", "TE", 42), player("wr1", "WR", 18)],
      overlays: [overlay("te1", "TE", 35, 1), overlay("te2", "TE", 20, 3), overlay("wr1", "WR", 50, 1)],
      picksUntilMyNextPick: 12,
    });

    expect(result.tierDropRisk).toBe("high");
    expect(result.needTimingAction).not.toMatch(/^wait_/);
  });

  it("allows elite value at a filled position to remain monitored instead of suppressed", () => {
    const result = timing({
      position: "RB",
      rosterSlots: ["RB", "RB", "WR", "WR", "FLEX", "BN"],
      positionCounts: { RB: 4 },
      players: [player("rb1", "RB", 22)],
      overlays: [overlay("rb1", "RB", 65, 1)],
    });

    expect(result.rosterNeedStatus).toBe("filled");
    expect(result.needTimingAction).toBe("monitor");
  });

  it("keeps bench depth need low urgency unless timing pressure is strong", () => {
    const result = timing({
      position: "WR",
      rosterSlots: ["WR", "WR", "FLEX", "BN", "BN"],
      positionCounts: { WR: 3 },
      players: [player("wr1", "WR", 54), player("wr2", "WR", 58), player("wr3", "WR", 62)],
      overlays: [overlay("wr1", "WR", 20, 1), overlay("wr2", "WR", 19, 1), overlay("wr3", "WR", 18, 1)],
    });

    expect(result.rosterNeedStatus).toBe("bench_depth_need");
    expect(result.needUrgency).toBe("low");
    expect(result.needTimingAction).not.toBe("fill_now");
  });

  it("normalizes IDP subpositions without collapsing DL/LB/DB together", () => {
    const dl = timing({ position: "DE", rosterSlots: ["DL", "LB", "DB"], positionCounts: { DL: 0 }, players: [player("de1", "DE", 18)], overlays: [overlay("de1", "DE", 35, 1)] });
    const db = timing({ position: "SS", rosterSlots: ["DL", "LB", "DB"], positionCounts: { DB: 0 }, players: [player("ss1", "SS", 18)], overlays: [overlay("ss1", "SS", 35, 1)] });

    expect(dl.rosterNeedStatus).toBe("starter_need_open");
    expect(db.rosterNeedStatus).toBe("starter_need_open");
  });

  it("does not blindly fill K or DST early", () => {
    const kicker = timing({ position: "K", rosterSlots: ["K", "DEF", "BN"], positionCounts: { K: 0 }, currentRound: 5, players: [player("k1", "K", 30)], overlays: [overlay("k1", "K", 22, 1)] });
    const dst = timing({ position: "DEF", rosterSlots: ["K", "DEF", "BN"], positionCounts: { DEF: 0 }, currentRound: 5, players: [player("d1", "DEF", 30)], overlays: [overlay("d1", "DEF", 22, 1)] });

    expect(kicker.needUrgency).toBe("low");
    expect(kicker.needTimingAction).toBe("wait_multiple_turns");
    expect(kicker.waitRiskReasons.join(" ")).toContain("special-position");
    expect(dst.needTimingAction).toBe("wait_multiple_turns");
  });

  it("keeps low-confidence IDP from overstating weak survival", () => {
    const result = timing({
      position: "LB",
      rosterSlots: ["LB", "IDP_FLEX", "BN"],
      positionCounts: { LB: 0 },
      players: [player("lb1", "LB", 55), player("lb2", "LB", 30)],
      overlays: [
        overlay("lb1", "LB", 42, 1, { confidenceLabel: "low", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] }),
        overlay("lb2", "LB", 22, 2),
      ],
      picksUntilMyNextPick: 12,
    });

    expect(result.survivalConfidence).toBe("low");
    expect(result.waitRiskReasons.join(" ")).toContain("confidence is low");
    expect(result.needTimingAction).not.toBe("wait_one_turn");
  });
});

type TimingOverrides = {
  position: string;
  rosterSlots?: string[];
  positionCounts?: Record<string, number>;
  currentPickNumber?: number;
  currentRound?: number;
  picksUntilMyNextPick?: number;
  players?: DraftTargetScorePlayer[];
  overlays?: WarRoomValueOverlayRow[];
};

function timing(overrides: TimingOverrides) {
  const players = overrides.players ?? [player("p1", overrides.position, 40)];
  const overlays = overrides.overlays ?? [overlay("p1", overrides.position, 25, 1)];
  return buildNeedTimingDiagnostic({
    candidate: players[0],
    overlay: overlays[0],
    remainingPlayers: players,
    h10ValueOverlay: overlays,
    rosterRequirements: buildNormalizedRosterRequirements(overrides.rosterSlots ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"]),
    positionCounts: overrides.positionCounts ?? {},
    currentPickNumber: overrides.currentPickNumber ?? 24,
    currentRound: overrides.currentRound ?? 3,
    picksUntilMyNextPick: overrides.picksUntilMyNextPick ?? 12,
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
