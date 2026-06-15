import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

export type H10ValidationProfileId =
  | "one_qb_offense"
  | "superflex_qb"
  | "te_premium"
  | "kicker"
  | "dst"
  | "shallow_roster"
  | "idp_mixed";

export type H10ValidationLeagueCandidate = {
  id: string;
  user_id: string;
  name: string | null;
  season: string | number | null;
  roster_positions_json: string[] | null;
  is_superflex?: boolean | null;
  is_two_qb?: boolean | null;
  te_premium?: number | null;
  metadata_json?: Record<string, unknown> | null;
};

export type H10ValidationSeedPlayer = {
  entityId: string | null;
  sleeperPlayerId: string | null;
  displayName: string;
  position: string;
  team: string | null;
  rank: number;
  adp: number;
  projectedPoints: number | null;
};

export type H10ValidationSeedRoomPlan = {
  profileId: H10ValidationProfileId;
  name: string;
  platformDraftId: string;
  leagueId: string;
  userId: string;
  rosterSlots: string[];
  metadata: Record<string, unknown>;
  rankingFormat: string;
  requiredPositions: string[];
  players: H10ValidationSeedPlayer[];
};

export type H10ValidationSeedPlan = {
  rooms: H10ValidationSeedRoomPlan[];
  missingProfiles: Array<{ profileId: H10ValidationProfileId; reason: string }>;
};

const VALIDATION_PURPOSE = "h10_recommendation_validation";
const VALIDATION_SOURCE = "h10_validation";

export const H10_VALIDATION_PROFILES: Array<{
  profileId: H10ValidationProfileId;
  name: string;
  rosterSlots: string[];
  requiredPositions: string[];
  playerCountByPosition: Record<string, number>;
  matchesLeague: (league: H10ValidationLeagueCandidate) => boolean;
}> = [
  {
    profileId: "one_qb_offense",
    name: "[H10 Validation] 1QB Offense Uploaded Rankings",
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN", "BN"],
    requiredPositions: ["QB", "RB", "WR", "TE"],
    playerCountByPosition: { QB: 6, RB: 8, WR: 8, TE: 6 },
    matchesLeague: (league) => !isSuperflex(league) && !isIdp(league) && !hasKicker(league) && !hasDst(league),
  },
  {
    profileId: "superflex_qb",
    name: "[H10 Validation] Superflex QB Rows",
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "SUPER_FLEX", "BN", "BN", "BN", "BN", "BN"],
    requiredPositions: ["QB", "RB", "WR", "TE"],
    playerCountByPosition: { QB: 10, RB: 6, WR: 6, TE: 4 },
    matchesLeague: (league) => isSuperflex(league),
  },
  {
    profileId: "te_premium",
    name: "[H10 Validation] TE Premium",
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN", "BN"],
    requiredPositions: ["QB", "RB", "WR", "TE"],
    playerCountByPosition: { QB: 4, RB: 6, WR: 6, TE: 8 },
    matchesLeague: (league) => Number(league.te_premium ?? 0) > 0,
  },
  {
    profileId: "kicker",
    name: "[H10 Validation] Kicker",
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "K", "BN", "BN", "BN"],
    requiredPositions: ["QB", "RB", "WR", "TE", "K"],
    playerCountByPosition: { QB: 3, RB: 4, WR: 4, TE: 3, K: 8 },
    matchesLeague: (league) => hasKicker(league),
  },
  {
    profileId: "dst",
    name: "[H10 Validation] DST",
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "DEF", "BN", "BN", "BN"],
    requiredPositions: ["DEF"],
    playerCountByPosition: { DEF: 6 },
    matchesLeague: (league) => hasDst(league),
  },
  {
    profileId: "shallow_roster",
    name: "[H10 Validation] Shallow Roster",
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN"],
    requiredPositions: ["QB", "RB", "WR", "TE"],
    playerCountByPosition: { QB: 4, RB: 6, WR: 6, TE: 4 },
    matchesLeague: (league) => benchDepth(league) <= 4 && !isIdp(league),
  },
  {
    profileId: "idp_mixed",
    name: "[H10 Validation] Mixed IDP",
    rosterSlots: ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "IDP_FLEX", "BN", "BN", "BN", "BN"],
    requiredPositions: ["DL", "LB", "DB"],
    playerCountByPosition: { DL: 8, LB: 8, DB: 8 },
    matchesLeague: (league) => isIdp(league),
  },
];

export function buildH10ValidationSeedPlan(input: {
  leagues: H10ValidationLeagueCandidate[];
  valueRows: H10LeagueValueRow[];
  playerLookup: Record<string, { sleeper_player_id: string | null; full_name: string | null; position: string | null; team: string | null }>;
}): H10ValidationSeedPlan {
  const rowsByLeague = groupValueRows(input.valueRows);
  const rooms: H10ValidationSeedRoomPlan[] = [];
  const missingProfiles: H10ValidationSeedPlan["missingProfiles"] = [];

  for (const profile of H10_VALIDATION_PROFILES) {
    const league = input.leagues.find((candidate) => profile.matchesLeague(candidate) && (rowsByLeague.get(candidate.id) || profile.profileId === "dst"));
    if (!league) {
      missingProfiles.push({ profileId: profile.profileId, reason: "No existing owned league with matching format and H10 value rows." });
      continue;
    }
    const players = selectPlayersForProfile({
      profile,
      valueRows: rowsByLeague.get(league.id) ?? [],
      playerLookup: input.playerLookup,
    });
    const missingPositions = profile.requiredPositions.filter((position) => !players.some((player) => player.position === position));
    if (missingPositions.length) {
      missingProfiles.push({ profileId: profile.profileId, reason: `No H10 value rows for positions: ${missingPositions.join(", ")}.` });
      continue;
    }
    rooms.push({
      profileId: profile.profileId,
      name: profile.name,
      platformDraftId: `h10-validation-${profile.profileId}`,
      leagueId: league.id,
      userId: league.user_id,
      rosterSlots: profile.rosterSlots,
      metadata: validationMetadata(profile.profileId),
      rankingFormat: profile.profileId,
      requiredPositions: profile.requiredPositions,
      players,
    });
  }

  return { rooms, missingProfiles };
}

