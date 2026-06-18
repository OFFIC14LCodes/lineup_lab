import { describe, expect, it } from "vitest";

import { buildWarRoomAiContext } from "./war-room-ai-context";
import { buildWarRoomGmBrief } from "./war-room-gm-brief";
import type { WarRoomAiContextInput } from "./war-room-ai-context-types";

describe("buildWarRoomGmBrief", () => {
  it("creates deterministic template output from War Room context", () => {
    const context = buildWarRoomAiContext(input());
    const first = buildWarRoomGmBrief(context);
    const second = buildWarRoomGmBrief(context);

    expect(second).toEqual(first);
    expect(first.headline).toBe("Pick 42, round 4: A Player is the current top draft suggestion.");
    expect(first.draftStateSummary).toContain("You are on pick 42 in round 4.");
    expect(first.rosterNeedSummary).toContain("WR");
    expect(first.topRecommendationSummary).toContain("Top suggestion: A Player");
    expect(first.scarcitySummary).toContain("WR scarcity");
    expect(first.riskSummary).toContain("low IDP confidence");
  });

  it("returns explicit safety flags showing no AI or mutation behavior", () => {
    const brief = buildWarRoomGmBrief(buildWarRoomAiContext(input()));

    expect(brief.safety).toEqual({
      deterministic: true,
      aiApiCalls: false,
      mutatesDraftState: false,
      changesRankings: false,
    });
  });

  it("handles empty suggestions without misleading advice", () => {
    const brief = buildWarRoomGmBrief(buildWarRoomAiContext({
      ...input(),
      draftSuggestions: [],
      availableBlackbirdRank: [],
      fullBlackbirdRank: [],
    }));

    expect(brief.headline).toBe("Pick 42, round 4: waiting for draft suggestions.");
    expect(brief.topRecommendationSummary).toBe("No top draft suggestion is available yet.");
    expect(brief.watchList.some((item) => item.includes("current top suggestion"))).toBe(false);
  });

  it("includes top recommendation, needs, scarcity, and data gaps when available", () => {
    const brief = buildWarRoomGmBrief(buildWarRoomAiContext(input()));

    expect(brief.watchList).toContain("Monitor A Player as the current top suggestion.");
    expect(brief.watchList).toContain("Track WR need before your next turn.");
    expect(brief.watchList).toContain("Watch WR scarcity: tier thins after next pocket.");
    expect(brief.dataGaps).toEqual(["snap share unavailable for 2 top players"]);
  });

  it("includes sync freshness warnings when draft state is stale", () => {
    const brief = buildWarRoomGmBrief(buildWarRoomAiContext({
      ...input(),
      liveState: {
        status: "stale",
        lastUpdatedAt: "2026-06-17T11:58:00.000Z",
        secondsSinceUpdate: 120,
        warnings: ["Suggestions may be based on stale draft state."],
      },
    }));

    expect(brief.draftStateSummary).toContain("Freshness warning");
    expect(brief.riskSummary).toContain("Suggestions may be based on stale draft state.");
    expect(brief.watchList).toContain("Sync status: Suggestions may be based on stale draft state.");
  });

  it("handles missing context safely", () => {
    const brief = buildWarRoomGmBrief(null);

    expect(brief.headline).toBe("Brief will appear once draft context is available.");
    expect(brief.watchList).toEqual([]);
    expect(brief.dataGaps).toEqual([]);
    expect(brief.safety.aiApiCalls).toBe(false);
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
      needs: [
        { position: "WR", label: "WR", current: 1, target: 3, need: 2, needLevel: "high" },
        { position: "TE", label: "TE", current: 0, target: 1, need: 1, needLevel: "moderate" },
      ],
    },
    myRoster: [{ pickNo: 7, round: 1, playerName: "Drafted Star", position: "QB", team: "BUF", rosterId: "1" }],
    recentPicks: [{ pickNo: 41, round: 4, playerName: "Recent Pick", position: "RB", team: "DET", rosterId: "2" }],
    draftSuggestions: [
      {
        playerId: "b",
        playerName: "B Player",
        position: "WR",
        team: "DAL",
        draftSuggestionRank: 2,
        blackbirdRank: 10,
        valueScore: 70,
        projection: 150,
        confidence: "medium",
        reasons: ["falling value"],
        dataGaps: ["snap share"],
      },
      {
        playerId: "a",
        playerName: "A Player",
        position: "WR",
        team: "SEA",
        draftSuggestionRank: 1,
        blackbirdRank: 5,
        valueScore: 80,
        projection: 170,
        confidence: "high",
        reasons: ["fits current need"],
        dataGaps: ["snap share"],
      },
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
  };
}
