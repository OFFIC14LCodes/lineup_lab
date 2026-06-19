import { existsSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { SleeperPlayerMetadataReport, SleeperPlayerMetadataRow } from "@/lib/data-acquisition/sleeper-player-metadata-source-types";

import {
  buildProjectionSleeperMetadataResolutionFromData,
  writeProjectionSleeperMetadataResolutionArtifacts,
} from "./projection-sleeper-metadata-resolution";
import type { ProjectionCrosswalkUnmatchedReport, ProjectionCrosswalkUnmatchedRow } from "./projection-crosswalk-unmatched-classification-types";
import type { ProjectionSleeperMetadataResolutionInput } from "./projection-sleeper-metadata-resolution-types";

describe("projection sleeper metadata resolution", () => {
  it("joins by exact Sleeper ID and classifies active plausible rows", () => {
    const report = buildProjectionSleeperMetadataResolutionFromData(input({
      h26Rows: [h26Row({ playerId: "s1", sleeperId: "s1", position: "QB", projectionTeam: "KC" })],
      metadataRows: [metadataRow({ sleeperId: "s1", position: "QB", team: "KC", active: true, normalizedStatus: "active" })],
    }));

    expect(report.rows[0]).toMatchObject({
      resolutionStatus: "sleeper_metadata_active_plausible",
      policyPreview: "policy_active_candidate",
      metadataTeam: "KC",
    });
    expect(report.rows[0].reasonCodes).toEqual(expect.arrayContaining(["exact_sleeper_id_match", "sleeper_active_true", "sleeper_position_matches"]));
    expect(report.summary.activePlausible).toBe(1);
  });

  it("classifies inactive and stale metadata", () => {
    const report = buildProjectionSleeperMetadataResolutionFromData(input({
      h26Rows: [h26Row({ playerId: "s1", sleeperId: "s1" })],
      metadataRows: [metadataRow({ sleeperId: "s1", active: false, normalizedStatus: "inactive" })],
    }));

    expect(report.rows[0].resolutionStatus).toBe("sleeper_metadata_inactive_or_stale");
    expect(report.rows[0].policyPreview).toBe("policy_shadow_only");
    expect(report.summary.inactiveOrStale).toBe(1);
  });

  it("detects position and team conflicts", () => {
    const positionConflict = buildProjectionSleeperMetadataResolutionFromData(input({
      h26Rows: [h26Row({ playerId: "s1", sleeperId: "s1", position: "QB" })],
      metadataRows: [metadataRow({ sleeperId: "s1", position: "WR", fantasyPositions: ["WR"], team: "KC" })],
    }));
    const teamConflict = buildProjectionSleeperMetadataResolutionFromData(input({
      h26Rows: [h26Row({ playerId: "s2", sleeperId: "s2", position: "QB", projectionTeam: "KC" })],
      metadataRows: [metadataRow({ sleeperId: "s2", position: "QB", team: "DAL" })],
    }));

    expect(positionConflict.rows[0].resolutionStatus).toBe("sleeper_metadata_position_conflict");
    expect(teamConflict.rows[0].resolutionStatus).toBe("sleeper_metadata_team_conflict");
    expect(teamConflict.rows[0].policyPreview).toBe("policy_manual_review");
  });

  it("handles missing metadata and summarizes v8.2 held-back impact", () => {
    const report = buildProjectionSleeperMetadataResolutionFromData(input({
      h26Rows: [h26Row({ playerId: "s1", sleeperId: "s1" })],
      metadataRows: [],
    }));

    expect(report.rows[0].resolutionStatus).toBe("sleeper_metadata_missing");
    expect(report.summary.missingMetadata).toBe(1);
    expect(report.v82Impact.safeRowsStillHeldBack).toBe(1);
    expect(report.v82Impact.protectedZeroChecks.kRowsUsingV82).toBe(true);
    expect(report.v82Impact.unblocksControlledFlagReview).toBe(false);
  });

  it("writes artifacts and preserves dry-run gates", () => {
    const report = buildProjectionSleeperMetadataResolutionFromData(input({
      options: { projectionSeason: 2097, includeIdp: true },
      h26Rows: [h26Row({ playerId: "s1", sleeperId: "s1" })],
      metadataRows: [metadataRow({ sleeperId: "s1" })],
    }));
    const artifacts = writeProjectionSleeperMetadataResolutionArtifacts(report);
    try {
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.readOnly).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "only_exact_sleeper_id_join")?.passed).toBe(true);
    } finally {
      for (const artifactPath of Object.values(artifacts)) {
        if (existsSync(artifactPath)) unlinkSync(artifactPath);
      }
    }
  });
});

function input(overrides: {
  options?: { projectionSeason: number; includeIdp: boolean };
  h26Rows: ProjectionCrosswalkUnmatchedRow[];
  metadataRows: SleeperPlayerMetadataRow[];
}): ProjectionSleeperMetadataResolutionInput {
  return {
    options: overrides.options ?? { projectionSeason: 2026, includeIdp: true },
    crosswalkUnmatchedClassification: {
      dryRun: true,
      readOnly: true,
      rows: overrides.h26Rows,
    } as ProjectionCrosswalkUnmatchedReport,
    sleeperPlayerMetadataSource: {
      dryRun: true,
      readOnly: true,
      normalizedRows: overrides.metadataRows.length,
      rows: overrides.metadataRows,
    } as SleeperPlayerMetadataReport,
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
  };
}

function h26Row(overrides: Partial<ProjectionCrosswalkUnmatchedRow>): ProjectionCrosswalkUnmatchedRow {
  return {
    playerId: "s1",
    sleeperId: "s1",
    crosswalkGsisId: "00-001",
    player: "Alpha Player",
    normalizedName: "alphaplayer",
    position: "QB",
    projectionTeam: "KC",
    h23IdentityClass: "sleeper_only_player",
    h21PolicyGroup: "unmatched_rookie_new_review",
    h21RecommendedPolicyAction: "needs_rookie_team_confirmation",
    originalPolicyClassification: "policy_source_expansion_required",
    lastActiveSeason: null,
    v82SafeSubsetStatus: "v82_safe_subset",
    projectedTotalPointDelta: 10,
    estimatedOverallRankMovement: 5,
    classification: "needs_sleeper_status_source",
    reasonCodes: ["exact_crosswalk_confirmed", "sleeper_only_status_needed"],
    h21PolicyPreview: "policy_source_expansion_required",
    sourcePriority: "sleeper_player_metadata_source",
    h25Row: null as never,
    h23Row: null,
    policyRow: null,
    snapshotRow: null,
    ...overrides,
  };
}

function metadataRow(overrides: Partial<SleeperPlayerMetadataRow>): SleeperPlayerMetadataRow {
  return {
    sleeperId: "s1",
    playerName: "Alpha Player",
    firstName: "Alpha",
    lastName: "Player",
    position: "QB",
    team: "KC",
    status: "Active",
    normalizedStatus: "active",
    active: true,
    injuryStatus: null,
    fantasyPositions: ["QB"],
    searchRank: 100,
    yearsExperience: 2,
    age: 24,
    source: "unit",
    sourceUpdatedAt: null,
    notes: null,
    ...overrides,
  };
}
