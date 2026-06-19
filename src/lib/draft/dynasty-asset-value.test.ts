import { describe, expect, it } from "vitest";

import { buildDynastyAssetValue } from "./dynasty-asset-value";

const dynastySuperflex = { isDynasty: true, isSuperflex: true, isTwoQb: false, isBestBall: false, tePremium: 0 };
const dynastyTePremium = { isDynasty: true, isSuperflex: true, isTwoQb: false, isBestBall: false, tePremium: 1 };

describe("H56B dynasty asset value", () => {
  it("young comparable RB beats older cliff-risk RB when production is close", () => {
    const taylor = buildDynastyAssetValue({
      playerName: "Jonathan Taylor style",
      position: "RB",
      age: 27,
      projectionValue: 83,
      replacementValue: 86,
      scarcityValue: 78,
      formatFit: 62,
      projectedPoints: 288,
      pointsAboveReplacement: 42,
      risk: "low",
      trustScore: 82,
      marketRank: 27,
      blackbirdRank: 31,
      leagueContext: dynastySuperflex,
    });
    const henry = buildDynastyAssetValue({
      playerName: "Derrick Henry style",
      position: "RB",
      age: 32,
      projectionValue: 85,
      replacementValue: 88,
      scarcityValue: 78,
      formatFit: 62,
      projectedPoints: 293,
      pointsAboveReplacement: 44,
      risk: "low",
      trustScore: 82,
      marketRank: 18,
      blackbirdRank: 30,
      leagueContext: dynastySuperflex,
    });

    expect(taylor.dynastyAssetScoreDisplay).toBeGreaterThan(henry.dynastyAssetScoreDisplay);
    expect(henry.ageCurve.declineRisk).toBe("severe");
  });

  it("allows older elite RB to remain useful while carrying severe runway risk", () => {
    const henry = buildDynastyAssetValue({
      position: "RB",
      age: 32,
      projectionValue: 94,
      replacementValue: 95,
      scarcityValue: 82,
      formatFit: 62,
      risk: "low",
      trustScore: 88,
      leagueContext: dynastySuperflex,
    });

    expect(henry.dynastyAssetScoreDisplay).toBeGreaterThan(50);
    expect(henry.ageCurve.declineRisk).toBe("severe");
    expect(henry.components.riskAdjustment).toBeLessThan(0);
  });

  it("boosts young elite TE with scarcity, premium, and runway", () => {
    const bowers = buildDynastyAssetValue({
      playerName: "Brock Bowers style",
      position: "TE",
      age: 23,
      projectionValue: 82,
      replacementValue: 90,
      scarcityValue: 88,
      formatFit: 72,
      risk: "low",
      trustScore: 84,
      marketRank: 12,
      blackbirdRank: 37,
      leagueContext: dynastyTePremium,
    });
    const kelce = buildDynastyAssetValue({
      playerName: "Travis Kelce style",
      position: "TE",
      age: 36,
      projectionValue: 82,
      replacementValue: 90,
      scarcityValue: 88,
      formatFit: 72,
      risk: "low",
      trustScore: 84,
      marketRank: 70,
      blackbirdRank: 40,
      leagueContext: dynastyTePremium,
    });

    expect(bowers.dynastyAssetScoreDisplay).toBeGreaterThan(kelce.dynastyAssetScoreDisplay);
    expect(bowers.components.formatPremium).toBeGreaterThan(80);
    expect(kelce.ageCurve.declineRisk).toBe("severe");
  });

  it("gives young elite WR runway value", () => {
    const youngWr = buildDynastyAssetValue({
      position: "WR",
      age: 23,
      projectionValue: 86,
      replacementValue: 84,
      scarcityValue: 66,
      formatFit: 58,
      trustScore: 82,
      leagueContext: dynastySuperflex,
    });

    expect(youngWr.ageCurve.runwayScore).toBeGreaterThan(90);
    expect(youngWr.components.ageRunwayValue).toBeGreaterThan(90);
  });

  it("does not use ADP as raw value", () => {
    const earlyMarket = buildDynastyAssetValue({
      position: "WR",
      age: 26,
      projectionValue: 70,
      replacementValue: 70,
      scarcityValue: 60,
      formatFit: 55,
      marketRank: 1,
      blackbirdRank: 80,
      leagueContext: dynastySuperflex,
    });
    const lateMarket = buildDynastyAssetValue({
      position: "WR",
      age: 26,
      projectionValue: 70,
      replacementValue: 70,
      scarcityValue: 60,
      formatFit: 55,
      marketRank: 200,
      blackbirdRank: 80,
      leagueContext: dynastySuperflex,
    });

    expect(Math.abs(earlyMarket.dynastyAssetScoreDisplay - lateMarket.dynastyAssetScoreDisplay)).toBeLessThanOrEqual(7);
    expect(Math.abs(earlyMarket.components.marketSanityAdjustment)).toBeLessThanOrEqual(4);
  });
});
