import { describe, expect, it } from "vitest";

import {
  buildProjectionPromotionReviewDecisionsFromData,
  parseDecisionTemplateCsv,
  renderDecisionTemplateCsv,
  resolveDecisionToClassification,
  templateRowFor,
} from "./projection-promotion-review-decisions";
import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionManualReviewReport, ProjectionPromotionManualReviewRow } from "./projection-promotion-manual-review-types";
import type { ProjectionPromotionReviewDecisionTemplateRow } from "./projection-promotion-review-decisions-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

describe("projection promotion review decisions", () => {
  it("generates default decision templates and resolved classifications", () => {
    const report = buildProjectionPromotionReviewDecisionsFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      shadow: shadow(),
      universe: universe(),
      candidatePool: candidatePool(),
      manualReview: manualReview([
        row({ player: "No Prior K", position: "K", pointDelta: 24, critical: true }),
        row({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true }),
        row({ player: "Legacy QB", position: "QB", pointDelta: 25, critical: true, status: "retired_or_legacy_suspect", riskFlags: ["retired_legacy_suspect"] }),
        row({ player: "Clean RB", position: "RB", pointDelta: 7, critical: false, riskFlags: [] }),
      ]),
    });

    expect(report.templateRows).toHaveLength(4);
    expect(find(report, "No Prior K").humanOrDefaultDecision).toBe("needs_kicker_policy_review");
    expect(find(report, "No Prior K").resolvedClassification).toBe("shadow_only");
    expect(find(report, "Critical RB").humanOrDefaultDecision).toBe("unresolved");
    expect(find(report, "Critical RB").resolvedClassification).toBe("manual_review_before_promotion");
    expect(find(report, "Legacy QB").humanOrDefaultDecision).toBe("block_from_promotion");
    expect(find(report, "Legacy QB").resolvedClassification).toBe("blocked_from_promotion");
    expect(find(report, "Clean RB").humanOrDefaultDecision).toBe("approve_for_candidate_pool");
    expect(find(report, "Clean RB").resolvedClassification).toBe("eligible_for_projection_promotion");
    expect(report.verdict).toBe("review_decisions_unresolved_rows_remaining");
  });

  it("applies edited decisions from a parsed CSV template", () => {
    const template = [
      templateRowFor(row({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true })),
      templateRowFor(row({ player: "No Prior K", position: "K", pointDelta: 24, critical: true })),
    ];
    const decisions = parseDecisionTemplateCsv(renderDecisionTemplateCsv(template));
    decisions[0] = {
      ...decisions[0],
      decision: "approve_for_candidate_pool",
      decisionRationale: "Reviewed and approved.",
    } as ProjectionPromotionReviewDecisionTemplateRow;

    const report = buildProjectionPromotionReviewDecisionsFromData({
      options: { projectionSeason: 2026, includeIdp: true, decisionsFile: "edited.csv" },
      shadow: shadow(),
      universe: universe(),
      candidatePool: candidatePool(),
      manualReview: manualReview([
        row({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true }),
        row({ player: "No Prior K", position: "K", pointDelta: 24, critical: true }),
      ]),
      decisions,
    });

    expect(find(report, "Critical RB").source).toBe("decision_file");
    expect(find(report, "Critical RB").humanOrDefaultDecision).toBe("approve_for_candidate_pool");
    expect(find(report, "Critical RB").resolvedClassification).toBe("eligible_for_projection_promotion");
    expect(find(report, "No Prior K").humanOrDefaultDecision).toBe("needs_kicker_policy_review");
  });

  it("maps all supported decisions to resolved classifications", () => {
    expect(resolveDecisionToClassification("approve_for_candidate_pool")).toBe("eligible_for_projection_promotion");
    expect(resolveDecisionToClassification("keep_shadow_only")).toBe("shadow_only");
    expect(resolveDecisionToClassification("block_from_promotion")).toBe("blocked_from_promotion");
    expect(resolveDecisionToClassification("cap_v8_2_movement")).toBe("manual_review_before_promotion");
    expect(resolveDecisionToClassification("use_current_path_for_now")).toBe("shadow_only");
    expect(resolveDecisionToClassification("needs_external_roster_confirmation")).toBe("manual_review_before_promotion");
    expect(resolveDecisionToClassification("needs_kicker_policy_review")).toBe("shadow_only");
    expect(resolveDecisionToClassification("unresolved")).toBe("manual_review_before_promotion");
  });

  it("reports gates and summary counts", () => {
    const report = buildProjectionPromotionReviewDecisionsFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      shadow: shadow(),
      universe: universe(),
      candidatePool: candidatePool(),
      manualReview: manualReview([
        row({ player: "No Prior K", position: "K", pointDelta: 24, critical: true }),
        row({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true }),
      ]),
    });

    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    expect(report.summary.defaultDecisionCounts.needs_kicker_policy_review).toBe(1);
    expect(report.summary.defaultDecisionCounts.unresolved).toBe(1);
    expect(report.summary.resolvedCandidatePool.shadow_only).toBe(2);
    expect(report.summary.resolvedCandidatePool.manual_review_before_promotion).toBe(1);
    expect(report.unresolvedNonKRows.map((entry) => entry.player)).toEqual(["Critical RB"]);
  });

  it("returns ready when all rows are resolved", () => {
    const manual = manualReview([row({ player: "No Prior K", position: "K", pointDelta: 24, critical: true })]);
    const report = buildProjectionPromotionReviewDecisionsFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      shadow: shadow(),
      universe: universe(),
      candidatePool: candidatePool(),
      manualReview: manual,
    });

    expect(report.verdict).toBe("review_decisions_ready");
    expect(report.summary.unresolvedRows).toBe(0);
  });

  it("does not mutate manual review or candidate pool inputs", () => {
    const manualInput = manualReview([row({ player: "Read Only", position: "RB", pointDelta: 21, critical: true })]);
    const candidatePoolInput = candidatePool();
    const before = JSON.stringify({ manualInput, candidatePoolInput });

    buildProjectionPromotionReviewDecisionsFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      shadow: shadow(),
      universe: universe(),
      candidatePool: candidatePoolInput,
      manualReview: manualInput,
    });

    expect(JSON.stringify({ manualInput, candidatePoolInput })).toBe(before);
  });
});

