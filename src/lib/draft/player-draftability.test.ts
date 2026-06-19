import { describe, expect, it } from "vitest";

import { evaluatePlayerDraftability, filterDraftablePlayers } from "./player-draftability";

const SUPERFLEX_NO_K = { rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN"] };

describe("player draftability", () => {
  it("allows current active offensive players", () => {
    const result = evaluatePlayerDraftability(
      { player_name: "Ja'Marr Chase", position: "WR", activePolicyClass: "final_policy_active_candidate" },
      SUPERFLEX_NO_K,
    );

    expect(result.draftable).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks final policy archive and legacy archive rows even when position is eligible", () => {
    const result = filterDraftablePlayers([
      { player_name: "Andrew Luck", position: "QB", activePolicyClass: "final_policy_blocked_archive" },
      { player_name: "Tom Brady", position: "QB", policyGroup: "legacy_blocked" },
      { player_name: "Bijan Robinson", position: "RB", activePolicyClass: "final_policy_active_candidate" },
    ], SUPERFLEX_NO_K);

    expect(result.players.map((player) => player.player_name)).toEqual(["Bijan Robinson"]);
    expect(result.filteredReasons.final_policy_blocked_archive).toBe(1);
    expect(result.filteredReasons.legacy_archive_blocked).toBe(1);
  });

  it("blocks retired or inactive current-path rows", () => {
    const result = evaluatePlayerDraftability(
      { player_name: "Drew Brees", position: "QB", activePolicyClass: "final_policy_current_path_only", status: "retired" },
      SUPERFLEX_NO_K,
    );

    expect(result.draftable).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(["inactive_or_retired_status", "active_universe_policy_blocked"]));
  });

  it("keeps K, DST, and IDP out when league slots do not support them", () => {
    const result = filterDraftablePlayers([
      { player_name: "Kicker", position: "K" },
      { player_name: "Defense", position: "DST" },
      { player_name: "Linebacker", position: "LB" },
      { player_name: "Wideout", position: "WR" },
    ], SUPERFLEX_NO_K);

    expect(result.players.map((player) => player.player_name)).toEqual(["Wideout"]);
    expect(result.filteredPositions).toEqual(["DEF", "K", "LB"]);
  });

  it("passes if any trusted roster-fit multi-position eligibility is supported", () => {
    const result = filterDraftablePlayers(
      [{ player_name: "LB DL Flex", position: "LB", fantasyPositions: ["LB", "DL"] }],
      { rosterPositions: ["DL", "BN"] },
    );

    expect(result.players.map((player) => player.player_name)).toEqual(["LB DL Flex"]);
  });

  it("lets Travis Hunter qualify through WR or DB depending on league settings", () => {
    const idpOnly = filterDraftablePlayers(
      [{ player_name: "Travis Hunter", position: "WR", fantasyPositions: ["WR", "DB"] }],
      { rosterPositions: ["DB", "BN"] },
    );
    const offenseOnly = filterDraftablePlayers(
      [{ player_name: "Travis Hunter", position: "WR", fantasyPositions: ["WR", "DB"] }],
      { rosterPositions: ["WR", "BN"] },
    );

    expect(idpOnly.players.map((player) => player.player_name)).toEqual(["Travis Hunter"]);
    expect(offenseOnly.players.map((player) => player.player_name)).toEqual(["Travis Hunter"]);
  });

  it("does not let suppressed offensive combos qualify through secondary positions", () => {
    const result = filterDraftablePlayers(
      [{ player_name: "Fake TE QB", position: "QB", fantasyPositions: ["QB", "TE"] }],
      { rosterPositions: ["TE", "BN"] },
    );

    expect(result.players).toEqual([]);
    expect(result.filteredReasons.position_not_eligible).toBe(1);
  });

  it("fails if no multi-position eligibility is supported", () => {
    const result = filterDraftablePlayers(
      [{ player_name: "IDP Flex", position: "LB", fantasyPositions: ["LB", "DL"] }],
      { rosterPositions: ["QB", "RB", "WR", "TE", "BN"] },
    );

    expect(result.players).toEqual([]);
    expect(result.filteredReasons.position_not_eligible).toBe(1);
  });

  it("blocks shadow, manual, source expansion, and kicker-review policy rows", () => {
    const result = filterDraftablePlayers([
      { player_name: "Shadow", position: "WR", activePolicyClass: "final_policy_shadow_only" },
      { player_name: "Manual", position: "WR", activePolicyClass: "final_policy_manual_review" },
      { player_name: "Source", position: "WR", activePolicyClass: "final_policy_source_expansion_required" },
      { player_name: "Kicker", position: "K", activePolicyClass: "final_policy_kicker_review_required" },
    ], { rosterPositions: ["QB", "RB", "WR", "TE", "K"] });

    expect(result.players).toEqual([]);
    expect(result.filteredReasons.shadow_only).toBe(1);
    expect(result.filteredReasons.manual_review_required).toBe(1);
    expect(result.filteredReasons.source_expansion_required).toBe(1);
    expect(result.filteredReasons.kicker_review_required).toBe(1);
  });
});
