import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionUniverseHygieneSummaryFromData,
  writeProjectionUniverseHygieneSummaryArtifacts,
} from "./projection-universe-hygiene-summary";

import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityAuditReport, ProjectionUniverseEligibilityRow } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

describe("projection universe hygiene summary", () => {
  it("generates a dry-run hygiene summary with needs-review recommendation", () => {
    const report = buildProjectionUniverseHygieneSummaryFromData(fixtureInput());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.recommendation).toBe("universe_hygiene_needs_review");
    expect(report.hygieneCounts.totalRows).toBe(5);
    expect(report.staleLegacyReview.totalRows).toBe(2);
  });

  it("aggregates legacy and stale counts", () => {
    const report = buildProjectionUniverseHygieneSummaryFromData(fixtureInput());

    expect(report.hygieneCounts.staleHistorical).toBe(1);
    expect(report.hygieneCounts.retiredLegacySuspect).toBe(1);
    expect(report.hygieneCounts.oldLastSeenSignal).toBe(2);
    expect(report.staleLegacyReview.topSuspects.map((row) => row.player)).toEqual(["Eli Manning", "Doug Martin"]);
    expect(report.staleLegacyReview.topSuspects[0]).toMatchObject({
      lastActiveSeason: 2019,
      whyBlocked: "exclude_from_promotion_candidate_pool",
    });
  });

  it("summarizes kicker policy", () => {
    const report = buildProjectionUniverseHygieneSummaryFromData(fixtureInput());

    expect(report.kickerPolicy).toMatchObject({
      totalKRows: 1,
      eligibleKRows: 0,
      shadowOnlyKRows: 1,
      blockedKRows: 0,
      lowPriorKRows: 1,
      criticalMovementKRows: 0,
      recommendedNextAction: "kicker_policy_review_required",
    });
    expect(report.kickerPolicy.whyExcludedFromV82Promotion).toContain("low-prior kicker fallback");
  });

  it("aggregates roster and team confidence", () => {
    const report = buildProjectionUniverseHygieneSummaryFromData(fixtureInput());

    expect(report.rosterTeamConfidence).toMatchObject({
      rowsWithCurrentTeam: 3,
      rowsMissingTeam: 2,
      rowsWithAmbiguousTeam: 3,
      rowsWithStaleTeam: 1,
      rookiesWithTeam: 0,
      rookiesMissingTeam: 1,
      veteransMissingTeam: 1,
      sourceStatus: "insufficient_current_roster_source",
    });
  });

  it("reports required hygiene gates and no live mutation gates", () => {
    const report = buildProjectionUniverseHygieneSummaryFromData(fixtureInput());

    [
      "legacy_rows_identified",
      "kicker_policy_flagged",
      "missing_team_rows_reported",
      "blocked_rows_not_promoted",
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
    ].forEach((name) => expect(report.hygieneGates.find((gate) => gate.name === name)?.passed).toBe(true));
  });

  it("blocks when a hygiene gate fails", () => {
    const input = fixtureInput();
    const legacyRow = input.promotionCandidatePool.rows.find((row) => row.player === "Eli Manning");
    if (!legacyRow) throw new Error("missing legacy fixture row");
    legacyRow.promotionEligibilityClassification = "eligible_for_projection_promotion";

    const report = buildProjectionUniverseHygieneSummaryFromData(input);

    expect(report.recommendation).toBe("universe_hygiene_blocked");
    expect(report.hygieneGates.find((gate) => gate.name === "blocked_rows_not_promoted")?.passed).toBe(false);
  });

  it("writes json, markdown, and csv artifacts", () => {
    const report = buildProjectionUniverseHygieneSummaryFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2099, includeIdp: true },
    });

    const artifacts = writeProjectionUniverseHygieneSummaryArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-universe-hygiene-summary-2099.json");
      expect(artifacts.markdownPath).toContain("projection-universe-hygiene-summary-2099.md");
      expect(artifacts.csvPath).toContain("projection-universe-hygiene-summary-2099.csv");
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

function fixtureInput() {
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    universeEligibilityAudit: universeAudit(),
    promotionCandidatePool: promotionPool(),
    featureFlagReviewPacket: featureFlagPacket(),
  };
}

