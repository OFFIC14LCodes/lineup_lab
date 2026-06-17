import {
  hasPositiveStat,
  isFantasyRelevantNflversePosition,
  normalizeNflversePlayer,
  normalizeNflverseRoster,
  normalizeNflverseWeeklyStat,
  readNflverseCsv,
  type BlackbirdNflversePosition,
  type NflverseCsvReadResult,
  type NflversePlayerRecord,
  type NflverseRosterRecord,
  type NflverseWeeklyStatRecord,
} from "@/lib/data-acquisition/nflverse";
import { loadIdentityManualOverrides, makeIdentityRecord, matchPlayerIdentities, type PlayerIdentityRecord } from "@/lib/data-acquisition/player-identity";
import { isSleeperFantasyRelevant, loadSleeperPlayers, normalizeSleeperPlayers, type SleeperNormalizedPlayer } from "@/lib/data-acquisition/sleeper";

import { buildAvailabilityMetrics, buildConsistencyMetrics, buildRecommendationSignals, summarizeKeyStats } from "./player-profile-metrics";
import { buildPlayerProfileHighValueUsageProfile, loadPlayerProfilePbpUsageSources, markPbpUsageSourceMatches, type PlayerProfilePbpSourceDiagnostics } from "./player-profile-pbp-usage";
import { DEFAULT_PLAYER_PROFILE_SCORING, scoreProfileWeeklyStat } from "./player-profile-scoring";
import { loadPlayerProfileSnapSources, markSnapSourceMatches, type PlayerProfileSnapSourceDiagnostics } from "./player-profile-snap-sources";
import { buildPlayerProfileUsageProfile, detectPlayerProfileUsageSources, type PlayerProfileUsageSourceDiagnostics } from "./player-profile-usage";
import type {
  HistoricalPlayerProfileSnapshot,
  PlayerProfileCareerMetadata,
  PlayerProfileCareerSummary,
  PlayerProfileCoverageLabel,
  PlayerProfileScoringProfile,
  PlayerProfileSeasonSummary,
  PlayerProfilesBuildResult,
  PlayerProfileTrendMetrics,
  PlayerProfileWarning,
  PlayerProfileWeeklyStats,
} from "./player-profile-types";

type ScoredWeekly = {
  source: NflverseWeeklyStatRecord;
  canonicalStats: Record<string, number>;
  calculatedFantasyPoints: number;
  scoringWarnings: string[];
};

