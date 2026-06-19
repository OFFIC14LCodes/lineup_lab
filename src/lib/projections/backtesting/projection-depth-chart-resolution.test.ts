import { existsSync, unlinkSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { DepthChartSourceReport, DepthChartSourceRow } from "@/lib/data-acquisition/depth-chart-source-types";

import {
  buildProjectionDepthChartResolutionFromData,
  writeProjectionDepthChartResolutionArtifacts,
} from "./projection-depth-chart-resolution";
import type { ProjectionActivePolicyRefreshFinalReport, ProjectionActivePolicyRefreshFinalRow } from "./projection-active-policy-refresh-final-types";

describe("projection depth chart resolution", () => {
  it("confirms exact ID active/starter/backup rows without changing unmatched rows", () => {
    const report = buildProjectionDepthChartResolutionFromData(input({
      h30Rows: [
        h30Row({ playerId: "starter", sleeperId: "s1", player: "Starter One", projectedTotalPointDelta: 6 }),
        h30Row({ playerId: "backup", sleeperId: "s2", player: "Backup One" }),
        h30Row({ playerId: "unmatched", sleeperId: "s3", player: "Missing One" }),
        h30Row({ playerId: "already-active", finalPolicyClass: "final_policy_active_candidate" }),
      ],
      sourceRows: [
        sourceRow({ playerId: "starter", sleeperId: "s1", playerName: "Starter One", status: "starter", role: "starter" }),
        sourceRow({ playerId: "backup", sleeperId: "s2", playerName: "Backup One", status: "active", role: "backup" }),
      ],
    }));

    expect(report.summary.targetDepthChartSourceRows).toBe(3);
    expect(report.summary.confirmedActiveStarterBackup).toBe(2);
    expect(report.rows.find((row) => row.playerId === "starter")).toMatchObject({
      matchedBy: "sleeper_id",
      resolutionStatus: "depth_chart_starter_confirmed",
      policyPreview: "final_policy_active_candidate_preview",
    });
    expect(report.rows.find((row) => row.playerId === "backup")?.resolutionStatus).toBe("depth_chart_backup_confirmed");
    expect(report.rows.find((row) => row.playerId === "unmatched")).toMatchObject({
      matchedBy: "none",
      policyPreview: "final_policy_source_expansion_required",
    });
  });

  it("keeps reserve, practice squad, inactive, conflict, and fallback name matches conservative", () => {
    const report = buildProjectionDepthChartResolutionFromData(input({
      h30Rows: [
        h30Row({ playerId: "reserve", sleeperId: "s1", player: "Reserve One" }),
        h30Row({ playerId: "inactive", sleeperId: "s2", player: "Inactive One" }),
        h30Row({ playerId: "team-conflict", sleeperId: "s3", player: "Team Conflict", projectionTeam: "KC" }),
        h30Row({ playerId: "pos-conflict", sleeperId: "s4", player: "Position Conflict", position: "WR" }),
        h30Row({ playerId: "fallback", sleeperId: null, player: "Fallback Match", position: "RB", projectionTeam: "KC" }),
      ],
      sourceRows: [
        sourceRow({ playerId: "reserve", sleeperId: "s1", playerName: "Reserve One", status: "reserve", role: "depth" }),
        sourceRow({ playerId: "inactive", sleeperId: "s2", playerName: "Inactive One", status: "injured", role: "unknown" }),
        sourceRow({ playerId: "team-conflict", sleeperId: "s3", playerName: "Team Conflict", team: "BUF" }),
        sourceRow({ playerId: "pos-conflict", sleeperId: "s4", playerName: "Position Conflict", position: "RB" }),
        sourceRow({ playerId: null, sleeperId: null, playerName: "Fallback Match", position: "RB", team: "KC", status: "active", role: "starter" }),
      ],
    }));

    expect(report.rows.find((row) => row.playerId === "reserve")?.policyPreview).toBe("final_policy_shadow_only");
    expect(report.rows.find((row) => row.playerId === "inactive")?.policyPreview).toBe("final_policy_current_path_only");
    expect(report.rows.find((row) => row.playerId === "team-conflict")).toMatchObject({
      resolutionStatus: "depth_chart_team_conflict",
      policyPreview: "final_policy_manual_review",
    });
    expect(report.rows.find((row) => row.playerId === "pos-conflict")).toMatchObject({
      resolutionStatus: "depth_chart_position_conflict",
      policyPreview: "final_policy_manual_review",
    });
    expect(report.rows.find((row) => row.playerId === "fallback")).toMatchObject({
      matchedBy: "name_team_position",
      resolutionStatus: "depth_chart_review_candidate",
      policyPreview: "final_policy_manual_review",
    });
  });

  it("reports v8.2 impact, source population recommendation, and safety gates", () => {
    const report = buildProjectionDepthChartResolutionFromData(input({
      h30Rows: [
        h30Row({ playerId: "active", sleeperId: "s1", v82SafeSubset: true }),
        h30Row({ playerId: "manual", sleeperId: "s2", v82SafeSubset: true, projectionTeam: "KC" }),
      ],
      sourceRows: [
        sourceRow({ playerId: "active", sleeperId: "s1", status: "active" }),
        sourceRow({ playerId: "manual", sleeperId: "s2", team: "BUF" }),
      ],
    }));

    expect(report.v82ControlledFlagImpact).toMatchObject({
      v82SafeRowsResolvedByDepthChart: 2,
      v82SafeRowsNewlyAllowed: 1,
      v82SafeRowsMovedToManualReview: 1,
      controlledFlagReviewRemainsBlocked: true,
    });
    expect(report.recommendation).toBe("depth_chart_resolution_needs_manual_review");
    expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "conflicts_manual_review")?.passed).toBe(true);
  });

  it("requires source population when the normalized source is empty", () => {
    const report = buildProjectionDepthChartResolutionFromData(input({
      h30Rows: [h30Row({ playerId: "target", sleeperId: "s1" })],
      sourceRows: [],
    }));

    expect(report.summary.sourceRows).toBe(0);
    expect(report.summary.unmatched).toBe(1);
    expect(report.recommendation).toBe("depth_chart_resolution_needs_source_population");
  });

  it("writes artifacts and preserves no-live-mutation gates", () => {
    const report = buildProjectionDepthChartResolutionFromData(input({
      options: { projectionSeason: 2094, includeIdp: true },
      h30Rows: [h30Row({ playerId: "target", sleeperId: "s1" })],
      sourceRows: [sourceRow({ playerId: "target", sleeperId: "s1", status: "active" })],
    }));
    const artifacts = writeProjectionDepthChartResolutionArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.readOnly).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "draft_suggestions_unchanged")?.passed).toBe(true);
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
  h30Rows: ProjectionActivePolicyRefreshFinalRow[];
  sourceRows: DepthChartSourceRow[];
}) {
  return {
    options: overrides.options ?? { projectionSeason: 2026, includeIdp: true },
    activePolicyRefreshFinal: h30Report(overrides.h30Rows),
    depthChartSource: sourceReport(overrides.sourceRows),
  };
}

