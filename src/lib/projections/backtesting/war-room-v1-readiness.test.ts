import { existsSync, unlinkSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildWarRoomV1ReadinessFromData,
  writeWarRoomV1ReadinessArtifacts,
} from "./war-room-v1-readiness";
import type { ProjectionActivePolicyRefreshFinalReport } from "./projection-active-policy-refresh-final-types";
import type { ProjectionDepthChartResolutionReport } from "./projection-depth-chart-resolution-types";
import type { ProjectionFreeAgentUnknownPolicyReviewReport } from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";
import type { WarRoomV1ReadinessInput } from "./war-room-v1-readiness-types";

describe("war room v1 readiness", () => {
  it("aggregates readiness categories and returns needs-e2e when product features and holdbacks are safe", () => {
    const report = buildWarRoomV1ReadinessFromData(input());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.recommendation).toBe("war_room_v1_needs_e2e_draft_test");
    expect(report.categorySummary.war_room_ui_readiness).toBe("ready");
    expect(report.categorySummary.board_modes_readiness).toBe("ready");
    expect(report.categorySummary.source_holdback_safety).toBe("ready_with_holdbacks");
    expect(report.categorySummary.e2e_draft_test_readiness).toBe("needs_e2e_test");
    expect(report.warRoomFeatureChecklist.every((item) => item.present)).toBe(true);
  });

  it("summarizes conservative launch policy and unresolved source holdbacks", () => {
    const report = buildWarRoomV1ReadinessFromData(input());

    expect(report.conservativeLaunchPolicy).toMatchObject({
      final_policy_active_candidate: 2118,
      final_policy_shadow_only: 695,
      final_policy_current_path_only: 171,
      final_policy_manual_review: 204,
      final_policy_source_expansion_required: 1101,
      final_policy_kicker_review_required: 127,
      final_policy_blocked_archive: 1219,
    });
    expect(report.sourceHoldbackSummary).toMatchObject({
      depthChartSourceRowsHeldBack: 1101,
      depthChartUnmatchedRows: 1101,
      freeAgentUnknownRowsNotAutoPromoted: true,
      inactiveStaleRowsHeldBack: 138,
      positionConflictsManualReview: 23,
      kickerRowsNotAutoPromoted: true,
      legacyRowsBlockedArchive: true,
    });
  });

  it("blocks if v8.2 is enabled or zero checks fail", () => {
    const enabled = buildWarRoomV1ReadinessFromData(input({ env: { BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES: "true" } }));
    const zeroCheckFailure = buildWarRoomV1ReadinessFromData(input({
      activePolicyRefreshFinal: activePolicyReport({
        protectedZeroChecks: { kRowsUsingV82: false, criticalMoversUsingV82: true, meaningfulRankMoversUsingV82: true, legacyRowsUsingV82: true },
      }),
    }));

    expect(enabled.recommendation).toBe("war_room_v1_blocked");
    expect(enabled.safetyGates.find((gate) => gate.name === "v8_2_not_enabled")?.passed).toBe(false);
    expect(zeroCheckFailure.recommendation).toBe("war_room_v1_blocked");
    expect(zeroCheckFailure.safetyGates.find((gate) => gate.name === "zero_checks_preserved")?.passed).toBe(false);
  });

  it("blocks if unresolved source rows are force-promoted", () => {
    const report = buildWarRoomV1ReadinessFromData(input({
      depthChartResolution: depthChartReport({
        previewCounts: {
          final_policy_active_candidate_preview: 1,
          final_policy_shadow_only: 0,
          final_policy_current_path_only: 0,
          final_policy_manual_review: 0,
          final_policy_source_expansion_required: 1100,
        },
        unmatched: 1101,
      }),
    }));

    expect(report.recommendation).toBe("war_room_v1_blocked");
    expect(report.safetyGates.find((gate) => gate.name === "depth_chart_unmatched_not_forced_active")?.passed).toBe(false);
  });

  it("generates H33 E2E checklist and safety gates", () => {
    const report = buildWarRoomV1ReadinessFromData(input());

    expect(report.e2eDraftTestChecklist).toEqual(expect.arrayContaining([
      "connect Sleeper draft room",
      "verify draft suggestions render",
      "verify mobile/tablet layout remains usable",
    ]));
    expect(report.safetyGates.map((gate) => gate.name)).toEqual([
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "v8_2_not_enabled",
      "unresolved_source_rows_held_back",
      "depth_chart_unmatched_not_forced_active",
      "kicker_rows_not_auto_promoted",
      "legacy_rows_blocked",
      "zero_checks_preserved",
    ]);
  });

  it("writes artifacts and preserves no-live-mutation claims", () => {
    const report = buildWarRoomV1ReadinessFromData(input({ options: { projectionSeason: 2093, includeIdp: true, env: {} } }));
    const artifacts = writeWarRoomV1ReadinessArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "no_supabase_writes")?.passed).toBe(true);
    } finally {
      for (const artifactPath of Object.values(artifacts)) {
        if (existsSync(artifactPath)) unlinkSync(artifactPath);
      }
    }
  });
});

