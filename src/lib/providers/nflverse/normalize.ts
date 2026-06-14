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
  ["receiving_2pt_conversions", "rec_2pt"],
  ["punt_return_yards", "punt_ret_yd"],
  ["kickoff_return_yards", "kick_ret_yd"],
  ["special_teams_tds", "return_td"]
];

// nflverse exposes lost-fumble fields split by play context rather than as a single total column.
// For fantasy scoring, Blackbird uses the aggregate lost-fumble stat.
const LOST_FUMBLE_COLUMNS = ["sack_fumbles_lost", "rushing_fumbles_lost", "receiving_fumbles_lost"] as const;
const FUMBLE_COLUMNS = ["sack_fumbles", "rushing_fumbles", "receiving_fumbles"] as const;

type NormalizationWarning = {
  code: "pass_cmp_gt_pass_att";
  message: string;
  details: {
    completions: number;
    attempts: number;
  };
};

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
  metadata: {
    normalizationWarnings: NormalizationWarning[];
  };
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
  const normalizationWarnings: NormalizationWarning[] = [];
  let canonicalKeyCount = 0;

  for (const [nflCol, canonicalKey] of STAT_COLUMN_MAP) {
    const parsed = parseKnownNumeric(raw[nflCol]);
    if (parsed === null) {
      continue;
    }
    stats[canonicalKey] = parsed;
    canonicalKeyCount += 1;
  }

  const lostFumbleValues = LOST_FUMBLE_COLUMNS
    .map((column) => parseKnownNumeric(raw[column]))
    .filter((value): value is number => value !== null);
  if (lostFumbleValues.length > 0) {
    stats["fum_lost"] = lostFumbleValues.reduce((sum, value) => sum + value, 0);
    canonicalKeyCount += 1;
  }

  const fumbleValues = FUMBLE_COLUMNS
    .map((column) => parseKnownNumeric(raw[column]))
    .filter((value): value is number => value !== null);
  if (fumbleValues.length > 0) {
    stats["fum"] = fumbleValues.reduce((sum, value) => sum + value, 0);
    canonicalKeyCount += 1;
  }

  const passAttempts = typeof stats["pass_att"] === "number" ? stats["pass_att"] : null;
  const passCompletions = typeof stats["pass_cmp"] === "number" ? stats["pass_cmp"] : null;
  if (passAttempts !== null || passCompletions !== null) {
    const safeAttempts = Number.isFinite(passAttempts) ? passAttempts ?? 0 : 0;
    const safeCompletions = Number.isFinite(passCompletions) ? passCompletions ?? 0 : 0;
    stats["pass_inc"] = Math.max(0, safeAttempts - safeCompletions);
    canonicalKeyCount += 1;

    if (safeCompletions > safeAttempts) {
      normalizationWarnings.push({
        code: "pass_cmp_gt_pass_att",
        message: "Completions exceeded attempts in nflverse weekly source; pass_inc was clamped to zero.",
        details: {
          completions: safeCompletions,
          attempts: safeAttempts
        }
      });
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
      canonicalKeyCount,
      metadata: {
        normalizationWarnings
      }
    }
  };
}

function parseKnownNumeric(rawValue: string | undefined): number | null {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const normalized = rawValue.trim();
  if (!normalized || normalized.toUpperCase() === "NA" || normalized.toUpperCase() === "NAN") {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
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
