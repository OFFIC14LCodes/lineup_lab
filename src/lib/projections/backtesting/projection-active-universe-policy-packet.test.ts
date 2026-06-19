import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionActiveUniversePolicyPacketFromData,
  writeProjectionActiveUniversePolicyPacketArtifacts,
} from "./projection-active-universe-policy-packet";

import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionActiveUniversePolicyPacketInput } from "./projection-active-universe-policy-packet-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type { ProjectionRosterRefreshPolicyGroup, ProjectionRosterRefreshPolicyReviewReport, ProjectionRosterRefreshPolicyReviewRow } from "./projection-roster-refresh-policy-review-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

describe("projection active universe policy packet", () => {
  it("maps H20 policy groups to conservative policy classifications", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Active WR")?.policyClassification).toBe("policy_active_candidate");
    expect(report.rows.find((row) => row.player === "IR RB")?.policyClassification).toBe("policy_shadow_only");
    expect(report.rows.find((row) => row.player === "Retired TE")?.policyClassification).toBe("policy_blocked_archive");
    expect(report.rows.find((row) => row.player === "Legacy QB")?.policyClassification).toBe("policy_blocked_archive");
    expect(report.rows.find((row) => row.player === "Policy K")?.policyClassification).toBe("policy_kicker_review_required");
    expect(report.rows.find((row) => row.player === "Conflict LB")?.policyClassification).toBe("policy_manual_review");
    expect(report.rows.find((row) => row.player === "Manual DB")?.policyClassification).toBe("policy_current_path_only");
    expect(report.rows.find((row) => row.player === "Unmatched WR")?.policyClassification).toBe("policy_source_expansion_required");
  });

  it("assigns policy reason codes", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Active WR")?.policyReasonCodes).toEqual(expect.arrayContaining(["roster_confirmed_active_allowed", "v8_2_safe_subset_preserved"]));
    expect(report.rows.find((row) => row.player === "Rookie WR")?.policyReasonCodes).toContain("unmatched_rookie_needs_team_confirmation");
    expect(report.rows.find((row) => row.player === "Stale RB")?.policyReasonCodes).toContain("stale_needs_transaction_status_source");
    expect(report.rows.find((row) => row.player === "Low TE")?.policyReasonCodes).toContain("low_confidence_needs_depth_chart_source");
    expect(report.rows.find((row) => row.player === "Policy K")?.policyReasonCodes).toContain("kicker_policy_missing");
    expect(report.rows.find((row) => row.player === "Conflict LB")?.policyReasonCodes).toContain("team_conflict_manual_review");
  });

  it("does not auto-promote unmatched, kicker, legacy, or conflict rows", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());

    expect(report.safetyGates.find((gate) => gate.name === "unmatched_groups_not_auto_promoted")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "kicker_rows_not_auto_promoted")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "legacy_rows_blocked")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "conflicts_manual_review")?.passed).toBe(true);
  });

  it("summarizes source expansion priorities", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());
    const byNeed = Object.fromEntries(report.sourceExpansionPriorities.map((summary) => [summary.sourceNeed, summary]));

    expect(byNeed.depth_chart_source.rowsAffected).toBe(2);
    expect(byNeed.rookie_team_confirmation_source.rowsAffected).toBe(1);
    expect(byNeed.transaction_free_agent_source.rowsAffected).toBe(2);
    expect(byNeed.injury_pup_nfi_source.rowsAffected).toBe(1);
    expect(byNeed.kicker_specific_depth_chart_source.rowsAffected).toBe(1);
    expect(byNeed.manual_conflict_review.rowsAffected).toBe(1);
  });

  it("summarizes v8.2 impact under conservative policy", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());

    expect(report.v82ConservativePolicyImpact).toMatchObject({
      safeV82RowsAllowedByConservativePolicy: 1,
      safeV82RowsHeldBackBySourceExpansion: 2,
      safeV82RowsHeldBackByKickerManualCurrentPathPolicy: 2,
      v82RemainsSafe: true,
    });
  });

  it("reports manual review sections and final recommendation", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());

    expect(report.manualReview.conflicts.map((row) => row.player)).toEqual(["Conflict LB"]);
    expect(report.manualReview.remainingManualRows.map((row) => row.player)).toEqual(["Manual DB"]);
    expect(report.manualReview.confirmedNonActiveRows.map((row) => row.player)).toEqual(["Retired TE"]);
    expect(report.manualReview.irPupNfiSummary.totalRows).toBe(1);
    expect(report.recommendation).toBe("active_policy_ready_for_source_expansion");
  });

  it("reports no-mutation safety gates", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData(fixtureInput());

    [
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "v8_2_not_enabled",
      "source_expansion_prioritized",
      "v8_2_protection_preserved",
      "all_rows_classified",
    ].forEach((name) => expect(report.safetyGates.find((gate) => gate.name === name)?.passed).toBe(true));
    expect(report.notes.join(" ")).toContain("not applied to live projections");
  });

  it("writes json, markdown, and csv artifacts", () => {
    const report = buildProjectionActiveUniversePolicyPacketFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2095, includeIdp: true },
    });

    const artifacts = writeProjectionActiveUniversePolicyPacketArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-active-universe-policy-packet-2095.json");
      expect(artifacts.markdownPath).toContain("projection-active-universe-policy-packet-2095.md");
      expect(artifacts.csvPath).toContain("projection-active-universe-policy-packet-2095.csv");
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

