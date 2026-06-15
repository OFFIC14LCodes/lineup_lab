import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { getIdpPositionCompatibility, isIdpPosition } from "@/lib/draft/idp-position-compatibility";
import { normalizePlayerName, normalizePrimaryPosition } from "@/lib/players/normalize";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

export type WarRoomMatchClassification =
  | "MATCHED_BY_CANONICAL_ID"
  | "MATCHED_BY_SLEEPER_ID"
  | "MATCHED_BY_NAME_POSITION_TEAM"
  | "MATCHED_BY_DST_TEAM"
  | "MATCHED_BUT_FORMAT_EXCLUDED"
  | "MISSING_CANONICAL_ID"
  | "MISSING_H10_VALUE_ROW"
  | "POSITION_NOT_PROJECTED"
  | "TEAM_DEFENSE_ID_MISMATCH"
  | "LOW_CONFIDENCE_MATCH"
  | "AMBIGUOUS_MATCH_REJECTED"
  | "FALLBACK_ROW_UNMATCHED";

export type WarRoomCanonicalCandidate = {
  id: string;
  sleeper_player_id?: string | null;
  full_name?: string | null;
  position?: string | null;
  primary_position?: string | null;
  position_group?: string | null;
  team?: string | null;
};

export type WarRoomMatchingCoverageRow = {
  player_name: string | null;
  position: string | null;
  team: string | null;
  rank: number | null;
  adp: number | null;
  projected_points: number | null;
  sleeper_player_id: string | null;
  matched_player_id: string | null;
  match_status: string | null;
  match_confidence: number | null;
  is_ranked: boolean;
  is_fallback: boolean;
  classification: WarRoomMatchClassification;
  matchedEntityId: string | null;
  matchedBy: "canonical_id" | "sleeper_id" | "name_position_team" | "dst_team" | null;
  missingReason: string | null;
  reasonCodes: string[];
  candidate_canonical_players: WarRoomCanonicalCandidate[];
  recommended_fix: string;
};

export type WarRoomMatchingCoverageSummary = {
  leagueId: string;
  rowsLoaded: number;
  rowsMatched: number;
  rowsUnmatched: number;
  matchRate: number;
  matchRateByPosition: Record<string, { rows: number; matched: number; unmatched: number; matchRate: number }>;
  matchRateBySource: Record<string, { rows: number; matched: number; unmatched: number; matchRate: number }>;
  missingProjectionCount: number;
  formatExcludedCount: number;
  lowConfidenceCount: number;
  classificationCounts: Record<string, number>;
  missingProjectionReasons: Record<string, number>;
  topMissingHighRankPlayers: WarRoomMatchingCoverageRow[];
  topMissingHighAdpPlayers: WarRoomMatchingCoverageRow[];
  highPriorityMissingProjectionExamples: WarRoomMatchingCoverageRow[];
};

export type WarRoomMatchingCoverageResult = {
  rows: WarRoomMatchingCoverageRow[];
  summary: WarRoomMatchingCoverageSummary;
};

export type BuildWarRoomMatchingCoverageInput = {
  leagueId: string;
  players: DraftTargetScorePlayer[];
  valueRows: H10LeagueValueRow[];
  rosterRequirements?: NormalizedRosterRequirements;
  includeDstDryRun?: boolean;
  includeAllPositions?: boolean;
  sleeperToCanonicalId?: Record<string, string>;
  sleeperCanonicalCandidates?: Record<string, WarRoomCanonicalCandidate[]>;
};

const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const MATCHED_CLASSIFICATIONS = new Set<WarRoomMatchClassification>([
  "MATCHED_BY_CANONICAL_ID",
  "MATCHED_BY_SLEEPER_ID",
  "MATCHED_BY_NAME_POSITION_TEAM",
  "MATCHED_BY_DST_TEAM",
  "MATCHED_BUT_FORMAT_EXCLUDED",
]);

