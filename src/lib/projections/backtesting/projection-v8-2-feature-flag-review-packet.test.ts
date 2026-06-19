import { describe, expect, it } from "vitest";

import {
  buildProjectionV82FeatureFlagReviewPacketFromData,
  runProjectionV82FeatureFlagReviewPacket,
} from "./projection-v8-2-feature-flag-review-packet";

import type { ProjectionProductionShadowReviewReport } from "./projection-production-shadow-review-types";
import type { ProjectionRecommendationImpactReviewReport, ProjectionRecommendationImpactRow } from "./projection-recommendation-impact-review-types";
import type { ProjectionWarRoomImpactReviewReport } from "./projection-war-room-impact-review-types";

describe("Projection v8.2 feature-flag review packet", () => {
  it("generates a ready dry-run packet from clean H14/H14.2/H14.3 artifacts", () => {
    const report = buildProjectionV82FeatureFlagReviewPacketFromData(fixtureInput());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.featureFlagName).toBe("BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES");
    expect(report.recommendation).toBe("ready_for_controlled_flag_review");
    expect(report.executiveSummary.allowedNextStep).toBe("Create a disabled-by-default operational feature flag runbook and optionally add admin/dev-only visibility for selected model source.");
    expect(report.executiveSummary.notAllowed).toEqual([
      "Do not set BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES=true in production yet.",
      "Do not write v8.2 projections to Supabase production tables yet.",
      "Do not use v8.2 in live Draft Suggestions yet.",
    ]);
  });

  it("aggregates safety summary logic from production and recommendation artifacts", () => {
    const report = buildProjectionV82FeatureFlagReviewPacketFromData(fixtureInput());

    expect(report.safetySummary).toMatchObject({
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
    });
  });

  it("aggregates recommendation impact summary logic", () => {
    const report = buildProjectionV82FeatureFlagReviewPacketFromData(fixtureInput());

    expect(report.recommendationImpactSummary).toEqual({
      topSuggestionChanged: false,
      top5Overlap: 5,
      top10Overlap: 10,
      top300AffectedRows: 247,
      qbSuperflexSensitiveRows: 0,
      starterTierMovementRows: 0,
      deepTierNoiseRowsShown: 50,
    });
    expect(report.topReviewExamples.top300AffectedRows).toHaveLength(10);
    expect(report.topReviewExamples.deepTierNoiseRows).toHaveLength(10);
  });

  it("aggregates War Room impact summary logic", () => {
    const report = buildProjectionV82FeatureFlagReviewPacketFromData(fixtureInput());

    expect(report.warRoomImpactSummary).toEqual({
      valueMovementRows: 50,
      reasoningLikelyChangedRows: 50,
      gmBriefHeadlineChanged: false,
      gmBriefTopRecommendationSummaryChanged: true,
      planAlignmentChangedRows: 0,
      riskConfidenceChangedRows: 0,
      notEstimatedAreas: [],
    });
    expect(report.topReviewExamples.reasoningChangedRows).toHaveLength(10);
  });

  it("blocks when any aggregated safety gate fails", () => {
    const input = fixtureInput();
    input.productionShadowReview.safetyGates = [{ name: "disabled_mode_current_path_only", passed: false, detail: "failed" }];

    const report = buildProjectionV82FeatureFlagReviewPacketFromData(input);

    expect(report.recommendation).toBe("blocked_for_flag_review");
    expect(report.safetyGates.some((gate) => !gate.passed)).toBe(true);
  });

  it("requires review for starter-tier or QB/Superflex-sensitive movement", () => {
    const input = fixtureInput();
    input.recommendationImpactReview.blackbirdRankImpact.starterTierMovement = [impactRow(1)];

    const report = buildProjectionV82FeatureFlagReviewPacketFromData(input);

    expect(report.recommendation).toBe("needs_value_reasoning_review");
  });

  it("keeps explicit no-live-mutation checklist items passing", () => {
    const report = buildProjectionV82FeatureFlagReviewPacketFromData(fixtureInput());

    expect(report.goNoGoChecklist.find((item) => item.name === "Supabase writes unchanged")?.passed).toBe(true);
    expect(report.goNoGoChecklist.find((item) => item.name === "Rankings unchanged by default")?.passed).toBe(true);
    expect(report.goNoGoChecklist.find((item) => item.name === "Draft Suggestions unchanged by default")?.passed).toBe(true);
    expect(report.goNoGoChecklist.find((item) => item.name === "War Room unchanged by default")?.passed).toBe(true);
    expect(report.goNoGoChecklist.find((item) => item.name === "No AI API calls")?.passed).toBe(true);
  });

  it("fails closed when required artifacts are missing", () => {
    expect(() => runProjectionV82FeatureFlagReviewPacket({ projectionSeason: 1901, includeIdp: true })).toThrow(/Missing artifacts[\\/]projections[\\/]backtesting/);
  });
});

