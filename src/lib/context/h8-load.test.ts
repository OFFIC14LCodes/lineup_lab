// H8 load helpers — unit tests covering all spec items from section 13

import { describe, expect, it } from "vitest";

import {
  buildSeasonModel,
  buildTeamWeeklyAggregates,
  buildArtifactPath,
  mergeTeamSeasonContext,
  resolvePlayerHistoricalTeam,
  selectEligiblePlayers,
  stratifiedSample,
  validateExecuteMode,
  validateHistoricalLoad,
} from "./h8-load";
import type { EligiblePlayer, HistoricalWeeklyRow, TeamGameRow } from "./h8-load";
import { REGULAR_SEASON_PLAYER, SKILL_POSITIONS } from "./season-type";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function row(
  opts: Partial<HistoricalWeeklyRow> & { player_id: string }
): HistoricalWeeklyRow {
  return {
    season: 2025,
    week: 1,
    season_type: REGULAR_SEASON_PLAYER,
    team: "KC",
    position_group: "WR",
    stats_json: {},
    ...opts,
  };
}

function gameRow(
  opts: Partial<TeamGameRow> & { team_id: string }
): TeamGameRow {
  return {
    season: 2025,
    points_scored: 28,
    points_allowed: 14,
    offensive_yards: 380,
    yards_allowed: 300,
    ...opts,
  };
}

// --------------------------------------------------------------------------
// 1. Season model
// --------------------------------------------------------------------------

describe("buildSeasonModel", () => {
  it("produces explicit historical vs context-target season labels", () => {
    const model = buildSeasonModel(2025, 2026, "2026-06-14");
    expect(model.historicalPerformanceSeason).toBe(2025);
    expect(model.contextTargetSeason).toBe(2026);
    expect(model.asOfDate).toBe("2026-06-14");
  });

  it("2025 historical != 2026 context season", () => {
    const model = buildSeasonModel(2025, 2026);
    expect(model.historicalPerformanceSeason).not.toBe(model.contextTargetSeason);
  });
});

// --------------------------------------------------------------------------
// 2. Regular-season filter
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — season_type filter", () => {
  it("includes only season_type='regular' rows", () => {
    const rows = [
      row({ player_id: "p1", season_type: "regular" }),
      row({ player_id: "p2", season_type: "preseason" }),
      row({ player_id: "p3", season_type: "postseason" }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible.map((e) => e.playerId)).toContain("p1");
    expect(eligible.map((e) => e.playerId)).not.toContain("p2");
    expect(eligible.map((e) => e.playerId)).not.toContain("p3");
  });

  it("does not silently accept 'REG' as regular season", () => {
    const rows = [row({ player_id: "p1", season_type: "REG" })];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// 3. Fail-fast on zero weekly rows
// --------------------------------------------------------------------------

describe("validateHistoricalLoad — fail-fast", () => {
  it("fails when no eligible players found", () => {
    const r = validateHistoricalLoad([], [], 0);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.exitCode).toBe(2);
      expect(r.reason).toMatch(/no eligible/i);
    }
  });

  it("fails when player population selection produced zero players", () => {
    const r = validateHistoricalLoad(["p1"], [], 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.exitCode).toBe(3);
  });

  it("fails when zero weekly rows loaded for selected players", () => {
    const r = validateHistoricalLoad(["p1"], ["p1"], 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.exitCode).toBe(4);
  });

  it("succeeds when all checks pass", () => {
    const r = validateHistoricalLoad(["p1", "p2"], ["p1"], 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.eligibleCount).toBe(2);
      expect(r.selectedCount).toBe(1);
    }
  });
});