export function buildWarRoomMatchingCoverage(input: BuildWarRoomMatchingCoverageInput): WarRoomMatchingCoverageResult {
  const leagueRows = input.valueRows.filter((row) => row.leagueId === input.leagueId);
  const byEntityId = new Map(leagueRows.map((row) => [row.entityId, row]));
  const byNamePositionTeam = buildNamePositionTeamIndex(leagueRows);
  const dstRows = leagueRows.filter((row) => row.entityType === "TEAM_DEFENSE");
  const projectedPositions = new Set(leagueRows.map((row) => normalizePosition(row.positionGroup || row.position)));

  const rows = input.players.map((player) =>
    classifyPlayer({
      player,
      byEntityId,
      byNamePositionTeam,
      dstRows,
      projectedPositions,
      rosterRequirements: input.rosterRequirements,
      includeDstDryRun: Boolean(input.includeDstDryRun),
      includeAllPositions: Boolean(input.includeAllPositions),
      sleeperToCanonicalId: input.sleeperToCanonicalId ?? {},
      sleeperCanonicalCandidates: input.sleeperCanonicalCandidates ?? {},
    })
  );

  return { rows, summary: summarize(input.leagueId, rows) };
}

export function matchedEntityIdForCoverage(row: WarRoomMatchingCoverageRow): string | null {
  return isMatchedClassification(row.classification) ? row.matchedEntityId : null;
}

function classifyPlayer(input: {
  player: DraftTargetScorePlayer;
  byEntityId: Map<string, H10LeagueValueRow>;
  byNamePositionTeam: Map<string, H10LeagueValueRow[]>;
  dstRows: H10LeagueValueRow[];
  projectedPositions: Set<string>;
  rosterRequirements?: NormalizedRosterRequirements;
  includeDstDryRun: boolean;
  includeAllPositions: boolean;
  sleeperToCanonicalId: Record<string, string>;
  sleeperCanonicalCandidates: Record<string, WarRoomCanonicalCandidate[]>;
}): WarRoomMatchingCoverageRow {
  const { player } = input;
  const base = baseRow(player);
  const playerPosition = normalizePosition(player.position);
  let deferredMissingCanonicalId: WarRoomMatchingCoverageRow | null = null;

  if (player.is_fallback && !player.sleeper_player_id && !player.matched_player_id) {
    return missing(base, "FALLBACK_ROW_UNMATCHED", "FALLBACK_ROW_WITHOUT_IDENTIFIERS", "Sync or upload rankings with Sleeper/canonical identifiers.");
  }

  if (isAmbiguous(player)) {
    return missing(base, "AMBIGUOUS_MATCH_REJECTED", "RANKING_MATCH_AMBIGUOUS", "Repair identity data with an exact unique source identifier before using this row.");
  }

  if (player.matched_player_id) {
    const row = input.byEntityId.get(player.matched_player_id);
    if (!row) {
      deferredMissingCanonicalId = missing(base, "MISSING_H10_VALUE_ROW", "CANONICAL_ID_HAS_NO_H10_VALUE_ROW", "Add or repair the H10 projection/value row for this canonical entity.");
    } else {
      const compatibility = compatibilityCheck(player, row);
      if (compatibility.rejectionReason) return missing(base, "LOW_CONFIDENCE_MATCH", compatibility.rejectionReason, "Review the canonical identity; do not use this projection until position/team compatibility is exact.");
      return matched(base, classificationForMatchedRow(row, "MATCHED_BY_CANONICAL_ID", input), row.entityId, "canonical_id", [], compatibility.reasonCodes);
    }
  }

  const sleeperCandidates = candidatesForSleeper(player.sleeper_player_id, input);
  if (sleeperCandidates.length > 1) {
    return {
      ...missing(base, "AMBIGUOUS_MATCH_REJECTED", "SLEEPER_ID_MAPS_TO_MULTIPLE_CANONICAL_PLAYERS", "Repair duplicate Sleeper identity mappings before using this row."),
      candidate_canonical_players: sleeperCandidates,
    };
  }

  const canonicalFromSleeper = sleeperCandidates[0]?.id ?? (player.sleeper_player_id ? input.sleeperToCanonicalId[player.sleeper_player_id] : null);
  if (canonicalFromSleeper) {
    const row = input.byEntityId.get(canonicalFromSleeper);
    if (!row) {
      return {
        ...missing(base, "MISSING_H10_VALUE_ROW", "SLEEPER_CROSSWALK_HAS_NO_H10_VALUE_ROW", "Add or repair the H10 projection/value row for this Sleeper-linked canonical entity."),
        candidate_canonical_players: sleeperCandidates,
      };
    }
    const compatibility = compatibilityCheck(player, row);
    if (compatibility.rejectionReason) {
      return {
        ...missing(base, "LOW_CONFIDENCE_MATCH", compatibility.rejectionReason, "Review the Sleeper crosswalk; do not use this projection until position/team compatibility is exact."),
        candidate_canonical_players: sleeperCandidates,
      };
    }
    return matched(base, classificationForMatchedRow(row, "MATCHED_BY_SLEEPER_ID", input), row.entityId, "sleeper_id", sleeperCandidates, compatibility.reasonCodes);
  }

  if (isDefensePosition(playerPosition)) {
    const team = normalizeTeam(player.team);
    const matches = input.dstRows.filter((row) => normalizeTeam(row.entityId) === team || normalizeTeam(row.team) === team);
    if (matches.length === 1) return matched(base, classificationForMatchedRow(matches[0], "MATCHED_BY_DST_TEAM", input), matches[0].entityId, "dst_team");
    if (matches.length > 1) return missing(base, "AMBIGUOUS_MATCH_REJECTED", "DST_TEAM_MATCH_AMBIGUOUS", "Keep DST unmatched until team-defense identity rows are unique.");
    return missing(base, "TEAM_DEFENSE_ID_MISMATCH", "NO_TEAM_DEFENSE_VALUE_ROW_FOR_TEAM", "Add or repair a TEAM_DEFENSE H10 row keyed to the normalized team abbreviation.");
  }

  const nameMatch = findNamePositionTeamMatch(player, input.byNamePositionTeam);
  if (nameMatch.status === "matched") {
    const compatibility = compatibilityCheck(player, nameMatch.row);
    if (compatibility.rejectionReason) {
      return missing(base, "LOW_CONFIDENCE_MATCH", compatibility.rejectionReason, "Review the name/position/team match before using this projection.");
    }
    return matched(
      base,
      classificationForMatchedRow(nameMatch.row, "MATCHED_BY_NAME_POSITION_TEAM", input),
      nameMatch.row.entityId,
      "name_position_team",
      [],
      compatibility.reasonCodes
    );
  }
  if (nameMatch.status === "ambiguous") {
    return missing(base, "AMBIGUOUS_MATCH_REJECTED", "NAME_POSITION_TEAM_MATCH_AMBIGUOUS", "Repair canonical identity before using this projection.");
  }

  if (deferredMissingCanonicalId) return deferredMissingCanonicalId;

  if (playerPosition && !input.projectedPositions.has(playerPosition)) {
    return missing(base, "POSITION_NOT_PROJECTED", "POSITION_NOT_IN_H10_VALUE_MODEL", "Accept as out of scope or add deterministic projections for this position.");
  }

  return missing(base, "MISSING_CANONICAL_ID", "NO_CANONICAL_OR_SLEEPER_ID", "Repair ranking identity with an exact canonical or Sleeper identifier.");
}

