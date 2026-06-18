import { describe, expect, it } from "vitest";

import {
  buildPolicyViolations,
  buildProjectionPromotionReadinessFinalFromData,
  validateDecisionFile,
} from "./projection-promotion-readiness-final";
import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionManualReviewReport, ProjectionPromotionManualReviewRow } from "./projection-promotion-manual-review-types";
import type { ProjectionPromotionResolvedDecisionRow } from "./projection-promotion-review-decisions-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

describe("projection promotion final readiness", () => {
  it("keeps default unresolved and kicker rows out of final eligibility", () => {
    const report = buildReport({
      rows: [
        candidate({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true }),
        candidate({ player: "Kicker", position: "K", pointDelta: 24, critical: true }),
      ],
      decisions: [
        resolved({ player: "Critical RB", position: "RB", decision: "unresolved", classification: "manual_review_before_promotion", pointDelta: 31, critical: true }),
        resolved({ player: "Kicker", position: "K", decision: "needs_kicker_policy_review", classification: "shadow_only", pointDelta: 24, critical: true }),
      ],
    });

    expect(report.verdict).toBe("manual_decisions_required");
    expect(report.summary.manualReviewRowsRemaining).toBe(1);
    expect(report.summary.kRows.shadow_only).toBe(1);
    expect(report.summary.kRows.eligible_for_projection_promotion).toBe(0);
    expect(report.policyViolations).toEqual([]);
  });

  it("returns ready for shadow review when edited decisions resolve all manual rows safely", () => {
    const report = buildReport({
      rows: [candidate({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true })],
      decisions: [
        resolved({
          player: "Critical RB",
          position: "RB",
          decision: "approve_for_candidate_pool",
          classification: "eligible_for_projection_promotion",
          pointDelta: 31,
          critical: true,
          rationale: "Reviewed role signal and approved for the dry-run candidate pool.",
        }),
      ],
    });

    expect(report.verdict).toBe("ready_for_shadow_promotion_review");
    expect(report.summary.eligibleRows).toBe(1);
    expect(report.summary.manualReviewRowsRemaining).toBe(0);
  });

  it("detects invalid, missing, duplicate, and unknown decision rows", () => {
    const issues = validateDecisionFile({
      decisionsFile: "edited.csv",
      manualRows: [
        manual({ player: "Known One", position: "RB", pointDelta: 10, critical: false }),
        manual({ player: "Known Two", position: "WR", pointDelta: 11, critical: false }),
      ],
      decisionRows: null,
      rawDecisionRows: [
        { player_id: "Known One", player_name: "Known One", decision: "not_valid", decision_rationale: "" },
        { player_id: "Known One", player_name: "Known One", decision: "keep_shadow_only", decision_rationale: "Second row." },
        { player_id: "Unknown", player_name: "Unknown", decision: "keep_shadow_only", decision_rationale: "No match." },
      ],
    });

    expect(issues.map((issue) => issue.code)).toContain("invalid_decision");
    expect(issues.map((issue) => issue.code)).toContain("missing_rationale");
    expect(issues.map((issue) => issue.code)).toContain("duplicate_decision_row");
    expect(issues.map((issue) => issue.code)).toContain("unknown_player_id");
    expect(issues.map((issue) => issue.code)).toContain("manual_review_row_missing_from_decision_file");
  });

  it("blocks edited decision files with validation issues", () => {
    const row = candidate({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true });
    const report = buildProjectionPromotionReadinessFinalFromData({
      options: { projectionSeason: 2026, includeIdp: true, decisionsFile: "edited.csv" },
      candidatePool: candidatePool([row]),
      manualReview: manualReview([manual({ player: "Critical RB", position: "RB", pointDelta: 31, critical: true })]),
      reviewDecisions: { resolvedRows: [resolved({ player: "Critical RB", position: "RB", decision: "unresolved", classification: "manual_review_before_promotion", pointDelta: 31, critical: true })] },
      shadow: shadow(),
      universe: universe(),
      rawDecisionRows: [{ player_id: "Critical RB", player_name: "Critical RB", decision: "bogus", decision_rationale: "" }],
    });

    expect(report.verdict).toBe("blocked_by_invalid_decisions");
    expect(report.summary.validationErrors).toBeGreaterThan(0);
  });

  it("flags K approval without an explicit override rationale", () => {
    const violations = buildPolicyViolations([
      resolved({
        player: "Kicker",
        position: "K",
        decision: "approve_for_candidate_pool",
        classification: "eligible_for_projection_promotion",
        pointDelta: 24,
        critical: true,
        rationale: "Looks fine.",
      }),
    ]);

    expect(violations.map((violation) => violation.code)).toEqual(["k_row_approved_without_explicit_override_reason"]);
  });

  it("allows K approval only with explicit kicker override rationale", () => {
    const report = buildReport({
      rows: [candidate({ player: "Kicker", position: "K", pointDelta: 24, critical: true })],
      decisions: [
        resolved({
          player: "Kicker",
          position: "K",
          decision: "approve_for_candidate_pool",
          classification: "eligible_for_projection_promotion",
          pointDelta: 24,
          critical: true,
          rationale: "Kicker policy override: verified this dry-run candidate manually.",
        }),
      ],
    });

    expect(report.policyViolations).toEqual([]);
    expect(report.summary.kRows.eligible_for_projection_promotion).toBe(1);
  });

  it("blocks retired or legacy rows from approval", () => {
    const report = buildReport({
      rows: [candidate({ player: "Legacy QB", position: "QB", pointDelta: 22, critical: true, status: "retired_or_legacy_suspect" })],
      decisions: [
        resolved({
          player: "Legacy QB",
          position: "QB",
          decision: "approve_for_candidate_pool",
          classification: "eligible_for_projection_promotion",
          pointDelta: 22,
          critical: true,
          status: "retired_or_legacy_suspect",
          rationale: "Reviewed and approved.",
        }),
      ],
    });

    expect(report.verdict).toBe("blocked_by_policy_violation");
    expect(report.policyViolations.map((violation) => violation.code)).toContain("retired_legacy_row_approved");
  });

  it("keeps cap decisions in manual review and reports movement summaries", () => {
    const report = buildReport({
      rows: [
        candidate({ player: "Cap RB", position: "RB", pointDelta: 35, critical: true }),
        candidate({ player: "Shadow WR", position: "WR", pointDelta: 18, critical: false, classification: "shadow_only" }),
        candidate({ player: "Blocked QB", position: "QB", pointDelta: -25, critical: true, classification: "blocked_from_promotion" }),
      ],
      decisions: [
        resolved({ player: "Cap RB", position: "RB", decision: "cap_v8_2_movement", classification: "manual_review_before_promotion", pointDelta: 35, critical: true }),
      ],
    });

    expect(report.summary.manualReviewRowsRemaining).toBe(1);
    expect(report.topManualReviewMovements[0]?.player).toBe("Cap RB");
    expect(report.topShadowOnlyMovements[0]?.player).toBe("Shadow WR");
    expect(report.topBlockedMovements[0]?.player).toBe("Blocked QB");
  });

  it("does not mutate inputs", () => {
    const pool = candidatePool([candidate({ player: "Read Only", position: "RB", pointDelta: 21, critical: true })]);
    const manualPacket = manualReview([manual({ player: "Read Only", position: "RB", pointDelta: 21, critical: true })]);
    const review = { resolvedRows: [resolved({ player: "Read Only", position: "RB", decision: "unresolved", classification: "manual_review_before_promotion", pointDelta: 21, critical: true })] };
    const before = JSON.stringify({ pool, manualPacket, review });

    buildProjectionPromotionReadinessFinalFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      candidatePool: pool,
      manualReview: manualPacket,
      reviewDecisions: review,
      shadow: shadow(),
      universe: universe(),
    });

    expect(JSON.stringify({ pool, manualPacket, review })).toBe(before);
  });
});

