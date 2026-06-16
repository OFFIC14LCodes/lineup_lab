import path from "node:path";

import { normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import type { SourceAttribution } from "./data-source-types";
import { attribution } from "./source-attribution";
import { importedAt, numberValue, readLocalRows, sourceConfidence, stringValue } from "./local-source-utils";

const DEFAULT_PATH = path.join(process.cwd(), "data", "rookies", "sources", "draft-capital.csv");

export type DraftCapitalRecord = {
  playerId: string | null;
  playerName: string;
  position: string;
  team: string | null;
  season: number | null;
  nflDraftRound: number | null;
  nflDraftPick: number | null;
  nflDraftOverall: number | null;
  nflDraftTeam: string | null;
  attribution: SourceAttribution;
  dataGaps: string[];
  rowNumber: number;
};

export function loadDraftCapitalRecords(filePath = DEFAULT_PATH): DraftCapitalRecord[] {
  return readLocalRows(filePath).map((row, index) => {
    const round = numberValue(row.nflDraftRound);
    const pick = numberValue(row.nflDraftPick);
    const overall = numberValue(row.nflDraftOverall);
    const sourceLabel = stringValue(row.sourceLabel) ?? "local draft-capital.csv";
    const record: DraftCapitalRecord = {
      playerId: stringValue(row.playerId),
      playerName: stringValue(row.playerName) ?? "",
      position: normalizePrimaryPosition(stringValue(row.position)) ?? stringValue(row.position)?.toUpperCase() ?? "",
      team: normalizeTeam(stringValue(row.team)),
      season: numberValue(row.season),
      nflDraftRound: round,
      nflDraftPick: pick,
      nflDraftOverall: overall,
      nflDraftTeam: normalizeTeam(stringValue(row.nflDraftTeam)),
      attribution: attribution({
        source: stringValue(row.source) ?? "local_rookie_draft_capital_csv",
        sourceLabel,
        acquisitionMethod: "local_csv",
        sourceConfidence: sourceConfidence(row.sourceConfidence),
        importedAt: importedAt(row.importedAt),
      }),
      dataGaps: [
        round === null && overall === null ? "NFL draft capital" : null,
        !stringValue(row.playerId) && !stringValue(row.playerName) ? "player identity" : null,
      ].filter((gap): gap is string => Boolean(gap)),
      rowNumber: index + 2,
    };
    return record;
  });
}