function classificationForMatchedRow(
  row: H10LeagueValueRow,
  fallback: WarRoomMatchClassification,
  input: { rosterRequirements?: NormalizedRosterRequirements; includeDstDryRun: boolean; includeAllPositions: boolean }
): WarRoomMatchClassification {
  return input.rosterRequirements && isFormatExcluded(row, input.rosterRequirements, input.includeDstDryRun, input.includeAllPositions)
    ? "MATCHED_BUT_FORMAT_EXCLUDED"
    : fallback;
}

function compatibilityCheck(player: DraftTargetScorePlayer, row: H10LeagueValueRow): { rejectionReason: string | null; reasonCodes: string[] } {
  const playerPosition = normalizePosition(player.position);
  const rowPosition = normalizePosition(row.positionGroup || row.position);
  if (isIdpPosition(playerPosition) || isIdpPosition(rowPosition)) {
    const compatibility = getIdpPositionCompatibility(playerPosition, rowPosition);
    if (!compatibility.compatible) return { rejectionReason: compatibility.rejectionReason ?? "IDP_POSITION_MISMATCH_REJECTED", reasonCodes: [] };
    return { rejectionReason: null, reasonCodes: compatibility.reasonCodes };
  }
  if (playerPosition && rowPosition && normalizedComparablePosition(playerPosition) !== normalizedComparablePosition(rowPosition)) return { rejectionReason: "POSITION_MISMATCH_REJECTED", reasonCodes: [] };
  if (row.entityType === "TEAM_DEFENSE") return { rejectionReason: null, reasonCodes: [] };
  const playerTeam = normalizeTeam(player.team);
  const rowTeam = normalizeTeam(row.team);
  if (playerTeam && rowTeam && playerTeam !== rowTeam) return { rejectionReason: "TEAM_MISMATCH_REJECTED", reasonCodes: [] };
  return { rejectionReason: null, reasonCodes: [] };
}

