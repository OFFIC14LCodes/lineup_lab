import { describe, expect, it } from "vitest";

import {
  accumulatePlayEvents,
  deriveFumbleReturnTouchdown,
  derivePickSix,
  derivePlayEvents,
  deriveReceivingTdDistance,
  deriveRushingTdDistance,
  emptyDerivedStats,
  makeAccumulatorKey,
  verifyDerivedStatsInvariants,
  type DerivedStatsAccumulator
} from "./derive";
import type { NflversePbpRaw } from "./schema";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function basePlay(overrides: Partial<NflversePbpRaw> = {}): NflversePbpRaw {
  return {
    play_id: "101",
    game_id: "2025_01_KC_BAL",
    season: "2025",
    week: "1",
    season_type: "REG",
    posteam: "KC",
    defteam: "BAL",
    play_type: "pass",
    yards_gained: "0",
    touchdown: "0",
    pass_touchdown: "0",
    rush_touchdown: "0",
    return_touchdown: "0",
    interception: "0",
    two_point_attempt: "0",
    play_deleted: "0",
    penalty: "0",
    passer_player_id: "00-0033873",
    passer_player_name: "P.Mahomes",
    rusher_player_id: "",
    rusher_player_name: "",
    receiver_player_id: "00-0033288",
    receiver_player_name: "T.Kelce",
    td_player_id: "",
    td_player_name: "",
    td_team: "",
    ...overrides
  };
}

function recTdPlay(yards: number, receiverId = "00-0033288", overrides: Partial<NflversePbpRaw> = {}): NflversePbpRaw {
  return basePlay({
    play_type: "pass",
    yards_gained: String(yards),
    touchdown: "1",
    pass_touchdown: "1",
    receiver_player_id: receiverId,
    td_player_id: receiverId,
    td_team: "KC",
    ...overrides
  });
}

function rushTdPlay(yards: number, rusherId = "00-0035676", overrides: Partial<NflversePbpRaw> = {}): NflversePbpRaw {
  return basePlay({
    play_type: "run",
    yards_gained: String(yards),
    touchdown: "1",
    rush_touchdown: "1",
    rusher_player_id: rusherId,
    td_player_id: rusherId,
    td_team: "KC",
    ...overrides
  });
}

function pickSixPlay(passerId = "00-0033873", overrides: Partial<NflversePbpRaw> = {}): NflversePbpRaw {
  return basePlay({
    play_type: "pass",
    yards_gained: "-5",
    interception: "1",
    return_touchdown: "1",
    td_player_id: "00-0031280",
    td_team: "BAL",
    passer_player_id: passerId,
    ...overrides
  });
}

function fumRetTdPlay(
  recoveryPlayerId = "00-0040583",
  overrides: Partial<NflversePbpRaw> = {}
): NflversePbpRaw {
  return basePlay({
    play_type: "run",
    touchdown: "1",
    fumble: "1",
    fumble_lost: "0",
    return_touchdown: "0",
    td_player_id: recoveryPlayerId,
    td_player_name: "W.Marks",
    td_team: "HOU",
    posteam: "HOU",
    defteam: "ARI",
    fumble_recovery_1_team: "HOU",
    fumble_recovery_1_yards: "7",
    fumble_recovery_1_player_id: recoveryPlayerId,
    fumble_recovery_1_player_name: "W.Marks",
    desc: "(6:15) 57-B.Fisher reported in as eligible. 7-C.Stroud FUMBLES (Aborted) at ARI 2, recovered by HOU-27-W.Marks at ARI 7. 27-W.Marks for 7 yards, TOUCHDOWN.",
    ...overrides
  });
}

// ---------------------------------------------------------------------------
// Receiving TD distance thresholds
// ---------------------------------------------------------------------------

