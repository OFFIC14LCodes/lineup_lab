import { describe, expect, it } from "vitest";

import {
  classifyDstScoringEvent,
  deriveDstAllowanceForGames,
  deriveOfficialNetYards,
} from "./dst-allowance";

function play(overrides: Record<string, string>) {
  return {
    game_id: "2025_01_BUF_KC",
    play_id: "1",
    week: "1",
    season_type: "REG",
    posteam: "BUF",
    defteam: "KC",
    play_type: "pass",
    desc: "",
    touchdown: "0",
    pass_touchdown: "0",
    rush_touchdown: "0",
    return_touchdown: "0",
    interception: "0",
    field_goal_result: "",
    extra_point_result: "",
    two_point_conv_result: "",
    defensive_two_point_conv: "0",
    safety: "0",
    kickoff_attempt: "0",
    punt_attempt: "0",
    punt_blocked: "0",
    field_goal_attempt: "0",
    fumble: "0",
    fumble_lost: "0",
    play_deleted: "0",
    two_point_attempt: "0",
    defensive_two_point_attempt: "0",
    pass_attempt: "0",
    rush_attempt: "0",
    sack: "0",
    passing_yards: "",
    rushing_yards: "",
    yards_gained: "0",
    return_yards: "0",
    td_team: "",
    ...overrides,
  };
}

describe("classifyDstScoringEvent", () => {
  it("charges ordinary offensive touchdowns", () => {
    const event = classifyDstScoringEvent(play({ touchdown: "1", pass_touchdown: "1", td_team: "BUF" }));
    expect(event?.classification).toBe("charged_to_dst");
    expect(event?.chargedTeam).toBe("KC");
    expect(event?.points).toBe(6);
  });

  it("excludes pick-six touchdown points from DST points allowed", () => {
    const event = classifyDstScoringEvent(play({
      posteam: "KC",
      defteam: "BUF",
      touchdown: "1",
      interception: "1",
      return_touchdown: "1",
      td_team: "BUF",
    }));
    expect(event?.type).toBe("pick_six_touchdown");
    expect(event?.classification).toBe("excluded_from_dst");
    expect(event?.chargedTeam).toBe("KC");
  });

  it("charges PATs after a pick-six independently", () => {
    const event = classifyDstScoringEvent(play({
      posteam: "BUF",
      defteam: "KC",
      play_type: "extra_point",
      extra_point_result: "good",
    }));
    expect(event?.classification).toBe("conversion_always_charged");
    expect(event?.chargedTeam).toBe("KC");
    expect(event?.points).toBe(1);
  });

  it("charges kickoff, punt, and blocked-punt return touchdowns", () => {
    const kickoff = classifyDstScoringEvent(play({ play_type: "kickoff", kickoff_attempt: "1", touchdown: "1", return_touchdown: "1", td_team: "BUF" }));
    const punt = classifyDstScoringEvent(play({ play_type: "punt", punt_attempt: "1", touchdown: "1", return_touchdown: "1", td_team: "BUF" }));
    const blockedPunt = classifyDstScoringEvent(play({ play_type: "punt", punt_attempt: "1", punt_blocked: "1", touchdown: "1", return_touchdown: "1", td_team: "BUF" }));

    expect(kickoff?.type).toBe("kickoff_return_touchdown");
    expect(punt?.type).toBe("punt_return_touchdown");
    expect(blockedPunt?.type).toBe("blocked_punt_return_touchdown");
    expect([kickoff, punt, blockedPunt].map((event) => event?.classification)).toEqual([
      "charged_to_dst",
      "charged_to_dst",
      "charged_to_dst",
    ]);
  });

  it("leaves safety and defensive fumble-return touchdown behavior unresolved", () => {
    const safety = classifyDstScoringEvent(play({ posteam: "KC", defteam: "BUF", safety: "1" }));
    const fumbleReturn = classifyDstScoringEvent(play({
      posteam: "KC",
      defteam: "BUF",
      touchdown: "1",
      fumble: "1",
      fumble_lost: "1",
      td_team: "BUF",
    }));

    expect(safety?.classification).toBe("unresolved_edge_case");
    expect(fumbleReturn?.classification).toBe("unresolved_edge_case");
    expect(fumbleReturn?.type).toBe("defensive_fumble_return_td");
  });

  it("decomposes possession-change miscellaneous touchdowns", () => {
    const event = classifyDstScoringEvent(play({
      posteam: "TEN",
      defteam: "ARI",
      touchdown: "1",
      interception: "1",
      fumble: "1",
      fumble_lost: "1",
      return_touchdown: "1",
      td_team: "TEN",
    }));

    expect(event?.type).toBe("possession_change_misc_td");
    expect(event?.classification).toBe("unresolved_edge_case");
  });

  it("decomposes offensive fumble recovery and blocked field-goal return touchdowns", () => {
    const offensiveRecovery = classifyDstScoringEvent(play({
      play_type: "run",
      touchdown: "1",
      fumble: "1",
      fumble_lost: "0",
      td_team: "BUF",
    }));
    const blockedFieldGoalReturn = classifyDstScoringEvent(play({
      posteam: "BUF",
      defteam: "KC",
      play_type: "field_goal",
      field_goal_attempt: "1",
      touchdown: "1",
      return_touchdown: "1",
      td_team: "KC",
    }));

    expect(offensiveRecovery?.type).toBe("offensive_fumble_recovery_td");
    expect(offensiveRecovery?.classification).toBe("unresolved_edge_case");
    expect(blockedFieldGoalReturn?.type).toBe("blocked_field_goal_return_td");
    expect(blockedFieldGoalReturn?.classification).toBe("unresolved_edge_case");
  });

  it("keeps defensive two-point returns unresolved", () => {
    const event = classifyDstScoringEvent(play({
      two_point_conv_result: "failure",
      defensive_two_point_conv: "1",
    }));

    expect(event?.type).toBe("defensive_two_point_return");
    expect(event?.classification).toBe("unresolved_edge_case");
  });
});

