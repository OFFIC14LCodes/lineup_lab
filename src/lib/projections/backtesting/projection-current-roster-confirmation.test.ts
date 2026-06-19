import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionCurrentRosterConfirmationFromData,
  writeProjectionCurrentRosterConfirmationArtifacts,
} from "./projection-current-roster-confirmation";

import type { CurrentRosterSourceReport } from "@/lib/data-acquisition/current-roster-source-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type { ProjectionActiveUniverseGateReport, ProjectionActiveUniverseGateRow } from "./projection-active-universe-gate-types";
import type { ProjectionCurrentRosterConfirmationInput } from "./projection-current-roster-confirmation-types";

describe("projection current roster confirmation", () => {
  it("generates a source-missing report without failing hard", () => {
    const report = buildProjectionCurrentRosterConfirmationFromData({ ...fixtureInput(), currentRosterSource: null });

    expect(report.sourceStatus).toBe("missing");
    expect(report.summary.totalProjectionRows).toBe(6);
    expect(report.summary.matchedRows).toBe(0);
    expect(report.summary.unmatchedRows).toBe(6);
    expect(report.rows.every((row) => row.confirmationStatus === "roster_source_missing")).toBe(true);
    expect(report.rows.every((row) => row.reasonCodes.includes("source_missing"))).toBe(true);
  });

  it("matches by player id, sleeper id, gsis id, and name/team/position fallback", () => {
    const report = buildProjectionCurrentRosterConfirmationFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Player Id Match")?.reasonCodes).toContain("matched_by_player_id");
    expect(report.rows.find((row) => row.player === "Sleeper Match")?.reasonCodes).toContain("matched_by_sleeper_id");
    expect(report.rows.find((row) => row.player === "Gsis Match")?.reasonCodes).toContain("matched_by_gsis_id");
    expect(report.rows.find((row) => row.player === "Fallback Match")?.reasonCodes).toContain("matched_by_name_team_position");
  });

  it("assigns confirmation statuses and conflicts", () => {
    const report = buildProjectionCurrentRosterConfirmationFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Player Id Match")?.confirmationStatus).toBe("roster_confirmed_active");
    expect(report.rows.find((row) => row.player === "Sleeper Match")?.confirmationStatus).toBe("roster_confirmed_ir_pup_nfi");
    expect(report.rows.find((row) => row.player === "Gsis Match")?.confirmationStatus).toBe("roster_confirmed_free_agent");
    expect(report.rows.find((row) => row.player === "Fallback Match")?.confirmationStatus).toBe("roster_confirmed_non_active");
    expect(report.rows.find((row) => row.player === "Conflict Match")?.confirmationStatus).toBe("roster_conflict");
    expect(report.rows.find((row) => row.player === "Unmatched Player")?.confirmationStatus).toBe("roster_unmatched");
  });

  it("summarizes H16 integration preview and no live mutation gates", () => {
    const report = buildProjectionCurrentRosterConfirmationFromData(fixtureInput());

    expect(report.summary).toMatchObject({
      totalProjectionRows: 6,
      rosterSourceRows: 5,
      matchedRows: 5,
      unmatchedRows: 1,
      confirmedActive: 1,
      confirmedNonActive: 1,
      confirmedFreeAgent: 1,
      confirmedIrPupNfi: 1,
      conflicts: 1,
    });
    expect(report.h16IntegrationPreview).toMatchObject({
      activeConfirmedIncrease: 0,
      activeConfirmedDecrease: 0,
      staleStatusReviewResolved: 1,
      legacyArchiveBlockedConfirmed: 1,
      manualReviewRequiredResolved: 1,
      kickerPolicyUnaffected: 1,
    });
    [
      "no_live_outputs_changed",
      "no_supabase_writes",
      "rankings_unchanged",
      "draft_suggestions_unchanged",
      "war_room_scoring_unchanged",
      "v82_not_enabled",
    ].forEach((name) => expect(report.safetyGates.find((gate) => gate.name === name)?.passed).toBe(true));
  });

  it("writes confirmation artifacts", () => {
    const report = buildProjectionCurrentRosterConfirmationFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2096, includeIdp: true },
    });
    const artifacts = writeProjectionCurrentRosterConfirmationArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-current-roster-confirmation-2096.json");
      expect(artifacts.markdownPath).toContain("projection-current-roster-confirmation-2096.md");
      expect(artifacts.csvPath).toContain("projection-current-roster-confirmation-2096.csv");
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

function fixtureInput(): ProjectionCurrentRosterConfirmationInput {
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    preseasonProjectionSnapshot: snapshot(),
    activeUniverseGate: activeGate(),
    currentRosterSource: rosterSource(),
  };
}