function universeAudit(): ProjectionUniverseEligibilityAuditReport {
  const rows = [
    universeRow("p1", "Active Player", "WR", "KC", "active_plausible", [], "safe_to_shadow", 2025, "strong"),
    universeRow("p2", "Rookie Player", "RB", null, "rookie_or_new_player", ["rookie_current_class", "missing_current_team"], "needs_roster_source_confirmation", null, "weak"),
    universeRow("p3", "Eli Manning", "QB", null, "retired_or_legacy_suspect", ["legacy_name_match", "old_last_seen_season", "missing_current_team"], "exclude_from_promotion_candidate_pool", 2019, "weak"),
    universeRow("p4", "Doug Martin", "RB", "OAK", "stale_historical_signal", ["old_last_seen_season", "no_2026_roster_signal"], "needs_roster_source_confirmation", 2020, "strong"),
    universeRow("p5", "Low Prior K", "K", "FA", "low_confidence_plausible", ["kicker_low_prior_fallback"], "needs_kicker_policy_review", 2025, "weak"),
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
        active_plausible: 1,
        low_confidence_plausible: 1,
        rookie_or_new_player: 1,
        stale_historical_signal: 1,
        retired_or_legacy_suspect: 1,
        manual_review_required: 0,
      },
      byPosition: [],
      byCohort: [],
      byTeam: {},
      byLastActiveSeason: {},
    },
    rows,
    criticalMovementReview: [],
    retiredLegacySuspects: [rows[2]],
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
    promotionRow("p1", "Active Player", "WR", "eligible_for_projection_promotion", [], [], "ready_for_promotion_review_pool"),
    promotionRow("p2", "Rookie Player", "RB", "eligible_for_projection_promotion", [], [], "ready_for_promotion_review_pool"),
    promotionRow("p3", "Eli Manning", "QB", "blocked_from_promotion", ["retired_legacy_blocked"], [], "exclude_from_promotion_candidate_pool"),
    promotionRow("p4", "Doug Martin", "RB", "shadow_only", ["stale_signal_shadow_only"], [], "keep_shadow_only"),
    promotionRow("p5", "Low Prior K", "K", "shadow_only", ["kicker_policy_shadow_only", "low_prior_shadow_only"], ["kicker_low_prior_fallback"], "review_kicker_policy_before_promotion"),
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
        eligible_for_projection_promotion: 2,
        manual_review_before_promotion: 0,
        shadow_only: 2,
        blocked_from_promotion: 1,
      },
      byUniverseStatus: {},
      byPosition: {},
      byCohort: {},
      byTeamSignal: {},
      byMovementBucket: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      byRiskFlag: {},
      byRecommendedAction: {
        ready_for_promotion_review_pool: 2,
        manual_review_required_before_promotion: 0,
        keep_shadow_only: 1,
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
    criticalMovementRows: [],
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

function featureFlagPacket(): ProjectionV82FeatureFlagReviewPacketReport {
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    recommendation: "ready_for_controlled_flag_review",
    sourceArtifacts: {
      productionShadowReview: "production.json",
      recommendationImpactReview: "recommendation.json",
      warRoomImpactReview: "war-room.json",
      featureFlagReadiness: "readiness.json",
      featureFlagPreview: "preview.json",
      selectorPipelinePreview: "pipeline.json",
      snapshotDiffGuard: "snapshot-diff.json",
      foundationHandoff: "foundation.json",
      preseasonProjectionSnapshot: "snapshot.json",
    },
    executiveSummary: { summary: "ready", allowedNextStep: "runbook", notAllowed: [] },
    safetySummary: {
      disabledModeV82Rows: 0,
      enabledSafeSubsetV82Rows: 3210,
      currentPathProtectedRows: 147,
      excludedRows: 1033,
      blockedRows: 1245,
      kRowsUsingV82: 0,
      criticalMoversUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
      missingArtifactFallbackRows: 5635,
    },
    recommendationImpactSummary: {
      topSuggestionChanged: false,
      top5Overlap: 5,
      top10Overlap: 10,
      top300AffectedRows: 247,
      qbSuperflexSensitiveRows: 0,
      starterTierMovementRows: 0,
      deepTierNoiseRowsShown: 50,
    },
    warRoomImpactSummary: {
      valueMovementRows: 50,
      reasoningLikelyChangedRows: 50,
      gmBriefHeadlineChanged: false,
      gmBriefTopRecommendationSummaryChanged: true,
      planAlignmentChangedRows: 0,
      riskConfidenceChangedRows: 0,
      notEstimatedAreas: [],
    },
    topReviewExamples: { projectedPointMovers: [], reasoningChangedRows: [], top300AffectedRows: [], deepTierNoiseRows: [] },
    goNoGoChecklist: [],
    safetyGates: [],
    notes: [],
  };
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
    priorGames: 10,
    noPriorNflData: eligibilityStatus === "rookie_or_new_player",
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
  classification: ProjectionPromotionCandidateRow["promotionEligibilityClassification"],
  reasonCodes: ProjectionPromotionCandidateRow["reasonCodes"],
  universeReasonCodes: string[],
  recommendedAction: ProjectionPromotionCandidateRow["recommendedAction"],
): ProjectionPromotionCandidateRow {
  return {
    playerId,
    sleeperId: null,
    gsisId: null,
    player,
    position,
    team: position === "QB" ? null : "FA",
    universeEligibilityStatus: player === "Eli Manning" ? "retired_or_legacy_suspect" : "active_plausible",
    promotionEligibilityClassification: classification,
    reasonCodes,
    universeReasonCodes,
    currentExpectedGames: 8,
    v82ExpectedGames: 12,
    gamesDelta: 4,
    projectedTotalPointDelta: 10,
    movementBucket: "10-20",
    criticalMovement: false,
    rankingMovementEstimated: false,
    estimatedOverallRankMovement: null,
    recommendedAction,
    riskFlags: [],
    cohortTags: [],
    lastActiveSeason: 2025,
    priorGames: 10,
    noPriorNflData: false,
    matchConfidence: "strong",
  };
}
