import { describe, expect, it } from "vitest";

import {
  buildPreDraftStrategy,
  validateStrategyLanguage,
  type PreDraftStrategyInput,
} from "./pre-draft-strategy";
import type { H10WarRoomCompactRecommendation } from "./war-room-recommendation-validation";

describe("H11 pre-draft strategy", () => {
  it("elevates QB priority for Superflex rooms", () => {
    const strategy = buildPreDraftStrategy(input({ room: { isSuperflex: true }, rosterSlots: ["QB", "SUPER_FLEX", "RB", "WR", "TE", "BN"] }));

    expect(strategy.positionalPriorityMap.QB.score).toBeGreaterThanOrEqual(88);
    expect(strategy.positionalPriorityMap.QB.priority).toBe("elite");
    expect(strategy.positionalPriorityMap.QB.reasons.join(" ")).toContain("Superflex");
  });

  it("detects TE premium tier sensitivity", () => {
    const strategy = buildPreDraftStrategy(input({
      room: { isTEPremium: true },
      rosterSlots: ["QB", "RB", "WR", "TE", "BN"],
      scoringSettings: { rec: 1, bonus_rec_te: 0.5 },
    }));

    expect(strategy.positionalPriorityMap.TE.priority).toMatch(/high|elite/);
    expect(strategy.scoringEmphasis.some((signal) => signal.position === "TE" && signal.reason.includes("TE premium"))).toBe(true);
  });

  it("adds IDP positional planning", () => {
    const strategy = buildPreDraftStrategy(input({
      room: { hasIDP: true, positions_present: ["DL", "LB", "DB"] },
      rosterSlots: ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "IDP"],
    }));

    expect(strategy.specialPositionGuidance.some((row) => row.position === "DL/LB/DB")).toBe(true);
    expect(strategy.positionalPriorityMap.LB.score).toBeGreaterThanOrEqual(60);
  });

  it("keeps K and DST in low-priority timing", () => {
    const strategy = buildPreDraftStrategy(input({
      room: { hasKicker: true, hasTeamDefense: true, positions_present: ["K", "DEF"] },
      rosterSlots: ["QB", "RB", "WR", "TE", "K", "DEF"],
    }));

    expect(strategy.positionalPriorityMap.K.priority).toBe("low");
    expect(strategy.positionalPriorityMap.DEF.priority).toBe("low");
    expect(strategy.doNotForcePositions.map((row) => row.position)).toEqual(["DEF", "K"]);
  });

  it("detects turn-slot behavior", () => {
    const strategy = buildPreDraftStrategy(input({ draftSlot: 12, teamCount: 12 }));

    expect(strategy.draftSlotStrategy.archetype).toBe("turn");
    expect(strategy.draftSlotStrategy.draftSlotBand).toBe("late");
    expect(strategy.draftSlotStrategy.isTurnPick).toBe(true);
    expect(strategy.draftSlotStrategy.expectedLongWaitPicks).toBe(22);
    expect(strategy.draftSlotStrategy.projectedUserPicks.slice(0, 3).map((pick) => pick.overallPick)).toEqual([12, 13, 36]);
    expect(strategy.draftSlotStrategy.timingSignals.join(" ")).toContain("paired-position planning");
  });

  it("adds slot-specific round windows for early and middle slots", () => {
    const early = buildPreDraftStrategy(input({ draftSlot: 1, teamCount: 12, rounds: 16 }));
    const middle = buildPreDraftStrategy(input({ draftSlot: 6, teamCount: 12, rounds: 16 }));

    expect(early.draftSlotStrategy.slotStrategySummary).toContain("anchor start");
    expect(early.draftSlotStrategy.roundPickWindows[0].picks.slice(0, 4)).toEqual([1, 24, 25, 48]);
    expect(middle.draftSlotStrategy.slotStrategySummary).toContain("preserve flexibility");
    expect(middle.draftSlotStrategy.roundWindowPlanBySlot.some((window) => window.window === "K/DST timing window")).toBe(true);
  });

  it("uses H10 wait position detection", () => {
    const strategy = buildPreDraftStrategy(input({
      recommendations: [
        rec({ position: "WR", needTimingAction: "wait_one_turn", waitPlanBacked: true, waitPlanTargetCount: 3 }),
      ],
    }));

    expect(strategy.waitPositions).toEqual([
      { position: "WR", confidence: "backed by wait targets", reason: "WR has H10 wait target support in this planning pool.", targetCount: 3 },
    ]);
    expect(strategy.doNotForcePositions.some((row) => row.position === "WR")).toBe(true);
  });

  it("generates do-not-force guidance from high opportunity cost", () => {
    const strategy = buildPreDraftStrategy(input({
      recommendations: [rec({ position: "RB", opportunityCost: "high" })],
    }));

    expect(strategy.doNotForcePositions).toContainEqual({
      position: "RB",
      reason: "RB has high opportunity cost versus the board in at least one H10 row.",
    });
  });

  it("generates contingency plans from tier risk", () => {
    const strategy = buildPreDraftStrategy(input({
      recommendations: [rec({ position: "QB", tierDropRisk: "high", scoreComponents: { tierCliff: 18 } })],
    }));

    expect(strategy.tierCliffWatchlist[0]).toMatchObject({ position: "QB", risk: "high" });
    expect(strategy.contingencyPlans.some((plan) => plan.trigger.includes("QB tier"))).toBe(true);
  });

  it("builds detailed round windows and contingency triggers without command language", () => {
    const turn = buildPreDraftStrategy(input({
      room: { isSuperflex: true, isTEPremium: true, hasIDP: true, hasKicker: true, hasTeamDefense: true, positions_present: ["QB", "TE", "DL", "LB", "DB", "K", "DEF"] },
      rosterSlots: ["QB", "SUPER_FLEX", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DEF", "BN"],
      draftSlot: 12,
      teamCount: 12,
      rounds: 16,
      recommendations: [
        rec({ position: "QB", tierDropRisk: "high", scoreComponents: { tierCliff: 18 }, survivalConfidence: "low", waitRisk: "high" }),
        rec({ position: "TE", h10: { marketValueSignal: "above_market" }, scoreComponents: { marketValue: 10 } }),
      ],
    }));

    expect(turn.roundWindowPlanDetailed.length).toBeGreaterThan(3);
    expect(turn.roundWindowContingencies.length).toBeGreaterThan(0);
    expect(turn.roundWindowAvoids.some((row) => row.positions.includes("K") || row.positions.includes("DEF"))).toBe(true);
    expect(turn.contingencyTriggers.map((trigger) => trigger.id)).toEqual(expect.arrayContaining([
      "qb-tier-superflex-pivot",
      "te-premium-value-fall",
      "special-position-late-caution",
      "idp-confidence-caution",
      "turn-paired-position",
    ]));
    expect(validateStrategyLanguage(turn)).toEqual([]);
  });

  it("makes middle-slot contingency guidance differ from turn-slot guidance", () => {
    const middle = buildPreDraftStrategy(input({ draftSlot: 6, teamCount: 12, rounds: 16 }));
    const turn = buildPreDraftStrategy(input({ draftSlot: 12, teamCount: 12, rounds: 16 }));

    expect(middle.contingencyTriggers.some((trigger) => trigger.id === "middle-slot-flexibility")).toBe(true);
    expect(turn.contingencyTriggers.some((trigger) => trigger.id === "turn-paired-position")).toBe(true);
  });

  it("prevents banned strategy language", () => {
    const strategy = buildPreDraftStrategy(input({
      room: { isSuperflex: true, hasKicker: true, hasTeamDefense: true },
      recommendations: [rec({ position: "QB", tierDropRisk: "high", h10: { marketValueSignal: "above_market" } })],
    }));

    expect(validateStrategyLanguage(strategy)).toEqual([]);
    expect(validateStrategyLanguage({ text: "must draft" })).toEqual(["Banned strategy language emitted: must draft"]);
  });

  it("is deterministic for identical inputs", () => {
    const strategyInput = input({
      room: { isSuperflex: true, hasIDP: true, positions_present: ["QB", "DL", "LB", "DB"] },
      draftSlot: 3,
      teamCount: 12,
      recommendations: [
        rec({ displayName: "Alpha QB", position: "QB", tierDropRisk: "high", recommendationRank: 1 }),
        rec({ displayName: "Beta WR", position: "WR", h10: { marketValueSignal: "above_market" }, recommendationRank: 2 }),
      ],
    });

    expect(buildPreDraftStrategy(strategyInput)).toEqual(buildPreDraftStrategy(strategyInput));
  });
});