function fixtureInput(): ProjectionActiveUniversePolicyPacketInput {
  const rows = [
    row("p1", "Active WR", "WR", "KC", "active", "confirmed_active_clear", "would_use_v8_2_safe_subset"),
    row("p2", "IR RB", "RB", "BUF", "injured_reserve", "confirmed_ir_pup_nfi_review", "excluded_or_blocked"),
    row("p3", "Retired TE", "TE", "NYG", "retired", "confirmed_non_active_review", "would_use_v8_2_safe_subset"),
    row("p4", "Legacy QB", "QB", null, null, "legacy_blocked", "excluded_or_blocked"),
    row("p5", "Policy K", "K", "FA", null, "kicker_policy_review", "excluded_or_blocked"),
    row("p6", "Conflict LB", "LB", "BAL", "unknown", "conflict_review", "excluded_or_blocked"),
    row("p7", "Manual DB", "DB", "MIA", null, "manual_review_remaining", "would_use_v8_2_safe_subset"),
    row("p8", "Unmatched WR", "WR", "DAL", null, "unmatched_active_candidate_review", "would_use_v8_2_safe_subset"),
    row("p9", "Rookie WR", "WR", "CHI", null, "unmatched_rookie_new_review", "would_use_v8_2_safe_subset"),
    row("p10", "Low TE", "TE", "DEN", null, "unmatched_low_confidence_review", "excluded_or_blocked"),
    row("p11", "Stale RB", "RB", "LV", null, "stale_unmatched_review", "excluded_or_blocked"),
  ];
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    rosterPolicyReview: ({
      dryRun: true,
      readOnly: true,
      projectionSeason: 2026,
      includeIdp: true,
      rows,
      conflicts: [rows[5]],
    } as unknown) as ProjectionRosterRefreshPolicyReviewReport,
    rosterRefresh: {} as ProjectionActiveUniverseGateRosterRefreshReport,
    currentRosterConfirmation: {} as ProjectionCurrentRosterConfirmationReport,
    featureFlagReviewPacket: {
      safetySummary: {
        kRowsUsingV82: 0,
        criticalMoversUsingV82: 0,
        meaningfulRankMoversUsingV82: 0,
        legacyRowsUsingV82: 0,
      },
    } as ProjectionV82FeatureFlagReviewPacketReport,
    promotionCandidatePool: {} as ProjectionPromotionCandidatePoolReport,
  };
}

function row(
  playerId: string,
  player: string,
  position: string,
  projectionTeam: string | null,
  rosterStatus: string | null,
  policyGroup: ProjectionRosterRefreshPolicyGroup,
  v82Path: ProjectionRosterRefreshPolicyReviewRow["v82Path"],
): ProjectionRosterRefreshPolicyReviewRow {
  return {
    playerId,
    player,
    position,
    projectionTeam,
    rosterTeam: rosterStatus ? projectionTeam : null,
    rosterStatus,
    originalGateStatus: "active_confirmed",
    h19Status: "roster_confirmed_active",
    confirmationStatus: policyGroup === "conflict_review" ? "roster_conflict" : policyGroup.startsWith("unmatched") || policyGroup === "stale_unmatched_review" || policyGroup === "kicker_policy_review" || policyGroup === "legacy_blocked" ? "roster_unmatched" : "roster_confirmed_active",
    promotionEligibilityClassification: policyGroup === "legacy_blocked" ? "blocked_from_promotion" : policyGroup === "kicker_policy_review" ? "shadow_only" : "eligible_for_projection_promotion",
    policyGroup,
    recommendedPolicyAction: "safe_to_keep_active_candidate",
    v82Path,
    v82ProtectionStatus: v82Path === "would_use_v8_2_safe_subset" ? "would_use_v8_2_safe_subset" : v82Path === "would_stay_current_path" ? "protected_current_path" : "excluded_or_blocked",
    reasonCodes: [],
    lastActiveSeason: 2025,
    projectedTotalPointDelta: 10,
    criticalMovement: false,
    estimatedOverallRankMovement: null,
  };
}