function fixtureInput() {
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    productionShadowReview: productionReview(),
    recommendationImpactReview: recommendationReview(),
    warRoomImpactReview: warRoomReview(),
  };
}

function productionReview(): ProjectionProductionShadowReviewReport {
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
    selectorWiredBeyondDryRun: false,
    sourceArtifacts: {
      pipelinePreview: "pipeline.json",
      readiness: "readiness.json",
      shadow: "shadow.json",
      snapshotDiffGuard: "snapshot.json",
      foundationHandoff: "foundation.json",
    },
    productionPathAudit: [],
    disabledModeEquivalence: {
      rowsEvaluated: 5635,
      currentPathRows: 5635,
      v82Rows: 0,
      excludedRows: 0,
      blockedRows: 0,
      projectionTotalMismatchesVsCurrent: 0,
      rankingAffectingOutputDeltaRows: 0,
      maxProjectionDeltaVsCurrent: 0,
      protectedRowViolations: 0,
      mismatchesWithSelectorPreview: 0,
      mismatchesWithReadiness: 0,
      kRowsUsingV82: 0,
      criticalMovementRowsUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
      movementBuckets: {},
      positionSummaries: [],
      cohortSummaries: [],
    },
    enabledModeShadow: {
      rowsEvaluated: 5635,
      currentPathRows: 147,
      v82Rows: 3210,
      excludedRows: 1033,
      blockedRows: 1245,
      projectionTotalMismatchesVsCurrent: 0,
      rankingAffectingOutputDeltaRows: 3210,
      maxProjectionDeltaVsCurrent: 18,
      protectedRowViolations: 0,
      mismatchesWithSelectorPreview: 0,
      mismatchesWithReadiness: 0,
      kRowsUsingV82: 0,
      criticalMovementRowsUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
      movementBuckets: {},
      positionSummaries: [],
      cohortSummaries: [],
    },
    missingArtifactsMode: {
      rowsEvaluated: 5635,
      currentPathRows: 5635,
      v82Rows: 0,
      excludedRows: 0,
      blockedRows: 0,
      projectionTotalMismatchesVsCurrent: 0,
      rankingAffectingOutputDeltaRows: 0,
      maxProjectionDeltaVsCurrent: 0,
      protectedRowViolations: 0,
      mismatchesWithSelectorPreview: 0,
      mismatchesWithReadiness: 0,
      kRowsUsingV82: 0,
      criticalMovementRowsUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
      movementBuckets: {},
      positionSummaries: [],
      cohortSummaries: [],
    },
    summary: {
      totalProjectionRows: 5635,
      currentPathRows: 147,
      v82ShadowRows: 3210,
      excludedRows: 1033,
      blockedRows: 1245,
      kRowsUsingV82: 0,
      criticalMoversUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
      missingArtifactFallbackRows: 5635,
      projectionPointDeltas: { rowsWithDelta: 3210, maxAbsDelta: 18, averageAbsDelta: 1.4 },
      rankImpactDeltas: {
        rowsWithEstimatedOverallRankMovement: 3210,
        rowsWithEstimatedPositionRankMovement: 3210,
        maxAbsOverallRankMovement: 12,
        maxAbsPositionRankMovement: 4,
      },
      draftSuggestionImpactEstimate: { estimatedRowsWithPointDelta: 3210, limitation: "proxy" },
      warRoomImpactEstimate: { estimatedRowsWithPointDelta: 3210, limitation: "proxy" },
    },
    impactPreview: {
      topProjectedPointDeltas: Array.from({ length: 12 }, (_, index) => productionImpactRow(index + 1)),
      topEstimatedBlackbirdRankMovementRows: [],
      topEstimatedDraftSuggestionMovementRows: [],
      positionsMostAffected: [],
      cohortsMostAffected: [],
      rowsWhereCurrentPathPreservedDueToProtectionPolicy: [],
      blackbirdRankImpactEstimate: "estimated_from_shadow_rank_fields",
      draftSuggestionImpactEstimate: "estimated_from_projection_delta_proxy",
      warRoomImpactEstimate: "estimated_from_projection_delta_proxy",
      missingDataNotes: [],
    },
    safetyGates: [{ name: "all_clean", passed: true, detail: "clean" }],
    recommendation: "production_shadow_needs_review",
    notes: [],
  };
}

