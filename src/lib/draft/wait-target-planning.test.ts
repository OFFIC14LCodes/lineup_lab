import { describe, expect, it } from "vitest";

import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import { buildWaitTargetPlan } from "@/lib/draft/wait-target-planning";

describe("wait target planning", () => {
  it("backs a wait with multiple comparable targets", () => {
    const plan = planFor({
      position: "DL",
      players: [player("dl1", "DL", 30), player("dl2", "DL", 50), player("dl3", "DL", 55), player("dl4", "DL", 60), player("wr1", "WR", 18)],
      overlays: [overlay("dl1", "DL", 35, 1), overlay("dl2", "DL", 33, 1), overlay("dl3", "DL", 31, 1), overlay("dl4", "DL", 30, 1), overlay("wr1", "WR", 55, 1)],
      proposedAction: "wait_one_turn",
    });

    expect(plan.waitPlanBacked).toBe(true);
    expect(plan.waitPlanStrongTargetCount).toBeGreaterThanOrEqual(2);
    expect(plan.waitPlanTargets.map((target) => target.displayName)).toContain("dl2");
  });

  it("blocks waiting when only one weak target remains", () => {
    const plan = planFor({
      position: "LB",
      players: [player("lb1", "LB", 30), player("lb2", "LB", 31)],
      overlays: [overlay("lb1", "LB", 36, 1), overlay("lb2", "LB", 20, 3)],
      tierDropRisk: "high",
      proposedAction: "wait_one_turn",
    });

    expect(plan.waitPlanBacked).toBe(false);
    expect(plan.waitPlanFallbackAction).toBe("fill_now");
    expect(plan.waitPlanRisk).toMatch(/high|severe/);
  });

  it("requires stronger targets for critical needs", () => {
    const plan = planFor({
      position: "TE",
      players: [player("te1", "TE", 30), player("te2", "TE", 50), player("te3", "TE", 52)],
      overlays: [overlay("te1", "TE", 38, 1), overlay("te2", "TE", 30, 2), overlay("te3", "TE", 29, 2)],
      needUrgency: "critical",
      tierDropRisk: "high",
      proposedAction: "wait_one_turn",
    });

    expect(plan.waitPlanBacked).toBe(false);
    expect(plan.waitPlanFallbackAction).toBe("fill_now");
  });

  it("does not back waits across severe tier cliffs", () => {
    const plan = planFor({
      position: "TE",
      players: [player("te1", "TE", 28), player("te2", "TE", 60), player("te3", "TE", 64)],
      overlays: [overlay("te1", "TE", 45, 1), overlay("te2", "TE", 28, 3), overlay("te3", "TE", 26, 3)],
      tierDropRisk: "high",
      proposedAction: "wait_one_turn",
    });

    expect(plan.waitPlanBacked).toBe(false);
    expect(plan.waitPlanTargets).toHaveLength(0);
  });

  it("keeps early K/DST loose and cautious without forcing a pick", () => {
    const plan = planFor({
      position: "K",
      players: [player("k1", "K", 150)],
      overlays: [overlay("k1", "K", 6, 1)],
      currentRound: 6,
      proposedAction: "wait_multiple_turns",
    });

    expect(plan.waitPlanBacked).toBe(true);
    expect(plan.waitPlanFallbackAction).toBeNull();
  });

  it("does not overstate low-confidence IDP targets", () => {
    const plan = planFor({
      position: "LB",
      players: [player("lb1", "LB", 35), player("lb2", "LB", 60), player("lb3", "LB", 64)],
      overlays: [
        overlay("lb1", "LB", 40, 1),
        overlay("lb2", "LB", 38, 1, { confidenceLabel: "low", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] }),
        overlay("lb3", "LB", 37, 1, { confidenceLabel: "low", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] }),
      ],
      proposedAction: "wait_one_turn",
    });

    expect(plan.waitPlanBacked).toBe(false);
    expect(plan.waitPlanTargets).toHaveLength(0);
  });

  it("does not emit banned language", () => {
    const plan = planFor({
      position: "DL",
      players: [player("dl1", "DL", 30), player("dl2", "DL", 50), player("dl3", "DL", 55)],
      overlays: [overlay("dl1", "DL", 35, 1), overlay("dl2", "DL", 34, 1), overlay("dl3", "DL", 33, 1)],
    });

    expect(plan.waitPlanReason.toLowerCase()).not.toMatch(/must draft|guaranteed|best pick|ai advice|lock|can't miss|should draft/);
  });
});

function planFor(input: {
  position: string;
  players: DraftTargetScorePlayer[];
  overlays: WarRoomValueOverlayRow[];
  currentRound?: number;
  proposedAction?: "wait_one_turn" | "wait_multiple_turns";
  needUrgency?: "low" | "medium" | "high" | "critical";
  tierDropRisk?: "low" | "medium" | "high";
}) {
  return buildWaitTargetPlan({
    position: input.position,
    candidate: input.players[0],
    overlay: input.overlays[0],
    remainingPlayers: input.players,
    h10ValueOverlay: input.overlays,
    currentPickNumber: 24,
    picksUntilMyNextPick: 12,
    currentRound: input.currentRound ?? 4,
    needUrgency: input.needUrgency ?? "medium",
    tierDropRisk: input.tierDropRisk ?? "low",
    proposedAction: input.proposedAction ?? "wait_one_turn",
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
    floorPoints: overrides.floorPoints ?? 90,
    ceilingPoints: overrides.ceilingPoints ?? 110,
  };
}
