import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionActiveUniverseGateRosterRefreshFromData,
  writeProjectionActiveUniverseGateRosterRefreshArtifacts,
} from "./projection-active-universe-gate-roster-refresh";

import type { ProjectionActiveUniverseGateReport, ProjectionActiveUniverseGateRow, ProjectionActiveUniverseGateStatus, ProjectionActiveUniverseGateV82Path } from "./projection-active-universe-gate-types";
import type { ProjectionActiveUniverseGateRosterRefreshInput } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow, ProjectionCurrentRosterConfirmationStatus } from "./projection-current-roster-confirmation-types";
import type { ProjectionCurrentRosterConfirmationDeltaReport } from "./projection-current-roster-confirmation-delta-types";
import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

describe("projection active universe gate roster refresh", () => {
  it("assigns roster-confirmed active, IR/PUP/NFI, and non-active statuses", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Active WR")?.refreshedGateStatus).toBe("roster_confirmed_active");
    expect(report.rows.find((row) => row.player === "IR RB")?.refreshedGateStatus).toBe("roster_confirmed_ir_pup_nfi");
    expect(report.rows.find((row) => row.player === "Retired TE")?.refreshedGateStatus).toBe("roster_confirmed_non_active");
    expect(report.beforeAfterStatusCounts.refreshedStatusCounts).toMatchObject({
      roster_confirmed_active: 4,
      roster_confirmed_ir_pup_nfi: 1,
      roster_confirmed_non_active: 1,
    });
  });

  it("keeps unmatched rows in review and rookies in rookie/new unmatched review", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Unmatched WR")?.refreshedGateStatus).toBe("roster_unmatched_review");
    expect(report.rows.find((row) => row.player === "Rookie WR")?.refreshedGateStatus).toBe("rookie_or_new_unmatched_review");
    expect(report.unmatchedSummary.totalRows).toBe(2);
    expect(report.unmatchedSummary.byOriginalH16GateStatus).toMatchObject({
      active_confirmed: 1,
      rookie_or_new_confirmed: 1,
    });
  });

  it("preserves legacy archive and kicker policy protections", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Legacy QB")?.refreshedGateStatus).toBe("legacy_archive_blocked");
    expect(report.rows.find((row) => row.player === "Policy K")?.refreshedGateStatus).toBe("kicker_policy_review");
    expect(report.statusChangeSummary.legacyArchiveChanged).toBe(0);
    expect(report.statusChangeSummary.kickerPolicyChanged).toBe(0);
    expect(report.safetyGates.find((gate) => gate.name === "kicker_policy_not_changed")?.passed).toBe(true);
  });

  it("reports conflicts and resolved manual/stale rows", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(fixtureInput());

    expect(report.conflicts.map((row) => row.player)).toEqual(["Conflict LB"]);
    expect(report.conflicts[0].recommendedAction).toBe("manual_review_team_conflict");
    expect(report.manualReviewResolvedRows.map((row) => row.player)).toEqual(["Manual DB"]);
    expect(report.staleReviewResolvedRows.map((row) => row.player)).toEqual(["Stale RB"]);
    expect(report.safetyGates.find((gate) => gate.name === "conflicts_reported")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "manual_review_resolution_reported")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "stale_resolution_reported")?.passed).toBe(true);
  });

  it("summarizes v8.2 cross-reference without changing protected zero checks", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(fixtureInput());

    expect(report.v82SafeSubsetCrossReference.rowsThatWouldUseV82UnderEnabledSafeFlag).toBe(4);
    expect(report.v82SafeSubsetCrossReference.rowsThatStayCurrentPath).toBe(2);
    expect(report.v82SafeSubsetCrossReference.rowsExcludedOrBlocked).toBe(5);
    expect(report.v82SafeSubsetCrossReference.preservedZeroChecks).toEqual({
      kRowsUsingV82: true,
      criticalMoversUsingV82: true,
      meaningfulRankMoversUsingV82: true,
      legacyRowsUsingV82: true,
    });
  });

  it("reports safety gates, recommendation, and no live mutation claims", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(fixtureInput());

    [
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "v8_2_not_enabled",
      "roster_source_consumed",
      "unmatched_rows_reported",
      "kicker_policy_not_changed",
    ].forEach((name) => expect(report.safetyGates.find((gate) => gate.name === name)?.passed).toBe(true));
    expect(report.recommendation).toBe("roster_refresh_ready_for_policy_review");
    expect(report.notes.join(" ")).toContain("production outputs are not filtered or changed");
  });

  it("blocks when required reporting counts do not align", () => {
    const input = fixtureInput();
    input.currentRosterConfirmation.summary.conflicts = 2;

    const report = buildProjectionActiveUniverseGateRosterRefreshFromData(input);

    expect(report.recommendation).toBe("roster_refresh_blocked");
    expect(report.safetyGates.find((gate) => gate.name === "conflicts_reported")?.passed).toBe(false);
  });

  it("writes json, markdown, and csv artifacts", () => {
    const report = buildProjectionActiveUniverseGateRosterRefreshFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2097, includeIdp: true },
    });

    const artifacts = writeProjectionActiveUniverseGateRosterRefreshArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-active-universe-gate-roster-refresh-2097.json");
      expect(artifacts.markdownPath).toContain("projection-active-universe-gate-roster-refresh-2097.md");
      expect(artifacts.csvPath).toContain("projection-active-universe-gate-roster-refresh-2097.csv");
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

