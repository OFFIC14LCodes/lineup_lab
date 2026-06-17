import { existsSync } from "node:fs";
import path from "node:path";

import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

import type {
  PlayerProfileRoleConfidence,
  PlayerProfileRoleLabel,
  PlayerProfileRoleMetrics,
  PlayerProfileRoleModifier,
  PlayerProfileRoleWarning,
  PlayerProfileSeasonUsageSummary,
  PlayerProfileTrendLabel,
  PlayerProfileUsageSummary,
  PlayerProfileWeeklyStats,
  PlayerProfileWeeklyUsage,
} from "./player-profile-types";
import type { PlayerProfileParticipationRow, PlayerProfileSnapCountRow } from "./player-profile-snap-sources";

export type PlayerProfileUsageSourceDiagnostics = {
  used: string[];
  missing: string[];
  hasSnapData: boolean;
  hasParticipationData: boolean;
  hasPlayByPlayData: boolean;
};

export type PlayerProfileUsageProfile = {
  usageSummary: PlayerProfileUsageSummary;
  seasonUsageSummaries: PlayerProfileSeasonUsageSummary[];
  weeklyUsage: PlayerProfileWeeklyUsage[];
  roleMetrics: PlayerProfileRoleMetrics;
  roleWarnings: PlayerProfileRoleWarning[];
};

const OPTIONAL_USAGE_FILES = [
  "snap_counts_2018_2025.csv",
  "participation_2018_2025.csv",
  "pbp_2023_2025.csv",
  "pbp_2018_2025.csv",
] as const;

export function detectPlayerProfileUsageSources(dataDir = path.join(process.cwd(), "data", "nflverse")): PlayerProfileUsageSourceDiagnostics {
  const used: string[] = [];
  const missing: string[] = [];
  for (const file of ["player_stats_2018_2025.csv", "player_stats_2025.csv"]) {
    const filePath = path.join(dataDir, file);
    if (existsSync(filePath)) used.push(path.join("data", "nflverse", file));
    else missing.push(path.join("data", "nflverse", file));
  }
  for (const file of OPTIONAL_USAGE_FILES) {
    const filePath = path.join(dataDir, file);
    if (existsSync(filePath)) used.push(path.join("data", "nflverse", file));
    else missing.push(path.join("data", "nflverse", file));
  }
  return {
    used,
    missing,
    hasSnapData: existsSync(path.join(dataDir, "snap_counts_2018_2025.csv")),
    hasParticipationData: existsSync(path.join(dataDir, "participation_2018_2025.csv")),
    hasPlayByPlayData: existsSync(path.join(dataDir, "pbp_2023_2025.csv")) || existsSync(path.join(dataDir, "pbp_2018_2025.csv")),
  };
}

export function buildPlayerProfileUsageProfile(input: {
  position: BlackbirdNflversePosition;
  weeklyStats: PlayerProfileWeeklyStats[];
  snapCounts?: PlayerProfileSnapCountRow[];
  participation?: PlayerProfileParticipationRow[];
  matchConfidence: string;
  sources: PlayerProfileUsageSourceDiagnostics;
}): PlayerProfileUsageProfile {
  const snapByWeek = mapSnapRows(input.snapCounts ?? []);
  const participationByWeek = mapParticipationRows(input.participation ?? []);
  const weeklyUsage = input.weeklyStats
    .map((row) => toWeeklyUsage(row, snapByWeek.get(weekKey(row.season, row.week)), participationByWeek.get(weekKey(row.season, row.week))))
    .filter((row) => usageSignal(row, input.position));
  for (const snapRow of input.snapCounts ?? []) {
    const key = weekKey(snapRow.season, snapRow.week);
    if (weeklyUsage.some((row) => weekKey(row.season, row.week) === key)) continue;
    const participation = participationByWeek.get(key);
    const row = snapOnlyUsage(snapRow, participation);
    if (usageSignal(row, input.position)) weeklyUsage.push(row);
  }
  const seasonUsageSummaries = buildSeasonUsageSummaries(weeklyUsage, input.position);
  const usageSummary = summarizeUsage(weeklyUsage, input.position, input.sources, seasonUsageSummaries);
  const roleWarnings = buildRoleWarnings(usageSummary, input.sources, input.position);
  const roleMetrics = buildRoleMetrics({
    position: input.position,
    usageSummary,
    seasonUsageSummaries,
    weeklyUsage,
    matchConfidence: input.matchConfidence,
    sources: input.sources,
    roleWarnings,
  });

  return { usageSummary, seasonUsageSummaries, weeklyUsage, roleMetrics, roleWarnings };
}

