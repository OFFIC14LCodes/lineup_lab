import { existsSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildRookieTeamConfirmationSourceReport,
  inspectRookieTeamConfirmationSource,
  normalizeRookiePositionValue,
  normalizeRookieTeamValue,
  writeRookieTeamConfirmationSourceArtifacts,
} from "./rookie-team-confirmation-source";

describe("rookie team confirmation source", () => {
  it("normalizes team and position aliases", () => {
    expect(normalizeRookieTeamValue("JAC")).toBe("JAX");
    expect(normalizeRookieTeamValue("WSH")).toBe("WAS");
    expect(normalizeRookieTeamValue("free agent")).toBe("FA");
    expect(normalizeRookieTeamValue("BAD")).toBe(null);
    expect(normalizeRookiePositionValue("pk")).toBe("K");
    expect(normalizeRookiePositionValue("D/ST")).toBe("DEF");
  });

  it("validates teams, draft fields, and missing identifiers", () => {
    const report = buildRookieTeamConfirmationSourceReport({
      season: 2026,
      inputPath: "fixture.csv",
      rawRows: [
        row({ player_id: "p1", player_name: "Rookie One", position: "WR", nfl_team: "JAC", draft_round: "1", draft_pick: "12" }),
        row({ player_name: "Fallback Rookie", position: "RB", college: "Sample", nfl_team: "KC" }),
        row({ player_id: "bad-team", player_name: "Bad Team", position: "TE", nfl_team: "ZZZ" }),
        row({ player_id: "bad-round", player_name: "Bad Round", position: "QB", nfl_team: "CHI", draft_round: "9" }),
        row({ player_id: "bad-pick", player_name: "Bad Pick", position: "LB", nfl_team: "DEN", draft_pick: "nope" }),
      ],
    });

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.sourceRows).toBe(5);
    expect(report.normalizedRows).toBe(2);
    expect(report.invalidRows).toBe(3);
    expect(report.missingIdentifierRows).toBe(1);
    expect(report.rows.find((candidate) => candidate.playerName === "Rookie One")).toMatchObject({ nflTeam: "JAX", position: "WR", draftRound: 1, draftPick: 12 });
    expect(report.issues.map((issue) => issue.issue)).toEqual(["missing_identifier", "invalid_nfl_team", "invalid_draft_round", "invalid_draft_pick"]);
  });

  it("deduplicates by strongest id and latest source timestamp", () => {
    const report = buildRookieTeamConfirmationSourceReport({
      season: 2026,
      inputPath: "fixture.csv",
      rawRows: [
        row({ player_id: "p1", player_name: "Rookie One", position: "WR", nfl_team: "KC", source_updated_at: "2026-06-17" }),
        row({ player_id: "p1", player_name: "Rookie One", position: "WR", nfl_team: "BUF", source_updated_at: "2026-06-18" }),
      ],
    });

    expect(report.normalizedRows).toBe(1);
    expect(report.duplicateRowsRemoved).toBe(1);
    expect(report.rows[0].nflTeam).toBe("BUF");
  });

  it("inspects source headers and suggests canonical mappings", () => {
    const report = inspectRookieTeamConfirmationSource("data/rookies/rookie-team-confirmation-2026.template.csv");

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.headers).toContain("player_name");
    expect(report.directMappedFields.player_name).toBe("player_name");
    expect(report.missingRequiredFields).toEqual([]);
    expect(report.suggestedMapping.nfl_team).toBe("nfl_team");
    expect(report.sampleRows.length).toBeGreaterThan(0);
  });

  it("writes normalized rookie artifacts", () => {
    const report = buildRookieTeamConfirmationSourceReport({
      season: 2096,
      inputPath: "fixture.csv",
      rawRows: [row({ player_id: "p1", player_name: "Rookie One", position: "WR", nfl_team: "KC" })],
    });
    const artifacts = writeRookieTeamConfirmationSourceArtifacts(report);
    try {
      expect(artifacts.jsonPath).toContain("rookie-team-confirmation-2096.normalized.json");
      expect(artifacts.markdownPath).toContain("rookie-team-confirmation-2096.normalized.md");
      expect(artifacts.csvPath).toContain("rookie-team-confirmation-2096.normalized.csv");
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
    college: "",
    nfl_team: "",
    draft_club: "",
    draft_round: "",
    draft_pick: "",
    source: "fixture",
    source_updated_at: "",
    notes: "",
    ...values,
  };
}
