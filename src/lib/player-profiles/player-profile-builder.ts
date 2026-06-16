import {
  hasPositiveStat,
  isFantasyRelevantNflversePosition,
  normalizeNflversePlayer,
  normalizeNflverseRoster,
  normalizeNflverseWeeklyStat,
  readNflverseCsv,
  type NflversePlayerRecord,
  type NflverseRosterRecord,
  type NflverseWeeklyStatRecord,
} from "@/lib/data-acquisition/nflverse";
import { loadIdentityManualOverrides, makeIdentityRecord, matchPlayerIdentities, type PlayerIdentityRecord } from "@/lib/data-acquisition/player-identity";
import { isSleeperFantasyRelevant, loadSleeperPlayers, normalizeSleeperPlayers, type SleeperNormalizedPlayer } from "@/lib/data-acquisition/sleeper";

import { buildAvailabilityMetrics, buildConsistencyMetrics, buildRecommendationSignals, summarizeKeyStats } from "./player-profile-metrics";
import { DEFAULT_PLAYER_PROFILE_SCORING, scoreProfileWeeklyStat } from "./player-profile-scoring";
import type { HistoricalPlayerProfileSnapshot, PlayerProfileScoringProfile, PlayerProfilesBuildResult, PlayerProfileWarning } from "./player-profile-types";

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
  const weeklyStats = readNflverseCsv("playerStats").rows.map(normalizeNflverseWeeklyStat).filter((row) => isFantasyRelevantNflversePosition(row.position));
  const weeklyByGsis = groupBy(weeklyStats, (row) => row.playerId);
  const rosterByGsis = new Map(nflverseIdentity.rosters.map((row) => [row.playerId, row]));
  const playerByGsis = new Map(nflverseIdentity.players.map((row) => [row.playerId, row]));
  const profiles: HistoricalPlayerProfileSnapshot[] = [];
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
    const scoredWeekly = (weeklyByGsis.get(gsisId) ?? []).map((row) => scoreWeekly(row, scoringProfile));
    const points = scoredWeekly.map((row) => row.calculatedFantasyPoints);
    const consistency = buildConsistencyMetrics(points, position);
    const availability = buildAvailabilityMetrics(scoredWeekly.length);
    const warnings = warningsFor(match.confidence, scoredWeekly, scoredWeekly.flatMap((row) => row.scoringWarnings), position);
    const totalFantasyPoints = round(points.reduce((sum, value) => sum + value, 0));

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
        rookieSeason: match.sourcePlayer.rookieSeason ?? player?.rookieSeason ?? roster?.rookieYear ?? null,
        yearsExperience: match.sourcePlayer.yearsExperience ?? player?.yearsExperience ?? roster?.yearsExperience ?? null,
      },
      weeklyStats: scoredWeekly.map((row) => ({
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
      })),
      seasonSummaries: [{
        season: mostCommon(scoredWeekly.map((row) => row.source.season)),
        gamesPlayed: scoredWeekly.length,
        totalFantasyPoints,
        pointsPerGame: scoredWeekly.length ? round(totalFantasyPoints / scoredWeekly.length) : null,
        positionRank: null,
        keyStatTotals: summarizeKeyStats(scoredWeekly),
      }],
      consistencyMetrics: consistency,
      availabilityMetrics: availability,
      recommendationSignals: buildRecommendationSignals({ position, consistency, availability }),
      profileWarnings: warnings,
    });
  }

  assignPositionRanks(profiles);

  const diagnostics = buildDiagnostics({
    generatedAt,
    profiles,
    scoringProfile,
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
  const rosters = readNflverseCsv("rosters").rows.map(normalizeNflverseRoster).filter((row) => isFantasyRelevantNflversePosition(row.position));
  const records = new Map<string, PlayerIdentityRecord>();
  for (const player of players) addIdentityRecord(records, nflversePlayerIdentityRecord(player));
  for (const roster of rosters) addIdentityRecord(records, nflverseRosterIdentityRecord(roster));
  return { records: Array.from(records.values()), players, rosters };
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
    profiles
      .filter((profile) => profile.bio.position === position)
      .sort((a, b) => (b.seasonSummaries[0]?.totalFantasyPoints ?? 0) - (a.seasonSummaries[0]?.totalFantasyPoints ?? 0))
      .forEach((profile, index) => {
        profile.seasonSummaries[0].positionRank = index + 1;
      });
  }
}

function buildDiagnostics(input: {
  generatedAt: string;
  profiles: HistoricalPlayerProfileSnapshot[];
  scoringProfile: PlayerProfileScoringProfile;
  unmatched: number;
  conflict: number;
  missingGsisId: number;
}) {
  const withWeekly = input.profiles.filter((profile) => profile.weeklyStats.length > 0);
  return {
    generatedAt: input.generatedAt,
    dryRun: true as const,
    totalProfilesBuilt: input.profiles.length,
    profilesByPosition: countBy(input.profiles.map((profile) => profile.bio.position)),
    profilesByMatchConfidence: countBy(input.profiles.map((profile) => profile.identity.matchConfidence)),
    profilesWithWeeklyStats: withWeekly.length,
    profilesWithoutWeeklyStats: input.profiles.length - withWeekly.length,
    profilesWithIdpStats: input.profiles.filter((profile) => profile.weeklyStats.some((row) => Object.values(row.defensive).some((value) => typeof value === "number" && value > 0))).length,
    profilesWithWarnings: input.profiles.filter((profile) => profile.profileWarnings.length > 0).length,
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
      "Profiles are not yet consumed by projections, Blackbird Rank, or War Room recommendations.",
    ],
  };
}

function sampleTopByPosition(profiles: HistoricalPlayerProfileSnapshot[]) {
  const result: Record<string, Array<{ playerName: string; gsisId: string; totalFantasyPoints: number; gamesPlayed: number }>> = {};
  for (const position of new Set(profiles.map((profile) => profile.bio.position))) {
    result[position] = profiles
      .filter((profile) => profile.bio.position === position)
      .sort((a, b) => (b.seasonSummaries[0]?.totalFantasyPoints ?? 0) - (a.seasonSummaries[0]?.totalFantasyPoints ?? 0))
      .slice(0, 5)
      .map((profile) => ({
        playerName: profile.bio.name,
        gsisId: profile.identity.gsisId,
        totalFantasyPoints: profile.seasonSummaries[0]?.totalFantasyPoints ?? 0,
        gamesPlayed: profile.seasonSummaries[0]?.gamesPlayed ?? 0,
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

function mostCommon(values: Array<number | null>): number | null {
  const counts = new Map<number, number>();
  for (const value of values) if (typeof value === "number") counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