function toWeeklyUsage(
  row: PlayerProfileWeeklyStats,
  snapRow?: PlayerProfileSnapCountRow,
  participation?: PlayerProfileParticipationRow
): PlayerProfileWeeklyUsage {
  const carries = stat(row.rushing, "rush_att");
  const targets = stat(row.receiving, "targets");
  const receptions = stat(row.receiving, "rec");
  const passAttempts = stat(row.passing, "pass_att");
  const totalYards = stat(row.rushing, "rush_yd") + stat(row.receiving, "rec_yd") + stat(row.passing, "pass_yd");
  const totalTouchdowns = stat(row.rushing, "rush_td") + stat(row.receiving, "rec_td") + stat(row.passing, "pass_td") + stat(row.defensive, "def_td");
  const soloTackles = stat(row.defensive, "solo_tkl");
  const assistedTackles = stat(row.defensive, "ast_tkl");
  const sacks = stat(row.defensive, "sack");
  const splashPlays = sacks + stat(row.defensive, "int") + stat(row.defensive, "ff") + stat(row.defensive, "pd") + stat(row.defensive, "def_td");
  return {
    season: row.season,
    week: row.week,
    opportunities: round(carries + targets),
    touches: round(carries + receptions),
    carries,
    targets,
    receptions,
    passAttempts,
    totalYards,
    totalTouchdowns,
    soloTackles,
    assistedTackles,
    sacks,
    splashPlays,
    offenseSnaps: snapRow?.offenseSnaps ?? null,
    defenseSnaps: snapRow?.defenseSnaps ?? null,
    specialTeamsSnaps: snapRow?.specialTeamsSnaps ?? null,
    offensiveSnapShare: snapRow?.offenseSnapShare ?? null,
    defensiveSnapShare: snapRow?.defenseSnapShare ?? null,
    specialTeamsSnapShare: snapRow?.specialTeamsSnapShare ?? null,
    participationOffensePlays: participation?.offensePlays ?? null,
    participationDefensePlays: participation?.defensePlays ?? null,
  };
}

function snapOnlyUsage(snapRow: PlayerProfileSnapCountRow, participation?: PlayerProfileParticipationRow): PlayerProfileWeeklyUsage {
  return {
    season: snapRow.season,
    week: snapRow.week,
    opportunities: 0,
    touches: 0,
    carries: 0,
    targets: 0,
    receptions: 0,
    passAttempts: 0,
    totalYards: 0,
    totalTouchdowns: 0,
    soloTackles: 0,
    assistedTackles: 0,
    sacks: 0,
    splashPlays: 0,
    offenseSnaps: snapRow.offenseSnaps,
    defenseSnaps: snapRow.defenseSnaps,
    specialTeamsSnaps: snapRow.specialTeamsSnaps,
    offensiveSnapShare: snapRow.offenseSnapShare,
    defensiveSnapShare: snapRow.defenseSnapShare,
    specialTeamsSnapShare: snapRow.specialTeamsSnapShare,
    participationOffensePlays: participation?.offensePlays ?? null,
    participationDefensePlays: participation?.defensePlays ?? null,
  };
}

function buildSeasonUsageSummaries(weeklyUsage: PlayerProfileWeeklyUsage[], position: BlackbirdNflversePosition): PlayerProfileSeasonUsageSummary[] {
  const seasons = new Map<string, PlayerProfileWeeklyUsage[]>();
  for (const row of weeklyUsage) {
    const key = String(row.season ?? "unknown");
    seasons.set(key, [...(seasons.get(key) ?? []), row]);
  }
  return Array.from(seasons.entries())
    .map(([season, rows]) => ({
      ...summarizeUsage(rows, position, null, []),
      season: season === "unknown" ? null : Number(season),
      games: rows.length,
    }))
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
}

