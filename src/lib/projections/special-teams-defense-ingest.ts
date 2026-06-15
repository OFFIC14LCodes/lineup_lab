import { normalizeGsisId } from "@/lib/providers/nflverse/normalize-gsis-id";

export type H98Category = "idp" | "kicker" | "dst";

export type H98RawRow = Record<string, string | undefined>;

export type H98NormalizedPlayerRow = {
  category: Exclude<H98Category, "dst">;
  gsisId: string;
  playerDisplayName: string;
  rawPosition: string;
  rawPositionGroup: string;
  positionGroup: "DL" | "LB" | "DB" | "K";
  team: string | null;
  opponent: string | null;
  season: number;
  week: number;
  seasonType: "regular";
  stats: Record<string, number>;
  sourceFields: string[];
  allZeroStats: boolean;
};

export type H98NormalizeResult =
  | { ok: true; row: H98NormalizedPlayerRow }
  | { ok: false; reason: string; category: H98Category | null };

export type SourceAvailabilityRow = {
  category: H98Category;
  source: string;
  field: string;
  present_in_source: boolean;
  present_in_canonical_db: boolean;
  requires_migration: boolean;
  requires_import_script: boolean;
  notes: string;
};

export type FieldCoverage = {
  presentFields: string[];
  nonZeroFields: string[];
  knownZeroFields: string[];
  unavailableFields: string[];
};

const IDP_GROUPS = new Set(["DL", "DE", "DT", "EDGE", "NT", "LB", "ILB", "OLB", "MLB", "DB", "CB", "S", "SAF", "FS", "SS"]);
const KICKER_POSITIONS = new Set(["K", "PK"]);

const IDP_GROUP_CANON: Record<string, "DL" | "LB" | "DB"> = {
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
  SAF: "DB",
  FS: "DB",
  SS: "DB",
};

export const H98_IDP_FIELD_MAP = [
  ["def_tackles_solo", "solo_tkl"],
  ["def_tackle_assists", "ast_tkl"],
  ["def_tackles_with_assist", "tkl"],
  ["def_tackles_for_loss", "tkl_loss"],
  ["def_tackles_for_loss_yards", "tkl_loss_yd"],
  ["def_fumbles_forced", "ff"],
  ["def_sacks", "sack"],
  ["def_sack_yards", "sack_yd"],
  ["def_qb_hits", "qb_hit"],
  ["def_interceptions", "int"],
  ["def_interception_yards", "int_ret_yd"],
  ["def_pass_defended", "pd"],
  ["def_tds", "def_td"],
  ["def_safeties", "safe"],
  ["fumble_recovery_own", "fr_own"],
  ["fumble_recovery_opp", "fr_opp"],
  ["fumble_recovery_yards_own", "fr_own_yd"],
  ["fumble_recovery_yards_opp", "fr_opp_yd"],
  ["fumble_recovery_tds", "fr_td"],
] as const;

export const H98_KICKER_FIELD_MAP = [
  ["fg_made", "fgm"],
  ["fg_att", "fga"],
  ["fg_missed", "fgmiss"],
  ["fg_blocked", "fg_blocked"],
  ["fg_long", "fg_long"],
  ["fg_made_0_19", "fgm_0_19"],
  ["fg_made_20_29", "fgm_20_29"],
  ["fg_made_30_39", "fgm_30_39"],
  ["fg_made_40_49", "fgm_40_49"],
  ["fg_made_50_59", "fgm_50_59"],
  ["fg_made_60_", "fgm_60p"],
  ["fg_missed_0_19", "fgmiss_0_19"],
  ["fg_missed_20_29", "fgmiss_20_29"],
  ["fg_missed_30_39", "fgmiss_30_39"],
  ["fg_missed_40_49", "fgmiss_40_49"],
  ["fg_missed_50_59", "fgmiss_50_59"],
  ["fg_missed_60_", "fgmiss_60p"],
  ["pat_made", "xpm"],
  ["pat_att", "xpa"],
  ["pat_missed", "xpmiss"],
  ["pat_blocked", "xp_blocked"],
] as const;

export const H98_DST_TEAM_FIELDS = [
  "points_allowed",
  "yards_allowed",
  "points_scored",
  "offensive_yards",
] as const;

export const H98_DST_UNAVAILABLE_COMPONENTS = [
  "sacks",
  "interceptions",
  "fumble_recoveries",
  "forced_fumbles",
  "defensive_tds",
  "safeties",
  "blocked_kicks",
  "return_tds",
  "two_point_returns",
] as const;