describe("deriveOfficialNetYards", () => {
  it("sums net passing, rushing, and sack deductions", () => {
    const totals = deriveOfficialNetYards([
      play({ pass_attempt: "1", passing_yards: "20" }),
      play({ rush_attempt: "1", rushing_yards: "7", play_type: "run" }),
      play({ pass_attempt: "1", sack: "1", yards_gained: "-8" }),
    ]);
    expect(totals.get("2025_01_BUF_KC|BUF")).toBe(19);
  });

  it("excludes two-point and deleted plays from net yards", () => {
    const totals = deriveOfficialNetYards([
      play({ pass_attempt: "1", passing_yards: "20" }),
      play({ pass_attempt: "1", passing_yards: "2", two_point_attempt: "1" }),
      play({ rush_attempt: "1", rushing_yards: "99", play_deleted: "1" }),
    ]);
    expect(totals.get("2025_01_BUF_KC|BUF")).toBe(20);
  });
});

describe("deriveDstAllowanceForGames", () => {
  const game = {
    gameId: "2025_01_BUF_KC",
    week: 1,
    homeTeamId: "BUF",
    awayTeamId: "KC",
    homeScore: 7,
    awayScore: 0,
    homeYardsAllowedStored: 0,
    awayYardsAllowedStored: 20,
  };

  it("reconciles charged, excluded, and conversion points against final score", () => {
    const report = deriveDstAllowanceForGames([game], [
      play({ posteam: "KC", defteam: "BUF", touchdown: "1", interception: "1", return_touchdown: "1", td_team: "BUF" }),
      play({ posteam: "BUF", defteam: "KC", play_type: "extra_point", extra_point_result: "good" }),
      play({ posteam: "BUF", defteam: "KC", pass_attempt: "1", passing_yards: "20" }),
    ]);
    const kc = report.teamResults.find((row) => row.teamId === "KC");
    expect(kc?.dstPointsAllowed).toBe(1);
    expect(kc?.excludedNonDstTouchdownPoints).toBe(6);
    expect(kc?.opponentFinalScore).toBe(7);
    expect(kc?.reconciliationStatus).toBe("verified");
  });

  it("reports unresolved team rows when rare-event semantics are unresolved", () => {
    const report = deriveDstAllowanceForGames([{ ...game, homeScore: 2 }], [
      play({ posteam: "KC", defteam: "BUF", safety: "1" }),
    ]);
    expect(report.coverage.unresolvedEvents).toBe(1);
    expect(report.coverage.unresolvedTeamRows).toBeGreaterThan(0);
  });

  it("models optional special-teams return yards separately", () => {
    const base = deriveDstAllowanceForGames([game], [
      play({ posteam: "BUF", defteam: "KC", pass_attempt: "1", passing_yards: "20" }),
      play({ posteam: "BUF", defteam: "KC", play_type: "kickoff", kickoff_attempt: "1", return_yards: "40" }),
    ]);
    const withReturns = deriveDstAllowanceForGames([game], [
      play({ posteam: "BUF", defteam: "KC", pass_attempt: "1", passing_yards: "20" }),
      play({ posteam: "BUF", defteam: "KC", play_type: "kickoff", kickoff_attempt: "1", return_yards: "40" }),
    ], { includeSpecialTeamsReturnYards: true });

    expect(base.teamResults.find((row) => row.teamId === "KC")?.effectiveDstYardsAllowed).toBe(20);
    expect(withReturns.teamResults.find((row) => row.teamId === "KC")?.effectiveDstYardsAllowed).toBe(60);
  });
});
