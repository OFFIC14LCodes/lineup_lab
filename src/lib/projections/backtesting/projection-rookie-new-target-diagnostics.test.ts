import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionRookieNewTargetDiagnosticsFromData,
  positionFamilyDiagnostic,
  writeProjectionRookieNewTargetDiagnosticsArtifacts,
} from "./projection-rookie-new-target-diagnostics";
import { normalizeProjectionRookieName } from "./projection-rookie-team-confirmation";

import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow } from "./projection-current-roster-confirmation-types";
import type { ProjectionRookieTeamConfirmationReport, ProjectionRookieTeamConfirmationRow } from "./projection-rookie-team-confirmation-types";
import type { ProjectionRosterRefreshPolicyReviewRow } from "./projection-roster-refresh-policy-review-types";

describe("projection rookie/new target diagnostics", () => {
  it("reuses conservative rookie name normalization", () => {
    expect(normalizeProjectionRookieName("D'Andre Edge Jr.")).toBe("dandreedge");
  });

  it("classifies target identities and assigns source strategies", () => {
    const report = buildProjectionRookieNewTargetDiagnosticsFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Aidan Hubbard")?.targetIdentityClass).toBe("idp_position_family_mismatch_candidate");
    expect(report.rows.find((row) => row.player === "Aidan Hubbard")?.recommendedSourceStrategy).toBe("needs_position_family_review");
    expect(report.rows.find((row) => row.player === "Barion Brown")?.targetIdentityClass).toBe("special_teams_position_mismatch_candidate");
    expect(report.rows.find((row) => row.player === "Sleeper Only")?.targetIdentityClass).toBe("sleeper_only_player");
    expect(report.rows.find((row) => row.player === "Roster Match")?.recommendedSourceStrategy).toBe("use_current_roster_source");
  });

  it("reports position family diagnostics", () => {
    expect(positionFamilyDiagnostic("LB", "DL")).toBe("edge_family_compatible");
    expect(positionFamilyDiagnostic("WR", "KR")).toBe("returner_family_compatible");
    expect(positionFamilyDiagnostic("TE", "LS")).toBe("te_ls_incompatible_without_review");
    expect(positionFamilyDiagnostic("WR", "DL")).toBe("position_family_incompatible");

    const report = buildProjectionRookieNewTargetDiagnosticsFromData(fixtureInput());
    expect(report.positionFamilyDiagnostics.nameTeamOverlapsWithCompatiblePositionFamily).toBeGreaterThan(0);
    expect(report.positionFamilyDiagnostics.nameTeamOverlapsWithIncompatiblePosition).toBeGreaterThan(0);
  });

  it("summarizes source coverage and H21/v8.2 impact", () => {
    const report = buildProjectionRookieNewTargetDiagnosticsFromData(fixtureInput());

    expect(report.sourceCoverageSummary.targetRowsWithSleeperIdOnly).toBeGreaterThan(0);
    expect(report.sourceCoverageSummary.targetRowsWithGsisId).toBeGreaterThan(0);
    expect(report.sourceCoverageSummary.targetRowsFoundInCurrentRosterSource).toBe(2);
    expect(report.sourceCoverageSummary.targetRowsFoundInRookieSource).toBe(2);
    expect(report.h21ImpactSummary.v82SafeRowsBySourceStrategy.needs_position_family_review).toBeGreaterThan(0);
    expect(report.h21ImpactSummary.sourceStrategyBlocksV82ControlledReview).toBe(false);
  });

  it("includes top example tables and no-mutation safety gates", () => {
    const report = buildProjectionRookieNewTargetDiagnosticsFromData(fixtureInput());

    expect(report.examples.topRowsByProjectionImpact.length).toBeGreaterThan(0);
    expect(report.examples.topV82SafeSubsetRows.length).toBeGreaterThan(0);
    expect(report.examples.topRowsWithNoSourceOverlap.map((row) => row.player)).toContain("Sleeper Only");
    expect(report.examples.topIdpEdgeFamilyMismatchCandidates.map((row) => row.player)).toContain("Aidan Hubbard");
    expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
    expect(report.recommendation).toBe("rookie_target_diagnostics_ready_for_source_selection");
  });

  it("writes artifacts", () => {
    const report = buildProjectionRookieNewTargetDiagnosticsFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2093, includeIdp: true },
    });
    const artifacts = writeProjectionRookieNewTargetDiagnosticsArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-rookie-new-target-diagnostics-2093.json");
      expect(artifacts.markdownPath).toContain("projection-rookie-new-target-diagnostics-2093.md");
      expect(artifacts.csvPath).toContain("projection-rookie-new-target-diagnostics-2093.csv");
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

function fixtureInput() {
  const policyRows = [
    policyRow("s1", "Aidan Hubbard", "LB", "SEA", "would_use_v8_2_safe_subset"),
    policyRow("s2", "Barion Brown", "WR", "NO", "would_use_v8_2_safe_subset"),
    policyRow("s3", "Sleeper Only", "RB", "KC", "would_use_v8_2_safe_subset"),
    policyRow("s4", "Roster Match", "TE", "CHI", "excluded_or_blocked"),
    policyRow("s5", "Bad Position", "WR", "DAL", "excluded_or_blocked"),
  ];
  const currentConfirmationRows = policyRows.map((row) => currentConfirmationRow(row, row.player === "Roster Match" ? "roster_confirmed_active" : "roster_unmatched"));
  const rookieConfirmationRows = policyRows.map((row) => rookieConfirmationRow(row, row.player === "Aidan Hubbard" || row.player === "Barion Brown" ? "rookie_team_review_candidate" : "rookie_team_unmatched"));
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    rookieTeamConfirmation: {
      dryRun: true,
      readOnly: true,
      projectionSeason: 2026,
      includeIdp: true,
      rows: rookieConfirmationRows,
    } as ProjectionRookieTeamConfirmationReport,
    policyPacket: {
      dryRun: true,
      readOnly: true,
      projectionSeason: 2026,
      includeIdp: true,
      rows: policyRows,
      recommendation: "active_policy_ready_for_source_expansion",
    } as ProjectionActiveUniversePolicyPacketReport,
    rosterRefresh: {} as ProjectionActiveUniverseGateRosterRefreshReport,
    currentRosterConfirmation: {
      dryRun: true,
      readOnly: true,
      projectionSeason: 2026,
      includeIdp: true,
      rows: currentConfirmationRows,
    } as ProjectionCurrentRosterConfirmationReport,
    preseasonProjectionSnapshot: {
      metadata: {},
      diagnostics: {},
      rows: [
        snapshot("s1", "00-1", "Aidan Hubbard", "LB"),
        snapshot("s2", "00-2", "Barion Brown", "WR"),
        snapshot("s3", null, "Sleeper Only", "RB"),
        snapshot("s4", "00-4", "Roster Match", "TE"),
        snapshot("s5", "00-5", "Bad Position", "WR"),
      ],
    } as never,
    currentRosterSource: currentRosterSource([
      currentSource({ playerName: "Roster Match", position: "TE", team: "CHI" }),
      currentSource({ playerName: "Bad Position", position: "DL", team: "DAL" }),
    ]),
    rookieTeamConfirmationSource: rookieSource([
      rookieSourceRow({ playerName: "Aidan Hubbard", position: "DL", nflTeam: "SEA" }),
      rookieSourceRow({ playerName: "Barion Brown", position: "KR", nflTeam: "NO" }),
    ]),
  };
}