function summarizeUsage(
  weeklyUsage: PlayerProfileWeeklyUsage[],
  position: BlackbirdNflversePosition,
  sources: PlayerProfileUsageSourceDiagnostics | null,
  seasonUsageSummaries: PlayerProfileSeasonUsageSummary[]
): PlayerProfileUsageSummary {
  const games = weeklyUsage.length;
  const carries = sum(weeklyUsage, "carries");
  const targets = sum(weeklyUsage, "targets");
  const receptions = sum(weeklyUsage, "receptions");
  const touches = sum(weeklyUsage, "touches");
  const opportunities = sum(weeklyUsage, "opportunities");
  const totalYards = sum(weeklyUsage, "totalYards");
  const touchdowns = sum(weeklyUsage, "totalTouchdowns");
  const soloTackles = sum(weeklyUsage, "soloTackles");
  const assistedTackles = sum(weeklyUsage, "assistedTackles");
  const sacks = sum(weeklyUsage, "sacks");
  const splashPlays = sum(weeklyUsage, "splashPlays");
  const snapRows = weeklyUsage.filter((row) => row.offensiveSnapShare !== null || row.defensiveSnapShare !== null || row.specialTeamsSnapShare !== null);
  const participationRows = weeklyUsage.filter((row) => row.participationOffensePlays !== null || row.participationDefensePlays !== null);
  const primarySnapShares = weeklyUsage
    .map((row) => primarySnapShare(row, position))
    .filter((value): value is number => typeof value === "number");
  const opportunityValues = weeklyUsage.map((row) => position === "QB" ? row.passAttempts + row.carries : ["DL", "LB", "DB"].includes(position) ? row.soloTackles + row.assistedTackles : row.opportunities);
  const trendLabel = seasonUsageSummaries.length >= 2
    ? usageTrend(
        seasonUsageSummaries[0].offensiveSnapShare ?? seasonUsageSummaries[0].defensiveSnapShare ?? seasonUsageSummaries[0].opportunitiesPerGame ?? seasonUsageSummaries[0].tackleFloorScore,
        seasonUsageSummaries[1].offensiveSnapShare ?? seasonUsageSummaries[1].defensiveSnapShare ?? seasonUsageSummaries[1].opportunitiesPerGame ?? seasonUsageSummaries[1].tackleFloorScore
      )
    : "insufficient_data";

  return {
    sourceBasis: snapRows.length || participationRows.length || sources?.hasSnapData || sources?.hasParticipationData ? "weekly_stats_plus_snaps" : games ? "weekly_stats" : "unavailable",
    gamesWithUsage: games,
    opportunitiesPerGame: perGame(opportunities, games),
    touchesPerGame: perGame(touches, games),
    carriesPerGame: perGame(carries, games),
    targetsPerGame: perGame(targets, games),
    receptionsPerGame: perGame(receptions, games),
    passAttemptsPerGame: perGame(sum(weeklyUsage, "passAttempts"), games),
    yardsPerTouch: touches ? round(totalYards / touches) : null,
    touchdownDependency: touchdowns && touches ? round((touchdowns / touches) * 100) : touchdowns ? 100 : 0,
    receivingUsageShare: opportunities ? round((targets / opportunities) * 100) : null,
    rushingUsageShare: opportunities ? round((carries / opportunities) * 100) : null,
    targetVolumePerGame: perGame(targets, games),
    tackleFloorScore: ["DL", "LB", "DB"].includes(position) ? round(clamp((perGame(soloTackles + assistedTackles, games) ?? 0) * 10, 0, 100)) : null,
    bigPlayDependencyScore: ["DL", "LB", "DB"].includes(position) ? round(clamp((splashPlays / Math.max(soloTackles + assistedTackles + splashPlays, 1)) * 100, 0, 100)) : null,
    sackDependencyScore: ["DL", "LB", "DB"].includes(position) ? round(clamp((sacks / Math.max(soloTackles + assistedTackles + sacks, 1)) * 100, 0, 100)) : null,
    gamesWithSnapData: snapRows.length,
    gamesWithParticipationData: participationRows.length,
    weeklyUsageConsistency: usageConsistency(opportunityValues),
    offensiveSnapShare: average(weeklyUsage.map((row) => row.offensiveSnapShare)),
    defensiveSnapShare: average(weeklyUsage.map((row) => row.defensiveSnapShare)),
    specialTeamsSnapShare: average(weeklyUsage.map((row) => row.specialTeamsSnapShare)),
    gamesOver70PercentSnaps: primarySnapShares.filter((value) => value >= 0.7).length,
    gamesUnder40PercentSnaps: primarySnapShares.filter((value) => value > 0 && value < 0.4).length,
    trendLabel,
  };
}