function buildReport(input: {
  rows: ProjectionPromotionCandidateRow[];
  decisions: ProjectionPromotionResolvedDecisionRow[];
}) {
  return buildProjectionPromotionReadinessFinalFromData({
    options: { projectionSeason: 2026, includeIdp: true },
    candidatePool: candidatePool(input.rows),
    manualReview: manualReview(input.rows.filter((row) => row.promotionEligibilityClassification === "manual_review_before_promotion").map((row) => manual({
      player: row.player,
      position: row.position,
      pointDelta: row.projectedTotalPointDelta ?? 0,
      critical: row.criticalMovement,
      status: row.universeEligibilityStatus,
    }))),
    reviewDecisions: { resolvedRows: input.decisions },
    shadow: shadow(),
    universe: universe(),
  });
}

function candidate(input: {
  player: string;
  position: string;
  pointDelta: number;
  critical: boolean;
  classification?: ProjectionPromotionCandidateRow["promotionEligibilityClassification"];
  status?: ProjectionPromotionCandidateRow["universeEligibilityStatus"];
}): ProjectionPromotionCandidateRow {
  return {
    playerId: input.player,
    sleeperId: input.player,
    gsisId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    universeEligibilityStatus: input.status ?? "active_plausible",
    promotionEligibilityClassification: input.classification ?? "manual_review_before_promotion",
    reasonCodes: input.critical ? ["critical_movement_manual_review"] : ["active_plausible_allowed"],
    universeReasonCodes: [],
    currentExpectedGames: 8,
    v82ExpectedGames: 10,
    gamesDelta: 2,
    projectedTotalPointDelta: input.pointDelta,
    movementBucket: input.critical ? "20+" : "10-20",
    criticalMovement: input.critical,
    rankingMovementEstimated: true,
    estimatedOverallRankMovement: 2,
    recommendedAction: "manual_review_required_before_promotion",
    riskFlags: input.critical ? ["critical_movement"] : [],
    cohortTags: [],
    lastActiveSeason: 2025,
    priorGames: 10,
    noPriorNflData: false,
    matchConfidence: "exact_id",
  };
}

