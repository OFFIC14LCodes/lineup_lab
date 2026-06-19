import { describe, expect, it } from "vitest";

import { buildProjectionTrust } from "@/lib/projections/projection-trust";
import type { BlackbirdBoardRow } from "./blackbird-board";
import { buildBlackbirdTrustMetadataAudit } from "./blackbird-trust-metadata-audit";
import type { ScoredDraftTarget } from "./scoring";

describe("blackbird trust metadata audit", () => {
  it("reports raw vs calibrated trust distribution and reason counts", () => {
    const report = buildBlackbirdTrustMetadataAudit({
      projectionSeason: 2026,
      rows: [
        row({ playerName: "Ja'Marr Chase", rank: 1, sourceConfidence: "high", marketRank: 3 }),
        row({ playerName: "Solid Starter", rank: 2, sourceConfidence: "medium", marketRank: 35 }),
      ],
    });

    expect(report.rowsAudited).toBe(2);
    expect(report.top100BeforeTrustDistribution.low).toBeGreaterThan(0);
    expect(report.top100AfterTrustDistribution.high).toBeGreaterThan(0);
    expect(report.reasonCounts.active_roster_confirmed).toBe(2);
    expect(report.reasonCounts.market_evidence_present).toBe(2);
    expect(report.watchlist.find((candidate) => candidate.player_name === "Ja'Marr Chase")).toMatchObject({
      matched: true,
      calibrated_trust_label: "high",
    });
  });

  it("keeps blocked/archive rows capped and explains the cap", () => {
    const report = buildBlackbirdTrustMetadataAudit({
      projectionSeason: 2026,
      rows: [
        row({
          playerName: "Blocked Archive",
          rank: 1,
          activePolicyClass: "final_policy_blocked_archive",
          sourceConfidence: "high",
          marketRank: 2,
        }),
      ],
    });

    expect(report.rows[0].calibrated_trust_label).toBe("very_low");
    expect(report.rows[0].reason_codes).toContain("blocked_or_archive_policy");
  });

  it("records dry-run safety and does not mutate input rows", () => {
    const rows = [row({ playerName: "Stable", rank: 1, sourceConfidence: "high", marketRank: 1 })];
    const before = JSON.stringify(rows);
    const report = buildBlackbirdTrustMetadataAudit({ projectionSeason: 2026, rows });

    expect(JSON.stringify(rows)).toBe(before);
    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.marketAnchorEnabledByDefault).toBe(false);
    expect(report.supabaseWrites).toBe(false);
    expect(report.v82Enabled).toBe(false);
  });
});

function row(overrides: {
  playerName: string;
  rank: number;
  sourceConfidence?: "high" | "medium" | "low";
  marketRank?: number | null;
  activePolicyClass?: string | null;
}): BlackbirdBoardRow {
  const player = playerSource(overrides);
  const rawTrust = buildProjectionTrust({
    playerId: player.matched_player_id,
    playerName: overrides.playerName,
    position: "WR",
    projectionUnit: "season",
    projectionSource: "uploaded_ranking_projection",
    confidence: overrides.sourceConfidence,
    medianPoints: 300,
    matchStatus: "exact_id",
  });
  return {
    playerId: player.matched_player_id,
    playerName: overrides.playerName,
    position: "WR",
    team: "CIN",
    blackbirdBoardRank: overrides.rank,
    draftSuggestionRank: null,
    draftSuggestionScore: null,
    draftSuggestionType: null,
    blackbirdValueScore: 90,
    projectionPoints: 300,
    projectionLow: null,
    projectionHigh: null,
    projectionUnit: "season",
    projectionSource: "uploaded_ranking_projection",
    projectionTrust: { ...rawTrust, trustLabel: overrides.activePolicyClass?.includes("blocked") ? "very_low" : "high", trustScore: overrides.activePolicyClass?.includes("blocked") ? 20 : 90 },
    role: "locked_starter",
    roleConfidence: "high",
    replacementMedianPoints: 180,
    replacementRank: null,
    pointsAboveReplacement: 120,
    adp: overrides.marketRank ?? null,
    marketRank: overrides.marketRank ?? null,
    rankDelta: null,
    confidence: overrides.activePolicyClass?.includes("blocked") ? "very_low" : "high",
    risk: "low",
    blackbirdTier: 1,
    valueScoreComponents: null,
    contextualReasons: [],
    contextualDataGaps: [],
    planFit: "acceptable_fit",
    planFitReasons: [],
    needTimingAction: null,
    waitPlanTargetCount: null,
    drafted: false,
    dataStatus: {
      projection: "available",
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
  rank: number;
  sourceConfidence?: "high" | "medium" | "low";
  marketRank?: number | null;
  activePolicyClass?: string | null;
}): ScoredDraftTarget & {
  activePolicyClass?: string | null;
  policyGroup?: string | null;
  confidence?: string | null;
  confidenceScore?: number | null;
  marketRank?: number | null;
  marketMatchType?: string | null;
} {
  return {
    sleeper_player_id: `s-${overrides.playerName}`,
    matched_player_id: `p-${overrides.playerName}`,
    player_name: overrides.playerName,
    position: "WR",
    team: "CIN",
    rank: overrides.rank,
    adp: overrides.marketRank ?? null,
    projected_points: 300,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 90,
    recommendationTier: "elite_target",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    activePolicyClass: overrides.activePolicyClass ?? "final_policy_confirmed_active_clear",
    policyGroup: "confirmed_active_clear",
    confidence: overrides.sourceConfidence ?? "high",
    confidenceScore: overrides.sourceConfidence === "medium" ? 70 : overrides.sourceConfidence === "low" ? 50 : 90,
    marketRank: overrides.marketRank ?? null,
    marketMatchType: "name_team_position",
  };
}
