import { normalizePositionGroup } from "@/lib/players/normalize";
import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";
import { scoreFantasyStats } from "@/lib/scoring/score-player";
import type { NormalizedScoringSettings } from "@/lib/scoring/types";

import {
  buildAvailabilityMetrics,
  buildConsistencyMetrics,
  buildRecommendationSignals,
  summarizeKeyStats,
} from "./player-profile-metrics";
import type {
  HistoricalPlayerProfileSnapshot,
  PlayerProfileScoringProfile,
  PlayerProfileWeeklyStats,
} from "./player-profile-types";

export type PlayerProfileScoringSource = "draft_room" | "league" | "default" | "fallback";

export type PlayerProfileScoringMetadata = {
  scoringSource: PlayerProfileScoringSource;
  scoringProfileName: string;
  scoringSettingsSummary: {
    reception: number | null;
    passingYard: number | null;
    passingTd: number | null;
    interception: number | null;
    rushingYard: number | null;
    rushingTd: number | null;
    receivingYard: number | null;
    receivingTd: number | null;
    fumbleLost: number | null;
    soloTackle: number | null;
    assistedTackle: number | null;
    sack: number | null;
    interceptionDefense: number | null;
    forcedFumble: number | null;
    fumbleRecovery: number | null;
    passDefended: number | null;
    defensiveTd: number | null;
    tightEndReceptionBonus: number | null;
  };
  warnings: string[];
};

export type PlayerProfileScoringContext = {
  scoringProfile: PlayerProfileScoringProfile;
  metadata: PlayerProfileScoringMetadata;
};

export function rescoreHistoricalPlayerProfile(
  profile: HistoricalPlayerProfileSnapshot,
  scoringProfile: PlayerProfileScoringProfile
): HistoricalPlayerProfileSnapshot {
  const weeklyStats = profile.weeklyStats.map((row) => rescoreWeeklyRow(profile, row, scoringProfile));
  const pointValues = weeklyStats.map((row) => row.calculatedFantasyPoints);
  const consistencyMetrics = buildConsistencyMetrics(pointValues, profile.bio.normalizedPosition);
  const statSeasons = uniqueNumbers(weeklyStats.map((row) => row.season));
  const availabilityMetrics = buildAvailabilityMetrics(weeklyStats.length, Math.max(17, statSeasons.length * 17));
  const seasonSummaries = rebuildSeasonSummaries(weeklyStats, profile.seasonSummaries, profile.bio.normalizedPosition);
  const careerSummary = rebuildCareerSummary(weeklyStats, seasonSummaries, profile.bio.normalizedPosition);
  const trendMetrics = rebuildTrendMetrics(seasonSummaries);
  const careerMetadata = profile.careerMetadata
    ? {
        ...profile.careerMetadata,
        firstStatSeason: minNumber(statSeasons),
        latestStatSeason: maxNumber(statSeasons),
        seasonsWithStats: statSeasons,
        careerGamesWithStatRows: weeklyStats.length,
        activeSeasonsCount: new Set([...statSeasons, ...profile.careerMetadata.seasonsOnRoster]).size,
      }
    : undefined;

  return {
    ...profile,
    weeklyStats,
    seasonSummaries,
    careerMetadata,
    careerSummary,
    trendMetrics,
    consistencyMetrics,
    availabilityMetrics,
    recommendationSignals: buildRecommendationSignals({
      position: profile.bio.normalizedPosition,
      consistency: consistencyMetrics,
      availability: availabilityMetrics,
    }),
  };
}

export function buildPlayerProfileScoringMetadata(input: {
  scoringSource: PlayerProfileScoringSource;
  scoringProfile: PlayerProfileScoringProfile;
  warnings?: string[];
}): PlayerProfileScoringMetadata {
  const settings = input.scoringProfile.scoringSettings;
  return {
    scoringSource: input.scoringSource,
    scoringProfileName: input.scoringProfile.label,
    scoringSettingsSummary: {
      reception: setting(settings, "rec"),
      passingYard: setting(settings, "pass_yd"),
      passingTd: setting(settings, "pass_td"),
      interception: setting(settings, "pass_int"),
      rushingYard: setting(settings, "rush_yd"),
      rushingTd: setting(settings, "rush_td"),
      receivingYard: setting(settings, "rec_yd"),
      receivingTd: setting(settings, "rec_td"),
      fumbleLost: setting(settings, "fum_lost"),
      soloTackle: setting(settings, "solo_tkl"),
      assistedTackle: setting(settings, "ast_tkl"),
      sack: setting(settings, "sack"),
      interceptionDefense: setting(settings, "int"),
      forcedFumble: setting(settings, "ff"),
      fumbleRecovery: setting(settings, "fr"),
      passDefended: setting(settings, "pd"),
      defensiveTd: setting(settings, "def_td"),
      tightEndReceptionBonus: setting(settings, "rec_te_bonus") ?? setting(settings, "bonus_rec_te"),
    },
    warnings: [...(input.warnings ?? []), ...input.scoringProfile.notes],
  };
}

