import { describe, expect, it } from "vitest";

import { normalizeImportRecords, parseImportPayload } from "@/lib/providers/import/parse";

describe("provider import parsing", () => {
  it("parses weekly stats csv with stat_ and meta_ columns", () => {
    const parsed = parseImportPayload({
      datasetKind: "weekly_stats",
      provider: "manual",
      filename: "weekly-stats.csv",
      fileMimeType: "text/csv",
      fileContent: [
        "fullName,team,position,season,week,providerExternalId,stat_pass_yd,meta_source",
        "Patrick Mahomes,KC,QB,2025,1,mahomes-15,275,manual-sheet"
      ].join("\n")
    });

    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].stats).toEqual({ pass_yd: 275 });
    expect(parsed.records[0].metadata).toEqual({ source: "manual-sheet" });

    const normalized = normalizeImportRecords(parsed);
    expect(normalized.records).toHaveLength(1);
    expect(normalized.records[0].kind).toBe("weekly_stats");
  });

  it("parses projection json payloads with records arrays", () => {
    const parsed = parseImportPayload({
      datasetKind: "projection",
      provider: "manual",
      filename: "projection.json",
      fileMimeType: "application/json",
      fileContent: JSON.stringify({
        records: [
          {
            fullName: "Justin Jefferson",
            team: "MIN",
            position: "WR",
            season: 2025,
            projectionType: "weekly",
            week: 1,
            stats: { rec_yd: 102 },
            providerFantasyPoints: 19.4
          }
        ]
      })
    });

    expect(parsed.records).toHaveLength(1);
    const normalized = normalizeImportRecords(parsed);
    expect(normalized.records[0].kind).toBe("projection");
    if (normalized.records[0].kind !== "projection") {
      throw new Error("Expected projection record.");
    }
    expect(normalized.records[0].providerFantasyPoints).toBe(19.4);
  });

  it("rejects payloads over the import row limit", () => {
    const rows = [
      "fullName,team,position,season,week"
    ];

    for (let index = 0; index < 251; index += 1) {
      rows.push(`Player ${index},KC,WR,2025,1`);
    }

    expect(() =>
      parseImportPayload({
        datasetKind: "weekly_stats",
        provider: "manual",
        filename: "too-many.csv",
        fileMimeType: "text/csv",
        fileContent: rows.join("\n")
      })
    ).toThrow("maximum of 250");
  });
});
