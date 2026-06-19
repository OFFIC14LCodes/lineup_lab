import { existsSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildProjectionActivePolicyRefreshFinalFromData,
  writeProjectionActivePolicyRefreshFinalArtifacts,
} from "./projection-active-policy-refresh-final";
import type { ProjectionActivePolicyRefreshFinalInput } from "./projection-active-policy-refresh-final-types";
import type { ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionFreeAgentUnknownPolicyRow } from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionSleeperPolicyRefreshReport, ProjectionSleeperPolicyRefreshRow } from "./projection-sleeper-policy-refresh-types";

describe("projection active policy refresh final", () => {
  it("applies policy layers in H21, H28, H29 order", () => {
    const report = buildProjectionActivePolicyRefreshFinalFromData(input({
      h21Rows: [
        h21Row({ playerId: "base", policyClassification: "policy_active_candidate" }),
        h21Row({ playerId: "h28", policyClassification: "policy_source_expansion_required" }),
        h21Row({ playerId: "h29", policyClassification: "policy_source_expansion_required" }),
      ],
      h28Rows: [
        h28Row({ playerId: "h28", refreshedPolicyClassification: "policy_active_candidate_preview", resolutionStatus: "sleeper_metadata_active_plausible" }),
        h28Row({ playerId: "h29", refreshedPolicyClassification: "policy_source_expansion_required", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
      ],
      h29Rows: [
        h29Row({ playerId: "h29", policyClass: "free_agent_unknown_current_path_only" }),
      ],
    }));

    expect(report.rows.find((row) => row.playerId === "base")).toMatchObject({
      finalPolicyClass: "final_policy_active_candidate",
      appliedLayer: "h21_conservative_policy",
    });
    expect(report.rows.find((row) => row.playerId === "h28")).toMatchObject({
      finalPolicyClass: "final_policy_active_candidate",
      appliedLayer: "h28_sleeper_metadata_policy_refresh",
    });
    expect(report.rows.find((row) => row.playerId === "h29")).toMatchObject({
      finalPolicyClass: "final_policy_current_path_only",
      appliedLayer: "h29_free_agent_unknown_policy_review",
    });
  });

  it("maps free-agent shadow/current/manual policies without active promotion", () => {
    const report = buildProjectionActivePolicyRefreshFinalFromData(input({
      h21Rows: ["shadow", "current", "manual"].map((playerId) => h21Row({ playerId, policyClassification: "policy_source_expansion_required" })),
      h28Rows: ["shadow", "current", "manual"].map((playerId) => h28Row({ playerId, refreshedPolicyClassification: "policy_source_expansion_required", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" })),
      h29Rows: [
        h29Row({ playerId: "shadow", policyClass: "free_agent_unknown_shadow_only" }),
        h29Row({ playerId: "current", policyClass: "free_agent_unknown_current_path_only" }),
        h29Row({ playerId: "manual", policyClass: "free_agent_unknown_manual_review" }),
      ],
    }));

    expect(report.policyCounts.h30FinalPolicyCounts).toMatchObject({
      final_policy_shadow_only: 1,
      final_policy_current_path_only: 1,
      final_policy_manual_review: 1,
    });
    expect(report.safetyGates.find((gate) => gate.name === "free_agent_unknown_not_auto_promoted")?.passed).toBe(true);
  });

  it("keeps position conflicts manual, kicker rows in review, and legacy rows blocked", () => {
    const report = buildProjectionActivePolicyRefreshFinalFromData(input({
      h21Rows: [
        h21Row({ playerId: "conflict", policyClassification: "policy_source_expansion_required" }),
        h21Row({ playerId: "k", position: "K", policyClassification: "policy_kicker_review_required", policyGroup: "kicker_policy_review" }),
        h21Row({ playerId: "legacy", policyClassification: "policy_blocked_archive", policyGroup: "legacy_blocked" }),
      ],
      h28Rows: [
        h28Row({ playerId: "conflict", refreshedPolicyClassification: "policy_manual_review", resolutionStatus: "sleeper_metadata_position_conflict" }),
      ],
      h29Rows: [],
    }));

    expect(report.rows.find((row) => row.playerId === "conflict")?.finalPolicyClass).toBe("final_policy_manual_review");
    expect(report.rows.find((row) => row.playerId === "k")?.finalPolicyClass).toBe("final_policy_kicker_review_required");
    expect(report.rows.find((row) => row.playerId === "legacy")?.finalPolicyClass).toBe("final_policy_blocked_archive");
    expect(report.safetyGates.find((gate) => gate.name === "kicker_rows_not_auto_promoted")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "legacy_rows_blocked")?.passed).toBe(true);
  });

  it("reports v8.2 impact and manual-review summary", () => {
    const report = buildProjectionActivePolicyRefreshFinalFromData(input({
      h21Rows: [
        h21Row({ playerId: "active", policyClassification: "policy_active_candidate" }),
        h21Row({ playerId: "fa", policyClassification: "policy_source_expansion_required" }),
        h21Row({ playerId: "conflict", policyClassification: "policy_source_expansion_required", policyGroup: "conflict_review" }),
      ],
      h28Rows: [
        h28Row({ playerId: "fa", refreshedPolicyClassification: "policy_source_expansion_required", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
        h28Row({ playerId: "conflict", refreshedPolicyClassification: "policy_manual_review", resolutionStatus: "sleeper_metadata_position_conflict" }),
      ],
      h29Rows: [
        h29Row({ playerId: "fa", policyClass: "free_agent_unknown_manual_review" }),
      ],
    }));

    expect(report.v82ControlledFlagImpact).toMatchObject({
      safeV82RowsAllowedByFinalPolicy: 1,
      safeV82RowsHeldManualReview: 2,
      controlledFlagReviewRemainsBlocked: true,
    });
    expect(report.remainingBlockers.manualReviewRows).toBe(2);
    expect(report.manualReviewSummary.freeAgentUnknownHighImportanceRows).toHaveLength(1);
    expect(report.manualReviewSummary.positionConflictRows).toHaveLength(1);
  });

  it("writes artifacts and preserves no-live-mutation gates", () => {
    const report = buildProjectionActivePolicyRefreshFinalFromData(input({
      options: { projectionSeason: 2094, includeIdp: true },
      h21Rows: [
        h21Row({ playerId: "manual", policyClassification: "policy_manual_review" }),
      ],
      h28Rows: [],
      h29Rows: [],
    }));
    const artifacts = writeProjectionActivePolicyRefreshFinalArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.readOnly).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "v8_2_not_enabled")?.passed).toBe(true);
    } finally {
      for (const artifactPath of Object.values(artifacts)) {
        if (existsSync(artifactPath)) unlinkSync(artifactPath);
      }
    }
  });
});

function input(overrides: {
  options?: { projectionSeason: number; includeIdp: boolean };
  h21Rows: ProjectionActiveUniversePolicyPacketRow[];
  h28Rows: ProjectionSleeperPolicyRefreshRow[];
  h29Rows: ProjectionFreeAgentUnknownPolicyRow[];
}): ProjectionActivePolicyRefreshFinalInput {
  return {
    options: overrides.options ?? { projectionSeason: 2026, includeIdp: true },
    activeUniversePolicyPacket: {
      dryRun: true,
      readOnly: true,
      policyCounts: {
        byClassification: countH21(overrides.h21Rows),
      },
      rows: overrides.h21Rows,
    } as unknown as ProjectionActiveUniversePolicyPacketReport,
    sleeperPolicyRefresh: {
      dryRun: true,
      readOnly: true,
      policyCounts: {
        h28After: countH28(overrides.h28Rows),
      },
      v82SafeSubsetImpact: {
        protectedZeroChecks: zeroChecks(),
      },
      rows: overrides.h28Rows,
    } as unknown as ProjectionSleeperPolicyRefreshReport,
    freeAgentUnknownPolicyReview: {
      dryRun: true,
      readOnly: true,
      summary: {
        byPolicyClass: countH29(overrides.h29Rows),
      },
      v82Impact: {
        protectedZeroChecks: zeroChecks(),
      },
      rows: overrides.h29Rows,
    } as unknown as import("./projection-free-agent-unknown-policy-review-types").ProjectionFreeAgentUnknownPolicyReviewReport,
  };
}

function h21Row(overrides: Partial<ProjectionActiveUniversePolicyPacketRow>): ProjectionActiveUniversePolicyPacketRow {
  return {
    playerId: "p1",
    player: "Player One",
    position: "WR",
    projectionTeam: "KC",
    rosterTeam: null,
    rosterStatus: null,
    originalGateStatus: "unmatched_active_candidate_review",
    h19Status: "not_roster_confirmed",
    confirmationStatus: "roster_unmatched",
    promotionEligibilityClassification: "missing_from_candidate_pool",
    policyGroup: "unmatched_active_candidate_review",
    recommendedPolicyAction: "needs_depth_chart_source",
    v82Path: "would_use_v8_2_safe_subset",
    v82ProtectionStatus: "would_use_v8_2_safe_subset",
    reasonCodes: [],
    lastActiveSeason: null,
    projectedTotalPointDelta: 1,
    criticalMovement: false,
    estimatedOverallRankMovement: 10,
    policyClassification: "policy_source_expansion_required",
    policyReasonCodes: [],
    ...overrides,
  } as ProjectionActiveUniversePolicyPacketRow;
}

function h28Row(overrides: Partial<ProjectionSleeperPolicyRefreshRow>): ProjectionSleeperPolicyRefreshRow {
  return {
    playerId: "p1",
    sleeperId: "s1",
    player: "Player One",
    position: "WR",
    projectionTeam: "KC",
    metadataTeam: null,
    metadataStatus: "active",
    resolutionStatus: "sleeper_metadata_free_agent_or_unknown",
    originalPolicyClassification: "policy_source_expansion_required",
    refreshedPolicyClassification: "policy_source_expansion_required",
    policyDelta: "unchanged",
    reasonCodes: [],
    v82SafeSubsetStatus: "v82_safe_subset",
    projectedTotalPointDelta: 1,
    estimatedOverallRankMovement: 10,
    h27Row: {
      h26Row: {
        h21PolicyGroup: "unmatched_active_candidate_review",
      },
    } as never,
    ...overrides,
  };
}

function h29Row(overrides: Partial<ProjectionFreeAgentUnknownPolicyRow>): ProjectionFreeAgentUnknownPolicyRow {
  const h28 = h28Row({ playerId: overrides.playerId ?? "p1" });
  return {
    playerId: "p1",
    sleeperId: "s1",
    player: "Player One",
    position: "WR",
    projectionTeam: "KC",
    metadataTeam: null,
    metadataStatus: "active",
    projectedTotalPointDelta: 1,
    estimatedOverallRankMovement: 10,
    lastActiveSeason: null,
    oldOrStaleSignal: false,
    importanceBucket: "high_projection_importance",
    policyClass: "free_agent_unknown_manual_review",
    reasonCodes: [],
    v82SafeSubsetStatus: "v82_safe_subset",
    h28Row: h28,
    ...overrides,
  };
}

function countH21(rows: ProjectionActiveUniversePolicyPacketRow[]) {
  const counts = {
    policy_active_candidate: 0,
    policy_shadow_only: 0,
    policy_blocked_archive: 0,
    policy_manual_review: 0,
    policy_source_expansion_required: 0,
    policy_kicker_review_required: 0,
    policy_current_path_only: 0,
  };
  for (const row of rows) counts[row.policyClassification] += 1;
  return counts;
}

function countH28(rows: ProjectionSleeperPolicyRefreshRow[]) {
  const counts = {
    policy_active_candidate: 0,
    policy_shadow_only: 0,
    policy_blocked_archive: 0,
    policy_manual_review: 0,
    policy_source_expansion_required: 0,
    policy_kicker_review_required: 0,
    policy_current_path_only: 0,
    policy_active_candidate_preview: 0,
  };
  for (const row of rows) counts[row.refreshedPolicyClassification] += 1;
  return counts;
}

function countH29(rows: ProjectionFreeAgentUnknownPolicyRow[]) {
  const counts = {
    free_agent_unknown_shadow_only: 0,
    free_agent_unknown_current_path_only: 0,
    free_agent_unknown_manual_review: 0,
    free_agent_unknown_blocked_archive: 0,
    free_agent_unknown_source_expansion_required: 0,
  };
  for (const row of rows) counts[row.policyClass] += 1;
  return counts;
}

function zeroChecks() {
  return {
    kRowsUsingV82: true,
    criticalMoversUsingV82: true,
    meaningfulRankMoversUsingV82: true,
    legacyRowsUsingV82: true,
  };
}