function isFormatExcluded(row: H10LeagueValueRow, requirements: NormalizedRosterRequirements, includeDstDryRun: boolean, includeAllPositions: boolean): boolean {
  if (includeAllPositions) return false;
  const position = normalizePosition(row.positionGroup);
  if (IDP_POSITIONS.has(position)) return !requirements.hasIDP;
  if (position === "K") return !requirements.hasKicker;
  if (position === "DST") return !requirements.hasTeamDefense || !includeDstDryRun;
  return false;
}

function summarize(leagueId: string, rows: WarRoomMatchingCoverageRow[]): WarRoomMatchingCoverageSummary {
  const matchedRows = rows.filter((row) => isMatchedClassification(row.classification));
  const unmatchedRows = rows.filter((row) => !isMatchedClassification(row.classification));
  const missingRows = rows.filter((row) => !isMatchedClassification(row.classification));
  return {
    leagueId,
    rowsLoaded: rows.length,
    rowsMatched: matchedRows.length,
    rowsUnmatched: unmatchedRows.length,
    matchRate: rate(matchedRows.length, rows.length),
    matchRateByPosition: rateGroups(rows, (row) => normalizePosition(row.position) || "UNK"),
    matchRateBySource: rateGroups(rows, (row) => sourceKey(row)),
    missingProjectionCount: rows.filter((row) => !isMatchedClassification(row.classification)).length,
    formatExcludedCount: rows.filter((row) => row.classification === "MATCHED_BUT_FORMAT_EXCLUDED").length,
    lowConfidenceCount: rows.filter((row) => row.classification === "LOW_CONFIDENCE_MATCH").length,
    classificationCounts: countBy(rows.map((row) => row.classification)),
    missingProjectionReasons: countBy(rows.map((row) => row.missingReason).filter((reason): reason is string => Boolean(reason))),
    topMissingHighRankPlayers: highRankMissing(missingRows),
    topMissingHighAdpPlayers: highAdpMissing(missingRows),
    highPriorityMissingProjectionExamples: highPriorityMissing(missingRows),
  };
}

function rateGroups(rows: WarRoomMatchingCoverageRow[], keyFor: (row: WarRoomMatchingCoverageRow) => string) {
  const groups = new Map<string, WarRoomMatchingCoverageRow[]>();
  for (const row of rows) {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, groupRows]) => {
      const matched = groupRows.filter((row) => isMatchedClassification(row.classification)).length;
      return [key, { rows: groupRows.length, matched, unmatched: groupRows.length - matched, matchRate: rate(matched, groupRows.length) }];
    })
  );
}

function highPriorityMissing(rows: WarRoomMatchingCoverageRow[]): WarRoomMatchingCoverageRow[] {
  return [...rows]
    .sort((a, b) => priorityScore(b) - priorityScore(a) || (a.player_name ?? "").localeCompare(b.player_name ?? ""))
    .slice(0, 15);
}

function highRankMissing(rows: WarRoomMatchingCoverageRow[]): WarRoomMatchingCoverageRow[] {
  return [...rows].filter((row) => row.rank !== null).sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999)).slice(0, 15);
}

function highAdpMissing(rows: WarRoomMatchingCoverageRow[]): WarRoomMatchingCoverageRow[] {
  return [...rows].filter((row) => row.adp !== null).sort((a, b) => (a.adp ?? 99999) - (b.adp ?? 99999)).slice(0, 15);
}

function priorityScore(row: WarRoomMatchingCoverageRow): number {
  let score = 0;
  if (row.rank !== null) score += Math.max(0, 200 - row.rank) * 2;
  if (row.adp !== null) score += Math.max(0, 250 - row.adp);
  if (row.projected_points !== null) score += 80;
  if (["QB", "RB", "WR", "TE", "DL", "LB", "DB"].includes(normalizePosition(row.position))) score += 40;
  if (row.is_fallback) score -= 80;
  return score;
}

function matched(
  base: WarRoomMatchingCoverageRow,
  classification: WarRoomMatchClassification,
  entityId: string,
  matchedBy: WarRoomMatchingCoverageRow["matchedBy"],
  candidates: WarRoomCanonicalCandidate[] = [],
  reasonCodes: string[] = []
): WarRoomMatchingCoverageRow {
  return {
    ...base,
    classification,
    matchedEntityId: entityId,
    matchedBy,
    missingReason: null,
    reasonCodes,
    candidate_canonical_players: candidates,
    recommended_fix: classification === "MATCHED_BUT_FORMAT_EXCLUDED" ? "No identity repair needed; league format excludes this row." : "No repair needed.",
  };
}

