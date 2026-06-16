import { normalizePrimaryPosition } from "@/lib/players/normalize";

export type StatContext = {
  position?: string | null;
  side?: "offense" | "defense" | "kicking" | "team_defense" | "unknown";
};

const BASE_ALIASES: Record<string, string> = {
  pass_yd: "pass_yd",
  pass_yds: "pass_yd",
  passing_yards: "pass_yd",
  pass_att: "pass_att",
  passing_attempts: "pass_att",
  pass_cmp: "pass_cmp",
  completions: "pass_cmp",
  passing_completions: "pass_cmp",
  pass_td: "pass_td",
  passing_tds: "pass_td",
  passing_touchdowns: "pass_td",
  interceptions_thrown: "pass_int",
  pass_int: "pass_int",
  rush_att: "rush_att",
  carries: "rush_att",
  rushing_attempts: "rush_att",
  rush_yd: "rush_yd",
  rush_yds: "rush_yd",
  rushing_yards: "rush_yd",
  rush_td: "rush_td",
  rushing_tds: "rush_td",
  rushing_touchdowns: "rush_td",
  rec: "rec",
  receptions: "rec",
  targets: "target",
  receiving_targets: "target",
  rec_tgt: "target",
  target: "target",
  rec_yd: "rec_yd",
  rec_yds: "rec_yd",
  receiving_yards: "rec_yd",
  rec_td: "rec_td",
  receiving_tds: "rec_td",
  receiving_touchdowns: "rec_td",
  fum: "fum",
  fumbles: "fum",
  fum_lost: "fum_lost",
  fumbles_lost: "fum_lost",
  pass_fd: "pass_fd",
  passing_first_downs: "pass_fd",
  rush_fd: "rush_fd",
  rushing_first_downs: "rush_fd",
  rec_fd: "rec_fd",
  receiving_first_downs: "rec_fd",
  two_pt: "two_pt",
  pass_2pt: "two_pt",
  rush_2pt: "two_pt",
  rec_2pt: "two_pt",
  two_point_conversions: "two_pt",
  tkl_solo: "solo_tkl",
  solo_tkl: "solo_tkl",
  solo_tackles: "solo_tkl",
  idp_tkl_solo: "solo_tkl",
  tackle_solo: "solo_tkl",
  tkl_ast: "ast_tkl",
  ast_tkl: "ast_tkl",
  assisted_tackles: "ast_tkl",
  idp_tkl_ast: "ast_tkl",
  tackle_ast: "ast_tkl",
  tkl: "total_tkl",
  tackles: "total_tkl",
  total_tackles: "total_tkl",
  sack: "sack",
  sacks: "sack",
  idp_sack: "sack",
  def_sack: "sack",
  tfl: "tfl",
  tackles_for_loss: "tfl",
  idp_tfl: "tfl",
  qb_hit: "qb_hit",
  qb_hits: "qb_hit",
  idp_qb_hit: "qb_hit",
  pd: "pass_def",
  pass_defended: "pass_def",
  passes_defended: "pass_def",
  passes_deflected: "pass_def",
  idp_pass_defended: "pass_def",
  def_int: "def_int",
  idp_int: "def_int",
  ff: "ff",
  forced_fumbles: "ff",
  idp_ff: "ff",
  fr: "fr",
  fumble_recoveries: "fr",
  idp_fr: "fr",
  fr_td: "fr_td",
  fumble_recovery_touchdowns: "fr_td",
  def_td: "def_td",
  defensive_touchdowns: "def_td",
  idp_td: "def_td",
  blk_kick: "blk_kick",
  blocked_kicks: "blk_kick",
  blocked_punts: "blk_kick",
  safety: "safety",
  safe: "safety",
  safeties: "safety",
  fg_att: "fg_att",
  fga: "fg_att",
  field_goal_attempts: "fg_att",
  fg_made: "fg_made",
  fgm: "fg_made",
  field_goals_made: "fg_made",
  fg_miss: "fg_miss",
  field_goals_missed: "fg_miss",
  pat_att: "pat_att",
  xpa: "pat_att",
  extra_point_attempts: "pat_att",
  pat_made: "pat_made",
  xpm: "pat_made",
  extra_points_made: "pat_made",
  pat_miss: "pat_miss",
  extra_points_missed: "pat_miss",
};

const DEFENSIVE_INT_ALIASES = new Set(["int", "interception", "interceptions"]);

export function normalizeProjectionStatKey(rawKey: string, context: StatContext = {}): string {
  const key = rawKey.trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (DEFENSIVE_INT_ALIASES.has(key)) {
    const position = normalizePrimaryPosition(context.position);
    return position && ["DL", "LB", "DB", "DEF"].includes(position) ? "def_int" : "pass_int";
  }
  return BASE_ALIASES[key] ?? key;
}

export function normalizeProjectionStats(
  stats: Record<string, unknown>,
  context: StatContext = {}
): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(stats)) {
    const value = numeric(rawValue);
    if (value === null) continue;
    const key = normalizeProjectionStatKey(rawKey, context);
    normalized[key] = (normalized[key] ?? 0) + value;
  }
  if (normalized.solo_tkl !== undefined || normalized.ast_tkl !== undefined) {
    normalized.total_tkl = normalized.total_tkl ?? (normalized.solo_tkl ?? 0) + (normalized.ast_tkl ?? 0);
  }
  return normalized;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