export function scoringProfileFromNormalizedSettings(input: {
  id: string;
  label: string;
  version: string;
  scoringSettings: NormalizedScoringSettings | Record<string, number>;
  notes?: string[];
}): PlayerProfileScoringProfile {
  return {
    id: input.id,
    label: input.label,
    version: input.version,
    scoringSettings: isNormalizedScoringSettings(input.scoringSettings)
      ? { ...input.scoringSettings.values }
      : { ...input.scoringSettings },
    notes: input.notes ?? [],
  };
}

function rescoreWeeklyRow(
  profile: HistoricalPlayerProfileSnapshot,
  row: PlayerProfileWeeklyStats,
  scoringProfile: PlayerProfileScoringProfile
): PlayerProfileWeeklyStats {
  const stats = combinedWeeklyStats(row);
  const result = scoreFantasyStats({
    stats,
    scoringSettings: scoringProfile.scoringSettings,
    positionGroup: normalizePositionGroup(profile.bio.normalizedPosition),
    statSource: "actual",
    context: {
      season: row.season ?? undefined,
      week: row.week,
      playerId: profile.identity.sleeperId ?? profile.identity.gsisId,
    },
  });

  return {
    ...row,
    calculatedFantasyPoints: round(result.totalPoints),
    scoringWarnings: result.warnings.map((warning) => warning.code),
  };
}

function rebuildSeasonSummaries(
  weeklyStats: PlayerProfileWeeklyStats[],
  existingSummaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  position: BlackbirdNflversePosition
) {
  const bySeason = new Map<number | null, PlayerProfileWeeklyStats[]>();
  for (const row of weeklyStats) {
    const season = row.season ?? null;
    bySeason.set(season, [...(bySeason.get(season) ?? []), row]);
  }

  return [...bySeason.entries()]
    .sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0))
    .map(([season, rows]) => {
      const existing = existingSummaries.find((summary) => (summary.season ?? null) === season);
      const totalFantasyPoints = round(rows.reduce((sum, row) => sum + row.calculatedFantasyPoints, 0));
      const consistency = buildConsistencyMetrics(rows.map((row) => row.calculatedFantasyPoints), position);
      const availability = buildAvailabilityMetrics(rows.length);
      return {
        season,
        gamesPlayed: rows.length,
        totalFantasyPoints,
        pointsPerGame: rows.length ? round(totalFantasyPoints / rows.length) : null,
        positionRank: existing?.positionRank ?? null,
        keyStatTotals: summarizeKeyStats(rows.map((row) => ({ canonicalStats: combinedWeeklyStats(row) }))),
        floor: consistency.floorPercentile20,
        median: consistency.median,
        ceiling: consistency.ceilingPercentile90,
        consistencyScore: consistency.consistencyScore,
        spikeScore: consistency.spikeWeekScore,
        availabilityScore: availability.availabilityScore,
      };
    });
}

function rebuildCareerSummary(
  weeklyStats: PlayerProfileWeeklyStats[],
  seasonSummaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  position: BlackbirdNflversePosition
): NonNullable<HistoricalPlayerProfileSnapshot["careerSummary"]> {
  const points = weeklyStats.map((row) => row.calculatedFantasyPoints);
  const consistency = buildConsistencyMetrics(points, position);
  const total = round(points.reduce((sum, value) => sum + value, 0));
  return {
    careerGames: weeklyStats.length,
    careerTotalPoints: total,
    careerPointsPerGame: weeklyStats.length ? round(total / weeklyStats.length) : null,
    careerFloor: consistency.floorPercentile20,
    careerMedian: consistency.median,
    careerCeiling: consistency.ceilingPercentile90,
    careerConsistencyScore: consistency.consistencyScore,
    careerSpikeScore: consistency.spikeWeekScore,
    careerAvailabilityScore: buildAvailabilityMetrics(weeklyStats.length, Math.max(17, seasonSummaries.length * 17)).availabilityScore,
    bestSeasonByTotalPoints: bestSeason(seasonSummaries, "total"),
    bestSeasonByPpg: bestSeason(seasonSummaries, "ppg"),
    mostRecentSeason: seasonSummaries[0] ?? null,
    last2Seasons: combineSeasonSummaries(seasonSummaries.slice(0, 2), position),
    last3Seasons: combineSeasonSummaries(seasonSummaries.slice(0, 3), position),
  };
}

