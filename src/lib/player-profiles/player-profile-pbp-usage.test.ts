import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPlayerProfileHighValueUsageProfile,
  loadPlayerProfilePbpUsageSources,
  markPbpUsageSourceMatches,
} from "./player-profile-pbp-usage";

describe("player profile play-by-play high-value usage", () => {
  it("prefers the recent PBP source when both candidates exist", () => {
    const root = fixtureProject({
      "pbp_2018_2025.csv": pbpCsv({ rusherId: "00-OLD" }),
      "pbp_2023_2025.csv": pbpCsv({ rusherId: "00-NEW" }),
    });
    try {
      const sources = loadPlayerProfilePbpUsageSources(root);

      expect(sources.diagnostics.selectedFile).toContain("pbp_2023_2025.csv");
      expect(sources.diagnostics.candidateFiles.some((file) => file.endsWith("pbp_2023_2025.csv"))).toBe(true);
      expect(sources.weeklyByGsisId.has("00-NEW")).toBe(true);
      expect(sources.weeklyByGsisId.has("00-OLD")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to the full PBP source when recent source is absent", () => {
    const root = fixtureProject({
      "pbp_2018_2025.csv": pbpCsv({ rusherId: "00-OLD" }),
    });
    try {
      const sources = loadPlayerProfilePbpUsageSources(root);

      expect(sources.diagnostics.selectedFile).toContain("pbp_2018_2025.csv");
      expect(sources.weeklyByGsisId.has("00-OLD")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports missing PBP source without throwing", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "blackbird-pbp-missing-"));
    try {
      const sources = loadPlayerProfilePbpUsageSources(root);

      expect(sources.diagnostics.exists).toBe(false);
      expect(sources.diagnostics.rowCount).toBe(0);
      expect(sources.diagnostics.missingColumns).toContain("play_type");
      expect(sources.weeklyByGsisId.size).toBe(0);

      const profile = buildPlayerProfileHighValueUsageProfile({
        position: "RB",
        weeklyHighValueUsage: [],
        sourceAvailable: false,
      });
      expect(profile.highValueUsageSummary.sourceStatus).toBe("unavailable");
      expect(profile.highValueRoleWarnings).toContain("play_by_play_data_unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("derives compact red-zone, goal-line, deep, and end-zone usage", () => {
    const root = fixtureProject([
      "season,week,play_type,yardline_100,down,half_seconds_remaining,rush_attempt,pass_attempt,complete_pass,air_yards,rush_touchdown,pass_touchdown,rusher_player_id,receiver_player_id,passer_player_id,qb_scramble,td_player_id",
      "2025,1,run,2,1,140,1,0,0,,1,0,00-RB,,,0,00-RB",
      "2025,1,pass,18,3,80,0,1,1,20,0,1,,00-WR,00-QB,0,00-WR",
      "2025,1,pass,40,2,400,0,1,0,30,0,0,,00-WR,00-QB,0,",
      "2025,1,qb_scramble,8,2,110,1,0,0,,0,0,00-QB,,,1,",
      "2025,2,run,5,1,600,1,0,0,,0,0,00-RB,,,0,",
    ].join("\n"));

    try {
      const sources = loadPlayerProfilePbpUsageSources(root);

      expect(sources.diagnostics.exists).toBe(true);
      expect(sources.diagnostics.missingColumns).toEqual([]);
      expect(sources.diagnostics.rowCount).toBe(5);
      expect(sources.diagnostics.derivedPlayerWeekRows).toBe(4);
      expect(sources.diagnostics.playersWithGsisId).toBe(3);

      const rb = buildPlayerProfileHighValueUsageProfile({
        position: "RB",
        weeklyHighValueUsage: sources.weeklyByGsisId.get("00-RB") ?? [],
        sourceAvailable: true,
      });
      expect(rb.highValueUsageSummary.goalLineCarriesPerGame).toBe(0.5);
      expect(rb.highValueUsageSummary.redZoneCarriesPerGame).toBe(1);
      expect(rb.highValueUsageSummary.modifiers).toContain("goal_line_role");

      const wr = buildPlayerProfileHighValueUsageProfile({
        position: "WR",
        weeklyHighValueUsage: sources.weeklyByGsisId.get("00-WR") ?? [],
        sourceAvailable: true,
      });
      expect(wr.highValueUsageSummary.redZoneTargetsPerGame).toBe(1);
      expect(wr.highValueUsageSummary.endZoneTargetsPerGame).toBe(1);
      expect(wr.highValueUsageSummary.deepTargetsPerGame).toBe(2);
      expect(wr.highValueUsageSummary.airYardsPerTarget).toBe(25);
      expect(wr.highValueUsageSummary.modifiers).toContain("end_zone_target_role");
      expect(wr.highValueUsageSummary.modifiers).toContain("deep_threat");

      const qb = buildPlayerProfileHighValueUsageProfile({
        position: "QB",
        weeklyHighValueUsage: sources.weeklyByGsisId.get("00-QB") ?? [],
        sourceAvailable: true,
      });
      expect(qb.highValueUsageSummary.redZonePassAttemptsPerGame).toBe(1);
      expect(qb.highValueUsageSummary.scramblesPerGame).toBe(1);

      const matched = markPbpUsageSourceMatches(sources, { matchedGsisIds: new Set(["00-RB", "00-WR"]) });
      expect(matched.matchedRows).toBe(3);
      expect(matched.unmatchedRows).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports missing required columns", () => {
    const root = fixtureProject("season,week,play_type\n2025,1,run");
    try {
      const sources = loadPlayerProfilePbpUsageSources(root);

      expect(sources.weeklyByGsisId.size).toBe(0);
      expect(sources.diagnostics.missingColumns).toContain("yardline_100");
      expect(sources.diagnostics.missingColumns).toContain("player id columns");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureProject(pbpCsv: string | Record<string, string>) {
  const root = mkdtempSync(path.join(os.tmpdir(), "blackbird-pbp-usage-"));
  const dataDir = path.join(root, "data", "nflverse");
  mkdirSync(dataDir, { recursive: true });
  if (typeof pbpCsv === "string") {
    writeFileSync(path.join(dataDir, "pbp_2018_2025.csv"), `${pbpCsv}\n`, "utf8");
  } else {
    for (const [fileName, contents] of Object.entries(pbpCsv)) {
      writeFileSync(path.join(dataDir, fileName), `${contents}\n`, "utf8");
    }
  }
  return root;
}

function pbpCsv(input: { rusherId: string }) {
  return [
    "season,week,play_type,yardline_100,down,half_seconds_remaining,rush_attempt,pass_attempt,complete_pass,air_yards,rush_touchdown,pass_touchdown,rusher_player_id,receiver_player_id,passer_player_id,qb_scramble,td_player_id",
    `2025,1,run,2,1,140,1,0,0,,1,0,${input.rusherId},,,0,${input.rusherId}`,
  ].join("\n");
}