function buildRoleMetrics(input: {
  position: BlackbirdNflversePosition;
  usageSummary: PlayerProfileUsageSummary;
  seasonUsageSummaries: PlayerProfileSeasonUsageSummary[];
  weeklyUsage: PlayerProfileWeeklyUsage[];
  matchConfidence: string;
  sources: PlayerProfileUsageSourceDiagnostics;
  roleWarnings: PlayerProfileRoleWarning[];
}): PlayerProfileRoleMetrics {
  const roleLabel = roleLabelFor(input.position, input.usageSummary);
  const roleConfidence = roleConfidenceFor(input.weeklyUsage.length, input.matchConfidence, input.sources);
  const roleModifiers = roleModifiersFor(input.position, input.usageSummary, input.seasonUsageSummaries);
  const dataGaps = [
    ...(!input.sources.hasSnapData ? ["snap counts"] : []),
    ...(!input.sources.hasParticipationData ? ["participation"] : []),
    ...(!input.sources.hasPlayByPlayData ? ["play-by-play/red-zone/high-value-touch context"] : []),
  ];
  return {
    roleLabel,
    roleConfidence,
    roleStabilityLabel: roleStabilityLabel(input.usageSummary, roleConfidence),
    idpArchetype: idpArchetype(input.position, input.usageSummary),
    roleModifiers,
    roleTrend: input.usageSummary.trendLabel,
    keySignals: keySignals(input.position, input.usageSummary, roleLabel, roleModifiers),
    dataGaps,
  };
}

function roleLabelFor(position: BlackbirdNflversePosition, usage: PlayerProfileUsageSummary): PlayerProfileRoleLabel {
  if (usage.gamesWithUsage < 4) return "insufficient_data";
  if (["DL", "LB", "DB"].includes(position)) {
    if ((usage.tackleFloorScore ?? 0) >= 65 && (usage.bigPlayDependencyScore ?? 0) <= 35) return "tackle_floor";
    if ((usage.sackDependencyScore ?? 0) >= 20) return "sack_upside";
    if ((usage.bigPlayDependencyScore ?? 0) >= 45) return "big_play_dependent";
    if ((usage.tackleFloorScore ?? 0) >= 45) return "balanced";
    return "low_usage";
  }
  if (position === "QB") return (usage.carriesPerGame ?? 0) >= 4.5 ? "rushing_qb" : "pocket_qb";
  if (position === "RB") {
    if ((usage.touchesPerGame ?? 0) >= 18) return "workhorse";
    if ((usage.touchesPerGame ?? 0) >= 13) return "lead_back";
    if ((usage.targetsPerGame ?? 0) >= 4 || (usage.receivingUsageShare ?? 0) >= 35) return "receiving_back";
    if ((usage.touchesPerGame ?? 0) >= 7) return "committee_back";
    return "low_usage";
  }
  if (position === "WR" || position === "TE") {
    if ((usage.targetsPerGame ?? 0) >= 8) return "alpha_receiver";
    if ((usage.targetsPerGame ?? 0) >= 5) return "volume_receiver";
    if ((usage.yardsPerTouch ?? 0) >= 14 && (usage.targetsPerGame ?? 0) >= 3) return "field_stretcher";
    return "low_usage";
  }
  return "low_usage";
}

function idpArchetype(position: BlackbirdNflversePosition, usage: PlayerProfileUsageSummary): PlayerProfileRoleMetrics["idpArchetype"] {
  if (!["DL", "LB", "DB"].includes(position)) return null;
  if ((usage.tackleFloorScore ?? 0) >= 65 && (usage.bigPlayDependencyScore ?? 0) <= 35) return "tackle_floor";
  if ((usage.sackDependencyScore ?? 0) >= 20) return "big_play_edge";
  if ((usage.bigPlayDependencyScore ?? 0) >= 45) return "coverage_playmaker";
  if ((usage.tackleFloorScore ?? 0) >= 45) return "balanced_idp";
  return "low_signal";
}

function roleConfidenceFor(games: number, matchConfidence: string, sources: PlayerProfileUsageSourceDiagnostics): PlayerProfileRoleConfidence {
  if (games < 6 || matchConfidence === "weak" || matchConfidence === "conflict") return "low";
  if (games >= 20 && (matchConfidence === "exact_id" || matchConfidence === "strong") && (sources.hasSnapData || sources.hasParticipationData)) return "high";
  if (games >= 12 && (matchConfidence === "exact_id" || matchConfidence === "strong")) return "medium";
  return "low";
}

