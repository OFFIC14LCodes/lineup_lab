import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionActiveUniverseGateFromData,
  writeProjectionActiveUniverseGateArtifacts,
} from "./projection-active-universe-gate";

import type { ProjectionActiveUniverseGateInput } from "./projection-active-universe-gate-types";
import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityAuditReport, ProjectionUniverseEligibilityRow } from "./projection-universe-eligibility-audit-types";
import type { ProjectionUniverseHygieneSummaryReport } from "./projection-universe-hygiene-summary-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

describe("projection active universe gate", () => {
  it("assigns active-universe gate statuses", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.activeGateCounts.statusCounts).toMatchObject({
      active_confirmed: 1,
      rookie_or_new_confirmed: 1,
      free_agent_plausible: 1,
      low_confidence_plausible: 1,
      stale_status_review: 1,
      legacy_archive_blocked: 1,
      kicker_policy_review: 1,
      manual_review_required: 1,
    });
  });

  it("blocks legacy rows from active confirmed status", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());
    const legacyRow = report.rows.find((row) => row.player === "Legacy QB");

    expect(legacyRow?.gateStatus).toBe("legacy_archive_blocked");
    expect(legacyRow?.reasonCodes).toContain("blocked_legacy_from_hygiene");
    expect(report.safetyGates.find((gate) => gate.name === "legacy_rows_not_active_confirmed")?.passed).toBe(true);
  });

  it("sends K rows to policy review", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());
    const kickerRow = report.rows.find((row) => row.player === "Policy K");

    expect(kickerRow?.gateStatus).toBe("kicker_policy_review");
    expect(kickerRow?.reasonCodes).toContain("kicker_policy_excluded");
    expect(report.sourceIntegrationNeeds.kickerSpecificDepthChartSourceNeeded).toBe(1);
  });

  it("classifies rookies, stale rows, and low-confidence rows with reasons", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Rookie RB")?.reasonCodes).toEqual(expect.arrayContaining(["rookie_current_class", "promotion_eligible"]));
    expect(report.rows.find((row) => row.player === "Stale RB")?.reasonCodes).toEqual(expect.arrayContaining(["old_last_seen_signal", "team_value_stale_suspect", "needs_current_roster_source"]));
    expect(report.rows.find((row) => row.player === "Low Confidence TE")?.gateStatus).toBe("low_confidence_plausible");
  });

  it("summarizes source needs and no-mutation candidate pools", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());

    expect(report.sourceIntegrationNeeds.currentRosterSourceNeeded).toBe(3);
    expect(report.sourceIntegrationNeeds.depthChartSourceNeeded).toBe(3);
    expect(report.sourceIntegrationNeeds.transactionFreeAgentStatusSourceNeeded).toBe(1);
    expect(report.sourceIntegrationNeeds.rookieDraftTeamSourceNeeded).toBe(0);
    expect(report.candidatePool).toMatchObject({
      activeUniverseCandidateRows: 3,
      blockedArchiveRows: 1,
      reviewRows: 3,
      kickerPolicyRows: 1,
    });
    expect(report.candidatePool.note).toContain("production outputs are not filtered");
  });

  it("cross-references the v8.2 safe subset path by gate status", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());

    expect(report.v82SafeSubsetCrossReference.byGateStatus.active_confirmed.would_use_v8_2_safe_subset).toBe(1);
    expect(report.v82SafeSubsetCrossReference.byGateStatus.rookie_or_new_confirmed.would_use_v8_2_safe_subset).toBe(1);
    expect(report.v82SafeSubsetCrossReference.byGateStatus.manual_review_required.would_stay_current_path).toBe(1);
    expect(report.v82SafeSubsetCrossReference.byGateStatus.legacy_archive_blocked.excluded_or_blocked).toBe(1);
    expect(report.v82SafeSubsetCrossReference.packetSummary.enabledSafeSubsetV82Rows).toBe(2);
  });

  it("reports top review tables and ambiguous team rows", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());

    expect(report.topReviewTables.staleStatusReview.map((row) => row.player)).toEqual(["Stale RB"]);
    expect(report.topReviewTables.legacyArchiveBlocked.map((row) => row.player)).toEqual(["Legacy QB"]);
    expect(report.topReviewTables.freeAgentPlausible.map((row) => row.player)).toEqual(["Free Agent WR"]);
    expect(report.topReviewTables.lowConfidencePlausible.map((row) => row.player)).toEqual(["Low Confidence TE"]);
    expect(report.topReviewTables.ambiguousTeamRows.map((row) => row.player)).toEqual(["Legacy QB", "Free Agent WR"]);
    expect(report.topReviewTables.kickerPolicyReview.map((row) => row.player)).toEqual(["Policy K"]);
  });

  it("reports safety gates and final recommendation", () => {
    const report = buildProjectionActiveUniverseGateFromData(fixtureInput());

    [
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "legacy_rows_not_active_confirmed",
      "k_rows_not_active_confirmed_without_policy",
      "stale_rows_reported",
      "source_needs_reported",
    ].forEach((name) => expect(report.safetyGates.find((gate) => gate.name === name)?.passed).toBe(true));
    expect(report.recommendation).toBe("active_universe_gate_needs_review");
  });

  it("blocks when stale rows are not reported consistently with H15", () => {
    const input = fixtureInput();
    input.universeHygieneSummary.hygieneCounts.staleHistorical = 2;

    const report = buildProjectionActiveUniverseGateFromData(input);

    expect(report.recommendation).toBe("active_universe_gate_blocked");
    expect(report.safetyGates.find((gate) => gate.name === "stale_rows_reported")?.passed).toBe(false);
  });

  it("writes json, markdown, and csv artifacts", () => {
    const report = buildProjectionActiveUniverseGateFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2098, includeIdp: true },
    });

    const artifacts = writeProjectionActiveUniverseGateArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-active-universe-gate-2098.json");
      expect(artifacts.markdownPath).toContain("projection-active-universe-gate-2098.md");
      expect(artifacts.csvPath).toContain("projection-active-universe-gate-2098.csv");
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(artifacts.jsonPath, { force: true });
      rmSync(artifacts.markdownPath, { force: true });
      rmSync(artifacts.csvPath, { force: true });
    }
  });
});

