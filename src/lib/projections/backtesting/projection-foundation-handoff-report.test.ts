import { existsSync, readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { ProjectionFoundationArtifactSummary } from "./projection-foundation-handoff-report-types";
import {
  buildProjectionFoundationHandoffReportFromArtifacts,
  writeProjectionFoundationHandoffArtifacts,
} from "./projection-foundation-handoff-report";

describe("projection foundation handoff report", () => {
  it("generates a clean handoff report from governance artifacts", () => {
    const report = buildReport();

    expect(report.currentRecommendation).toBe("foundation_ready_for_disabled_flag_code_review");
    expect(report.executiveSummary.featureFlagName).toBe("BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES");
    expect(report.executiveSummary.liveBehaviorChanged).toBe(false);
    expect(report.currentSafeSubset).toMatchObject({
      total2026Rows: 5635,
      wouldUseV82UnderEnabledFlag: 3210,
      wouldUseCurrentPath: 147,
      excludedFromFlagPool: 1033,
      blockedFromFlagPool: 1245,
      kRowsUsingV82: 0,
      criticalMoversUsingV82: 0,
      meaningfulRankMoversUsingV82: 0,
      legacyRowsUsingV82: 0,
    });
    expect(report.governanceChain.map((stage) => stage.stageName)).toEqual(expect.arrayContaining([
      "feature-flag readiness",
      "feature-flag preview",
      "pipeline selector preview",
      "snapshot diff guard",
    ]));
    expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
  });

  it("summarizes artifact recommendations and safety gates", () => {
    const report = buildReport();
    const guardStage = report.governanceChain.find((stage) => stage.stageName === "snapshot diff guard");

    expect(guardStage?.recommendationOrVerdict).toBe("snapshot_diff_guard_clean");
    expect(guardStage?.safetyGatesPassed).toBe(15);
    expect(guardStage?.safetyGatesTotal).toBe(15);
    expect(guardStage?.keyCounts).toMatchObject({
      defaultV82Rows: 0,
      enabledV82Rows: 3210,
      missingArtifactV82Rows: 0,
    });
  });

  it("blocks when a required artifact is missing", () => {
    const artifacts = artifactsForCleanReport().map((artifact) => (
      artifact.key === "snapshotDiffGuard"
        ? { ...artifact, status: "missing" as const, sizeBytes: null, error: "artifact missing", data: undefined }
        : artifact
    ));
    const report = buildReport({ artifacts });

    expect(report.currentRecommendation).toBe("foundation_blocked");
    expect(report.safetyGates.find((gate) => gate.name === "required_artifacts_available")?.passed).toBe(false);
    expect(report.governanceChain.find((stage) => stage.artifactKey === "snapshotDiffGuard")?.remainingBlockers).toContain("artifact missing");
  });

  it("includes command lists and protection policy", () => {
    const report = buildReport();

    expect(report.commands.regenerateChain).toContain("Remove-Item Env:\\BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES -ErrorAction SilentlyContinue");
    expect(report.commands.regenerateChain).toContain("npm run projection:foundation:handoff -- --projection-season=2026 --include-idp");
    expect(report.commands.verification).toContain("npm run build");
    expect(report.protectionPolicy).toContain("K rows protected");
    expect(report.protectionPolicy).toContain("missing readiness artifacts fail closed");
    expect(report.allowedNext).toContain("disabled feature-flag code review");
    expect(report.notAllowedYet).toContain("do not enable v8.2 live");
  });

  it("writes json and markdown artifacts", () => {
    const report = buildReport({ projectionSeason: 2096 });
    const artifacts = writeProjectionFoundationHandoffArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("foundation_ready_for_disabled_flag_code_review");
    } finally {
      rmSync(artifacts.jsonPath, { force: true });
      rmSync(artifacts.markdownPath, { force: true });
    }
  });

  it("does not import live mutation, ranking, suggestion, or UI paths", () => {
    const source = readFileSync("src/lib/projections/backtesting/projection-foundation-handoff-report.ts", "utf8");

    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("blackbird-league-rank");
    expect(source).not.toContain("live-draft-suggestion");
    expect(source).not.toContain("draft-war-room");
    expect(source).not.toContain("src/components");
  });
});

function buildReport(input: Partial<{
  projectionSeason: number;
  artifacts: Array<ProjectionFoundationArtifactSummary & { data?: unknown }>;
}> = {}) {
  return buildProjectionFoundationHandoffReportFromArtifacts({
    options: { projectionSeason: input.projectionSeason ?? 2026, includeIdp: true },
    artifacts: input.artifacts ?? artifactsForCleanReport(),
  });
}

