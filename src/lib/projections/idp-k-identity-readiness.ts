import { normalizePlayerName, normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";
import type { H98NormalizedPlayerRow } from "@/lib/projections/special-teams-defense-ingest";

export type H99CandidatePlayer = {
  playerId: string;
  fullName: string | null;
  normalizedName: string | null;
  team: string | null;
  positionGroup: string | null;
  active: boolean | null;
};

export type H99MatchDecision = {
  status: "existing_id" | "auto_safe" | "manual_review" | "ambiguous" | "unresolved";
  confidence: number;
  method:
    | "exact_id"
    | "exact_name_team_position"
    | "known_alias"
    | "normalized_name_team_position"
    | "unique_name_position"
    | "unresolved"
    | null;
  candidateMatches: H99CandidatePlayer[];
  recommendedAction: string;
  reasonUnresolved: string | null;
};

export type H99UnresolvedAggregate = {
  sourcePlayerId: string;
  playerName: string;
  normalizedName: string;
  category: "idp" | "kicker";
  position: string;
  positionGroup: string;
  teams: string[];
  weeks: number[];
  rowCount: number;
  statSummary: Record<string, number>;
  totalOpportunityOrPointsProxy: number;
  highPriority: boolean;
};

export type H99Readiness =
  | "READY_FOR_LOW_CONFIDENCE_PROJECTION"
  | "READY_AFTER_IDENTITY_REPAIR"
  | "BLOCKED_BY_MISSING_COMPONENTS"
  | "BLOCKED_BY_IDENTITY_COVERAGE"
  | "DEFER";

export type H99DstReadiness =
  | "DST_ALLOWANCE_ONLY_READY"
  | "DST_BIG_PLAY_COMPONENTS_MISSING"
  | "DST_READY";

const IDP_VOLUME_KEYS = ["solo_tkl", "ast_tkl", "tkl", "sack", "int", "pd", "ff", "fr", "def_td", "safe"] as const;
const KICKER_VOLUME_KEYS = ["fgm", "fga", "fgmiss", "xpm", "xpa", "xpmiss"] as const;

export function normalizeIdentityName(name: string): string {
  return normalizePlayerName(name);
}

export function makeUnresolvedAggregate(rows: H98NormalizedPlayerRow[]): H99UnresolvedAggregate {
  if (rows.length === 0) throw new Error("Cannot aggregate empty unresolved row set.");
  const first = rows[0];
  const statSummary = sumStats(rows);
  const teams = [...new Set(rows.map((row) => row.team).filter((team): team is string => Boolean(team)))].sort();
  const weeks = [...new Set(rows.map((row) => row.week))].sort((a, b) => a - b);
  const proxy = first.category === "kicker" ? kickerProxy(statSummary) : idpProxy(statSummary);

  return {
    sourcePlayerId: first.gsisId,
    playerName: first.playerDisplayName,
    normalizedName: normalizeIdentityName(first.playerDisplayName),
    category: first.category,
    position: first.rawPosition,
    positionGroup: first.positionGroup,
    teams,
    weeks,
    rowCount: rows.length,
    statSummary,
    totalOpportunityOrPointsProxy: proxy,
    highPriority: isHighPriority(first.category, rows.length, proxy, statSummary),
  };
}

export function matchIdentityCandidate(
  aggregate: H99UnresolvedAggregate,
  candidatesByName: Map<string, H99CandidatePlayer[]>,
  existingPlayerId?: string | null,
  knownAliases: Map<string, string> = new Map()
): H99MatchDecision {
  if (existingPlayerId) {
    return {
      status: "existing_id",
      confidence: 1,
      method: "exact_id",
      candidateMatches: [],
      recommendedAction: "No action; GSIS mapping already exists.",
      reasonUnresolved: null,
    };
  }

  const aliasName = knownAliases.get(aggregate.normalizedName);
  const candidates = candidatesByName.get(aggregate.normalizedName) ?? (aliasName ? candidatesByName.get(aliasName) : []) ?? [];
  const compatible = candidates.filter((candidate) => positionCompatible(aggregate.positionGroup, candidate.positionGroup));
  const teamCompatible = compatible.filter((candidate) => {
    const candidateTeam = normalizeTeam(candidate.team);
    return candidateTeam !== null && aggregate.teams.includes(candidateTeam);
  });

  if (teamCompatible.length === 1) {
    return {
      status: "auto_safe",
      confidence: aliasName ? 0.9 : 0.92,
      method: aliasName ? "known_alias" : "normalized_name_team_position",
      candidateMatches: teamCompatible,
      recommendedAction: aliasName
        ? "Create audited GSIS mapping via known alias, team, and compatible position."
        : "Create audited GSIS mapping via exact normalized name, team, and compatible position.",
      reasonUnresolved: "gsis_id_not_stored_for_canonical_player",
    };
  }

  if (teamCompatible.length > 1) {
    return {
      status: "ambiguous",
      confidence: 0,
      method: null,
      candidateMatches: teamCompatible,
      recommendedAction: "Do not auto-map; multiple same-name/team/position candidates.",
      reasonUnresolved: "duplicate_candidate_ambiguity",
    };
  }

  if (compatible.length === 1) {
    return {
      status: "manual_review",
      confidence: 0.75,
      method: "unique_name_position",
      candidateMatches: compatible,
      recommendedAction: "Manual review; exact name and position match but team does not match source rows.",
      reasonUnresolved: "team_mismatch_or_stale_canonical_team",
    };
  }

  if (compatible.length > 1) {
    return {
      status: "ambiguous",
      confidence: 0,
      method: null,
      candidateMatches: compatible,
      recommendedAction: "Do not auto-map; exact name has multiple compatible position candidates.",
      reasonUnresolved: "duplicate_candidate_ambiguity",
    };
  }

  if (candidates.length > 0) {
    return {
      status: "manual_review",
      confidence: 0.4,
      method: "unresolved",
      candidateMatches: candidates,
      recommendedAction: "Manual review; exact name exists but position is incompatible.",
      reasonUnresolved: "position_mismatch",
    };
  }

  return {
    status: "unresolved",
    confidence: 0,
    method: "unresolved",
    candidateMatches: [],
    recommendedAction: "Keep unresolved; no exact normalized-name candidate in canonical players.",
    reasonUnresolved: "missing_player_or_name_mismatch",
  };
}

export function classifyProjectionReadiness(input: {
  category: "idp" | "kicker";
  resolvedRows: number;
  totalRows: number;
  highPriorityUnresolvedPlayers: number;
  playersWithEightWeeks: number;
  playersWithTwelveWeeks: number;
}): H99Readiness {
  if (input.totalRows === 0) return "DEFER";
  const coverage = input.resolvedRows / input.totalRows;
  if (coverage >= 0.85 && input.playersWithTwelveWeeks > 0 && input.highPriorityUnresolvedPlayers === 0) {
    return "READY_FOR_LOW_CONFIDENCE_PROJECTION";
  }
  if (coverage >= 0.5 && input.playersWithEightWeeks > 0) {
    return "READY_AFTER_IDENTITY_REPAIR";
  }
  return "BLOCKED_BY_IDENTITY_COVERAGE";
}

export function classifyDstReadiness(input: {
  rows: number;
  pointsAllowedCoverage: number;
  yardsAllowedCoverage: number;
  missingBigPlayComponents: number;
}): H99DstReadiness {
  if (input.rows > 0 && input.pointsAllowedCoverage === input.rows && input.yardsAllowedCoverage === input.rows) {
    return input.missingBigPlayComponents > 0 ? "DST_ALLOWANCE_ONLY_READY" : "DST_READY";
  }
  return "DST_BIG_PLAY_COMPONENTS_MISSING";
}

function sumStats(rows: H98NormalizedPlayerRow[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.stats)) {
      stats[key] = (stats[key] ?? 0) + value;
    }
  }
  return stats;
}

