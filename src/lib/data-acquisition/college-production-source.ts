import path from "node:path";

import { normalizePrimaryPosition } from "@/lib/players/normalize";
import type { SourceAttribution } from "./data-source-types";
import { hasAny, importedAt, numberValue, readLocalRows, sourceConfidence, stringValue } from "./local-source-utils";
import { attribution } from "./source-attribution";

const DEFAULT_PATH = path.join(process.cwd(), "data", "rookies", "sources", "college-production.csv");

export type CollegeProductionRecord = {
  playerId: string | null;
  playerName: string;
  position: string;
  college: string | null;
  collegeConference: string | null;
  seasonRange: string | null;
  stats: Record<string, number | null>;
  attribution: SourceAttribution;
  dataGaps: string[];
  rowNumber: number;
};

export function loadCollegeProductionRecords(filePath = DEFAULT_PATH): CollegeProductionRecord[] {
  return readLocalRows(filePath).map((row, index) => {
    const stats = {
      collegeGames: numberValue(row.collegeGames) ?? numberValue(row.games),
      collegePassingAttempts: numberValue(row.collegePassingAttempts) ?? numberValue(row.passingAttempts),
      collegeCompletions: numberValue(row.collegeCompletions) ?? numberValue(row.completions),
      collegePassingYards: numberValue(row.collegePassingYards) ?? numberValue(row.passingYards),
      collegePassingTouchdowns: numberValue(row.collegePassingTouchdowns) ?? numberValue(row.passingTouchdowns),
      collegeInterceptions: numberValue(row.collegeInterceptions) ?? numberValue(row.interceptions),
      collegeRushingAttempts: numberValue(row.collegeRushingAttempts) ?? numberValue(row.rushingAttempts),
      collegeRushingYards: numberValue(row.collegeRushingYards) ?? numberValue(row.rushingYards),
      collegeRushingTouchdowns: numberValue(row.collegeRushingTouchdowns) ?? numberValue(row.rushingTouchdowns),
      collegeTargets: numberValue(row.collegeTargets) ?? numberValue(row.targets),
      collegeReceptions: numberValue(row.collegeReceptions) ?? numberValue(row.receptions),
      collegeReceivingYards: numberValue(row.collegeReceivingYards) ?? numberValue(row.receivingYards),
      collegeReceivingTouchdowns: numberValue(row.collegeReceivingTouchdowns) ?? numberValue(row.receivingTouchdowns),
      collegeSoloTackles: numberValue(row.collegeSoloTackles) ?? numberValue(row.soloTackles),
      collegeAssistedTackles: numberValue(row.collegeAssistedTackles) ?? numberValue(row.assistedTackles),
      collegeTotalTackles: numberValue(row.collegeTotalTackles) ?? numberValue(row.totalTackles),
      collegeTacklesForLoss: numberValue(row.collegeTacklesForLoss) ?? numberValue(row.tacklesForLoss),
      collegeSacks: numberValue(row.collegeSacks) ?? numberValue(row.sacks),
      collegeInterceptionsDef: numberValue(row.collegeInterceptionsDef) ?? numberValue(row.interceptionsDef),
      collegePassesDefended: numberValue(row.collegePassesDefended) ?? numberValue(row.passesDefended),
      collegeForcedFumbles: numberValue(row.collegeForcedFumbles) ?? numberValue(row.forcedFumbles),
      collegeFumbleRecoveries: numberValue(row.collegeFumbleRecoveries) ?? numberValue(row.fumbleRecoveries),
    };
    const sourceLabel = stringValue(row.sourceLabel) ?? "local college-production.csv";
    return {
      playerId: stringValue(row.playerId),
      playerName: stringValue(row.playerName) ?? "",
      position: normalizePrimaryPosition(stringValue(row.position)) ?? stringValue(row.position)?.toUpperCase() ?? "",
      college: stringValue(row.college),
      collegeConference: stringValue(row.collegeConference),
      seasonRange: stringValue(row.seasonRange),
      stats,
      attribution: attribution({
        source: stringValue(row.source) ?? "local_rookie_college_production_csv",
        sourceLabel,
        acquisitionMethod: "local_csv",
        sourceConfidence: sourceConfidence(row.sourceConfidence),
        importedAt: importedAt(row.importedAt),
      }),
      dataGaps: [
        hasAny(Object.values(stats)) ? null : "college production",
        !stringValue(row.playerId) && !stringValue(row.playerName) ? "player identity" : null,
      ].filter((gap): gap is string => Boolean(gap)),
      rowNumber: index + 2,
    };
  });
}
