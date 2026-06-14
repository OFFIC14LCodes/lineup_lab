import { describe, expect, it } from "vitest";

import { parseCsvAdp } from "./csv";

const FANTASYPROS_SAMPLE = `Player Team (Bye),Pos,Team,BYE,AVG,BEST,WORST,STDEV,ADP,%DRAFTED
"Patrick Mahomes KC (7)",QB,KC,7,32.4,19,48,6.2,32.4,99.0
"Justin Jefferson MIN (6)",WR,MIN,6,10.1,5,18,3.4,10.1,99.0
"Christian McCaffrey SF (9)",RB,SF,9,2.3,1,8,1.9,2.3,99.0
"Travis Kelce KC (7)",TE,KC,7,25.7,15,38,5.8,25.7,98.5
"Davante Adams LVR (13)",WR,LVR,13,45.2,36,54,5.1,45.2,97.2
`;

const GENERIC_SAMPLE = `Player,Position,Team,ADP,BEST,WORST,STD DEV
Patrick Mahomes,QB,KC,32.4,19,48,6.2
Justin Jefferson,WR,MIN,10.1,5,18,3.4
Christian McCaffrey,RB,SF,2.3,1,8,1.9
Travis Kelce,TE,KC,25.7,15,38,5.8
`;

describe("parseCsvAdp — FantasyPros format", () => {
  it("parses a FantasyPros CSV sample correctly", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    expect(result.detectedFormat).toBe("fantasypros");
    expect(result.raw).toHaveLength(5);
    expect(result.skippedRows).toBe(0);
  });

  it("extracts correct player names from 'Player Team (Bye)' format", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    const names = result.raw.map((r) => r.rawName);
    expect(names).toContain("Patrick Mahomes");
    expect(names).toContain("Justin Jefferson");
    expect(names).toContain("Christian McCaffrey");
    expect(names).toContain("Travis Kelce");
  });

  it("extracts numeric ADP values (sorted ascending by ADP)", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    // After ascending sort: CMC(2.3), Jefferson(10.1), Kelce(25.7), Mahomes(32.4), Adams(45.2)
    expect(result.raw[0].overallAdp).toBeCloseTo(2.3);
    expect(result.raw[0].rawName).toBe("Christian McCaffrey");
    const mahomes = result.raw.find((r) => r.rawName === "Patrick Mahomes")!;
    expect(mahomes.overallAdp).toBeCloseTo(32.4);
  });

  it("extracts min and max picks (BEST, WORST)", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    const mahomes = result.raw.find((r) => r.rawName === "Patrick Mahomes")!;
    expect(mahomes.minPick).toBe(19);
    expect(mahomes.maxPick).toBe(48);
  });

  it("extracts std dev", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    const mahomes = result.raw.find((r) => r.rawName === "Patrick Mahomes")!;
    expect(mahomes.stddev).toBeCloseTo(6.2);
  });

  it("extracts position", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    const mahomes = result.raw.find((r) => r.rawName === "Patrick Mahomes")!;
    const kelce = result.raw.find((r) => r.rawName === "Travis Kelce")!;
    expect(mahomes.rawPosition).toBe("QB");
    expect(kelce.rawPosition).toBe("TE");
  });

  it("sorts by ascending ADP", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    for (let i = 1; i < result.raw.length; i++) {
      expect(result.raw[i].overallAdp).toBeGreaterThanOrEqual(result.raw[i - 1].overallAdp);
    }
  });

  it("generates a SHA-256 file hash", () => {
    const result = parseCsvAdp(FANTASYPROS_SAMPLE);
    expect(result.fileHash).toHaveLength(64);
    expect(result.fileHash).toMatch(/^[0-9a-f]+$/);
  });

  it("different content produces different hash", () => {
    const r1 = parseCsvAdp(FANTASYPROS_SAMPLE);
    const r2 = parseCsvAdp(FANTASYPROS_SAMPLE + "\n");
    expect(r1.fileHash).not.toBe(r2.fileHash);
  });
});

describe("parseCsvAdp — generic format", () => {
  it("parses generic CSV format", () => {
    const result = parseCsvAdp(GENERIC_SAMPLE);
    expect(result.raw).toHaveLength(4);
    // After ascending sort: CMC(2.3) first, Mahomes(32.4) last
    expect(result.raw[0].rawName).toBe("Christian McCaffrey");
    const mahomes = result.raw.find((r) => r.rawName === "Patrick Mahomes")!;
    expect(mahomes.overallAdp).toBeCloseTo(32.4);
  });

  it("detects generic format", () => {
    const result = parseCsvAdp(GENERIC_SAMPLE);
    expect(result.detectedFormat).toBe("generic");
  });
});

describe("parseCsvAdp — edge cases", () => {
  it("returns empty records for empty string", () => {
    const result = parseCsvAdp("");
    expect(result.raw).toHaveLength(0);
  });

  it("returns empty records when header has no AVG column", () => {
    const noAvg = "Player,Position,Team\nPatrick Mahomes,QB,KC\n";
    const result = parseCsvAdp(noAvg);
    expect(result.raw).toHaveLength(0);
  });

  it("skips rows with no ADP value", () => {
    const withMissing = `Player,Position,Team,AVG
Patrick Mahomes,QB,KC,32.4
,,,-
Travis Kelce,TE,KC,25.7
`;
    const result = parseCsvAdp(withMissing);
    expect(result.raw).toHaveLength(2);
    expect(result.skippedRows).toBeGreaterThanOrEqual(1);
  });

  it("handles BOM-prefixed CSV", () => {
    const withBom = "﻿" + GENERIC_SAMPLE;
    const result = parseCsvAdp(withBom);
    expect(result.raw).toHaveLength(4);
  });

  it("handles quoted fields with commas", () => {
    const withQuotes = `Player,Position,Team,AVG
"Smith, Jr., John",RB,DAL,88.0
`;
    const result = parseCsvAdp(withQuotes);
    expect(result.raw).toHaveLength(1);
    // Name after extractFPName (no bye week pattern) → raw as-is
    expect(result.raw[0].rawName).toContain("Smith");
    expect(result.raw[0].overallAdp).toBe(88.0);
  });
});