export function buildHistoricalPlayerProfiles(input: { projectRoot?: string; scoringProfile?: PlayerProfileScoringProfile } = {}): PlayerProfilesBuildResult {
  const projectRoot = input.projectRoot ?? process.cwd();
  const scoringProfile = input.scoringProfile ?? DEFAULT_PLAYER_PROFILE_SCORING;
  const generatedAt = new Date().toISOString();

  const sleeperPlayers = loadSleeperIdentityRecords();
  const nflverseIdentity = loadNflverseIdentityRecords();
  const manualOverrides = loadIdentityManualOverrides(projectRoot);
  const matches = matchPlayerIdentities(sleeperPlayers.records, nflverseIdentity.records, { manualOverrides: manualOverrides.approved });
  const weeklySource = readNflverseCsv("playerStats");
  const rosterSource = nflverseIdentity.rosterSource;
  const usageSources = detectPlayerProfileUsageSources();
  const snapSources = loadPlayerProfileSnapSources(projectRoot);
  const pbpSources = loadPlayerProfilePbpUsageSources(projectRoot);
  const pbpSourceAvailable = pbpSources.diagnostics.exists && pbpSources.diagnostics.missingColumns.length === 0;
  const weeklyStats = weeklySource.rows.map(normalizeNflverseWeeklyStat).filter((row) => isFantasyRelevantNflversePosition(row.position));
  const weeklyByGsis = groupBy(weeklyStats, (row) => row.playerId);
  const rostersByGsis = groupBy(nflverseIdentity.rosters, (row) => row.playerId);
  const rosterByGsis = new Map(Array.from(rostersByGsis.entries()).map(([gsisId, rows]) => [gsisId, latestRoster(rows)]));
  const playerByGsis = new Map(nflverseIdentity.players.map((row) => [row.playerId, row]));
  const profiles: HistoricalPlayerProfileSnapshot[] = [];
  const matchedGsisIds = new Set<string>();
  const matchedPfrIds = new Set<string>();
  let missingGsisId = 0;

  for (const match of matches) {
    if (!match.matchedPlayer) continue;
    const gsisId = match.preservedIds.gsisId ?? match.matchedPlayer.ids.gsisId ?? match.matchedPlayer.playerId;
    if (!gsisId) {
      missingGsisId += 1;
      continue;
    }
    const sourcePosition = match.sourcePlayer.position;
    const position = match.matchedPlayer.position ?? sourcePosition;
    if (!position || !isFantasyRelevantNflversePosition(position)) continue;

    const player = playerByGsis.get(gsisId);
    const roster = rosterByGsis.get(gsisId);
    const pfrId = match.preservedIds.pfrId ?? match.matchedPlayer.ids.pfrId ?? player?.ids.pfrId ?? null;
    matchedGsisIds.add(gsisId);
    if (pfrId) matchedPfrIds.add(pfrId);
    const rosterSeasons = uniqueNumbers((rostersByGsis.get(gsisId) ?? []).map((row) => row.season));
    const scoredWeekly = (weeklyByGsis.get(gsisId) ?? [])
      .map((row) => scoreWeekly(row, scoringProfile))
      .sort(sortScoredWeeklyDesc);
    const points = scoredWeekly.map((row) => row.calculatedFantasyPoints);
    const consistency = buildConsistencyMetrics(points, position);
    const statSeasons = uniqueNumbers(scoredWeekly.map((row) => row.source.season));
    const availability = buildAvailabilityMetrics(scoredWeekly.length, Math.max(17, statSeasons.length * 17));
    const warnings = warningsFor(match.confidence, scoredWeekly, scoredWeekly.flatMap((row) => row.scoringWarnings), position);
    const seasonSummaries = buildSeasonSummaries(scoredWeekly, position);
    const rookieSeason = match.sourcePlayer.rookieSeason ?? player?.rookieSeason ?? roster?.rookieYear ?? inferRookieSeason(match.sourcePlayer.yearsExperience ?? player?.yearsExperience ?? roster?.yearsExperience, weeklySource);
    const careerMetadata = buildCareerMetadata({
      rookieSeason,
      statSeasons,
      rosterSeasons,
      weeklyStats: scoredWeekly,
      sourceMinSeason: minNumber(sourceSeasons(weeklySource)),
    });
    const careerSummary = buildCareerSummary({
      weeklyStats: scoredWeekly.map(toProfileWeeklyStats),
      seasonSummaries,
      position,
    });
    const trendMetrics = buildTrendMetrics(seasonSummaries);
    const weeklyProfileStats = scoredWeekly.map(toProfileWeeklyStats);
    const usageProfile = buildPlayerProfileUsageProfile({
      position,
      weeklyStats: weeklyProfileStats,
      snapCounts: pfrId ? snapSources.snapCountsByPfrId.get(pfrId) ?? [] : [],
      participation: snapSources.participationByGsisId.get(gsisId) ?? [],
      matchConfidence: match.confidence,
      sources: usageSources,
    });
    const highValueUsageProfile = buildPlayerProfileHighValueUsageProfile({
      position,
      weeklyHighValueUsage: pbpSources.weeklyByGsisId.get(gsisId) ?? [],
      sourceAvailable: pbpSourceAvailable,
    });
    const highValueProfileFields = pbpSourceAvailable
      ? {
          highValueUsageSummary: highValueUsageProfile.highValueUsageSummary,
          seasonHighValueUsageSummaries: highValueUsageProfile.seasonHighValueUsageSummaries,
          weeklyHighValueUsage: highValueUsageProfile.weeklyHighValueUsage,
          highValueRoleWarnings: highValueUsageProfile.highValueRoleWarnings,
        }
      : {};

    profiles.push({
      identity: {
        blackbirdPlayerId: match.preservedIds.blackbirdPlayerId,
        sleeperId: match.preservedIds.sleeperId,
        gsisId,
        espnId: match.preservedIds.espnId,
        pfrId: match.preservedIds.pfrId,
        nflId: match.preservedIds.nflId,
        smartId: match.preservedIds.smartId,
        matchConfidence: match.confidence,
        matchReasons: match.matchReasons,
        preservedIds: match.preservedIds,
      },
      bio: {
        name: match.sourcePlayer.playerName,
        position,
        normalizedPosition: position,
        team: match.sourcePlayer.team ?? roster?.team ?? player?.team ?? null,
        status: match.sourcePlayer.status ?? roster?.status ?? null,
        active: match.sourcePlayer.active,
        age: match.sourcePlayer.age,
        birthDate: match.sourcePlayer.birthDate ?? player?.birthDate ?? null,
        height: match.sourcePlayer.height ?? player?.height ?? null,
        weight: match.sourcePlayer.weight ?? player?.weight ?? null,
        college: match.sourcePlayer.college ?? player?.college ?? null,
        rookieSeason,
        yearsExperience: match.sourcePlayer.yearsExperience ?? player?.yearsExperience ?? roster?.yearsExperience ?? null,
      },
      weeklyStats: weeklyProfileStats,
      seasonSummaries,
      careerMetadata,
      careerSummary,
      trendMetrics,
      usageSummary: usageProfile.usageSummary,
      seasonUsageSummaries: usageProfile.seasonUsageSummaries,
      weeklyUsage: usageProfile.weeklyUsage,
      ...highValueProfileFields,
      roleMetrics: usageProfile.roleMetrics,
      roleWarnings: usageProfile.roleWarnings,
      consistencyMetrics: consistency,
      availabilityMetrics: availability,
      recommendationSignals: buildRecommendationSignals({ position, consistency, availability }),
      profileWarnings: warnings,
    });
  }

  assignPositionRanks(profiles);
  const snapSourceDiagnostics = markSnapSourceMatches(snapSources, { matchedGsisIds, matchedPfrIds });
  const pbpSourceDiagnostics = markPbpUsageSourceMatches(pbpSources, { matchedGsisIds });

  const diagnostics = buildDiagnostics({
    generatedAt,
    profiles,
    scoringProfile,
    weeklySource,
    rosterSource,
    usageSources,
    snapSourceDiagnostics,
    pbpSourceDiagnostics,
    unmatched: matches.filter((match) => match.confidence === "unmatched").length,
    conflict: matches.filter((match) => match.confidence === "conflict").length,
    missingGsisId,
  });

  return { generatedAt, dryRun: true, scoringProfile, profiles, diagnostics };
}

