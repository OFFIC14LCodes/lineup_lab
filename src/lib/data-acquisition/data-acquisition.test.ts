import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Papa from "papaparse";

import { buildRookieEnrichment } from "./build-rookie-enrichment";
import { buildCollegeProspectProfile } from "./college-prospect-profile";
import { loadCollegeProductionRecords } from "./college-production-source";
import { matchAcquiredPlayer } from "./player-identity-match";
import { normalizeProviderExport } from "./provider-export-normalizer";
import { loadDraftCapitalRecords } from "./nfl-draft-capital-source";
import { loadRoleNotesRecords } from "./role-notes-source";
import { generatePriorityFillFiles } from "./source-fill-workflow";
import { SOURCE_SCHEMAS, validateSourceFile } from "./source-file-validation";
import { sourceStatuses } from "./source-registry";

describe("data acquisition sources", () => {
  it("registers local sources and disables API adapters without keys", () => {
    const previousCfbd = process.env.CFBD_API_KEY;
    const previousSportsData = process.env.SPORTSDATAIO_API_KEY;
    delete process.env.CFBD_API_KEY;
    delete process.env.SPORTSDATAIO_API_KEY;
    try {
      const statuses = sourceStatuses();
      expect(statuses.some((source) => source.sourceId === "local_rookie_draft_capital_csv")).toBe(true);
      expect(statuses.find((source) => source.sourceId === "cfbd_api_college_stats")?.available).toBe(false);
      expect(statuses.find((source) => source.sourceId === "sportsdataio_context_api")?.available).toBe(false);
    } finally {
      if (previousCfbd !== undefined) process.env.CFBD_API_KEY = previousCfbd;
      if (previousSportsData !== undefined) process.env.SPORTSDATAIO_API_KEY = previousSportsData;
    }
  });

  it("parses draft capital records with attribution", () => {
    const filePath = tempCsv("playerId,playerName,position,team,season,nflDraftRound,nflDraftPick,nflDraftOverall,nflDraftTeam,source,sourceLabel,sourceConfidence,importedAt\np1,Test Rookie,QB,CHI,2026,1,2,2,CHI,nflverse,Test Source,high,2026-01-01T00:00:00.000Z\n");
    const rows = loadDraftCapitalRecords(filePath);
    expect(rows).toHaveLength(1);
    expect(rows[0].nflDraftOverall).toBe(2);
    expect(rows[0].attribution.sourceConfidence).toBe("high");
  });

  it("parses college production records without inventing missing stats", () => {
    const filePath = tempCsv(collegeCsv([{ playerId: "p1", playerName: "Test Rookie", position: "WR", college: "Example", collegeConference: "SEC", seasonRange: "2023-2025", games: "38", targets: "130", receptions: "91", receivingYards: "1430", receivingTouchdowns: "14", source: "manual", sourceLabel: "College Sheet", sourceConfidence: "medium", importedAt: "2026-01-01T00:00:00.000Z" }]));
    const rows = loadCollegeProductionRecords(filePath);
    expect(rows[0].stats.collegeReceivingYards).toBe(1430);
    expect(rows[0].stats.collegePassingYards).toBeNull();
    expect(rows[0].dataGaps).not.toContain("college production");
  });

  it("parses role notes and keeps unknown role as a data gap", () => {
    const filePath = tempCsv("playerId,playerName,position,team,season,landingSpotRole,opportunityNotes,roleSourceLabel,sourceConfidence,importedAt\np1,Test Rookie,RB,NE,2026,,\"camp note\",Manual Role,low,2026-01-01T00:00:00.000Z\n");
    const rows = loadRoleNotesRecords(filePath);
    expect(rows[0].landingSpotRole).toBe("unknown");
    expect(rows[0].dataGaps).toContain("landing spot role");
  });

  it("does not force ambiguous identity matches", () => {
    const match = matchAcquiredPlayer(
      { playerName: "Test Rookie", position: "WR" },
      [
        { playerId: "p1", playerName: "Test Rookie", position: "WR", team: "KC" },
        { playerId: "p2", playerName: "Test Rookie", position: "WR", team: "SF" },
      ]
    );
    expect(match.matchStatus).toBe("ambiguous");
    expect(match.playerId).toBeNull();
  });
});