function manual(input: {
  player: string;
  position: string;
  pointDelta: number;
  critical: boolean;
  status?: ProjectionPromotionManualReviewRow["universeEligibilityStatus"];
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
    v82ExpectedGames: 10,
    gamesDelta: 2,
    scoringAnchorPpg: 5,
    projectedTotalPointDelta: input.pointDelta,
    movementBucket: input.critical ? "20+" : "10-20",
    criticalMovement: input.critical,
    estimatedPositionRankMovement: 1,
    estimatedOverallRankMovement: 2,
    v82GuardrailReasonCodes: [],
    riskFlags: input.critical ? ["critical_movement"] : [],
    proposedReviewAction: input.position === "K" ? "needs_kicker_policy_review" : "needs_model_policy_review",
    reviewRationale: [],
  };
}

function resolved(input: {
  player: string;
  position: string;
  decision: ProjectionPromotionResolvedDecisionRow["humanOrDefaultDecision"];
  classification: ProjectionPromotionResolvedDecisionRow["resolvedClassification"];
  pointDelta: number;
  critical: boolean;
  status?: ProjectionPromotionResolvedDecisionRow["universeEligibilityStatus"];
  rationale?: string;
}): ProjectionPromotionResolvedDecisionRow {
  return {
    playerId: input.player,
    player: input.player,
    position: input.position,
    team: "TST",
    currentProposedAction: "needs_model_policy_review",
    movementAmount: input.pointDelta,
    currentExpectedGames: 8,
    v82ExpectedGames: 10,
    gamesDelta: 2,
    ppgAnchor: 5,
    riskFlags: input.critical ? ["critical_movement"] : [],
    reasonCodes: input.critical ? ["critical_movement_manual_review"] : ["active_plausible_allowed"],
    recommendedDefaultDecision: input.decision,
    decision: input.decision,
    decisionRationale: input.rationale ?? "Reviewed decision rationale.",
    reviewer: "test",
    reviewedAt: "2026-06-17T00:00:00.000Z",
    originalPromotionClassification: "manual_review_before_promotion",
    manualReviewProposedAction: "needs_model_policy_review",
    humanOrDefaultDecision: input.decision,
    resolvedClassification: input.classification,
    resolvedAction: "test_action",
    universeEligibilityStatus: input.status ?? "active_plausible",
    criticalMovement: input.critical,
    source: "decision_file",
  };
}

