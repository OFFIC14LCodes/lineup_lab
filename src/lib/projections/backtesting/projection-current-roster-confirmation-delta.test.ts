import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionCurrentRosterConfirmationDeltaFromData,
  writeProjectionCurrentRosterConfirmationDeltaArtifacts,
} from "./projection-current-roster-confirmation-delta";

import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";

describe("projection current roster confirmation delta", () => {
  it("reports real-source missing with next command", () => {
    const report = buildProjectionCurrentRosterConfirmationDeltaFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      before: confirmation({ sourceStatus: "missing", matchedRows: 0, unmatchedRows: 10 }),
      after: confirmation({ sourceStatus: "present", matchedRows: 3, unmatchedRows: 7, confirmedActive: 2, confirmedNonActive: 1, legacyArchiveBlockedConfirmed: 1 }),
      realSourceCsvExists: false,
    });

    expect(report.realSourceStatus).toBe("real_source_missing");
    expect(report.nextCommand).toBe("npm run data:current-rosters:normalize -- --season=2026 --input=data/current-rosters/current-rosters-2026.csv");
    expect(report.delta.matchedRows).toBe(3);
    expect(report.delta.unmatchedRows).toBe(-3);
    expect(report.delta.legacyArchiveConfirmed).toBe(1);
  });

  it("summarizes before/after delta and safety gates", () => {
    const report = buildProjectionCurrentRosterConfirmationDeltaFromData({
      options: { projectionSeason: 2026, includeIdp: true },
      before: confirmation({ sourceStatus: "missing", matchedRows: 0, unmatchedRows: 10 }),
      after: confirmation({ sourceStatus: "present", matchedRows: 5, unmatchedRows: 5, confirmedActive: 3, confirmedFreeAgent: 1, staleStatusReviewResolved: 2, manualReviewRequiredResolved: 1, kRowsWithRosterDepthStatus: 1 }),
      realSourceCsvExists: true,
    });

    expect(report.realSourceStatus).toBe("real_source_present");
    expect(report.nextCommand).toBe(null);
    expect(report.delta).toMatchObject({
      matchedRows: 5,
      unmatchedRows: -5,
      confirmedActive: 3,
      confirmedFreeAgent: 1,
      staleReviewResolved: 2,
      manualReviewResolved: 1,
      kRowsWithRosterDepthStatus: 1,
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

  it("writes delta artifacts", () => {
    const report = buildProjectionCurrentRosterConfirmationDeltaFromData({
      options: { projectionSeason: 2095, includeIdp: true },
      before: confirmation({ sourceStatus: "missing", matchedRows: 0, unmatchedRows: 10 }),
      after: confirmation({ sourceStatus: "present", matchedRows: 1, unmatchedRows: 9 }),
      realSourceCsvExists: false,
    });
    const artifacts = writeProjectionCurrentRosterConfirmationDeltaArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-current-roster-confirmation-delta-2095.json");
      expect(artifacts.markdownPath).toContain("projection-current-roster-confirmation-delta-2095.md");
      expect(artifacts.csvPath).toContain("projection-current-roster-confirmation-delta-2095.csv");
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

function confirmation(input: {
  sourceStatus: ProjectionCurrentRosterConfirmationReport["sourceStatus"];
  matchedRows: number;
  unmatchedRows: number;
  confirmedActive?: number;
  confirmedNonActive?: number;
  confirmedFreeAgent?: number;
  confirmedIrPupNfi?: number;
  conflicts?: number;
  legacyArchiveBlockedConfirmed?: number;
  staleStatusReviewResolved?: number;
  manualReviewRequiredResolved?: number;
  kRowsWithRosterDepthStatus?: number;
}): ProjectionCurrentRosterConfirmationReport {
  return {
    sourceStatus: input.sourceStatus,
    summary: {
      totalProjectionRows: input.matchedRows + input.unmatchedRows,
      rosterSourceRows: input.matchedRows,
      matchedRows: input.matchedRows,
      unmatchedRows: input.unmatchedRows,
      confirmedActive: input.confirmedActive ?? 0,
      confirmedNonActive: input.confirmedNonActive ?? 0,
      confirmedFreeAgent: input.confirmedFreeAgent ?? 0,
      confirmedIrPupNfi: input.confirmedIrPupNfi ?? 0,
      conflicts: input.conflicts ?? 0,
      byPosition: {},
      byH16ActiveGateStatus: {},
      byPromotionClassification: {},
    },
    h16IntegrationPreview: {
      activeConfirmedIncrease: input.confirmedActive ?? 0,
      activeConfirmedDecrease: 0,
      staleStatusReviewResolved: input.staleStatusReviewResolved ?? 0,
      legacyArchiveBlockedConfirmed: input.legacyArchiveBlockedConfirmed ?? 0,
      manualReviewRequiredResolved: input.manualReviewRequiredResolved ?? 0,
      kickerPolicyUnaffected: 0,
      note: "fixture",
    },
    rows: Array.from({ length: input.kRowsWithRosterDepthStatus ?? 0 }, (_, index) => ({
      playerId: `k${index}`,
      activeGateStatus: "kicker_policy_review",
      rosterStatus: "active",
    })),
  } as ProjectionCurrentRosterConfirmationReport;
}