function loadSleeperIdentityRecords() {
  const sleeperLoad = loadSleeperPlayers();
  const sleeperPlayers = sleeperLoad.exists ? normalizeSleeperPlayers(sleeperLoad.players).filter(isSleeperFantasyRelevant) : [];
  return {
    records: sleeperPlayers.map(sleeperIdentityRecord).filter((record): record is PlayerIdentityRecord => Boolean(record)),
    sleeperPlayers,
  };
}

function loadNflverseIdentityRecords() {
  const players = readNflverseCsv("players").rows.map(normalizeNflversePlayer).filter((row) => isFantasyRelevantNflversePosition(row.position));
  const rosterSource = readNflverseCsv("rosters");
  const rosters = rosterSource.rows.map(normalizeNflverseRoster).filter((row) => isFantasyRelevantNflversePosition(row.position));
  const records = new Map<string, PlayerIdentityRecord>();
  for (const player of players) addIdentityRecord(records, nflversePlayerIdentityRecord(player));
  for (const roster of rosters) addIdentityRecord(records, nflverseRosterIdentityRecord(roster));
  return { records: Array.from(records.values()), players, rosters, rosterSource };
}

function sleeperIdentityRecord(player: SleeperNormalizedPlayer) {
  return makeIdentityRecord({
    source: "sleeper_export",
    playerId: player.sleeperId,
    playerName: player.playerName,
    position: player.position,
    team: player.team,
    birthDate: player.birthDate,
    height: player.height,
    weight: player.weight,
    age: player.age,
    yearsExperience: player.yearsExperience,
    college: player.college,
    active: player.active,
    status: player.status,
    searchRank: player.searchRank,
    ids: {
      sleeperId: player.sleeperId,
      gsisId: player.externalIds.gsis_id ?? null,
      espnId: player.externalIds.espn_id ?? null,
      pfrId: player.externalIds.pfr_id ?? null,
      nflId: player.externalIds.nfl_id ?? null,
      smartId: player.externalIds.smart_id ?? null,
    },
    externalIds: player.externalIds,
    sourceRefs: ["data/sleeper/raw/players-nfl.json"],
  });
}

function nflversePlayerIdentityRecord(player: NflversePlayerRecord) {
  return makeIdentityRecord({
    source: "nflverse_players",
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    team: player.team,
    rookieSeason: player.rookieSeason,
    birthDate: player.birthDate,
    height: player.height,
    weight: player.weight,
    yearsExperience: player.yearsExperience,
    college: player.college,
    ids: player.ids,
    sourceRefs: ["data/nflverse/players.csv"],
  });
}

