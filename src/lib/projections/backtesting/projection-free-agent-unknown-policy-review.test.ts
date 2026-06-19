import { existsSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildProjectionFreeAgentUnknownPolicyReviewFromData,
  writeProjectionFreeAgentUnknownPolicyReviewArtifacts,
} from "./projection-free-agent-unknown-policy-review";
import type { ProjectionFreeAgentUnknownPolicyReviewInput } from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionSleeperMetadataResolutionRow } from "./projection-sleeper-metadata-resolution-types";
import type { ProjectionSleeperPolicyRefreshReport, ProjectionSleeperPolicyRefreshRow } from "./projection-sleeper-policy-refresh-types";

describe("projection free-agent/unknown policy review", () => {
  it("classifies free-agent/unknown rows by conservative importance buckets", () => {
    const report = buildProjectionFreeAgentUnknownPolicyReviewFromData(input([
      h28Row({ playerId: "high", projectedTotalPointDelta: 6 }),
      h28Row({ playerId: "moderate", projectedTotalPointDelta: 1.5 }),
      h28Row({ playerId: "low", projectedTotalPointDelta: 0.2, estimatedOverallRankMovement: 20 }),
      h28Row({ playerId: "unknown", projectedTotalPointDelta: null, estimatedOverallRankMovement: null }),
    ]));

    expect(report.rows.find((row) => row.playerId === "high")).toMatchObject({
      importanceBucket: "high_projection_importance",
      policyClass: "free_agent_unknown_manual_review",
    });
    expect(report.rows.find((row) => row.playerId === "moderate")).toMatchObject({
      importanceBucket: "moderate_projection_importance",
      policyClass: "free_agent_unknown_current_path_only",
    });
    expect(report.rows.find((row) => row.playerId === "low")).toMatchObject({
      importanceBucket: "low_projection_importance",
      policyClass: "free_agent_unknown_shadow_only",
    });
    expect(report.rows.find((row) => row.playerId === "unknown")).toMatchObject({
      importanceBucket: "insufficient_projection_importance_data",
      policyClass: "free_agent_unknown_source_expansion_required",
    });
  });

  it("uses old low-importance last-seen signal for blocked/archive", () => {
    const report = buildProjectionFreeAgentUnknownPolicyReviewFromData(input([
      h28Row({ playerId: "old", projectedTotalPointDelta: 0, estimatedOverallRankMovement: 10, lastActiveSeason: 2022 }),
    ]));

    expect(report.rows[0]).toMatchObject({
      oldOrStaleSignal: true,
      policyClass: "free_agent_unknown_blocked_archive",
    });
    expect(report.rows[0].reasonCodes).toEqual(expect.arrayContaining(["old_last_seen_signal", "low_projection_importance"]));
  });

  it("never promotes free-agent/unknown rows and keeps high-importance rows manual review", () => {
    const report = buildProjectionFreeAgentUnknownPolicyReviewFromData(input([
      h28Row({ playerId: "high", estimatedOverallRankMovement: 1200 }),
      h28Row({ playerId: "low", projectedTotalPointDelta: 0 }),
    ]));

    expect(report.summary.activePromotions).toBe(0);
    expect(report.safetyGates.find((gate) => gate.name === "free_agent_unknown_not_auto_promoted")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "high_importance_rows_manual_review")?.passed).toBe(true);
    expect(report.rows.find((row) => row.playerId === "high")?.policyClass).toBe("free_agent_unknown_manual_review");
  });

  it("summarizes v8.2 impact and policy counts", () => {
    const report = buildProjectionFreeAgentUnknownPolicyReviewFromData(input([
      h28Row({ playerId: "high", projectedTotalPointDelta: 5 }),
      h28Row({ playerId: "moderate", estimatedOverallRankMovement: 600 }),
      h28Row({ playerId: "low", estimatedOverallRankMovement: 100 }),
    ]));

    expect(report.summary.byPolicyClass).toMatchObject({
      free_agent_unknown_manual_review: 1,
      free_agent_unknown_current_path_only: 1,
      free_agent_unknown_shadow_only: 1,
    });
    expect(report.v82Impact).toMatchObject({
      freeAgentUnknownV82SafeRowsReviewed: 3,
      heldBackAsManualReview: 1,
      heldBackAsCurrentPathOnly: 1,
      heldBackAsShadowOnly: 1,
      controlledFlagReviewRemainsBlocked: true,
    });
  });

  it("keeps the review scoped to free-agent/unknown rows", () => {
    const report = buildProjectionFreeAgentUnknownPolicyReviewFromData(input([
      h28Row({ playerId: "fa", resolutionStatus: "sleeper_metadata_free_agent_or_unknown" }),
      h28Row({ playerId: "inactive", resolutionStatus: "sleeper_metadata_inactive_or_stale" }),
    ]));

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].playerId).toBe("fa");
    expect(report.safetyGates.find((gate) => gate.name === "free_agent_unknown_scope_only")?.passed).toBe(true);
  });

  it("writes artifacts and preserves no-live-mutation gates", () => {
    const report = buildProjectionFreeAgentUnknownPolicyReviewFromData(input([
      h28Row({ playerId: "fa" }),
    ], { projectionSeason: 2095, includeIdp: true }));
    const artifacts = writeProjectionFreeAgentUnknownPolicyReviewArtifacts(report);
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

function input(
  rows: ProjectionSleeperPolicyRefreshRow[],
  options: { projectionSeason: number; includeIdp: boolean } = { projectionSeason: 2026, includeIdp: true },
): ProjectionFreeAgentUnknownPolicyReviewInput {
  return {
    options,
    sleeperPolicyRefresh: {
      dryRun: true,
      readOnly: true,
      rows,
      v82SafeSubsetImpact: {
        protectedZeroChecks: {
          kRowsUsingV82: true,
          criticalMoversUsingV82: true,
          meaningfulRankMoversUsingV82: true,
          legacyRowsUsingV82: true,
        },
      },
    } as ProjectionSleeperPolicyRefreshReport,
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
  };
}

function h28Row(overrides: Partial<ProjectionSleeperPolicyRefreshRow & { lastActiveSeason: number | null }>): ProjectionSleeperPolicyRefreshRow {
  const resolutionStatus = overrides.resolutionStatus ?? "sleeper_metadata_free_agent_or_unknown";
  return {
    playerId: "fa",
    sleeperId: "fa",
    player: "Free Agent",
    position: "WR",
    projectionTeam: "KC",
    metadataTeam: null,
    metadataStatus: "active",
    resolutionStatus,
    originalPolicyClassification: "policy_source_expansion_required",
    refreshedPolicyClassification: "policy_source_expansion_required",
    policyDelta: "unchanged",
    reasonCodes: ["sleeper_free_agent_unknown_held_back"],
    v82SafeSubsetStatus: "v82_safe_subset",
    projectedTotalPointDelta: 0,
    estimatedOverallRankMovement: 0,
    h27Row: {
      h26Row: {
        lastActiveSeason: overrides.lastActiveSeason ?? null,
      },
    } as ProjectionSleeperMetadataResolutionRow,
    ...overrides,
  };
}
