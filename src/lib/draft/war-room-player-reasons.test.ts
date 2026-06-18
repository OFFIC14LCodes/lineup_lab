import { describe, expect, it } from "vitest";

import { buildWarRoomPlayerReasonStack, type WarRoomPlayerReasonStackInput } from "./war-room-player-reasons";

describe("buildWarRoomPlayerReasonStack", () => {
  it("groups value, fit, projection, risk, data gaps, and timing reasons", () => {
    const stack = buildWarRoomPlayerReasonStack(row());

    expect(stack.headline).toBe("Example Player · WR · SEA is Blackbird Power Rank #12 and draft suggestion #3.");
    expect(stack.valueReasons).toContain("Value score is 82.4 out of 100.");
    expect(stack.valueReasons).toContain("PAR is 31.2 against the role-aware replacement baseline.");
    expect(stack.fitReasons).toContain("Plan fit is strong fit.");
    expect(stack.fitReasons).toContain("Fills current WR need.");
    expect(stack.projectionReasons).toContain("Season median projection is 188.6.");
    expect(stack.projectionReasons).toContain("Range is 141.2 floor to 231.9 ceiling.");
    expect(stack.riskReasons).toContain("Player risk label is medium.");
    expect(stack.riskReasons).toContain("Confidence label is high.");
    expect(stack.dataGapReasons).toContain("snap share is a data gap.");
    expect(stack.timingReasons).toContain("Timing action is monitor.");
  });

  it("handles missing projections safely", () => {
    const stack = buildWarRoomPlayerReasonStack({
      ...row(),
      projectionPoints: null,
      projectionLow: null,
      projectionHigh: null,
      dataStatus: { ...row().dataStatus, projection: "unavailable" },
    });

    expect(stack.projectionReasons).toEqual(["No projection detail available yet."]);
    expect(stack.dataGapReasons).toContain("Projection data is unavailable.");
  });

  it("uses fallback language for absent fit and data gaps", () => {
    const stack = buildWarRoomPlayerReasonStack({
      ...row(),
      planFit: null,
      planFitReasons: [],
      role: null,
      contextualDataGaps: [],
      dataStatus: { projection: "available", h10: "available", marketRank: "available", ordering: "blackbird" },
    });

    expect(stack.fitReasons).toEqual(["Fit reasons will appear when roster context is available."]);
    expect(stack.dataGapReasons).toEqual(["No specific data gaps flagged."]);
  });

  it("does not mutate source arrays", () => {
    const source = row();
    const originalReasons = [...source.planFitReasons];
    const stack = buildWarRoomPlayerReasonStack(source);
    stack.fitReasons.push("mutated");

    expect(source.planFitReasons).toEqual(originalReasons);
  });
});

function row(): WarRoomPlayerReasonStackInput {
  return {
    playerName: "Example Player",
    position: "WR",
    team: "SEA",
    blackbirdBoardRank: 12,
    draftSuggestionRank: 3,
    draftSuggestionScore: 79.1,
    draftSuggestionType: "value",
    blackbirdValueScore: 82.4,
    projectionPoints: 188.6,
    projectionLow: 141.2,
    projectionHigh: 231.9,
    projectionUnit: "season",
    projectionSource: "blackbird_projection",
    projectionTrust: {
      trustLabel: "medium",
      reasons: ["Projection source is scoring aware."],
      fallbackReason: null,
    },
    pointsAboveReplacement: 31.2,
    confidence: "high",
    risk: "medium",
    planFit: "strong_fit",
    planFitReasons: ["Fills current WR need."],
    contextualReasons: ["Strong format fit."],
    contextualDataGaps: ["snap share"],
    needTimingAction: "monitor",
    waitPlanTargetCount: 2,
    role: "starter",
    roleConfidence: "medium",
    replacementMedianPoints: 120,
    blackbirdTier: 2,
    dataStatus: {
      projection: "available",
      h10: "available",
      marketRank: "available",
      ordering: "blackbird",
    },
  };
}