function nflverseRosterIdentityRecord(roster: NflverseRosterRecord) {
  return makeIdentityRecord({
    source: "nflverse_rosters",
    playerId: roster.playerId,
    playerName: roster.playerName,
    position: roster.position,
    team: roster.team,
    rookieSeason: roster.rookieYear,
    yearsExperience: roster.yearsExperience,
    status: roster.status,
    ids: roster.ids,
    sourceRefs: ["data/nflverse/rosters_2025.csv"],
  });
}

function addIdentityRecord(records: Map<string, PlayerIdentityRecord>, record: PlayerIdentityRecord | null) {
  if (!record) return;
  records.set(record.ids.gsisId ?? record.playerId, record);
}

function scoreWeekly(row: NflverseWeeklyStatRecord, scoringProfile: PlayerProfileScoringProfile): ScoredWeekly {
  const scored = scoreProfileWeeklyStat(row, scoringProfile);
  return {
    source: row,
    canonicalStats: scored.stats,
    calculatedFantasyPoints: round(scored.result.totalPoints),
    scoringWarnings: scored.result.coverage.unsupportedScoringKeys.map((key) => `unsupported scoring key: ${key}`),
  };
}

function toProfileWeeklyStats(row: ScoredWeekly): PlayerProfileWeeklyStats {
  return {
    season: row.source.season,
    week: row.source.week,
    team: row.source.team,
    opponent: row.source.opponentTeam,
    passing: pick(row.canonicalStats, ["pass_cmp", "pass_att", "pass_yd", "pass_td", "pass_int", "pass_sack"]),
    rushing: pick(row.canonicalStats, ["rush_att", "rush_yd", "rush_td"]),
    receiving: pick(row.canonicalStats, ["rec", "targets", "rec_yd", "rec_td"]),
    kicking: pick(row.canonicalStats, ["fgm", "fga", "fgmiss", "xpm", "xpa", "xpmiss"]),
    defensive: pick(row.canonicalStats, ["solo_tkl", "ast_tkl", "tkl", "tkl_loss", "ff", "sack", "qb_hit", "int", "int_ret_yd", "pd", "def_td", "safe"]),
    calculatedFantasyPoints: row.calculatedFantasyPoints,
    scoringWarnings: row.scoringWarnings,
  };
}

function buildSeasonSummaries(scoredWeekly: ScoredWeekly[], position: BlackbirdNflversePosition): PlayerProfileSeasonSummary[] {
  const bySeason = groupBy(scoredWeekly, (row) => String(row.source.season ?? "unknown"));
  return Array.from(bySeason.entries())
    .map(([seasonKey, rows]) => {
      const season = seasonKey === "unknown" ? null : Number(seasonKey);
      const totalFantasyPoints = round(rows.reduce((sum, row) => sum + row.calculatedFantasyPoints, 0));
      const pointValues = rows.map((row) => row.calculatedFantasyPoints);
      const consistency = buildConsistencyMetrics(pointValues, position);
      const availability = buildAvailabilityMetrics(rows.length);
      return {
        season,
        gamesPlayed: rows.length,
        totalFantasyPoints,
        pointsPerGame: rows.length ? round(totalFantasyPoints / rows.length) : null,
        positionRank: null,
        keyStatTotals: summarizeKeyStats(rows),
        floor: consistency.floorPercentile20,
        median: consistency.median,
        ceiling: consistency.ceilingPercentile90,
        consistencyScore: consistency.consistencyScore,
        spikeScore: consistency.spikeWeekScore,
        availabilityScore: availability.availabilityScore,
      };
    })
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
}

function buildCareerMetadata(input: {
  rookieSeason: number | null;
  statSeasons: number[];
  rosterSeasons: number[];
  weeklyStats: ScoredWeekly[];
  sourceMinSeason: number | null;
}): PlayerProfileCareerMetadata {
  const firstStatSeason = minNumber(input.statSeasons);
  const latestStatSeason = maxNumber(input.statSeasons);
  const coverageLabel = coverageLabelFor({
    rookieSeason: input.rookieSeason,
    firstStatSeason,
    statSeasons: input.statSeasons,
    sourceMinSeason: input.sourceMinSeason,
  });
  return {
    rookieSeason: input.rookieSeason,
    firstStatSeason,
    latestStatSeason,
    seasonsWithStats: input.statSeasons,
    seasonsOnRoster: input.rosterSeasons,
    careerGamesWithStatRows: input.weeklyStats.length,
    activeSeasonsCount: new Set([...input.statSeasons, ...input.rosterSeasons]).size,
    coverageLabel,
    coverageNote: coverageLabel === "partial_career" || coverageLabel === "recent_only"
      ? `Profile coverage begins in ${firstStatSeason ?? input.sourceMinSeason ?? "the available export"} based on available local nflverse export.`
      : null,
  };
}

