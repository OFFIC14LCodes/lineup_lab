import type {
  OffensiveDraftPosition,
  PlayerLeagueSeasonProfile,
  ReplacementSummary
} from "@/lib/draft-data/types";

export function getPlayerLeagueSeasonProfile(
  profiles: PlayerLeagueSeasonProfile[],
  input: { leagueId: string; season: number; playerId: string }
) {
  return profiles.find(
    (profile) =>
      profile.leagueId === input.leagueId &&
      profile.performanceSeason === input.season &&
      profile.playerId === input.playerId
  ) ?? null;
}

export function getBatchPlayerProfiles(
  profiles: PlayerLeagueSeasonProfile[],
  input: { leagueId: string; season: number; playerIds: string[] }
) {
  const ids = new Set(input.playerIds);
  return profiles.filter(
    (profile) => profile.leagueId === input.leagueId && profile.performanceSeason === input.season && ids.has(profile.playerId)
  );
}

export function getProfilesByPosition(
  profiles: PlayerLeagueSeasonProfile[],
  input: { leagueId: string; season: number; position: OffensiveDraftPosition }
) {
  return profiles.filter(
    (profile) =>
      profile.leagueId === input.leagueId &&
      profile.performanceSeason === input.season &&
      profile.position === input.position
  );
}

export function getTopPlayersByMetric(
  profiles: PlayerLeagueSeasonProfile[],
  input: {
    leagueId: string;
    season: number;
    position?: OffensiveDraftPosition;
    metric: "totalPoints" | "pointsPerGame" | "medianPoints" | "ceilingPoints" | "pointsAboveReplacement";
    limit?: number;
    minimumGames?: number;
  }
) {
  const limit = input.limit ?? 25;
  const minimumGames = input.minimumGames ?? 0;
  return profiles
    .filter((profile) => profile.leagueId === input.leagueId && profile.performanceSeason === input.season)
    .filter((profile) => !input.position || profile.position === input.position)
    .filter((profile) => profile.gamesWithValidScoringData >= minimumGames)
    .sort((a, b) => metricValue(b, input.metric) - metricValue(a, input.metric) || a.playerName.localeCompare(b.playerName))
    .slice(0, limit);
}

export function getReplacementSummary(
  summaries: ReplacementSummary[],
  input: { leagueId: string; season: number }
) {
  return summaries.find((summary) => summary.leagueId === input.leagueId && summary.performanceSeason === input.season) ?? null;
}

function metricValue(profile: PlayerLeagueSeasonProfile, metric: Parameters<typeof getTopPlayersByMetric>[1]["metric"]) {
  if (metric === "pointsAboveReplacement") return profile.replacement.pointsAboveReplacement ?? -Infinity;
  return profile[metric];
}
