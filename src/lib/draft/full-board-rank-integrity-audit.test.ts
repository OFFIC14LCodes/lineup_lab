import { describe, expect, it } from "vitest";

import { buildProjectionTrust } from "@/lib/projections/projection-trust";
import type { BlackbirdBoardRow } from "./blackbird-board";
import { buildFullBoardRankIntegrityAudit } from "./full-board-rank-integrity-audit";
import type { ScoredDraftTarget } from "./scoring";

describe("full board rank integrity audit", () => {
  it("generates full audit rows with baseline ranks and deltas", () => {
    const report = buildFullBoardRankIntegrityAudit({
      projectionSeason: 2026,
      rows: [
        row({ playerName: "Alpha", position: "WR", rank: 80, marketRank: 20, projectionPoints: 300 }),
        row({ playerName: "Beta", position: "RB", rank: 1, marketRank: 2, projectionPoints: 320 }),
      ],
    });
    const alpha = report.rows.find((candidate) => candidate.player_name === "Alpha")!;

    expect(alpha.draftable_rank).toBe(80);
    expect(alpha.projection_rank).toBe(2);
    expect(alpha.rank_delta_vs_market).toBe(60);
    expect(alpha.delta_severity_vs_market).toBe("major");
    expect(alpha.disagreements).toContain("blackbird_much_lower_than_market");
  });

  it("classifies market/projection drops and boost reasons", () => {
    const report = buildFullBoardRankIntegrityAudit({
      projectionSeason: 2026,
      rows: [
        row({ playerName: "Dropped Elite", position: "WR", rank: 90, marketRank: 10, projectionPoints: 330, trust: "high" }),
        row({ playerName: "Boosted Low Trust", position: "QB", rank: 10, marketRank: 160, projectionPoints: 170, trust: "low" }),
      ],
    });
    const drop = report.rows.find((candidate) => candidate.player_name === "Dropped Elite")!;
    const boost = report.rows.find((candidate) => candidate.player_name === "Boosted Low Trust")!;

    expect(drop.drop_reason_codes).toContain("possible_over_penalized_elite");
    expect(drop.suspicion_label).toBe("suspicious");
    expect(boost.boost_reason_codes).toContain("superflex_qb_premium");
    expect(boost.boost_reason_codes).toContain("possible_over_promoted_low_trust");
    expect(["needs_review", "suspicious"]).toContain(boost.suspicion_label);
  });

  it("reports watchlist rows, positional balance, and round movement", () => {
    const report = buildFullBoardRankIntegrityAudit({
      projectionSeason: 2026,
      rows: [
        row({ playerName: "Ja'Marr Chase", position: "WR", rank: 5, marketRank: 4, projectionPoints: 370 }),
        row({ playerName: "Josh Allen", position: "QB", rank: 1, marketRank: 1, projectionPoints: 435 }),
        row({ playerName: "Round Drop", position: "RB", rank: 72, marketRank: 12, projectionPoints: 260 }),
        row({ playerName: "Round Boost", position: "TE", rank: 12, marketRank: 72, projectionPoints: 210 }),
      ],
    });

    expect(report.watchlist.find((candidate) => candidate.player_name === "Ja'Marr Chase")).toMatchObject({
      matched: true,
      blackbird_rank: 5,
    });
    expect(report.positionalBalanceTop100).toMatchObject({ QB: 1, RB: 1, WR: 1, TE: 1, K: 0, DST: 0, IDP: 0 });
    expect(report.roundMovement.players_dropped_3_plus_rounds_vs_market).toContain("Round Drop");
    expect(report.roundMovement.players_boosted_3_plus_rounds_vs_market).toContain("Round Boost");
  });

  it("marks legacy or unsupported position leakage as blocking", () => {
    const report = buildFullBoardRankIntegrityAudit({
      projectionSeason: 2026,
      rows: [
        row({ playerName: "Tom Brady", position: "QB", rank: 1, marketRank: 1, projectionPoints: 400 }),
        row({ playerName: "Top Kicker", position: "K", rank: 2, marketRank: 2, projectionPoints: 180 }),
      ],
      legacyWatchlistExcludedCount: 0,
      unsupportedPositionExcludedCount: 3,
    });

    expect(report.rows.find((candidate) => candidate.player_name === "Tom Brady")?.suspicion_label).toBe("blocked_bug");
    expect(report.rows.find((candidate) => candidate.player_name === "Top Kicker")?.suspicion_label).toBe("blocked_bug");
    expect(report.recommendation).toBe("full_board_rank_has_blocking_leakage");
    expect(report.summary.unsupported_position_excluded_count).toBe(3);
  });

  it("does not mutate input rows and records dry-run safety", () => {
    const rows = [row({ playerName: "Stable", position: "RB", rank: 1, marketRank: 1, projectionPoints: 300 })];
    const before = JSON.stringify(rows);
    const report = buildFullBoardRankIntegrityAudit({ projectionSeason: 2026, rows });

    expect(JSON.stringify(rows)).toBe(before);
    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.supabaseWrites).toBe(false);
    expect(report.v82Enabled).toBe(false);
    expect(report.marketAnchorEnabledByDefault).toBe(false);
  });
});

