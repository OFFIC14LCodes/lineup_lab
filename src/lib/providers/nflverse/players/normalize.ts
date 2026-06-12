import { normalizePlayerName } from "../../../players/normalize";
import { normalizeGsisId } from "../normalize-gsis-id";
import type { NflversePlayersRaw } from "./schema";
import type { GsisBootstrapPlayerRow } from "./types";

// position_group values that represent team-defense entities and must be rejected
const TEAM_DEFENSE_GROUPS = new Set(["DEF", "DST", "D/ST"]);

// Maps nflverse position_group values to Blackbird canonical position groups.
// nflverse may expose sub-positions (NT, ILB, CB, etc.) in position_group for some players.
const POSITION_GROUP_CANON: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  P: "K",
  LS: "LS",
  OL: "OL",
  OT: "OL",
  OG: "OL",
  C: "OL",
  DL: "DL",
  DE: "DL",
  DT: "DL",
  EDGE: "DL",
  NT: "DL",
  LB: "LB",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  DB: "DB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB"
};

export type NflversePlayerParseResult =
  | { ok: true; row: GsisBootstrapPlayerRow }
  | { ok: false; reason: string; isTeamDefense: boolean };

export function parseNflversePlayerRow(raw: NflversePlayersRaw): NflversePlayerParseResult {
  const gsisId = normalizeGsisId(raw["gsis_id"]);
  if (!gsisId) {
    return { ok: false, reason: "Missing gsis_id", isTeamDefense: false };
  }

  const rawPositionGroup = raw["position_group"]?.trim().toUpperCase() ?? "";
  if (TEAM_DEFENSE_GROUPS.has(rawPositionGroup)) {
    return { ok: false, reason: `Team-defense entity: position_group=${rawPositionGroup}`, isTeamDefense: true };
  }

  const rawPosition = raw["position"]?.trim().toUpperCase() ?? "";
  if (TEAM_DEFENSE_GROUPS.has(rawPosition)) {
    return { ok: false, reason: `Team-defense entity: position=${rawPosition}`, isTeamDefense: true };
  }

  const canonicalPositionGroup = POSITION_GROUP_CANON[rawPositionGroup] ?? null;

  const displayName = raw["display_name"]?.trim() ?? "";
  const normalizedName = displayName ? normalizePlayerName(displayName) : "";

  const espnIdRaw = raw["espn_id"]?.trim();
  const espnId = espnIdRaw && espnIdRaw !== "NA" && espnIdRaw !== "" ? espnIdRaw : null;

  const latestTeam = raw["latest_team"]?.trim() || null;
  const status = raw["status"]?.trim() ?? "";

  const lastSeasonRaw = raw["last_season"]?.trim();
  let lastSeason: number | null = null;
  if (lastSeasonRaw && lastSeasonRaw !== "NA" && lastSeasonRaw !== "") {
    const parsed = parseInt(lastSeasonRaw, 10);
    if (Number.isInteger(parsed)) lastSeason = parsed;
  }

  return {
    ok: true,
    row: {
      gsisId,
      displayName,
      normalizedName,
      positionGroup: canonicalPositionGroup,
      rawPositionGroup,
      espnId,
      latestTeam,
      status,
      lastSeason
    }
  };
}
