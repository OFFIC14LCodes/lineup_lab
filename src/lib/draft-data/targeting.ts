import type { DraftDataLeague } from "@/lib/draft-data/types";

export type H6CliArgs = {
  performanceSeason: number;
  leagueConfigSeason: number | null;
  leagueId: string | null;
  deprecatedSeasonUsed: boolean;
};

export type LeagueInventoryItem = {
  id: string;
  platformLeagueId: string | null;
  name: string | null;
  season: number | null;
  status: string | null;
  userId: string | null;
  scoringSettingsPresent: boolean;
  rosterSettingsPresent: boolean;
  teamCount: number | null;
  rosterPositions: string[];
  previousLeagueId: string | null;
};

export function parseH6CliArgs(raw: string[]): H6CliArgs {
  let performanceSeason: number | null = null;
  let leagueConfigSeason: number | null = null;
  let leagueId: string | null = null;
  let deprecatedSeasonUsed = false;

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i]!;
    if ((arg === "--performance-season" || arg === "--performanceSeason") && raw[i + 1]) {
      performanceSeason = parseInt(raw[++i]!, 10);
    } else if (arg.startsWith("--performance-season=")) {
      performanceSeason = parseInt(arg.split("=")[1]!, 10);
    } else if ((arg === "--league-config-season" || arg === "--leagueConfigSeason") && raw[i + 1]) {
      leagueConfigSeason = parseInt(raw[++i]!, 10);
    } else if (arg.startsWith("--league-config-season=")) {
      leagueConfigSeason = parseInt(arg.split("=")[1]!, 10);
    } else if (arg === "--league-id" && raw[i + 1]) {
      leagueId = raw[++i]!;
    } else if (arg.startsWith("--league-id=")) {
      leagueId = arg.split("=")[1]!;
    } else if (arg === "--season" && raw[i + 1]) {
      performanceSeason = parseInt(raw[++i]!, 10);
      deprecatedSeasonUsed = true;
    } else if (arg.startsWith("--season=")) {
      performanceSeason = parseInt(arg.split("=")[1]!, 10);
      deprecatedSeasonUsed = true;
    }
  }

  if (performanceSeason === null) performanceSeason = new Date().getFullYear() - 1;
  assertSeason("performance season", performanceSeason);
  if (leagueConfigSeason !== null) assertSeason("league config season", leagueConfigSeason);

  return { performanceSeason, leagueConfigSeason, leagueId, deprecatedSeasonUsed };
}

export function selectTargetLeagues(input: {
  leagues: DraftDataLeague[];
  args: H6CliArgs;
  operatorUserId: string | null;
}): DraftDataLeague[] {
  if (input.args.leagueId) {
    const matched = input.leagues.filter(
      (league) => league.id === input.args.leagueId || league.platform_league_id === input.args.leagueId
    );
    if (matched.length === 0) {
      throw new Error(`No operator-owned league matched --league-id=${input.args.leagueId}. Use an internal league id or Sleeper league id from the inventory.`);
    }
    return matched;
  }

  if (input.args.leagueConfigSeason !== null) {
    const matched = input.leagues.filter((league) => Number(league.season) === input.args.leagueConfigSeason);
    if (matched.length === 0) {
      throw new Error(`No operator-owned leagues found for --league-config-season=${input.args.leagueConfigSeason}.`);
    }
    return matched;
  }

  if (input.leagues.length === 1) return input.leagues;

  throw new Error(
    input.operatorUserId
      ? "Multiple or zero operator-owned leagues are available. Pass --league-id=<id> or --league-config-season=<year>."
      : "SCORING_VALIDATION_OPERATOR_USER_ID is required unless --league-id is used with an operator-owned league inventory."
  );
}

export function buildLeagueInventory(leagues: DraftDataLeague[]): LeagueInventoryItem[] {
  return leagues.map((league) => ({
    id: league.id,
    platformLeagueId: league.platform_league_id ?? null,
    name: league.name,
    season: league.season === null ? null : Number(league.season),
    status: league.status ?? null,
    userId: league.user_id ?? null,
    scoringSettingsPresent: Boolean(league.scoring_settings_json && Object.keys(league.scoring_settings_json).length > 0),
    rosterSettingsPresent: Array.isArray(league.roster_positions_json) && league.roster_positions_json.length > 0,
    teamCount: league.total_teams,
    rosterPositions: Array.isArray(league.roster_positions_json)
      ? league.roster_positions_json.filter((slot): slot is string => typeof slot === "string")
      : [],
    previousLeagueId: findPreviousLeagueId(league)
  }));
}

export function findLineagePairs(leagues: DraftDataLeague[]) {
  const byPlatformId = new Map(leagues.map((league) => [league.platform_league_id, league]));
  return leagues
    .map((league) => {
      const previousLeagueId = findPreviousLeagueId(league);
      if (!previousLeagueId) return null;
      const previousLeague = byPlatformId.get(previousLeagueId) ?? null;
      return { league, previousLeagueId, previousLeague };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function findPreviousLeagueId(league: DraftDataLeague) {
  const settings = league.settings_json ?? {};
  const raw = settings["previous_league_id"] ?? settings["previousLeagueId"];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function assertSeason(label: string, value: number) {
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

