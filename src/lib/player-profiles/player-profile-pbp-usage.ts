import { existsSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import { nflverseNumber, nflverseString } from "@/lib/data-acquisition/nflverse";
import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

import type {
  PlayerProfileHighValueRoleModifier,
  PlayerProfileHighValueRoleWarning,
  PlayerProfileHighValueUsageSummary,
  PlayerProfileSeasonHighValueUsageSummary,
  PlayerProfileTrendLabel,
  PlayerProfileWeeklyHighValueUsage,
} from "./player-profile-types";

export type PlayerProfilePbpSourceDiagnostics = {
  exists: boolean;
  filePath: string;
  selectedFile: string | null;
  candidateFiles: string[];
  fields: string[];
  requiredColumns: string[];
  missingColumns: string[];
  rowCount: number;
  seasons: number[];
  derivedPlayerWeekRows: number;
  playersWithGsisId: number;
  matchedRows: number;
  unmatchedRows: number;
};

export type PlayerProfilePbpUsageSources = {
  weeklyByGsisId: Map<string, PlayerProfilePbpWeeklyHighValueUsage[]>;
  diagnostics: PlayerProfilePbpSourceDiagnostics;
};

type PlayerProfilePbpWeeklyHighValueUsage = PlayerProfileWeeklyHighValueUsage & { gsisId: string };

export type PlayerProfileHighValueUsageProfile = {
  highValueUsageSummary: PlayerProfileHighValueUsageSummary;
  seasonHighValueUsageSummaries: PlayerProfileSeasonHighValueUsageSummary[];
  weeklyHighValueUsage: PlayerProfileWeeklyHighValueUsage[];
  highValueRoleWarnings: PlayerProfileHighValueRoleWarning[];
};

const PBP_REQUIRED_COLUMNS = ["play_type", "yardline_100"];
const PBP_CANDIDATE_FILES = ["pbp_2023_2025.csv", "pbp_2018_2025.csv"];

export function loadPlayerProfilePbpUsageSources(projectRoot = process.cwd()): PlayerProfilePbpUsageSources {
  const dataDir = path.join(projectRoot, "data", "nflverse");
  const candidates = PBP_CANDIDATE_FILES.map((file) => path.join(dataDir, file));
  const selectedFile = candidates.find((filePath) => existsSync(filePath)) ?? candidates[0];
  const source = loadPbpHighValueUsage(selectedFile, candidates);
  return {
    weeklyByGsisId: groupRows(source.rows, (row) => row.gsisId),
    diagnostics: {
      ...source.diagnostics,
      derivedPlayerWeekRows: source.rows.length,
      playersWithGsisId: new Set(source.rows.map((row) => row.gsisId).filter(Boolean)).size,
      matchedRows: 0,
      unmatchedRows: source.rows.length,
    },
  };
}

export function markPbpUsageSourceMatches(
  sources: PlayerProfilePbpUsageSources,
  input: { matchedGsisIds: Set<string> }
): PlayerProfilePbpSourceDiagnostics {
  const rows = Array.from(sources.weeklyByGsisId.values()).flat();
  const matchedRows = rows.filter((row) => input.matchedGsisIds.has(row.gsisId)).length;
  return {
    ...sources.diagnostics,
    matchedRows,
    unmatchedRows: Math.max(0, rows.length - matchedRows),
  };
}

export function buildPlayerProfileHighValueUsageProfile(input: {
  position: BlackbirdNflversePosition;
  weeklyHighValueUsage?: PlayerProfileWeeklyHighValueUsage[];
  sourceAvailable: boolean;
}): PlayerProfileHighValueUsageProfile {
  const weeklyHighValueUsage = (input.weeklyHighValueUsage ?? []).map((row) => normalizeForPosition(row, input.position)).sort(
    (a, b) => (b.season ?? 0) - (a.season ?? 0) || (b.week ?? 0) - (a.week ?? 0)
  );
  const seasonHighValueUsageSummaries = buildSeasonSummaries(weeklyHighValueUsage, input.position, input.sourceAvailable);
  const highValueUsageSummary = summarizeHighValueUsage(weeklyHighValueUsage, input.position, input.sourceAvailable, seasonHighValueUsageSummaries);
  const highValueRoleWarnings = buildWarnings(highValueUsageSummary, input.sourceAvailable);
  return {
    highValueUsageSummary,
    seasonHighValueUsageSummaries,
    weeklyHighValueUsage,
    highValueRoleWarnings,
  };
}

function normalizeForPosition(row: PlayerProfileWeeklyHighValueUsage, position: BlackbirdNflversePosition): PlayerProfileWeeklyHighValueUsage {
  if (position === "QB") return { ...row };
  return {
    ...row,
    redZonePassAttempts: 0,
    designedQbRushes: 0,
    scrambles: 0,
  };
}

function loadPbpHighValueUsage(filePath: string, candidateFiles = [filePath]): {
  rows: PlayerProfilePbpWeeklyHighValueUsage[];
  diagnostics: Omit<PlayerProfilePbpSourceDiagnostics, "derivedPlayerWeekRows" | "playersWithGsisId" | "matchedRows" | "unmatchedRows">;
} {
  if (!existsSync(filePath)) {
    return {
      rows: [],
      diagnostics: {
        exists: false,
        filePath,
        selectedFile: null,
        candidateFiles,
        fields: [],
        requiredColumns: [...PBP_REQUIRED_COLUMNS, "season/week or game_id", "player id columns"],
        missingColumns: [...PBP_REQUIRED_COLUMNS, "season/week or game_id", "player id columns"],
        rowCount: 0,
        seasons: [],
      },
    };
  }

  let header: string[] = [];
  let rowCount = 0;
  const seasons = new Set<number>();
  const aggregates = new Map<string, PlayerProfilePbpWeeklyHighValueUsage>();

  forEachCsvLine(filePath, (row, index) => {
    if (index === 0) {
      header = row;
      return;
    }
    rowCount += 1;
    const record = Object.fromEntries(header.map((field, fieldIndex) => [field, row[fieldIndex] ?? ""]));
    const parts = weekParts(record);
    if (!parts) return;
    seasons.add(parts.season);
    addPlayToAggregates(aggregates, record, parts);
  });

  const missing = validatePbpColumns(header);
  return {
    rows: missing.length ? [] : Array.from(aggregates.values()),
    diagnostics: {
      exists: true,
      filePath,
      selectedFile: filePath,
      candidateFiles,
      fields: header,
      requiredColumns: [...PBP_REQUIRED_COLUMNS, "season/week or game_id", "player id columns"],
      missingColumns: missing,
      rowCount,
      seasons: Array.from(seasons).sort((a, b) => a - b),
    },
  };
}

function addPlayToAggregates(
  aggregates: Map<string, PlayerProfilePbpWeeklyHighValueUsage>,
  record: Record<string, string>,
  parts: { season: number; week: number }
) {
  const yardline = nflverseNumber(record.yardline_100);
  const down = nflverseNumber(record.down);
  const airYards = nflverseNumber(record.air_yards);
  const playType = nflverseString(record.play_type)?.toLowerCase() ?? "";
  const isRush = boolValue(record.rush_attempt) || playType === "run" || playType === "qb_scramble";
  const isPass = boolValue(record.pass_attempt) || playType === "pass";
  const isThirdDown = down === 3;
  const isTwoMinute = (nflverseNumber(record.half_seconds_remaining) ?? nflverseNumber(record.game_seconds_remaining) ?? 9999) <= 120;
  const isRedZone = typeof yardline === "number" && yardline <= 20;
  const isInside10 = typeof yardline === "number" && yardline <= 10;
  const isInside5 = typeof yardline === "number" && yardline <= 5;
  const isGoalLine = typeof yardline === "number" && yardline <= 2;
  const isDeepTarget = typeof airYards === "number" && airYards >= 20;
  const isEndZoneTarget = isPass && typeof yardline === "number" && typeof airYards === "number" && airYards >= yardline;
  const rushTd = boolValue(record.rush_touchdown) || (nflverseString(record.td_player_id) && nflverseString(record.td_player_id) === nflverseString(record.rusher_player_id));
  const recTd = boolValue(record.pass_touchdown) || (nflverseString(record.td_player_id) && nflverseString(record.td_player_id) === nflverseString(record.receiver_player_id));

  const rusherId = nflverseString(record.rusher_player_id);
  if (isRush && rusherId) {
    const row = aggregateFor(aggregates, rusherId, parts);
    row.carries += 1;
    row.rushTouchdowns += rushTd ? 1 : 0;
    if (isRedZone) row.redZoneCarries += 1;
    if (isInside10) row.inside10Carries += 1;
    if (isInside5) row.inside5Carries += 1;
    if (isGoalLine) row.goalLineCarries += 1;
    if (isRedZone || isInside10 || isInside5 || isGoalLine) row.highValueTouches += 1;
    if (boolValue(record.qb_scramble) || playType === "qb_scramble") row.scrambles += 1;
    else row.designedQbRushes += 1;
  }

  const receiverId = nflverseString(record.receiver_player_id);
  if (isPass && receiverId) {
    const row = aggregateFor(aggregates, receiverId, parts);
    row.targets += 1;
    row.receivingTouchdowns += recTd ? 1 : 0;
    if (isRedZone) row.redZoneTargets += 1;
    if (isInside10) row.inside10Targets += 1;
    if (isEndZoneTarget) row.endZoneTargets += 1;
    if (isDeepTarget) row.deepTargets += 1;
    if (isThirdDown) row.thirdDownTargets += 1;
    if (isTwoMinute) row.twoMinuteTargets += 1;
    if (isRedZone || isInside10 || isEndZoneTarget || isDeepTarget || isThirdDown || isTwoMinute) row.highValueTargets += 1;
    row.airYards = round((row.airYards ?? 0) + (airYards ?? 0));
    if (boolValue(record.complete_pass)) row.receptions += 1;
  }

  const passerId = nflverseString(record.passer_player_id);
  if (isPass && passerId) {
    const row = aggregateFor(aggregates, passerId, parts);
    row.passingAttempts += 1;
    if (isRedZone) row.redZonePassAttempts += 1;
  }
}

function aggregateFor(
  aggregates: Map<string, PlayerProfilePbpWeeklyHighValueUsage>,
  gsisId: string,
  parts: { season: number; week: number }
) {
  const key = `${gsisId}:${parts.season}:${parts.week}`;
  const existing = aggregates.get(key);
  if (existing) return existing;
  const row: PlayerProfilePbpWeeklyHighValueUsage = {
    gsisId,
    season: parts.season,
    week: parts.week,
    carries: 0,
    targets: 0,
    receptions: 0,
    rushTouchdowns: 0,
    receivingTouchdowns: 0,
    passingAttempts: 0,
    redZoneCarries: 0,
    inside10Carries: 0,
    inside5Carries: 0,
    goalLineCarries: 0,
    redZoneTargets: 0,
    inside10Targets: 0,
    endZoneTargets: 0,
    deepTargets: 0,
    thirdDownTargets: 0,
    twoMinuteTargets: 0,
    highValueTouches: 0,
    highValueTargets: 0,
    airYards: null,
    redZonePassAttempts: 0,
    designedQbRushes: 0,
    scrambles: 0,
  };
  aggregates.set(key, row);
  return row;
}

function buildSeasonSummaries(
  rows: PlayerProfileWeeklyHighValueUsage[],
  position: BlackbirdNflversePosition,
  sourceAvailable: boolean
): PlayerProfileSeasonHighValueUsageSummary[] {
  const bySeason = groupRows(rows, (row) => String(row.season ?? "unknown"));
  return Array.from(bySeason.entries())
    .map(([season, seasonRows]) => ({
      ...summarizeHighValueUsage(seasonRows, position, sourceAvailable, []),
      season: season === "unknown" ? null : Number(season),
      games: seasonRows.length,
    }))
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
}

function summarizeHighValueUsage(
  rows: PlayerProfileWeeklyHighValueUsage[],
  position: BlackbirdNflversePosition,
  sourceAvailable: boolean,
  seasonSummaries: PlayerProfileSeasonHighValueUsageSummary[]
): PlayerProfileHighValueUsageSummary {
  const games = rows.filter(hasAnySignal).length;
  const carries = sum(rows, "carries");
  const targets = sum(rows, "targets");
  const highValueTouches = sum(rows, "highValueTouches");
  const highValueTargets = sum(rows, "highValueTargets");
  const totalTds = sum(rows, "rushTouchdowns") + sum(rows, "receivingTouchdowns");
  const summary: PlayerProfileHighValueUsageSummary = {
    sourceStatus: sourceAvailable ? "available" : "unavailable",
    gamesWithHighValueUsage: games,
    highValueTouchesPerGame: perGame(highValueTouches, games),
    highValueTargetsPerGame: perGame(highValueTargets, games),
    redZoneCarriesPerGame: perGame(sum(rows, "redZoneCarries"), games),
    inside10CarriesPerGame: perGame(sum(rows, "inside10Carries"), games),
    inside5CarriesPerGame: perGame(sum(rows, "inside5Carries"), games),
    goalLineCarriesPerGame: perGame(sum(rows, "goalLineCarries"), games),
    redZoneTargetsPerGame: perGame(sum(rows, "redZoneTargets"), games),
    inside10TargetsPerGame: perGame(sum(rows, "inside10Targets"), games),
    endZoneTargetsPerGame: perGame(sum(rows, "endZoneTargets"), games),
    deepTargetsPerGame: perGame(sum(rows, "deepTargets"), games),
    thirdDownTargetsPerGame: perGame(sum(rows, "thirdDownTargets"), games),
    twoMinuteTargetsPerGame: perGame(sum(rows, "twoMinuteTargets"), games),
    airYardsPerTarget: targets ? round(sumNullable(rows.map((row) => row.airYards)) / targets) : null,
    redZonePassAttemptsPerGame: perGame(sum(rows, "redZonePassAttempts"), games),
    designedQbRushesPerGame: perGame(sum(rows, "designedQbRushes"), games),
    scramblesPerGame: perGame(sum(rows, "scrambles"), games),
    highValueUsageShare: carries ? round((highValueTouches / carries) * 100) : null,
    targetHighValueShare: targets ? round((highValueTargets / targets) * 100) : null,
    touchdownDependency: highValueTouches + highValueTargets ? round((totalTds / Math.max(highValueTouches + highValueTargets, 1)) * 100) : null,
    trendLabel: highValueTrend(seasonSummaries),
    modifiers: [],
  };
  summary.modifiers = highValueModifiers(position, summary);
  return summary;
}

function highValueModifiers(position: BlackbirdNflversePosition, summary: PlayerProfileHighValueUsageSummary): PlayerProfileHighValueRoleModifier[] {
  const modifiers = new Set<PlayerProfileHighValueRoleModifier>();
  if ((summary.goalLineCarriesPerGame ?? 0) >= 0.4) modifiers.add("goal_line_role");
  if ((summary.redZoneCarriesPerGame ?? 0) + (summary.redZoneTargetsPerGame ?? 0) >= 1.5 || (summary.redZonePassAttemptsPerGame ?? 0) >= 4) modifiers.add("red_zone_role");
  if ((summary.endZoneTargetsPerGame ?? 0) >= 0.3) modifiers.add("end_zone_target_role");
  if ((summary.deepTargetsPerGame ?? 0) >= 1.5 || ((position === "WR" || position === "TE") && (summary.airYardsPerTarget ?? 0) >= 12)) modifiers.add("deep_threat");
  if ((summary.highValueTouchesPerGame ?? 0) + (summary.highValueTargetsPerGame ?? 0) >= 2) modifiers.add("high_value_touch_role");
  if ((summary.touchdownDependency ?? 0) >= 22) modifiers.add("td_dependent");
  if (summary.gamesWithHighValueUsage >= 4 && (summary.highValueTouchesPerGame ?? 0) + (summary.highValueTargetsPerGame ?? 0) < 0.75) modifiers.add("low_high_value_usage");
  if (summary.trendLabel === "rising") modifiers.add("high_value_usage_rising");
  if (summary.trendLabel === "declining") modifiers.add("high_value_usage_declining");
  return Array.from(modifiers);
}

function buildWarnings(summary: PlayerProfileHighValueUsageSummary, sourceAvailable: boolean): PlayerProfileHighValueRoleWarning[] {
  const warnings = new Set<PlayerProfileHighValueRoleWarning>();
  if (!sourceAvailable) warnings.add("play_by_play_data_unavailable");
  if (sourceAvailable && summary.gamesWithHighValueUsage === 0) warnings.add("high_value_usage_unavailable");
  if (summary.gamesWithHighValueUsage > 0 && summary.gamesWithHighValueUsage < 6) warnings.add("low_high_value_usage_sample");
  if (summary.modifiers.includes("td_dependent")) warnings.add("td_dependent");
  if (summary.modifiers.includes("deep_threat") && (summary.targetHighValueShare ?? 0) >= 50) warnings.add("big_play_dependent");
  if (summary.modifiers.includes("low_high_value_usage")) warnings.add("low_high_value_usage");
  if (summary.modifiers.includes("high_value_usage_declining")) warnings.add("high_value_usage_declining");
  return Array.from(warnings);
}

function validatePbpColumns(fields: string[]): string[] {
  const missing = PBP_REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
  const hasSeasonWeek = fields.includes("season") && fields.includes("week");
  const hasGameId = fields.includes("game_id") || fields.includes("old_game_id");
  if (!hasSeasonWeek && !hasGameId) missing.push("season/week or game_id");
  if (!["rusher_player_id", "receiver_player_id", "passer_player_id"].some((field) => fields.includes(field))) {
    missing.push("player id columns");
  }
  return missing;
}

function weekParts(record: Record<string, string>): { season: number; week: number } | null {
  const season = nflverseNumber(record.season);
  const week = nflverseNumber(record.week);
  if (season !== null && week !== null) return { season, week };
  const gameId = nflverseString(record.game_id) ?? nflverseString(record.old_game_id);
  const match = /^(\d{4})_(\d{2})_/.exec(gameId ?? "");
  return match ? { season: Number(match[1]), week: Number(match[2]) } : null;
}

function forEachCsvLine(filePath: string, onRow: (row: string[], index: number) => void) {
  const fd = openSync(filePath, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  let leftover = "";
  let rowIndex = 0;
  try {
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      const chunk = leftover + buffer.toString("utf8", 0, bytesRead);
      const lines = chunk.split(/\r?\n/);
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        onRow(parseCsvLine(line), rowIndex);
        rowIndex += 1;
      }
    }
    if (leftover) onRow(parseCsvLine(leftover), rowIndex);
  } finally {
    closeSync(fd);
  }
}