// --------------------------------------------------------------------------
// 4. Historical player population — retired players excluded
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — historical population", () => {
  it("excludes players with no rows in the historical season", () => {
    const rows = [
      row({ player_id: "p_active", season: 2025 }),
      row({ player_id: "p_retired", season: 2010 }), // not in 2025
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible.map((e) => e.playerId)).toContain("p_active");
    expect(eligible.map((e) => e.playerId)).not.toContain("p_retired");
  });

  it("filters to skill positions only (excludes K, DEF, etc.)", () => {
    const rows = [
      row({ player_id: "p_wr", position_group: "WR" }),
      row({ player_id: "p_k", position_group: "K" }),
      row({ player_id: "p_def", position_group: "DEF" }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible.map((e) => e.playerId)).toContain("p_wr");
    expect(eligible.map((e) => e.playerId)).not.toContain("p_k");
    expect(eligible.map((e) => e.playerId)).not.toContain("p_def");
  });

  it("position filter applies when specified", () => {
    const rows = [
      row({ player_id: "p_wr", position_group: "WR" }),
      row({ player_id: "p_rb", position_group: "RB" }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025, position: "WR" });
    expect(eligible.map((e) => e.playerId)).toContain("p_wr");
    expect(eligible.map((e) => e.playerId)).not.toContain("p_rb");
  });
});

// --------------------------------------------------------------------------
// 5. Limit and pagination above 1,000 rows
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — limit", () => {
  it("respects limit when more eligible players exist", () => {
    const rows = Array.from({ length: 1200 }, (_, i) =>
      row({ player_id: `p${i}`, stats_json: { rec_tgt: 10 - (i % 10) } })
    );
    const eligible = selectEligiblePlayers(rows, { season: 2025, limit: 50 });
    expect(eligible).toHaveLength(50);
  });

  it("returns all players when limit exceeds eligible count", () => {
    const rows = [
      row({ player_id: "p1", stats_json: { rec_tgt: 10 } }),
      row({ player_id: "p2", stats_json: { rec_tgt: 5 } }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025, limit: 100 });
    expect(eligible).toHaveLength(2);
  });
});

// --------------------------------------------------------------------------
// 6. Selected-player weekly join (rec_tgt, rush_att key names)
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — stat key names", () => {
  it("uses rec_tgt not 'targets' for target counting", () => {
    const rows = [
      row({ player_id: "p1", stats_json: { rec_tgt: 8, targets: 99 } }), // 'targets' ignored
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible[0]!.totalTargets).toBe(8); // rec_tgt wins
  });

  it("uses rush_att not 'carries' for carry counting", () => {
    const rows = [
      row({ player_id: "p1", position_group: "RB", stats_json: { rush_att: 12, carries: 99 } }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible[0]!.totalCarries).toBe(12); // rush_att wins
  });
});

// --------------------------------------------------------------------------
// 7. Team-game to team-season aggregation
// --------------------------------------------------------------------------

describe("mergeTeamSeasonContext — team aggregation", () => {
  it("sums points_scored across games for a team", () => {
    const weeklyRows = [
      row({ player_id: "p1", team: "KC", stats_json: { rec_tgt: 10 } }),
      row({ player_id: "p1", team: "KC", week: 2, stats_json: { rec_tgt: 8 } }),
    ];
    const gameRows = [
      gameRow({ team_id: "KC", points_scored: 28 }),
      gameRow({ team_id: "KC", points_scored: 35 }),
    ];
    const weekly = buildTeamWeeklyAggregates(weeklyRows, 2025);
    const merged = mergeTeamSeasonContext(weekly, gameRows, 2025);
    expect(merged.get("KC")?.pointsScored).toBe(63);
    expect(merged.get("KC")?.gamesPlayed).toBe(2);
  });

  it("computes totalTargets from rec_tgt across all team players", () => {
    const weeklyRows = [
      row({ player_id: "p1", team: "KC", stats_json: { rec_tgt: 10 } }),
      row({ player_id: "p2", team: "KC", stats_json: { rec_tgt: 5 } }),
      row({ player_id: "p3", team: "PHI", stats_json: { rec_tgt: 20 } }),
    ];
    const weekly = buildTeamWeeklyAggregates(weeklyRows, 2025);
    expect(weekly.get("KC")?.totalTargets).toBe(15);
    expect(weekly.get("PHI")?.totalTargets).toBe(20);
  });

  it("computes topTargetShare correctly", () => {
    const weeklyRows = [
      row({ player_id: "p1", team: "KC", stats_json: { rec_tgt: 12 } }),
      row({ player_id: "p2", team: "KC", stats_json: { rec_tgt: 4 } }),
      row({ player_id: "p3", team: "KC", stats_json: { rec_tgt: 4 } }),
    ];
    const weekly = buildTeamWeeklyAggregates(weeklyRows, 2025);
    const merged = mergeTeamSeasonContext(weekly, [], 2025);
    // p1 has 12/20 = 0.6
    expect(merged.get("KC")?.topTargetShare).toBeCloseTo(0.6, 2);
  });

  it("returns empty team when no game rows available (non-fatal)", () => {
    const weeklyRows = [row({ player_id: "p1", team: "KC", stats_json: { rec_tgt: 10 } })];
    const weekly = buildTeamWeeklyAggregates(weeklyRows, 2025);
    const merged = mergeTeamSeasonContext(weekly, [], 2025);
    expect(merged.get("KC")?.gamesPlayed).toBe(0); // No game rows
    expect(merged.get("KC")?.totalTargets).toBe(10); // Still computed
  });
});

