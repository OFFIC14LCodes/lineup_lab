import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildDepthChartSourceReport,
  normalizeDepthChartPosition,
  normalizeDepthChartRole,
  normalizeDepthChartStatus,
  normalizeDepthChartTeam,
  writeDepthChartSourceArtifacts,
} from "./depth-chart-source";

describe("depth chart source", () => {
  it("normalizes status, role, team, and position aliases", () => {
    expect(normalizeDepthChartStatus("IR")).toBe("injured");
    expect(normalizeDepthChartStatus("practice squad")).toBe("practice_squad");
    expect(normalizeDepthChartStatus("bad-status")).toBe(null);
    expect(normalizeDepthChartRole("practice")).toBe("practice_squad");
    expect(normalizeDepthChartRole("bad-role")).toBe(null);
    expect(normalizeDepthChartTeam("JAC")).toBe("JAX");
    expect(normalizeDepthChartPosition("D/ST")).toBe("DEF");
    expect(normalizeDepthChartPosition("pk")).toBe("K");
  });

  it("normalizes rows, reports review-only fallback identity, and dedupes by best id", () => {
    const report = buildDepthChartSourceReport({
      season: 2026,
      inputPath: "fixture.csv",
      rawRows: [
        row({ player_id: "1", sleeper_id: "s1", player_name: "A.J. Brown", position: "wr", team: "jac", status: "starter", role: "starter", depth_rank: "1" }),
        row({ player_id: "1", sleeper_id: "s1", player_name: "A.J. Brown", position: "WR", team: "JAX", status: "active", role: "starter", depth_rank: "2" }),
        row({ player_name: "Fallback Player", position: "RB", team: "KC", status: "backup", role: "handcuff" }),
        row({ player_id: "bad", player_name: "Bad Status", position: "RB", team: "KC", status: "not real", role: "backup" }),
      ],
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.sourceRows).toBe(4);
    expect(report.normalizedRows).toBe(2);
    expect(report.duplicateRowsRemoved).toBe(1);
    expect(report.conflictRows).toBe(1);
    expect(report.invalidRows).toBe(1);
    expect(report.missingIdentityRows).toBe(1);
    expect(report.statusCounts.starter).toBe(1);
    expect(report.roleCounts.handcuff).toBe(1);
    expect(report.rows.find((candidate) => candidate.playerName === "A.J. Brown")).toMatchObject({
      team: "JAX",
      position: "WR",
      status: "starter",
      role: "starter",
    });
    expect(report.issues.map((issue) => issue.issue)).toEqual(["missing_identity", "invalid_status", "duplicate_conflict"]);
  });

  it("keeps a header-only template as an empty dry-run source", () => {
    const report = buildDepthChartSourceReport({
      season: 2026,
      inputPath: "data/depth-charts/depth-chart-2026.template.csv",
      rawRows: [],
    });

    expect(report.sourceRows).toBe(0);
    expect(report.normalizedRows).toBe(0);
    expect(report.invalidRows).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("writes normalized depth chart artifacts", () => {
    const report = buildDepthChartSourceReport({
      season: 2097,
      inputPath: "fixture.csv",
      rawRows: [row({ player_id: "1", player_name: "A.J. Brown", position: "WR", team: "PHI", status: "active", role: "starter" })],
    });
    const artifacts = writeDepthChartSourceArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("depth-chart-2097.normalized.json");
      expect(artifacts.markdownPath).toContain("depth-chart-2097.normalized.md");
      expect(artifacts.csvPath).toContain("depth-chart-2097.normalized.csv");
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
    season: "2026",
    team: "",
    player_name: "",
    position: "",
    depth_position: "",
    depth_rank: "",
    role: "",
    status: "",
    sleeper_id: "",
    gsis_id: "",
    player_id: "",
    source: "fixture",
    source_updated_at: "",
    notes: "",
    ...values,
  };
}
