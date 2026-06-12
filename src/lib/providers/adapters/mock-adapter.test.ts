import { describe, expect, it } from "vitest";

import { mockAdapter } from "@/lib/providers/adapters/mock-adapter";

describe("mock adapter", () => {
  it("reports supported capabilities", () => {
    expect(mockAdapter.capabilities.weeklyStats).toBe(true);
    expect(mockAdapter.capabilities.idp).toBe(true);
    expect(mockAdapter.capabilities.teamDefense).toBe(true);
  });

  it("emits normalized weekly, season, projection, and injury records with no network dependency", () => {
    const weekly = mockAdapter.normalizeWeeklyStats?.([{ season: 2026, week: 1, fullName: "Runner One", rawPosition: "RB", stats: { rushing_yards: 110 } }]);
    const season = mockAdapter.normalizeSeasonStats?.([{ season: 2026, fullName: "Defender One", rawPosition: "EDGE", stats: { sacks: 9 } }]);
    const projection = mockAdapter.normalizeProjections?.([{ season: 2026, week: null, fullName: "Receiver One", rawPosition: "WR", projectionType: "rest_of_season", stats: { receiving_yards: 700 } }]);
    const injury = mockAdapter.normalizeInjuries?.([{ season: 2026, week: 2, fullName: "Kicker One", rawPosition: "K", status: "Questionable" }]);

    expect(weekly && "records" in weekly && weekly.records[0].kind).toBe("weekly_stats");
    expect(season && "records" in season && season.records[0].positionGroup).toBe("DL");
    expect(projection && "records" in projection && projection.records[0].kind).toBe("projection");
    expect(injury && "records" in injury && injury.records[0].kind).toBe("injury");
  });
});
