import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  matchAdpRowsToUniverse,
  normalizeHistoricalAdpCsvRow,
  normalizeHistoricalAdpSource,
  writeHistoricalAdpSourceArtifacts,
} from "./historical-adp-source";
import type { HistoricalAdpNormalizedRow } from "./historical-adp-source-types";
import type { HistoricalMockDraftPlayer } from "./historical-mock-draft-engine-types";

describe("historical ADP source", () => {
  it("parses ADP rows and derives market rank from ADP when rank is missing", () => {
    const result = normalizeHistoricalAdpCsvRow({
      season: "2025",
      source: "Test ADP",
      as_of_date: "2025-08-15",
      player_name: "Player One",
      position: "wr",
      team: "kc",
      adp: "12.4",
      rank: "",
      sleeper_id: "s1",
      gsis_id: "",
      player_id: "",
      notes: "preseason",
    }, 2025);

    expect(result.error).toBeNull();
    expect(result.row).toMatchObject({ playerName: "Player One", position: "WR", team: "KC", adp: 12.4, rank: 12.4 });
  });

  it("rejects invalid numeric ADP/rank rows", () => {
    const result = normalizeHistoricalAdpCsvRow({ season: "2025", player_name: "Bad Row", position: "RB", adp: "none", rank: "" }, 2025);

    expect(result.row).toBeNull();
    expect(result.error).toContain("rank or adp");
  });

  it("matches exact IDs before name/team/position and marks name-only matches for review", () => {
    const rows = [
      adpRow("Exact", { playerId: "p1", rank: 1 }),
      adpRow("Team Match", { team: "BUF", rank: 2 }),
      adpRow("Name Only", { team: null, rank: 3 }),
    ];
    const matches = matchAdpRowsToUniverse(rows, [
      player("p1", "Exact", "WR", "KC"),
      player("p2", "Team Match", "RB", "BUF"),
      player("p3", "Name Only", "TE", "SEA"),
    ]);

    expect(matches[0]).toMatchObject({ matchMethod: "player_id_exact", confidence: "exact", universePlayerId: "p1" });
    expect(matches[1]).toMatchObject({ matchMethod: "name_position_team_unique", confidence: "high", universePlayerId: "p2" });
    expect(matches[2]).toMatchObject({ matchMethod: "name_position_review_candidate", confidence: "review", universePlayerId: "p3" });
  });

  it("deduplicates rows, detects conflicts, enriches the universe, and writes artifacts", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-adp-"));
    try {
      const inputPath = path.join(cwd, "historical-adp-2025.csv");
      const universeDir = path.join(cwd, "artifacts", "projections", "backtesting");
      const universePath = path.join(universeDir, "historical-draft-universe-2025.json");
      mkdirSync(universeDir, { recursive: true });
      writeFileSync(inputPath, [
        "season,source,as_of_date,player_name,position,team,adp,rank,sleeper_id,gsis_id,player_id,notes",
        "2025,Test,2025-08-15,Exact,WR,KC,1.2,1,s1,g1,p1,first",
        "2025,Test,2025-08-15,Exact,WR,KC,1.2,1,s1,g1,p1,duplicate",
        "2025,Test,2025-08-15,Conflict,RB,BUF,3,3,,,,",
        "2025,Test,2025-08-15,Conflict,RB,BUF,4,4,,,,",
        "2025,Test,2025-08-15,Review,TE,,5,5,,,,",
      ].join("\n"));
      writeFileSync(universePath, JSON.stringify({
        playerUniverseInput: {
          players: [
            player("p1", "Exact", "WR", "KC", { sleeperId: "s1", gsisId: "g1" }),
            player("p2", "Conflict", "RB", "BUF"),
            player("p3", "Review", "TE", "DAL"),
            player("p4", "No ADP", "QB", "MIA"),
          ],
        },
      }));

      const report = normalizeHistoricalAdpSource({ season: 2025, inputPath, universePath, cwd });
      const artifacts = writeHistoricalAdpSourceArtifacts(report, cwd);

      expect(report.recommendation).toBe("historical_adp_source_ready_for_market_anchor_retest");
      expect(report.duplicateRowsRemoved).toBe(2);
      expect(report.conflictRows).toHaveLength(1);
      expect(report.coverage.matchedByExactId).toBe(1);
      expect(report.coverage.matchedByNameTeamPosition).toBe(1);
      expect(report.coverage.reviewCandidates).toBe(1);
      expect(report.enrichedUniversePlayers.find((row) => row.playerId === "p1")?.adpRank).toBe(1);
      expect(report.enrichedUniversePlayers.find((row) => row.playerId === "p3")?.adpRank).toBeNull();
      expect(report.dataLeakageGuard.actualWeeklyOutcomesNotUsedInMatching).toBe(true);
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
      expect(existsSync(artifacts.normalizedJsonPath)).toBe(true);
      expect(existsSync(artifacts.enrichedJsonPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports template-only input as needing a real CSV", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-adp-template-"));
    try {
      const inputPath = path.join(cwd, "historical-adp-2025.template.csv");
      writeFileSync(inputPath, "season,source,as_of_date,player_name,position,team,adp,rank,sleeper_id,gsis_id,player_id,notes\n");
      const report = normalizeHistoricalAdpSource({ season: 2025, inputPath, universePath: "missing.json", cwd });

      expect(report.recommendation).toBe("historical_adp_source_needs_real_csv");
      expect(report.coverage.normalizedRows).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports valid ADP with a missing universe as needing a historical universe", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-adp-missing-universe-"));
    try {
      const inputPath = writeAdpCsv(cwd, "historical-adp-2023.csv", ["2023,Kaggle,2023-08-03,Market Back,RB,KC,12,12,,,,"]);
      const report = normalizeHistoricalAdpSource({ season: 2023, inputPath, universePath: "artifacts/projections/backtesting/historical-draft-universe-2023.json", cwd });
      const artifacts = writeHistoricalAdpSourceArtifacts(report, cwd);
      const markdown = readFileSync(artifacts.normalizedMarkdownPath, "utf8");

      expect(report.recommendation).toBe("historical_adp_source_needs_historical_universe");
      expect(report.universeExists).toBe(false);
      expect(report.universeRows).toBe(0);
      expect(report.universeUsableRows).toBe(0);
      expect(report.adpRows).toBe(1);
      expect(report.normalizedAdpRows).toBe(1);
      expect(markdown).toContain("ADP source parsed successfully, but no historical draft universe exists for this season.");
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports valid ADP with an empty universe as needing a historical universe", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-adp-empty-universe-"));
    try {
      const inputPath = writeAdpCsv(cwd, "historical-adp-2023.csv", ["2023,Kaggle,2023-08-03,Market Back,RB,KC,12,12,,,,"]);
      const universePath = writeUniverse(cwd, 2023, []);
      const report = normalizeHistoricalAdpSource({ season: 2023, inputPath, universePath, cwd });

      expect(report.recommendation).toBe("historical_adp_source_needs_historical_universe");
      expect(report.universeExists).toBe(true);
      expect(report.universeRows).toBe(0);
      expect(report.universeUsableRows).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports valid ADP and usable universe with no matches as identifier mapping", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-adp-mismatch-"));
    try {
      const inputPath = writeAdpCsv(cwd, "historical-adp-2023.csv", ["2023,Kaggle,2023-08-03,Market Back,RB,KC,12,12,,,,"]);
      const universePath = writeUniverse(cwd, 2023, [player("p1", "Different Player", "WR", "BUF")]);
      const report = normalizeHistoricalAdpSource({ season: 2023, inputPath, universePath, cwd });

      expect(report.recommendation).toBe("historical_adp_source_needs_identifier_mapping");
      expect(report.universeExists).toBe(true);
      expect(report.universeUsableRows).toBe(1);
      expect(report.coverage.unmatchedAdpRows).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports valid ADP and matched universe as ready for retest", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-adp-ready-"));
    try {
      const inputPath = writeAdpCsv(cwd, "historical-adp-2023.csv", ["2023,Kaggle,2023-08-03,Market Back,RB,KC,12,12,,,,"]);
      const universePath = writeUniverse(cwd, 2023, [player("p1", "Market Back", "RB", "KC")]);
      const report = normalizeHistoricalAdpSource({ season: 2023, inputPath, universePath, cwd });

      expect(report.recommendation).toBe("historical_adp_source_ready_for_market_anchor_retest");
      expect(report.coverage.matchedByNameTeamPosition).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function adpRow(playerName: string, overrides: Partial<HistoricalAdpNormalizedRow> = {}): HistoricalAdpNormalizedRow {
  return {
    season: 2025,
    source: "Test",
    asOfDate: "2025-08-15",
    playerName,
    normalizedPlayerName: playerName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    position: overrides.position ?? (playerName === "Name Only" ? "TE" : playerName === "Team Match" ? "RB" : "WR"),
    team: overrides.team === undefined ? "KC" : overrides.team,
    adp: overrides.adp ?? overrides.rank ?? 1,
    rank: overrides.rank ?? 1,
    sleeperId: overrides.sleeperId ?? null,
    gsisId: overrides.gsisId ?? null,
    playerId: overrides.playerId ?? null,
    notes: [],
  };
}

function player(
  playerId: string,
  playerName: string,
  position: string,
  nflTeam: string,
  overrides: Partial<HistoricalMockDraftPlayer> = {},
): HistoricalMockDraftPlayer {
  return {
    playerId,
    playerName,
    position,
    nflTeam,
    blackbirdRank: 1,
    internalDraftRank: 1,
    projectionRank: 1,
    adpRank: null,
    marketRank: null,
    projectedPoints: 100,
    ...overrides,
  };
}

function writeAdpCsv(cwd: string, filename: string, rows: string[]) {
  const inputPath = path.join(cwd, filename);
  writeFileSync(inputPath, [
    "season,source,as_of_date,player_name,position,team,adp,rank,sleeper_id,gsis_id,player_id,notes",
    ...rows,
  ].join("\n"));
  return inputPath;
}

function writeUniverse(cwd: string, season: number, players: HistoricalMockDraftPlayer[]) {
  const universeDir = path.join(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(universeDir, { recursive: true });
  const universePath = path.join(universeDir, `historical-draft-universe-${season}.json`);
  writeFileSync(universePath, JSON.stringify({ playerUniverseInput: { players } }));
  return universePath;
}
