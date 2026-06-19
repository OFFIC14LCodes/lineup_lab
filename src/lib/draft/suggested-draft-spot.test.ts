import { describe, expect, it } from "vitest";

import { buildSuggestedDraftSpot } from "./suggested-draft-spot";

describe("H56A suggested draft spot", () => {
  it("generates a timing range from Blackbird rank plus market ADP", () => {
    const spot = buildSuggestedDraftSpot({ blackbirdRank: 31, marketAdp: 34, teamCount: 12 });

    expect(spot).toMatchObject({
      pickMin: 28,
      pickMax: 34,
      round: 3,
      label: "target_this_round",
      marketEdgePicks: 3,
      reachRisk: "low",
    });
  });

  it("waits for value when Blackbird is much higher than market instead of forcing rank", () => {
    const spot = buildSuggestedDraftSpot({ blackbirdRank: 18, marketAdp: 45, teamCount: 12 });

    expect(spot.label).toBe("wait_for_value");
    expect(spot.pickMin).toBeGreaterThan(18);
    expect(spot.pickMin).toBe(36);
    expect(spot.pickMax).toBe(42);
    expect(spot.reason).toContain("instead of forcing the Blackbird rank");
  });

  it("marks do not reach when market is much earlier than Blackbird value", () => {
    const spot = buildSuggestedDraftSpot({ blackbirdRank: 37, marketAdp: 12, teamCount: 12 });

    expect(spot).toMatchObject({
      pickMin: null,
      pickMax: null,
      label: "avoid",
      marketEdgePicks: -25,
      reachRisk: "high",
      waitRisk: "low",
    });
  });

  it("keeps close rank and market players near the earlier practical window", () => {
    const spot = buildSuggestedDraftSpot({ blackbirdRank: 9, marketAdp: 14, teamCount: 12 });

    expect(spot).toMatchObject({
      pickMin: 6,
      pickMax: 14,
      round: 1,
      label: "target_this_round",
      marketEdgePicks: 5,
    });
  });

  it("uses current pick and next turn context to upgrade urgent targets to take now", () => {
    const spot = buildSuggestedDraftSpot({
      blackbirdRank: 9,
      marketAdp: 14,
      teamCount: 12,
      currentPick: 13,
      picksUntilNextTurn: 12,
      tierRisk: "high",
      trustLabel: "high",
    });

    expect(spot.label).toBe("take_now");
    expect(spot.waitRisk).toBe("high");
  });

  it("falls back safely when market ADP is missing", () => {
    const spot = buildSuggestedDraftSpot({ blackbirdRank: 48, marketAdp: null, teamCount: 12 });

    expect(spot).toMatchObject({
      pickMin: 36,
      pickMax: 60,
      round: 3,
      label: "unknown",
      marketEdgePicks: null,
      reachRisk: "unknown",
      waitRisk: "unknown",
    });
  });
});