export function classifyH98Category(raw: H98RawRow): Exclude<H98Category, "dst"> | null {
  const rawPosition = normalizedText(raw.position);
  const rawPositionGroup = normalizedText(raw.position_group);
  if (KICKER_POSITIONS.has(rawPosition)) return "kicker";
  if (IDP_GROUPS.has(rawPositionGroup) || IDP_GROUPS.has(rawPosition)) return "idp";
  return null;
}

export function normalizeH98PlayerRow(raw: H98RawRow): H98NormalizeResult {
  const category = classifyH98Category(raw);
  if (!category) return { ok: false, reason: "Row is not IDP or kicker scope.", category: null };

  const gsisId = normalizeGsisId(raw.player_id ?? "");
  if (!gsisId) return { ok: false, reason: "Missing player_id (GSIS ID).", category };

  const seasonType = normalizedText(raw.season_type);
  if (seasonType !== "REG") return { ok: false, reason: `Skipping non-regular season_type: ${seasonType || "missing"}.`, category };

  const season = parseInteger(raw.season);
  if (season === null) return { ok: false, reason: `Invalid season: ${raw.season ?? ""}.`, category };

  const week = parseInteger(raw.week);
  if (week === null || week < 1 || week > 25) return { ok: false, reason: `Invalid week: ${raw.week ?? ""}.`, category };

  const rawPosition = normalizedText(raw.position);
  const rawPositionGroup = normalizedText(raw.position_group);
  const positionGroup = category === "kicker" ? "K" : IDP_GROUP_CANON[rawPositionGroup] ?? IDP_GROUP_CANON[rawPosition];
  if (!positionGroup) return { ok: false, reason: `Unsupported IDP position: ${rawPositionGroup || rawPosition}.`, category };

  const mapped = mapStats(raw, category === "idp" ? H98_IDP_FIELD_MAP : H98_KICKER_FIELD_MAP);
  if (category === "idp") {
    deriveFumbleRecoveryTotals(mapped.stats);
  } else {
    deriveKickerTotals(mapped.stats);
  }

  return {
    ok: true,
    row: {
      category,
      gsisId,
      playerDisplayName: raw.player_display_name?.trim() ?? raw.player_name?.trim() ?? "",
      rawPosition,
      rawPositionGroup,
      positionGroup,
      team: normalizedText(raw.team) || null,
      opponent: normalizedText(raw.opponent_team) || null,
      season,
      week,
      seasonType: "regular",
      stats: mapped.stats,
      sourceFields: mapped.sourceFields,
      allZeroStats: Object.values(mapped.stats).every((value) => value === 0),
    },
  };
}

export function buildSourceAvailability(input: {
  sourceColumns: Set<string>;
  canonicalDbColumns: Set<string>;
}): SourceAvailabilityRow[] {
  const rows: SourceAvailabilityRow[] = [];

  for (const [sourceField, canonicalField] of H98_IDP_FIELD_MAP) {
    rows.push({
      category: "idp",
      source: "nflverse stats_player_week",
      field: sourceField,
      present_in_source: input.sourceColumns.has(sourceField),
      present_in_canonical_db: input.canonicalDbColumns.has("stats_json"),
      requires_migration: false,
      requires_import_script: true,
      notes: `Normalize to stats_json.${canonicalField}.`,
    });
  }

  rows.push({
    category: "idp",
    source: "nflverse stats_player_week",
    field: "blocked_kicks",
    present_in_source: input.sourceColumns.has("blocked_kicks"),
    present_in_canonical_db: input.canonicalDbColumns.has("stats_json"),
    requires_migration: false,
    requires_import_script: true,
    notes: "Not present in the archived 2025 player weekly header; keep unavailable unless a source column is added.",
  });

  for (const [sourceField, canonicalField] of H98_KICKER_FIELD_MAP) {
    rows.push({
      category: "kicker",
      source: "nflverse stats_player_week",
      field: sourceField,
      present_in_source: input.sourceColumns.has(sourceField),
      present_in_canonical_db: input.canonicalDbColumns.has("stats_json"),
      requires_migration: false,
      requires_import_script: true,
      notes: `Normalize to stats_json.${canonicalField}.`,
    });
  }

  for (const field of ["fga_0_19", "fga_20_29", "fga_30_39", "fga_40_49", "fga_50p"]) {
    rows.push({
      category: "kicker",
      source: "nflverse stats_player_week",
      field,
      present_in_source: input.sourceColumns.has(field),
      present_in_canonical_db: input.canonicalDbColumns.has("stats_json"),
      requires_migration: false,
      requires_import_script: false,
      notes: "Distance-bucket attempts are not present; do not fabricate them from make/miss buckets.",
    });
  }

  for (const field of H98_DST_TEAM_FIELDS) {
    rows.push({
      category: "dst",
      source: "team_game_stats",
      field,
      present_in_source: true,
      present_in_canonical_db: input.canonicalDbColumns.has(field),
      requires_migration: false,
      requires_import_script: false,
      notes: "Already canonical in team_game_stats.",
    });
  }

  for (const field of H98_DST_UNAVAILABLE_COMPONENTS) {
    rows.push({
      category: "dst",
      source: "team_game_stats",
      field,
      present_in_source: false,
      present_in_canonical_db: false,
      requires_migration: false,
      requires_import_script: true,
      notes: "Unavailable in team_game_stats; requires a future PBP/team-defense component derivation before projection scoring.",
    });
  }

  return rows;
}

