import { describe, expect, it } from "vitest";

import { classifyWeeklyRowCorrection, type ReprocessExpectedRow } from "@/lib/providers/nflverse/reprocess";

function makeExpected(): ReprocessExpectedRow {
  return {
    playerId: "player-1",
    gsisId: "00-0039337",
    season: 2025,
    week: 1,
    seasonType: "regular",
    team: "KC",
    opponent: "BAL",
    positionGroup: "QB",
    stats: {
      pass_cmp: 28,
      pass_att: 40,
      pass_2pt: 0,
      fum_lost: 0
    },
    providerFantasyPoints: 24.1,
    sourceRowNumber: 10,
    rowSha256: "sha"
  };
}

describe("classifyWeeklyRowCorrection", () => {
  it("detects unchanged rows", () => {
    expect(
      classifyWeeklyRowCorrection(makeExpected(), {
        provider_external_id: "00-0039337",
        team: "KC",
        opponent: "BAL",
        position_group: "QB",
        stats_json: {
          pass_cmp: 28,
          pass_att: 40,
          pass_2pt: 0,
          fum_lost: 0
        },
        provider_fantasy_points: 24.1
      }).classification
    ).toBe("unchanged");
  });

  it("detects zero-field enrichment separately from other corrections", () => {
    const plan = classifyWeeklyRowCorrection(makeExpected(), {
      provider_external_id: "00-0039337",
      team: "KC",
      opponent: "BAL",
      position_group: "QB",
      stats_json: {
        pass_cmp: 28,
        pass_att: 40
      },
      provider_fantasy_points: 24.1
    });

    expect(plan.classification).toBe("zero_field_enrichment");
    expect(plan.changedStatKeys).toEqual(["fum_lost", "pass_2pt"]);
  });

  it("detects broader corrections when non-zero values or non-stat fields change", () => {
    const plan = classifyWeeklyRowCorrection(
      {
        playerId: "player-1",
        gsisId: "00-0039337",
        season: 2025,
        week: 1,
        seasonType: "regular",
        team: "KC",
        opponent: "BAL",
        positionGroup: "QB",
        stats: {
          pass_cmp: 30,
          pass_att: 40,
          pass_2pt: 1,
          fum_lost: 1
        },
        providerFantasyPoints: 24.1,
        sourceRowNumber: 10,
        rowSha256: "sha"
      },
      {
        provider_external_id: "00-0039337",
        team: "KC",
        opponent: "DET",
        position_group: "QB",
        stats_json: {
          pass_cmp: 28,
          pass_att: 40,
          pass_2pt: 0,
          fum_lost: 0
        },
        provider_fantasy_points: 24.1
      }
    );

    expect(plan.classification).toBe("correction");
    expect(plan.changedStatKeys).toEqual(["fum_lost", "pass_2pt", "pass_cmp"]);
    expect(plan.changedFieldKeys).toContain("opponent");
  });

  it("treats absent existing rows as missing", () => {
    expect(classifyWeeklyRowCorrection(makeExpected(), null).classification).toBe("missing");
  });
});