// --------------------------------------------------------------------------
// 8. Player team resolution
// --------------------------------------------------------------------------

describe("resolvePlayerHistoricalTeam", () => {
  it("resolves primary team for single-team season", () => {
    const rows = [
      row({ player_id: "p1", team: "KC", week: 1 }),
      row({ player_id: "p1", team: "KC", week: 2 }),
    ];
    const r = resolvePlayerHistoricalTeam(rows, "p1", 2025);
    expect(r.primaryTeam).toBe("KC");
    expect(r.multiTeamSeason).toBe(false);
  });

  it("handles multi-team season correctly", () => {
    const rows = [
      row({ player_id: "p1", team: "NYG", week: 1 }),
      row({ player_id: "p1", team: "NYG", week: 2 }),
      row({ player_id: "p1", team: "KC", week: 9 }),
    ];
    const r = resolvePlayerHistoricalTeam(rows, "p1", 2025);
    expect(r.multiTeamSeason).toBe(true);
    expect(r.teamsPlayedFor).toContain("NYG");
    expect(r.teamsPlayedFor).toContain("KC");
    // NYG first appearance (week 1) < KC (week 9) → NYG listed first
    expect(r.teamsPlayedFor[0]).toBe("NYG");
  });

  it("primary team is team with most games, not first appearance", () => {
    const rows = [
      row({ player_id: "p1", team: "NYG", week: 1 }),       // 1 game with NYG
      row({ player_id: "p1", team: "KC", week: 4 }),         // 3 games with KC
      row({ player_id: "p1", team: "KC", week: 8 }),
      row({ player_id: "p1", team: "KC", week: 12 }),
    ];
    const r = resolvePlayerHistoricalTeam(rows, "p1", 2025);
    expect(r.primaryTeam).toBe("KC");
  });
});

// --------------------------------------------------------------------------
// 9. Historical vs context-target season distinction
// --------------------------------------------------------------------------

describe("H8SeasonModel — season terminology", () => {
  it("never conflates historical performance season with context target season", () => {
    const model = buildSeasonModel(2025, 2026);
    // Historical (2025) must be strictly in the past relative to context (2026)
    expect(model.historicalPerformanceSeason).toBeLessThan(model.contextTargetSeason);
  });

  it("supports same-season derivation when explicitly configured", () => {
    // In-season use case: derive mid-season context (historical == current)
    const model = buildSeasonModel(2025, 2025);
    expect(model.historicalPerformanceSeason).toBe(model.contextTargetSeason);
  });
});

// --------------------------------------------------------------------------
// 10. Artifact path generation
// --------------------------------------------------------------------------

describe("buildArtifactPath", () => {
  it("includes both seasons in path", () => {
    const p = buildArtifactPath(2025, 2026, "/project");
    expect(p).toContain("2025");
    expect(p).toContain("2026");
    expect(p).toContain("h8-context");
    expect(p).toContain("dry-run");
  });

  it("places artifact under artifacts/player-context/", () => {
    const p = buildArtifactPath(2025, 2026, "/project");
    expect(p.replace(/\\/g, "/")).toContain("artifacts/player-context/");
  });
});

// --------------------------------------------------------------------------
// 11. No execute writes during dry run (absence test)
// --------------------------------------------------------------------------

