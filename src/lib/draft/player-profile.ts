export type PlayerProfileStatLineItem = {
  key: string;
  label: string;
  value: number;
};

export type PlayerProfileProjection = {
  projectionRunId: string;
  projectionSeason: number | null;
  asOfDate: string | null;
  position: string;
  projectedPpgWhenInRole: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  upsidePoints: number;
  confidenceLabel: string;
  projectedPositionRank: number | null;
  projectionMethod: string;
  statLine: PlayerProfileStatLineItem[];
};

export type PlayerProfileHistoryRow = {
  season: number;
  team: string | null;
  position: string | null;
  gamesPlayed: number | null;
  gamesStarted: number | null;
  fantasyPoints: number | null;
  statLine: PlayerProfileStatLineItem[];
};

const STAT_LABELS: Record<string, string> = {
  passAttempts: "Pass Att",
  passCompletions: "Pass Cmp",
  passYards: "Pass Yds",
  passTds: "Pass TD",
  interceptions: "INT",
  carries: "Rush Att",
  rushingYards: "Rush Yds",
  rushingTds: "Rush TD",
  targets: "Targets",
  receptions: "Rec",
  receivingYards: "Rec Yds",
  receivingTds: "Rec TD",
  fumblesLost: "Fum Lost",
  sacks: "Sacks",
  tackles: "Tackles",
  assists: "Ast",
  interceptionsDefense: "Def INT",
  fieldGoalsMade: "FGM",
  fieldGoalsAttempted: "FGA",
  extraPointsMade: "XPM",
  pass_yd: "Pass Yds",
  pass_td: "Pass TD",
  pass_int: "INT",
  pass_att: "Pass Att",
  pass_cmp: "Pass Cmp",
  rush_att: "Rush Att",
  rush_yd: "Rush Yds",
  rush_td: "Rush TD",
  target: "Targets",
  rec: "Rec",
  rec_yd: "Rec Yds",
  rec_td: "Rec TD",
  ypc: "YPC",
  ypr: "YPR",
  fum: "Fum",
  fum_lost: "Fum Lost",
  solo_tkl: "Solo",
  ast_tkl: "Ast",
  total_tkl: "Total Tkl",
  tfl: "TFL",
  sack: "Sacks",
  qb_hit: "QB Hits",
  pass_def: "PD",
  def_int: "Def INT",
  ff: "FF",
  fr: "FR",
  def_td: "Def TD",
  fg_made: "FGM",
  fg_att: "FGA",
  fg_miss: "FG Miss",
  pat_made: "XPM",
  pat_att: "XPA",
  pat_miss: "XP Miss",
};

const HISTORY_KEY_ALIASES: Record<string, string[]> = {
  pass_yd: ["pass_yd", "passYards"],
  pass_td: ["pass_td", "passTds"],
  pass_int: ["pass_int", "interceptions"],
  pass_att: ["pass_att", "passAttempts"],
  pass_cmp: ["pass_cmp", "passCompletions"],
  rush_att: ["rush_att", "carries"],
  rush_yd: ["rush_yd", "rushingYards"],
  rush_td: ["rush_td", "rushingTds"],
  target: ["target", "targets"],
  rec: ["rec", "receptions"],
  rec_yd: ["rec_yd", "receivingYards"],
  rec_td: ["rec_td", "receivingTds"],
  fum_lost: ["fum_lost", "fumblesLost"],
  solo_tkl: ["solo_tkl", "tackles", "solo_tackles", "tackle_solo"],
  ast_tkl: ["ast_tkl", "assists", "assisted_tackles", "tackle_ast"],
  def_int: ["def_int", "interceptionsDefense", "interception"],
  sack: ["sack", "sacks", "def_sack"],
  passAttempts: ["pass_att"],
  passCompletions: ["pass_cmp"],
  passYards: ["pass_yd"],
  passTds: ["pass_td"],
  interceptions: ["pass_int"],
  carries: ["rush_att", "carries"],
  rushingYards: ["rush_yd"],
  rushingTds: ["rush_td"],
  targets: ["targets"],
  receptions: ["rec", "receptions"],
  receivingYards: ["rec_yd"],
  receivingTds: ["rec_td"],
  fumblesLost: ["fum_lost", "fumbles_lost"],
  sacks: ["sack", "sacks", "def_sack"],
  tackles: ["solo_tkl", "tackle_solo", "solo_tackle", "solo_tackles"],
  assists: ["ast_tkl", "tackle_ast", "assist_tkl", "assist_tackle", "assisted_tackles"],
  interceptionsDefense: ["def_int", "interception"],
  fieldGoalsMade: ["fg_made", "fgm"],
  fieldGoalsAttempted: ["fg_att", "fga"],
  extraPointsMade: ["pat_made", "xpm"],
};