function fixtureInput(): ProjectionActiveUniverseGateInput {
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    universeEligibilityAudit: universeAudit(),
    universeHygieneSummary: hygieneSummary(),
    promotionCandidatePool: promotionPool(),
    featureFlagReviewPacket: featureFlagPacket(),
  };
}

function universeAudit(): ProjectionUniverseEligibilityAuditReport {
  const rows = [
    universeRow("p1", "Active WR", "WR", "KC", "active_plausible", ["has_current_team", "recent_nfl_activity"], "safe_to_shadow", 2025, "strong", false),
    universeRow("p2", "Rookie RB", "RB", "CHI", "rookie_or_new_player", ["has_current_team", "rookie_current_class"], "safe_to_shadow", null, "strong", true),
    universeRow("p3", "Free Agent WR", "WR", null, "active_plausible", ["missing_current_team", "recent_nfl_activity"], "needs_roster_source_confirmation", 2025, "weak", false),
    universeRow("p4", "Low Confidence TE", "TE", "NYG", "low_confidence_plausible", ["has_current_team"], "safe_to_shadow", 2025, "strong", false),
    universeRow("p5", "Stale RB", "RB", "LV", "stale_historical_signal", ["has_current_team", "old_last_seen_season", "no_2026_roster_signal"], "needs_roster_source_confirmation", 2020, "strong", false),
    universeRow("p6", "Legacy QB", "QB", null, "retired_or_legacy_suspect", ["legacy_name_match", "old_last_seen_season", "missing_current_team"], "exclude_from_promotion_candidate_pool", 2019, "weak", false),
    universeRow("p7", "Policy K", "K", "FA", "low_confidence_plausible", ["kicker_low_prior_fallback"], "needs_kicker_policy_review", 2025, "strong", false),
    universeRow("p8", "Manual LB", "LB", "DAL", "manual_review_required", ["manual_review_name_flag"], "manual_review_before_promotion", 2025, "strong", false),
  ];
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json" },
    summary: {
      totalProjectedRows: rows.length,
      statusCounts: {
        active_plausible: 2,
        rookie_or_new_player: 1,
        low_confidence_plausible: 2,
        stale_historical_signal: 1,
        retired_or_legacy_suspect: 1,
        manual_review_required: 1,
      },
      byPosition: [],
      byCohort: [],
      byTeam: {},
      byLastActiveSeason: {},
    },
    rows,
    criticalMovementReview: [],
    retiredLegacySuspects: [rows[5]],
    kickerReview: {
      totalKRows: 1,
      lowPriorFallbackRows: 1,
      criticalMovementRows: 0,
      movingEightToTwelveExpectedGames: 0,
      statusCounts: { low_confidence_plausible: 1 },
      recommendation: "Keep K current path.",
    },
    safetyGates: [{ name: "clean", passed: true, detail: "clean" }],
    verdict: "universe_shadow_ok_manual_review_needed",
    notes: [],
  };
}

