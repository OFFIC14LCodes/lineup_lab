import { existsSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildProjectionCrosswalkUnmatchedClassificationFromData,
  writeProjectionCrosswalkUnmatchedClassificationArtifacts,
} from "./projection-crosswalk-unmatched-classification";
import type { ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionCrosswalkEnhancedConfirmationReport, ProjectionCrosswalkEnhancedConfirmationRow } from "./projection-crosswalk-enhanced-confirmation-types";
import type { ProjectionCrosswalkUnmatchedInput } from "./projection-crosswalk-unmatched-classification-types";
import type { ProjectionRookieNewTargetDiagnosticsRow } from "./projection-rookie-new-target-diagnostics-types";

describe("projection crosswalk-unmatched classification", () => {
  it("assigns classifications and reason codes", () => {
    const report = buildProjectionCrosswalkUnmatchedClassificationFromData(input({
      h25Rows: [
        h25Row({ playerId: "old", player: "Old Player", crosswalkGsisId: "00-old" }),
        h25Row({ playerId: "sleeper", player: "Sleeper Player", crosswalkGsisId: "00-sleeper" }),
      ],
      policyRows: [
        policyRow({ playerId: "old", player: "Old Player", lastActiveSeason: 2023 }),
        policyRow({ playerId: "sleeper", player: "Sleeper Player", lastActiveSeason: null }),
      ],
      h23Rows: [
        h23Row({ playerId: "old", player: "Old Player", targetIdentityClass: "sleeper_only_player" }),
        h23Row({ playerId: "sleeper", player: "Sleeper Player", targetIdentityClass: "sleeper_only_player" }),
      ],
    }));

    expect(report.rows.find((row) => row.playerId === "old")?.classification).toBe("likely_inactive_or_archive");
    expect(report.rows.find((row) => row.playerId === "old")?.reasonCodes).toEqual(expect.arrayContaining(["old_last_seen_signal", "possible_free_agent_or_retired"]));
    expect(report.rows.find((row) => row.playerId === "sleeper")?.classification).toBe("needs_sleeper_status_source");
    expect(report.rows.find((row) => row.playerId === "sleeper")?.reasonCodes).toContain("sleeper_only_status_needed");
  });

  it("selects source priority from classification counts", () => {
    const report = buildProjectionCrosswalkUnmatchedClassificationFromData(input({
      h25Rows: [
        h25Row({ playerId: "a", crosswalkGsisId: "00-a" }),
        h25Row({ playerId: "b", crosswalkGsisId: "00-b" }),
        h25Row({ playerId: "c", crosswalkGsisId: "00-c" }),
      ],
      policyRows: [
        policyRow({ playerId: "a", recommendedPolicyAction: "needs_transaction_status_source", policyGroup: "stale_unmatched_review" }),
        policyRow({ playerId: "b", recommendedPolicyAction: "needs_transaction_status_source", policyGroup: "stale_unmatched_review" }),
        policyRow({ playerId: "c", recommendedPolicyAction: "needs_depth_chart_source" }),
      ],
      h23Rows: [h23Row({ playerId: "a" }), h23Row({ playerId: "b" }), h23Row({ playerId: "c" })],
    }));

    expect(report.sourcePriorityRecommendation.recommendedSourcePriority).toBe("transaction_free_agent_source");
    expect(report.sourcePriorityRecommendation.priorityCounts.transaction_free_agent_source).toBe(2);
  });

  it("summarizes policy preview and v8.2 held-back impact", () => {
    const report = buildProjectionCrosswalkUnmatchedClassificationFromData(input({
      h25Rows: [h25Row({ playerId: "a", crosswalkGsisId: "00-a" })],
      policyRows: [policyRow({ playerId: "a", recommendedPolicyAction: "needs_depth_chart_source" })],
      h23Rows: [h23Row({ playerId: "a" })],
    }));

    expect(report.h21PolicyPreview.wouldRemainUnder.policy_source_expansion_required).toBe(1);
    expect(report.v82Impact.safeRowsAffected).toBe(1);
    expect(report.v82Impact.safeRowsStillHeldBack).toBe(1);
    expect(report.v82Impact.blocksControlledFlagReview).toBe(true);
    expect(report.v82Impact.zeroChecksPreserved).toBe(true);
  });

  it("populates top examples and safety gates", () => {
    const report = buildProjectionCrosswalkUnmatchedClassificationFromData(input({
      h25Rows: [h25Row({ playerId: "a", crosswalkGsisId: "00-a" })],
      policyRows: [policyRow({ playerId: "a", recommendedPolicyAction: "needs_depth_chart_source" })],
      h23Rows: [h23Row({ playerId: "a" })],
    }));

    expect(report.examples.topNeedsDepthChartRows).toHaveLength(1);
    expect(report.safetyGates.find((gate) => gate.name === "unmatched_rows_not_forced_active")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "source_need_reported")?.passed).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
  });

  it("writes artifacts", () => {
    const report = buildProjectionCrosswalkUnmatchedClassificationFromData(input({
      options: { projectionSeason: 2098, includeIdp: true },
      h25Rows: [h25Row({ playerId: "a", crosswalkGsisId: "00-a" })],
      policyRows: [policyRow({ playerId: "a" })],
      h23Rows: [h23Row({ playerId: "a" })],
    }));
    const artifacts = writeProjectionCrosswalkUnmatchedClassificationArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      for (const artifactPath of Object.values(artifacts)) {
        if (existsSync(artifactPath)) unlinkSync(artifactPath);
      }
    }
  });
});

