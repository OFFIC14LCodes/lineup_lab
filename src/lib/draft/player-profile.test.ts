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
      { key: "pass_yd", label: "Pass Yds", value: 4100 },
      { key: "pass_td", label: "Pass TD", value: 29 },
      { key: "pass_int", label: "INT", value: 11 },
      { key: "pass_att", label: "Pass Att", value: 540 },
      { key: "pass_cmp", label: "Pass Cmp", value: 350 },
      { key: "rush_att", label: "Rush Att", value: 48 },
      { key: "rush_yd", label: "Rush Yds", value: 210 },
      { key: "rush_td", label: "Rush TD", value: 2 },
    ]);
  });

  it("builds IDP projected stat lines from canonical comprehensive components", () => {
    const line = buildProjectionStatLine(
      {
        median: {
          solo_tkl: 78,
          ast_tkl: 35,
          total_tkl: 113,
          tfl: 7,
          sack: 4,
          pass_def: 6,
          def_int: 1,
          ff: 2,
        },
      },
      "LB"
    );

    expect(line).toEqual([
      { key: "solo_tkl", label: "Solo", value: 78 },
      { key: "ast_tkl", label: "Ast", value: 35 },
      { key: "total_tkl", label: "Total Tkl", value: 113 },
      { key: "tfl", label: "TFL", value: 7 },
      { key: "sack", label: "Sacks", value: 4 },
      { key: "pass_def", label: "PD", value: 6 },
      { key: "def_int", label: "Def INT", value: 1 },
      { key: "ff", label: "FF", value: 2 },
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
      { key: "target", label: "Targets", value: 132 },
      { key: "rec", label: "Rec", value: 86 },
      { key: "rec_yd", label: "Rec Yds", value: 1210 },
      { key: "rec_td", label: "Rec TD", value: 9 },
      { key: "rush_yd", label: "Rush Yds", value: 0 },
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
      { key: "solo_tkl", label: "Solo", value: 112 },
      { key: "ast_tkl", label: "Ast", value: 42 },
      { key: "sack", label: "Sacks", value: 8.5 },
    ]);
  });

  it("detects UUIDs before route lookup builds id filters", () => {
    expect(isUuid("f85238ff-b2ee-4053-8493-e38c4cb63bd3")).toBe(true);
    expect(isUuid("1234567890")).toBe(false);
  });
});
