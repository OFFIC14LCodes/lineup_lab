import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard } from "./blackbird-board";
import { buildBlackbirdRankQualityAudit } from "./blackbird-rank-quality-audit";
import { buildMarketAnchorBoardPreview } from "./market-anchor-board-preview";
import { filterDraftablePlayers } from "./player-draftability";
import type { ScoredDraftTarget } from "./scoring";

const SUPERFLEX_NO_K = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN"];

describe("Blackbird rank quality audit", () => {
  it("keeps elite WR/RB/TE near the top when projection and source rank are strong", () => {
    const rows = boardRows([
      player({ player_name: "Ja'Marr Chase", matched_player_id: "chase", position: "WR", projected_points: 370, rank: 5 }),
      player({ player_name: "Bijan Robinson", matched_player_id: "bijan", position: "RB", projected_points: 344, rank: 10 }),
      player({ player_name: "Justin Jefferson", matched_player_id: "jefferson", position: "WR", projected_points: 284, rank: 31 }),
      ...replacementTierPlayers(70),
    ]);
    const audit = buildBlackbirdRankQualityAudit({ projectionSeason: 2026, rows });

    expect(rankOf(audit, "Ja'Marr Chase")).toBeLessThanOrEqual(12);
    expect(rankOf(audit, "Bijan Robinson")).toBeLessThanOrEqual(24);
    expect(rankOf(audit, "Justin Jefferson")).toBeLessThanOrEqual(36);
    expect(audit.watchedPlayers.find((row) => row.player_name === "Ja'Marr Chase")?.bug_codes).not.toContain("elite_player_buried");
  });

  it("elevates elite QBs in Superflex without burying elite non-QBs", () => {
    const rows = boardRows([
      player({ player_name: "Josh Allen", matched_player_id: "allen", position: "QB", projected_points: 435, rank: 1, superflex_value: 99 }),
      player({ player_name: "Lamar Jackson", matched_player_id: "lamar", position: "QB", projected_points: 369, rank: 6, superflex_value: 94 }),
      player({ player_name: "Ja'Marr Chase", matched_player_id: "chase", position: "WR", projected_points: 371, rank: 5 }),
      player({ player_name: "Bijan Robinson", matched_player_id: "bijan", position: "RB", projected_points: 344, rank: 10 }),
      ...replacementTierPlayers(50),
    ]);

    expect(rows.find((row) => row.playerName === "Josh Allen")?.blackbirdBoardRank).toBeLessThanOrEqual(3);
    expect(rows.find((row) => row.playerName === "Lamar Jackson")?.blackbirdBoardRank).toBeLessThanOrEqual(8);
    expect(rows.find((row) => row.playerName === "Ja'Marr Chase")?.blackbirdBoardRank).toBeLessThanOrEqual(12);
  });

  it("keeps no-kicker and unsupported DST/IDP rows out of the eligible board", () => {
    const players = [
      player({ player_name: "Elite WR", matched_player_id: "wr", position: "WR", projected_points: 320, rank: 8 }),
      player({ player_name: "Kicker", matched_player_id: "k", position: "K", projected_points: 180, rank: 1 }),
      player({ player_name: "Defense", matched_player_id: "def", position: "DEF", projected_points: 190, rank: 2 }),
      player({ player_name: "Linebacker", matched_player_id: "lb", position: "LB", projected_points: 200, rank: 3 }),
    ];
    const eligible = filterDraftablePlayers(players, { rosterPositions: SUPERFLEX_NO_K });
    const rows = boardRows(eligible.players);

    expect(eligible.filteredPositions).toEqual(["DEF", "K", "LB"]);
    expect(rows.map((row) => row.position)).toEqual(["WR"]);
  });

  it("does not let market anchor make unsupported positions eligible", () => {
    const eligible = filterDraftablePlayers([
      player({ player_name: "Elite WR", matched_player_id: "wr", position: "WR", projected_points: 320, rank: 8 }),
      player({ player_name: "Kicker", matched_player_id: "k", position: "K", projected_points: 180, rank: 1 }),
    ], { rosterPositions: SUPERFLEX_NO_K });
    const rows = boardRows(eligible.players);
    const preview = buildMarketAnchorBoardPreview({
      rows,
      rosterPositions: SUPERFLEX_NO_K,
      marketFormat: "SUPERFLEX",
      flagEnabled: true,
      enrichedUniversePath: "missing-market-anchor-universe.json",
      reviewPath: "missing-market-anchor-review.json",
    });

    expect(preview.rows.some((row) => row.position === "K")).toBe(false);
    expect(preview.diagnostics.status).toBe("artifacts_missing");
  });

  it("does not let risk or trust bury high-confidence elite players below replacement-tier players", () => {
    const rows = boardRows([
      player({ player_name: "Ja'Marr Chase", matched_player_id: "chase", position: "WR", projected_points: 370, rank: 5, warnings: ["minor risk note"] }),
      ...replacementTierPlayers(80),
    ]);
    const chase = rows.find((row) => row.playerName === "Ja'Marr Chase");
    const replacementRanks = rows.filter((row) => row.playerName.startsWith("Replacement")).map((row) => row.blackbirdBoardRank);

    expect(chase?.blackbirdBoardRank).toBeLessThan(Math.min(...replacementRanks));
  });

  it("keeps legacy archive players out of draftable top rows and audit watchlist", () => {
    const filtered = filterDraftablePlayers([
      player({ player_name: "Andrew Luck", matched_player_id: "luck", position: "QB", projected_points: 410, rank: 7, activePolicyClass: "final_policy_blocked_archive" }),
      player({ player_name: "Tom Brady", matched_player_id: "brady", position: "QB", projected_points: 400, rank: 11, policyGroup: "legacy_blocked" }),
      player({ player_name: "Drew Brees", matched_player_id: "brees", position: "QB", projected_points: 390, rank: 20, activePolicyClass: "final_policy_blocked_archive" }),
      player({ player_name: "Ja'Marr Chase", matched_player_id: "chase", position: "WR", projected_points: 370, rank: 5, activePolicyClass: "final_policy_active_candidate" }),
      player({ player_name: "Bijan Robinson", matched_player_id: "bijan", position: "RB", projected_points: 344, rank: 10, activePolicyClass: "final_policy_active_candidate" }),
      player({ player_name: "Justin Jefferson", matched_player_id: "jefferson", position: "WR", projected_points: 284, rank: 31, activePolicyClass: "final_policy_active_candidate" }),
      ...replacementTierPlayers(80),
    ], { rosterPositions: SUPERFLEX_NO_K });
    const audit = buildBlackbirdRankQualityAudit({
      projectionSeason: 2026,
      rows: boardRows(filtered.players),
      draftability: filtered,
    });
    const names = audit.draftable_top_25.map((row) => row.player_name);

    expect(names).not.toContain("Andrew Luck");
    expect(names).not.toContain("Tom Brady");
    expect(names).not.toContain("Drew Brees");
    expect(audit.likelyRankBugs.map((bug) => bug.code)).not.toContain("legacy_archive_draftable");
    expect(audit.excluded_legacy_examples.filter((row) => row.found_in_draftable_top_300)).toEqual([]);
    expect(audit.blocked_archive_count).toBe(2);
    expect(audit.excluded_policy_counts.legacy_blocked).toBe(1);
    expect(rankOf(audit, "Ja'Marr Chase")).toBeLessThanOrEqual(12);
    expect(rankOf(audit, "Bijan Robinson")).toBeLessThanOrEqual(24);
    expect(rankOf(audit, "Justin Jefferson")).toBeLessThanOrEqual(36);
  });

  it("reports sort surfaces and static-rank safety expectations", () => {
    const rows = boardRows([
      player({ player_name: "Ja'Marr Chase", matched_player_id: "chase", position: "WR", projected_points: 370, rank: 5 }),
      ...replacementTierPlayers(5),
    ]);
    const audit = buildBlackbirdRankQualityAudit({ projectionSeason: 2026, rows });

    expect(audit.sortSurfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: "Full Blackbird Rank", sort_field: "blackbird_rank" }),
      expect.objectContaining({ surface: "Available Blackbird Rank", sort_field: "blackbird_rank" }),
      expect.objectContaining({ surface: "Draft Suggestions", sort_field: "draft_suggestion_score" }),
    ]));
    expect(audit.marketAnchorEnabledByDefault).toBe(false);
    expect(audit.supabaseWrites).toBe(false);
    expect(audit.v82Enabled).toBe(false);
  });
});

