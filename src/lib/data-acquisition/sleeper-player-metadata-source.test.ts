import { describe, expect, it } from "vitest";

import { buildSleeperPlayerMetadataReport } from "./sleeper-player-metadata-source";

describe("sleeper player metadata source", () => {
  it("normalizes raw Sleeper metadata rows", () => {
    const report = buildSleeperPlayerMetadataReport({
      season: 2026,
      inputPath: "in-memory.json",
      rawRows: [
        {
          player_id: "s1",
          full_name: "Alpha Player",
          first_name: "Alpha",
          last_name: "Player",
          position: "QB",
          team: "jac",
          status: "Active",
          active: true,
          fantasy_positions: ["QB"],
          search_rank: "123",
          years_exp: "2",
          age: "24",
        },
        {
          player_id: "s2",
          full_name: "Beta Player",
          position: "WR",
          team: null,
          status: "Inactive",
          active: false,
          fantasy_positions: ["WR"],
        },
      ],
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.normalizedRows).toBe(2);
    expect(report.activeRows).toBe(1);
    expect(report.inactiveRows).toBe(1);
    expect(report.missingTeamRows).toBe(1);
    expect(report.rows.find((row) => row.sleeperId === "s1")).toMatchObject({
      playerName: "Alpha Player",
      position: "QB",
      team: "JAX",
      normalizedStatus: "active",
      active: true,
      searchRank: 123,
      yearsExperience: 2,
      age: 24,
    });
  });

  it("reports invalid rows without ids", () => {
    const report = buildSleeperPlayerMetadataReport({
      season: 2026,
      inputPath: "in-memory.json",
      rawRows: [{ full_name: "Missing Id" }],
    });

    expect(report.normalizedRows).toBe(0);
    expect(report.invalidRows).toBe(1);
    expect(report.issues[0].issue).toBe("invalid_player_metadata");
  });
});
