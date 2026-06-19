import { existsSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildProjectionSleeperPolicyRefreshFromData,
  writeProjectionSleeperPolicyRefreshArtifacts,
} from "./projection-sleeper-policy-refresh";
import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport } from "./projection-active-universe-policy-packet-types";
import type { ProjectionSleeperMetadataResolutionReport, ProjectionSleeperMetadataResolutionRow } from "./projection-sleeper-metadata-resolution-types";
import type { ProjectionSleeperPolicyRefreshInput } from "./projection-sleeper-policy-refresh-types";

describe("projection sleeper policy refresh", () => {
  it("maps only active plausible rows to active candidate preview", () => {
    const report = buildProjectionSleeperPolicyRefreshFromData(input({
      h27Rows: [
        h27Row({ playerId: "a", player: "Active Player", resolutionStatus: "sleeper_metadata_active_plausible" }),
        h27Row({ playerId: "i", player: "Inactive Player", resolutionStatus: "sleeper_metadata_inactive_or_stale" }),
      ],
    }));

    expect(report.rows.find((row) => row.playerId === "a")).toMatchObject({
      refreshedPolicyClassification: "policy_active_candidate_preview",
      policyDelta: "promoted_in_preview",
    });
    expect(report.rows.find((row) => row.playerId === "i")).toMatchObject({
      refreshedPolicyClassification: "policy_shadow_only",
    });
    expect(report.safetyGates.find((gate) => gate.name === "only_active_plausible_promoted_in_preview")?.passed).toBe(true);
  });

  it("holds back inactive, free-agent, and missing rows while keeping position conflicts manual", () => {
    const report = buildProjectionSleeperPolicyRefreshFromData(input({
      h27Rows: [
        h27Row({ playerId: "i", resolutionStatus: "sleeper_metadata_inactive_or_stale" }),
        h27Row({ playerId: "f", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
        h27Row({ playerId: "m", resolutionStatus: "sleeper_metadata_missing" }),
        h27Row({ playerId: "p", resolutionStatus: "sleeper_metadata_position_conflict" }),
      ],
    }));

    expect(report.rows.map((row) => row.refreshedPolicyClassification)).toEqual([
      "policy_shadow_only",
      "policy_source_expansion_required",
      "policy_source_expansion_required",
      "policy_manual_review",
    ]);
    expect(report.summary.inactiveStaleHeldBack).toBe(1);
    expect(report.summary.freeAgentUnknownHeldBack).toBe(1);
    expect(report.summary.manualReviewPositionConflicts).toBe(1);
    expect(report.safetyGates.find((gate) => gate.name === "inactive_stale_held_back")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "free_agent_unknown_held_back")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "position_conflicts_manual_review")?.passed).toBe(true);
  });

  it("reports before and after policy deltas", () => {
    const report = buildProjectionSleeperPolicyRefreshFromData(input({
      h21Counts: {
        policy_source_expansion_required: 2,
      },
      h27Rows: [
        h27Row({ playerId: "a", resolutionStatus: "sleeper_metadata_active_plausible" }),
        h27Row({ playerId: "f", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
      ],
    }));

    expect(report.policyCounts.h21Before.policy_source_expansion_required).toBe(2);
    expect(report.policyCounts.h28After.policy_active_candidate_preview).toBe(1);
    expect(report.policyCounts.h28After.policy_source_expansion_required).toBe(1);
    expect(report.policyCounts.delta.policy_active_candidate_preview).toBe(1);
    expect(report.policyCounts.delta.policy_source_expansion_required).toBe(-1);
  });

  it("summarizes v8.2 safe-subset impact and keeps controlled flag review blocked", () => {
    const report = buildProjectionSleeperPolicyRefreshFromData(input({
      h27Rows: [
        h27Row({ playerId: "a", resolutionStatus: "sleeper_metadata_active_plausible", v82SafeSubsetStatus: "v82_safe_subset" }),
        h27Row({ playerId: "i", resolutionStatus: "sleeper_metadata_inactive_or_stale", v82SafeSubsetStatus: "v82_safe_subset" }),
        h27Row({ playerId: "f", resolutionStatus: "sleeper_metadata_free_agent_or_unknown", v82SafeSubsetStatus: "v82_safe_subset" }),
        h27Row({ playerId: "p", resolutionStatus: "sleeper_metadata_position_conflict", v82SafeSubsetStatus: "v82_safe_subset" }),
      ],
    }));

    expect(report.v82SafeSubsetImpact).toMatchObject({
      newlyAllowedBySleeperMetadata: 1,
      stillHeldBack: 3,
      heldBackByInactiveStale: 1,
      heldBackByFreeAgentUnknown: 1,
      heldBackByPositionConflict: 1,
      controlledFlagReviewRemainsBlocked: true,
    });
  });

  it("orders source recommendations by affected counts", () => {
    const report = buildProjectionSleeperPolicyRefreshFromData(input({
      h27Rows: [
        h27Row({ playerId: "f1", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
        h27Row({ playerId: "f2", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
        h27Row({ playerId: "i1", resolutionStatus: "sleeper_metadata_inactive_or_stale" }),
      ],
    }));

    expect(report.sourceRecommendations[0]).toMatchObject({
      sourceNeed: "free_agent_unknown_policy_review",
      rowsAffected: 2,
    });
    expect(report.sourceRecommendations[1]).toMatchObject({
      sourceNeed: "transaction_status_source",
      rowsAffected: 1,
    });
  });

  it("writes artifacts and preserves no-live-mutation gates", () => {
    const report = buildProjectionSleeperPolicyRefreshFromData(input({
      options: { projectionSeason: 2096, includeIdp: true },
      h27Rows: [h27Row({ playerId: "a", resolutionStatus: "sleeper_metadata_active_plausible" })],
    }));
    const artifacts = writeProjectionSleeperPolicyRefreshArtifacts(report);
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
  h27Rows: ProjectionSleeperMetadataResolutionRow[];
  h21Counts?: Partial<Record<ProjectionActiveUniversePolicyClassification, number>>;
}): ProjectionSleeperPolicyRefreshInput {
  const baseCounts = {
    policy_active_candidate: 0,
    policy_shadow_only: 0,
    policy_blocked_archive: 0,
    policy_manual_review: 0,
    policy_source_expansion_required: overrides.h27Rows.length,
    policy_kicker_review_required: 0,
    policy_current_path_only: 0,
    ...overrides.h21Counts,
  };
  return {
    options: overrides.options ?? { projectionSeason: 2026, includeIdp: true },
    sleeperMetadataResolution: {
      dryRun: true,
      readOnly: true,
      rows: overrides.h27Rows,
    } as ProjectionSleeperMetadataResolutionReport,
    activeUniversePolicyPacket: {
      dryRun: true,
      readOnly: true,
      policyCounts: {
        byClassification: baseCounts,
      },
      rows: [],
    } as unknown as ProjectionActiveUniversePolicyPacketReport,
    activeUniverseGateRosterRefresh: {
      dryRun: true,
      readOnly: true,
      v82SafeSubsetCrossReference: {
        packetSummary: {
          kRowsUsingV82: 0,
          criticalMoversUsingV82: 0,
          meaningfulRankMoversUsingV82: 0,
          legacyRowsUsingV82: 0,
        },
      },
    } as never,
    featureFlagReviewPacket: {
      dryRun: true,
      readOnly: true,
      safetySummary: {
        kRowsUsingV82: 0,
        criticalMoversUsingV82: 0,
        meaningfulRankMoversUsingV82: 0,
        legacyRowsUsingV82: 0,
      },
    } as never,
    rosterRefreshPolicyReview: { dryRun: true, readOnly: true } as never,
    preseasonProjectionSnapshot: { dryRun: true },
  };
}

function h27Row(overrides: Partial<ProjectionSleeperMetadataResolutionRow>): ProjectionSleeperMetadataResolutionRow {
  const resolutionStatus = overrides.resolutionStatus ?? "sleeper_metadata_active_plausible";
  return {
    playerId: "s1",
    sleeperId: "s1",
    crosswalkGsisId: "00-001",
    player: "Alpha Player",
    position: "QB",
    projectionTeam: "KC",
    metadataTeam: resolutionStatus === "sleeper_metadata_free_agent_or_unknown" ? null : "KC",
    metadataPosition: "QB",
    metadataStatus: "active",
    metadataActive: true,
    resolutionStatus,
    reasonCodes: ["exact_sleeper_id_match"],
    policyPreview: resolutionStatus === "sleeper_metadata_active_plausible" ? "policy_active_candidate" : "policy_source_expansion_required",
    v82SafeSubsetStatus: "v82_safe_subset",
    sourceRow: null,
    h26Row: {
      originalPolicyClassification: "policy_source_expansion_required",
    } as never,
    projectedTotalPointDelta: 10,
    estimatedOverallRankMovement: 5,
    ...overrides,
  };
}
