import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadRookieData, rookieProfileForPlayer } from "./rookie-data-loader";

describe("rookie data loader", () => {
  it("loads local CSV data, normalizes role text, and matches by name plus position plus team", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    writeFileSync(
      csvPath,
      [
        "playerName,position,team,season,nflDraftRound,nflDraftOverall,collegeReceptions,collegeReceivingYards,landingSpotRole,source",
        "Test Rookie,WR,KC,2026,2,45,78,1100,Probable Starter,manual",
      ].join("\n")
    );

    const result = loadRookieData({
      filePath: csvPath,
      candidates: [{ id: "p1", full_name: "Test Rookie", position: "WR", team: "KC" }],
      dryRun: true,
    });

    expect(result.validRows).toBe(1);
    expect(result.matchedRows).toBe(1);
    expect(result.rows[0].matchStatus).toBe("matched_name_position_team");
    expect(result.namePositionTeamMatches).toBe(1);
    expect(result.rows[0].profile.landingSpotRole).toBe("probable_starter");
    expect(result.rows[0].profile.playerId).toBe("p1");
    expect(result.rows[0].profile.draftCapitalScore).not.toBeNull();
  });

  it("returns explicit errors for invalid rows without persistence", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    writeFileSync(csvPath, "playerName,position,season\n,WR,2026\n");

    const result = loadRookieData({ filePath: csvPath, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(1);
    expect(result.errors).toContain("playerName is required");
  });

  it("matches by explicit player id before name matching", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    writeFileSync(csvPath, "playerId,playerName,position,season,source\np2,Wrong Name,RB,2026,manual\n");

    const result = loadRookieData({
      filePath: csvPath,
      candidates: [{ id: "p2", full_name: "Right Name", position: "RB", team: "DAL" }],
    });

    expect(result.rows[0].matchStatus).toBe("matched_id");
    expect(result.exactIdMatches).toBe(1);
    expect(result.rows[0].matchedPlayerId).toBe("p2");
  });

  it("matches by unique name only only when safe", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    writeFileSync(csvPath, "playerName,position,season,source\nUnique Rookie,WR,2026,manual\n");

    const result = loadRookieData({
      filePath: csvPath,
      candidates: [{ id: "p3", full_name: "Unique Rookie", position: "RB", team: "NYJ" }],
    });

    expect(result.rows[0].matchStatus).toBe("matched_name_only");
    expect(result.nameOnlyUniqueMatches).toBe(1);
  });

  it("rejects ambiguous candidate matches without forcing a player id", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    writeFileSync(csvPath, "playerName,position,season,source\nDuplicate Rookie,WR,2026,manual\n");

    const result = loadRookieData({
      filePath: csvPath,
      candidates: [
        { id: "p4", full_name: "Duplicate Rookie", position: "WR", team: "KC" },
        { id: "p5", full_name: "Duplicate Rookie", position: "WR", team: "LAC" },
      ],
    });

    expect(result.rows[0].matchStatus).toBe("ambiguous");
    expect(result.rows[0].matchedPlayerId).toBeNull();
    expect(result.rows[0].unresolvedReason).toContain("ambiguous");
    expect(result.ambiguousMatches).toBe(1);
  });

  it("loads JSON rookie data with the same schema", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const jsonPath = path.join(dir, "rookies.json");
    writeFileSync(jsonPath, JSON.stringify([{ playerName: "Json Rookie", position: "QB", season: 2026, source: "manual", nflDraftOverall: 12 }]));

    const result = loadRookieData({
      filePath: jsonPath,
      candidates: [{ id: "p6", full_name: "Json Rookie", position: "QB", team: "TEN" }],
    });

    expect(result.validRows).toBe(1);
    expect(result.rows[0].profile.draftCapitalScore).toBe(95);
  });

  it("looks up imported profiles by canonical id or generated rookie key", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    writeFileSync(
      csvPath,
      [
        "playerName,position,team,season,nflDraftRound,nflDraftOverall,collegeSoloTackles,collegePassesDefended,source",
        "Lookup Rookie,DB,JAX,2026,3,88,64,10,manual",
      ].join("\n")
    );
    const result = loadRookieData({ filePath: csvPath });
    const sample = result.rows[0].profile;

    expect(rookieProfileForPlayer(result.profilesByPlayerId, { id: sample.playerId, full_name: sample.playerName, position: sample.position }, sample.season)).toEqual(sample);
    expect(rookieProfileForPlayer(result.profilesByPlayerId, { full_name: sample.playerName, position: sample.position }, sample.season)).toEqual(sample);
  });

  it("merges enrichment overlays by player id without overwriting known base values with blanks", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    const enrichmentPath = path.join(dir, "rookie-enrichment.csv");
    writeFileSync(
      csvPath,
      [
        "playerId,playerName,position,team,season,college,source",
        "p7,Enriched Rookie,RB,LV,2026,Boise State,manual",
      ].join("\n")
    );
    writeFileSync(
      enrichmentPath,
      [
        "playerId,playerName,position,team,season,college,nflDraftRound,nflDraftOverall,collegeGames,collegeRushingYards,landingSpotRole,sourceLabel",
        "p7,Enriched Rookie,RB,LV,2026,,1,6,14,1500,Committee,verified_overlay",
      ].join("\n")
    );

    const result = loadRookieData({ filePath: csvPath, enrichmentPath });

    expect(result.enrichmentRows).toBe(1);
    expect(result.matchedEnrichmentRows).toBe(1);
    expect(result.conflictCount).toBe(0);
    expect(result.rows[0].input.college).toBe("Boise State");
    expect(result.rows[0].profile.draftCapitalScore).toBe(95);
    expect(result.rows[0].profile.collegeProductionScore).not.toBeNull();
    expect(result.rows[0].profile.landingSpotRole).toBe("committee");
    expect(result.rows[0].profile.sourceLabels).toEqual(expect.arrayContaining(["rookies.csv + verified_overlay"]));
  });

  it("reports enrichment conflicts and keeps the base value", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    const enrichmentPath = path.join(dir, "rookie-enrichment.csv");
    writeFileSync(csvPath, "playerId,playerName,position,season,nflDraftOverall,source\np8,Conflict Rookie,QB,2026,1,manual\n");
    writeFileSync(enrichmentPath, "playerId,season,nflDraftOverall,sourceLabel\np8,2026,12,conflicting_overlay\n");

    const result = loadRookieData({ filePath: csvPath, enrichmentPath });

    expect(result.conflictCount).toBe(1);
    expect(result.conflicts[0]).toMatchObject({
      playerId: "p8",
      field: "nflDraftOverall",
      baseValue: "1",
      enrichmentValue: "12",
      sourceLabel: "conflicting_overlay",
    });
    expect(result.rows[0].input.nflDraftOverall).toBe(1);
    expect(result.rows[0].profile.draftCapitalScore).toBe(95);
  });

  it("rejects ambiguous enrichment overlays without merging", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    const enrichmentPath = path.join(dir, "rookie-enrichment.csv");
    writeFileSync(
      csvPath,
      [
        "playerName,position,team,season,source",
        "Ambiguous Rookie,WR,KC,2026,manual",
        "Ambiguous Rookie,WR,LAC,2026,manual",
      ].join("\n")
    );
    writeFileSync(enrichmentPath, "playerName,position,season,nflDraftOverall,sourceLabel\nAmbiguous Rookie,WR,2026,22,ambiguous_overlay\n");

    const result = loadRookieData({ filePath: csvPath, enrichmentPath });

    expect(result.ambiguousEnrichmentRows).toBe(1);
    expect(result.matchedEnrichmentRows).toBe(0);
    expect(result.enrichmentResults[0].unresolvedReason).toContain("ambiguous");
    expect(result.rows.map((row) => row.input.nflDraftOverall)).toEqual([null, null]);
  });

  it("loads JSON enrichment overlays", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rookie-loader-"));
    const csvPath = path.join(dir, "rookies.csv");
    const enrichmentPath = path.join(dir, "rookie-enrichment.json");
    writeFileSync(csvPath, "playerName,position,team,season,source\nJson Enriched Rookie,LB,CLE,2026,manual\n");
    writeFileSync(
      enrichmentPath,
      JSON.stringify([
        {
          playerName: "Json Enriched Rookie",
          position: "LB",
          team: "CLE",
          season: 2026,
          nflDraftRound: 2,
          nflDraftOverall: 33,
          collegeTotalTackles: 110,
          collegeSacks: 4,
          landingSpotRole: "probable_starter",
          sourceLabel: "json_overlay",
        },
      ])
    );

    const result = loadRookieData({ filePath: csvPath, enrichmentPath });

    expect(result.matchedEnrichmentRows).toBe(1);
    expect(result.rows[0].profile.draftCapitalScore).toBe(70);
    expect(result.rows[0].profile.collegeProductionScore).not.toBeNull();
    expect(result.rows[0].profile.rookieProjectionConfidence).toBe("medium");
  });
});
