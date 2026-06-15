import { describe, expect, it } from "vitest";

import {
  buildRecommendationReplayEvaluationArtifact,
  evaluateReplayRoom,
  type ReplayRoomInput,
} from "@/lib/draft/recommendation-replay-evaluation";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

describe("recommendation replay evaluation", () => {
  it("supports wait_one_turn when the candidate or comparable row survives", () => {
    const room = roomWith([
      row({
        displayName: "Early WR",
        position: "WR",
        rank: 1,
        score: 80,
        action: "wait_one_turn",
        picksUntilNext: 1,
        waitPlanBacked: true,
        waitPlanTargets: [{ displayName: "Comparable WR", position: "WR", team: null, projectedValue: 76, adp: 50, tier: 2, survivalEstimate: "likely", usability: "starter_usable", confidence: "strong", reasons: ["close value"] }],
      }),
      row({ displayName: "Comparable WR", position: "WR", rank: 2, score: 76, action: "monitor", picksUntilNext: 1 }),
      row({ displayName: "RB", position: "RB", rank: 3, score: 74, action: "monitor", picksUntilNext: 1 }),
    ]);

    const evaluation = evaluateReplayRoom(room);

    expect(evaluation.cases[0]).toMatchObject({
      displayName: "Early WR",
      survivedToNextPick: false,
      comparableAtNextPick: 1,
      waitRecommendationSupported: true,
      findings: [],
    });
  });

  it("supports wait_multiple_turns against the next two user picks", () => {
    const evaluation = evaluateReplayRoom(roomWith([
      row({ displayName: "Early QB", position: "QB", rank: 1, score: 80, action: "wait_multiple_turns", picksUntilNext: 1 }),
      row({ displayName: "Comparable QB", position: "QB", rank: 3, score: 74, action: "monitor", picksUntilNext: 1 }),
      row({ displayName: "RB", position: "RB", rank: 2, score: 76, action: "monitor", picksUntilNext: 1 }),
      row({ displayName: "WR", position: "WR", rank: 4, score: 72, action: "monitor", picksUntilNext: 1 }),
    ]));

    expect(evaluation.cases[0].survivedToNextTwoPicks).toBe(false);
    expect(evaluation.cases[0].comparableAtNextTwoPicks).toBe(1);
    expect(evaluation.cases[0].waitRecommendationSupported).toBe(true);
    expect(evaluation.cases[0].findings).not.toContain("wait_on_need_failed:no comparable option survived to next pick.");
  });

  it("flags wait_on_need failure when no comparable option survives", () => {
    const evaluation = evaluateReplayRoom(roomWith([
      row({ displayName: "Only TE", position: "TE", rank: 1, score: 82, action: "wait_one_turn", picksUntilNext: 2 }),
      row({ displayName: "RB", position: "RB", rank: 2, score: 77, action: "monitor", picksUntilNext: 2 }),
      row({ displayName: "WR", position: "WR", rank: 3, score: 76, action: "monitor", picksUntilNext: 2 }),
    ]));

    expect(evaluation.cases[0].waitRecommendationSupported).toBe(false);
    expect(evaluation.cases[0].findings).toContain("wait_on_need_failed:no comparable option survived to next pick.");
  });

  it("separates supported and unsupported fill_now calls", () => {
    const supported = evaluateReplayRoom(roomWith([
      row({ displayName: "Only RB", position: "RB", rank: 1, score: 84, action: "fill_now", picksUntilNext: 1 }),
      row({ displayName: "WR", position: "WR", rank: 2, score: 78, action: "monitor", picksUntilNext: 1 }),
    ]));
    const unsupported = evaluateReplayRoom(roomWith([
      row({ displayName: "RB A", position: "RB", rank: 2, score: 78, action: "fill_now", picksUntilNext: 1 }),
      row({ displayName: "WR", position: "WR", rank: 1, score: 82, action: "monitor", picksUntilNext: 1 }),
      row({ displayName: "RB B", position: "RB", rank: 3, score: 76, action: "monitor", picksUntilNext: 1 }),
    ]));

    expect(supported.cases[0].fillNowSupported).toBe(true);
    expect(unsupported.cases.find((item) => item.displayName === "RB A")?.fillNowSupported).toBe(false);
    expect(unsupported.cases.find((item) => item.displayName === "RB A")?.findings).toContain(
      "fill_now_unsupported:candidate or comparable option survived to next pick."
    );
  });

  it("detects tier cliff support from post-depletion comparable depth", () => {
    const evaluation = evaluateReplayRoom(roomWith([
      row({ displayName: "Tier Edge WR", position: "WR", rank: 1, score: 83, action: "fill_now", tierDropRisk: "high", tier: 1, picksUntilNext: 1 }),
      row({ displayName: "Same Tier WR", position: "WR", rank: 2, score: 80, action: "monitor", tier: 1, picksUntilNext: 1 }),
      row({ displayName: "Lower WR", position: "WR", rank: 4, score: 68, action: "monitor", tier: 2, picksUntilNext: 1 }),
      row({ displayName: "RB", position: "RB", rank: 3, score: 74, action: "monitor", picksUntilNext: 1 }),
    ]));

    expect(evaluation.cases[0].tierCliffSupported).toBe(true);
  });

  it("detects special position and low-confidence overpushes", () => {
    const evaluation = evaluateReplayRoom(roomWith([
      row({ displayName: "Early K", position: "K", rank: 1, score: 88, tierName: "strong_target", action: "fill_now", round: 9 }),
      row({ displayName: "Low IDP", position: "LB", rank: 2, score: 86, tierName: "priority_target", action: "fill_now", confidence: "low" }),
    ]));

    expect(evaluation.cases[0].findings).toContain("special_teams_early_push:K/DST surfaced aggressively before late rounds.");
    expect(evaluation.cases[1].findings).toContain("idp_low_confidence_overpush:IDP row overstated despite low confidence.");
  });

  it("fails safety gates when recommendation language is authoritative", () => {
    const artifact = buildRecommendationReplayEvaluationArtifact({
      generatedAt: "2026-06-15T00:00:00.000Z",
      rooms: [roomWith([row({ displayName: "Unsafe WR", position: "WR", primaryReason: "You should draft this player." })])],
    });

    expect(artifact.aggregate.safety_finding_count).toBe(1);
    expect(artifact.aggregate.verdict).toBe("failed_safety_gates");
  });

  it("blocks when no replay rows are available and reports quality risks otherwise", () => {
    const blocked = buildRecommendationReplayEvaluationArtifact({
      generatedAt: "2026-06-15T00:00:00.000Z",
      rooms: [roomWith([])],
    });
    const qualityRisk = buildRecommendationReplayEvaluationArtifact({
      generatedAt: "2026-06-15T00:00:00.000Z",
      rooms: [roomWith([row({ displayName: "Only TE", position: "TE", action: "wait_one_turn", picksUntilNext: 1 })])],
    });

    expect(blocked.aggregate.verdict).toBe("blocked_by_missing_data");
    expect(qualityRisk.aggregate.verdict).toBe("quality_risks");
  });

  it("does not mutate source rows", () => {
    const rows = [
      row({ displayName: "WR A", position: "WR", rank: 1 }),
      row({ displayName: "WR B", position: "WR", rank: 2 }),
    ];
    const before = JSON.stringify(rows);

    evaluateReplayRoom(roomWith(rows));

    expect(JSON.stringify(rows)).toBe(before);
  });

  it("does not count simulated depletion as recommendation churn", () => {
    const evaluation = evaluateReplayRoom(roomWith([
      row({ displayName: "WR A", position: "WR", rank: 1, score: 70 }),
      row({ displayName: "WR B", position: "WR", rank: 2, score: 69 }),
      row({ displayName: "RB A", position: "RB", rank: 3, score: 68 }),
      row({ displayName: "RB B", position: "RB", rank: 4, score: 67 }),
    ]));

    expect(evaluation.stabilityFindings).toEqual([]);
  });
});