describe("rookie enrichment acquisition builder", () => {
  it("merges non-empty local source values without ADP or fabricated fields", () => {
    const rookie = firstRookie();
    const draftPath = tempCsv(`playerId,playerName,position,team,season,nflDraftRound,nflDraftPick,nflDraftOverall,nflDraftTeam,source,sourceLabel,sourceConfidence,importedAt\n${rookie.playerId},${rookie.playerName},${rookie.position},${rookie.team},2026,2,4,36,${rookie.team},manual,Unit Draft,medium,2026-01-01T00:00:00.000Z\n`);
    const collegePath = tempCsv(collegeCsv([{ playerId: rookie.playerId, playerName: rookie.playerName, position: rookie.position, college: "Example", collegeConference: "SEC", seasonRange: "2023-2025", games: "38", targets: "120", receptions: "80", receivingYards: "1100", receivingTouchdowns: "10", source: "manual", sourceLabel: "Unit College", sourceConfidence: "medium", importedAt: "2026-01-01T00:00:00.000Z" }]));
    const rolePath = tempCsv(`playerId,playerName,position,team,season,landingSpotRole,opportunityNotes,roleSourceLabel,sourceConfidence,importedAt\n${rookie.playerId},${rookie.playerName},${rookie.position},${rookie.team},2026,committee,verified local note,Unit Role,low,2026-01-01T00:00:00.000Z\n`);
    const report = buildRookieEnrichment({
      draftCapitalPath: draftPath,
      collegeProductionPath: collegePath,
      roleNotesPath: rolePath,
      writeFiles: false,
    });
    expect(report.counts.appliedValues).toBeGreaterThan(0);
    expect(report.safety.noAdpFallback).toBe(true);
    expect(report.safety.noFabricatedFields).toBe(true);
    expect(report.populatedFields).not.toHaveProperty("adp");
  });

  it("does not overwrite with blank source values", () => {
    const rookie = firstRookie();
    const draftPath = tempCsv(`playerId,playerName,position,team,season,nflDraftRound,nflDraftPick,nflDraftOverall,nflDraftTeam,source,sourceLabel,sourceConfidence,importedAt\n${rookie.playerId},${rookie.playerName},${rookie.position},${rookie.team},2026,,,,,manual,Blank Draft,low,2026-01-01T00:00:00.000Z\n`);
    const report = buildRookieEnrichment({ draftCapitalPath: draftPath, collegeProductionPath: tempCsv(collegeHeader()), roleNotesPath: tempCsv(roleHeader()), writeFiles: false });
    expect(report.counts.appliedValues).toBe(0);
    expect(report.safety.noBlankOverwrite).toBe(true);
  });

  it("supports priority-only filtering", () => {
    const rookie = firstRookie();
    const other = secondRookie();
    const draftPath = tempCsv(`playerId,playerName,position,team,season,nflDraftRound,nflDraftPick,nflDraftOverall,nflDraftTeam,source,sourceLabel,sourceConfidence,importedAt\n${other.playerId},${other.playerName},${other.position},${other.team},2026,1,1,1,${other.team},manual,Other Draft,medium,2026-01-01T00:00:00.000Z\n${rookie.playerId},${rookie.playerName},${rookie.position},${rookie.team},2026,1,2,2,${rookie.team},manual,Priority Draft,medium,2026-01-01T00:00:00.000Z\n`);
    const report = buildRookieEnrichment({ priorityOnly: true, draftCapitalPath: draftPath, collegeProductionPath: tempCsv(collegeHeader()), roleNotesPath: tempCsv(roleHeader()), writeFiles: false });
    expect(report.counts.skippedByPriorityOnly).toBeGreaterThanOrEqual(0);
    expect(report.counts.sourceRows).toBe(2);
  });
});

