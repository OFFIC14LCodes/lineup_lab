import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { filterDraftEligiblePlayers } from "@/lib/draft/league-position-eligibility";

import {
  normalizeHistoricalWideAdpSource,
  selectHistoricalMarketFormat,
  writeHistoricalWideAdpArtifacts,
} from "./historical-wide-adp-source";

describe("historical wide ADP source", () => {
  it("parses one player into Half PPR, PPR, and Superflex normalized rows", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "wide-adp-"));
    try {
      const inputPath = writeWideCsv(cwd, [
        "Ja'Marr Chase,WR,CIN,1.1,1,WR1,1.9,1,WR1,3.1,3,WR1",
      ]);

      const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath, cwd });

      expect(report.recommendation).toBe("wide_adp_source_ready_for_market_anchor");
      expect(report.sourcePlayerRows).toBe(1);
      expect(report.normalizedRows).toBe(3);
      expect(report.rowsByScoringFormat).toEqual({ HALF_PPR: 1, PPR: 1, SUPERFLEX: 1 });
      expect(report.normalizedAdpRows.find((row) => row.scoringFormat === "SUPERFLEX")).toMatchObject({
        playerName: "Ja'Marr Chase",
        position: "WR",
        team: "CIN",
        adp: 3.1,
        rank: 3,
        posRank: "WR1",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("skips a scoring format when ADP and order are both blank", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "wide-adp-blank-"));
    try {
      const inputPath = writeWideCsv(cwd, [
        "Lamar Jackson,QB,BAL,,,,,,,2.4,2,QB2",
      ]);

      const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath, cwd });

      expect(report.normalizedRows).toBe(1);
      expect(report.rowsByScoringFormat.SUPERFLEX).toBe(1);
      expect(report.rowsByScoringFormat.PPR).toBe(0);
      expect(report.normalizedAdpRows[0]).toMatchObject({ scoringFormat: "SUPERFLEX", adp: 2.4, rank: 2 });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("parses quarterback Superflex order separately from PPR and Half PPR order", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "wide-adp-qb-"));
    try {
      const inputPath = writeWideCsv(cwd, [
        "Josh Allen,QB,BUF,20.9,21,QB1,20.0,20,QB1,1.5,1,QB1",
      ]);

      const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath, cwd });

      expect(report.normalizedAdpRows.find((row) => row.scoringFormat === "HALF_PPR")?.rank).toBe(21);
      expect(report.normalizedAdpRows.find((row) => row.scoringFormat === "PPR")?.rank).toBe(20);
      expect(report.normalizedAdpRows.find((row) => row.scoringFormat === "SUPERFLEX")?.rank).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("selects market format from league settings with explicit fallback", () => {
    expect(selectHistoricalMarketFormat({ rosterPositions: ["QB", "RB", "WR", "SUPER_FLEX"], scoringSettings: { rec: 1 } })).toMatchObject({
      selectedFormat: "SUPERFLEX",
      fallbackUsed: false,
    });
    expect(selectHistoricalMarketFormat({ rosterPositions: ["QB", "RB", "WR"], scoringSettings: { rec: 1 } })).toMatchObject({ selectedFormat: "PPR", fallbackUsed: false });
    expect(selectHistoricalMarketFormat({ rosterPositions: ["QB", "RB", "WR"], scoringSettings: { rec: 0.5 } })).toMatchObject({ selectedFormat: "HALF_PPR", fallbackUsed: false });
    expect(selectHistoricalMarketFormat({ rosterPositions: ["QB", "RB", "WR"], scoringSettings: {} })).toMatchObject({ selectedFormat: "PPR", fallbackUsed: true });
  });

  it("keeps K, DST, and IDP ADP rows from overriding no-K/no-defense roster eligibility", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "wide-adp-eligibility-"));
    try {
      const inputPath = writeWideCsv(cwd, [
        "Top Kicker,K,BAL,120,120,K1,120,120,K1,140,140,K1",
        "Top Defense,DST,DAL,130,130,DST1,130,130,DST1,150,150,DST1",
        "Top Linebacker,LB,SF,200,200,LB1,200,200,LB1,210,210,LB1",
      ]);
      const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath, cwd });
      const eligibility = filterDraftEligiblePlayers(report.normalizedAdpRows, { rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"] });

      expect(report.rowsByPosition).toMatchObject({ K: 3, DST: 3, LB: 3 });
      expect(eligibility.players).toHaveLength(0);
      expect(eligibility.filteredPositions).toEqual(["DEF", "K", "LB"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes artifacts and reports no live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "wide-adp-artifacts-"));
    try {
      const inputPath = writeWideCsv(cwd, ["Ja'Marr Chase,WR,CIN,1.1,1,WR1,1.9,1,WR1,3.1,3,WR1"]);
      const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath, cwd });
      const artifacts = writeHistoricalWideAdpArtifacts(report, cwd);

      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports a missing input file clearly", () => {
    const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath: "missing-wide-adp.csv", cwd: mkdtempSync(path.join(tmpdir(), "wide-adp-missing-")) });

    expect(report.recommendation).toBe("wide_adp_source_needs_input_file");
    expect(report.inputExists).toBe(false);
    expect(report.normalizedRows).toBe(0);
  });

  it("reports header mapping only when no rows can be mapped", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "wide-adp-bad-headers-"));
    try {
      const inputPath = path.join(cwd, "bad-wide-adp.csv");
      writeFileSync(inputPath, [
        "PLAYER,TEAM,HALF PPR: ADP,HALF PPR: ORDER",
        "Missing Position,CIN,1.1,1",
      ].join("\n"));

      const report = normalizeHistoricalWideAdpSource({ season: 2026, inputPath, cwd });

      expect(report.recommendation).toBe("wide_adp_source_needs_header_mapping");
      expect(report.normalizedRows).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function writeWideCsv(cwd: string, rows: string[]) {
  const inputPath = path.join(cwd, "historical-adp-2026-wide.csv");
  writeFileSync(inputPath, [
    "NAME,POS,TEAM,HALF PPR: ADP,HALF PPR: ORDER,HALF PPR: POS RANK,PPR: ADP,PPR: ORDER,PPR: POS RANK,SUPERFLEX: ADP,SUPERFLEX: ORDER,SUPERFLEX: POS RANK",
    ...rows,
  ].join("\n"));
  return inputPath;
}