function policyRow(playerId: string, player: string, position: string, team: string, v82Path: ProjectionRosterRefreshPolicyReviewRow["v82Path"]): ProjectionActiveUniversePolicyPacketRow {
  return {
    playerId,
    player,
    position,
    projectionTeam: team,
    rosterTeam: null,
    rosterStatus: null,
    originalGateStatus: "rookie_or_new_confirmed",
    h19Status: "rookie_or_new_unmatched_review",
    confirmationStatus: "roster_unmatched",
    promotionEligibilityClassification: "eligible_for_projection_promotion",
    policyGroup: "unmatched_rookie_new_review",
    recommendedPolicyAction: "needs_rookie_team_confirmation",
    v82Path,
    v82ProtectionStatus: v82Path === "would_use_v8_2_safe_subset" ? "would_use_v8_2_safe_subset" : "excluded_or_blocked",
    reasonCodes: [],
    lastActiveSeason: null,
    projectedTotalPointDelta: player === "Aidan Hubbard" ? 10 : 1,
    criticalMovement: false,
    estimatedOverallRankMovement: null,
    policyClassification: "policy_source_expansion_required",
    policyReasonCodes: ["unmatched_rookie_needs_team_confirmation"],
  };
}

function snapshot(sleeperId: string, gsisId: string | null, playerName: string, position: string) {
  return { sleeperId, gsisId, playerName, normalizedName: normalizeProjectionRookieName(playerName), position };
}