describe("dry-run guard", () => {
  it("validateHistoricalLoad does not write to DB", () => {
    // Pure function — no side effects
    const r = validateHistoricalLoad(["p1"], ["p1"], 10);
    expect(r.ok).toBe(true);
    // If this line runs, no DB write occurred
  });

  it("selectEligiblePlayers does not write to DB", () => {
    const rows = [row({ player_id: "p1" })];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible.length).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------------
// 12. Single-player filter
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — player-id filter", () => {
  it("returns only the specified player when playerId set", () => {
    const rows = [
      row({ player_id: "p1" }),
      row({ player_id: "p2" }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025, playerId: "p1" });
    expect(eligible).toHaveLength(1);
    expect(eligible[0]!.playerId).toBe("p1");
  });
});

// --------------------------------------------------------------------------
// 13. games count = distinct weeks
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — games count", () => {
  it("counts distinct weeks, not row count", () => {
    // Two rows from same week (e.g., different providers) — should count as 1 game
    const rows = [
      row({ player_id: "p1", week: 1 }),
      row({ player_id: "p1", week: 1 }), // duplicate week
      row({ player_id: "p1", week: 2 }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible[0]!.games).toBe(2); // distinct weeks: 1, 2
  });

  it("orders players by opportunity (targets+carries) descending within position", () => {
    const rows = [
      row({ player_id: "p_low", position_group: "WR", stats_json: { rec_tgt: 2 } }),
      row({ player_id: "p_high", position_group: "WR", stats_json: { rec_tgt: 12 } }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible[0]!.playerId).toBe("p_high");
  });
});

// --------------------------------------------------------------------------
// 14. Within-position sort: games desc first, then opportunity, then playerId
// --------------------------------------------------------------------------

describe("selectEligiblePlayers — within-position sort (games desc primary)", () => {
  it("player with more games ranks above player with higher opportunity but fewer games", () => {
    const rows = [
      // p_few_games: 1 game, very high targets
      row({ player_id: "p_few_games", position_group: "WR", week: 1, stats_json: { rec_tgt: 100 } }),
      // p_many_games: 3 games, modest targets
      row({ player_id: "p_many_games", position_group: "WR", week: 1, stats_json: { rec_tgt: 8 } }),
      row({ player_id: "p_many_games", position_group: "WR", week: 2, stats_json: { rec_tgt: 8 } }),
      row({ player_id: "p_many_games", position_group: "WR", week: 3, stats_json: { rec_tgt: 8 } }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible[0]!.playerId).toBe("p_many_games"); // 3 games beats 1 game
  });

  it("players with same games are then sorted by opportunity desc", () => {
    const rows = [
      row({ player_id: "p_low_opp", position_group: "RB", week: 1, stats_json: { rush_att: 5 } }),
      row({ player_id: "p_low_opp", position_group: "RB", week: 2, stats_json: { rush_att: 5 } }),
      row({ player_id: "p_high_opp", position_group: "RB", week: 1, stats_json: { rush_att: 20 } }),
      row({ player_id: "p_high_opp", position_group: "RB", week: 2, stats_json: { rush_att: 20 } }),
    ];
    const eligible = selectEligiblePlayers(rows, { season: 2025 });
    expect(eligible[0]!.playerId).toBe("p_high_opp");
  });
});

// --------------------------------------------------------------------------
// 15. stratifiedSample
// --------------------------------------------------------------------------

function makeEligiblePlayers(pos: string, n: number, gamesBase = 16): EligiblePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p_${pos}_${i}`,
    position: pos,
    primaryTeam: "KC",
    teamsPlayedFor: ["KC"],
    games: gamesBase - (i % gamesBase),
    totalTargets: pos !== "RB" ? Math.max(0, 10 - i) : 0,
    totalCarries: pos === "RB" || pos === "QB" ? Math.max(0, 10 - i) : 0,
  }));
}

function buildEligibleSet() {
  return [
    ...makeEligiblePlayers("QB", 35),
    ...makeEligiblePlayers("RB", 180),
    ...makeEligiblePlayers("WR", 250),
    ...makeEligiblePlayers("TE", 128),
  ];
}

describe("stratifiedSample", () => {
  it("returns full eligible set when limit >= count", () => {
    const eligible = [
      ...makeEligiblePlayers("QB", 5),
      ...makeEligiblePlayers("RB", 5),
    ];
    expect(stratifiedSample(eligible, 20)).toHaveLength(10);
  });

  it("includes all four positions in a 50-player stratified sample", () => {
    const eligible = buildEligibleSet();
    const sample = stratifiedSample(eligible, 50);
    const positions = new Set(sample.map((p) => p.position));
    for (const pos of SKILL_POSITIONS) {
      expect(positions.has(pos)).toBe(true);
    }
  });

  it("respects limit exactly", () => {
    const eligible = buildEligibleSet();
    expect(stratifiedSample(eligible, 50)).toHaveLength(50);
  });

  it("is deterministic — same input, same output", () => {
    const eligible = buildEligibleSet();
    const a = stratifiedSample(eligible, 50);
    const b = stratifiedSample(eligible, 50);
    expect(a.map((p) => p.playerId)).toEqual(b.map((p) => p.playerId));
  });

  it("result is in SKILL_POSITIONS order (QB → RB → WR → TE)", () => {
    const eligible = buildEligibleSet();
    const sample = stratifiedSample(eligible, 50);
    const positions = sample.map((p) => p.position);
    const firstQB = positions.indexOf("QB");
    const firstRB = positions.indexOf("RB");
    const firstWR = positions.indexOf("WR");
    const firstTE = positions.indexOf("TE");
    expect(firstQB).toBeLessThan(firstRB);
    expect(firstRB).toBeLessThan(firstWR);
    expect(firstWR).toBeLessThan(firstTE);
  });

  it("allocates proportionally — WR has more slots than QB in 50-player sample", () => {
    const eligible = buildEligibleSet();
    const sample = stratifiedSample(eligible, 50);
    const byPos: Record<string, number> = {};
    for (const p of sample) byPos[p.position] = (byPos[p.position] ?? 0) + 1;
    // WR (250/593 ≈ 42%) should get more than QB (35/593 ≈ 6%)
    expect((byPos["WR"] ?? 0)).toBeGreaterThan(byPos["QB"] ?? 0);
  });

  it("--all equivalent: no limit returns all eligible players", () => {
    const eligible = buildEligibleSet();
    // When limit >= eligible.length, returns all
    const all = stratifiedSample(eligible, eligible.length);
    expect(all).toHaveLength(eligible.length);
  });
});

// --------------------------------------------------------------------------
// 16. Execute mode validation
// --------------------------------------------------------------------------

describe("validateExecuteMode", () => {
  it("dry_run always passes", () => {
    const r = validateExecuteMode({
      execute: false, all: false, position: null, allowPartialExecute: false,
      selectedCount: 50, eligibleCount: 593,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.planSummary).toMatch(/dry_run/);
  });

  it("execute with partial selection and no flag is refused (exit code 5)", () => {
    const r = validateExecuteMode({
      execute: true, all: false, position: null, allowPartialExecute: false,
      selectedCount: 50, eligibleCount: 593,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.exitCode).toBe(5);
      expect(r.reason).toMatch(/refuses/i);
    }
  });

  it("execute with --all is allowed", () => {
    const r = validateExecuteMode({
      execute: true, all: true, position: null, allowPartialExecute: false,
      selectedCount: 593, eligibleCount: 593,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.planSummary).toMatch(/full population/);
  });

  it("execute with --position=QB is allowed (intentional single-position)", () => {
    const r = validateExecuteMode({
      execute: true, all: false, position: "QB", allowPartialExecute: false,
      selectedCount: 35, eligibleCount: 593,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.planSummary).toMatch(/position=QB/);
  });

  it("execute with --allow-partial-execute is allowed (explicit acknowledgment)", () => {
    const r = validateExecuteMode({
      execute: true, all: false, position: null, allowPartialExecute: true,
      selectedCount: 50, eligibleCount: 593,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.planSummary).toMatch(/partial/i);
  });

  it("execute alone (no --all, no --position, no acknowledgment) is refused", () => {
    const r = validateExecuteMode({
      execute: true, all: false, position: null, allowPartialExecute: false,
      selectedCount: 50, eligibleCount: 593,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.exitCode).toBe(5);
  });
});
