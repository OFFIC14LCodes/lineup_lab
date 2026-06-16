import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard } from "./blackbird-board";
import type { ScoredDraftTarget } from "./scoring";
import type { WarRoomValueOverlayRow } from "./h10-war-room-overlay";
import {
  applyLivePlanFitToBoardRows,
  buildLivePlanStatus,
  findBannedLivePlanLanguage,
  type LivePlanStrategy,
} from "./live-plan-status";

describe("H11.5 live plan status", () => {
  it("builds pre-draft status without mutation", () => {
    const input = baseInput({ currentPickNumber: 1, currentRound: 1, draftedPlayerIds: [] });
    const before = JSON.stringify(input);
    const status = buildLivePlanStatus(input);

    expect(status.overallStatus).toBe("pre_draft");
    expect(status.statusLabel).toBe("Pre Draft");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("detects contingency-active and tier-risk scenarios", () => {
    const status = buildLivePlanStatus(baseInput({
      currentPickNumber: 22,
      currentRound: 2,
      positionCounts: { QB: 0, RB: 1, WR: 1, TE: 0 },
      boardRows: boardRows([
        player({ player_name: "QB Tier", matched_player_id: "qb", position: "QB", projected_points: 330 }),
      ], [
        overlay({ entityId: "qb", displayName: "QB Tier", position: "QB", medianPoints: 330, pointsAboveReplacement: 60, riskLabel: "high" }),
      ]),
    }));

    expect(status.overallStatus).toBe("contingency_active");
    expect(status.triggeredContingencies.some((item) => item.contingencyId === "qb-tier-superflex-pivot")).toBe(true);
    expect(status.tierRiskStatus.some((item) => item.position === "QB" && item.riskLevel === "high")).toBe(true);
  });

  it("separates supported and weakening wait plans", () => {
    const supported = buildLivePlanStatus(baseInput({
      boardRows: boardRows([player({ position: "RB" })], [overlay({ position: "RB", marketRankDelta: null })]),
    }));
    const weakening = buildLivePlanStatus(baseInput({
      strategy: { ...strategy(), waitPositions: [{ position: "WR", confidence: "monitor only", reason: "WR can wait.", targetCount: 0 }] },
      boardRows: boardRows([player({ position: "WR" })], [overlay({ position: "WR", displayName: "WR", marketRankDelta: null })]),
    }));

    expect(supported.waitPlanStatus.find((item) => item.position === "RB")?.status).toBe("supported");
    expect(weakening.waitPlanStatus.find((item) => item.position === "WR")?.status).toBe("weakening");
  });

  it("surfaces contextual value falls and preserves contextual Blackbird rank", () => {
    const rows = boardRows([
      player({ player_name: "Late Value", matched_player_id: "late", adp: 5, projected_points: 260 }),
      player({ player_name: "Lower Value", matched_player_id: "low", adp: 1, projected_points: 190 }),
    ], [
      overlay({ entityId: "late", displayName: "Late Value", medianPoints: 260, pointsAboveReplacement: 50 }),
      overlay({ entityId: "low", displayName: "Lower Value", medianPoints: 190, pointsAboveReplacement: 5 }),
    ]);
    const status = buildLivePlanStatus(baseInput({ currentPickNumber: 30, boardRows: rows }));
    const fitted = applyLivePlanFitToBoardRows(rows, status);

    expect(rows[0].playerName).toBe("Late Value");
    expect(status.valueFallStatus[0]).toMatchObject({ playerName: "Late Value", signal: "unexpected_contextual_value" });
    expect(fitted[0].planFit).toBe("value_detour");
    expect(fitted[0].blackbirdBoardRank).toBe(1);
  });

  it("handles Superflex, TE premium, IDP, and K/DST caveats", () => {
    const status = buildLivePlanStatus(baseInput({
      currentRound: 4,
      boardRows: boardRows([
        player({ matched_player_id: "te", player_name: "TE", position: "TE" }),
        player({ matched_player_id: "lb", player_name: "LB", position: "LB" }),
        player({ matched_player_id: "k", player_name: "K", position: "K" }),
      ], [
        overlay({ entityId: "te", displayName: "TE", position: "TE" }),
        overlay({ entityId: "lb", displayName: "LB", position: "LB", confidenceLabel: "low" }),
        overlay({ entityId: "k", displayName: "K", position: "K" }),
      ]),
    }));
    const fitted = applyLivePlanFitToBoardRows(statusToRows(status), status);

    expect(status.positionPlanStatus.find((row) => row.position === "QB")?.targetCount).toBe(2);
    expect(status.positionPlanStatus.some((row) => row.position === "TE")).toBe(true);
    expect(status.positionPlanStatus.some((row) => row.position === "LB")).toBe(true);
    expect(fitted.find((row) => row.position === "K")?.planFit).toBe("avoid_forcing");
  });

  it("does not emit banned live-plan language", () => {
    const status = buildLivePlanStatus(baseInput());
    expect(findBannedLivePlanLanguage(JSON.stringify(status))).toEqual([]);
    expect(findBannedLivePlanLanguage("must draft")).toEqual(["must draft"]);
  });
});

function baseInput(overrides: Partial<Parameters<typeof buildLivePlanStatus>[0]> = {}): Parameters<typeof buildLivePlanStatus>[0] {
  return {
    draftRoomId: "room",
    currentPickNumber: 18,
    currentRound: 2,
    myDraftSlot: 7,
    teamCount: 12,
    picksUntilMyTurn: 8,
    positionCounts: { QB: 0, RB: 1, WR: 1, TE: 0, LB: 0, K: 0 },
    strategy: strategy(),
    boardRows: boardRows([player()], [overlay()]),
    draftedPlayerIds: ["drafted"],
    ...overrides,
  };
}

function strategy(): LivePlanStrategy {
  return {
    leagueSummary: {
      superflexOr2Qb: true,
      tePremium: true,
      idp: true,
      kicker: true,
      teamDefense: true,
      flexStructure: ["1 superflex"],
      startingRequirements: { QB: 1, RB: 2, WR: 2, TE: 1, LB: 1, K: 1, DEF: 1 },
    },
    roundWindowPlanDetailed: [
      { window: "Early core", rounds: "1-3", primaryPositions: ["QB", "RB", "WR", "TE"], avoidForcingPositions: ["K", "DEF"], likelyValuePockets: ["RB"], tierCliffRisks: ["QB"], contingencyTriggers: ["QB tier contingency"], fallbackPath: "Monitor value pockets.", guidance: "Monitor core positions." },
      { window: "IDP window", rounds: "6-10", primaryPositions: ["LB", "DL", "DB"], avoidForcingPositions: [], likelyValuePockets: [], tierCliffRisks: [], contingencyTriggers: ["IDP confidence contingency"], fallbackPath: "Monitor IDP confidence.", guidance: "Monitor IDP." },
    ],
    contingencyTriggers: [
      { id: "qb-tier-superflex-pivot", label: "QB tier contingency", appliesToRounds: [1, 2, 3], appliesToPositions: ["QB"], triggerConditionSummary: "QB tier risk is active.", suggestedAdjustment: "Monitor QB tier against contextual value.", riskLevel: "high", confidence: "medium", reasons: [] },
    ],
    doNotForcePositions: [{ position: "K", reason: "Kicker belongs late." }, { position: "DEF", reason: "DST belongs late." }],
    waitPositions: [{ position: "RB", confidence: "backed by wait targets", reason: "RB can wait.", targetCount: 2 }],
    roundWindowTierRisks: [{ window: "Early core", positions: ["QB"], riskLevel: "high", reason: "QB tier risk." }],
  };
}

function statusToRows(status: ReturnType<typeof buildLivePlanStatus>) {
  return boardRows([
    player({ matched_player_id: "te", player_name: "TE", position: "TE" }),
    player({ matched_player_id: "lb", player_name: "LB", position: "LB" }),
    player({ matched_player_id: "k", player_name: "K", position: "K" }),
  ], [
    overlay({ entityId: "te", displayName: "TE", position: "TE" }),
    overlay({ entityId: "lb", displayName: "LB", position: "LB", confidenceLabel: "low" }),
    overlay({ entityId: "k", displayName: "K", position: "K" }),
  ]).map((row) => ({ ...row, currentRound: status.currentRound }));
}

function boardRows(players: ScoredDraftTarget[], overlays: WarRoomValueOverlayRow[]) {
  return buildBlackbirdBoard({
    players,
    overlays,
    leagueContext: { isSuperflex: true, tePremium: 1, hasIDP: true, hasKicker: true, hasTeamDefense: true, rosterPositions: ["QB", "OP", "RB", "WR", "TE", "LB", "K", "DEF"], scoringSettings: { rec: 1 } },
  }).rows;
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 25,
    years_exp: 3,
    rank: 10,
    adp: 12,
    projected_points: 220,
    dynasty_value: 65,
    best_ball_value: 60,
    superflex_value: 55,
    te_premium_value: 55,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    floorPoints: 190,
    ceilingPoints: 250,
    pointsAboveReplacement: 20,
    pointsAboveStarterCutline: 10,
    riskAdjustedValue: 18,
    confidenceAdjustedValue: 16,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: null,
    confidenceLabel: "medium",
    riskLabel: "low",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
  };
}