function row(overrides: {
  playerName: string;
  position: string;
  rank: number;
  marketRank?: number | null;
  projectionPoints?: number | null;
  trust?: "high" | "medium" | "low" | "very_low";
  activePolicyClass?: string | null;
}): BlackbirdBoardRow {
  const player = playerSource(overrides);
  return {
    playerId: player.matched_player_id,
    playerName: overrides.playerName,
    position: overrides.position,
    team: "TST",
    blackbirdBoardRank: overrides.rank,
    draftSuggestionRank: null,
    draftSuggestionScore: null,
    draftSuggestionType: null,
    blackbirdValueScore: 80,
    projectionPoints: overrides.projectionPoints ?? 220,
    projectionLow: overrides.projectionPoints === null ? null : (overrides.projectionPoints ?? 220) - 20,
    projectionHigh: overrides.projectionPoints === null ? null : (overrides.projectionPoints ?? 220) + 20,
    projectionUnit: "season",
    projectionSource: "test",
    projectionTrust: {
      ...buildProjectionTrust({
      playerId: player.matched_player_id,
      playerName: overrides.playerName,
      position: overrides.position,
      projectionUnit: "season",
      projectionSource: "test",
      confidence: overrides.trust === "low" ? "low" : "high",
      floorPoints: overrides.projectionPoints === null ? null : (overrides.projectionPoints ?? 220) - 20,
      medianPoints: overrides.projectionPoints ?? 220,
      ceilingPoints: overrides.projectionPoints === null ? null : (overrides.projectionPoints ?? 220) + 20,
    }),
      trustLabel: overrides.trust ?? "high",
    },
    role: null,
    roleConfidence: null,
    replacementMedianPoints: 180,
    replacementRank: null,
    pointsAboveReplacement: overrides.projectionPoints === null ? null : (overrides.projectionPoints ?? 220) - 180,
    adp: overrides.marketRank ?? null,
    marketRank: overrides.marketRank ?? null,
    rankDelta: null,
    confidence: overrides.trust === "low" || overrides.trust === "very_low" ? "low" : "high",
    risk: "low",
    blackbirdTier: overrides.rank <= 24 ? 1 : 3,
    valueScoreComponents: null,
    contextualReasons: ["test_context"],
    contextualDataGaps: [],
    planFit: "acceptable_fit",
    planFitReasons: [],
    needTimingAction: null,
    waitPlanTargetCount: null,
    drafted: false,
    dataStatus: {
      projection: overrides.projectionPoints === null ? "unavailable" : "available",
      adp: overrides.marketRank === null ? "unavailable" : "available",
      marketRank: overrides.marketRank === null ? "unavailable" : "available",
      h10: "unavailable",
      ordering: "blackbird",
    },
    source: {
      h10RecommendationRank: null,
      h10RecommendationScore: null,
      draftTargetScore: null,
      originalIndex: overrides.rank - 1,
      player,
      overlay: null,
      recommendation: null,
      leagueRank: null,
    },
  };
}

function playerSource(overrides: {
  playerName: string;
  position: string;
  rank: number;
  marketRank?: number | null;
  projectionPoints?: number | null;
  activePolicyClass?: string | null;
}): ScoredDraftTarget & {
  activePolicyClass?: string | null;
  marketRank?: number | null;
  marketFormat?: string | null;
  marketMatchType?: string | null;
  marketAnchorRank?: number | null;
} {
  return {
    sleeper_player_id: `s-${overrides.playerName}`,
    matched_player_id: `p-${overrides.playerName}`,
    player_name: overrides.playerName,
    position: overrides.position,
    team: "TST",
    rank: overrides.rank,
    adp: overrides.marketRank ?? null,
    projected_points: overrides.projectionPoints ?? 220,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: overrides.position === "QB" ? 90 : null,
    te_premium_value: null,
    match_status: "exact",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 80,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: ["QB", "RB", "WR", "TE"].includes(overrides.position) ? "offense_v1_1" : "unsupported",
    activePolicyClass: overrides.activePolicyClass ?? "final_policy_active_candidate",
    marketRank: overrides.marketRank ?? null,
    marketFormat: "SUPERFLEX",
    marketMatchType: "exact",
    marketAnchorRank: overrides.marketRank ?? null,
  };
}