function roomWith(rows: WarRoomRecommendationRow[]): ReplayRoomInput {
  return {
    source: "scenario",
    draftRoomId: "room-1",
    leagueId: "league-1",
    leagueName: "Test League",
    rows,
  };
}

function row(input: {
  displayName: string;
  position: string;
  rank?: number;
  score?: number;
  action?: WarRoomRecommendationRow["needTimingAction"];
  tierName?: WarRoomRecommendationRow["recommendationTier"];
  status?: WarRoomRecommendationRow["status"];
  confidence?: string | null;
  tier?: number | null;
  tierDropRisk?: WarRoomRecommendationRow["tierDropRisk"];
  picksUntilNext?: number;
  round?: number;
  primaryReason?: string;
  waitPlanBacked?: boolean;
  waitPlanTargets?: WarRoomRecommendationRow["waitPlanTargets"];
}): WarRoomRecommendationRow {
  const score = input.score ?? 72;
  return {
    leagueId: "league-1",
    draftRoomId: "room-1",
    entityId: `${input.displayName}-${input.position}`,
    entityType: input.position === "DEF" ? "TEAM_DEFENSE" : "PLAYER",
    displayName: input.displayName,
    team: null,
    position: input.position,
    recommendationRank: input.rank ?? 1,
    recommendationTier: input.tierName ?? "solid_target",
    recommendationScore: score,
    scoreComponents: {
      leagueValue: 18,
      rosterNeed: 8,
      scarcity: 8,
      tierCliff: input.tierDropRisk === "high" ? 12 : 3,
      marketValue: 5,
      availabilityRisk: 3,
      needTiming: input.action === "fill_now" ? 8 : 0,
      confidencePenalty: input.confidence === "low" ? -6 : 0,
      formatPenalty: 0,
    },
    primaryReason: input.primaryReason ?? "League value and timing are balanced.",
    explanationFragments: [input.primaryReason ?? "League value and timing are balanced."],
    reasonCodes: [],
    warningCodes: input.confidence === "low" ? ["LOW_PROJECTION_CONFIDENCE"] : [],
    h10: {
      medianPoints: 100,
      pointsAboveReplacement: 10,
      riskAdjustedValue: 12,
      tier: input.tier ?? 2,
      marketValueSignal: "aligned",
      confidenceLabel: input.confidence ?? "medium",
      valueReadiness: "READY",
    },
    draftContext: {
      currentRound: input.round ?? 10,
      currentPick: 100,
      picksUntilNextUserPick: input.picksUntilNext ?? 1,
      positionNeedLevel: "moderate",
      starterSlotNeed: false,
      benchDepthNeed: true,
      tierDropBeforeNextPick: input.tierDropRisk === "high",
    },
    rosterNeedStatus: "bench_depth_need",
    needUrgency: "medium",
    futureAvailability: "uncertain_available_next_pick",
    tierDropRisk: input.tierDropRisk ?? "low",
    opportunityCost: "low",
    needTimingAction: input.action ?? "monitor",
    needTimingReasons: [],
    survivalConfidence: "medium",
    survivalConfidenceScore: 55,
    comparableOptionsNow: 2,
    comparableOptionsLikelyNextPick: 1,
    comparableOptionsLikelyNextTwoPicks: 1,
    waitRisk: "medium",
    waitRiskReasons: [],
    needTimingAdjustedBySurvival: false,
    waitPlanTargets: input.waitPlanTargets ?? [],
    waitPlanTargetCount: input.waitPlanTargets?.length ?? 0,
    waitPlanStrongTargetCount: input.waitPlanTargets?.filter((target) => target.confidence === "strong").length ?? 0,
    waitPlanSurvivalSummary: input.waitPlanTargets?.length ? `${input.waitPlanTargets.length} likely wait targets.` : "No wait targets.",
    waitPlanRisk: "medium",
    waitPlanReason: input.waitPlanTargets?.length ? "Wait plan has comparable targets." : "No wait plan.",
    waitPlanBacked: input.waitPlanBacked ?? false,
    waitPlanFallbackAction: null,
    needTimingAdjustedByWaitPlan: false,
    status: input.status ?? "recommendable",
  };
}