function boardRows(players: ScoredDraftTarget[]) {
  return buildBlackbirdBoard({
    players,
    leagueContext: {
      isSuperflex: true,
      isTwoQb: false,
      isDynasty: false,
      isBestBall: false,
      tePremium: 0,
      hasKicker: false,
      hasTeamDefense: false,
      hasIDP: false,
      rosterPositions: SUPERFLEX_NO_K,
      scoringSettings: {},
    },
    includeDrafted: true,
  }).rows;
}

function rankOf(audit: ReturnType<typeof buildBlackbirdRankQualityAudit>, playerName: string) {
  return audit.watchedPlayers.find((row) => row.player_name === playerName)?.current_rank ?? 999999;
}

function replacementTierPlayers(count: number): ScoredDraftTarget[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index % 4 === 0 ? "QB" : index % 4 === 1 ? "RB" : index % 4 === 2 ? "WR" : "TE";
    return player({
      matched_player_id: `replacement-${index}`,
      player_name: `Replacement ${index}`,
      position,
      projected_points: position === "QB" ? 190 - index * 0.5 : 120 - index * 0.4,
      rank: 300 + index,
      superflex_value: position === "QB" ? 45 : null,
    });
  });
}

function player(overrides: Partial<ScoredDraftTarget> & Record<string, unknown> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: overrides.matched_player_id ?? "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    rank: 50,
    adp: null,
    projected_points: 220,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    age: 25,
    years_exp: 3,
    ...overrides,
  };
}