function promotionPool(): ProjectionPromotionCandidatePoolReport {
  const rows = [
    promotionRow("p1", "Active WR", "WR", "KC", "active_plausible", "eligible_for_projection_promotion", ["active_plausible_allowed"], []),
    promotionRow("p2", "Rookie RB", "RB", "CHI", "rookie_or_new_player", "eligible_for_projection_promotion", ["rookie_allowed"], []),
    promotionRow("p3", "Free Agent WR", "WR", null, "active_plausible", "shadow_only", ["ambiguous_roster_signal_review"], []),
    promotionRow("p4", "Low Confidence TE", "TE", "NYG", "low_confidence_plausible", "eligible_for_projection_promotion", ["low_confidence_allowed"], []),
    promotionRow("p5", "Stale RB", "RB", "LV", "stale_historical_signal", "shadow_only", ["stale_signal_shadow_only"], ["old_last_seen_season"]),
    promotionRow("p6", "Legacy QB", "QB", null, "retired_or_legacy_suspect", "blocked_from_promotion", ["retired_legacy_blocked"], ["legacy_name_match"]),
    promotionRow("p7", "Policy K", "K", "FA", "low_confidence_plausible", "shadow_only", ["kicker_policy_shadow_only", "low_prior_shadow_only"], ["kicker_low_prior_fallback"]),
    promotionRow("p8", "Manual LB", "LB", "DAL", "manual_review_required", "manual_review_before_promotion", ["critical_movement_manual_review"], []),
  ];
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json", universeEligibilityAudit: "universe.json" },
    summary: {
      totalRows: rows.length,
      classificationCounts: {
        eligible_for_projection_promotion: 3,
        manual_review_before_promotion: 1,
        shadow_only: 3,
        blocked_from_promotion: 1,
      },
      byUniverseStatus: {},
      byPosition: {},
      byCohort: {},
      byTeamSignal: {},
      byMovementBucket: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      byRiskFlag: {},
      byRecommendedAction: {
        ready_for_promotion_review_pool: 3,
        manual_review_required_before_promotion: 1,
        keep_shadow_only: 2,
        exclude_from_promotion_candidate_pool: 1,
        review_kicker_policy_before_promotion: 1,
      },
    },
    poolMetrics: [],
    rows,
    topEligibleMovements: [],
    topManualReviewMovements: [],
    topBlockedMovements: [],
    topShadowOnlyMovements: [],
    criticalMovementRows: [rows[7]],
    kickerPolicy: {
      totalKRows: 1,
      eligibleKRows: 0,
      manualReviewKRows: 0,
      shadowOnlyKRows: 1,
      blockedKRows: 0,
      criticalMovementKRows: 0,
      excludedFromEligiblePoolRows: 1,
      recommendation: "Keep K excluded.",
    },
    safetyGates: [{ name: "clean", passed: true, detail: "clean" }],
    verdict: "promotion_pool_needs_manual_review",
    notes: [],
  };
}