function snapshot(): PreseasonProjectionSnapshot {
  return {
    rows: [
      snapshotRow("p1", "p1", "g1", "Player Id Match", "WR", "KC"),
      snapshotRow("p2", "p2", "g2", "Sleeper Match", "RB", "BUF"),
      snapshotRow("p3", "p3", "g3", "Gsis Match", "QB", "FA"),
      snapshotRow("p4", "p4", "g4", "Fallback Match", "LB", "DAL"),
      snapshotRow("p5", "p5", "g5", "Conflict Match", "TE", "NYG"),
      snapshotRow("p6", "p6", "g6", "Unmatched Player", "K", "MIA"),
    ],
  } as PreseasonProjectionSnapshot;
}

function activeGate(): ProjectionActiveUniverseGateReport {
  return {
    rows: [
      gateRow("p1", "Player Id Match", "WR", "KC", "active_confirmed", "eligible_for_projection_promotion"),
      gateRow("p2", "Sleeper Match", "RB", "BUF", "stale_status_review", "shadow_only"),
      gateRow("p3", "Gsis Match", "QB", "FA", "legacy_archive_blocked", "blocked_from_promotion"),
      gateRow("p4", "Fallback Match", "LB", "DAL", "manual_review_required", "manual_review_before_promotion"),
      gateRow("p5", "Conflict Match", "TE", "NYG", "low_confidence_plausible", "eligible_for_projection_promotion"),
      gateRow("p6", "Unmatched Player", "K", "MIA", "kicker_policy_review", "shadow_only"),
    ],
  } as ProjectionActiveUniverseGateReport;
}

function rosterSource(): CurrentRosterSourceReport {
  return {
    rows: [
      rosterRow({ playerId: "p1", sleeperId: null, gsisId: null, playerName: "Player Id Match", position: "WR", team: "KC", status: "active" }),
      rosterRow({ playerId: null, sleeperId: "p2", gsisId: null, playerName: "Sleeper Match", position: "RB", team: "BUF", status: "pup" }),
      rosterRow({ playerId: null, sleeperId: null, gsisId: "g3", playerName: "Gsis Match", position: "QB", team: "FA", status: "free_agent" }),
      rosterRow({ playerId: null, sleeperId: null, gsisId: null, playerName: "Fallback Match", position: "LB", team: "DAL", status: "retired" }),
      rosterRow({ playerId: "p5", sleeperId: null, gsisId: null, playerName: "Conflict Match", position: "TE", team: "PHI", status: "active" }),
    ],
  } as CurrentRosterSourceReport;
}

function snapshotRow(playerId: string, sleeperId: string, gsisId: string, playerName: string, position: string, team: string): PreseasonProjectionSnapshotRow {
  return {
    sleeperId,
    gsisId,
    playerName,
    normalizedName: playerName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    position,
    team,
  } as PreseasonProjectionSnapshotRow;
}

function gateRow(
  playerId: string,
  player: string,
  position: string,
  team: string,
  gateStatus: ProjectionActiveUniverseGateRow["gateStatus"],
  promotionEligibilityClassification: ProjectionActiveUniverseGateRow["promotionEligibilityClassification"],
): ProjectionActiveUniverseGateRow {
  return {
    playerId,
    player,
    position,
    team,
    gateStatus,
    promotionEligibilityClassification,
  } as ProjectionActiveUniverseGateRow;
}

function rosterRow(input: {
  playerId: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  position: string;
  team: string;
  status: CurrentRosterSourceReport["rows"][number]["status"];
}): CurrentRosterSourceReport["rows"][number] {
  return {
    ...input,
    normalizedName: input.playerName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    rosterStatus: input.status,
    depthChartPosition: input.position,
    depthChartOrder: null,
    source: "fixture",
    sourceUpdatedAt: "2026-06-18",
    notes: null,
    matchKey: input.playerId ? `player:${input.playerId}` : "fallback",
  };
}