function input(overrides: {
  options?: { projectionSeason: number; includeIdp: boolean };
  h25Rows: ProjectionCrosswalkEnhancedConfirmationRow[];
  policyRows: ProjectionActiveUniversePolicyPacketRow[];
  h23Rows: ProjectionRookieNewTargetDiagnosticsRow[];
}): ProjectionCrosswalkUnmatchedInput {
  return {
    options: overrides.options ?? { projectionSeason: 2026, includeIdp: true },
    crosswalkEnhancedConfirmation: { dryRun: true, readOnly: true, rows: overrides.h25Rows } as ProjectionCrosswalkEnhancedConfirmationReport,
    playerIdCrosswalkReview: { dryRun: true, readOnly: true, rows: [] } as never,
    rookieNewTargetDiagnostics: { dryRun: true, readOnly: true, rows: overrides.h23Rows } as never,
    policyPacket: {
      dryRun: true,
      readOnly: true,
      rows: overrides.policyRows,
    } as never,
    rosterRefresh: {
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
    currentRosterConfirmation: { dryRun: true, readOnly: true, rows: [] } as never,
    currentRosterSourcePresent: true,
    preseasonProjectionSnapshot: {
      rows: overrides.h25Rows.map((row) => ({
        sleeperId: row.sleeperId,
        gsisId: row.crosswalkGsisId,
        playerName: row.player,
        normalizedName: row.normalizedName,
        position: row.position,
        team: row.projectionTeam,
        confidence: "very_low",
        inputCoverage: { priorGames: 0, noPriorNflData: true },
      })),
    } as never,
  };
}

function h25Row(overrides: Partial<ProjectionCrosswalkEnhancedConfirmationRow>): ProjectionCrosswalkEnhancedConfirmationRow {
  return {
    playerId: "a",
    sleeperId: "a",
    crosswalkGsisId: "00-a",
    player: "Alpha Player",
    normalizedName: "alphaplayer",
    position: "QB",
    projectionTeam: "KC",
    currentRosterTeam: null,
    currentRosterStatus: null,
    rookieTeam: null,
    snapshotTeam: "KC",
    existingRosterConfirmationStatus: "roster_unmatched",
    h24Status: "crosswalk_confirmed",
    enhancedStatus: "crosswalk_source_unmatched",
    reasonCodes: ["exact_crosswalk_confirmed", "roster_source_missing_after_crosswalk", "rookie_source_missing_after_crosswalk"],
    policyImpactPreview: "policy_source_expansion_required",
    v82SafeSubsetStatus: "v82_safe_subset",
    linkedCurrentRosterRow: null,
    linkedRookieTeamRow: null,
    linkedSnapshotRow: null,
    existingRosterConfirmationRow: null,
    projectedTotalPointDelta: 10,
    estimatedOverallRankMovement: 5,
    ...overrides,
  };
}

function h23Row(overrides: Partial<ProjectionRookieNewTargetDiagnosticsRow>): ProjectionRookieNewTargetDiagnosticsRow {
  return {
    playerId: "a",
    sleeperId: "a",
    gsisId: "00-a",
    player: "Alpha Player",
    normalizedName: "alphaplayer",
    position: "QB",
    team: "KC",
    sourceRowMatchCandidates: { currentRoster: [], rookieTeam: [] },
    currentRosterMatchStatus: "roster_unmatched",
    rookieConfirmationMatchStatus: "rookie_team_unmatched",
    h21PolicyGroup: "unmatched_rookie_new_review",
    v82SafeSubsetStatus: "v82_safe_subset",
    reasonCodes: [],
    targetIdentityClass: "source_strategy_unknown",
    recommendedSourceStrategy: "needs_id_crosswalk",
    positionFamilyDiagnostic: "not_applicable",
    projectedTotalPointDelta: 10,
    estimatedOverallRankMovement: 5,
    ...overrides,
  };
}

function policyRow(overrides: Partial<ProjectionActiveUniversePolicyPacketRow>): ProjectionActiveUniversePolicyPacketRow {
  return {
    playerId: "a",
    player: "Alpha Player",
    position: "QB",
    projectionTeam: "KC",
    rosterTeam: null,
    rosterStatus: null,
    originalGateStatus: "rookie_or_new_confirmed",
    h19Status: "rookie_or_new_unmatched_review",
    confirmationStatus: "roster_unmatched",
    promotionEligibilityClassification: "promotion_candidate",
    policyGroup: "unmatched_rookie_new_review",
    recommendedPolicyAction: "needs_rookie_team_confirmation",
    v82Path: "would_use_v8_2_safe_subset",
    v82ProtectionStatus: "would_use_v8_2_safe_subset",
    reasonCodes: [],
    lastActiveSeason: null,
    projectedTotalPointDelta: 10,
    criticalMovement: false,
    estimatedOverallRankMovement: 5,
    policyClassification: "policy_source_expansion_required",
    policyReasonCodes: ["v8_2_safe_subset_preserved"],
    ...overrides,
  } as ProjectionActiveUniversePolicyPacketRow;
}
