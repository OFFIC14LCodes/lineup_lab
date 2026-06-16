import path from "node:path";

import { attribution } from "@/lib/data-acquisition/source-attribution";
import { importedAt, readLocalRows, sourceConfidence } from "@/lib/data-acquisition/local-source-utils";
import type { PlayerContextSourceKind, PlayerContextSourceRecord } from "../player-context-types";
import { currentRole, floorRole, ceilingRole, normalizeConfidence, normalizePosition, normalizedTeam, numberValue, paceTendency, shareValue, splitList, stringValue, tendency } from "../player-context-normalization";

export const CONTEXT_SOURCE_FILES: Record<PlayerContextSourceKind, string> = {
  "physical-profile": "physical-profile.csv",
  "athletic-testing": "athletic-testing.csv",
  "depth-chart": "depth-chart.csv",
  "role-notes": "role-notes.csv",
  "injury-history": "injury-history.csv",
  "coaching-environment": "coaching-environment.csv",
  "team-environment": "team-environment.csv",
};

export function contextSourcePath(kind: PlayerContextSourceKind): string {
  return path.join(process.cwd(), "data", "player-context", "sources", CONTEXT_SOURCE_FILES[kind]);
}

export function loadContextSource(kind: PlayerContextSourceKind, filePath = contextSourcePath(kind)): PlayerContextSourceRecord[] {
  return readLocalRows(filePath).map((row, index) => ({
    kind,
    rowNumber: index + 2,
    playerId: stringValue(row.playerId),
    playerName: stringValue(row.playerName) ?? "",
    position: normalizePosition(row.position),
    team: normalizedTeam(row.team),
    season: numberValue(row.season),
    values: valuesFor(kind, row),
    attribution: attribution({
      source: stringValue(row.source) ?? `local_player_context_${kind}`,
      sourceLabel: stringValue(row.sourceLabel) ?? `local ${CONTEXT_SOURCE_FILES[kind]}`,
      acquisitionMethod: "local_csv",
      sourceConfidence: sourceConfidence(row.sourceConfidence),
      importedAt: importedAt(row.importedAt),
    }),
    dataGaps: dataGapsFor(kind, row),
  }));
}

export function loadAllContextSources(): PlayerContextSourceRecord[] {
  return (Object.keys(CONTEXT_SOURCE_FILES) as PlayerContextSourceKind[]).flatMap((kind) => loadContextSource(kind));
}

function valuesFor(kind: PlayerContextSourceKind, row: Record<string, unknown>): Record<string, unknown> {
  if (kind === "physical-profile") return {
    heightInches: numberValue(row.heightInches),
    weightPounds: numberValue(row.weightPounds),
    armLengthInches: numberValue(row.armLengthInches),
    handSizeInches: numberValue(row.handSizeInches),
    wingspanInches: numberValue(row.wingspanInches),
  };
  if (kind === "athletic-testing") return {
    fortyYardDash: numberValue(row.fortyYardDash),
    tenYardSplit: numberValue(row.tenYardSplit),
    verticalJumpInches: numberValue(row.verticalJumpInches),
    broadJumpInches: numberValue(row.broadJumpInches),
    threeCone: numberValue(row.threeCone),
    shuttle: numberValue(row.shuttle),
    benchPressReps: numberValue(row.benchPressReps),
    speedScore: numberValue(row.speedScore),
    burstScore: numberValue(row.burstScore),
    agilityScore: numberValue(row.agilityScore),
  };
  if (kind === "depth-chart") return {
    depthChartPosition: numberValue(row.depthChartPosition),
    depthChartLabel: stringValue(row.depthChartLabel),
    primaryCompetition: splitList(row.primaryCompetition),
    pathToCeiling: splitList(row.pathToCeiling),
    pathToFloor: splitList(row.pathToFloor),
    depthChartConfidence: normalizeConfidence(row.depthChartConfidence),
  };
  if (kind === "role-notes") return {
    currentRole: currentRole(row.currentRole),
    floorRole: floorRole(row.floorRole),
    ceilingRole: ceilingRole(row.ceilingRole),
    roleConfidence: normalizeConfidence(row.roleConfidence),
    expectedGamesActive: numberValue(row.expectedGamesActive),
    expectedGamesStarted: numberValue(row.expectedGamesStarted),
    expectedSnapShare: shareValue(row.expectedSnapShare),
    expectedRouteShare: shareValue(row.expectedRouteShare),
    expectedRushShare: shareValue(row.expectedRushShare),
    expectedTargetShare: shareValue(row.expectedTargetShare),
    expectedTackleOpportunity: shareValue(row.expectedTackleOpportunity),
  };
  if (kind === "injury-history") return {
    gamesMissedLastSeason: numberValue(row.gamesMissedLastSeason),
    gamesMissedLast3Seasons: numberValue(row.gamesMissedLast3Seasons),
    notableInjuries: splitList(row.notableInjuries),
    currentInjuryStatus: stringValue(row.currentInjuryStatus),
    majorSurgeryFlag: boolValue(row.majorSurgeryFlag),
    repeatedSoftTissueFlag: boolValue(row.repeatedSoftTissueFlag),
  };
  if (kind === "coaching-environment") return {
    headCoach: stringValue(row.headCoach),
    offensiveCoordinator: stringValue(row.offensiveCoordinator),
    defensiveCoordinator: stringValue(row.defensiveCoordinator),
    schemeLabel: stringValue(row.schemeLabel),
    paceTendency: paceTendency(row.paceTendency),
    passRateTendency: tendency(row.passRateTendency),
    rushRateTendency: tendency(row.rushRateTendency),
    teUsageTendency: tendency(row.teUsageTendency),
    rbTargetTendency: tendency(row.rbTargetTendency),
    idpTackleOpportunity: tendency(row.idpTackleOpportunity),
    confidence: normalizeConfidence(row.sourceConfidence),
  };
  return {
    playVolumeTendency: tendency(row.playVolumeTendency),
    scoringEnvironment: tendency(row.scoringEnvironment),
    offensiveLineContext: stringValue(row.offensiveLineContext),
    defensiveSnapContext: stringValue(row.defensiveSnapContext),
  };
}

function dataGapsFor(kind: PlayerContextSourceKind, row: Record<string, unknown>): string[] {
  const values = valuesFor(kind, row);
  const hasValue = Object.values(values).some((value) => Array.isArray(value) ? value.length : value !== null && value !== undefined && String(value) !== "unknown" && String(value).trim() !== "");
  return hasValue ? [] : [`${kind} context`];
}

function boolValue(value: unknown): boolean | null {
  const normalized = stringValue(value)?.toLowerCase();
  if (!normalized) return null;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}
