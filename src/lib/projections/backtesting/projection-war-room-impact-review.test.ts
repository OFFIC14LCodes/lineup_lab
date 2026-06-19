import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildProjectionWarRoomImpactReviewFromData,
  writeProjectionWarRoomImpactReviewArtifacts,
} from "./projection-war-room-impact-review";

import type { ProjectionRecommendationImpactReviewReport, ProjectionRecommendationImpactRow } from "./projection-recommendation-impact-review-types";

let tempCwd: string | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  if (tempCwd) {
    rmSync(tempCwd, { recursive: true, force: true });
    tempCwd = null;
  }
});

describe("projection war room impact review", () => {
  it("generates a dry-run War Room impact report", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.recommendation).toBe("war_room_impact_needs_review");
    expect(report.valueImpact.rowsEvaluated).toBe(2);
    expect(gate(report, "no_live_outputs_changed")?.passed).toBe(true);
    expect(gate(report, "war_room_unchanged_by_default")?.passed).toBe(true);
    expect(gate(report, "no_ai_api_calls")?.passed).toBe(true);
  });

  it("filters to the safe subset and carries protected-row checks forward", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.valueImpact.topValueMovers.map((row) => row.playerId)).toEqual(["safe-wr", "safe-qb"]);
    expect(report.protectedRowChecks.kRowsDoNotUseV82).toBe(true);
    expect(report.protectedRowChecks.criticalMovementRowsDoNotUseV82).toBe(true);
    expect(report.protectedRowChecks.meaningfulRankMoversDoNotUseV82).toBe(true);
    expect(report.protectedRowChecks.legacyStaleRowsDoNotUseV82).toBe(true);
    expect(report.protectedRowChecks.missingArtifactsFailClosed).toBe(true);
    expect(gate(report, "safe_subset_only")?.passed).toBe(true);
    expect(gate(report, "protected_rows_preserved")?.passed).toBe(true);
  });

  it("reports value impact through projected-point proxy logic", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.valueImpact.estimateMethod).toBe("projected_point_delta_proxy");
    expect(report.valueImpact.rowsWithValueEstimate).toBe(2);
    expect(report.valueImpact.rowsWithValueMovement).toBe(2);
    expect(report.valueImpact.averageProjectedPointDelta).toBe(16.5);
    expect(report.valueImpact.maxProjectedPointDelta).toBe(25);
    expect(report.valueImpact.movementBuckets["20+"]).toBe(1);
  });

  it("compares representative reason stacks and explains missing exact row shape", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.playerReasoningImpact.estimateMethod).toBe("representative_reason_stack_projection_delta");
    expect(report.playerReasoningImpact.rowsWhereReasoningWouldLikelyChange).toBeGreaterThan(0);
    expect(report.playerReasoningImpact.rowsWhereProjectionReasonsChange).toBeGreaterThan(0);
    expect(report.playerReasoningImpact.rowsWhereHeadlineChanges).toBe(0);
    expect(report.playerReasoningImpact.requiredFutureData.join(" ")).toContain("AvailablePlayer");
  });

  it("compares representative GM Brief output without AI API calls", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.gmBriefImpact.estimateMethod).toBe("representative_ai_context_projection_delta");
    expect(report.gmBriefImpact.topRecommendationSummaryChanged).toBe(true);
    expect(report.gmBriefImpact.headlineChanged).toBe(false);
    expect(report.gmBriefImpact.requiredFutureData.join(" ")).toContain("Representative draft room fixture");
  });

  it("reports Plan Alignment helper extraction fallback", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.planAlignmentImpact.estimateMethod).toBe("extracted_helper_exact_available_fields");
    expect(report.planAlignmentImpact.rowsWithPlanAlignmentEstimate).toBe(2);
    expect(report.planAlignmentImpact.planFitChangedRows).toBe(0);
    expect(report.planAlignmentImpact.needFitChangedRows).toBe(0);
    expect(report.planAlignmentImpact.valueFitChangedRows).toBe(0);
    expect(report.planAlignmentImpact.scarcityFitChangedRows).toBe(0);
    expect(report.planAlignmentImpact.formatFitChangedRows).toBe(0);
    expect(report.planAlignmentImpact.depthLuxuryRiskCheckChangedRows).toBe(0);
    expect(report.planAlignmentImpact.notEstimatedRows).toBe(0);
    expect(gate(report, "plan_alignment_impact_estimated_or_explained")?.passed).toBe(true);
  });

  it("summarizes risk/confidence as projection-only no-change", () => {
    const report = buildProjectionWarRoomImpactReviewFromData(input());

    expect(report.riskConfidenceImpact.riskConfidenceEstimated).toBe("yes");
    expect(report.riskConfidenceImpact.riskChipChangedRows).toBe(0);
    expect(report.riskConfidenceImpact.confidenceChipChangedRows).toBe(0);
    expect(report.riskConfidenceImpact.riskSummaryChanged).toBe(false);
    expect(gate(report, "risk_confidence_impact_estimated_or_explained")?.passed).toBe(true);
  });

  it("blocks if protected-row checks fail", () => {
    const unsafe = recommendationImpact();
    unsafe.protectedRowChecks.kRowsDoNotUseV82 = false;
    const report = buildProjectionWarRoomImpactReviewFromData(input({ recommendationImpact: unsafe }));

    expect(gate(report, "protected_rows_preserved")?.passed).toBe(false);
    expect(report.recommendation).toBe("war_room_impact_blocked");
  });

  it("writes json, markdown, and csv artifacts", () => {
    tempCwd = mkdtempSync(path.join(tmpdir(), "h14-3-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempCwd);
    const report = buildProjectionWarRoomImpactReviewFromData(input());
    const artifacts = writeProjectionWarRoomImpactReviewArtifacts(report);

    expect(existsSync(artifacts.jsonPath)).toBe(true);
    expect(existsSync(artifacts.markdownPath)).toBe(true);
    expect(existsSync(artifacts.csvPath)).toBe(true);
    expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("Projection War Room Impact Review");
    expect(readFileSync(artifacts.csvPath, "utf8")).toContain("top_value_mover");
  });

  it("does not import Supabase, live recommendation builders, draft UI, or AI clients", () => {
    const source = readFileSync("src/lib/projections/backtesting/projection-war-room-impact-review.ts", "utf8");

    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("buildWarRoomRecommendations(");
    expect(source).not.toContain("from \"@/components/draft-war-room");
    expect(source).not.toContain("from \"src/components/draft-war-room");
    expect(source).not.toContain("openai");
    expect(source).not.toContain("chat.completions");
    expect(gate(buildProjectionWarRoomImpactReviewFromData(input()), "no_supabase_writes")?.passed).toBe(true);
  });
});

