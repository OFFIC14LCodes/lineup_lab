import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildUniverseRows,
  runHistoricalDraftUniverseBuilder,
  writeHistoricalDraftUniverseArtifacts,
} from "./historical-draft-universe-builder";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";

describe("historical draft universe builder", () => {
  it("reports source discovery summary", () => {
    const cwd = setupWorkspace();
    try {
      writeSnapshot(cwd, snapshot([snapshotRow({ playerName: "One QB", position: "QB", gsisId: "00-1", sleeperId: "s1" })]));

      const report = runHistoricalDraftUniverseBuilder({ season: 2025, cwd });

      expect(report.sourceDiscovery.preseasonProjectionSnapshot).toMatchObject({
        exists: true,
        rows: 1,
        playersWithPlayerId: 1,
        playersWithSleeperId: 1,
        playersWithGsisId: 1,
      });
      expect(report.sourceDiscovery.preseasonProjectionSnapshot.projectionFieldsAvailable).toContain("projectedTotalPoints");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("normalizes universe rows and creates preseason-safe fallback ranks", () => {
    const rows = buildUniverseRows(snapshot([
      snapshotRow({ playerName: "Low WR", position: "WR", projectedTotalPoints: 100, gsisId: "00-low" }),
      snapshotRow({ playerName: "High WR", position: "WR", projectedTotalPoints: 200, gsisId: "00-high" }),
    ]), { season: 2025, includeIdp: false, includeK: false, includeDst: false });

    expect(rows.map((row) => row.player_name)).toEqual(["High WR", "Low WR"]);
    expect(rows[0]).toMatchObject({
      player_id: "00-high",
      position: "WR",
      projection_points: 200,
      blackbird_rank: 1,
      blackbird_rank_fallback: 1,
    });
    expect(rows[0].notes).toContain("blackbird_rank_fallback_from_projected_points");
  });

  it("filters IDP, kickers, and DST unless explicitly included", () => {
    const baseRows = [
      snapshotRow({ playerName: "QB", position: "QB", gsisId: "00-qb" }),
      snapshotRow({ playerName: "LB", position: "LB", gsisId: "00-lb" }),
      snapshotRow({ playerName: "K", position: "K", gsisId: "00-k" }),
      snapshotRow({ playerName: "DST", position: "DST", gsisId: "00-dst" }),
    ];

    const offense = buildUniverseRows(snapshot(baseRows), { season: 2025, includeIdp: false, includeK: false, includeDst: false });
    const all = buildUniverseRows(snapshot(baseRows), { season: 2025, includeIdp: true, includeK: true, includeDst: true });

    expect(offense.map((row) => row.position)).toEqual(["QB"]);
    expect(all.map((row) => row.position).sort()).toEqual(["DST", "K", "LB", "QB"]);
  });

  it("previews weekly result identifier coverage without joining outcome points", () => {
    const cwd = setupWorkspace();
    try {
      writeSnapshot(cwd, snapshot([
        snapshotRow({ playerName: "Exact QB", position: "QB", gsisId: "00-exact" }),
        snapshotRow({ playerName: "Fallback Runner", position: "RB", gsisId: "00-missing" }),
      ]));
      writeWeekly(cwd, [
        { week: 1, player_id: "00-exact", gsis_id: "00-exact", player_name: "Exact QB", position: "QB", fantasy_points: 20 },
        { week: 1, player_id: "other", gsis_id: "other", player_name: "Fallback Runner", position: "RB", fantasy_points: 10 },
      ]);

      const report = runHistoricalDraftUniverseBuilder({ season: 2025, cwd });

      expect(report.identifierCoveragePreview).toMatchObject({
        universePlayers: 2,
        playersWithWeeklyResultExactIdMatch: 1,
        playersWithWeeklyResultNamePositionFallback: 1,
        playersMissingWeeklyOutcome: 0,
      });
      expect(report.rows[0]).not.toHaveProperty("fantasy_points");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports generated H36 scenario path and artifact path", () => {
    const cwd = setupWorkspace();
    try {
      writeSnapshot(cwd, snapshot([snapshotRow({ playerName: "One QB", position: "QB", gsisId: "00-1" })]));

      const report = runHistoricalDraftUniverseBuilder({ season: 2025, cwd });

      expect(report.generatedH36ScenarioPath).toBe("data/backtesting/historical-mock-draft-scenario.2025.generated.json");
      expect(report.generatedH36Scenario.playerUniverseInput.artifactPath).toBe("artifacts/projections/backtesting/historical-draft-universe-2025.json");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports leakage guard and no live mutation safety gates", () => {
    const cwd = setupWorkspace();
    try {
      writeSnapshot(cwd, snapshot([snapshotRow({ playerName: "One QB", position: "QB", gsisId: "00-1" })]));

      const report = runHistoricalDraftUniverseBuilder({ season: 2025, cwd });

      expect(report.dataLeakageGuard).toMatchObject({
        actualWeeklyOutcomesNotUsedForRanking: true,
        weeklyOutcomesUsedOnlyForIdentifierCoveragePreview: true,
        noOutcomePointsJoinedIntoDraftUniverse: true,
        noFutureFieldsUsed: true,
      });
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes artifacts and generated scenario", () => {
    const cwd = setupWorkspace();
    try {
      writeSnapshot(cwd, snapshot([snapshotRow({ playerName: "One QB", position: "QB", gsisId: "00-1" })]));
      const report = runHistoricalDraftUniverseBuilder({ season: 2025, cwd });
      const artifacts = writeHistoricalDraftUniverseArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(readFileSync(artifacts.scenarioPath, "utf8")).toContain("historical-draft-universe-2025.json");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports missing preseason snapshot clearly", () => {
    const report = runHistoricalDraftUniverseBuilder({ season: 2025, cwd: setupWorkspace() });

    expect(report.recommendation).toBe("historical_draft_universe_needs_preseason_snapshot");
    expect(report.summary.universeRows).toBe(0);
  });
});

function setupWorkspace() {
  return path.join(tmpdir(), `blackbird-h361-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function writeSnapshot(cwd: string, data: PreseasonProjectionSnapshot) {
  const output = path.join(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, "preseason-projection-snapshot-2025.json"), `${JSON.stringify(data)}\n`, "utf8");
}

function writeWeekly(cwd: string, results: Array<{ week: number; player_id: string; gsis_id: string; player_name: string; position: string; fantasy_points: number }>) {
  const output = path.join(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, "historical-weekly-results-2025.normalized.json"), JSON.stringify({ historicalSeason: 2025, results }), "utf8");
}

function snapshot(rows: PreseasonProjectionSnapshotRow[]): PreseasonProjectionSnapshot {
  return {
    metadata: {
      artifactType: "blackbird_preseason_projection_snapshot",
      projectionSeason: 2025,
      targetSeason: 2025,
      inputSeasons: [2024],
      excludedSeasons: [2025],
      leakageSafe: true,
      createdForBacktesting: true,
      modelVersion: "preseason_snapshot_v2",
      defaultUniverse: "fantasy-relevant",
      scoringSource: "default",
      scoringProfile: "test",
      notes: [],
    },
    rows,
    diagnostics: {
      playersConsidered: rows.length,
      playersProjected: rows.length,
      playersSkipped: 0,
      playersSkippedNoSignal: 0,
      universe: "fantasy-relevant",
      variantCounts: {},
      cohortCounts: {},
      noPriorTypeCounts: {},
      noPriorCount: 0,
      idpCount: 0,
      averageProjectedGames: null,
      averageProjectedPpgByPosition: {},
      confidenceDistribution: {},
      warningsByType: {},
      leakageSafety: {
        passed: true,
        targetSeasonExcludedFromInputs: true,
        noPostTargetProjectionArtifactsUsed: true,
        notes: [],
      },
    },
  };
}

function snapshotRow(overrides: Partial<PreseasonProjectionSnapshotRow>): PreseasonProjectionSnapshotRow {
  return {
    sleeperId: "s",
    gsisId: "00",
    playerName: "Player",
    position: "WR",
    team: "KC",
    matchConfidence: "exact_id",
    projectedGames: 10,
    projectedPpg: 10,
    projectedTotalPoints: 100,
    floorPoints: 80,
    medianPoints: 100,
    ceilingPoints: 120,
    confidence: "high",
    confidenceScore: 90,
    variant: "blackbird_expected_games_v8_1_calibrated_gate",
    source: "blackbird_expected_games_v8_1_calibrated_gate",
    projectionSource: "blackbird_expected_games_v8_1_calibrated_gate",
    projectionRunId: null,
    projectionReasons: [],
    warnings: [],
    cohortLabels: [],
    universe: "fantasy-relevant",
    inputCoverage: {
      priorSeasonsUsed: [2024],
      priorGames: 10,
      priorPpg: 10,
      careerToDatePpg: 10,
      roleLabel: "starter",
      availabilitySignal: null,
      snapShare: null,
      usageTrend: "stable",
      highValueUsageFlags: [],
      noPriorNflData: false,
      noPriorType: "has_prior_nfl_data",
    },
    expectedGamesDiagnostics: {} as PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"],
    ...overrides,
    normalizedName: (overrides.playerName ?? "Player").toLowerCase().replace(/[^a-z0-9]/g, ""),
  };
}
