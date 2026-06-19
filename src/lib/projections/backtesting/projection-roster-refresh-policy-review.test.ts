import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionRosterRefreshPolicyReviewFromData,
  writeProjectionRosterRefreshPolicyReviewArtifacts,
} from "./projection-roster-refresh-policy-review";

import type { ProjectionActiveUniverseGateReport } from "./projection-active-universe-gate-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport, ProjectionActiveUniverseGateRosterRefreshRow } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type { ProjectionCurrentRosterConfirmationDeltaReport } from "./projection-current-roster-confirmation-delta-types";
import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionRosterRefreshPolicyReviewInput } from "./projection-roster-refresh-policy-review-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

describe("projection roster refresh policy review", () => {
  it("assigns policy groups and recommended actions", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Conflict LB")?.policyGroup).toBe("conflict_review");
    expect(report.rows.find((row) => row.player === "Conflict LB")?.recommendedPolicyAction).toBe("needs_manual_team_conflict_review");
    expect(report.rows.find((row) => row.player === "Manual DB")?.policyGroup).toBe("manual_review_remaining");
    expect(report.rows.find((row) => row.player === "Unmatched WR")?.recommendedPolicyAction).toBe("needs_depth_chart_source");
    expect(report.rows.find((row) => row.player === "Rookie WR")?.recommendedPolicyAction).toBe("needs_rookie_team_confirmation");
    expect(report.rows.find((row) => row.player === "Policy K")?.recommendedPolicyAction).toBe("needs_kicker_policy");
    expect(report.rows.find((row) => row.player === "Active WR")?.policyGroup).toBe("confirmed_active_clear");
  });

  it("groups conflicts and remaining manual-review rows", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData(fixtureInput());

    expect(report.conflicts.map((row) => row.player)).toEqual(["Conflict LB"]);
    expect(report.remainingManualReviewRows.map((row) => row.player).sort()).toEqual(["Conflict LB", "Manual DB"].sort());
    expect(report.policyGroupCounts.conflict_review).toBe(1);
    expect(report.policyGroupCounts.manual_review_remaining).toBe(1);
  });

  it("summarizes unmatched active, rookie/new, low-confidence, and stale groups", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData(fixtureInput());

    expect(report.unmatchedSummary.totalRows).toBe(7);
    expect(report.activeCandidateUnmatched).toMatchObject({
      totalRows: 1,
      v82SafeSubsetRows: 1,
      recommendedAction: "needs_depth_chart_source",
    });
    expect(report.rookieNewUnmatched).toMatchObject({
      totalRows: 1,
      v82SafeSubsetRows: 1,
      recommendedAction: "needs_rookie_team_confirmation",
    });
    expect(report.lowConfidenceUnmatched).toMatchObject({
      totalRows: 1,
      recommendedAction: "needs_depth_chart_source",
    });
    expect(report.policyGroupCounts.stale_unmatched_review).toBe(1);
  });

  it("summarizes kicker policy rows", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData(fixtureInput());

    expect(report.kickerPolicy).toMatchObject({
      totalKRows: 1,
      confirmedRosterDepthRows: 0,
      unmatchedKRows: 1,
      criticalMoverKRows: 1,
      blockedKRows: 0,
      shadowOnlyKRows: 1,
      recommendedAction: "needs_kicker_policy",
    });
  });

  it("preserves v8.2 cross-reference and zero checks", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData(fixtureInput());

    expect(report.v82AdoptionImpact).toMatchObject({
      safeSubsetRowsInsideConfirmedActiveClear: 1,
      safeSubsetRowsInsideUnmatchedGroups: 2,
      safeSubsetRemainsIntact: true,
    });
    expect(report.v82AdoptionImpact.packetZeroChecks).toEqual({
      kRowsUsingV82: true,
      criticalMoversUsingV82: true,
      meaningfulRankMoversUsingV82: true,
      legacyRowsUsingV82: true,
    });
  });

  it("reports gates, recommendation, and no live mutation claims", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData(fixtureInput());

    [
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "v8_2_not_enabled",
      "conflicts_listed",
      "manual_review_rows_listed",
      "unmatched_groups_summarized",
      "kicker_policy_reported",
      "v8_2_protection_preserved",
    ].forEach((name) => expect(report.safetyGates.find((gate) => gate.name === name)?.passed).toBe(true));
    expect(report.recommendation).toBe("roster_policy_needs_manual_review");
    expect(report.notes.join(" ")).toContain("production projections and draft behavior are not filtered or changed");
  });

  it("blocks when conflict counts do not align", () => {
    const input = fixtureInput();
    input.rosterRefresh.matchedSummary.conflicts = 2;

    const report = buildProjectionRosterRefreshPolicyReviewFromData(input);

    expect(report.recommendation).toBe("roster_policy_blocked");
    expect(report.safetyGates.find((gate) => gate.name === "conflicts_listed")?.passed).toBe(false);
  });

  it("writes json, markdown, and csv artifacts", () => {
    const report = buildProjectionRosterRefreshPolicyReviewFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2096, includeIdp: true },
    });

    const artifacts = writeProjectionRosterRefreshPolicyReviewArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-roster-refresh-policy-review-2096.json");
      expect(artifacts.markdownPath).toContain("projection-roster-refresh-policy-review-2096.md");
      expect(artifacts.csvPath).toContain("projection-roster-refresh-policy-review-2096.csv");
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

