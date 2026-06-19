import { describe, expect, it } from "vitest";

import type { PlayerIdCrosswalkSourceReport } from "@/lib/data-acquisition/player-id-crosswalk-source-types";
import type { SleeperNormalizedPlayer } from "@/lib/data-acquisition/sleeper/sleeper-player-types";

import { buildProjectionPlayerIdCrosswalkReviewFromData } from "./projection-player-id-crosswalk-review";
import type { ProjectionRookieNewTargetDiagnosticsReport, ProjectionRookieNewTargetDiagnosticsRow } from "./projection-rookie-new-target-diagnostics-types";

describe("projection player ID crosswalk review", () => {
  it("confirms exact Sleeper metadata and links current roster by GSIS", () => {
    const report = buildProjectionPlayerIdCrosswalkReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      rookieNewTargetDiagnostics: diagnosticsReport([targetRow({ playerId: "s1", sleeperId: "s1", gsisId: null, player: "Alpha Player" })]),
      playerIdCrosswalkSource: null,
      sleeperPlayers: [sleeperPlayer({ sleeperId: "s1", gsisId: "00-001", playerName: "Alpha Player" })],
      currentRosterSource: {
        dryRun: true,
        readOnly: true,
        rows: [{ gsisId: "00-001", playerName: "Alpha Player", playerId: "00-001", sleeperId: null, normalizedName: "alphaplayer", position: "QB", team: "KC", status: "active", rosterStatus: null, depthChartPosition: null, depthChartOrder: null, source: "unit", sourceUpdatedAt: null, notes: null, matchKey: "gsis:00-001" }],
      } as never,
      rookieTeamConfirmationSource: null,
    });

    expect(report.summary.confirmedRows).toBe(1);
    expect(report.rows[0]).toMatchObject({
      status: "crosswalk_confirmed",
      crosswalkGsisId: "00-001",
      integrationPreview: "use_current_roster_source",
    });
    expect(report.rows[0].reasonCodes).toContain("sleeper_metadata_gsis_bridge");
  });

  it("flags conflicting exact CSV and snapshot mappings", () => {
    const report = buildProjectionPlayerIdCrosswalkReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      rookieNewTargetDiagnostics: diagnosticsReport([targetRow({ playerId: "s1", sleeperId: "s1", gsisId: "00-001", player: "Alpha Player" })]),
      playerIdCrosswalkSource: crosswalkReport([{ sleeperId: "s1", gsisId: "00-999", confidence: "source_declared" }]),
      sleeperPlayers: [],
      currentRosterSource: null,
      rookieTeamConfirmationSource: null,
    });

    expect(report.rows[0].status).toBe("crosswalk_conflict");
    expect(report.rows[0].integrationPreview).toBe("manual_review");
  });

  it("keeps name/team/position evidence as review-only", () => {
    const report = buildProjectionPlayerIdCrosswalkReviewFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      rookieNewTargetDiagnostics: diagnosticsReport([
        targetRow({
          playerId: "s1",
          sleeperId: "s1",
          gsisId: null,
          player: "Alpha Player",
          sourceRowMatchCandidates: {
            currentRoster: [{
              source: "current_roster",
              playerId: null,
              sleeperId: null,
              gsisId: "00-001",
              playerName: "Alpha Player",
              normalizedName: "alphaplayer",
              position: "QB",
              team: "KC",
              status: "active",
              matchKind: "name_position_team",
              positionFamilyDiagnostic: "position_family_exact",
            }],
            rookieTeam: [],
          },
        }),
      ]),
      playerIdCrosswalkSource: null,
      sleeperPlayers: [],
      currentRosterSource: null,
      rookieTeamConfirmationSource: null,
    });

    expect(report.rows[0]).toMatchObject({
      status: "crosswalk_review_candidate",
      confidence: "name_team_position",
      integrationPreview: "manual_review",
    });
    expect(report.safetyGates.find((gate) => gate.name === "name_team_position_not_confirmed")?.passed).toBe(true);
  });
});

function diagnosticsReport(rows: ProjectionRookieNewTargetDiagnosticsRow[]): ProjectionRookieNewTargetDiagnosticsReport {
  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    rows,
  } as ProjectionRookieNewTargetDiagnosticsReport;
}

function targetRow(overrides: Partial<ProjectionRookieNewTargetDiagnosticsRow>): ProjectionRookieNewTargetDiagnosticsRow {
  return {
    playerId: "s1",
    sleeperId: "s1",
    gsisId: null,
    player: "Alpha Player",
    normalizedName: "alphaplayer",
    position: "QB",
    team: "KC",
    sourceRowMatchCandidates: { currentRoster: [], rookieTeam: [] },
    currentRosterMatchStatus: "not_in_current_roster_confirmation",
    rookieConfirmationMatchStatus: "not_in_rookie_confirmation",
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

function sleeperPlayer(overrides: Partial<SleeperNormalizedPlayer> & { sleeperId: string; gsisId: string; playerName: string }): SleeperNormalizedPlayer {
  const { gsisId, sleeperId, playerName, ...playerOverrides } = overrides;
  return {
    sleeperId,
    playerName,
    firstName: null,
    lastName: null,
    searchFullName: null,
    position: "QB",
    rawPosition: "QB",
    fantasyPositions: ["QB"],
    team: "KC",
    status: "Active",
    active: true,
    age: null,
    birthDate: null,
    height: null,
    weight: null,
    college: null,
    yearsExperience: null,
    injuryStatus: null,
    searchRank: null,
    externalIds: { gsis_id: gsisId },
    ...playerOverrides,
  };
}

function crosswalkReport(rows: Array<{ sleeperId: string; gsisId: string; confidence: "source_declared" | "exact_id" }>): PlayerIdCrosswalkSourceReport {
  return {
    dryRun: true,
    readOnly: true,
    rows: rows.map((row) => ({
      sleeperId: row.sleeperId,
      gsisId: row.gsisId,
      playerId: row.gsisId,
      playerName: "Alpha Player",
      normalizedName: "alphaplayer",
      position: "QB",
      team: "KC",
      source: "unit",
      sourceUpdatedAt: null,
      confidence: row.confidence,
      notes: null,
      matchKey: `${row.sleeperId}|${row.gsisId}`,
    })),
  } as PlayerIdCrosswalkSourceReport;
}