function coverageLabelFor(input: {
  rookieSeason: number | null;
  firstStatSeason: number | null;
  statSeasons: number[];
  sourceMinSeason: number | null;
}): PlayerProfileCoverageLabel {
  if (!input.statSeasons.length) return "no_weekly_stats";
  if (input.statSeasons.length === 1) return "single_season";
  if (input.rookieSeason && input.firstStatSeason && input.firstStatSeason <= input.rookieSeason) return "career_from_rookie";
  if (input.sourceMinSeason && input.firstStatSeason === input.sourceMinSeason) return "partial_career";
  return "recent_only";
}

function buildCareerSummary(input: {
  weeklyStats: PlayerProfileWeeklyStats[];
  seasonSummaries: PlayerProfileSeasonSummary[];
  position: BlackbirdNflversePosition;
}): PlayerProfileCareerSummary {
  const points = input.weeklyStats.map((row) => row.calculatedFantasyPoints);
  const consistency = buildConsistencyMetrics(points, input.position);
  const total = round(points.reduce((sum, value) => sum + value, 0));
  const recent = input.seasonSummaries[0] ?? null;
  return {
    careerGames: input.weeklyStats.length,
    careerTotalPoints: total,
    careerPointsPerGame: input.weeklyStats.length ? round(total / input.weeklyStats.length) : null,
    careerFloor: consistency.floorPercentile20,
    careerMedian: consistency.median,
    careerCeiling: consistency.ceilingPercentile90,
    careerConsistencyScore: consistency.consistencyScore,
    careerSpikeScore: consistency.spikeWeekScore,
    careerAvailabilityScore: buildAvailabilityMetrics(input.weeklyStats.length, Math.max(17, input.seasonSummaries.length * 17)).availabilityScore,
    bestSeasonByTotalPoints: bestSeason(input.seasonSummaries, "total"),
    bestSeasonByPpg: bestSeason(input.seasonSummaries, "ppg"),
    mostRecentSeason: recent,
    last2Seasons: combineSeasonSummaries(input.seasonSummaries.slice(0, 2), input.position),
    last3Seasons: combineSeasonSummaries(input.seasonSummaries.slice(0, 3), input.position),
  };
}