function hygieneSummary(): ProjectionUniverseHygieneSummaryReport {
  return {
    hygieneCounts: { staleHistorical: 1 },
  } as ProjectionUniverseHygieneSummaryReport;
}

function featureFlagPacket(): ProjectionV82FeatureFlagReviewPacketReport {
  return {
    safetySummary: {
      disabledModeV82Rows: 0,
      enabledSafeSubsetV82Rows: 2,
      currentPathProtectedRows: 1,
      excludedRows: 4,
      blockedRows: 1,
      kRowsUsingV82: 0,
      criticalMoversUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
      missingArtifactFallbackRows: 8,
    },
  } as ProjectionV82FeatureFlagReviewPacketReport;
}

function universeRow(
  playerId: string,
  player: string,
  position: string,
  team: string | null,
  eligibilityStatus: ProjectionUniverseEligibilityRow["eligibilityStatus"],
  reasonCodes: ProjectionUniverseEligibilityRow["reasonCodes"],
  recommendedAction: ProjectionUniverseEligibilityRow["recommendedAction"],
  lastActiveSeason: number | null,
  matchConfidence: string,
  noPriorNflData: boolean,
): ProjectionUniverseEligibilityRow {
  return {
    playerId,
    sleeperId: null,
    gsisId: null,
    player,
    position,
    team,
    eligibilityStatus,
    reasonCodes,
    recommendedAction,
    lastActiveSeason,
    priorGames: noPriorNflData ? 0 : 10,
    noPriorNflData,
    matchConfidence,
    currentExpectedGames: 8,
    v82ExpectedGames: 12,
    gamesDelta: 4,
    projectedTotalPointDelta: 10,
    shadowMovementBucket: "10-20",
    criticalMovement: false,
    estimatedOverallRankMovement: null,
    projectionSignalSource: "fixture",
  };
}

function promotionRow(
  playerId: string,
  player: string,
  position: string,
  team: string | null,
  universeEligibilityStatus: ProjectionPromotionCandidateRow["universeEligibilityStatus"],
  promotionEligibilityClassification: ProjectionPromotionCandidateRow["promotionEligibilityClassification"],
  reasonCodes: ProjectionPromotionCandidateRow["reasonCodes"],
  universeReasonCodes: string[],
): ProjectionPromotionCandidateRow {
  return {
    playerId,
    sleeperId: null,
    gsisId: null,
    player,
    position,
    team,
    universeEligibilityStatus,
    promotionEligibilityClassification,
    reasonCodes,
    universeReasonCodes,
    currentExpectedGames: 8,
    v82ExpectedGames: 12,
    gamesDelta: 4,
    projectedTotalPointDelta: 10,
    movementBucket: "10-20",
    criticalMovement: player === "Manual LB",
    rankingMovementEstimated: false,
    estimatedOverallRankMovement: null,
    recommendedAction: promotionEligibilityClassification === "blocked_from_promotion"
      ? "exclude_from_promotion_candidate_pool"
      : promotionEligibilityClassification === "manual_review_before_promotion"
        ? "manual_review_required_before_promotion"
        : promotionEligibilityClassification === "shadow_only" && position === "K"
          ? "review_kicker_policy_before_promotion"
          : promotionEligibilityClassification === "shadow_only"
            ? "keep_shadow_only"
            : "ready_for_promotion_review_pool",
    riskFlags: [],
    cohortTags: [],
    lastActiveSeason: 2025,
    priorGames: 10,
    noPriorNflData: universeEligibilityStatus === "rookie_or_new_player",
    matchConfidence: team ? "strong" : "weak",
  };
}
