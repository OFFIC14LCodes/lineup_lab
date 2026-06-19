import { describe, expect, it } from "vitest";

import { buildPlayerPositionEligibility, playerIsEligibleForPosition } from "./player-position-eligibility";

describe("H57.1 player position eligibility", () => {
  it.each([
    ["LB", "DL", "LB/DL"],
    ["DL", "LB", "DL/LB"],
    ["LB", "DB", "LB/DB"],
    ["DB", "LB", "DB/LB"],
  ])("trusts %s/%s IDP multi-position eligibility", (primary, secondary, display) => {
    const eligibility = buildPlayerPositionEligibility({ position: primary, fantasyPositions: [primary, secondary] });

    expect(eligibility.eligibilityClass).toBe("trusted_idp_multi_position");
    expect(eligibility.rawEligiblePositions).toEqual([primary, secondary]);
    expect(eligibility.displayPositions).toEqual([primary, secondary]);
    expect(eligibility.filterPositions).toEqual([primary, secondary]);
    expect(eligibility.rosterFitPositions).toEqual([primary, secondary]);
    expect(eligibility.valueModelPositions).toEqual([primary, secondary]);
    expect(eligibility.displayPosition).toBe(display);
    expect(eligibility.eligibilityWarnings).toEqual([]);
  });

  it("allows Travis Hunter WR/DB as the only valid cross-family combo", () => {
    const eligibility = buildPlayerPositionEligibility({
      player_name: "Travis Hunter",
      position: "WR",
      fantasyPositions: ["WR", "DB"],
    });

    expect(eligibility.eligibilityClass).toBe("travis_hunter_wr_db");
    expect(eligibility.displayPositions).toEqual(["WR", "DB"]);
    expect(eligibility.filterPositions).toEqual(["WR", "DB"]);
    expect(eligibility.rosterFitPositions).toEqual(["WR", "DB"]);
    expect(eligibility.valueModelPositions).toEqual(["WR", "DB"]);
    expect(eligibility.displayPosition).toBe("WR/DB");
  });

  it.each([
    ["QB", "TE"],
    ["TE", "QB"],
    ["RB", "WR"],
    ["WR", "TE"],
    ["TE", "RB"],
  ])("suppresses unsupported offensive combo %s/%s to primary only", (primary, secondary) => {
    const eligibility = buildPlayerPositionEligibility({ position: primary, fantasyPositions: [primary, secondary] });

    expect(eligibility.eligibilityClass).toBe("suppressed_unsupported_combo");
    expect(eligibility.rawEligiblePositions).toEqual([primary, secondary]);
    expect(eligibility.displayPositions).toEqual([primary]);
    expect(eligibility.filterPositions).toEqual([primary]);
    expect(eligibility.rosterFitPositions).toEqual([primary]);
    expect(eligibility.valueModelPositions).toEqual([primary]);
    expect(eligibility.displayPosition).toBe(primary);
    expect(eligibility.eligibilityWarnings).toContain("suppressed unsupported Sleeper multi-position combo");
  });

  it("suppresses K/DL and non-Travis offense/IDP cross-family combos", () => {
    const kicker = buildPlayerPositionEligibility({ position: "K", fantasyPositions: ["K", "DL"] });
    const crossFamily = buildPlayerPositionEligibility({ player_name: "Not Travis Hunter", position: "WR", fantasyPositions: ["WR", "DB"] });

    expect(kicker.eligibilityClass).toBe("invalid_cross_family_combo");
    expect(kicker.rosterFitPositions).toEqual(["K"]);
    expect(crossFamily.eligibilityClass).toBe("invalid_cross_family_combo");
    expect(crossFamily.displayPosition).toBe("WR");
    expect(crossFamily.rosterFitPositions).toEqual(["WR"]);
  });

  it("falls back safely to a single primary position", () => {
    const eligibility = buildPlayerPositionEligibility({ position: "WR" });

    expect(eligibility.eligibilityClass).toBe("single_position");
    expect(eligibility.rosterFitPositions).toEqual(["WR"]);
    expect(eligibility.displayPosition).toBe("WR");
  });

  it("matches trusted roster-fit positions only", () => {
    expect(playerIsEligibleForPosition({ position: "LB", fantasyPositions: ["LB", "DL"] }, "DL")).toBe(true);
    expect(playerIsEligibleForPosition({ position: "QB", fantasyPositions: ["QB", "TE"] }, "TE")).toBe(false);
    expect(playerIsEligibleForPosition({ player_name: "Travis Hunter", position: "WR", fantasyPositions: ["WR", "DB"] }, "DB")).toBe(true);
  });
});