function missing(
  base: WarRoomMatchingCoverageRow,
  classification: WarRoomMatchClassification,
  reason: string,
  fix: string
): WarRoomMatchingCoverageRow {
  return {
    ...base,
    classification,
    matchedEntityId: null,
    matchedBy: null,
    missingReason: reason,
    reasonCodes: [],
    candidate_canonical_players: [],
    recommended_fix: fix,
  };
}

function baseRow(player: DraftTargetScorePlayer): WarRoomMatchingCoverageRow {
  return {
    player_name: player.player_name,
    position: player.position,
    team: player.team,
    rank: player.rank,
    adp: player.adp,
    projected_points: player.projected_points,
    sleeper_player_id: player.sleeper_player_id,
    matched_player_id: player.matched_player_id,
    match_status: player.match_status,
    match_confidence: player.match_confidence,
    is_ranked: player.is_ranked,
    is_fallback: player.is_fallback,
    classification: "MISSING_CANONICAL_ID",
    matchedEntityId: null,
    matchedBy: null,
    missingReason: null,
    reasonCodes: [],
    candidate_canonical_players: [],
    recommended_fix: "",
  };
}

function candidatesForSleeper(
  sleeperId: string | null,
  input: { sleeperToCanonicalId: Record<string, string>; sleeperCanonicalCandidates: Record<string, WarRoomCanonicalCandidate[]> }
): WarRoomCanonicalCandidate[] {
  if (!sleeperId) return [];
  const candidates = input.sleeperCanonicalCandidates[sleeperId] ?? [];
  if (candidates.length > 0) return candidates;
  const id = input.sleeperToCanonicalId[sleeperId];
  return id ? [{ id, sleeper_player_id: sleeperId }] : [];
}

function isAmbiguous(player: DraftTargetScorePlayer): boolean {
  return (player.match_status ?? "").toLowerCase() === "ambiguous";
}

function isMatchedClassification(classification: WarRoomMatchClassification): boolean {
  return MATCHED_CLASSIFICATIONS.has(classification);
}

function sourceKey(row: WarRoomMatchingCoverageRow): string {
  if (row.is_fallback) return "fallback";
  if (row.is_ranked) return `ranked:${row.match_status ?? "unknown"}`;
  return "unknown";
}

function isDefensePosition(position: string): boolean {
  return position === "DST" || position === "DEF";
}

function normalizedComparablePosition(position: string): string {
  return position === "DST" ? "DEF" : position;
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "D/ST") return "DST";
  return normalized;
}

function normalizeTeam(team: string | null | undefined): string {
  return (team ?? "").trim().toUpperCase();
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function buildNamePositionTeamIndex(rows: H10LeagueValueRow[]): Map<string, H10LeagueValueRow[]> {
  const index = new Map<string, H10LeagueValueRow[]>();
  for (const row of rows) {
    for (const key of namePositionTeamKeys(row.displayName, row.positionGroup || row.position, row.team)) {
      index.set(key, [...(index.get(key) ?? []), row]);
    }
  }
  return index;
}

function findNamePositionTeamMatch(
  player: DraftTargetScorePlayer,
  index: Map<string, H10LeagueValueRow[]>
): { status: "matched"; row: H10LeagueValueRow } | { status: "ambiguous" | "missing" } {
  for (const key of namePositionTeamKeys(player.player_name, player.position, player.team)) {
    const matches = index.get(key) ?? [];
    if (matches.length === 1) return { status: "matched", row: matches[0] };
    if (matches.length > 1) return { status: "ambiguous" };
  }
  return { status: "missing" };
}

function namePositionTeamKeys(name: string | null | undefined, position: string | null | undefined, team: string | null | undefined): string[] {
  const normalizedName = normalizePlayerName(name ?? "");
  const normalizedPrimaryPosition = normalizePrimaryPosition(position);
  const normalizedPosition = normalizedPrimaryPosition === "DEF" ? "DST" : normalizedPrimaryPosition;
  if (!normalizedName || !normalizedPosition) return [];
  const normalizedTeam = normalizeTeam(team);
  return normalizedTeam ? [`${normalizedName}|${normalizedPosition}|${normalizedTeam}`] : [];
}
