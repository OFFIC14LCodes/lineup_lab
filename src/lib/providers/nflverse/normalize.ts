import type { ProviderStatsJson } from "@/lib/providers/data-types";

import { NFLVERSE_SEASON_TYPE_MAP, NFLVERSE_SUPPORTED_POSITION_GROUPS, type NflversePlayerStatsRaw } from "./schema";
import { normalizeGsisId } from "./normalize-gsis-id";

// nflverse column → Blackbird canonical stat key.
// nflverse names the QB sacks-suffered column "sacks".
const STAT_COLUMN_MAP: ReadonlyArray<readonly [nflverseCol: string, canonicalKey: string]> = [
  ["completions", "pass_cmp"],
  ["attempts", "pass_att"],
  ["passing_yards", "pass_yd"],
  ["passing_tds", "pass_td"],
  ["passing_interceptions", "pass_int"],
  ["sacks_suffered", "pass_sack"],
  ["passing_first_downs", "pass_fd"],
  ["passing_2pt_conversions", "pass_2pt"],
  ["carries", "rush_att"],
  ["rushing_yards", "rush_yd"],
  ["rushing_tds", "rush_td"],
  ["rushing_first_downs", "rush_fd"],
  ["rushing_2pt_conversions", "rush_2pt"],
  ["receptions", "rec"],
  ["targets", "rec_tgt"],
  ["receiving_yards", "rec_yd"],
  ["receiving_tds", "rec_td"],
  ["receiving_first_downs", "rec_fd"],
  ["receiving_2pt_conversions", "rec_2pt"]
];

export type NormalizedNflverseRow = {
  gsisId: string;
  playerDisplayName: string;
  positionGroup: string;
  team: string;
  opponent: string;
  season: number;
  week: number;
  seasonType: "regular" | "preseason" | "postseason";
  stats: ProviderStatsJson;
  providerFantasyPoints: number | null;
  canonicalKeyCount: number;
};

export type NflverseNormalizeResult =
  | { ok: true; row: NormalizedNflverseRow }
  | { ok: false; reason: string };

export function normalizeNflverseRow(raw: NflversePlayerStatsRaw): NflverseNormalizeResult {
  const gsisId = normalizeGsisId(raw["player_id"]);
  if (!gsisId) {
    return { ok: false, reason: "Missing player_id (GSIS ID)" };
  }

  const positionGroup = raw["position_group"]?.trim().toUpperCase();
  if (!positionGroup || !NFLVERSE_SUPPORTED_POSITION_GROUPS.has(positionGroup)) {
    return { ok: false, reason: `Unsupported position_group: ${raw["position_group"]}` };
  }

  const rawSeasonType = raw["season_type"]?.trim().toUpperCase();
  const seasonType = NFLVERSE_SEASON_TYPE_MAP[rawSeasonType];
  if (!seasonType) {
    return { ok: false, reason: `Unknown season_type: ${raw["season_type"]}` };
  }
  if (seasonType !== "regular") {
    return { ok: false, reason: `Skipping non-regular season_type: ${rawSeasonType}` };
  }

  const season = parseInt(raw["season"] ?? "", 10);
  if (!Number.isInteger(season) || season < 1900 || season > 3000) {
    return { ok: false, reason: `Invalid season: ${raw["season"]}` };
  }

  const week = parseInt(raw["week"] ?? "", 10);
  if (!Number.isInteger(week) || week < 1 || week > 25) {
    return { ok: false, reason: `Invalid week: ${raw["week"]}` };
  }

  const stats: ProviderStatsJson = {};
  let canonicalKeyCount = 0;

  for (const [nflCol, canonicalKey] of STAT_COLUMN_MAP) {
    const raw_val = raw[nflCol];
    if (raw_val === undefined || raw_val === null || raw_val.trim() === "" || raw_val.trim() === "NA") {
      continue;
    }
    const num = parseFloat(raw_val);
    if (!Number.isFinite(num)) {
      continue;
    }
    if (num !== 0) {
      stats[canonicalKey] = num;
      canonicalKeyCount += 1;
    }
  }

  const fantasyRaw = raw["fantasy_points"]?.trim();
  const providerFantasyPoints =
    fantasyRaw && fantasyRaw !== "NA" ? parseFloat(fantasyRaw) : null;

  return {
    ok: true,
    row: {
      gsisId,
      playerDisplayName: raw["player_display_name"]?.trim() ?? "",
      positionGroup,
      team: raw["team"]?.trim() ?? "",
      opponent: raw["opponent_team"]?.trim() ?? "",
      season,
      week,
      seasonType: "regular",
      stats,
      providerFantasyPoints: providerFantasyPoints !== null && Number.isFinite(providerFantasyPoints)
        ? providerFantasyPoints
        : null,
      canonicalKeyCount
    }
  };
}

export function buildRowSha256Input(raw: NflversePlayerStatsRaw): string {
  return [
    raw["player_id"] ?? "",
    raw["season"] ?? "",
    raw["week"] ?? "",
    raw["season_type"] ?? "",
    raw["team"] ?? ""
  ].join("|");
}