function input(overrides: {
  room?: Partial<PreDraftStrategyInput["room"]>;
  rosterSlots?: string[] | null;
  scoringSettings?: PreDraftStrategyInput["scoringSettings"];
  draftSlot?: number | null;
  teamCount?: number | null;
  rounds?: number | null;
  recommendations?: H10WarRoomCompactRecommendation[];
} = {}): PreDraftStrategyInput {
  return {
    room: {
      draftRoomId: "draft-room-1",
      leagueId: "league-1",
      leagueName: "Test League",
      season: "2026",
      positions_present: ["QB", "RB", "WR", "TE"],
      hasIDP: false,
      hasKicker: false,
      hasTeamDefense: false,
      isSuperflex: false,
      is2QB: false,
      isTEPremium: false,
      benchDepth: 6,
      currentPickKnown: true,
      picksUntilMyNextPickKnown: true,
      remaining_player_count: 20,
      ...overrides.room,
    },
    roomResult: {
      formats: [],
      rowsByPosition: {},
      contextLimitations: [],
      topRecommendations: overrides.recommendations ?? [],
      watchlistExamples: [],
    },
    rosterSlots: overrides.rosterSlots ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN"],
    scoringSettings: overrides.scoringSettings ?? null,
    draftSlot: overrides.draftSlot ?? null,
    teamCount: overrides.teamCount ?? null,
    rounds: overrides.rounds ?? null,
  };
}