function buildTrendMetrics(seasonSummaries: PlayerProfileSeasonSummary[]): PlayerProfileTrendMetrics {
  if (seasonSummaries.length < 2) {
    return { ppgTrend: null, availabilityTrend: null, consistencyTrend: null, spikeTrend: null, roleVolumeTrend: null, trendLabel: "insufficient_data" };
  }
  const latest = seasonSummaries[0];
  const previous = seasonSummaries[1];
  const ppgTrend = diffNullable(latest.pointsPerGame, previous.pointsPerGame);
  const availabilityTrend = diffNullable(latest.availabilityScore ?? null, previous.availabilityScore ?? null);
  const consistencyTrend = diffNullable(latest.consistencyScore ?? null, previous.consistencyScore ?? null);
  const spikeTrend = diffNullable(latest.spikeScore ?? null, previous.spikeScore ?? null);
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

function warningsFor(confidence: string, weekly: ScoredWeekly[], scoringWarnings: string[], position: string): PlayerProfileWarning[] {
  const warnings = new Set<PlayerProfileWarning>();
  if (confidence === "weak") warnings.add("weak_identity_match");
  if (!weekly.length) warnings.add("no_weekly_stats");
  if (weekly.length > 0 && weekly.length < 6) warnings.add("low_sample_size");
  if (scoringWarnings.length) warnings.add("unsupported_missing_stat_columns");
  if (["DL", "LB", "DB"].includes(position) && !weekly.some((row) => hasPositiveStat(row.source.defensiveStats))) warnings.add("unsupported_missing_stat_columns");
  return Array.from(warnings);
}

function assignPositionRanks(profiles: HistoricalPlayerProfileSnapshot[]) {
  for (const position of new Set(profiles.map((profile) => profile.bio.position))) {
    const seasons = new Set(profiles.flatMap((profile) => profile.bio.position === position ? profile.seasonSummaries.map((summary) => summary.season) : []));
    for (const season of seasons) {
      profiles
        .filter((profile) => profile.bio.position === position)
        .map((profile) => ({ profile, summary: profile.seasonSummaries.find((summary) => summary.season === season) }))
        .filter((row): row is { profile: HistoricalPlayerProfileSnapshot; summary: PlayerProfileSeasonSummary } => Boolean(row.summary))
        .sort((a, b) => b.summary.totalFantasyPoints - a.summary.totalFantasyPoints)
        .forEach((row, index) => {
          row.summary.positionRank = index + 1;
        });
    }
  }
}

function buildDiagnostics(input: {
  generatedAt: string;
  profiles: HistoricalPlayerProfileSnapshot[];
  scoringProfile: PlayerProfileScoringProfile;
  weeklySource: NflverseCsvReadResult;
  rosterSource: NflverseCsvReadResult;
  usageSources: PlayerProfileUsageSourceDiagnostics;
  snapSourceDiagnostics: PlayerProfileSnapSourceDiagnostics;
  pbpSourceDiagnostics: PlayerProfilePbpSourceDiagnostics;
  unmatched: number;
  conflict: number;
  missingGsisId: number;
}) {
  const withWeekly = input.profiles.filter((profile) => profile.weeklyStats.length > 0);
  const withUsage = input.profiles.filter((profile) => (profile.usageSummary?.gamesWithUsage ?? 0) > 0);
  const offensiveUsage = input.profiles.filter((profile) => ["QB", "RB", "WR", "TE"].includes(profile.bio.position) && (profile.usageSummary?.gamesWithUsage ?? 0) > 0);
  const idpUsage = input.profiles.filter((profile) => ["DL", "LB", "DB"].includes(profile.bio.position) && (profile.usageSummary?.gamesWithUsage ?? 0) > 0);
  const highValueUsage = input.profiles.filter((profile) => (profile.highValueUsageSummary?.gamesWithHighValueUsage ?? 0) > 0);
  const seasonsIncluded = uniqueNumbers(input.profiles.flatMap((profile) => profile.careerMetadata?.seasonsWithStats ?? []));
  const coverageLabels = input.profiles.map((profile) => profile.careerMetadata?.coverageLabel ?? "no_weekly_stats");
  return {
    generatedAt: input.generatedAt,
    dryRun: true as const,
    totalProfilesBuilt: input.profiles.length,
    profilesByPosition: countBy(input.profiles.map((profile) => profile.bio.position)),
    profilesByMatchConfidence: countBy(input.profiles.map((profile) => profile.identity.matchConfidence)),
    profilesWithWeeklyStats: withWeekly.length,
    profilesWithoutWeeklyStats: input.profiles.length - withWeekly.length,
    profilesWithMultiSeasonData: input.profiles.filter((profile) => (profile.careerMetadata?.seasonsWithStats.length ?? 0) > 1).length,
    profilesWithOnlyOneSeason: input.profiles.filter((profile) => (profile.careerMetadata?.seasonsWithStats.length ?? 0) === 1).length,
    profilesWithFullRookieToCurrentCoverage: input.profiles.filter((profile) => profile.careerMetadata?.coverageLabel === "career_from_rookie").length,
    profilesWithPartialCoverage: input.profiles.filter((profile) => profile.careerMetadata?.coverageLabel === "partial_career" || profile.careerMetadata?.coverageLabel === "recent_only").length,
    profilesByCoverageLabel: countBy(coverageLabels),
    seasonsIncluded,
    sourceFilesUsed: {
      playerStats: input.weeklySource.filePath,
      rosters: input.rosterSource.filePath,
    },
    sourceRows: {
      weeklyStats: input.weeklySource.rows.length,
      rosters: input.rosterSource.rows.length,
    },
    minSeason: minNumber(seasonsIncluded),
    maxSeason: maxNumber(seasonsIncluded),
    artifactSizeBytes: null,
    profilesWithIdpStats: input.profiles.filter((profile) => profile.weeklyStats.some((row) => Object.values(row.defensive).some((value) => typeof value === "number" && value > 0))).length,
    profilesWithWarnings: input.profiles.filter((profile) => profile.profileWarnings.length > 0).length,
    profilesWithUsageSummary: withUsage.length,
    profilesWithOffensiveUsage: offensiveUsage.length,
    profilesWithIdpUsage: idpUsage.length,
    profilesWithSnapData: input.profiles.filter((profile) => (profile.usageSummary?.gamesWithSnapData ?? 0) > 0).length,
    profilesMissingSnapData: input.profiles.filter((profile) => (profile.usageSummary?.gamesWithSnapData ?? 0) === 0).length,
    profilesWithHighValueUsage: highValueUsage.length,
    profilesWithRedZoneUsage: input.profiles.filter((profile) =>
      (profile.highValueUsageSummary?.redZoneCarriesPerGame ?? 0) > 0 || (profile.highValueUsageSummary?.redZoneTargetsPerGame ?? 0) > 0
    ).length,
    profilesWithEndZoneTargets: input.profiles.filter((profile) => (profile.highValueUsageSummary?.endZoneTargetsPerGame ?? 0) > 0).length,
    profilesWithGoalLineCarries: input.profiles.filter((profile) => (profile.highValueUsageSummary?.goalLineCarriesPerGame ?? 0) > 0).length,
    profilesWithDeepTargets: input.profiles.filter((profile) => (profile.highValueUsageSummary?.deepTargetsPerGame ?? 0) > 0).length,
    profilesWithRoleLabel: input.profiles.filter((profile) => profile.roleMetrics && profile.roleMetrics.roleLabel !== "insufficient_data").length,
    roleLabelsByPosition: roleLabelsByPosition(input.profiles),
    usageSourceFiles: {
      used: input.usageSources.used,
      missing: input.usageSources.missing,
      snapCounts: {
        exists: input.snapSourceDiagnostics.snapCounts.exists,
        rowCount: input.snapSourceDiagnostics.snapCounts.rowCount,
        seasons: input.snapSourceDiagnostics.snapCounts.seasons,
        requiredColumns: input.snapSourceDiagnostics.snapCounts.requiredColumns,
        missingColumns: input.snapSourceDiagnostics.snapCounts.missingColumns,
        playersWithPfrId: input.snapSourceDiagnostics.snapCounts.playersWithPfrId,
        matchedRows: input.snapSourceDiagnostics.snapCounts.matchedRows,
        unmatchedRows: input.snapSourceDiagnostics.snapCounts.unmatchedRows,
      },
      participation: {
        exists: input.snapSourceDiagnostics.participation.exists,
        rowCount: input.snapSourceDiagnostics.participation.rowCount,
        seasons: input.snapSourceDiagnostics.participation.seasons,
        requiredColumns: input.snapSourceDiagnostics.participation.requiredColumns,
        missingColumns: input.snapSourceDiagnostics.participation.missingColumns,
        playersWithGsisId: input.snapSourceDiagnostics.participation.playersWithGsisId,
        matchedRows: input.snapSourceDiagnostics.participation.matchedRows,
        unmatchedRows: input.snapSourceDiagnostics.participation.unmatchedRows,
      },
      pbp: {
        exists: input.pbpSourceDiagnostics.exists,
        selectedFile: input.pbpSourceDiagnostics.selectedFile,
        candidateFiles: input.pbpSourceDiagnostics.candidateFiles,
        rowCount: input.pbpSourceDiagnostics.rowCount,
        seasons: input.pbpSourceDiagnostics.seasons,
        requiredColumns: input.pbpSourceDiagnostics.requiredColumns,
        missingColumns: input.pbpSourceDiagnostics.missingColumns,
        derivedPlayerWeekRows: input.pbpSourceDiagnostics.derivedPlayerWeekRows,
        playersWithGsisId: input.pbpSourceDiagnostics.playersWithGsisId,
        matchedRows: input.pbpSourceDiagnostics.matchedRows,
        unmatchedRows: input.pbpSourceDiagnostics.unmatchedRows,
      },
    },
    skippedMatches: {
      unmatched: input.unmatched,
      conflict: input.conflict,
      missingGsisId: input.missingGsisId,
    },
    sampleTopProfilesByPosition: sampleTopByPosition(input.profiles),
    scoringProfileUsed: input.scoringProfile,
    limitations: [
      "Dry-run only. No Supabase writes are performed.",
      "Scoring uses a clearly labeled default profile, not league-specific settings.",
      "Position rank is calculated only within the built historical profile snapshot.",
      "Expected missed weeks use a simple 17-week estimate and do not yet account for byes, injuries, or playoff weeks.",
      "Multi-season coverage begins at the earliest available local nflverse export, not necessarily every player's true NFL debut.",
      "Profiles are not yet consumed by projections, Blackbird Rank, or War Room recommendations.",
      input.usageSources.hasSnapData
        ? "Usage profiles include snap count data where PFR identity matches are available."
        : "Usage profiles are derived from weekly stat volume only; snap context is not available yet.",
      input.usageSources.hasParticipationData
        ? "Participation profiles include aggregated play participation counts by GSIS ID."
        : "Participation context is not available yet.",
      input.usageSources.hasPlayByPlayData
        ? "High-value usage profiles include compact play-by-play-derived role metrics where GSIS identity matches are available."
        : "Play-by-play high-value usage context is not available yet; high-value role fields are omitted from profiles until the source is available.",
    ],
  };
}

function roleLabelsByPosition(profiles: HistoricalPlayerProfileSnapshot[]): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const profile of profiles) {
    const position = profile.bio.position;
    const label = profile.roleMetrics?.roleLabel ?? "insufficient_data";
    result[position] = result[position] ?? {};
    result[position][label] = (result[position][label] ?? 0) + 1;
  }
  return result;
}

