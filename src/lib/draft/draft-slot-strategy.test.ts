import { describe, expect, it } from "vitest";

import { buildDraftSlotStrategyCalibration, classifyDraftSlotBand, expectedSnakePick } from "./draft-slot-strategy";

describe("H11.3 draft slot strategy calibration", () => {
  it("classifies supported team sizes into slot bands", () => {
    expect(classifyDraftSlotBand(1, 12)).toBe("early");
    expect(classifyDraftSlotBand(4, 12)).toBe("early-middle");
    expect(classifyDraftSlotBand(7, 12)).toBe("middle");
    expect(classifyDraftSlotBand(9, 12)).toBe("late-middle");
    expect(classifyDraftSlotBand(12, 12)).toBe("late");
    expect(classifyDraftSlotBand(10, 10)).toBe("late");
    expect(classifyDraftSlotBand(14, 14)).toBe("late");
    expect(classifyDraftSlotBand(99, 12)).toBe("unknown");
  });

  it("computes snake pick windows for a late slot", () => {
    expect(expectedSnakePick(1, 10, 12)).toMatchObject({ round: 1, pickInRound: 10, overallPick: 10 });
    expect(expectedSnakePick(2, 10, 12)).toMatchObject({ round: 2, pickInRound: 3, overallPick: 15 });
    expect(expectedSnakePick(3, 10, 12)).toMatchObject({ round: 3, pickInRound: 10, overallPick: 34 });
  });

  it("marks exact turn slots with high pairing risk and compact waits", () => {
    const strategy = buildDraftSlotStrategyCalibration({ draftSlot: 12, teamCount: 12, rounds: 18 });

    expect(strategy.isTurnPick).toBe(true);
    expect(strategy.isNearTurn).toBe(true);
    expect(strategy.turnPairingRisk).toBe("high");
    expect(strategy.maxWaitUntilNextPick).toBe(22);
    expect(strategy.projectedUserPicks.slice(0, 3).map((pick) => pick.overallPick)).toEqual([12, 13, 36]);
    expect(strategy.slotStrategySummary).toContain("paired selections");
  });

  it("marks near-turn slots with medium risk", () => {
    const strategy = buildDraftSlotStrategyCalibration({ draftSlot: 11, teamCount: 12, rounds: 16 });

    expect(strategy.isTurnPick).toBe(false);
    expect(strategy.isNearTurn).toBe(true);
    expect(strategy.turnPairingRisk).toBe("high");
    expect(strategy.timingSignals.join(" ")).toContain("Near-turn");
  });

  it("keeps middle slots flexible with lower wait pressure", () => {
    const strategy = buildDraftSlotStrategyCalibration({ draftSlot: 6, teamCount: 12, rounds: 16 });

    expect(strategy.draftSlotBand).toBe("middle");
    expect(strategy.isNearTurn).toBe(false);
    expect(strategy.turnPairingRisk).toBe("low");
    expect(strategy.slotStrategySummary).toContain("preserve flexibility");
  });

  it("returns partial strategy with data gaps when slot context is missing", () => {
    const strategy = buildDraftSlotStrategyCalibration({ draftSlot: null, teamCount: null });

    expect(strategy.draftSlotBand).toBe("unknown");
    expect(strategy.projectedUserPicks).toEqual([]);
    expect(strategy.dataGaps).toEqual(["team count unavailable", "draft slot unavailable"]);
  });
});