const POSITION_STAT_KEYS: Record<string, string[]> = {
  QB: ["pass_yd", "pass_td", "pass_int", "pass_att", "pass_cmp", "rush_att", "rush_yd", "rush_td", "fum_lost"],
  RB: ["rush_att", "rush_yd", "ypc", "rush_td", "target", "rec", "rec_yd", "rec_td", "fum", "fum_lost"],
  WR: ["target", "rec", "rec_yd", "ypr", "rec_td", "rush_att", "rush_yd", "rush_td", "fum_lost"],
  TE: ["target", "rec", "rec_yd", "ypr", "rec_td", "fum_lost"],
  K: ["pat_made", "pat_att", "fg_made", "fg_att", "fg_miss"],
  DL: ["solo_tkl", "ast_tkl", "total_tkl", "tfl", "sack", "qb_hit", "ff", "fr", "pass_def"],
  LB: ["solo_tkl", "ast_tkl", "total_tkl", "tfl", "sack", "pass_def", "def_int", "ff", "fr"],
  DB: ["solo_tkl", "ast_tkl", "total_tkl", "pass_def", "def_int", "sack", "tfl", "ff", "fr"],
};

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function buildProjectionStatLine(projectedComponentsJson: unknown, position: string | null): PlayerProfileStatLineItem[] {
  const scenarioComponents = asRecord(projectedComponentsJson);
  const median = asRecord(scenarioComponents?.median);
  if (!median) return [];
  return buildStatLineFromRecord(median, position, "projection");
}

export function buildHistoricalStatLine(statsJson: unknown, position: string | null): PlayerProfileStatLineItem[] {
  const stats = asRecord(statsJson);
  if (!stats) return [];
  return buildStatLineFromRecord(stats, position, "history");
}

function buildStatLineFromRecord(stats: Record<string, unknown>, position: string | null, source: "projection" | "history"): PlayerProfileStatLineItem[] {
  const positionKey = normalizePosition(position);
  const statKeys = POSITION_STAT_KEYS[positionKey] ?? Object.keys(STAT_LABELS);

  return statKeys
    .map((key) => {
      const value = source === "projection" ? readProjectionValue(stats, key) : readHistoricalValue(stats, key);
      if (value === null) return null;
      return {
        key,
        label: STAT_LABELS[key] ?? key,
        value,
      };
    })
    .filter((item): item is PlayerProfileStatLineItem => item !== null);
}

function readProjectionValue(stats: Record<string, unknown>, key: string): number | null {
  const exact = numeric(stats[key]);
  if (exact !== null) return exact;
  return readHistoricalValue(stats, key);
}

function readHistoricalValue(stats: Record<string, unknown>, projectionKey: string): number | null {
  const aliases = HISTORY_KEY_ALIASES[projectionKey] ?? [projectionKey];
  for (const alias of aliases) {
    const value = numeric(stats[alias]);
    if (value !== null) return value;
  }
  return null;
}

function normalizePosition(position: string | null): string {
  if (!position) return "";
  const normalized = position.trim().toUpperCase();
  return normalized === "DEF" || normalized === "D/ST" ? "DEF" : normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
