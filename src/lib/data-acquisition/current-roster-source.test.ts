import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildCurrentRosterSourceReport,
  inspectCurrentRosterSource,
  normalizeRosterPositionValue,
  normalizeRosterStatusValue,
  normalizeRosterTeamValue,
  writeCurrentRosterSourceArtifacts,
} from "./current-roster-source";

describe("current roster source", () => {
  it("validates statuses and normalizes aliases", () => {
    expect(normalizeRosterStatusValue("IR")).toBe("injured_reserve");
    expect(normalizeRosterStatusValue("practice squad")).toBe("practice_squad");
    expect(normalizeRosterStatusValue("bad-status")).toBe(null);
    expect(normalizeRosterTeamValue("JAC")).toBe("JAX");
    expect(normalizeRosterTeamValue("free_agent")).toBe("FA");
    expect(normalizeRosterPositionValue("D/ST")).toBe("DEF");
  });

  it("normalizes rows, reports missing ids, and removes duplicates by best id", () => {
    const report = buildCurrentRosterSourceReport({
      season: 2026,
      inputPath: "fixture.csv",
      rawRows: [
        row({ player_id: "1", sleeper_id: "1", player_name: "A.J. Brown", position: "wr", team: "jac", status: "active", source_updated_at: "2026-06-18" }),
        row({ player_id: "1", sleeper_id: "1", player_name: "A.J. Brown", position: "WR", team: "JAX", status: "active", source_updated_at: "2026-06-19" }),
        row({ player_name: "Fallback Player", position: "D/ST", team: "FA", status: "free agent" }),
        row({ player_id: "bad", player_name: "Bad Status", position: "RB", team: "KC", status: "not real" }),
      ],
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.sourceRows).toBe(4);
    expect(report.normalizedRows).toBe(2);
    expect(report.duplicateRowsRemoved).toBe(1);
    expect(report.invalidRows).toBe(1);
    expect(report.missingIdRows).toBe(1);
    expect(report.statusCounts.active).toBe(1);
    expect(report.statusCounts.free_agent).toBe(1);
    expect(report.rows.find((candidate) => candidate.playerName === "A.J. Brown")).toMatchObject({ team: "JAX", position: "WR", sourceUpdatedAt: "2026-06-19" });
    expect(report.issues.map((issue) => issue.issue)).toEqual(["missing_best_id", "invalid_status"]);
  });

  it("applies mapped source headers", () => {
    const report = buildCurrentRosterSourceReport({
      season: 2026,
      inputPath: "mapped.csv",
      mapping: {
        player_name: "full_name",
        position: "pos",
        team: "recent_team",
        status: "roster_status",
        gsis_id: "gsis",
      },
      rawRows: [
        { full_name: "Mapped Player", pos: "pk", recent_team: "jac", roster_status: "IR", gsis: "00-0000001" },
      ],
    });

    expect(report.normalizedRows).toBe(1);
    expect(report.mapping.gsis_id).toBe("gsis");
    expect(report.rows[0]).toMatchObject({
      playerName: "Mapped Player",
      position: "K",
      team: "JAX",
      status: "injured_reserve",
      gsisId: "00-0000001",
    });
  });

  it("inspects source headers and suggests mapping", () => {
    const report = inspectCurrentRosterSource("data/current-rosters/current-rosters-2026.template.csv");

    expect(report.dryRun).toBe(true);
    expect(report.headers).toContain("player_name");
    expect(report.directMappedFields.player_name).toBe("player_name");
    expect(report.missingRequiredFields).toEqual([]);
    expect(report.suggestedMapping.team).toBe("team");
    expect(report.sampleRows.length).toBeGreaterThan(0);
  });

  it("writes normalized roster artifacts", () => {
    const report = buildCurrentRosterSourceReport({
      season: 2097,
      inputPath: "fixture.csv",
      rawRows: [row({ player_id: "1", player_name: "A.J. Brown", position: "WR", team: "PHI", status: "active" })],
    });
    const artifacts = writeCurrentRosterSourceArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("current-rosters-2097.normalized.json");
      expect(artifacts.markdownPath).toContain("current-rosters-2097.normalized.md");
      expect(artifacts.csvPath).toContain("current-rosters-2097.normalized.csv");
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

function row(values: Record<string, string>) {
  return {
    player_id: "",
    sleeper_id: "",
    gsis_id: "",
    player_name: "",
    position: "",
    team: "",
    status: "",
    roster_status: "",
    depth_chart_position: "",
    depth_chart_order: "",
    source: "fixture",
    source_updated_at: "",
    notes: "",
    ...values,
  };
}