export function validationMetadata(profileId: H10ValidationProfileId): Record<string, unknown> {
  return {
    validation_room: true,
    validation: true,
    created_by_system: true,
    purpose: VALIDATION_PURPOSE,
    h10_validation_profile: profileId,
  };
}

export function cleanupFilters() {
  return {
    draftRoomMetadataPurpose: VALIDATION_PURPOSE,
    rankingSource: VALIDATION_SOURCE,
    leagueMetadataPurpose: VALIDATION_PURPOSE,
  };
}

export function rankingSource() {
  return VALIDATION_SOURCE;
}

function selectPlayersForProfile(input: {
  profile: (typeof H10_VALIDATION_PROFILES)[number];
  valueRows: H10LeagueValueRow[];
  playerLookup: Record<string, { sleeper_player_id: string | null; full_name: string | null; position: string | null; team: string | null }>;
}): H10ValidationSeedPlayer[] {
  const players: H10ValidationSeedPlayer[] = [];
  for (const [position, count] of Object.entries(input.profile.playerCountByPosition)) {
    if (position === "DEF" && !input.valueRows.some((row) => normalizePosition(row.positionGroup) === "DST")) {
      ["Pittsburgh Steelers", "Baltimore Ravens", "New York Jets", "Dallas Cowboys", "Cleveland Browns", "Buffalo Bills"].slice(0, count).forEach((name) => {
        players.push({
          entityId: null,
          sleeperPlayerId: null,
          displayName: name,
          position: "DEF",
          team: teamAbbreviation(name),
          rank: players.length + 1,
          adp: players.length + 150,
          projectedPoints: null,
        });
      });
      continue;
    }
    const rows = input.valueRows
      .filter((row) => normalizePosition(row.positionGroup) === position && row.entityType === "PLAYER")
      .sort((a, b) => (b.riskAdjustedValue ?? -9999) - (a.riskAdjustedValue ?? -9999) || a.displayName.localeCompare(b.displayName))
      .slice(0, count);
    rows.forEach((row, index) => {
      const player = input.playerLookup[row.entityId] ?? null;
      players.push({
        entityId: row.entityId,
        sleeperPlayerId: player?.sleeper_player_id ?? null,
        displayName: player?.full_name ?? row.displayName,
        position,
        team: player?.team ?? row.team,
        rank: players.length + 1,
        adp: players.length + 8 + index,
        projectedPoints: row.medianPoints,
      });
    });
  }
  return players;
}

function groupValueRows(rows: H10LeagueValueRow[]) {
  return rows.reduce<Map<string, H10LeagueValueRow[]>>((acc, row) => {
    acc.set(row.leagueId, [...(acc.get(row.leagueId) ?? []), row]);
    return acc;
  }, new Map());
}

function isSuperflex(league: H10ValidationLeagueCandidate) {
  return Boolean(league.is_superflex || league.is_two_qb) || rosterSlots(league).some((slot) => ["SUPER_FLEX", "SUPERFLEX", "OP"].includes(slot));
}

function isIdp(league: H10ValidationLeagueCandidate) {
  return rosterSlots(league).some((slot) => ["DL", "DE", "DT", "LB", "ILB", "OLB", "MLB", "DB", "CB", "S", "FS", "SS", "IDP", "IDP_FLEX", "FLEX_IDP", "DP"].includes(slot));
}

function hasKicker(league: H10ValidationLeagueCandidate) {
  return rosterSlots(league).includes("K");
}

function hasDst(league: H10ValidationLeagueCandidate) {
  return rosterSlots(league).some((slot) => ["DEF", "DST", "D/ST"].includes(slot));
}

function benchDepth(league: H10ValidationLeagueCandidate) {
  return rosterSlots(league).filter((slot) => ["BN", "BENCH"].includes(slot)).length;
}

function rosterSlots(league: H10ValidationLeagueCandidate) {
  return (league.roster_positions_json ?? []).map((slot) => slot.trim().toUpperCase().replace(/\s+/g, "_"));
}

function normalizePosition(position: string | null | undefined) {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST" || normalized === "DEF") return "DST";
  return normalized;
}

function teamAbbreviation(name: string): string {
  const byName: Record<string, string> = {
    "Pittsburgh Steelers": "PIT",
    "Baltimore Ravens": "BAL",
    "New York Jets": "NYJ",
    "Dallas Cowboys": "DAL",
    "Cleveland Browns": "CLE",
    "Buffalo Bills": "BUF",
  };
  return byName[name] ?? "DEF";
}
