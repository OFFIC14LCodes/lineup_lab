import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import {
  buildProjectionCrosswalkEnhancedConfirmationFromData,
  writeProjectionCrosswalkEnhancedConfirmationArtifacts,
} from "./projection-crosswalk-enhanced-confirmation";
import type { ProjectionCrosswalkEnhancedConfirmationInput } from "./projection-crosswalk-enhanced-confirmation-types";
import type { ProjectionPlayerIdCrosswalkReviewReport, ProjectionPlayerIdCrosswalkReviewRow } from "./projection-player-id-crosswalk-review-types";
import type { ProjectionRookieNewTargetDiagnosticsReport, ProjectionRookieNewTargetDiagnosticsRow } from "./projection-rookie-new-target-diagnostics-types";

describe("projection crosswalk-enhanced confirmation", () => {
  it("applies exact crosswalk and links current roster by GSIS", () => {
    const report = buildProjectionCrosswalkEnhancedConfirmationFromData(input({
      crosswalkRows: [crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Alpha Player" })],
      currentRosterRows: [currentRosterRow({ gsisId: "00-001", playerName: "Alpha Player", team: "KC", status: "active" })],
    }));

    expect(report.rows[0]).toMatchObject({
      enhancedStatus: "crosswalk_roster_confirmed_active",
      policyImpactPreview: "policy_active_candidate",
      currentRosterTeam: "KC",
    });
    expect(report.rows[0].reasonCodes).toEqual(expect.arrayContaining(["exact_crosswalk_confirmed", "linked_to_current_roster_by_gsis", "team_matches_projection", "status_active"]));
    expect(report.beforeAfterSummary.linkedToCurrentRosterSource).toBe(1);
  });

  it("links rookie source by GSIS when roster source is absent", () => {
    const report = buildProjectionCrosswalkEnhancedConfirmationFromData(input({
      crosswalkRows: [crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Rookie Player" })],
      rookieRows: [rookieRow({ gsisId: "00-001", playerName: "Rookie Player", nflTeam: "KC" })],
    }));

    expect(report.rows[0]).toMatchObject({
      enhancedStatus: "crosswalk_rookie_team_confirmed",
      policyImpactPreview: "policy_active_candidate",
      rookieTeam: "KC",
    });
    expect(report.beforeAfterSummary.linkedToRookieTeamSource).toBe(1);
    expect(report.beforeAfterSummary.confirmedTeamAfterCrosswalk).toBe(1);
  });

  it("reports team conflicts conservatively", () => {
    const report = buildProjectionCrosswalkEnhancedConfirmationFromData(input({
      crosswalkRows: [crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Alpha Player", team: "KC" })],
      currentRosterRows: [currentRosterRow({ gsisId: "00-001", playerName: "Alpha Player", team: "DAL", status: "active" })],
    }));

    expect(report.rows[0]).toMatchObject({
      enhancedStatus: "crosswalk_team_conflict",
      policyImpactPreview: "policy_manual_review",
    });
    expect(report.beforeAfterSummary.teamConflictsAfterCrosswalk).toBe(1);
  });

  it("keeps confirmed crosswalk rows unmatched when no source links exist", () => {
    const report = buildProjectionCrosswalkEnhancedConfirmationFromData(input({
      crosswalkRows: [crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Alpha Player" })],
    }));

    expect(report.rows[0]).toMatchObject({
      enhancedStatus: "crosswalk_source_unmatched",
      policyImpactPreview: "policy_source_expansion_required",
    });
    expect(report.beforeAfterSummary.stillUnmatchedAfterCrosswalk).toBe(1);
  });

  it("summarizes policy preview, v8.2 safe subset, and zero checks", () => {
    const report = buildProjectionCrosswalkEnhancedConfirmationFromData(input({
      crosswalkRows: [
        crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Alpha Player" }),
        crosswalkRow({ playerId: "s2", crosswalkGsisId: "00-002", player: "Beta Player" }),
      ],
      diagnosticsRows: [
        diagnosticsRow({ playerId: "s1", player: "Alpha Player" }),
        diagnosticsRow({ playerId: "s2", player: "Beta Player" }),
      ],
      currentRosterRows: [currentRosterRow({ gsisId: "00-001", playerName: "Alpha Player", team: "KC", status: "active" })],
    }));

    expect(report.h21PolicyImpactPreview.wouldMoveTo.policy_active_candidate).toBe(1);
    expect(report.h21PolicyImpactPreview.wouldMoveTo.policy_source_expansion_required).toBe(1);
    expect(report.v82SafeSubsetImpact.safeRowsMovedToActiveCandidatePreview).toBe(1);
    expect(report.v82SafeSubsetImpact.safeRowsStillHeldBack).toBe(1);
    expect(Object.values(report.v82SafeSubsetImpact.zeroChecks).every(Boolean)).toBe(true);
  });

  it("writes artifacts and preserves dry-run safety gates", () => {
    const report = buildProjectionCrosswalkEnhancedConfirmationFromData(input({
      options: { projectionSeason: 2099, includeIdp: true },
      crosswalkRows: [crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Alpha Player" })],
    }));
    const artifacts = writeProjectionCrosswalkEnhancedConfirmationArtifacts(report);

    expect(existsSync(artifacts.jsonPath)).toBe(true);
    expect(existsSync(artifacts.markdownPath)).toBe(true);
    expect(existsSync(artifacts.csvPath)).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "no_supabase_writes")?.passed).toBe(true);
  });
});

function input(overrides: {
  options?: { projectionSeason: number; includeIdp: boolean };
  crosswalkRows?: ProjectionPlayerIdCrosswalkReviewRow[];
  diagnosticsRows?: ProjectionRookieNewTargetDiagnosticsRow[];
  currentRosterRows?: CurrentRosterSourceRow[];
  rookieRows?: RookieTeamConfirmationSourceRow[];
}): ProjectionCrosswalkEnhancedConfirmationInput {
  const crosswalkRows = overrides.crosswalkRows ?? [crosswalkRow({ playerId: "s1", crosswalkGsisId: "00-001", player: "Alpha Player" })];
  const diagnosticsRows = overrides.diagnosticsRows ?? crosswalkRows.map((row) => diagnosticsRow({ playerId: row.playerId, player: row.player }));
  return {
    options: overrides.options ?? { projectionSeason: 2026, includeIdp: true },
    playerIdCrosswalkReview: { dryRun: true, readOnly: true, rows: crosswalkRows } as ProjectionPlayerIdCrosswalkReviewReport,
    rookieNewTargetDiagnostics: { dryRun: true, readOnly: true, rows: diagnosticsRows } as ProjectionRookieNewTargetDiagnosticsReport,
    rookieTeamConfirmation: { dryRun: true, readOnly: true, rows: [] } as never,
    currentRosterConfirmation: {
      dryRun: true,
      readOnly: true,
      rows: crosswalkRows.map((row) => ({
        playerId: row.playerId,
        sleeperId: row.sleeperId,
        gsisId: row.crosswalkGsisId,
        player: row.player,
        normalizedName: row.normalizedName,
        position: row.position,
        projectionTeam: row.team,
        rosterTeam: null,
        rosterStatus: null,
        activeGateStatus: "rookie_or_new_confirmed",
        promotionEligibilityClassification: "promotion_candidate",
        confirmationStatus: "roster_unmatched",
        reasonCodes: [],
        matchedRosterSource: null,
        sourceUpdatedAt: null,
      })),
    } as never,
    currentRosterSource: { dryRun: true, readOnly: true, rows: overrides.currentRosterRows ?? [] } as CurrentRosterSourceReport,
    rookieTeamConfirmationSource: { dryRun: true, readOnly: true, rows: overrides.rookieRows ?? [] } as RookieTeamConfirmationSourceReport,
    policyPacket: {
      dryRun: true,
      readOnly: true,
      rows: [],
      v82ConservativePolicyImpact: {
        protectedZeroChecks: {
          kRowsUsingV82: true,
          criticalMoversUsingV82: true,
          meaningfulRankMoversUsingV82: true,
          legacyRowsUsingV82: true,
        },
      },
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
    preseasonProjectionSnapshot: {
      rows: crosswalkRows.map((row) => ({
        sleeperId: row.sleeperId,
        gsisId: row.crosswalkGsisId,
        playerName: row.player,
        normalizedName: row.normalizedName,
        position: row.position,
        team: row.team,
      })),
    } as never,
  };
}

function crosswalkRow(overrides: Partial<ProjectionPlayerIdCrosswalkReviewRow>): ProjectionPlayerIdCrosswalkReviewRow {
  return {
    playerId: "s1",
    sleeperId: "s1",
    originalGsisId: null,
    crosswalkGsisId: "00-001",
    player: "Alpha Player",
    normalizedName: "alphaplayer",
    position: "QB",
    team: "KC",
    h23SourceStrategy: "needs_id_crosswalk",
    v82SafeSubsetStatus: "v82_safe_subset",
    status: "crosswalk_confirmed",
    confidence: "exact_id",
    evidenceSources: ["snapshot"],
    reasonCodes: ["crosswalk_confirmed"],
    linkedCurrentRosterRow: null,
    linkedRookieTeamRow: null,
    integrationPreview: "manual_review",
    projectedTotalPointDelta: 10,
    estimatedOverallRankMovement: 5,
    ...overrides,
  };
}

function diagnosticsRow(overrides: Partial<ProjectionRookieNewTargetDiagnosticsRow>): ProjectionRookieNewTargetDiagnosticsRow {
  return {
    playerId: "s1",
    sleeperId: "s1",
    gsisId: "00-001",
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
    targetIdentityClass: "sleeper_only_player",
    recommendedSourceStrategy: "needs_id_crosswalk",
    positionFamilyDiagnostic: "not_applicable",
    projectedTotalPointDelta: 10,
    estimatedOverallRankMovement: 5,
    ...overrides,
  };
}

function currentRosterRow(overrides: Partial<CurrentRosterSourceRow>): CurrentRosterSourceRow {
  return {
    playerId: "00-001",
    sleeperId: null,
    gsisId: "00-001",
    playerName: "Alpha Player",
    normalizedName: "alphaplayer",
    position: "QB",
    team: "KC",
    status: "active",
    rosterStatus: null,
    depthChartPosition: null,
    depthChartOrder: null,
    source: "unit",
    sourceUpdatedAt: null,
    notes: null,
    matchKey: "gsis:00-001",
    ...overrides,
  };
}

function rookieRow(overrides: Partial<RookieTeamConfirmationSourceRow>): RookieTeamConfirmationSourceRow {
  return {
    playerId: "00-001",
    sleeperId: null,
    gsisId: "00-001",
    playerName: "Rookie Player",
    normalizedName: "rookieplayer",
    position: "QB",
    college: null,
    normalizedCollege: null,
    nflTeam: "KC",
    draftClub: "KC",
    draftRound: null,
    draftPick: null,
    source: "unit",
    sourceUpdatedAt: null,
    notes: null,
    matchKey: "gsis:00-001",
    ...overrides,
  };
}
