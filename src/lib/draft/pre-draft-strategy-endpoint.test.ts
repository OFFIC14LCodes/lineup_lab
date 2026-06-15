import { describe, expect, it } from "vitest";

import { buildPreDraftStrategyEndpointResponse } from "./pre-draft-strategy-endpoint";

describe("H11 pre-draft strategy endpoint response", () => {
  it("returns a strategy response from live draft room state", () => {
    const response = buildPreDraftStrategyEndpointResponse(state());

    expect(response.strategyPreviewLabel).toBe("read-only strategy preview");
    expect(response.endpointMetadata).toMatchObject({
      draftRoomId: "room-1",
      leagueId: "league-1",
      readOnly: true,
      persistedStrategy: false,
      source: "live_draft_room_state",
    });
    expect(response.safetyLanguageStatus.passed).toBe(true);
  });

  it("returns partial strategy with a missing draft slot data gap", () => {
    const response = buildPreDraftStrategyEndpointResponse(state({ myDraftSlot: null }));

    expect(response.draftSlotStrategy.archetype).toBe("unknown");
    expect(response.dataGaps).toContain("missing draft slot");
  });

  it("returns partial strategy with missing scoring settings data gap", () => {
    const response = buildPreDraftStrategyEndpointResponse(state({ scoringSettings: null }));

    expect(response.leagueSummary.scoringType).toBe("unknown");
    expect(response.dataGaps).toContain("missing raw scoring settings");
  });

  it("returns QB emphasis for Superflex and 2QB rooms", () => {
    const response = buildPreDraftStrategyEndpointResponse(state({ isSuperflex: true, isTwoQb: true }));

    expect(response.leagueSummary.superflexOr2Qb).toBe(true);
    expect(response.scoringEmphasis.some((row) => row.position === "QB" && row.priority === "elite")).toBe(true);
  });

  it("returns TE premium sensitivity when data is available", () => {
    const response = buildPreDraftStrategyEndpointResponse(state({ tePremium: 0.5, scoringSettings: { rec: 1, bonus_rec_te: 0.5 } }));

    expect(response.leagueSummary.tePremium).toBe(true);
    expect(response.scoringEmphasis.some((row) => row.position === "TE")).toBe(true);
  });

  it("returns IDP planning for IDP rooms", () => {
    const response = buildPreDraftStrategyEndpointResponse(state({ rosterPositions: ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "IDP"] }));

    expect(response.leagueSummary.idp).toBe(true);
    expect(response.specialPositionGuidance.some((row) => row.position === "DL/LB/DB")).toBe(true);
  });

  it("returns K/DST low-priority timing guidance", () => {
    const response = buildPreDraftStrategyEndpointResponse(state({ rosterPositions: ["QB", "RB", "WR", "TE", "K", "DEF"] }));

    expect(response.leagueSummary.kicker).toBe(true);
    expect(response.leagueSummary.teamDefense).toBe(true);
    expect(response.doNotForcePositions.map((row) => row.position)).toEqual(["DEF", "K"]);
  });

  it("reports banned language status", () => {
    const response = buildPreDraftStrategyEndpointResponse(state());

    expect(response.safetyLanguageStatus).toEqual({ passed: true, failures: [] });
  });

  it("does not mutate the input state", () => {
    const input = state({ isSuperflex: true });
    const before = JSON.stringify(input);

    buildPreDraftStrategyEndpointResponse(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});

function state(overrides: {
  myDraftSlot?: number | null;
  teamCount?: number | null;
  rosterPositions?: string[];
  scoringSettings?: Record<string, number> | null;
  isSuperflex?: boolean;
  isTwoQb?: boolean;
  tePremium?: number;
} = {}) {
  const rosterPositions = overrides.rosterPositions ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN"];
  return {
    room: {
      id: "room-1",
      league_id: "league-1",
      settings_json: { rounds: 16 },
    },
    league: {
      id: "league-1",
      name: "Endpoint League",
      season: "2026",
      total_teams: overrides.teamCount ?? 12,
      roster_positions_json: rosterPositions,
      scoring_settings_json: overrides.scoringSettings === undefined ? { rec: 1 } : overrides.scoringSettings,
      is_superflex: overrides.isSuperflex ?? rosterPositions.includes("SUPER_FLEX"),
      is_two_qb: overrides.isTwoQb ?? rosterPositions.filter((slot) => slot === "QB").length > 1,
      te_premium: overrides.tePremium ?? 0,
    },
    remainingPlayers: [
      { player_name: "QB One", position: "QB" },
      { player_name: "RB One", position: "RB" },
      { player_name: "TE One", position: "TE" },
      { player_name: "K One", position: "K" },
      { player_name: "Defense One", position: "DEF" },
      { player_name: "LB One", position: "LB" },
    ],
    h10RecommendationPreview: [],
    h10RecommendationDiagnostics: {
      rowsByPosition: {},
      contextLimitations: [],
    },
    hasIDP: rosterPositions.some((slot) => ["DL", "LB", "DB", "IDP"].includes(slot)),
    hasKicker: rosterPositions.includes("K"),
    hasTeamDefense: rosterPositions.includes("DEF"),
    rosterRequirements: {
      benchCount: rosterPositions.filter((slot) => slot === "BN").length,
    },
    currentPickNumber: 1,
    currentRound: 1,
    picksUntilMyNextPick: 0,
    myDraftSlot: overrides.myDraftSlot === undefined ? 1 : overrides.myDraftSlot,
    teamCount: overrides.teamCount ?? 12,
    warnings: [],
  } as never;
}
