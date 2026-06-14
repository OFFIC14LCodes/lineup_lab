import { describe, expect, it } from "vitest";

import { accumulateTeamYards, getTeamOffensiveYards, verifyYardInvariants } from "./derive";

// Helper: build a minimal PBP row.
function play(overrides: Record<string, string>): Record<string, string> {
  return {
    game_id: "2025_01_KC_BUF",
    season: "2025",
    week: "1",
    season_type: "REG",
    posteam: "KC",
    defteam: "BUF",
    play_type: "pass",
    yards_gained: "10",
    two_point_attempt: "0",
    play_deleted: "0",
    defensive_two_point_attempt: "0",
    ...overrides,
  };
}

describe("accumulateTeamYards", () => {
  it("sums yards for a single team in one game", () => {
    const plays = [
      play({ yards_gained: "10" }),
      play({ yards_gained: "5" }),
      play({ yards_gained: "-3" }), // sack
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(12);
  });

  it("accumulates yards for both teams independently", () => {
    const plays = [
      play({ posteam: "KC", defteam: "BUF", yards_gained: "20", play_type: "run" }),
      play({ posteam: "BUF", defteam: "KC", yards_gained: "15", play_type: "pass" }),
      play({ posteam: "KC", defteam: "BUF", yards_gained: "5", play_type: "pass" }),
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(25);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "BUF")).toBe(15);
  });

  it("excludes two_point_attempt plays", () => {
    const plays = [
      play({ yards_gained: "10" }),
      play({ yards_gained: "2", two_point_attempt: "1" }),
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(10);
  });

  it("excludes deleted plays", () => {
    const plays = [
      play({ yards_gained: "10" }),
      play({ yards_gained: "100", play_deleted: "1" }),
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(10);
  });

  it("excludes non-offensive play types", () => {
    const plays = [
      play({ yards_gained: "10", play_type: "pass" }),
      play({ yards_gained: "50", play_type: "kickoff" }),
      play({ yards_gained: "40", play_type: "punt" }),
      play({ yards_gained: "30", play_type: "field_goal" }),
      play({ yards_gained: "20", play_type: "extra_point" }),
      play({ yards_gained: "5", play_type: "no_play" }),
    ];
    const acc = accumulateTeamYards(plays);
    // Only the 'pass' play counts.
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(10);
  });

  it("includes qb_spike and qb_kneel play types", () => {
    const plays = [
      play({ yards_gained: "10", play_type: "pass" }),
      play({ yards_gained: "0", play_type: "qb_spike" }),
      play({ yards_gained: "-1", play_type: "qb_kneel" }),
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(9);
  });

  it("handles negative yards (sacks)", () => {
    const plays = [
      play({ yards_gained: "50", play_type: "run" }),
      play({ yards_gained: "-7", play_type: "pass" }), // sack
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(43);
  });

  it("handles multiple games independently", () => {
    const plays = [
      play({ game_id: "2025_01_KC_BUF", posteam: "KC", yards_gained: "100" }),
      play({ game_id: "2025_02_KC_DEN", posteam: "KC", yards_gained: "200" }),
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(100);
    expect(getTeamOffensiveYards(acc, "2025_02_KC_DEN", "KC")).toBe(200);
  });

  it("skips rows with missing game_id or posteam", () => {
    const plays = [
      play({ yards_gained: "10" }),
      { ...play({ yards_gained: "50" }), game_id: "", posteam: "" },
      { ...play({ yards_gained: "30" }), posteam: "NA" },
    ];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(10);
  });
});

describe("getTeamOffensiveYards", () => {
  it("returns null for a game/team pair not in the accumulator", () => {
    const acc = accumulateTeamYards([]);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBeNull();
  });

  it("returns 0 for a team with no positive yards", () => {
    const plays = [play({ yards_gained: "0", play_type: "qb_kneel" })];
    const acc = accumulateTeamYards(plays);
    expect(getTeamOffensiveYards(acc, "2025_01_KC_BUF", "KC")).toBe(0);
  });
});

describe("verifyYardInvariants", () => {
  it("returns no violations for a complete game", () => {
    const plays = [
      play({ game_id: "2025_01_KC_BUF", posteam: "KC", yards_gained: "300" }),
      play({ game_id: "2025_01_KC_BUF", posteam: "BUF", yards_gained: "250" }),
    ];
    const acc = accumulateTeamYards(plays);
    expect(verifyYardInvariants(acc, "2025_01_KC_BUF", "KC", "BUF")).toEqual([]);
  });

  it("flags missing yards for home team", () => {
    const plays = [play({ game_id: "2025_01_KC_BUF", posteam: "BUF", yards_gained: "250" })];
    const acc = accumulateTeamYards(plays);
    const violations = verifyYardInvariants(acc, "2025_01_KC_BUF", "KC", "BUF");
    expect(violations.some((v) => v.includes("KC"))).toBe(true);
  });

  it("flags missing yards for away team", () => {
    const plays = [play({ game_id: "2025_01_KC_BUF", posteam: "KC", yards_gained: "300" })];
    const acc = accumulateTeamYards(plays);
    const violations = verifyYardInvariants(acc, "2025_01_KC_BUF", "KC", "BUF");
    expect(violations.some((v) => v.includes("BUF"))).toBe(true);
  });

  it("flags implausibly negative yard totals", () => {
    const plays = [
      play({ game_id: "2025_01_KC_BUF", posteam: "KC", yards_gained: "-300" }),
      play({ game_id: "2025_01_KC_BUF", posteam: "BUF", yards_gained: "200" }),
    ];
    const acc = accumulateTeamYards(plays);
    const violations = verifyYardInvariants(acc, "2025_01_KC_BUF", "KC", "BUF");
    expect(violations.some((v) => v.includes("KC"))).toBe(true);
  });
});
