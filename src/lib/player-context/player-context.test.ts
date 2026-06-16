import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPlayerContext } from "./player-context-builder";
import { buildDepthChartPossibility } from "./depth-chart-possibilities";
import { deriveInjuryRisk } from "./injury-risk";
import { bmi } from "./player-context-normalization";
import { loadContextSource } from "./sources/local-context-source";

describe("player context source parsing", () => {
  it("parses physical profile context with attribution", () => {
    const filePath = tempCsv("playerId,playerName,position,team,season,heightInches,weightPounds,armLengthInches,handSizeInches,wingspanInches,source,sourceLabel,sourceConfidence\np1,Test Player,WR,KC,2026,72,200,,,,manual,Verified sheet,medium\n");
    const rows = loadContextSource("physical-profile", filePath);
    expect(rows).toHaveLength(1);
    expect(rows[0].values.heightInches).toBe(72);
    expect(rows[0].attribution.sourceLabel).toBe("Verified sheet");
  });

  it("parses athletic testing without filling missing values", () => {
    const filePath = tempCsv("playerId,playerName,position,team,season,fortyYardDash,tenYardSplit,verticalJumpInches,broadJumpInches,threeCone,shuttle,benchPressReps,speedScore,burstScore,agilityScore,source,sourceLabel,sourceConfidence\np1,Test Player,RB,KC,2026,4.45,,,,,,,,,,manual,Testing sheet,medium\n");
    const rows = loadContextSource("athletic-testing", filePath);
    expect(rows[0].values.fortyYardDash).toBe(4.45);
    expect(rows[0].values.verticalJumpInches).toBeNull();
  });

  it("parses depth chart and role context", () => {
    const depth = loadContextSource("depth-chart", tempCsv("playerId,playerName,position,team,season,depthChartPosition,depthChartLabel,primaryCompetition,pathToCeiling,pathToFloor,depthChartConfidence,source,sourceLabel,sourceConfidence\np1,Test Player,RB,KC,2026,2,RB2,Player A|Player B,earns passing-down work,loses committee work,medium,manual,Depth sheet,medium\n"))[0];
    const role = loadContextSource("role-notes", tempCsv("playerId,playerName,position,team,season,currentRole,floorRole,ceilingRole,roleConfidence,expectedGamesActive,expectedGamesStarted,expectedSnapShare,expectedRouteShare,expectedRushShare,expectedTargetShare,expectedTackleOpportunity,source,sourceLabel,sourceConfidence\np1,Test Player,RB,KC,2026,committee,backup,committee_lead,medium,17,2,45,,,,,manual,Role sheet,medium\n"))[0];
    expect(depth.values.primaryCompetition).toEqual(["Player A", "Player B"]);
    expect(role.values.expectedSnapShare).toBe(0.45);
  });

  it("keeps empty source files as data gaps", () => {
    const rows = loadContextSource("injury-history", tempCsv("playerId,playerName,position,team,season,gamesMissedLastSeason,gamesMissedLast3Seasons,notableInjuries,currentInjuryStatus,majorSurgeryFlag,repeatedSoftTissueFlag,source,sourceLabel,sourceConfidence\n"));
    expect(rows).toHaveLength(0);
  });
});

describe("player context models", () => {
  it("does not treat missing injury data as low risk", () => {
    const risk = deriveInjuryRisk({ gamesMissedLastSeason: null, gamesMissedLast3Seasons: null, notableInjuries: [], currentInjuryStatus: null });
    expect(risk.injuryRisk).toBe("unknown");
  });

  it("derives injury risk only from sourced data", () => {
    const risk = deriveInjuryRisk({ gamesMissedLastSeason: 7, gamesMissedLast3Seasons: 11, notableInjuries: ["hamstring"], currentInjuryStatus: null });
    expect(risk.injuryRisk).toBe("high");
  });

  it("computes BMI only from physical measurements", () => {
    expect(bmi(72, 200)).toBe(27.1);
    expect(bmi(null, 200)).toBeNull();
  });

  it("generates unknown depth chart possibilities when context is missing", () => {
    const { profiles } = buildPlayerContext({ writeOutput: false });
    const possibility = buildDepthChartPossibility(profiles[0]);
    expect(possibility.confidence).toBe("very_low");
    expect(possibility.dataGaps).toContain("depth chart role");
  });

  it("builds safely with empty local context sources", () => {
    const { report } = buildPlayerContext({ writeOutput: false });
    expect(report.verdict).toBe("needs_source_data");
    expect(report.safety.noFabricatedContext).toBe(true);
    expect(report.valueIntegration.adpUsedAsContextFallback).toBe(false);
  });
});

function tempCsv(contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "blackbird-player-context-"));
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "source.csv");
  writeFileSync(filePath, contents);
  return filePath;
}
