import { describe, expect, it } from "vitest";

import {
  buildEligibleDraftPositions,
  filterDraftEligiblePlayers,
  isPositionDraftEligible,
} from "./league-position-eligibility";

describe("league position eligibility", () => {
  it("excludes K when no kicker slot exists", () => {
    const eligible = buildEligibleDraftPositions({ rosterPositions: ["QB", "RB", "WR", "TE", "BN", "IR", "TAXI"] });

    expect(eligible.has("K")).toBe(false);
    expect(isPositionDraftEligible("K", { rosterPositions: ["QB", "RB", "WR", "TE", "BN"] })).toBe(false);
  });

  it("includes K only when a K slot exists", () => {
    const eligible = buildEligibleDraftPositions({ rosterPositions: ["QB", "RB", "WR", "TE", "K", "BN"] });

    expect(eligible.has("K")).toBe(true);
    expect(isPositionDraftEligible("K", { rosterPositions: ["QB", "K", "BN"] })).toBe(true);
  });

  it("excludes DST and DEF when no team-defense slot exists", () => {
    expect(isPositionDraftEligible("DST", { rosterPositions: ["QB", "RB", "WR", "TE", "BN"] })).toBe(false);
    expect(isPositionDraftEligible("DEF", { rosterPositions: ["QB", "RB", "WR", "TE", "BN"] })).toBe(false);
  });

  it("includes DST and DEF when a team-defense slot exists", () => {
    expect(isPositionDraftEligible("DST", { rosterPositions: ["QB", "DST", "BN"] })).toBe(true);
    expect(isPositionDraftEligible("DEF", { rosterPositions: ["QB", "DEF", "BN"] })).toBe(true);
  });

  it("excludes IDP positions without direct IDP or flex slots", () => {
    const eligible = buildEligibleDraftPositions({ rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"] });

    expect(eligible.has("DL")).toBe(false);
    expect(eligible.has("LB")).toBe(false);
    expect(eligible.has("DB")).toBe(false);
  });

  it("includes DL/LB/DB when IDP_FLEX exists", () => {
    const eligible = buildEligibleDraftPositions({ rosterPositions: ["QB", "RB", "WR", "TE", "IDP_FLEX", "BN"] });

    expect(eligible.has("DL")).toBe(true);
    expect(eligible.has("LB")).toBe(true);
    expect(eligible.has("DB")).toBe(true);
  });

  it("includes QB through superflex or OP slots", () => {
    expect(isPositionDraftEligible("QB", { rosterPositions: ["SUPERFLEX", "BN"] })).toBe(true);
    expect(isPositionDraftEligible("QB", { rosterPositions: ["OP", "BN"] })).toBe(true);
  });

  it("bench-only slots do not make special teams or IDP eligible", () => {
    const eligible = buildEligibleDraftPositions({ rosterPositions: ["BN", "BN", "IR", "TAXI"] });

    expect([...eligible]).toEqual([]);
    expect(isPositionDraftEligible("K", { rosterPositions: ["BN"] })).toBe(false);
    expect(isPositionDraftEligible("DEF", { rosterPositions: ["BN"] })).toBe(false);
    expect(isPositionDraftEligible("LB", { rosterPositions: ["BN"] })).toBe(false);
  });

  it("filters players and reports unsupported positions", () => {
    const result = filterDraftEligiblePlayers(
      [
        { player_name: "RB", position: "RB" },
        { player_name: "K", position: "K" },
        { player_name: "DST", position: "DST" },
        { player_name: "LB", position: "LB" },
      ],
      { rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"] },
    );

    expect(result.players.map((player) => player.player_name)).toEqual(["RB"]);
    expect(result.filteredPositions).toEqual(["DEF", "K", "LB"]);
    expect(result.filteredCount).toBe(3);
  });
});
