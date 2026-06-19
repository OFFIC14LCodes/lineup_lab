import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildScrapePlayersDepthChartAdapterReport,
  convertScrapePlayersDepthChart,
  H31_DEPTH_CHART_HEADERS,
  inspectExternalDepthChartCsv,
} from "./depth-chart-external-source";

describe("external depth chart source adapter", () => {
  it("inspects headers, row counts, likely columns, unique values, and blank rates", () => {
    const fixturePath = writeFixture("inspect", [
      ["Team", "Player", "Position", "Rank", "Status"],
      ["JAC", "Tank Bigsby", "RB", "2", ""],
      ["PHI", "Reed Blankenship", "S", "1", "active"],
      ["", "", "WR", "", ""],
    ]);

    try {
      const report = inspectExternalDepthChartCsv(fixturePath, 2);

      expect(report.dryRun).toBe(true);
      expect(report.readOnly).toBe(true);
      expect(report.headers).toEqual(["Team", "Player", "Position", "Rank", "Status"]);
      expect(report.rowCount).toBe(3);
      expect(report.sampleRows).toHaveLength(2);
      expect(report.uniqueTeams).toEqual(["JAX", "PHI"]);
      expect(report.uniquePositions).toEqual(["DB", "RB", "WR"]);
      expect(report.likelyColumns).toMatchObject({
        playerName: ["Player"],
        team: ["Team"],
        position: ["Position"],
        depthRank: ["Rank"],
        status: ["Status"],
      });
      expect(report.missingBlankRates.Player).toMatchObject({ blankRows: 1, blankRate: 1 / 3 });
    } finally {
      rmSync(fixturePath, { force: true });
    }
  });

  it("converts ScrapePlayers rows into H31 columns with stale-source notes", () => {
    const report = buildScrapePlayersDepthChartAdapterReport({
      season: 2026,
      inputPath: "master_nfl_depth_chart.csv",
      outputPath: "data/depth-charts/depth-chart-2026.csv",
      headers: ["Team", "Player", "Position", "Rank", "Status"],
      rawRows: [
        { Team: "JAC", Player: "Tank Bigsby", Position: "RB", Rank: "2", Status: "" },
        { Team: "PHI", Player: "Reed Blankenship", Position: "S", Rank: "1", Status: "active" },
        { Team: "LAR", Player: "", Position: "WR", Rank: "3", Status: "" },
      ],
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.sourceRows).toBe(3);
    expect(report.convertedRows).toBe(2);
    expect(report.skippedRows).toBe(1);
    expect(report.outputHeaders).toEqual(H31_DEPTH_CHART_HEADERS);
    expect(report.rowsForWrite[0]).toMatchObject({
      season: 2026,
      team: "JAX",
      player_name: "Tank Bigsby",
      position: "RB",
      depth_rank: 2,
      role: "backup",
      status: "unknown",
      source: "scrapeplayers_espn_depth_chart_2025_06_11",
      source_updated_at: "2025-06-11",
      notes: "stale_source_trial_not_current_2026_truth",
    });
    expect(report.rowsForWrite[1]).toMatchObject({
      position: "DB",
      role: "starter",
      status: "active",
    });
  });

  it("uses conservative role/status mapping from rank and explicit status only", () => {
    const report = buildScrapePlayersDepthChartAdapterReport({
      season: 2026,
      inputPath: "master_nfl_depth_chart.csv",
      outputPath: "data/depth-charts/depth-chart-2026.csv",
      headers: ["Team", "Player", "Position", "Depth Chart Position", "Status"],
      rawRows: [
        { Team: "LA", Player: "Starter", Position: "WR", "Depth Chart Position": "WR1", Status: "" },
        { Team: "LA", Player: "Backup", Position: "WR", "Depth Chart Position": "WR2", Status: "" },
        { Team: "LA", Player: "Depth", Position: "WR", "Depth Chart Position": "WR4", Status: "" },
        { Team: "LA", Player: "Unknown", Position: "WR", "Depth Chart Position": "", Status: "starter" },
      ],
    });

    expect(report.rowsForWrite.map((row) => row.role)).toEqual(["starter", "backup", "depth", "unknown"]);
    expect(report.rowsForWrite.map((row) => row.status)).toEqual(["unknown", "unknown", "unknown", "unknown"]);
    expect(report.teamCounts.LAR).toBe(4);
  });

  it("writes an H31-compatible CSV without mutating live outputs", () => {
    const inputPath = writeFixture("convert", [
      ["Team", "Player", "Position", "Rank"],
      ["WSH", "Example Player", "CB", "3"],
    ]);
    const outputPath = path.join(process.cwd(), "data", "depth-charts", "external", "adapter-test-output.csv");

    try {
      const report = convertScrapePlayersDepthChart({ inputPath, outputPath, season: 2096 });

      expect(report.dryRun).toBe(true);
      expect(report.readOnly).toBe(true);
      expect(report.convertedRows).toBe(1);
      expect(report.roleCounts.depth).toBe(1);
      expect(report.statusCounts.unknown).toBe(1);
      expect(report.notes.join(" ")).toContain("not live projections");
      expect(existsSync(outputPath)).toBe(true);
      const csv = readFileSync(outputPath, "utf8");
      expect(csv.split(/\r?\n/)[0]).toBe(H31_DEPTH_CHART_HEADERS.join(","));
      expect(csv).toContain("WAS,Example Player,DB");
    } finally {
      rmSync(inputPath, { force: true });
      rmSync(outputPath, { force: true });
    }
  });
});

function writeFixture(name: string, rows: string[][]) {
  const dir = path.join(process.cwd(), "data", "depth-charts", "external");
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}-fixture.csv`);
  writeFileSync(filePath, rows.map((row) => row.join(",")).join("\n") + "\n", "utf8");
  return filePath;
}