function currentConfirmationRow(row: ProjectionActiveUniversePolicyPacketRow, confirmationStatus: ProjectionCurrentRosterConfirmationRow["confirmationStatus"]): ProjectionCurrentRosterConfirmationRow {
  return {
    playerId: row.playerId,
    sleeperId: row.playerId,
    gsisId: row.player === "Sleeper Only" ? null : `00-${row.playerId}`,
    player: row.player,
    normalizedName: normalizeProjectionRookieName(row.player),
    position: row.position,
    projectionTeam: row.projectionTeam,
    rosterTeam: confirmationStatus === "roster_confirmed_active" ? row.projectionTeam : null,
    rosterStatus: confirmationStatus === "roster_confirmed_active" ? "active" : null,
    activeGateStatus: "rookie_or_new_confirmed",
    promotionEligibilityClassification: "eligible_for_projection_promotion",
    confirmationStatus,
    reasonCodes: [],
    matchedRosterSource: null,
    sourceUpdatedAt: null,
  };
}

function rookieConfirmationRow(row: ProjectionActiveUniversePolicyPacketRow, rookieTeamStatus: ProjectionRookieTeamConfirmationRow["rookieTeamStatus"]): ProjectionRookieTeamConfirmationRow {
  return {
    ...row,
    rookieTeamStatus,
    matchReason: rookieTeamStatus === "rookie_team_review_candidate" ? "name_team" : "no_match",
    sourceTeam: rookieTeamStatus === "rookie_team_review_candidate" ? row.projectionTeam : null,
    sourceDraftClub: null,
    sourceCollege: null,
    sourcePlayerName: rookieTeamStatus === "rookie_team_review_candidate" ? row.player : null,
    sourceRow: null,
    previewPolicyClassification: rookieTeamStatus === "rookie_team_review_candidate" ? "policy_manual_review" : "policy_source_expansion_required",
    previewReasonCodes: [],
  };
}

function currentRosterSource(rows: CurrentRosterSourceRow[]): CurrentRosterSourceReport {
  return { generatedAt: "", dryRun: true, readOnly: true, season: 2026, inputPath: "", mappingPath: null, mapping: {}, sourceRows: rows.length, normalizedRows: rows.length, duplicateRowsRemoved: 0, invalidRows: 0, missingIdRows: 0, statusCounts: {} as never, positionCounts: {}, teamCounts: {}, rows, issues: [], notes: [] };
}

function rookieSource(rows: RookieTeamConfirmationSourceRow[]): RookieTeamConfirmationSourceReport {
  return { generatedAt: "", dryRun: true, readOnly: true, season: 2026, inputPath: "", sourceRows: rows.length, normalizedRows: rows.length, duplicateRowsRemoved: 0, invalidRows: 0, missingIdentifierRows: 0, positionCounts: {}, teamCounts: {}, rows, issues: [], notes: [] };
}

function currentSource(values: Partial<CurrentRosterSourceRow>): CurrentRosterSourceRow {
  const playerName = values.playerName ?? "Player";
  const position = values.position ?? "WR";
  return { playerId: null, sleeperId: null, gsisId: null, playerName, normalizedName: normalizeProjectionRookieName(playerName), position, team: null, status: "active", rosterStatus: null, depthChartPosition: null, depthChartOrder: null, source: "fixture", sourceUpdatedAt: null, notes: null, matchKey: "", ...values };
}

function rookieSourceRow(values: Partial<RookieTeamConfirmationSourceRow>): RookieTeamConfirmationSourceRow {
  const playerName = values.playerName ?? "Player";
  const position = values.position ?? "WR";
  return { playerId: null, sleeperId: null, gsisId: null, playerName, normalizedName: normalizeProjectionRookieName(playerName), position, college: null, normalizedCollege: null, nflTeam: null, draftClub: null, draftRound: null, draftPick: null, source: "fixture", sourceUpdatedAt: null, notes: null, matchKey: "", ...values };
}