function fixtureInput(): ProjectionActiveUniverseGateRosterRefreshInput {
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    activeUniverseGate: activeGateReport(),
    currentRosterConfirmation: confirmationReport(),
    currentRosterConfirmationDelta: confirmationDelta(),
    featureFlagReviewPacket: featureFlagPacket(),
  };
}

function activeGateReport(): ProjectionActiveUniverseGateReport {
  const rows = [
    activeRow("p1", "Active WR", "WR", "KC", "active_confirmed", "would_use_v8_2_safe_subset"),
    activeRow("p2", "IR RB", "RB", "BUF", "active_confirmed", "would_use_v8_2_safe_subset"),
    activeRow("p3", "Retired TE", "TE", "NYG", "active_confirmed", "would_stay_current_path"),
    activeRow("p4", "Unmatched WR", "WR", "DAL", "active_confirmed", "would_use_v8_2_safe_subset"),
    activeRow("p5", "Rookie WR", "WR", "CHI", "rookie_or_new_confirmed", "would_use_v8_2_safe_subset"),
    activeRow("p6", "Legacy QB", "QB", null, "legacy_archive_blocked", "excluded_or_blocked"),
    activeRow("p7", "Policy K", "K", "FA", "kicker_policy_review", "excluded_or_blocked"),
    activeRow("p8", "Conflict LB", "LB", "BAL", "active_confirmed", "would_stay_current_path"),
    activeRow("p9", "Manual DB", "DB", "MIA", "manual_review_required", "excluded_or_blocked"),
    activeRow("p10", "Stale RB", "RB", "LV", "stale_status_review", "excluded_or_blocked"),
    activeRow("p11", "Low TE", "TE", "DEN", "low_confidence_plausible", "excluded_or_blocked"),
  ];
  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    rows,
  } as ProjectionActiveUniverseGateReport;
}

function confirmationReport(): ProjectionCurrentRosterConfirmationReport {
  const rows = [
    confirmationRow("p1", "Active WR", "WR", "KC", "KC", "active", "active_confirmed", "roster_confirmed_active"),
    confirmationRow("p2", "IR RB", "RB", "BUF", "BUF", "injured_reserve", "active_confirmed", "roster_confirmed_ir_pup_nfi"),
    confirmationRow("p3", "Retired TE", "TE", "NYG", "NYG", "retired", "active_confirmed", "roster_confirmed_non_active"),
    confirmationRow("p4", "Unmatched WR", "WR", "DAL", null, null, "active_confirmed", "roster_unmatched"),
    confirmationRow("p5", "Rookie WR", "WR", "CHI", null, null, "rookie_or_new_confirmed", "roster_unmatched"),
    confirmationRow("p6", "Legacy QB", "QB", null, "NYJ", "active", "legacy_archive_blocked", "roster_confirmed_active"),
    confirmationRow("p7", "Policy K", "K", "FA", "KC", "active", "kicker_policy_review", "roster_confirmed_active"),
    confirmationRow("p8", "Conflict LB", "LB", "BAL", "PIT", "active", "active_confirmed", "roster_conflict", ["matched_by_gsis_id", "team_conflicts_projection", "status_active"]),
    confirmationRow("p9", "Manual DB", "DB", "MIA", "MIA", "active", "manual_review_required", "roster_confirmed_active"),
    confirmationRow("p10", "Stale RB", "RB", "LV", "LV", "active", "stale_status_review", "roster_confirmed_active"),
    confirmationRow("p11", "Low TE", "TE", "DEN", "DEN", "active", "low_confidence_plausible", "roster_confirmed_active"),
  ];
  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceStatus: "present",
    summary: {
      totalProjectionRows: rows.length,
      rosterSourceRows: 11,
      matchedRows: 9,
      unmatchedRows: 2,
      confirmedActive: 6,
      confirmedNonActive: 1,
      confirmedFreeAgent: 0,
      confirmedIrPupNfi: 1,
      conflicts: 1,
      byPosition: {},
      byH16ActiveGateStatus: {},
      byPromotionClassification: {},
    },
    h16IntegrationPreview: {
      activeConfirmedIncrease: 3,
      activeConfirmedDecrease: 2,
      staleStatusReviewResolved: 1,
      legacyArchiveBlockedConfirmed: 0,
      manualReviewRequiredResolved: 1,
      kickerPolicyUnaffected: 1,
      note: "fixture",
    },
    rows,
  } as ProjectionCurrentRosterConfirmationReport;
}