export function fieldCoverage(rows: H98NormalizedPlayerRow[], expectedCanonicalFields: readonly string[]): FieldCoverage {
  const present = new Set<string>();
  const nonZero = new Set<string>();
  const knownZero = new Set<string>();

  for (const row of rows) {
    for (const [field, value] of Object.entries(row.stats)) {
      present.add(field);
      if (value === 0) knownZero.add(field);
      if (value !== 0) nonZero.add(field);
    }
  }

  return {
    presentFields: [...present].sort(),
    nonZeroFields: [...nonZero].sort(),
    knownZeroFields: [...knownZero].sort(),
    unavailableFields: expectedCanonicalFields.filter((field) => !present.has(field)).sort(),
  };
}

function mapStats(
  raw: H98RawRow,
  mapping: ReadonlyArray<readonly [sourceField: string, canonicalField: string]>
) {
  const stats: Record<string, number> = {};
  const sourceFields: string[] = [];
  for (const [sourceField, canonicalField] of mapping) {
    const value = parseKnownNumeric(raw[sourceField]);
    if (value === null) continue;
    stats[canonicalField] = value;
    sourceFields.push(sourceField);
  }
  return { stats, sourceFields };
}

function deriveFumbleRecoveryTotals(stats: Record<string, number>) {
  const own = stats.fr_own;
  const opp = stats.fr_opp;
  if (own !== undefined || opp !== undefined) {
    stats.fr = (own ?? 0) + (opp ?? 0);
  }
  const ownYards = stats.fr_own_yd;
  const oppYards = stats.fr_opp_yd;
  if (ownYards !== undefined || oppYards !== undefined) {
    stats.fr_ret_yd = (ownYards ?? 0) + (oppYards ?? 0);
  }
}

function deriveKickerTotals(stats: Record<string, number>) {
  const fga = stats.fga;
  const fgm = stats.fgm;
  if (stats.fgmiss === undefined && fga !== undefined && fgm !== undefined) {
    stats.fgmiss = Math.max(0, fga - fgm);
  }
  const xpa = stats.xpa;
  const xpm = stats.xpm;
  if (stats.xpmiss === undefined && xpa !== undefined && xpm !== undefined) {
    stats.xpmiss = Math.max(0, xpa - xpm);
  }
  const fgm50 = (stats.fgm_50_59 ?? 0) + (stats.fgm_60p ?? 0);
  if (stats.fgm_50_59 !== undefined || stats.fgm_60p !== undefined) {
    stats.fgm_50p = fgm50;
  }
  const fgmiss50 = (stats.fgmiss_50_59 ?? 0) + (stats.fgmiss_60p ?? 0);
  if (stats.fgmiss_50_59 !== undefined || stats.fgmiss_60p !== undefined) {
    stats.fgmiss_50p = fgmiss50;
  }
}

function parseKnownNumeric(rawValue: string | undefined): number | null {
  if (rawValue === undefined || rawValue === null) return null;
  const normalized = rawValue.trim();
  if (!normalized || normalized.toUpperCase() === "NA" || normalized.toUpperCase() === "NAN") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(rawValue: string | undefined): number | null {
  const parsed = parseKnownNumeric(rawValue);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function normalizedText(rawValue: string | undefined): string {
  return rawValue?.trim().toUpperCase() ?? "";
}
