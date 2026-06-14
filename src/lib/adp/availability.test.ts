import { describe, expect, it } from "vitest";

import { buildAvailabilityModel, buildAvailabilityModels, probAvailableNextRound } from "./availability";

describe("buildAvailabilityModel", () => {
  it("player is nearly certain to be available well before ADP", () => {
    const model = buildAvailabilityModel("p1", "Patrick Mahomes", 32, 8);
    // 20 picks before ADP: should be very high probability
    const prob20Before = model.probAvailableAt[String(12)];
    expect(prob20Before).toBeGreaterThan(0.9);
  });

  it("player is ~50% likely to be available at exactly ADP", () => {
    const model = buildAvailabilityModel("p1", "Patrick Mahomes", 32, 8);
    // At the ADP pick itself, probability ≈ 0.5 (by symmetric normal distribution)
    const probAtAdp = model.probAvailableAt[String(32)] ?? 0;
    expect(probAtAdp).toBeGreaterThan(0.4);
    expect(probAtAdp).toBeLessThan(0.6);
  });

  it("player is very unlikely to be available far past ADP", () => {
    const model = buildAvailabilityModel("p1", "Justin Jefferson", 8, 5);
    // 30 picks after a high-ADP player's ADP
    const probFarAfter = model.probAvailableAt[String(38)] ?? 0;
    expect(probFarAfter).toBeLessThan(0.1);
  });

  it("early-round player has tight variance stage", () => {
    const model = buildAvailabilityModel("p1", "Top Pick", 5, 3);
    expect(model.draftStageVariance).toBe("tight");
    expect(model.effectiveStddev).toBeGreaterThanOrEqual(4);
  });

  it("late-round player has wide variance stage", () => {
    const model = buildAvailabilityModel("p1", "Late Pick", 180, 20);
    expect(model.draftStageVariance).toBe("wide");
    expect(model.effectiveStddev).toBeGreaterThanOrEqual(12);
  });

  it("mid-round player has normal variance stage", () => {
    const model = buildAvailabilityModel("p1", "Mid Pick", 60, 10);
    expect(model.draftStageVariance).toBe("normal");
  });

  it("estimates stddev when null is provided", () => {
    const model = buildAvailabilityModel("p1", "Player", 100, null);
    expect(model.effectiveStddev).toBeGreaterThan(0);
    expect(model.rawStddev).toBeNull();
  });

  it("probAvailableAt only contains picks with prob >= 0.001", () => {
    const model = buildAvailabilityModel("p1", "Player", 36, 8);
    for (const [, prob] of Object.entries(model.probAvailableAt)) {
      expect(prob).toBeGreaterThanOrEqual(0.001);
    }
  });

  it("probability values are in [0, 1]", () => {
    const model = buildAvailabilityModel("p1", "Player", 48, 12);
    for (const [, prob] of Object.entries(model.probAvailableAt)) {
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
  });
});

describe("probAvailableNextRound", () => {
  it("probability one round later is lower than at current pick", () => {
    const model = buildAvailabilityModel("p1", "Player", 36, 8);
    const probNow = model.probAvailableAt[String(30)] ?? 0;
    const probLater = probAvailableNextRound(model, 30, 12);
    expect(probLater).toBeLessThanOrEqual(probNow);
  });
});

describe("buildAvailabilityModels", () => {
  it("builds a model for each player", () => {
    const players = [
      { canonicalPlayerId: "p1", playerName: "Alpha", overallAdp: 10, adpStddev: 4 },
      { canonicalPlayerId: "p2", playerName: "Beta", overallAdp: 80, adpStddev: 12 },
    ];
    const models = buildAvailabilityModels(players);
    expect(models).toHaveLength(2);
    expect(models[0].canonicalPlayerId).toBe("p1");
    expect(models[1].canonicalPlayerId).toBe("p2");
  });
});