function buildRoleWarnings(usage: PlayerProfileUsageSummary, sources: PlayerProfileUsageSourceDiagnostics, position: BlackbirdNflversePosition): PlayerProfileRoleWarning[] {
  const warnings = new Set<PlayerProfileRoleWarning>();
  if (usage.gamesWithSnapData === 0) warnings.add("weekly_stat_usage_only");
  if (!sources.hasSnapData) warnings.add("snap_data_unavailable");
  if (!sources.hasParticipationData) warnings.add("participation_data_unavailable");
  if (!sources.hasPlayByPlayData) warnings.add("play_by_play_data_unavailable");
  if (usage.gamesWithUsage > 0 && usage.gamesWithUsage < 6) warnings.add("low_usage_sample");
  if ((usage.touchdownDependency ?? 0) >= 12) warnings.add("td_dependent");
  if ((usage.bigPlayDependencyScore ?? 0) >= 45) warnings.add("big_play_dependent");
  if (primaryAverageSnapShare(usage, position) !== null && (primaryAverageSnapShare(usage, position) ?? 0) < 0.4) warnings.add("low_snap_share");
  if ((usage.weeklyUsageConsistency ?? 0) <= 45 && usage.gamesWithSnapData > 0) warnings.add("fragile_role");
  if (usage.trendLabel === "declining" && usage.gamesWithSnapData > 0) warnings.add("declining_snap_share");
  if ((usage.gamesOver70PercentSnaps ?? 0) >= 4 && lowProductionUsage(usage)) warnings.add("opportunity_without_production");
  return Array.from(warnings);
}

function keySignals(position: BlackbirdNflversePosition, usage: PlayerProfileUsageSummary, roleLabel: PlayerProfileRoleLabel, modifiers: PlayerProfileRoleModifier[]): string[] {
  const signals = [`Role label: ${roleLabel.replaceAll("_", " ")}`];
  if (position === "QB") signals.push(`${format(usage.passAttemptsPerGame)} pass attempts/g`, `${format(usage.carriesPerGame)} carries/g`);
  else if (["RB", "WR", "TE"].includes(position)) signals.push(`${format(usage.opportunitiesPerGame)} opportunities/g`, `${format(usage.touchesPerGame)} touches/g`, `${format(usage.targetsPerGame)} targets/g`);
  else if (["DL", "LB", "DB"].includes(position)) signals.push(`${format(usage.tackleFloorScore)}/100 tackle floor`, `${format(usage.bigPlayDependencyScore)}/100 big-play dependency`);
  if (["QB", "RB", "WR", "TE", "K"].includes(position) && usage.offensiveSnapShare !== null) signals.push(`${formatPercent(usage.offensiveSnapShare)} avg offensive snaps`);
  if (["DL", "LB", "DB"].includes(position) && usage.defensiveSnapShare !== null) signals.push(`${formatPercent(usage.defensiveSnapShare)} avg defensive snaps`);
  if (modifiers.length) signals.push(`Role modifiers: ${modifiers.map((modifier) => modifier.replaceAll("_", " ")).join(", ")}`);
  signals.push(`${format(usage.weeklyUsageConsistency)}/100 weekly usage consistency`);
  return signals.filter((signal) => !signal.includes("n/a"));
}

function roleModifiersFor(
  position: BlackbirdNflversePosition,
  usage: PlayerProfileUsageSummary,
  seasonUsageSummaries: PlayerProfileSeasonUsageSummary[]
): PlayerProfileRoleModifier[] {
  const modifiers = new Set<PlayerProfileRoleModifier>();
  const primarySnap = primaryAverageSnapShare(usage, position);
  if (primarySnap !== null) {
    if (primarySnap >= 0.7) modifiers.add("full_time_role");
    else if (primarySnap >= 0.4) modifiers.add("part_time_role");
    else if (primarySnap > 0) modifiers.add("rotational_role");
  }
  if ((usage.specialTeamsSnapShare ?? 0) >= 0.45 && (usage.offensiveSnapShare ?? 0) < 0.1 && (usage.defensiveSnapShare ?? 0) < 0.1) {
    modifiers.add("special_teams_only");
  }
  if (usage.trendLabel === "rising" && usage.gamesWithSnapData > 0) modifiers.add("snap_share_rising");
  if (usage.trendLabel === "declining" && usage.gamesWithSnapData > 0) modifiers.add("snap_share_declining");
  if (primarySnap !== null && primarySnap < 0.55 && hasProductionSignal(position, usage)) modifiers.add("production_without_full_role");
  if (primarySnap !== null && primarySnap >= 0.7 && lowProductionUsage(usage)) modifiers.add("full_role_low_production");
  if (seasonUsageSummaries.length < 2 && usage.trendLabel === "insufficient_data") modifiers.delete("snap_share_rising");
  return Array.from(modifiers);
}

