import { describe, expect, it } from "vitest";

import {
  normalizeAdapterRecords,
  normalizeProjectionRecord,
  normalizeWeeklyStatsRecord,
  prepareProjectionCanonicalInput,
  prepareWeeklyStatsCanonicalInput
} from "@/lib/providers/adapters/normalize";

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

describe("adapter normalization", () => {
  it("produces partial success with issues for mixed payloads", () => {
    const result = normalizeAdapterRecords(
      [{ season: 2026, week: 1, fullName: "Player One", stats: {} }, "bad-row"],
      (value) => normalizeWeeklyStatsRecord(value, "manual")
    );

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.issues[0].code).toBe("INVALID_SOURCE_RECORD");
  });

  it("keeps kicker stat fields through canonical conversion", () => {
    const record = normalizeWeeklyStatsRecord(
      {
        season: 2026,
        week: 2,
        fullName: "Kicker One",
        rawPosition: "PK",
        stats: { fg_made_50_plus: 2, xp_made: 3 }
      },
      "manual"
    );

    const canonical = prepareWeeklyStatsCanonicalInput(record, PLAYER_ID);
    expect(canonical.kind).toBe("weekly_stats");
    if (canonical.kind !== "weekly_stats") {
      throw new Error("Expected weekly_stats canonical record.");
    }
    expect(canonical.input.position_group).toBe("K");
    expect(canonical.input.stats_json.fg_made_50_plus).toBe(2);
  });

  it("normalizes DL/LB/DB groups and preserves raw defensive stats", () => {
    const dl = normalizeWeeklyStatsRecord({ season: 2026, week: 3, fullName: "Edge Guy", rawPosition: "EDGE", stats: { sacks: 2 } }, "manual");
    const lb = normalizeWeeklyStatsRecord({ season: 2026, week: 3, fullName: "Backer Guy", rawPosition: "ILB", stats: { solo_tackles: 8 } }, "manual");
    const db = normalizeWeeklyStatsRecord({ season: 2026, week: 3, fullName: "Safety Guy", rawPosition: "FS", stats: { interceptions: 1 } }, "manual");

    expect(dl.positionGroup).toBe("DL");
    expect(lb.positionGroup).toBe("LB");
    expect(db.positionGroup).toBe("DB");
    expect(lb.stats.solo_tackles).toBe(8);
  });

  it("keeps projection with null week valid", () => {
    const record = normalizeProjectionRecord(
      {
        season: 2026,
        week: null,
        fullName: "Receiver One",
        rawPosition: "WR",
        projectionType: "rest_of_season",
        stats: { receiving_yards: 600 }
      },
      "manual"
    );

    const canonical = prepareProjectionCanonicalInput(record, PLAYER_ID);
    expect(canonical.kind).toBe("projection");
    if (canonical.kind !== "projection") {
      throw new Error("Expected projection canonical record.");
    }
    expect(canonical.input.week).toBeNull();
    expect(canonical.input.version).toBe("current");
  });
});
