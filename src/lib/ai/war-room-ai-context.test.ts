import { describe, expect, it } from "vitest";

import { buildWarRoomAiContext } from "./war-room-ai-context";
import type { WarRoomAiContextInput } from "./war-room-ai-context-types";

describe("buildWarRoomAiContext", () => {
  it("includes expected War Room fields for a future AI GM assistant", () => {
    const context = buildWarRoomAiContext(input());

    expect(context).toMatchObject({
      contextVersion: "war_room_ai_context_v1",
      readOnly: true,
      deterministic: true,
      canMutateDraft: false,
      draftRoomId: "room-1",
      leagueId: "league-1",
      leagueSettingsSummary: {
        name: "BestBalls in Hand",
        formatFlags: ["dynasty", "best_ball", "superflex", "te_premium_1.5"],
      },
      draftState: {
        currentPickNumber: 42,
        currentRound: 4,
      },
      safety: {
        noAiApiCalls: true,
        noSupabaseWrites: true,
        noRankingMutation: true,
        noDraftSuggestionMutation: true,
      },
      liveState: {
        status: "fresh",
        lastUpdatedAt: "2026-06-17T12:00:00.000Z",
        secondsSinceUpdate: 12,
        warnings: [],
      },
    });
    expect(context.topPlayers.draftSuggestions.map((row) => row.playerName)).toEqual(["A Player", "B Player"]);
    expect(context.topPlayers.fullBlackbirdRank.map((row) => row.playerName)).toEqual(["Drafted Star", "A Player"]);
    expect(context.scoringSummary.scoringKeys).toEqual(["pass_td", "rec", "sack", "solo_tkl"]);
    expect(context.rosterConstructionSummary.planSummaries).toEqual(["Prioritize WR", "Avoid forcing QB"]);
  });

  it("is deterministic for the same input", () => {
    const first = buildWarRoomAiContext(input());
    const second = buildWarRoomAiContext(input());

    expect(second).toEqual(first);
  });

  it("does not mutate draft room or player input data", () => {
    const source = input();
    const original = JSON.parse(JSON.stringify(source));
    const context = buildWarRoomAiContext(source);

    context.topPlayers.draftSuggestions[0]?.reasons?.push("mutated context copy");
    context.rosterConstructionSummary.planSummaries.push("mutated plan summary");
    context.liveState.warnings.push("mutated warning");

    expect(source).toEqual(original);
    expect(source.draftSuggestions?.find((row) => row.playerId === "a")?.reasons).toEqual(["fits current need"]);
    expect(source.rosterConstruction?.planSummaries).toEqual(["Prioritize WR", "Avoid forcing QB"]);
    expect(source.liveState?.warnings).toEqual([]);
  });

  it("caps top player lists without changing ordering semantics", () => {
    const context = buildWarRoomAiContext({
      ...input(),
      topN: 1,
    });

    expect(context.topPlayers.draftSuggestions).toHaveLength(1);
    expect(context.topPlayers.draftSuggestions[0]?.playerName).toBe("A Player");
    expect(context.topPlayers.availableBlackbirdRank).toHaveLength(1);
    expect(context.topPlayers.availableBlackbirdRank[0]?.playerName).toBe("A Player");
  });
});

function input(): WarRoomAiContextInput {
  return {
    draftRoomId: "room-1",
    leagueId: "league-1",
    league: {
      name: "BestBalls in Hand",
      isDynasty: true,
      isBestBall: true,
      isSuperflex: true,
      tePremium: 1.5,
      rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX"],
      scoringSettings: {
        pass_td: 4,
        rec: 1,
        sack: 6,
        solo_tkl: 2,
      },
    },
    draftState: {
      currentPickNumber: 42,
      currentRound: 4,
      picksUntilMyNextPick: 7,
      myDraftSlot: 6,
      teamCount: 12,
      status: "drafting",
    },
    rosterConstruction: {
      positionCounts: { QB: 1, RB: 2 },
      needs: [{ position: "WR", label: "WR", current: 1, target: 3, need: 2, needLevel: "high" }],
      planSummaries: ["Prioritize WR", "Avoid forcing QB"],
    },
    myRoster: [{ pickNo: 7, round: 1, playerName: "Drafted Star", position: "QB", team: "BUF", rosterId: "1" }],
    recentPicks: [{ pickNo: 41, round: 4, playerName: "Recent Pick", position: "RB", team: "DET", rosterId: "2" }],
    draftSuggestions: [
      { playerId: "b", playerName: "B Player", position: "WR", team: "DAL", draftSuggestionRank: 2, blackbirdRank: 10, reasons: ["falling value"] },
      { playerId: "a", playerName: "A Player", position: "WR", team: "SEA", draftSuggestionRank: 1, blackbirdRank: 5, reasons: ["fits current need"] },
    ],
    fullBlackbirdRank: [
      { playerId: "drafted", playerName: "Drafted Star", position: "QB", team: "BUF", blackbirdRank: 1, drafted: true },
      { playerId: "a", playerName: "A Player", position: "WR", team: "SEA", blackbirdRank: 5 },
    ],
    availableBlackbirdRank: [
      { playerId: "b", playerName: "B Player", position: "WR", team: "DAL", blackbirdRank: 10 },
      { playerId: "a", playerName: "A Player", position: "WR", team: "SEA", blackbirdRank: 5 },
    ],
    riskSummary: ["low IDP confidence on late rows"],
    confidenceSummary: ["projection coverage available for top rows"],
    positionScarcity: [{ position: "WR", summary: "tier thins after next pocket", risk: "medium" }],
    liveState: {
      status: "fresh",
      lastUpdatedAt: "2026-06-17T12:00:00.000Z",
      secondsSinceUpdate: 12,
      warnings: [],
    },
  };
}
