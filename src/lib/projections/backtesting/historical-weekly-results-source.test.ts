import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  discoverHistoricalWeeklyResultSources,
  normalizeHistoricalWeeklyRows,
  runHistoricalWeeklyResultsNormalize,
  writeHistoricalWeeklyResultsArtifacts,
} from "./historical-weekly-results-source";

describe("historical weekly results source", () => {
  it("parses the template shape and reports source discovery", () => {
    const dir = testDir();
    const inputPath = path.join(dir, "data", "backtesting", "historical-weekly-results-2025.csv");
    writeCsv(inputPath, [
      "season,week,player_id,player_display_name,position,team,opponent_team,fantasy_points_ppr",
      "2025,1,00-1,Player One,QB,KC,LAC,22.4",
    ]);

    const report = runHistoricalWeeklyResultsNormalize({ season: 2025, cwd: dir, generatedAt: "2026-01-01T00:00:00.000Z" });

    expect(report.recommendation).toBe("historical_weekly_results_ready_for_h37_scoring");
    expect(report.sourceDiscovery[0].selected).toBe(true);
    expect(report.sourceDiscovery[0].seasonCoverage).toEqual([2025]);
    expect(report.sourceDiscovery[0].fantasyPointsPresent).toBe(true);
    expect(report.summary.totalWeeklyRows).toBe(1);
    expect(report.results[0].fantasy_points).toBe(22.4);
  });

  it("normalizes precomputed fantasy points and preserves identifiers", () => {
    const rows = normalizeHistoricalWeeklyRows([
      { season: "2025", week: "1", player_id: "00-2", sleeper_id: "s2", gsis_id: "g2", player_name: "P.Two", player_display_name: "Player Two", position: "WR", fantasy_points: "18.2" },
    ], { season: 2025, sourcePath: "input.csv" });

    expect(rows[0]).toMatchObject({
      player_id: "00-2",
      sleeper_id: "s2",
      gsis_id: "g2",
      player_name: "Player Two",
      position: "WR",
      fantasy_points: 18.2,
    });
  });

  it("calculates fantasy points from raw offensive stats", () => {
    const rows = normalizeHistoricalWeeklyRows([
      {
        season: "2025",
        week: "1",
        player_id: "00-3",
        player_display_name: "Player Three",
        position: "QB",
        passing_yards: "250",
        passing_tds: "2",
        passing_interceptions: "1",
        rushing_yards: "30",
        rushing_tds: "1",
        receptions: "0",
        receiving_yards: "0",
        receiving_tds: "0",
      },
    ], { season: 2025, sourcePath: "input.csv" });

    expect(rows[0].fantasy_points).toBe(25);
    expect(rows[0].notes).toContain("fantasy_points_calculated_from_stats");
  });

  it("reports missing scoring inputs as a limitation", () => {
    const dir = testDir();
    const inputPath = path.join(dir, "data", "backtesting", "historical-weekly-results-2025.csv");
    writeCsv(inputPath, [
      "season,week,player_id,player_display_name,position",
      "2025,1,00-4,Player Four,RB",
    ]);

    const report = runHistoricalWeeklyResultsNormalize({ season: 2025, cwd: dir });

    expect(report.recommendation).toBe("historical_weekly_results_needs_scoring_mapping");
    expect(report.summary.rowsMissingScoringInputs).toBe(1);
    expect(report.limitations).toContain("Some rows did not contain precomputed points or enough raw scoring columns.");
  });

  it("reports identifier coverage and identifier mapping needs", () => {
    const dir = testDir();
    const inputPath = path.join(dir, "data", "backtesting", "historical-weekly-results-2025.csv");
    writeCsv(inputPath, [
      "season,week,player_display_name,position,fantasy_points",
      "2025,1,Player Five,TE,12",
    ]);

    const report = runHistoricalWeeklyResultsNormalize({ season: 2025, cwd: dir });

    expect(report.recommendation).toBe("historical_weekly_results_needs_identifier_mapping");
    expect(report.summary.exactIdCoverage.player_id).toBe(0);
    expect(report.summary.exactIdCoverage.gsis_id).toBe(0);
  });

  it("reports missing source files clearly", () => {
    const report = runHistoricalWeeklyResultsNormalize({ season: 2025, cwd: testDir() });

    expect(report.recommendation).toBe("historical_weekly_results_needs_source_file");
    expect(report.selectedSourcePath).toBeNull();
    expect(report.summary.totalWeeklyRows).toBe(0);
  });

  it("exposes H37 integration path and leakage guard", () => {
    const report = runHistoricalWeeklyResultsNormalize({ season: 2025, cwd: testDir() });

    expect(report.h37Integration.weeklyResultsInputPath).toBe("artifacts/projections/backtesting/historical-weekly-results-2025.normalized.json");
    expect(report.dataLeakageGuard).toMatchObject({
      weeklyOutcomesSourceIsOutcomeOnly: true,
      notUsedByH36DraftEngine: true,
      h37ScoringOnly: true,
      noDraftRankingsRecomputed: true,
      noLiveOutputsChanged: true,
    });
  });

  it("writes JSON, markdown, and CSV artifacts without live mutation", () => {
    const dir = testDir();
    const report = runHistoricalWeeklyResultsNormalize({ season: 2025, cwd: dir });
    const artifacts = writeHistoricalWeeklyResultsArtifacts(report, dir);

    expect(readFileSync(artifacts.jsonPath, "utf8")).toContain("\"readOnly\": true");
    expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("Historical Weekly Results Normalization");
    expect(readFileSync(artifacts.csvPath, "utf8")).toContain("season,week,season_type");
  });

  it("summarizes source candidates independently", () => {
    const dir = testDir();
    const inputPath = path.join(dir, "custom.csv");
    writeCsv(inputPath, [
      "season,week,player_id,player_display_name,position,fantasy_points",
      "2025,1,00-6,Player Six,WR,9",
    ]);

    const discovery = discoverHistoricalWeeklyResultSources({ season: 2025, cwd: dir, sourcePath: "custom.csv" });

    expect(discovery[0]).toMatchObject({
      path: "custom.csv",
      exists: true,
      selected: true,
      rowCount: 1,
      fantasyPointsPresent: true,
      scoringMustBeCalculated: false,
    });
  });
});

function testDir() {
  const dir = path.join(tmpdir(), `blackbird-h371-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeCsv(filePath: string, lines: string[]) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}