function roleStabilityLabel(usage: PlayerProfileUsageSummary, roleConfidence: PlayerProfileRoleConfidence): PlayerProfileRoleMetrics["roleStabilityLabel"] {
  if (roleConfidence === "low") return "low";
  if (usage.gamesWithSnapData > 0 && usage.weeklyUsageConsistency >= 70 && usage.trendLabel !== "declining") return "high";
  if (usage.weeklyUsageConsistency >= 55) return "medium";
  return "low";
}

function usageTrend(latest: number | null | undefined, previous: number | null | undefined): PlayerProfileTrendLabel {
  if (typeof latest !== "number" || typeof previous !== "number") return "insufficient_data";
  const diff = latest - previous;
  if (Math.abs(diff) < 1) return "stable";
  return diff > 0 ? "rising" : "declining";
}

function usageConsistency(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return round(clamp(100 - (sd / Math.max(Math.abs(mean), 1)) * 35, 0, 100));
}

function usageSignal(row: PlayerProfileWeeklyUsage, position: BlackbirdNflversePosition): boolean {
  if (row.offenseSnaps || row.defenseSnaps || row.specialTeamsSnaps || row.participationOffensePlays || row.participationDefensePlays) return true;
  if (["DL", "LB", "DB"].includes(position)) return row.soloTackles + row.assistedTackles + row.sacks + row.splashPlays > 0;
  if (position === "QB") return row.passAttempts + row.carries > 0;
  return row.opportunities + row.touches > 0;
}

function mapSnapRows(rows: PlayerProfileSnapCountRow[]): Map<string, PlayerProfileSnapCountRow> {
  return new Map(rows.map((row) => [weekKey(row.season, row.week), row]));
}

function mapParticipationRows(rows: PlayerProfileParticipationRow[]): Map<string, PlayerProfileParticipationRow> {
  return new Map(rows.map((row) => [weekKey(row.season, row.week), row]));
}

function weekKey(season: number | null, week: number | null) {
  return `${season ?? "unknown"}:${week ?? "unknown"}`;
}

function primarySnapShare(row: PlayerProfileWeeklyUsage, position: BlackbirdNflversePosition): number | null {
  if (["DL", "LB", "DB"].includes(position)) return row.defensiveSnapShare;
  if (["QB", "RB", "WR", "TE", "K"].includes(position)) return row.offensiveSnapShare;
  return row.offensiveSnapShare ?? row.defensiveSnapShare ?? row.specialTeamsSnapShare;
}

function primaryAverageSnapShare(usage: PlayerProfileUsageSummary, position: BlackbirdNflversePosition): number | null {
  if (["DL", "LB", "DB"].includes(position)) return usage.defensiveSnapShare ?? usage.specialTeamsSnapShare ?? usage.offensiveSnapShare;
  if (["QB", "RB", "WR", "TE", "K"].includes(position)) return usage.offensiveSnapShare ?? usage.specialTeamsSnapShare ?? usage.defensiveSnapShare;
  return usage.offensiveSnapShare ?? usage.defensiveSnapShare ?? usage.specialTeamsSnapShare;
}

function hasProductionSignal(position: BlackbirdNflversePosition, usage: PlayerProfileUsageSummary): boolean {
  if (["DL", "LB", "DB"].includes(position)) return (usage.tackleFloorScore ?? 0) >= 45 || (usage.bigPlayDependencyScore ?? 0) >= 20;
  if (position === "QB") return (usage.passAttemptsPerGame ?? 0) >= 20 || (usage.carriesPerGame ?? 0) >= 3;
  return (usage.opportunitiesPerGame ?? 0) >= 7 || (usage.targetsPerGame ?? 0) >= 4;
}

function lowProductionUsage(usage: PlayerProfileUsageSummary): boolean {
  return (usage.opportunitiesPerGame ?? 0) < 4 && (usage.tackleFloorScore ?? 0) < 25 && (usage.passAttemptsPerGame ?? 0) < 12;
}

function average(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numbers.length ? round(numbers.reduce((total, value) => total + value, 0) / numbers.length) : null;
}

function stat(group: Record<string, number | null>, key: string): number {
  const value = group[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sum(rows: PlayerProfileWeeklyUsage[], key: keyof PlayerProfileWeeklyUsage): number {
  return round(rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] as number : 0), 0));
}

function perGame(value: number, games: number): number | null {
  return games ? round(value / games) : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function format(value: number | null) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "n/a";
}

function formatPercent(value: number | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}