function sampleTopByPosition(profiles: HistoricalPlayerProfileSnapshot[]) {
  const result: Record<string, Array<{ playerName: string; gsisId: string; totalFantasyPoints: number; gamesPlayed: number }>> = {};
  for (const position of new Set(profiles.map((profile) => profile.bio.position))) {
    result[position] = profiles
      .filter((profile) => profile.bio.position === position)
      .sort((a, b) => (b.careerSummary?.careerTotalPoints ?? b.seasonSummaries[0]?.totalFantasyPoints ?? 0) - (a.careerSummary?.careerTotalPoints ?? a.seasonSummaries[0]?.totalFantasyPoints ?? 0))
      .slice(0, 5)
      .map((profile) => ({
        playerName: profile.bio.name,
        gsisId: profile.identity.gsisId,
        totalFantasyPoints: profile.careerSummary?.careerTotalPoints ?? profile.seasonSummaries[0]?.totalFantasyPoints ?? 0,
        gamesPlayed: profile.careerSummary?.careerGames ?? profile.seasonSummaries[0]?.gamesPlayed ?? 0,
      }));
  }
  return result;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) result.set(keyFn(item), [...(result.get(keyFn(item)) ?? []), item]);
  return result;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function pick(stats: Record<string, number>, keys: string[]): Record<string, number | null> {
  return Object.fromEntries(keys.map((key) => [key, stats[key] ?? null]));
}