function candidatePool(rows: ProjectionPromotionCandidateRow[]): ProjectionPromotionCandidatePoolReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { snapshot: "snapshot.json", shadow: "shadow.json", universeEligibilityAudit: "universe.json" },
    summary: {
      totalRows: rows.length,
      classificationCounts: {
        eligible_for_projection_promotion: rows.filter((row) => row.promotionEligibilityClassification === "eligible_for_projection_promotion").length,
        manual_review_before_promotion: rows.filter((row) => row.promotionEligibilityClassification === "manual_review_before_promotion").length,
        shadow_only: rows.filter((row) => row.promotionEligibilityClassification === "shadow_only").length,
        blocked_from_promotion: rows.filter((row) => row.promotionEligibilityClassification === "blocked_from_promotion").length,
      },
      byUniverseStatus: {},
      byPosition: {},
      byCohort: {},
      byTeamSignal: {},
      byMovementBucket: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
      byRiskFlag: {},
      byRecommendedAction: {
        ready_for_promotion_review_pool: 0,
        manual_review_required_before_promotion: 0,
        keep_shadow_only: 0,
        exclude_from_promotion_candidate_pool: 0,
        review_kicker_policy_before_promotion: 0,
      },
    },
    poolMetrics: [],
    rows,
    topEligibleMovements: [],
    topManualReviewMovements: [],
    topBlockedMovements: [],
    topShadowOnlyMovements: [],
    criticalMovementRows: rows.filter((row) => row.criticalMovement),
    kickerPolicy: { totalKRows: 0, eligibleKRows: 0, manualReviewKRows: 0, shadowOnlyKRows: 0, blockedKRows: 0, criticalMovementKRows: 0, excludedFromEligiblePoolRows: 0, recommendation: "" },
    safetyGates: [],
    verdict: "promotion_pool_needs_manual_review",
    notes: [],
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
        needs_model_policy_review: rows.filter((row) => row.position !== "K").length,
        needs_kicker_policy_review: rows.filter((row) => row.position === "K").length,
      },
      byPosition: {},
      byUniverseEligibilityStatus: {},
      byPromotionReasonCode: {},
      criticalMovementRows: rows.filter((row) => row.criticalMovement).length,
      kickerManualReviewRows: rows.filter((row) => row.position === "K").length,
      rookieNewPlayerRows: 0,
      veteranManualReviewRows: rows.filter((row) => row.position !== "K").length,
      canProceedAfterHumanDecisions: true,
    },
    rows,
    topManualReviewRows: rows,
    kickerManualReviewRows: rows.filter((row) => row.position === "K"),
    rookieNewPlayerManualReviewRows: [],
    veteranManualReviewRows: rows.filter((row) => row.position !== "K"),
    highImpactManualReviewRows: rows,
    rowsByProposedAction: {
      approve_for_candidate_pool: [],
      keep_shadow_only: [],
      block_from_promotion: [],
      needs_roster_confirmation: [],
      needs_model_policy_review: rows.filter((row) => row.position !== "K"),
      needs_kicker_policy_review: rows.filter((row) => row.position === "K"),
    },
    safetyGates: [],
    verdict: "manual_review_packet_ready",
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
    rowCoverage: { currentLiveProjectionRows: 0, v82ShadowRows: 0, sharedRows: 0, currentOnlyRows: 0, v82OnlyRows: 0, rowsSkipped: 0, skipReasons: {}, positionCounts: {}, cohortCounts: {} },
    movementBuckets: { "0": 0, "0-5": 0, "5-10": 0, "10-20": 0, "20+": 0 },
    expectedGamesMovementBuckets: { "0": 0, "0-0.5": 0, "0.5-1": 0, "1-2": 0, "2-4": 0, "4+": 0 },
    positionMovementSummary: [],
    cohortMovementSummary: [],
    rows: [],
    topMovements: [],
    criticalMovements: [],
    rankingRiskPreview: { estimated: true, reason: "", rowsWithEstimatedOverallRankMovement: 0, rowsWithEstimatedPositionRankMovement: 0, topOverallRankMovements: [], topPositionRankMovements: [] },
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
      statusCounts: { active_plausible: 0, low_confidence_plausible: 0, rookie_or_new_player: 0, stale_historical_signal: 0, retired_or_legacy_suspect: 0, manual_review_required: 0 },
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