function fixtureInput(): ProjectionRosterRefreshPolicyReviewInput {
  const rows = [
    refreshRow("p1", "Conflict LB", "LB", "BAL", "PHI", "unknown", "active_confirmed", "manual_review_required", "roster_conflict", "would_stay_current_path"),
    refreshRow("p2", "Manual DB", "DB", "MIA", null, null, "manual_review_required", "manual_review_required", "roster_unmatched", "would_stay_current_path"),
    refreshRow("p3", "Unmatched WR", "WR", "DAL", null, null, "active_confirmed", "roster_unmatched_review", "roster_unmatched", "would_use_v8_2_safe_subset"),
    refreshRow("p4", "Rookie WR", "WR", "CHI", null, null, "rookie_or_new_confirmed", "rookie_or_new_unmatched_review", "roster_unmatched", "would_use_v8_2_safe_subset"),
    refreshRow("p5", "Low TE", "TE", "DEN", null, null, "low_confidence_plausible", "roster_unmatched_review", "roster_unmatched", "excluded_or_blocked"),
    refreshRow("p6", "Stale RB", "RB", "LV", null, null, "stale_status_review", "roster_unmatched_review", "roster_unmatched", "excluded_or_blocked"),
    refreshRow("p7", "Policy K", "K", "FA", null, null, "kicker_policy_review", "kicker_policy_review", "roster_unmatched", "excluded_or_blocked", true),
    refreshRow("p8", "Legacy QB", "QB", null, null, null, "legacy_archive_blocked", "legacy_archive_blocked", "roster_unmatched", "excluded_or_blocked"),
    refreshRow("p9", "Active WR", "WR", "KC", "KC", "active", "active_confirmed", "roster_confirmed_active", "roster_confirmed_active", "would_use_v8_2_safe_subset"),
    refreshRow("p10", "IR RB", "RB", "BUF", "BUF", "injured_reserve", "active_confirmed", "roster_confirmed_ir_pup_nfi", "roster_confirmed_ir_pup_nfi", "excluded_or_blocked"),
    refreshRow("p11", "Retired TE", "TE", "NYG", "NYG", "retired", "active_confirmed", "roster_confirmed_non_active", "roster_confirmed_non_active", "excluded_or_blocked"),
  ];
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    rosterRefresh: ({
      dryRun: true,
      readOnly: true,
      projectionSeason: 2026,
      includeIdp: true,
      rows,
      matchedSummary: { matchedRows: 4, unmatchedRows: 7, conflicts: 1, confirmedActive: 1, confirmedNonActive: 1, confirmedIrPupNfi: 1 },
      beforeAfterStatusCounts: {
        totalRows: rows.length,
        originalH16StatusCounts: {},
        refreshedStatusCounts: {
          roster_confirmed_active: 1,
          roster_confirmed_ir_pup_nfi: 1,
          roster_confirmed_non_active: 1,
          roster_unmatched_review: 3,
          rookie_or_new_unmatched_review: 1,
          legacy_archive_blocked: 1,
          kicker_policy_review: 1,
          manual_review_required: 2,
        },
        transitionCounts: {},
      },
      unmatchedSummary: {
        totalRows: 7,
        byOriginalH16GateStatus: { kicker_policy_review: 1 },
        byPosition: {},
        byTeam: {},
        byStaleLegacyStatus: { legacy_archive: 1 },
        byPromotionClassification: {},
        topUnmatchedActiveCandidateRows: [],
        topUnmatchedLowConfidenceRows: [],
        topUnmatchedStaleRows: [],
      },
    } as unknown) as ProjectionActiveUniverseGateRosterRefreshReport,
    currentRosterConfirmation: {} as ProjectionCurrentRosterConfirmationReport,
    currentRosterConfirmationDelta: {} as ProjectionCurrentRosterConfirmationDeltaReport,
    activeUniverseGate: {} as ProjectionActiveUniverseGateReport,
    featureFlagReviewPacket: {
      safetySummary: {
        kRowsUsingV82: 0,
        criticalMoversUsingV82: 0,
        meaningfulRankMoversUsingV82: 0,
        legacyRowsUsingV82: 0,
      },
    } as ProjectionV82FeatureFlagReviewPacketReport,
    promotionCandidatePool: {
      rows: rows.map((row) => promotionRow(row)),
    } as ProjectionPromotionCandidatePoolReport,
  };
}