function rebuildTrendMetrics(seasonSummaries: HistoricalPlayerProfileSnapshot["seasonSummaries"]): NonNullable<HistoricalPlayerProfileSnapshot["trendMetrics"]> {
  if (seasonSummaries.length < 2) {
    return { ppgTrend: null, availabilityTrend: null, consistencyTrend: null, spikeTrend: null, roleVolumeTrend: null, trendLabel: "insufficient_data" };
  }
  const latest = seasonSummaries[0];
  const previous = seasonSummaries[1];
  const ppgTrend = diffNullable(latest.pointsPerGame, previous.pointsPerGame);
  const availabilityTrend = diffNullable(latest.availabilityScore, previous.availabilityScore);
  const consistencyTrend = diffNullable(latest.consistencyScore, previous.consistencyScore);
  const spikeTrend = diffNullable(latest.spikeScore, previous.spikeScore);
  const roleVolumeTrend = diffNullable(volumeValue(latest), volumeValue(previous));
  const swings = [ppgTrend, availabilityTrend, consistencyTrend, spikeTrend].filter((value): value is number => value !== null);
  const trendLabel = swings.length < 2
    ? "insufficient_data"
    : swings.some((value) => Math.abs(value) >= 12) && swings.some((value) => value >= 8) && swings.some((value) => value <= -8)
      ? "volatile"
      : (ppgTrend ?? 0) >= 2 && (availabilityTrend ?? 0) >= -10
        ? "rising"
        : (ppgTrend ?? 0) <= -2 || (availabilityTrend ?? 0) <= -20
          ? "declining"
          : "stable";
  return { ppgTrend, availabilityTrend, consistencyTrend, spikeTrend, roleVolumeTrend, trendLabel };
}

function bestSeason(
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  kind: "total" | "ppg"
) {
  return [...summaries]
    .filter((summary) => kind === "total" || summary.pointsPerGame !== null)
    .sort((a, b) => kind === "total"
      ? b.totalFantasyPoints - a.totalFantasyPoints
      : (b.pointsPerGame ?? -Infinity) - (a.pointsPerGame ?? -Infinity))[0] ?? null;
}

function combineSeasonSummaries(
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  position: BlackbirdNflversePosition
) {
  if (!summaries.length) return null;
  const totalFantasyPoints = round(summaries.reduce((sum, summary) => sum + summary.totalFantasyPoints, 0));
  const gamesPlayed = summaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  const pseudoPoints = summaries.flatMap((summary) => Array.from({ length: summary.gamesPlayed }, () => summary.pointsPerGame ?? 0));
  const consistency = buildConsistencyMetrics(pseudoPoints, position);
  const availability = buildAvailabilityMetrics(gamesPlayed, Math.max(17, summaries.length * 17));
  const keyStatTotals: Record<string, number> = {};
  for (const summary of summaries) {
    for (const [key, value] of Object.entries(summary.keyStatTotals)) {
      keyStatTotals[key] = round((keyStatTotals[key] ?? 0) + value);
    }
  }
  return {
    season: summaries[0]?.season ?? null,
    gamesPlayed,
    totalFantasyPoints,
    pointsPerGame: gamesPlayed ? round(totalFantasyPoints / gamesPlayed) : null,
    positionRank: null,
    keyStatTotals,
    floor: consistency.floorPercentile20,
    median: consistency.median,
    ceiling: consistency.ceilingPercentile90,
    consistencyScore: consistency.consistencyScore,
    spikeScore: consistency.spikeWeekScore,
    availabilityScore: availability.availabilityScore,
  };
}

function combinedWeeklyStats(row: PlayerProfileWeeklyStats): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const group of [row.passing, row.rushing, row.receiving, row.kicking, row.defensive]) {
    for (const [key, value] of Object.entries(group)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        stats[key] = value;
      }
    }
  }
  return stats;
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)))).sort((a, b) => a - b);
}

function minNumber(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

function maxNumber(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

function diffNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  return typeof a === "number" && typeof b === "number" ? round(a - b) : null;
}

function volumeValue(summary: HistoricalPlayerProfileSnapshot["seasonSummaries"][number]): number | null {
  const keys = ["rush_att", "rec", "targets", "solo_tkl", "ast_tkl", "sack", "pass_att"];
  const values = keys.map((key) => summary.keyStatTotals[key]).filter((value): value is number => typeof value === "number");
  return values.length ? round(values.reduce((sum, value) => sum + value, 0)) : null;
}

function setting(settings: Record<string, number>, key: string): number | null {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function isNormalizedScoringSettings(
  value: NormalizedScoringSettings | Record<string, number>
): value is NormalizedScoringSettings {
  return "values" in value;
}