function recommendationReview(): ProjectionRecommendationImpactReviewReport {
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: {
      productionShadowReview: "production.json",
      pipelinePreview: "pipeline.json",
      readiness: "readiness.json",
      shadow: "shadow.json",
      draftSuggestionArtifact: null,
      blackbirdRankArtifact: null,
    },
    summary: {
      totalRowsEvaluated: 5635,
      v82CandidateRows: 3210,
      currentPathProtectedRows: 147,
      excludedRows: 1033,
      blockedRows: 1245,
      averageProjectedPointDelta: 1.4,
      medianProjectedPointDelta: 0,
      maxProjectedPointDelta: 18,
      movementBuckets: { "0": 0, "0-2": 0, "2-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      positionMovement: [],
      cohortMovement: [],
      topProjectedPointMovers: Array.from({ length: 50 }, (_, index) => impactRow(index + 1)),
    },
    blackbirdRankImpact: {
      estimateMethod: "shadow_rank_fields",
      limitation: null,
      rowsWithRankEstimate: 3210,
      overallRankMovementBuckets: [],
      positionRankMovementBuckets: [],
      positionRankMovement: [],
      topOverallRankRisers: [],
      topOverallRankFallers: [],
      topPositionRankRisers: [],
      topPositionRankFallers: [],
      top300AffectedRows: Array.from({ length: 247 }, (_, index) => impactRow(index + 1)),
      qbSuperflexSensitiveMovement: [],
      starterTierMovement: [],
      deepTierNoiseMovement: Array.from({ length: 50 }, (_, index) => impactRow(index + 1)),
    },
    draftSuggestionImpact: {
      estimateMethod: "artifact_proxy",
      limitation: "proxy",
      topSuggestionChanged: false,
      top5SuggestionOverlap: 5,
      top10SuggestionOverlap: 10,
      rowsEnteringTop10: [],
      rowsLeavingTop10: [],
      largestSuggestionRankRisers: [],
      largestSuggestionRankFallers: [],
      positionDistributionOfChanges: {},
      protectedRowsRemainedCurrentPath: true,
    },
    warRoomImpact: {
      projectionValuesChanged: "estimated",
      playerValueChanged: "not_estimated",
      reasoningTextAffected: "not_estimated",
      gmBriefAffected: "not_estimated",
      planAlignmentAffected: "not_estimated",
      riskConfidenceAffected: "not_estimated",
      reasons: {},
    },
    protectedRowChecks: {
      kRowsDoNotUseV82: true,
      criticalMovementRowsDoNotUseV82: true,
      meaningfulRankMoversDoNotUseV82: true,
      legacyStaleRowsDoNotUseV82: true,
      missingArtifactsFailClosed: true,
    },
    safetyGates: [{ name: "all_clean", passed: true, detail: "clean" }],
    recommendation: "recommendation_impact_needs_review",
    notes: [],
  };
}

