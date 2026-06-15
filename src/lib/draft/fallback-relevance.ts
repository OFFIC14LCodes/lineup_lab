import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

export type FallbackRelevanceLevel =
  | "DRAFT_RELEVANT"
  | "DIAGNOSTIC_FALLBACK"
  | "HISTORICAL_ONLY"
  | "PROJECTIONLESS_FALLBACK"
  | "FORMAT_EXCLUDED";

export type FallbackExcludedExample = {
  player_name: string | null;
  position: string | null;
  team: string | null;
  reasonExcluded: FallbackRelevanceLevel;
  rank: number | null;
  adp: number | null;
  hasH10Value: boolean;
  isFallback: boolean;
};

export type FallbackRelevanceRow = {
  player: DraftTargetScorePlayer;
  relevance: FallbackRelevanceLevel;
  hasH10Value: boolean;
  isRosterRelevant: boolean;
  included: boolean;
};

export type FallbackRelevanceDiagnostics = {
  fallbackRowsTotal: number;
  fallbackRowsIncluded: number;
  fallbackRowsExcluded: number;
  fallbackRelevanceDistribution: Record<string, number>;
  projectionlessFallbackRows: number;
  historicalOnlyRows: number;
  diagnosticFallbackRows: number;
  draftRelevantFallbackRows: number;
  formatExcludedFallbackRows: number;
  includeDiagnosticFallbacks: boolean;
  topExcludedFallbackExamples: FallbackExcludedExample[];
};

export type FilterFallbackPlayersInput = {
  players: DraftTargetScorePlayer[];
  valueRows: H10LeagueValueRow[];
  leagueId: string;
  rosterRequirements: NormalizedRosterRequirements;
  includeDiagnosticFallbacks?: boolean;
};

const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const OFFENSIVE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

export function filterFallbackPlayers(input: FilterFallbackPlayersInput): {
  players: DraftTargetScorePlayer[];
  rows: FallbackRelevanceRow[];
  diagnostics: FallbackRelevanceDiagnostics;
} {
  const valueEntityIds = new Set(input.valueRows.filter((row) => row.leagueId === input.leagueId).map((row) => row.entityId));
  const rows = input.players.map((player) => {
    const hasH10Value = Boolean(player.matched_player_id && valueEntityIds.has(player.matched_player_id));
    const isRosterRelevant = isPositionRosterRelevant(player.position, input.rosterRequirements);
    const relevance = classifyFallbackPlayer(player, hasH10Value, isRosterRelevant);
    const included = shouldInclude(relevance, Boolean(input.includeDiagnosticFallbacks));
    return { player, relevance, hasH10Value, isRosterRelevant, included };
  });
  const players = rows.filter((row) => row.included).map((row) => row.player);
  return { players, rows, diagnostics: diagnosticsFor(rows, Boolean(input.includeDiagnosticFallbacks)) };
}

export function classifyFallbackPlayer(
  player: DraftTargetScorePlayer,
  hasH10Value: boolean,
  isRosterRelevant: boolean
): FallbackRelevanceLevel {
  if (!isRosterRelevant) return "FORMAT_EXCLUDED";
  if (player.rank !== null || player.adp !== null || hasH10Value) return "DRAFT_RELEVANT";
  if (player.matched_player_id) return "PROJECTIONLESS_FALLBACK";
  if (player.sleeper_player_id) return "DIAGNOSTIC_FALLBACK";
  return "HISTORICAL_ONLY";
}

function shouldInclude(relevance: FallbackRelevanceLevel, includeDiagnosticFallbacks: boolean): boolean {
  if (relevance === "DRAFT_RELEVANT") return true;
  if (relevance === "FORMAT_EXCLUDED") return false;
  return includeDiagnosticFallbacks;
}

function diagnosticsFor(rows: FallbackRelevanceRow[], includeDiagnosticFallbacks: boolean): FallbackRelevanceDiagnostics {
  const excluded = rows.filter((row) => !row.included);
  return {
    fallbackRowsTotal: rows.length,
    fallbackRowsIncluded: rows.filter((row) => row.included).length,
    fallbackRowsExcluded: excluded.length,
    fallbackRelevanceDistribution: countBy(rows.map((row) => row.relevance)),
    projectionlessFallbackRows: rows.filter((row) => row.relevance === "PROJECTIONLESS_FALLBACK").length,
    historicalOnlyRows: rows.filter((row) => row.relevance === "HISTORICAL_ONLY").length,
    diagnosticFallbackRows: rows.filter((row) => row.relevance === "DIAGNOSTIC_FALLBACK").length,
    draftRelevantFallbackRows: rows.filter((row) => row.relevance === "DRAFT_RELEVANT").length,
    formatExcludedFallbackRows: rows.filter((row) => row.relevance === "FORMAT_EXCLUDED").length,
    includeDiagnosticFallbacks,
    topExcludedFallbackExamples: excluded.slice(0, 15).map((row) => ({
      player_name: row.player.player_name,
      position: row.player.position,
      team: row.player.team,
      reasonExcluded: row.relevance,
      rank: row.player.rank,
      adp: row.player.adp,
      hasH10Value: row.hasH10Value,
      isFallback: row.player.is_fallback,
    })),
  };
}

function isPositionRosterRelevant(position: string | null, requirements: NormalizedRosterRequirements): boolean {
  const normalized = normalizePosition(position);
  if (!normalized) return false;
  if (OFFENSIVE_POSITIONS.has(normalized)) {
    return Boolean(requirements.directStarters[normalized as keyof NormalizedRosterRequirements["directStarters"]] ?? 0) ||
      (normalized === "QB" && requirements.superflexCount > 0) ||
      (["RB", "WR", "TE"].includes(normalized) && (requirements.offensiveFlexCount > 0 || requirements.superflexCount > 0));
  }
  if (IDP_POSITIONS.has(normalized)) return requirements.hasIDP;
  if (normalized === "K") return requirements.hasKicker;
  if (normalized === "DEF" || normalized === "DST") return requirements.hasTeamDefense;
  return false;
}

function normalizePosition(position: string | null): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "D/ST" || normalized === "DST") return "DEF";
  return normalized;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
