import type { HistoricalPlayerProfileSnapshot, PlayerProfileWeeklyStats } from "./player-profile-types";

export type PlayerProfileReadModel = {
  header: {
    name: string;
    position: string;
    team: string | null;
    status: string | null;
    headshot: string | null;
  };
  identity: {
    sleeper_id: string | null;
    gsis_id: string;
    blackbird_player_id: string | null;
    match_confidence: string;
    match_reasons: string[];
  };
  bio: {
    age: number | null;
    birth_date: string | null;
    height: number | null;
    weight: number | null;
    college: string | null;
    rookie_season: number | null;
    years_experience: number | null;
  };
  summaryMetrics: {
    games: number;
    total_points: number;
    points_per_game: number | null;
    floor: number | null;
    median: number | null;
    ceiling: number | null;
    consistency_score: number;
    spike_score: number;
    availability_score: number;
  };
  seasonSummaries: HistoricalPlayerProfileSnapshot["seasonSummaries"];
  weeklyGameLog: PlayerProfileWeeklyStats[];
  weeklyGameLogTruncated: boolean;
  idpSummary: Record<string, number> | null;
  recommendationSignals: HistoricalPlayerProfileSnapshot["recommendationSignals"];
  warnings: HistoricalPlayerProfileSnapshot["profileWarnings"];
};

export function toPlayerProfileReadModel(profile: HistoricalPlayerProfileSnapshot, input: { weeklyLimit?: number } = {}): PlayerProfileReadModel {
  const weeklyLimit = Math.max(0, Math.min(input.weeklyLimit ?? 20, 25));
  const weeklyGameLog = profile.weeklyStats.slice(0, weeklyLimit);
  const season = profile.seasonSummaries[0];
  return {
    header: {
      name: profile.bio.name,
      position: profile.bio.position,
      team: profile.bio.team,
      status: profile.bio.status,
      headshot: profile.identity.sleeperId ? `https://sleepercdn.com/content/nfl/players/${profile.identity.sleeperId}.jpg` : null,
    },
    identity: {
      sleeper_id: profile.identity.sleeperId,
      gsis_id: profile.identity.gsisId,
      blackbird_player_id: profile.identity.blackbirdPlayerId,
      match_confidence: profile.identity.matchConfidence,
      match_reasons: profile.identity.matchReasons,
    },
    bio: {
      age: profile.bio.age,
      birth_date: profile.bio.birthDate,
      height: profile.bio.height,
      weight: profile.bio.weight,
      college: profile.bio.college,
      rookie_season: profile.bio.rookieSeason,
      years_experience: profile.bio.yearsExperience,
    },
    summaryMetrics: {
      games: season?.gamesPlayed ?? 0,
      total_points: season?.totalFantasyPoints ?? 0,
      points_per_game: season?.pointsPerGame ?? null,
      floor: profile.consistencyMetrics.floorPercentile20,
      median: profile.consistencyMetrics.median,
      ceiling: profile.consistencyMetrics.ceilingPercentile90,
      consistency_score: profile.consistencyMetrics.consistencyScore,
      spike_score: profile.consistencyMetrics.spikeWeekScore,
      availability_score: profile.availabilityMetrics.availabilityScore,
    },
    seasonSummaries: profile.seasonSummaries,
    weeklyGameLog,
    weeklyGameLogTruncated: profile.weeklyStats.length > weeklyGameLog.length,
    idpSummary: buildIdpSummary(profile),
    recommendationSignals: profile.recommendationSignals,
    warnings: profile.profileWarnings,
  };
}

function buildIdpSummary(profile: HistoricalPlayerProfileSnapshot): Record<string, number> | null {
  if (!["DL", "LB", "DB"].includes(profile.bio.position)) return null;
  const totals = profile.seasonSummaries[0]?.keyStatTotals ?? {};
  const keys = ["solo_tkl", "ast_tkl", "tkl", "tkl_loss", "sack", "qb_hit", "int", "pd", "ff", "fr", "def_td"];
  const summary = Object.fromEntries(keys.map((key) => [key, totals[key] ?? 0]));
  return Object.values(summary).some((value) => value > 0) ? summary : null;
}