describe("source population workflow", () => {
  it("validates source templates and preserves blanks as non-data", () => {
    const filePath = tempCsv(`${SOURCE_SCHEMAS["draft-capital"].columns.join(",")}\np1,Test Rookie,QB,CHI,2026,,,,,manual,,low\n`);
    const result = validateSourceFile("draft-capital", filePath);
    expect(result.rowCount).toBe(1);
    expect(result.rowsWithData).toBe(0);
    expect(result.invalidRows).toBe(0);
  });

  it("warns or rejects malformed non-empty source values", () => {
    const filePath = tempCsv(`${SOURCE_SCHEMAS["draft-capital"].columns.join(",")}\np1,Test Rookie,QB,CHI,2026,first,,,CHI,manual,Unit Source,medium\n`);
    const result = validateSourceFile("draft-capital", filePath);
    expect(result.invalidRows).toBe(1);
    expect(result.issues.some((issue) => issue.field === "nflDraftRound")).toBe(true);
  });

  it("requires attribution when a source row has data", () => {
    const filePath = tempCsv(`${SOURCE_SCHEMAS["draft-capital"].columns.join(",")}\np1,Test Rookie,QB,CHI,2026,1,,1,CHI,,Unit Source,\n`);
    const result = validateSourceFile("draft-capital", filePath);
    expect(result.invalidRows).toBe(1);
    expect(result.issues.some((issue) => issue.field === "source")).toBe(true);
    expect(result.issues.some((issue) => issue.field === "sourceConfidence")).toBe(true);
  });

  it("generates priority fill files from the priority rookie list", () => {
    const files = generatePriorityFillFiles(5);
    expect(files).toHaveLength(3);
    expect(files.every((file) => file.rows >= 0)).toBe(true);
  });

  it("normalizes provider exports only from explicit column maps", () => {
    const inputPath = tempCsv("id,name,pos,nfl_team,year,round,overall,source_name\np1,Test Rookie,QB,CHI,2026,1,1,Provider Sheet\n");
    const result = normalizeProviderExport({
      kind: "draft-capital",
      inputPath,
      columnMap: {
        playerId: "id",
        playerName: "name",
        position: "pos",
        team: "nfl_team",
        season: "year",
        nflDraftRound: "round",
        nflDraftOverall: "overall",
        sourceLabel: "source_name",
      },
    });
    expect(result.verdict).toBe("passed");
    expect(result.rows[0].nflDraftRound).toBe("1");
    expect(result.rows[0].nflDraftPick).toBe("");
  });

  it("reports provider export mapping failures without guessing missing columns", () => {
    const inputPath = tempCsv("id,name\np1,Test Rookie\n");
    const result = normalizeProviderExport({
      kind: "draft-capital",
      inputPath,
      columnMap: { playerId: "missing_id", playerName: "name" },
    });
    expect(result.verdict).toBe("failed");
    expect(result.missingMappedColumns).toContain("missing_id");
  });
});

describe("college prospect profile", () => {
  it("builds profiles from source records and leaves missing context as gaps", () => {
    const draft = loadDraftCapitalRecords(tempCsv("playerId,playerName,position,team,season,nflDraftRound,nflDraftPick,nflDraftOverall,nflDraftTeam,source,sourceLabel,sourceConfidence,importedAt\np1,Test Rookie,RB,LV,2026,3,5,69,LV,manual,Draft,medium,2026-01-01T00:00:00.000Z\n"))[0];
    const profile = buildCollegeProspectProfile({ draftCapital: draft });
    expect(profile.draftCapitalScore).not.toBeNull();
    expect(profile.collegeProductionScore).toBeNull();
    expect(profile.dataGaps).toContain("college production");
  });
});

function tempCsv(contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "blackbird-acquisition-"));
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "source.csv");
  writeFileSync(filePath, contents);
  return filePath;
}

function firstRookie() {
  return rookieAt(0);
}

function secondRookie() {
  return rookieAt(1);
}

function rookieAt(index: number) {
  const rows = Papa.parse<Record<string, string>>(readFileSync(path.join(process.cwd(), "data", "rookies", "rookie-data.csv"), "utf8"), { header: true, skipEmptyLines: true }).data;
  const row = rows[index];
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
  };
}

function collegeHeader() {
  return "playerId,playerName,position,college,collegeConference,seasonRange,games,passingAttempts,completions,passingYards,passingTouchdowns,interceptions,rushingAttempts,rushingYards,rushingTouchdowns,targets,receptions,receivingYards,receivingTouchdowns,soloTackles,assistedTackles,totalTackles,tacklesForLoss,sacks,interceptionsDef,passesDefended,forcedFumbles,fumbleRecoveries,source,sourceLabel,sourceConfidence,importedAt\n";
}

function roleHeader() {
  return "playerId,playerName,position,team,season,landingSpotRole,opportunityNotes,roleSourceLabel,sourceConfidence,importedAt\n";
}

function collegeCsv(rows: Array<Record<string, string>>) {
  return Papa.unparse({
    fields: collegeHeader().trim().split(","),
    data: rows,
  }) + "\n";
}