function parseCsvLine(line: string): string[] {
  const parsed = Papa.parse<string[]>(line, { transform: (value) => String(value ?? "").trim() });
  return Array.isArray(parsed.data[0]) ? parsed.data[0] : [];
}

function boolValue(value: unknown): boolean {
  const raw = nflverseString(value)?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "t" || raw === "yes";
}

function hasAnySignal(row: PlayerProfileWeeklyHighValueUsage): boolean {
  return (
    row.carries +
      row.targets +
      row.highValueTouches +
      row.highValueTargets +
      row.redZonePassAttempts +
      row.designedQbRushes +
      row.scrambles >
    0
  );
}

function highValueTrend(seasonSummaries: PlayerProfileSeasonHighValueUsageSummary[]): PlayerProfileTrendLabel {
  if (seasonSummaries.length < 2) return "insufficient_data";
  const latest = (seasonSummaries[0].highValueTouchesPerGame ?? 0) + (seasonSummaries[0].highValueTargetsPerGame ?? 0);
  const previous = (seasonSummaries[1].highValueTouchesPerGame ?? 0) + (seasonSummaries[1].highValueTargetsPerGame ?? 0);
  const diff = latest - previous;
  if (Math.abs(diff) < 0.4) return "stable";
  return diff > 0 ? "rising" : "declining";
}

function groupRows<T>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(keyFor(row), [...(map.get(keyFor(row)) ?? []), row]);
  return map;
}

function sum(rows: PlayerProfileWeeklyHighValueUsage[], key: keyof PlayerProfileWeeklyHighValueUsage): number {
  return round(rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] as number : 0), 0));
}

function sumNullable(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0);
}

function perGame(value: number, games: number): number | null {
  return games ? round(value / games) : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