function idpProxy(stats: Record<string, number>): number {
  return (
    (stats.tkl ?? 0) +
    (stats.solo_tkl ?? 0) * 0.25 +
    (stats.sack ?? 0) * 4 +
    (stats.int ?? 0) * 5 +
    (stats.pd ?? 0) * 1.5 +
    (stats.ff ?? 0) * 3 +
    (stats.fr ?? 0) * 3 +
    (stats.def_td ?? 0) * 6 +
    (stats.safe ?? 0) * 2
  );
}

function kickerProxy(stats: Record<string, number>): number {
  return (stats.fgm ?? 0) * 3 + (stats.xpm ?? 0) + (stats.fga ?? 0) * 0.25 + (stats.xpa ?? 0) * 0.05;
}

function isHighPriority(category: "idp" | "kicker", weeks: number, proxy: number, stats: Record<string, number>): boolean {
  if (category === "kicker") {
    return weeks >= 6 || (stats.fga ?? 0) >= 8 || (stats.xpa ?? 0) >= 15 || proxy >= 25;
  }
  return weeks >= 8 || proxy >= 35 || (stats.tkl ?? 0) >= 30 || (stats.sack ?? 0) >= 3 || (stats.int ?? 0) >= 2;
}

function positionCompatible(sourcePosition: string | null, candidatePosition: string | null): boolean {
  const source = normalizePositionGroup(sourcePosition);
  const candidate = normalizePositionGroup(candidatePosition);
  return source !== null && candidate !== null && source === candidate;
}

export function activeWeekMetrics(rowsByPlayer: Map<string, H98NormalizedPlayerRow[]>) {
  let playersWithEightWeeks = 0;
  let playersWithTwelveWeeks = 0;
  let playersWithMeaningfulRoleWeeks = 0;

  for (const rows of rowsByPlayer.values()) {
    const activeWeeks = new Set(rows.filter((row) => !row.allZeroStats).map((row) => row.week)).size;
    if (activeWeeks >= 8) playersWithEightWeeks += 1;
    if (activeWeeks >= 12) playersWithTwelveWeeks += 1;
    const meaningfulWeeks = rows.filter((row) => {
      const keys = row.category === "kicker" ? KICKER_VOLUME_KEYS : IDP_VOLUME_KEYS;
      return keys.some((key) => (row.stats[key] ?? 0) > 0);
    }).length;
    if (meaningfulWeeks >= 4) playersWithMeaningfulRoleWeeks += 1;
  }

  return {
    playersWithEightWeeks,
    playersWithTwelveWeeks,
    playersWithMeaningfulRoleWeeks,
  };
}