function h30Report(rows: ProjectionActivePolicyRefreshFinalRow[]): ProjectionActivePolicyRefreshFinalReport {
  return {
    dryRun: true,
    readOnly: true,
    rows,
    policyCounts: {
      h30FinalPolicyCounts: {
        final_policy_active_candidate: rows.filter((row) => row.finalPolicyClass === "final_policy_active_candidate").length,
        final_policy_shadow_only: 0,
        final_policy_current_path_only: 0,
        final_policy_manual_review: 0,
        final_policy_source_expansion_required: rows.filter((row) => row.finalPolicyClass === "final_policy_source_expansion_required").length,
        final_policy_kicker_review_required: 0,
        final_policy_blocked_archive: 0,
      },
    },
    v82ControlledFlagImpact: {
      protectedZeroChecks: zeroChecks(),
    },
  } as unknown as ProjectionActivePolicyRefreshFinalReport;
}

function h30Row(overrides: Partial<ProjectionActivePolicyRefreshFinalRow>): ProjectionActivePolicyRefreshFinalRow {
  return {
    playerId: "p1",
    sleeperId: "s1",
    player: "Player One",
    position: "WR",
    projectionTeam: "KC",
    basePolicyClassification: "policy_source_expansion_required",
    h28PolicyClassification: "policy_source_expansion_required",
    h29PolicyClass: null,
    finalPolicyClass: "final_policy_source_expansion_required",
    appliedLayer: "h28_sleeper_metadata_policy_refresh",
    reasonCodes: ["h28_source_expansion_preserved"],
    v82SafeSubset: true,
    policyGroup: "needs_depth_chart_source",
    projectedTotalPointDelta: 1,
    estimatedOverallRankMovement: 10,
    baseRow: null,
    h28Row: null,
    h29Row: null,
    ...overrides,
  };
}

function sourceReport(rows: DepthChartSourceRow[]): DepthChartSourceReport {
  return {
    dryRun: true,
    readOnly: true,
    normalizedRows: rows.length,
    rows,
  } as unknown as DepthChartSourceReport;
}

function sourceRow(overrides: Partial<DepthChartSourceRow>): DepthChartSourceRow {
  const playerName = overrides.playerName ?? "Player One";
  const position = overrides.position ?? "WR";
  const team = overrides.team ?? "KC";
  return {
    season: 2026,
    team,
    playerName,
    normalizedName: playerName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    position,
    depthPosition: null,
    depthRank: null,
    role: "unknown",
    status: "active",
    sleeperId: "s1",
    gsisId: null,
    playerId: "p1",
    source: "fixture",
    sourceUpdatedAt: null,
    notes: null,
    matchKey: "fixture",
    ...overrides,
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