function input(overrides: Partial<WarRoomV1ReadinessInput> & { env?: Record<string, string | undefined> } = {}): WarRoomV1ReadinessInput {
  const options = overrides.options ?? { projectionSeason: 2026, includeIdp: true, env: overrides.env ?? {} };
  return {
    options,
    activePolicyRefreshFinal: overrides.activePolicyRefreshFinal ?? activePolicyReport(),
    depthChartResolution: overrides.depthChartResolution ?? depthChartReport(),
    featureFlagReviewPacket: overrides.featureFlagReviewPacket ?? featureFlagPacket(),
    sleeperPolicyRefresh: null,
    freeAgentUnknownPolicyReview: overrides.freeAgentUnknownPolicyReview ?? freeAgentReport(),
    sleeperMetadataResolution: null,
    activeUniversePolicyPacket: {},
    preseasonProjectionSnapshot: {},
    sourceTexts: overrides.sourceTexts ?? sourceTexts(),
  };
}

function activePolicyReport(overrides: {
  protectedZeroChecks?: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
} = {}): ProjectionActivePolicyRefreshFinalReport {
  return {
    dryRun: true,
    readOnly: true,
    policyCounts: {
      h30FinalPolicyCounts: {
        final_policy_active_candidate: 2118,
        final_policy_shadow_only: 695,
        final_policy_current_path_only: 171,
        final_policy_manual_review: 204,
        final_policy_source_expansion_required: 1101,
        final_policy_kicker_review_required: 127,
        final_policy_blocked_archive: 1219,
      },
    },
    remainingBlockers: {
      manualReviewRows: 204,
      kickerPolicyRows: 127,
      positionConflictRows: 23,
      inactiveStaleHeldBack: 138,
      remainingSourceExpansionRows: 1101,
      blockedArchiveRows: 1219,
      freeAgentUnknownHighImportanceManualReviewRows: 177,
      rosterConflictRows: 4,
      currentPathManualRows: 3,
    },
    v82ControlledFlagImpact: {
      safeV82RowsAllowedByFinalPolicy: 1754,
      safeV82RowsHeldShadowOnly: 691,
      safeV82RowsHeldCurrentPathOnly: 167,
      safeV82RowsHeldManualReview: 202,
      safeV82RowsStillSourceExpansionRequired: 429,
      safeV82RowsBlockedArchive: 2,
      safeV82RowsKickerReviewRequired: 0,
      controlledFlagReviewRemainsBlocked: true,
      protectedZeroChecks: overrides.protectedZeroChecks ?? zeroChecks(),
    },
  } as unknown as ProjectionActivePolicyRefreshFinalReport;
}

function depthChartReport(overrides: {
  unmatched?: number;
  previewCounts?: ProjectionDepthChartResolutionReport["policyImpactPreview"]["h31DepthChartPreviewCounts"];
} = {}): ProjectionDepthChartResolutionReport {
  return {
    dryRun: true,
    readOnly: true,
    summary: {
      unmatched: overrides.unmatched ?? 1101,
    },
    policyImpactPreview: {
      h31DepthChartPreviewCounts: overrides.previewCounts ?? {
        final_policy_active_candidate_preview: 0,
        final_policy_shadow_only: 0,
        final_policy_current_path_only: 0,
        final_policy_manual_review: 0,
        final_policy_source_expansion_required: 1101,
      },
    },
    v82ControlledFlagImpact: {
      protectedZeroChecks: zeroChecks(),
    },
  } as unknown as ProjectionDepthChartResolutionReport;
}

function featureFlagPacket(): ProjectionV82FeatureFlagReviewPacketReport {
  return {
    dryRun: true,
    readOnly: true,
    recommendation: "ready_for_controlled_flag_review",
    safetySummary: {
      kRowsUsingV82: 0,
      criticalMoversUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
    },
  } as unknown as ProjectionV82FeatureFlagReviewPacketReport;
}

function freeAgentReport(): ProjectionFreeAgentUnknownPolicyReviewReport {
  return {
    dryRun: true,
    readOnly: true,
    summary: {
      activePromotions: 0,
    },
  } as unknown as ProjectionFreeAgentUnknownPolicyReviewReport;
}

function sourceTexts(): WarRoomV1ReadinessInput["sourceTexts"] {
  const draftWarRoom = [
    "Draft Suggestions buildLiveDraftSuggestions Full Blackbird Rank full_blackbird Available Blackbird Rank available_blackbird",
    "normalizeBoardSearch setVisibleBoardRows((count) => count + 50)",
    "RosterConstructionSummary Current roster by position PlanAlignmentChips buildWarRoomPlanAlignmentLabels",
    "Player Reasoning buildWarRoomPlayerReasonStack Historical Profile /api/player-profiles/",
    "GM Brief buildWarRoomGmBrief LiveSyncStatusIndicator buildWarRoomLiveState",
    "SHOW_SCORING_FOUNDATION_STATUS Scoring Foundation Status",
    "/api/draft-rooms/ /state /sync syncNow Unable to load draft room. Sync failed.",
  ].join(" ");
  return {
    draftWarRoom,
    draftWarRoomTest: draftWarRoom,
    aiContext: "buildWarRoomAiContext noAiApiCalls canMutateDraft: false noSupabaseWrites",
    liveState: "buildWarRoomLiveState",
    playerReasons: "buildWarRoomPlayerReasonStack",
  };
}

function zeroChecks() {
  return {
    kRowsUsingV82: true,
    criticalMoversUsingV82: true,
    meaningfulRankMoversUsingV82: true,
    legacyRowsUsingV82: true,
  };
}
