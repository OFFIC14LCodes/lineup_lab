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
};

const HISTORY_KEY_ALIASES: Record<string, string[]> = {
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
  sacks: ["sack", "def_sack"],
  tackles: ["tackle_solo", "solo_tackle"],
  assists: ["tackle_ast", "assist_tackle"],
  interceptionsDefense: ["def_int", "interception"],
  fieldGoalsMade: ["fgm"],
  fieldGoalsAttempted: ["fga"],
  extraPointsMade: ["xpm"],
};

const POSITION_STAT_KEYS: Record<string, string[]> = {
  QB: ["passAttempts", "passCompletions", "passYards", "passTds", "interceptions", "carries", "rushingYards", "rushingTds", "fumblesLost"],
  RB: ["carries", "rushingYards", "rushingTds", "targets", "receptions", "receivingYards", "receivingTds", "fumblesLost"],
  WR: ["targets", "receptions", "receivingYards", "receivingTds", "carries", "rushingYards", "rushingTds", "fumblesLost"],
  TE: ["targets", "receptions", "receivingYards", "receivingTds", "fumblesLost"],
  K: ["fieldGoalsMade", "fieldGoalsAttempted", "extraPointsMade"],
  DL: ["sacks", "tackles", "assists", "interceptionsDefense"],
  LB: ["tackles", "assists", "sacks", "interceptionsDefense"],
  DB: ["tackles", "assists", "interceptionsDefense", "sacks"],
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
      const value = source === "projection" ? numeric(stats[key]) : readHistoricalValue(stats, key);
      if (value === null) return null;
      return {
        key,
        label: STAT_LABELS[key] ?? key,
        value,
      };
    })
    .filter((item): item is PlayerProfileStatLineItem => item !== null);
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
