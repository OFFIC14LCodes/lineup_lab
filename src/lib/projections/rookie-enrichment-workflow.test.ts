import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadRookieData } from "./rookie-data-loader";
import {
  buildPriorityExportRows,
  buildRookieEnrichmentPriorityRows,
  buildRookieEnrichmentTemplateRows,
  coverageSummary,
  ROOKIE_ENRICHMENT_PRIORITY_COLUMNS,
  ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS,
  serializeCsv,
} from "./rookie-enrichment-workflow";

describe("rookie enrichment workflow", () => {
  it("generates a production template with trusted identity fields and blank unknown enrichment values", () => {
    const loadResult = loadFixture();
    const rows = buildRookieEnrichmentTemplateRows(loadResult);

    expect(ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS).toContain("nflDraftOverall");
    expect(ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS).toContain("collegeReceivingYards");
    expect(ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS).toContain("landingSpotRole");
    expect(rows[0]).toMatchObject({
      playerId: "r1",
      playerName: "Priority Rookie",
      position: "WR",
      team: "KC",
      season: "2026",
      source: "manual",
      sourceLabel: "rookie-enrichment",
      nflDraftOverall: "",
      collegeReceivingYards: "",
      landingSpotRole: "",
    });
  });

  it("prioritizes real-room, ranked, very-low-trust rookies without ADP", () => {
    const loadResult = loadFixture();
    const priorities = buildRookieEnrichmentPriorityRows({
      rookieRows: loadResult.rows,
      realRoomPlayerIds: new Set(["r1"]),
      blackbirdRanksByPlayerId: new Map([["r1", 12]]),
      draftSuggestionRanksByPlayerId: new Map([["r1", 3]]),
      scarcePositions: new Set(["WR"]),
    });

    expect(priorities[0]).toMatchObject({
      playerId: "r1",
      priorityTier: "critical",
      currentBlackbirdRank: 12,
      currentDraftSuggestionRank: 3,
    });
    expect(priorities[0].reasons.join(" ")).not.toMatch(/adp/i);
    expect(priorities[0].missingFields).toEqual(expect.arrayContaining(["nflDraftRound/nflDraftOverall", "college production", "landingSpotRole"]));
  });

  it("generates a fillable priority export and keeps helper columns out of projection inputs", () => {
    const loadResult = loadFixture();
    const priorities = buildRookieEnrichmentPriorityRows({
      rookieRows: loadResult.rows,
      realRoomPlayerIds: new Set(["r1"]),
      blackbirdRanksByPlayerId: new Map([["r1", 8]]),
      draftSuggestionRanksByPlayerId: new Map([["r1", 2]]),
    });
    const exportRows = buildPriorityExportRows(priorities, loadResult.rows, 100);
    const csv = serializeCsv(exportRows, ROOKIE_ENRICHMENT_PRIORITY_COLUMNS);

    expect(exportRows.length).toBeGreaterThan(0);
    expect(csv.split("\n")[0]).toContain("priorityTier,priorityScore,priorityReasons,playerId");

    const dir = mkdtempSync(path.join(tmpdir(), "rookie-priority-helper-"));
    const enrichmentPath = path.join(dir, "rookie-enrichment.csv");
    writeFileSync(
      enrichmentPath,
      [
        "priorityTier,priorityScore,priorityReasons,playerId,season,nflDraftOverall",
        "critical,99,helper text,r1,2026,15",
      ].join("\n")
    );
    const merged = loadRookieData({ filePath: fixturePath(dir), enrichmentPath });
    expect(merged.matchedEnrichmentRows).toBe(1);
    expect(merged.rows[0].profile.draftCapitalScore).toBe(95);
    expect(merged.rows[0].profile.sourceLabels.join(" ")).not.toContain("critical");
  });

  it("reports partial enrichment coverage while blank fields remain gaps", () => {
    const loadResult = loadFixture();
    const summary = coverageSummary(loadResult);

    expect(summary.totalRookies).toBe(2);
    expect(summary.rowsWithDraftCapital).toBe(0);
    expect(summary.rowsWithCollegeProduction).toBe(0);
    expect(summary.rowsWithLandingSpotRole).toBe(0);
    expect(summary.coverageByPosition.WR.total).toBe(1);
  });
});

function loadFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "rookie-enrichment-workflow-"));
  return loadRookieData({ filePath: fixturePath(dir), useEnrichment: false });
}

function fixturePath(dir: string) {
  const csvPath = path.join(dir, "rookies.csv");
  writeFileSync(
    csvPath,
    [
      "playerId,playerName,position,team,season,source,sourceLabel",
      "r1,Priority Rookie,WR,KC,2026,derived,players.metadata_json",
      "r2,Lower Rookie,K,DAL,2026,derived,players.metadata_json",
    ].join("\n")
  );
  return csvPath;
}
