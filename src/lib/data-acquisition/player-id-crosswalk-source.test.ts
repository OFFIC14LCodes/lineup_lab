import { describe, expect, it } from "vitest";

import { buildPlayerIdCrosswalkSourceReport } from "./player-id-crosswalk-source";

describe("player ID crosswalk source", () => {
  it("normalizes source rows and keeps review-only rows unconfirmed", () => {
    const report = buildPlayerIdCrosswalkSourceReport({
      season: 2026,
      inputPath: "in-memory.csv",
      rawRows: [
        {
          sleeper_id: "s1",
          gsis_id: "00-001",
          player_id: "00-001",
          player_name: "Alpha Player",
          position: "qb",
          team: "jac",
          source: "unit",
          source_updated_at: "2026-01-01",
          confidence: "source_declared",
        },
        {
          sleeper_id: "s2",
          player_name: "Beta Player",
          position: "WR",
          team: "DAL",
          confidence: "name_team_position",
        },
      ],
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.normalizedRows).toBe(2);
    expect(report.missingGsisRows).toBe(1);
    expect(report.rows[0]).toMatchObject({
      sleeperId: "s1",
      gsisId: "00-001",
      position: "QB",
      team: "JAX",
      confidence: "source_declared",
    });
    expect(report.rows[1]).toMatchObject({
      sleeperId: "s2",
      gsisId: null,
      confidence: "name_team_position",
    });
  });

  it("reports one-to-many crosswalk conflicts", () => {
    const report = buildPlayerIdCrosswalkSourceReport({
      season: 2026,
      inputPath: "in-memory.csv",
      rawRows: [
        { sleeper_id: "s1", gsis_id: "00-001", confidence: "exact_id" },
        { sleeper_id: "s1", gsis_id: "00-002", confidence: "exact_id" },
        { sleeper_id: "s2", gsis_id: "00-002", confidence: "exact_id" },
      ],
    });

    expect(report.conflictGroups.sleeperIdToMultipleGsis.s1).toEqual(["00-001", "00-002"]);
    expect(report.conflictGroups.gsisIdToMultipleSleeper["00-002"]).toEqual(["s1", "s2"]);
  });
});
