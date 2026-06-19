import { describe, expect, it } from "vitest";

import { buildWarRoomPlanAlignmentLabels } from "./war-room-plan-alignment";

describe("buildWarRoomPlanAlignmentLabels", () => {
  it("maps plan fit reasons and strong tiers to Plan Fit", () => {
    expect(buildWarRoomPlanAlignmentLabels({ reasons: ["Fills current WR need."], match_status: "matched" })).toContain("Plan Fit");
    expect(buildWarRoomPlanAlignmentLabels({ recommendationTier: "strong_target", match_status: "matched" })).toContain("Plan Fit");
  });

  it("maps need fit from roster need score", () => {
    expect(buildWarRoomPlanAlignmentLabels({ scoreComponents: { rosterNeedScore: 10 }, match_status: "matched" })).toContain("Need Fit");
  });

  it("maps value fit from score or format-specific value fields", () => {
    expect(buildWarRoomPlanAlignmentLabels({ scoreComponents: { valueScore: 10 }, match_status: "matched" })).toContain("Value Fit");
    expect(buildWarRoomPlanAlignmentLabels({ dynasty_value: 1, match_status: "matched" })).toContain("Value Fit");
  });

  it("maps scarcity and format fit from score components", () => {
    expect(buildWarRoomPlanAlignmentLabels({ scoreComponents: { scarcityScore: 8, formatFitScore: 8 }, match_status: "matched" })).toEqual(["Scarcity Fit", "Format Fit"]);
  });

  it("maps depth and luxury tiers", () => {
    expect(buildWarRoomPlanAlignmentLabels({ recommendationTier: "depth_option", match_status: "matched" })).toContain("Depth Pick");
    expect(buildWarRoomPlanAlignmentLabels({ recommendationTier: "avoid_for_now", match_status: "matched" })).toContain("Luxury Pick");
  });

  it("maps warnings and match concerns to Risk Check", () => {
    expect(buildWarRoomPlanAlignmentLabels({ warnings: ["Low confidence"], match_status: "matched" })).toContain("Risk Check");
    expect(buildWarRoomPlanAlignmentLabels({ match_status: "ambiguous" })).toContain("Risk Check");
    expect(buildWarRoomPlanAlignmentLabels({ match_status: "matched", match_confidence: 0.74 })).toContain("Risk Check");
  });

  it("is safe on missing fields", () => {
    expect(buildWarRoomPlanAlignmentLabels({ match_status: "matched", match_confidence: null })).toEqual([]);
    expect(buildWarRoomPlanAlignmentLabels({})).toEqual(["Risk Check"]);
  });

  it("preserves deterministic label order and caps visible labels at six", () => {
    expect(buildWarRoomPlanAlignmentLabels({
      reasons: ["Reason"],
      scoreComponents: { rosterNeedScore: 10, valueScore: 10, scarcityScore: 8, formatFitScore: 8 },
      recommendationTier: "depth_option",
      warnings: ["Warn"],
      match_status: "ambiguous",
    })).toEqual(["Plan Fit", "Need Fit", "Value Fit", "Scarcity Fit", "Format Fit", "Depth Pick"]);
  });
});