function confirmationDelta(): ProjectionCurrentRosterConfirmationDeltaReport {
  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    after: {
      matchedRows: 9,
      unmatchedRows: 2,
      confirmedActive: 6,
      confirmedNonActive: 1,
      confirmedFreeAgent: 0,
      confirmedIrPupNfi: 1,
      conflicts: 1,
      legacyArchiveConfirmed: 0,
      staleReviewResolved: 1,
      manualReviewResolved: 1,
      kRowsWithRosterDepthStatus: 1,
      activeConfirmedIncrease: 3,
      activeConfirmedDecrease: 2,
    },
  } as ProjectionCurrentRosterConfirmationDeltaReport;
}

function featureFlagPacket(): ProjectionV82FeatureFlagReviewPacketReport {
  return {
    safetySummary: {
      enabledSafeSubsetV82Rows: 4,
      currentPathProtectedRows: 2,
      excludedRows: 4,
      blockedRows: 1,
      kRowsUsingV82: 0,
      criticalMoversUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
    },
  } as ProjectionV82FeatureFlagReviewPacketReport;
}

function activeRow(
  playerId: string,
  player: string,
  position: string,
  team: string | null,
  gateStatus: ProjectionActiveUniverseGateStatus,
  v82Path: ProjectionActiveUniverseGateV82Path,
): ProjectionActiveUniverseGateRow {
  return {
    playerId,
    player,
    position,
    team,
    gateStatus,
    v82Path,
    reasonCodes: [],
    universeEligibilityStatus: "active_plausible",
    promotionEligibilityClassification: "eligible_for_projection_promotion",
    currentExpectedGames: 8,
    v82ExpectedGames: 10,
    projectedTotalPointDelta: 10,
    criticalMovement: false,
    estimatedOverallRankMovement: null,
    matchConfidence: "strong",
    recommendedAction: "fixture",
    lastActiveSeason: 2025,
  } as ProjectionActiveUniverseGateRow;
}

function confirmationRow(
  playerId: string,
  player: string,
  position: string,
  projectionTeam: string | null,
  rosterTeam: string | null,
  rosterStatus: string | null,
  activeGateStatus: ProjectionActiveUniverseGateStatus,
  confirmationStatus: ProjectionCurrentRosterConfirmationStatus,
  reasonCodes: ProjectionCurrentRosterConfirmationRow["reasonCodes"] = ["matched_by_gsis_id", "team_matches_projection", "status_active"],
): ProjectionCurrentRosterConfirmationRow {
  return {
    playerId,
    sleeperId: playerId,
    gsisId: playerId,
    player,
    normalizedName: player.toLowerCase().replace(/[^a-z0-9]/g, ""),
    position,
    projectionTeam,
    rosterTeam,
    rosterStatus,
    activeGateStatus,
    promotionEligibilityClassification: promotionClassificationFor(activeGateStatus),
    confirmationStatus,
    reasonCodes: confirmationStatus === "roster_unmatched" ? [] : reasonCodes,
    matchedRosterSource: confirmationStatus === "roster_unmatched" ? null : "fixture",
    sourceUpdatedAt: confirmationStatus === "roster_unmatched" ? null : "2026-06-18T00:00:00.000Z",
  };
}

function promotionClassificationFor(status: ProjectionActiveUniverseGateStatus): ProjectionPromotionEligibilityClassification {
  if (status === "legacy_archive_blocked") return "blocked_from_promotion";
  if (status === "kicker_policy_review" || status === "stale_status_review") return "shadow_only";
  if (status === "manual_review_required") return "manual_review_before_promotion";
  return "eligible_for_projection_promotion";
}
