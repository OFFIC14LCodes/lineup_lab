import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildProjectionRookieTeamConfirmationFromData,
  normalizeProjectionRookieName,
  writeProjectionRookieTeamConfirmationArtifacts,
} from "./projection-rookie-team-confirmation";

import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionRosterRefreshPolicyReviewRow } from "./projection-roster-refresh-policy-review-types";

describe("projection rookie team confirmation", () => {
  it("normalizes names for deterministic matching", () => {
    expect(normalizeProjectionRookieName("A.J. Smith Jr.")).toBe("ajsmith");
    expect(normalizeProjectionRookieName("D'Andre Test-Smith III")).toBe("dandretestsmith");
    expect(normalizeProjectionRookieName("  Player   IV  ")).toBe("player");
  });

  it("reports missing source without mutating live behavior", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput({ rookieSource: null }));

    expect(report.sourceMissing).toBe(true);
    expect(report.recommendation).toBe("rookie_team_confirmation_source_missing");
    expect(report.summary.targetRookieNewUnmatchedRows).toBe(7);
    expect(report.summary.byStatus.rookie_team_source_missing).toBe(7);
    expect(report.h21IntegrationPreview.wouldMoveTo.policy_source_expansion_required).toBe(7);
    expect(report.safetyGates.find((gate) => gate.name === "no_live_outputs_changed")?.passed).toBe(true);
    expect(report.safetyGates.find((gate) => gate.name === "v8_2_not_enabled")?.passed).toBe(true);
  });

  it("matches rookies by ids and fallback name/position", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput());

    expect(report.rows.find((row) => row.player === "Id Rookie")?.rookieTeamStatus).toBe("rookie_team_confirmed");
    expect(report.rows.find((row) => row.player === "Id Rookie")?.matchReason).toBe("player_id");
    expect(report.rows.find((row) => row.player === "Sleeper Rookie")?.matchReason).toBe("sleeper_id");
    expect(report.rows.find((row) => row.player === "Fallback Rookie")?.rookieTeamStatus).toBe("rookie_team_confirmed");
    expect(report.rows.find((row) => row.player === "Fallback Rookie")?.matchReason).toBe("name_position");
    expect(report.rows.find((row) => row.player === "Team Match Jr.")?.rookieTeamStatus).toBe("rookie_team_confirmed");
    expect(report.rows.find((row) => row.player === "Team Match Jr.")?.matchReason).toBe("name_position");
  });

  it("detects team conflicts and keeps them manual-review in preview", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput());
    const conflict = report.rows.find((row) => row.player === "Conflict Rookie");

    expect(conflict?.rookieTeamStatus).toBe("rookie_team_conflict");
    expect(conflict?.sourceTeam).toBe("DAL");
    expect(conflict?.previewPolicyClassification).toBe("policy_manual_review");
    expect(report.summary.teamConflictRows).toBe(1);
    expect(report.recommendation).toBe("rookie_team_confirmation_needs_review");
  });

  it("keeps name-only mismatches and ambiguous matches out of confirmed rows", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput());
    const review = report.rows.find((row) => row.player === "Review Rookie");
    const ambiguous = report.rows.find((row) => row.player === "Ambiguous Rookie");

    expect(review?.rookieTeamStatus).toBe("rookie_team_review_candidate");
    expect(review?.matchReason).toBe("name_team");
    expect(review?.previewPolicyClassification).toBe("policy_manual_review");
    expect(ambiguous?.rookieTeamStatus).toBe("rookie_team_ambiguous_match");
    expect(ambiguous?.previewPolicyClassification).toBe("policy_manual_review");
  });

  it("reports diagnostic counts and examples", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput());

    expect(report.matchDiagnostics.targetFieldCounts.withPlayerId).toBe(7);
    expect(report.matchDiagnostics.sourceFieldCounts.withNflTeam).toBe(8);
    expect(report.matchDiagnostics.candidateMatchCounts.byNormalizedPlayerName).toBe(7);
    expect(report.matchDiagnostics.candidateMatchCounts.byNormalizedPlayerNamePosition).toBeGreaterThan(0);
    expect(report.matchDiagnostics.candidateMatchCounts.byNormalizedPlayerNameTeam).toBeGreaterThan(0);
    expect(report.matchDiagnostics.examples.topTargetRows.length).toBeGreaterThan(0);
    expect(report.matchDiagnostics.examples.topSourceRows.length).toBeGreaterThan(0);
    expect(report.matchDiagnostics.examples.normalizedNameOverlaps.length).toBeGreaterThan(0);
    expect(report.matchDiagnostics.examples.nameOnlyMatchesRejected.map((row) => row.target.player)).toContain("Review Rookie");
  });

  it("summarizes H21 integration preview", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput());

    expect(report.summary).toMatchObject({
      targetRookieNewUnmatchedRows: 7,
      sourceRows: 8,
      matchedRows: 7,
      confirmedTeamRows: 4,
      teamConflictRows: 1,
      ambiguousMatchRows: 1,
      reviewCandidateRows: 1,
      invalidSourceRows: 1,
    });
    expect(report.h21IntegrationPreview.wouldMoveTo.policy_active_candidate).toBe(4);
    expect(report.h21IntegrationPreview.wouldMoveTo.policy_manual_review).toBe(3);
    expect(report.h21IntegrationPreview.wouldMoveTo.policy_source_expansion_required).toBe(0);
    expect(report.summary.byV82SafeSubset.v82_safe_subset.rookie_team_confirmed).toBe(3);
  });

  it("only targets rookie/new unmatched rows", () => {
    const report = buildProjectionRookieTeamConfirmationFromData(fixtureInput());

    expect(report.rows.map((row) => row.policyGroup)).toEqual([
      "unmatched_rookie_new_review",
      "unmatched_rookie_new_review",
      "unmatched_rookie_new_review",
      "unmatched_rookie_new_review",
      "unmatched_rookie_new_review",
      "unmatched_rookie_new_review",
      "unmatched_rookie_new_review",
    ]);
    expect(report.safetyGates.find((gate) => gate.name === "only_rookie_new_unmatched_targeted")?.passed).toBe(true);
    expect(report.notes.join(" ")).toContain("H21 policy behavior is not changed");
  });

  it("writes confirmation artifacts", () => {
    const report = buildProjectionRookieTeamConfirmationFromData({
      ...fixtureInput(),
      options: { projectionSeason: 2094, includeIdp: true },
    });
    const artifacts = writeProjectionRookieTeamConfirmationArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("projection-rookie-team-confirmation-2094.json");
      expect(artifacts.markdownPath).toContain("projection-rookie-team-confirmation-2094.md");
      expect(artifacts.csvPath).toContain("projection-rookie-team-confirmation-2094.csv");
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

function fixtureInput(options: { rookieSource?: RookieTeamConfirmationSourceReport | null } = {}) {
  const rows: ProjectionActiveUniversePolicyPacketRow[] = [
    policyRow("p1", "Id Rookie", "WR", "KC", "would_use_v8_2_safe_subset"),
    policyRow("s2", "Sleeper Rookie", "RB", "BUF", "would_use_v8_2_safe_subset"),
    policyRow("p3", "Fallback Rookie", "TE", "CHI", "excluded_or_blocked"),
    policyRow("p4", "Conflict Rookie", "LB", "PHI", "excluded_or_blocked"),
    policyRow("p5", "Team Match Jr.", "WR", "SF", "would_use_v8_2_safe_subset"),
    policyRow("p6", "Review Rookie", "DB", "NYG", "excluded_or_blocked"),
    policyRow("p7", "Ambiguous Rookie", "WR", "SEA", "excluded_or_blocked"),
    {
      ...policyRow("vet", "Veteran", "WR", "DAL", "excluded_or_blocked"),
      policyGroup: "confirmed_active_clear",
      policyClassification: "policy_active_candidate",
    },
  ];
  return {
    options: { projectionSeason: 2026, includeIdp: true },
    policyPacket: {
      dryRun: true,
      readOnly: true,
      projectionSeason: 2026,
      includeIdp: true,
      rows,
      recommendation: "active_policy_ready_for_source_expansion",
    } as ProjectionActiveUniversePolicyPacketReport,
    rosterRefresh: {} as ProjectionActiveUniverseGateRosterRefreshReport,
    preseasonProjectionSnapshot: {
      metadata: {},
      diagnostics: {},
      rows: [
        {
          sleeperId: "s2",
          gsisId: null,
          playerName: "Sleeper Rookie",
          normalizedName: "sleeperrookie",
          position: "RB",
        },
      ],
    } as never,
    rookieTeamConfirmationSource: options.rookieSource === undefined ? rookieSource() : options.rookieSource,
  };
}

function policyRow(
  playerId: string,
  player: string,
  position: string,
  projectionTeam: string,
  v82Path: ProjectionRosterRefreshPolicyReviewRow["v82Path"],
): ProjectionActiveUniversePolicyPacketRow {
  return {
    playerId,
    player,
    position,
    projectionTeam,
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
    projectedTotalPointDelta: null,
    criticalMovement: false,
    estimatedOverallRankMovement: null,
    policyClassification: "policy_source_expansion_required",
    policyReasonCodes: ["unmatched_rookie_needs_team_confirmation"],
  };
}

function rookieSource(): RookieTeamConfirmationSourceReport {
  const rows = [
    sourceRow({ playerId: "p1", playerName: "Id Rookie", position: "WR", nflTeam: "KC" }),
    sourceRow({ sleeperId: "s2", playerName: "Sleeper Rookie", position: "RB", nflTeam: "BUF" }),
    sourceRow({ playerName: "Fallback Rookie", position: "TE", nflTeam: "CHI" }),
    sourceRow({ playerId: "p4", playerName: "Conflict Rookie", position: "LB", nflTeam: "DAL" }),
    sourceRow({ playerName: "Team Match", position: "WR", nflTeam: "SF" }),
    sourceRow({ playerName: "Review Rookie", position: "LB", nflTeam: "NYG" }),
    sourceRow({ playerName: "Ambiguous Rookie", position: "WR", nflTeam: "SEA", draftPick: 1 }),
    sourceRow({ playerName: "Ambiguous Rookie", position: "WR", nflTeam: "SEA", draftPick: 2 }),
  ];
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season: 2026,
    inputPath: "fixture.csv",
    sourceRows: 9,
    normalizedRows: 8,
    duplicateRowsRemoved: 0,
    invalidRows: 1,
    missingIdentifierRows: 1,
    positionCounts: {},
    teamCounts: {},
    rows,
    issues: [],
    notes: [],
  };
}

function sourceRow(values: Partial<RookieTeamConfirmationSourceRow>): RookieTeamConfirmationSourceRow {
  const playerName = values.playerName ?? "Rookie";
  const position = values.position ?? "WR";
  const normalizedName = playerName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    playerId: null,
    sleeperId: null,
    gsisId: null,
    playerName,
    normalizedName,
    position,
    college: null,
    normalizedCollege: null,
    nflTeam: "KC",
    draftClub: null,
    draftRound: null,
    draftPick: null,
    source: "fixture",
    sourceUpdatedAt: null,
    notes: null,
    matchKey: `name_position:${normalizedName}|${position}`,
    ...values,
  };
}