function latestRoster(rows: NflverseRosterRecord[]): NflverseRosterRecord | undefined {
  return [...rows].sort((a, b) => (b.season ?? 0) - (a.season ?? 0) || (b.week ?? 0) - (a.week ?? 0))[0];
}

function sortScoredWeeklyDesc(a: ScoredWeekly, b: ScoredWeekly) {
  return (b.source.season ?? 0) - (a.source.season ?? 0) || (b.source.week ?? 0) - (a.source.week ?? 0);
}

function sourceSeasons(source: NflverseCsvReadResult): number[] {
  return uniqueNumbers(source.rows.map((row) => Number(row.season)).filter((value) => Number.isFinite(value)));
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

function inferRookieSeason(yearsExperience: number | null | undefined, weeklySource: NflverseCsvReadResult): number | null {
  const maxSeason = maxNumber(sourceSeasons(weeklySource));
  if (!maxSeason || typeof yearsExperience !== "number" || !Number.isFinite(yearsExperience)) return null;
  return maxSeason - Math.max(0, yearsExperience);
}

function bestSeason(summaries: PlayerProfileSeasonSummary[], kind: "total" | "ppg"): PlayerProfileSeasonSummary | null {
  return [...summaries]
    .filter((summary) => kind === "total" || summary.pointsPerGame !== null)
    .sort((a, b) => kind === "total"
      ? b.totalFantasyPoints - a.totalFantasyPoints
      : (b.pointsPerGame ?? -Infinity) - (a.pointsPerGame ?? -Infinity))[0] ?? null;
}

function combineSeasonSummaries(summaries: PlayerProfileSeasonSummary[], position: BlackbirdNflversePosition): PlayerProfileSeasonSummary | null {
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

function diffNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  return typeof a === "number" && typeof b === "number" ? round(a - b) : null;
}

function volumeValue(summary: PlayerProfileSeasonSummary): number | null {
  const keys = ["rush_att", "rec", "targets", "solo_tkl", "ast_tkl", "sack", "pass_att"];
  const values = keys.map((key) => summary.keyStatTotals[key]).filter((value): value is number => typeof value === "number");
  return values.length ? round(values.reduce((sum, value) => sum + value, 0)) : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