function input(overrides: Partial<Parameters<typeof buildProjectionWarRoomImpactReviewFromData>[0]> = {}): Parameters<typeof buildProjectionWarRoomImpactReviewFromData>[0] {
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    recommendationImpact: overrides.recommendationImpact ?? recommendationImpact(),
    sourceArtifacts: overrides.sourceArtifacts,
  };
}

function recommendationImpact(): ProjectionRecommendationImpactReviewReport {
  const rows = [
    impactRow("safe-wr", "Safe WR", "WR", 100, 125, 25),
    impactRow("safe-qb", "Safe QB", "QB", 100, 108, 8),
  ];
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: {
      productionShadowReview: "in-memory",
      pipelinePreview: "in-memory",
      readiness: "in-memory",
      shadow: "in-memory",
      draftSuggestionArtifact: null,
      blackbirdRankArtifact: null,
    },
    summary: {
      totalRowsEvaluated: 4,
      v82CandidateRows: 2,
      currentPathProtectedRows: 1,
      excludedRows: 1,
      blockedRows: 0,
      averageProjectedPointDelta: 16.5,
      medianProjectedPointDelta: 16.5,
      maxProjectedPointDelta: 25,
      movementBuckets: { "0": 0, "0-2": 0, "2-5": 0, "5-10": 1, "10-20": 0, "20+": 1 },
      positionMovement: [],
      cohortMovement: [],
      topProjectedPointMovers: rows,
    },
    blackbirdRankImpact: {
      estimateMethod: "shadow_rank_fields",
      limitation: null,
      rowsWithRankEstimate: 2,
      overallRankMovementBuckets: [],
      positionRankMovementBuckets: [],
      positionRankMovement: [],
      topOverallRankRisers: [],
      topOverallRankFallers: [],
      topPositionRankRisers: [],
      topPositionRankFallers: [],
      top300AffectedRows: [],
      qbSuperflexSensitiveMovement: [],
      starterTierMovement: [],
      deepTierNoiseMovement: [],
    },
    draftSuggestionImpact: {
      estimateMethod: "artifact_proxy",
      limitation: "fixture",
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
    safetyGates: [],
    recommendation: "recommendation_impact_needs_review",
    notes: [],
  };
}

function impactRow(playerId: string, player: string, position: string, currentProjectedTotal: number, v82ProjectedTotal: number, projectedPointDelta: number): ProjectionRecommendationImpactRow {
  return {
    playerId,
    player,
    position,
    team: "TST",
    selectorSelection: "v8_2_candidate_path",
    selectorReason: "eligible_safe_candidate",
    cohorts: [`${position.toLowerCase()}_cohort`],
    currentProjectedTotal,
    v82ProjectedTotal,
    projectedPointDelta,
    currentOverallRank: 20,
    v82OverallRank: 15,
    estimatedOverallRankMovement: -5,
    currentPositionRank: 8,
    v82PositionRank: 5,
    estimatedPositionRankMovement: -3,
    protectedByPolicy: false,
    protectionReasons: [],
    criticalMovement: false,
    meaningfulRankMover: false,
    universeEligibilityStatus: null,
  };
}

function gate(report: ReturnType<typeof buildProjectionWarRoomImpactReviewFromData>, name: string) {
  return report.safetyGates.find((item) => item.name === name);
}
