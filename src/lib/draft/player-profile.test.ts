import { describe, expect, it } from "vitest";

import { buildHistoricalStatLine, buildProjectionStatLine, isUuid } from "./player-profile";

describe("player profile stat lines", () => {
  it("builds upcoming QB stat lines from persisted projected components", () => {
    const line = buildProjectionStatLine(
      {
        median: {
          passAttempts: 540,
          passCompletions: 350,
          passYards: 4100,
          passTds: 29,
          interceptions: 11,
          carries: 48,
          rushingYards: 210,
          rushingTds: 2,
        },
      },
      "QB"
    );

    expect(line).toEqual([
      { key: "passAttempts", label: "Pass Att", value: 540 },
      { key: "passCompletions", label: "Pass Cmp", value: 350 },
      { key: "passYards", label: "Pass Yds", value: 4100 },
      { key: "passTds", label: "Pass TD", value: 29 },
      { key: "interceptions", label: "INT", value: 11 },
      { key: "carries", label: "Rush Att", value: 48 },
      { key: "rushingYards", label: "Rush Yds", value: 210 },
      { key: "rushingTds", label: "Rush TD", value: 2 },
    ]);
  });

  it("builds previous season stat lines from provider stats_json aliases", () => {
    const line = buildHistoricalStatLine(
      {
        rec: "86",
        rec_yd: 1210,
        rec_td: 9,
        targets: 132,
        rush_yd: 0,
      },
      "WR"
    );

    expect(line).toEqual([
      { key: "targets", label: "Targets", value: 132 },
      { key: "receptions", label: "Rec", value: 86 },
      { key: "receivingYards", label: "Rec Yds", value: 1210 },
      { key: "receivingTds", label: "Rec TD", value: 9 },
      { key: "rushingYards", label: "Rush Yds", value: 0 },
    ]);
  });

  it("shows IDP historical aliases in player profiles", () => {
    const line = buildHistoricalStatLine(
      {
        solo_tackles: 112,
        assisted_tackles: 42,
        sacks: 8.5,
      },
      "LB"
    );

    expect(line).toEqual([
      { key: "tackles", label: "Tackles", value: 112 },
      { key: "assists", label: "Ast", value: 42 },
      { key: "sacks", label: "Sacks", value: 8.5 },
    ]);
  });

  it("detects UUIDs before route lookup builds id filters", () => {
    expect(isUuid("f85238ff-b2ee-4053-8493-e38c4cb63bd3")).toBe(true);
    expect(isUuid("1234567890")).toBe(false);
  });
});
