import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser
} from "@/lib/sleeper/types";

const BASE_URL = "https://api.sleeper.app/v1";

type FetchOptions = {
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

async function sleeperFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "User-Agent": "RosterForge/0.1"
    }
  });

  if (response.status === 429) {
    throw new Error("Sleeper API rate limit reached. Try again shortly.");
  }

  if (!response.ok) {
    throw new Error(`Sleeper API request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

export function getSleeperUserByUsername(username: string) {
  return sleeperFetch<SleeperUser>(`/user/${encodeURIComponent(username.trim())}`, {
    cache: "no-store"
  });
}

export function getUserLeagues(userId: string, sport = "nfl", season = currentSeason()) {
  return sleeperFetch<SleeperLeague[]>(
    `/user/${encodeURIComponent(userId)}/leagues/${sport}/${season}`,
    { cache: "no-store" }
  );
}

export function getLeague(leagueId: string) {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`, { cache: "no-store" });
}

export function getLeagueRosters(leagueId: string) {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, { cache: "no-store" });
}

export function getLeagueUsers(leagueId: string) {
  return sleeperFetch<SleeperLeagueUser[]>(`/league/${leagueId}/users`, { cache: "no-store" });
}

export function getLeagueDrafts(leagueId: string) {
  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`, { cache: "no-store" });
}

export function getDraft(draftId: string) {
  return sleeperFetch<SleeperDraft>(`/draft/${draftId}`, { cache: "no-store" });
}

export function getDraftPicks(draftId: string) {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, { cache: "no-store" });
}

export function getDraftTradedPicks(draftId: string) {
  return sleeperFetch<unknown[]>(`/draft/${draftId}/traded_picks`, { cache: "no-store" });
}

export function getAllPlayers(sport = "nfl") {
  return sleeperFetch<Record<string, SleeperPlayer>>(`/players/${sport}`, {
    next: { revalidate: 60 * 60 * 24 }
  });
}

export function currentSeason() {
  const now = new Date();
  return String(now.getMonth() >= 1 ? now.getFullYear() : now.getFullYear() - 1);
}