type RecommendationOverrides = Omit<Partial<H10WarRoomCompactRecommendation>, "scoreComponents" | "h10"> & {
  scoreComponents?: Partial<H10WarRoomCompactRecommendation["scoreComponents"]>;
  h10?: Partial<H10WarRoomCompactRecommendation["h10"]>;
};

function rec(overrides: RecommendationOverrides = {}): H10WarRoomCompactRecommendation {
  const { scoreComponents: scoreComponentOverrides, h10: h10Overrides, ...rowOverrides } = overrides;
  const scoreComponents = Object.assign(
    {
      leagueValue: 10,
      rosterNeed: 10,
      scarcity: 5,
      tierCliff: 0,
      marketValue: 5,
      availabilityRisk: 1,
      needTiming: 0,
      confidencePenalty: 0,
      formatPenalty: 0,
    },
    scoreComponentOverrides
  ) as H10WarRoomCompactRecommendation["scoreComponents"];
  const h10 = Object.assign(
    {
      medianPoints: 10,
      pointsAboveReplacement: 4,
      riskAdjustedValue: 4,
      tier: 2,
      marketValueSignal: null,
      confidenceLabel: "medium",
      valueReadiness: "READY",
    },
    h10Overrides
  ) as H10WarRoomCompactRecommendation["h10"];

  return {
    recommendationRank: 1,
    displayName: "Player",
    position: "RB",
    team: "TST",
    recommendationTier: "watchlist",
    recommendationScore: 60,
    status: "recommendable",
    primaryReason: "Test",
    explanationFragments: [],
    warningCodes: [],
    reasonCodes: [],
    scoreComponents,
    h10,
    draftContext: {
      currentRound: 1,
      currentPick: 1,
      picksUntilNextUserPick: 10,
      positionNeedLevel: null,
      starterSlotNeed: false,
      benchDepthNeed: false,
      tierDropBeforeNextPick: null,
    },
    rosterNeedStatus: "filled",
    needUrgency: "low",
    futureAvailability: "likely_available_next_pick",
    tierDropRisk: "low",
    opportunityCost: "low",
    needTimingAction: "monitor",
    needTimingReasons: [],
    survivalConfidence: "medium",
    survivalConfidenceScore: 50,
    comparableOptionsNow: 3,
    comparableOptionsLikelyNextPick: 2,
    comparableOptionsLikelyNextTwoPicks: 1,
    waitRisk: "low",
    waitRiskReasons: [],
    needTimingAdjustedBySurvival: false,
    waitPlanTargets: [],
    waitPlanTargetCount: 0,
    waitPlanStrongTargetCount: 0,
    waitPlanSurvivalSummary: "Test",
    waitPlanRisk: "low",
    waitPlanReason: "Test",
    waitPlanBacked: false,
    waitPlanFallbackAction: null,
    needTimingAdjustedByWaitPlan: false,
    ...rowOverrides,
  };
}
