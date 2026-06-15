import { describe, expect, it } from "vitest";

import { buildDraftPositionContext, getPicksUntilDraftSlot } from "@/lib/rosterforge/draft-position";

describe("draft position context", () => {
  it("counts until the next pick in a 12-team snake draft from the current round position", () => {
    expect(getPicksUntilDraftSlot({ currentPickNumber: 14, teamCount: 12, rounds: 18, draftSlot: 10 })).toBe(1);
    expect(getPicksUntilDraftSlot({ currentPickNumber: 15, teamCount: 12, rounds: 18, draftSlot: 10 })).toBe(0);
    expect(getPicksUntilDraftSlot({ currentPickNumber: 25, teamCount: 12, rounds: 18, draftSlot: 10 })).toBe(9);
  });

  it("uses synced draft slot before roster id when computing my next pick", () => {
    const context = buildDraftPositionContext({
      settings: { teams: 12, rounds: 18 },
      myRosterId: "3",
      myPlatformUserId: "user-1",
      picks: [
        { pick_no: 1, round: 1, pick_in_round: 10, platform_roster_id: "3", picked_by_platform_user_id: "user-1" },
        { pick_no: 13, round: 2, pick_in_round: 12, platform_roster_id: "12" },
      ],
    });

    expect(context.currentPickNumber).toBe(14);
    expect(context.currentRound).toBe(2);
    expect(context.myDraftSlot).toBe(10);
    expect(context.picksUntilMyNextPick).toBe(1);
  });

  it("falls back to roster id when no synced pick exists yet", () => {
    const context = buildDraftPositionContext({
      settings: { teams: 10, rounds: 16 },
      myRosterId: "4",
      picks: [],
    });

    expect(context.currentPickNumber).toBe(1);
    expect(context.currentRound).toBe(1);
    expect(context.myDraftSlot).toBe(4);
    expect(context.picksUntilMyNextPick).toBe(3);
  });

  it("uses league and roster fallbacks when Sleeper draft settings omit team count", () => {
    const context = buildDraftPositionContext({
      settings: { rounds: 20 },
      teamCountFallback: 12,
      myRosterId: "8",
      picks: Array.from({ length: 222 }, (_, index) => ({
        pick_no: index + 1,
        round: Math.ceil((index + 1) / 12),
      })),
    });

    expect(context.currentPickNumber).toBe(223);
    expect(context.currentRound).toBe(19);
    expect(context.myDraftSlot).toBe(8);
    expect(context.picksUntilMyNextPick).toBe(1);
  });

  it.each([
    { teamCount: 8, draftSlot: 1, currentPickNumber: 1, expected: 0, label: "8-team first slot opening pick" },
    { teamCount: 8, draftSlot: 1, currentPickNumber: 2, expected: 14, label: "8-team first slot after opening pick" },
    { teamCount: 8, draftSlot: 8, currentPickNumber: 8, expected: 0, label: "8-team last slot end of round one turn" },
    { teamCount: 8, draftSlot: 8, currentPickNumber: 9, expected: 0, label: "8-team last slot start of round two turn" },
    { teamCount: 10, draftSlot: 5, currentPickNumber: 1, expected: 4, label: "10-team middle slot early round" },
    { teamCount: 10, draftSlot: 5, currentPickNumber: 16, expected: 0, label: "10-team middle slot even round" },
    { teamCount: 12, draftSlot: 12, currentPickNumber: 12, expected: 0, label: "12-team last slot first turn" },
    { teamCount: 12, draftSlot: 12, currentPickNumber: 13, expected: 0, label: "12-team last slot second turn" },
    { teamCount: 12, draftSlot: 12, currentPickNumber: 14, expected: 22, label: "12-team last slot after turn" },
    { teamCount: 14, draftSlot: 7, currentPickNumber: 1, expected: 6, label: "14-team middle slot opening round" },
    { teamCount: 14, draftSlot: 7, currentPickNumber: 22, expected: 0, label: "14-team middle slot even round" },
  ])("counts until next pick for $label", ({ teamCount, draftSlot, currentPickNumber, expected }) => {
    expect(getPicksUntilDraftSlot({ currentPickNumber, teamCount, rounds: 20, draftSlot })).toBe(expected);
  });

  it("returns null when roster count is unavailable even if roster id exists", () => {
    const context = buildDraftPositionContext({
      settings: { rounds: 18 },
      myRosterId: "2",
      picks: [],
    });

    expect(context.teamCount).toBeNull();
    expect(context.myDraftSlot).toBe(2);
    expect(context.picksUntilMyNextPick).toBeNull();
  });

  it("returns null when the user draft slot cannot be inferred", () => {
    const context = buildDraftPositionContext({
      settings: { teams: 12, rounds: 18 },
      picks: [
        { pick_no: 1, round: 1, pick_in_round: 1, platform_roster_id: "1" },
        { pick_no: 2, round: 1, pick_in_round: 2, platform_roster_id: "2" },
      ],
    });

    expect(context.currentPickNumber).toBe(3);
    expect(context.myDraftSlot).toBeNull();
    expect(context.picksUntilMyNextPick).toBeNull();
  });

  it("returns null once the draft is complete", () => {
    const picks = Array.from({ length: 16 }, (_, index) => ({
      pick_no: index + 1,
      round: Math.ceil((index + 1) / 8),
      pick_in_round: ((index) % 8) + 1,
    }));
    const context = buildDraftPositionContext({
      settings: { teams: 8, rounds: 2 },
      myRosterId: "1",
      picks,
    });

    expect(context.currentPickNumber).toBe(17);
    expect(context.currentRound).toBe(3);
    expect(context.myDraftSlot).toBe(1);
    expect(context.picksUntilMyNextPick).toBeNull();
  });
});