function refreshRow(
  playerId: string,
  player: string,
  position: string,
  projectionTeam: string | null,
  rosterTeam: string | null,
  rosterStatus: string | null,
  originalGateStatus: ProjectionActiveUniverseGateRosterRefreshRow["originalGateStatus"],
  refreshedGateStatus: ProjectionActiveUniverseGateRosterRefreshRow["refreshedGateStatus"],
  confirmationStatus: ProjectionActiveUniverseGateRosterRefreshRow["confirmationStatus"],
  v82Path: ProjectionActiveUniverseGateRosterRefreshRow["v82Path"],
  criticalMovement = false,
): ProjectionActiveUniverseGateRosterRefreshRow {
  return {
    playerId,
    player,
    position,
    projectionTeam,
    rosterTeam,
    rosterStatus,
    originalGateStatus,
    refreshedGateStatus,
    confirmationStatus,
    promotionEligibilityClassification: position === "K" ? "shadow_only" : refreshedGateStatus === "legacy_archive_blocked" ? "blocked_from_promotion" : "eligible_for_projection_promotion",
    v82Path,
    reasonCodes: confirmationStatus === "roster_conflict" ? ["team_conflicts_projection"] : [],
    refreshReasonCodes: [],
    recommendedAction: "fixture",
    lastActiveSeason: 2025,
    projectedTotalPointDelta: 10,
    criticalMovement,
    estimatedOverallRankMovement: null,
    matchConfidence: "strong",
  };
}

function promotionRow(row: ProjectionActiveUniverseGateRosterRefreshRow): ProjectionPromotionCandidateRow {
  return {
    playerId: row.playerId,
    position: row.position,
    promotionEligibilityClassification: row.promotionEligibilityClassification === "missing_from_candidate_pool" ? "shadow_only" : row.promotionEligibilityClassification,
    reasonCodes: row.position === "K" ? ["kicker_policy_shadow_only"] : [],
    criticalMovement: row.criticalMovement,
  } as ProjectionPromotionCandidateRow;
}
