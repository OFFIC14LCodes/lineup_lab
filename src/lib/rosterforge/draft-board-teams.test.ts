import { describe, expect, it } from "vitest";

import { buildDraftBoardTeams, readDraftOrder } from "@/lib/rosterforge/draft-board-teams";

describe("draft board teams", () => {
  const rosters = [
    { platform_roster_id: "1", owner_platform_user_id: "user-a", owner_display_name: "Alpha" },
    { platform_roster_id: "2", owner_platform_user_id: "user-b", owner_display_name: "Bravo" },
  ];

  it("prefers Sleeper draft_order user slots over roster IDs", () => {
    const teams = buildDraftBoardTeams({
      rosters,
      roomMetadata: { draft_order: { "user-a": 2, "user-b": 1 } },
      teamCount: 2,
    });

    expect(teams.map((team) => `${team.draftSlot}:${team.label}:${team.mappingSource}`)).toEqual([
      "1:Bravo:draft_order_user",
      "2:Alpha:draft_order_user",
    ]);
  });

  it("uses pick history before roster-id fallback", () => {
    const teams = buildDraftBoardTeams({
      rosters,
      picks: [
        { platform_roster_id: "1", pick_in_round: 2 },
        { platform_roster_id: "2", pick_in_round: 1 },
      ],
      teamCount: 2,
    });

    expect(teams.map((team) => `${team.draftSlot}:${team.rosterId}:${team.mappingSource}`)).toEqual([
      "1:2:pick_history",
      "2:1:pick_history",
    ]);
  });

  it("reads nested draft order metadata", () => {
    expect(Array.from(readDraftOrder({ metadata: { draft_order: { "user-a": "3" } } }))).toEqual([["user-a", 3]]);
  });
});
