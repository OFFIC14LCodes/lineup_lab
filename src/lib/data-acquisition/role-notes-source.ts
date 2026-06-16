import path from "node:path";

import { normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import type { SourceAttribution } from "./data-source-types";
import { attribution } from "./source-attribution";
import { importedAt, numberValue, readLocalRows, sourceConfidence, splitList, stringValue } from "./local-source-utils";

const DEFAULT_PATH = path.join(process.cwd(), "data", "rookies", "sources", "role-notes.csv");

export type LandingSpotRole = "clear_starter" | "probable_starter" | "committee" | "rotational" | "backup" | "unknown";

export type RoleNotesRecord = {
  playerId: string | null;
  playerName: string;
  position: string;
  team: string | null;
  season: number | null;
  landingSpotRole: LandingSpotRole;
  opportunityNotes: string[];
  attribution: SourceAttribution;
  dataGaps: string[];
  rowNumber: number;
};

export function loadRoleNotesRecords(filePath = DEFAULT_PATH): RoleNotesRecord[] {
  return readLocalRows(filePath).map((row, index) => {
    const role = landingSpotRoleValue(row.landingSpotRole);
    const notes = splitList(row.opportunityNotes);
    const sourceLabel = stringValue(row.roleSourceLabel) ?? "local role-notes.csv";
    return {
      playerId: stringValue(row.playerId),
      playerName: stringValue(row.playerName) ?? "",
      position: normalizePrimaryPosition(stringValue(row.position)) ?? stringValue(row.position)?.toUpperCase() ?? "",
      team: normalizeTeam(stringValue(row.team)),
      season: numberValue(row.season),
      landingSpotRole: role,
      opportunityNotes: notes,
      attribution: attribution({
        source: stringValue(row.source) ?? "local_rookie_role_notes_csv",
        sourceLabel: stringValue(row.sourceLabel) ?? sourceLabel,
        acquisitionMethod: "manual",
        sourceConfidence: sourceConfidence(row.sourceConfidence),
        importedAt: importedAt(row.importedAt),
      }),
      dataGaps: [
        role === "unknown" ? "landing spot role" : null,
        notes.length ? null : "opportunity notes",
        !stringValue(row.playerId) && !stringValue(row.playerName) ? "player identity" : null,
      ].filter((gap): gap is string => Boolean(gap)),
      rowNumber: index + 2,
    };
  });
}

function landingSpotRoleValue(value: unknown): LandingSpotRole {
  const normalized = stringValue(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return "unknown";
  if (["clear_starter", "probable_starter", "committee", "rotational", "backup", "unknown"].includes(normalized)) return normalized as LandingSpotRole;
  return "unknown";
}
