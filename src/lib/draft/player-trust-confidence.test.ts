import { describe, expect, it } from "vitest";

import { calibratePlayerTrustConfidence } from "./player-trust-confidence";

describe("player trust confidence calibration", () => {
  it("classifies a current projection-backed player as high trust", () => {
    const result = calibratePlayerTrustConfidence({
      playerName: "Elite WR",
      position: "WR",
      projectionPoints: 330,
      projectionSource: "uploaded_ranking_projection",
      projectionUnit: "season",
      matchStatus: "exact_id",
      matchConfidence: 1,
      inputCompleteness: "full",
      activePolicyClass: "final_policy_confirmed_active_clear",
      sourceConfidence: "high",
      sourceConfidenceScore: 90,
      marketRank: 5,
      sleeperId: "s1",
      playerId: "p1",
    });

    expect(result.label).toBe("high");
    expect(result.reasonCodes).toContain("active_roster_confirmed");
    expect(result.reasonCodes).toContain("market_evidence_present");
    expect(result.trueFallbackProjection).toBe(false);
  });

  it("keeps fallback projections low even with identity evidence", () => {
    const result = calibratePlayerTrustConfidence({
      playerName: "Fallback Player",
      position: "RB",
      projectionPoints: 120,
      projectionSource: "fallback_projection",
      projectionUnit: "fallback",
      isFallback: true,
      matchStatus: "exact_id",
      matchConfidence: 1,
      activePolicyClass: "final_policy_confirmed_active_clear",
      sourceConfidence: "high",
      sleeperId: "s1",
      playerId: "p1",
    });

    expect(result.label).toBe("low");
    expect(result.reasonCodes).toContain("fallback_projection");
    expect(result.trueFallbackProjection).toBe(true);
  });

  it("does not allow blocked or archive players to become high trust", () => {
    const result = calibratePlayerTrustConfidence({
      playerName: "Blocked Player",
      position: "WR",
      projectionPoints: 300,
      projectionSource: "uploaded_ranking_projection",
      projectionUnit: "season",
      matchStatus: "exact_id",
      matchConfidence: 1,
      activePolicyClass: "final_policy_blocked_archive",
      sourceConfidence: "high",
      marketRank: 10,
      sleeperId: "s1",
      playerId: "p1",
    });

    expect(result.label).toBe("very_low");
    expect(result.reasonCodes).toContain("blocked_or_archive_policy");
  });

  it("caps manual review and source expansion rows below high trust", () => {
    const manual = calibratePlayerTrustConfidence({
      playerName: "Manual Review",
      position: "WR",
      projectionPoints: 260,
      projectionSource: "uploaded_ranking_projection",
      projectionUnit: "season",
      matchStatus: "exact_id",
      matchConfidence: 1,
      activePolicyClass: "final_policy_manual_review",
      sourceConfidence: "high",
      marketRank: 20,
      sleeperId: "s1",
      playerId: "p1",
    });
    const sourceExpansion = calibratePlayerTrustConfidence({
      playerName: "Source Expansion",
      position: "WR",
      projectionPoints: 260,
      projectionSource: "uploaded_ranking_projection",
      projectionUnit: "season",
      matchStatus: "exact_id",
      matchConfidence: 1,
      policyGroup: "stale_unmatched_review",
      sourceConfidence: "high",
      marketRank: 20,
      sleeperId: "s1",
      playerId: "p1",
    });

    expect(manual.label).not.toBe("high");
    expect(sourceExpansion.label).not.toBe("high");
    expect(manual.reasonCodes).toContain("manual_review_policy");
    expect(sourceExpansion.reasonCodes).toContain("source_expansion_policy");
  });
});