function find(report: ReturnType<typeof buildProjectionPromotionReviewDecisionsFromData>, player: string) {
  const result = report.resolvedRows.find((row) => row.player === player);
  if (!result) throw new Error(`Missing ${player}`);
  return result;
}

function row(input: {
  player: string;
  position: string;
  pointDelta: number;
  critical: boolean;
  status?: ProjectionPromotionManualReviewRow["universeEligibilityStatus"];
  riskFlags?: string[];
}): ProjectionPromotionManualReviewRow {
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    universeEligibilityStatus: input.status ?? "active_plausible",
    promotionClassification: "manual_review_before_promotion",
    promotionReasonCodes: input.critical ? ["critical_movement_manual_review"] : ["active_plausible_allowed"],
    currentExpectedGames: 8,
    v82ExpectedGames: 9,
    gamesDelta: 1,
    scoringAnchorPpg: 5,
    projectedTotalPointDelta: input.pointDelta,
    movementBucket: input.critical ? "20+" : "5-10",
    criticalMovement: input.critical,
    estimatedPositionRankMovement: 1,
    estimatedOverallRankMovement: 2,
    v82GuardrailReasonCodes: [],
    riskFlags: input.riskFlags ?? (input.critical ? ["critical_movement"] : []),
    proposedReviewAction: input.position === "K" ? "needs_kicker_policy_review" : "needs_model_policy_review",
    reviewRationale: [],
  };
}

function manualReview(rows: ProjectionPromotionManualReviewRow[]): ProjectionPromotionManualReviewReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json", universeEligibilityAudit: "universe.json", promotionCandidatePool: "pool.json" },
    summary: {
      totalManualReviewRows: rows.length,
      proposedActionCounts: {
        approve_for_candidate_pool: 0,
        keep_shadow_only: 0,
        block_from_promotion: 0,
        needs_roster_confirmation: 0,
        needs_model_policy_review: rows.filter((entry) => entry.position !== "K").length,
        needs_kicker_policy_review: rows.filter((entry) => entry.position === "K").length,
      },
      byPosition: {},
      byUniverseEligibilityStatus: {},
      byPromotionReasonCode: {},
      criticalMovementRows: rows.filter((entry) => entry.criticalMovement).length,
      kickerManualReviewRows: rows.filter((entry) => entry.position === "K").length,
      rookieNewPlayerRows: 0,
      veteranManualReviewRows: rows.filter((entry) => entry.position !== "K").length,
      canProceedAfterHumanDecisions: true,
    },
    rows,
    topManualReviewRows: rows,
    kickerManualReviewRows: rows.filter((entry) => entry.position === "K"),
    rookieNewPlayerManualReviewRows: [],
    veteranManualReviewRows: rows.filter((entry) => entry.position !== "K"),
    highImpactManualReviewRows: rows.filter((entry) => ["QB", "RB", "WR", "TE"].includes(entry.position)),
    rowsByProposedAction: {
      approve_for_candidate_pool: [],
      keep_shadow_only: [],
      block_from_promotion: [],
      needs_roster_confirmation: [],
      needs_model_policy_review: rows.filter((entry) => entry.position !== "K"),
      needs_kicker_policy_review: rows.filter((entry) => entry.position === "K"),
    },
    safetyGates: [],
    verdict: "manual_review_packet_ready",
    notes: [],
  };
}

function candidatePool(): ProjectionPromotionCandidatePoolReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json", universeEligibilityAudit: "universe.json" },
    summary: {
      totalRows: 4,
      classificationCounts: {
        eligible_for_projection_promotion: 1,
        manual_review_before_promotion: 2,
        shadow_only: 1,
        blocked_from_promotion: 0,
      },
      byUniverseStatus: {},
      byPosition: {},
      byCohort: {},
      byTeamSignal: {},
      byMovementBucket: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      byRiskFlag: {},
      byRecommendedAction: {
        ready_for_promotion_review_pool: 1,
        manual_review_required_before_promotion: 2,
        keep_shadow_only: 1,
        exclude_from_promotion_candidate_pool: 0,
        review_kicker_policy_before_promotion: 0,
      },
    },
    poolMetrics: [],
    rows: [
      { promotionEligibilityClassification: "eligible_for_projection_promotion" },
      { promotionEligibilityClassification: "manual_review_before_promotion" },
      { promotionEligibilityClassification: "manual_review_before_promotion" },
      { promotionEligibilityClassification: "shadow_only" },
    ] as ProjectionPromotionCandidatePoolReport["rows"],
    topEligibleMovements: [],
    topManualReviewMovements: [],
    topBlockedMovements: [],
    topShadowOnlyMovements: [],
    criticalMovementRows: [],
    kickerPolicy: { totalKRows: 1, eligibleKRows: 0, manualReviewKRows: 1, shadowOnlyKRows: 0, blockedKRows: 0, criticalMovementKRows: 1, excludedFromEligiblePoolRows: 1, recommendation: "" },
    safetyGates: [],
    verdict: "promotion_pool_needs_manual_review",
    notes: [],
  };
}

function shadow(): ProjectionV82ShadowReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    currentModel: "blackbird_expected_games_v7_family_selective",
    shadowModel: "blackbird_expected_games_v8_2_high_impact_guardrail",
    sourceArtifacts: { snapshot: "snapshot.json" },
    rowCoverage: {
      currentLiveProjectionRows: 0,
      v82ShadowRows: 0,
      sharedRows: 0,
      currentOnlyRows: 0,
      v82OnlyRows: 0,
      rowsSkipped: 0,
      skipReasons: {},
      positionCounts: {},
      cohortCounts: {},
    },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [],
    cohortMovementSummary: [],
    rows: [],
    topMovements: [],
    criticalMovements: [],
    rankingRiskPreview: {
      estimated: true,
      reason: "",
      rowsWithEstimatedOverallRankMovement: 0,
      rowsWithEstimatedPositionRankMovement: 0,
      topOverallRankMovements: [],
      topPositionRankMovements: [],
    },
    safetyGates: [],
    recommendation: "shadow_candidate_with_manual_review",
    notes: [],
  };
}

function universe(): ProjectionUniverseEligibilityAuditReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json" },
    summary: {
      totalProjectedRows: 0,
      statusCounts: {
        active_plausible: 0,
        low_confidence_plausible: 0,
        rookie_or_new_player: 0,
        stale_historical_signal: 0,
        retired_or_legacy_suspect: 0,
        manual_review_required: 0,
      },
      byPosition: [],
      byCohort: [],
      byTeam: {},
      byLastActiveSeason: {},
    },
    rows: [],
    criticalMovementReview: [],
    retiredLegacySuspects: [],
    kickerReview: { totalKRows: 0, lowPriorFallbackRows: 0, criticalMovementRows: 0, movingEightToTwelveExpectedGames: 0, statusCounts: {}, recommendation: "" },
    safetyGates: [],
    verdict: "universe_blocked_for_promotion",
    notes: [],
  };
}