function artifactsForCleanReport(): Array<ProjectionFoundationArtifactSummary & { data?: unknown }> {
  return [
    csvArtifact("snapshot"),
    jsonArtifact("shadow", { recommendation: "shadow_candidate_with_manual_review", rowCoverage: { currentLiveProjectionRows: 5635, v82ShadowRows: 5635, sharedRows: 5635 }, criticalMovements: [], safetyGates: gates(10) }),
    jsonArtifact("universeEligibilityAudit", { verdict: "universe_eligibility_passed", rows: [], safetyGates: gates(8) }),
    jsonArtifact("promotionCandidatePool", { recommendation: "promotion_candidate_pool_clean", rows: [], safetyGates: gates(9) }),
    jsonArtifact("manualReviewPacket", { recommendation: "manual_review_packet_ready", rows: [], safetyGates: gates(8) }),
    jsonArtifact("manualReviewDecisionsResolved", { verdict: "decisions_ready", rows: [], safetyGates: gates(10) }),
    csvArtifact("manualReviewDecisionsConservative"),
    jsonArtifact("finalPromotionReadiness", { verdict: "ready_for_shadow_promotion_review", summary: { eligibleRows: 3245, manualReviewRowsRemaining: 0, shadowOnlyRows: 1145, blockedRows: 1245 }, validationIssues: [], policyViolations: [], safetyGates: gates(13) }),
    jsonArtifact("limitedPromotionPoolReview", { recommendation: "limited_pool_clean_for_feature_flag_review", eligibleRows: [{ playerId: "1" }], excludedCounts: { criticalMovementRowsExcluded: 14, kRowsExcluded: 127 }, safetyGates: gates(12) }),
    jsonArtifact("rankImpactQualityReview", { recommendation: "rank_impact_quality_review_ready", rows: [], safetyGates: gates(10) }),
    jsonArtifact("rankImpactTierReview", { recommendation: "tier_review_ready", rows: [], safetyGates: gates(11) }),
    jsonArtifact("rankImpactTierDecisionsResolved", { verdict: "tier_decisions_ready", summary: { resolvedTierStatusCounts: { tier_approved: 0, tier_current_path: 35, tier_shadow_only: 0, tier_unresolved: 0 } }, safetyGates: gates(11) }),
    csvArtifact("rankImpactTierDecisionsConservative"),
    jsonArtifact("featureFlagReadiness", {
      recommendation: "ready_for_disabled_feature_flag_scaffold",
      summary: {
        totalRows: 5635,
        wouldUseV82UnderFlag: 3210,
        wouldUseCurrentPathUnderFlag: 147,
        excludedFromFlagPool: 1033,
        blockedFromFlagPool: 1245,
        kRowsUsingV82: 0,
        criticalMovementRowsUsingV82: 0,
        meaningfulRankMoversUsingV82: 0,
        legacyRowsUsingV82: 0,
      },
      safetyGates: gates(15),
    }),
    jsonArtifact("featureFlagPreview", {
      recommendation: "selector_preview_clean",
      disabledMode: { summary: { v82Rows: 0 } },
      enabledMode: { summary: { v82Rows: 3210, currentPathRows: 147 } },
      protectedRowViolations: [],
      safetyGates: gates(14),
    }),
    jsonArtifact("pipelineSelectorPreview", {
      recommendation: "pipeline_selector_preview_clean",
      disabledMode: { summary: { v82Rows: 0 } },
      enabledMode: { summary: { v82Rows: 3210, currentPathRows: 147 } },
      missingArtifactsMode: { summary: { v82Rows: 0 } },
      safetyGates: gates(16),
    }),
    jsonArtifact("snapshotDiffGuard", {
      recommendation: "snapshot_diff_guard_clean",
      defaultSnapshot: { selectorRows: 5635, v82SelectedRows: 0, currentPathRows: 5635 },
      enabledValidation: { summary: { v82Rows: 3210 } },
      missingArtifacts: { v82SelectedRows: 0 },
      safetyGates: gates(15),
    }),
  ];
}

function jsonArtifact(key: string, data: unknown): ProjectionFoundationArtifactSummary & { data?: unknown } {
  return { key, path: `artifacts/projections/backtesting/${key}.json`, status: "available", sizeBytes: 100, error: null, data };
}

function csvArtifact(key: string): ProjectionFoundationArtifactSummary {
  return { key, path: `artifacts/projections/backtesting/${key}.csv`, status: "not_parsed", sizeBytes: 100, error: null };
}

function gates(count: number) {
  return Array.from({ length: count }, (_, index) => ({ name: `gate_${index + 1}`, passed: true, detail: "ok" }));
}