function warRoomReview(): ProjectionWarRoomImpactReviewReport {
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: {
      recommendationImpactReview: "recommendation.json",
      productionShadowReview: "production.json",
      pipelinePreview: "pipeline.json",
      readiness: "readiness.json",
      shadow: "shadow.json",
    },
    valueImpact: {
      estimateMethod: "projected_point_delta_proxy",
      limitation: "proxy",
      rowsEvaluated: 3210,
      rowsWithValueEstimate: 50,
      rowsWithValueMovement: 50,
      averageProjectedPointDelta: 1.4,
      maxProjectedPointDelta: 18,
      topValueMovers: Array.from({ length: 50 }, (_, index) => impactRow(index + 1)),
      movementBuckets: { "0": 0, "0-2": 0, "2-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      positionMovement: [],
      cohortMovement: [],
    },
    playerReasoningImpact: {
      estimateMethod: "representative_reason_stack_projection_delta",
      limitation: "proxy",
      rowsWhereReasoningWouldLikelyChange: 50,
      rowsWhereHeadlineChanges: 50,
      rowsWhereProjectionReasonsChange: 50,
      rowsWhereRiskReasonsChange: 0,
      rowsWhereDataGapReasonsChange: 0,
      topExamples: Array.from({ length: 25 }, (_, index) => warRoomExample(index + 1)),
      requiredFutureData: [],
    },
    gmBriefImpact: {
      estimateMethod: "representative_ai_context_projection_delta",
      limitation: "proxy",
      headlineChanged: false,
      topRecommendationSummaryChanged: true,
      rosterNeedSummaryChanged: false,
      scarcityRiskSummaryChanged: false,
      watchListChanged: false,
      dataGapsChanged: false,
      requiredFutureData: [],
    },
    planAlignmentImpact: {
      estimateMethod: "extracted_helper_exact_available_fields",
      limitation: "exact",
      rowsWithPlanAlignmentEstimate: 50,
      planFitChangedRows: 0,
      needFitChangedRows: 0,
      valueFitChangedRows: 0,
      scarcityFitChangedRows: 0,
      formatFitChangedRows: 0,
      depthLuxuryRiskCheckChangedRows: 0,
      topExamples: [],
      notEstimatedRows: 0,
      notEstimatedReason: null,
    },
    riskConfidenceImpact: {
      riskConfidenceEstimated: "yes",
      limitation: "projection-only no-change",
      riskChipChangedRows: 0,
      confidenceChipChangedRows: 0,
      riskSummaryChanged: false,
      topExamples: [],
    },
    protectedRowChecks: {
      kRowsDoNotUseV82: true,
      criticalMovementRowsDoNotUseV82: true,
      meaningfulRankMoversDoNotUseV82: true,
      legacyStaleRowsDoNotUseV82: true,
      missingArtifactsFailClosed: true,
    },
    safetyGates: [
      { name: "all_clean", passed: true, detail: "clean" },
      { name: "no_ai_api_calls", passed: true, detail: "deterministic only" },
    ],
    recommendation: "war_room_impact_needs_review",
    notes: [],
  };
}

function productionImpactRow(index: number) {
  return {
    playerId: `p${index}`,
    player: `Player ${index}`,
    position: "WR",
    team: "FA",
    currentProjectedTotal: 100,
    selectedProjectedTotal: 110,
    v82ProjectedTotal: 110,
    projectedTotalDeltaVsCurrent: 10,
    currentOverallRank: index,
    shadowOverallRank: index + 1,
    estimatedOverallRankMovement: 1,
    currentPositionRank: index,
    shadowPositionRank: index + 1,
    estimatedPositionRankMovement: 1,
    selectorReason: "safe subset",
    preservedByPolicy: false,
    protectionReasons: [],
  };
}

function impactRow(index: number): ProjectionRecommendationImpactRow {
  return {
    playerId: `p${index}`,
    player: `Player ${index}`,
    position: "WR",
    team: "FA",
    selectorSelection: "v8_2_candidate_path",
    selectorReason: "safe subset",
    cohorts: ["safe"],
    currentProjectedTotal: 100,
    v82ProjectedTotal: 110,
    projectedPointDelta: 10,
    currentOverallRank: index,
    v82OverallRank: index + 1,
    estimatedOverallRankMovement: 1,
    currentPositionRank: index,
    v82PositionRank: index + 1,
    estimatedPositionRankMovement: 1,
    protectedByPolicy: false,
    protectionReasons: [],
    criticalMovement: false,
    meaningfulRankMover: false,
    universeEligibilityStatus: "eligible",
  };
}

function warRoomExample(index: number) {
  return {
    playerId: `p${index}`,
    player: `Player ${index}`,
    position: "WR",
    team: "FA",
    projectedPointDelta: 10,
    currentProjection: 100,
    v82Projection: 110,
    changedFields: ["projection_reasons"],
    note: "Reasoning changed.",
  };
}