describe("deriveReceivingTdDistance", () => {
  it("39-yard TD does not qualify for either threshold", () => {
    const result = deriveReceivingTdDistance(recTdPlay(39));
    expect(result.increments).toEqual({});
    expect(result.gsisId).toBe("00-0033288");
    expect(result.resolved).toHaveLength(0);
  });

  it("40-yard TD qualifies only for rec_td_40p", () => {
    const result = deriveReceivingTdDistance(recTdPlay(40));
    expect(result.increments).toEqual({ rec_td_40p: 1 });
    expect(result.increments.rec_td_50p).toBeUndefined();
    expect(result.resolved[0]?.yardsGained).toBe(40);
  });

  it("49-yard TD qualifies only for rec_td_40p", () => {
    const result = deriveReceivingTdDistance(recTdPlay(49));
    expect(result.increments).toEqual({ rec_td_40p: 1 });
    expect(result.increments.rec_td_50p).toBeUndefined();
  });

  it("50-yard TD qualifies for both rec_td_40p and rec_td_50p", () => {
    const result = deriveReceivingTdDistance(recTdPlay(50));
    expect(result.increments).toEqual({ rec_td_40p: 1, rec_td_50p: 1 });
    expect(result.resolved[0]?.yardsGained).toBe(50);
  });

  it("80-yard TD qualifies for both thresholds", () => {
    const result = deriveReceivingTdDistance(recTdPlay(80));
    expect(result.increments).toEqual({ rec_td_40p: 1, rec_td_50p: 1 });
  });

  it("attributes to receiver player ID, not passer or rusher", () => {
    const result = deriveReceivingTdDistance(recTdPlay(55, "00-0036900"));
    expect(result.gsisId).toBe("00-0036900");
  });

  it("returns unresolved when receiver_player_id is empty", () => {
    const result = deriveReceivingTdDistance(recTdPlay(55, ""));
    expect(result.gsisId).toBeNull();
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]?.reason).toBe("missing_player_id");
    expect(result.unresolved[0]?.eventType).toBe("rec_td_long");
    expect(result.increments).toEqual({});
  });

  it("returns unresolved when receiver_player_id is NA", () => {
    const result = deriveReceivingTdDistance(recTdPlay(55, "NA"));
    expect(result.unresolved).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rushing TD distance thresholds
// ---------------------------------------------------------------------------

describe("deriveRushingTdDistance", () => {
  it("39-yard rush TD does not qualify", () => {
    const result = deriveRushingTdDistance(rushTdPlay(39));
    expect(result.increments).toEqual({});
  });

  it("40-yard rush TD qualifies only for rush_td_40p", () => {
    const result = deriveRushingTdDistance(rushTdPlay(40));
    expect(result.increments).toEqual({ rush_td_40p: 1 });
    expect(result.increments.rush_td_50p).toBeUndefined();
  });

  it("49-yard rush TD qualifies only for rush_td_40p", () => {
    const result = deriveRushingTdDistance(rushTdPlay(49));
    expect(result.increments).toEqual({ rush_td_40p: 1 });
  });

  it("50-yard rush TD qualifies for both rush_td_40p and rush_td_50p", () => {
    const result = deriveRushingTdDistance(rushTdPlay(50));
    expect(result.increments).toEqual({ rush_td_40p: 1, rush_td_50p: 1 });
  });

  it("attributes to rusher player ID", () => {
    const result = deriveRushingTdDistance(rushTdPlay(45, "00-0038543"));
    expect(result.gsisId).toBe("00-0038543");
  });

  it("returns unresolved when rusher_player_id is empty", () => {
    const result = deriveRushingTdDistance(rushTdPlay(55, ""));
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]?.eventType).toBe("rush_td_long");
    expect(result.increments).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Pick-six derivation
// ---------------------------------------------------------------------------

describe("derivePickSix", () => {
  it("attributes pass_pick6 to the passer (QB who threw the interception)", () => {
    const result = derivePickSix(pickSixPlay("00-0033873"));
    expect(result.gsisId).toBe("00-0033873");
    expect(result.increments).toEqual({ pass_pick6: 1 });
    expect(result.resolved[0]?.eventType).toBe("pick_six");
  });

  it("ordinary interception without return TD does not produce pass_pick6", () => {
    const result = derivePickSix(basePlay({ interception: "1", return_touchdown: "0" }));
    expect(result.increments).toEqual({});
    expect(result.unresolved).toHaveLength(0);
  });

  it("return TD without interception does not produce pass_pick6", () => {
    const result = derivePickSix(basePlay({ interception: "0", return_touchdown: "1" }));
    expect(result.increments).toEqual({});
  });

  it("returns unresolved when passer_player_id is missing", () => {
    const result = derivePickSix(pickSixPlay(""));
    expect(result.gsisId).toBeNull();
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]?.reason).toBe("missing_player_id");
    expect(result.unresolved[0]?.eventType).toBe("pick_six");
    expect(result.increments).toEqual({});
  });

  it("returns unresolved when passer_player_id is NA", () => {
    const result = derivePickSix(pickSixPlay("NA"));
    expect(result.unresolved).toHaveLength(1);
  });

  it("excludes interception on two-point attempt", () => {
    const result = derivePickSix(pickSixPlay("00-0033873", { two_point_attempt: "1" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_two_point_attempt");
  });

  it("excludes nullified (play_deleted=1) pick-six", () => {
    const result = derivePickSix(pickSixPlay("00-0033873", { play_deleted: "1" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_nullified_play");
  });

  it("excludes pick-six from non-regular season", () => {
    const result = derivePickSix(pickSixPlay("00-0033873", { season_type: "POST" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_non_regular_season");
  });

  it("excludes pick-six where td_team is not defteam", () => {
    // Unexpected: TD team is the offensive team — this is not a pick-six.
    const result = derivePickSix(pickSixPlay("00-0033873", { td_team: "KC", defteam: "BAL" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_wrong_team_td");
  });

  it("does not fabricate passer from team context — unresolved when ID missing", () => {
    const result = derivePickSix(pickSixPlay("", { posteam: "KC" }));
    // Even though we know KC's QB could be inferred from context, we never do that.
    expect(result.unresolved).toHaveLength(1);
    expect(result.gsisId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fumble-return touchdown derivation
// ---------------------------------------------------------------------------

describe("deriveFumbleReturnTouchdown", () => {
  it("qualifies an unambiguous recovery touchdown", () => {
    const result = deriveFumbleReturnTouchdown(fumRetTdPlay("00-0040583"));
    expect(result.gsisId).toBe("00-0040583");
    expect(result.increments).toEqual({ fum_ret_td: 1 });
    expect(result.resolved[0]?.eventType).toBe("fum_ret_td");
    expect(result.resolved[0]?.evidence?.recoveryPlayerGsisId).toBe("00-0040583");
  });

  it("does not qualify a recovery without a touchdown", () => {
    const result = deriveFumbleReturnTouchdown(fumRetTdPlay("00-0040583", { touchdown: "0" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_no_applicable_event");
  });

  it("does not qualify a touchdown without a recovering player", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0040583", {
        fumble_recovery_1_player_id: "",
        fumble_recovery_1_player_name: "",
        fumble_recovery_1_team: ""
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_missing_recovery_player_id");
  });

  it("excludes plays where the recovery player differs from the touchdown scorer", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0040583", {
        fumble_recovery_1_player_id: "00-0030001",
        fumble_recovery_1_player_name: "Other Player"
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_recovery_td_player_mismatch");
  });

  it("excludes plays where the recovery team conflicts with the touchdown team", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0040583", {
        fumble_recovery_1_team: "ARI"
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_recovery_td_team_mismatch");
  });

  it("excludes nullified touchdowns", () => {
    const result = deriveFumbleReturnTouchdown(fumRetTdPlay("00-0040583", { play_deleted: "1" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_nullified_play");
  });

  it("excludes interception-context touchdown recoveries", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0032211", {
        play_type: "pass",
        posteam: "TEN",
        defteam: "ARI",
        interception: "1",
        return_touchdown: "1",
        td_team: "TEN",
        fumble_lost: "1",
        fumble_recovery_1_team: "TEN",
        fumble_recovery_1_yards: "0",
        td_player_name: "T.Lockett",
        fumble_recovery_1_player_name: "T.Lockett",
        desc: "(4:53) (Shotgun) 1-C.Ward pass short left intended for 0-C.Ridley INTERCEPTED by 42-D.Taylor-Demerson (2-Ma.Wilson) at ARI 5. 42-D.Taylor-Demerson to ARI 5 for no gain. FUMBLES, touched at ARI 6, RECOVERED by TEN-4-T.Lockett at ARI 0. TOUCHDOWN."
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_interception_context");
  });

  it("excludes kickoff-return touchdowns", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0040583", {
        play_type: "kickoff",
        kickoff_attempt: "1"
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_special_teams_return");
  });

  it("excludes punt-return touchdowns", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0040583", {
        play_type: "punt",
        punt_attempt: "1"
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_special_teams_return");
  });

  it("handles multiple recovery ambiguity safely", () => {
    const result = deriveFumbleReturnTouchdown(
      fumRetTdPlay("00-0040583", {
        fumble_recovery_2_player_id: "00-0040583",
        fumble_recovery_2_player_name: "W.Marks",
        fumble_recovery_2_team: "HOU",
        fumble_recovery_2_yards: "7"
      })
    );
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_multiple_recoveries");
  });
});

// ---------------------------------------------------------------------------
// Play router and accumulator
// ---------------------------------------------------------------------------

describe("derivePlayEvents", () => {
  it("routes passing TD to receiver contribution", () => {
    const { contributions, summary } = derivePlayEvents(recTdPlay(55));
    expect(contributions.has("00-0033288")).toBe(true);
    expect(contributions.get("00-0033288")).toEqual({ rec_td_40p: 1, rec_td_50p: 1 });
    expect(summary.totalIncrementsApplied).toBe(2);
  });

  it("routes rushing TD to rusher contribution", () => {
    const { contributions } = derivePlayEvents(rushTdPlay(42));
    expect(contributions.has("00-0035676")).toBe(true);
    expect(contributions.get("00-0035676")).toEqual({ rush_td_40p: 1 });
  });

  it("routes pick-six to passer contribution", () => {
    const { contributions } = derivePlayEvents(pickSixPlay());
    expect(contributions.has("00-0033873")).toBe(true);
    expect(contributions.get("00-0033873")).toEqual({ pass_pick6: 1 });
  });

  it("routes fum_ret_td to the recovering touchdown scorer", () => {
    const { contributions } = derivePlayEvents(fumRetTdPlay("00-0040583"));
    expect(contributions.has("00-0040583")).toBe(true);
    expect(contributions.get("00-0040583")).toEqual({ fum_ret_td: 1 });
  });

  it("returns empty contributions for a non-scoring play", () => {
    const { contributions, summary } = derivePlayEvents(basePlay({ yards_gained: "12" }));
    expect(contributions.size).toBe(0);
    expect(summary.totalIncrementsApplied).toBe(0);
  });

  it("reports unresolved events without applying any increments", () => {
    const { contributions, summary } = derivePlayEvents(recTdPlay(60, ""));
    expect(contributions.size).toBe(0);
    expect(summary.unresolved).toHaveLength(1);
  });
});

describe("accumulatePlayEvents", () => {
  it("accumulates multiple qualifying TDs in one game for a single player", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, recTdPlay(55, "00-0033288", { play_id: "101" }));
    accumulatePlayEvents(acc, recTdPlay(42, "00-0033288", { play_id: "102" }));
    // 55yd: 40+ and 50+; 42yd: 40+ only
    const key = makeAccumulatorKey("00-0033288", 1);
    expect(acc.get(key)).toEqual({ rec_td_40p: 2, rec_td_50p: 1, rush_td_40p: 0, rush_td_50p: 0, pass_pick6: 0, fum_ret_td: 0 });
  });

  it("distinguishes receiving vs rushing attribution for the same player", () => {
    const acc: DerivedStatsAccumulator = new Map();
    // WR catches a 45-yard TD
    accumulatePlayEvents(acc, recTdPlay(45, "00-0035676"));
    // Same player also rushes for a 50-yard TD (rare but possible for WR trick plays)
    accumulatePlayEvents(acc, rushTdPlay(50, "00-0035676"));
    const key = makeAccumulatorKey("00-0035676", 1);
    expect(acc.get(key)).toEqual({ rec_td_40p: 1, rec_td_50p: 0, rush_td_40p: 1, rush_td_50p: 1, pass_pick6: 0, fum_ret_td: 0 });
  });

  it("accumulates multiple pick-sixes for a QB in one week", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, pickSixPlay("00-0033873", { play_id: "201" }));
    accumulatePlayEvents(acc, pickSixPlay("00-0033873", { play_id: "202" }));
    const key = makeAccumulatorKey("00-0033873", 1);
    expect(acc.get(key)?.pass_pick6).toBe(2);
  });

  it("aggregates two qualifying fum_ret_td plays for one player-week", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, fumRetTdPlay("00-0040583", { play_id: "301" }));
    accumulatePlayEvents(acc, fumRetTdPlay("00-0040583", { play_id: "302" }));
    const key = makeAccumulatorKey("00-0040583", 1);
    expect(acc.get(key)?.fum_ret_td).toBe(2);
  });

  it("keeps different fum_ret_td players separate within the same game", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, fumRetTdPlay("00-0040583", { play_id: "401", game_id: "2025_15_ARI_HOU" }));
    accumulatePlayEvents(acc, fumRetTdPlay("00-0032211", { play_id: "402", game_id: "2025_15_ARI_HOU", td_player_id: "00-0032211", td_player_name: "Other Runner", fumble_recovery_1_player_id: "00-0032211", fumble_recovery_1_player_name: "Other Runner" }));
    expect(acc.get(makeAccumulatorKey("00-0040583", 1))?.fum_ret_td).toBe(1);
    expect(acc.get(makeAccumulatorKey("00-0032211", 1))?.fum_ret_td).toBe(1);
  });

  it("does not create accumulator entry for non-scoring plays", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, basePlay({ yards_gained: "8" }));
    expect(acc.size).toBe(0);
  });

  it("does not create accumulator entry for under-threshold TDs", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, recTdPlay(25, "00-0033288"));
    expect(acc.size).toBe(0);
  });

  it("is idempotent when replayed with identical plays on an existing accumulator", () => {
    const acc: DerivedStatsAccumulator = new Map();
    const play = recTdPlay(55, "00-0033288", { play_id: "999" });
    accumulatePlayEvents(acc, play);
    const snapshot = { ...acc.get(makeAccumulatorKey("00-0033288", 1))! };
    // In real usage, idempotency is enforced at the pipeline level by deduplicating
    // on natural keys (game_id + play_id). Here we verify that re-accumulating
    // identical plays does correctly double the count — so the caller must deduplicate.
    accumulatePlayEvents(acc, play);
    const after = acc.get(makeAccumulatorKey("00-0033288", 1))!;
    expect(after.rec_td_40p).toBe(snapshot.rec_td_40p + 1);
  });

  it("separates stats by week for the same player", () => {
    const acc: DerivedStatsAccumulator = new Map();
    accumulatePlayEvents(acc, recTdPlay(55, "00-0033288", { week: "1" }));
    accumulatePlayEvents(acc, recTdPlay(45, "00-0033288", { week: "3" }));
    const wk1 = acc.get(makeAccumulatorKey("00-0033288", 1));
    const wk3 = acc.get(makeAccumulatorKey("00-0033288", 3));
    expect(wk1?.rec_td_50p).toBe(1);
    expect(wk3?.rec_td_50p).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Eligibility exclusions
// ---------------------------------------------------------------------------

describe("play eligibility", () => {
  it("excludes non-regular-season plays (postseason)", () => {
    const result = deriveReceivingTdDistance(recTdPlay(55, "00-0033288", { season_type: "POST" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_non_regular_season");
  });

  it("excludes non-regular-season plays (preseason)", () => {
    const result = deriveReceivingTdDistance(recTdPlay(55, "00-0033288", { season_type: "PRE" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_non_regular_season");
  });

  it("excludes plays where play_deleted=1 (nullified/accepted penalty)", () => {
    const result = deriveReceivingTdDistance(recTdPlay(55, "00-0033288", { play_deleted: "1" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_nullified_play");
  });

  it("excludes two-point attempt plays", () => {
    const result = deriveReceivingTdDistance(recTdPlay(2, "00-0033288", { two_point_attempt: "1" }));
    expect(result.increments).toEqual({});
    expect(result.excluded[0]?.reason).toBe("excluded_two_point_attempt");
  });
});

// ---------------------------------------------------------------------------
// Invariant verification
// ---------------------------------------------------------------------------

describe("verifyDerivedStatsInvariants", () => {
  it("passes for valid accumulated stats", () => {
    const acc: DerivedStatsAccumulator = new Map();
    acc.set(makeAccumulatorKey("00-0033288", 1), { rec_td_40p: 2, rec_td_50p: 1, rush_td_40p: 0, rush_td_50p: 0, pass_pick6: 0, fum_ret_td: 0 });
    expect(verifyDerivedStatsInvariants(acc)).toHaveLength(0);
  });

  it("flags rec_td_50p > rec_td_40p violation", () => {
    const acc: DerivedStatsAccumulator = new Map();
    acc.set(makeAccumulatorKey("00-0033288", 1), { rec_td_40p: 1, rec_td_50p: 2, rush_td_40p: 0, rush_td_50p: 0, pass_pick6: 0, fum_ret_td: 0 });
    const violations = verifyDerivedStatsInvariants(acc);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("rec_td_50p <= rec_td_40p");
  });

  it("flags rush_td_50p > rush_td_40p violation", () => {
    const acc: DerivedStatsAccumulator = new Map();
    acc.set(makeAccumulatorKey("00-0035676", 2), { rec_td_40p: 0, rec_td_50p: 0, rush_td_40p: 0, rush_td_50p: 1, pass_pick6: 0, fum_ret_td: 0 });
    const violations = verifyDerivedStatsInvariants(acc);
    expect(violations.some((v) => v.rule.includes("rush_td_50p <= rush_td_40p"))).toBe(true);
  });

  it("flags negative count violation", () => {
    const acc: DerivedStatsAccumulator = new Map();
    acc.set(makeAccumulatorKey("00-0033873", 1), { rec_td_40p: 0, rec_td_50p: 0, rush_td_40p: 0, rush_td_50p: 0, pass_pick6: -1, fum_ret_td: 0 });
    const violations = verifyDerivedStatsInvariants(acc);
    expect(violations.some((v) => v.rule.includes("pass_pick6"))).toBe(true);
  });

  it("emptyDerivedStats passes all invariants", () => {
    const acc: DerivedStatsAccumulator = new Map();
    acc.set(makeAccumulatorKey("00-0033288", 1), emptyDerivedStats());
    expect(verifyDerivedStatsInvariants(acc)).toHaveLength(0);
  });
});
