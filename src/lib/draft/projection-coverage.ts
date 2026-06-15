import type { BlackbirdBoardRow } from "@/lib/draft/blackbird-board";
import { normalizeDraftBoardPosition, type DraftBoardDisplayPosition } from "@/lib/draft/draft-board-display";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

export type CoveragePosition = Exclude<DraftBoardDisplayPosition, "UNK">;

export type ProjectionCoverageVerdict = "passed" | "failed";

export type ProjectionCoverageAudit = {
  draftRoomId: string;
  leagueId: string;
  scoringFingerprint: string;
  rosterPositions: string[];
  enabledPositions: CoveragePosition[];
  projectionRunIdsUsed: string[];
  totalProjectionRows: number;
  projectionRowsByPosition: Record<string, number>;
  availablePlayersByPosition: Record<string, number>;
  boardRowsByPosition: Record<string, number>;
  recommendationRowsByPosition: Record<string, number>;
  missingProjectionPositions: CoveragePosition[];
  excludedPositionsWithReason: Array<{ position: CoveragePosition; reason: string }>;
  suspiciousLowProjectionCount: number;
  suspiciousSinglePositionOnly: boolean;
  providerCountDistribution: Record<string, number>;
  failureReasons: string[];
  verdict: ProjectionCoverageVerdict;
};

export type CoveragePlayerLike = {
  position?: string | null;
  projected_points?: number | null;
};

export type CoverageRecommendationLike = {
  position?: string | null;
};

export function buildProjectionCoverageAudit(input: {
  draftRoomId: string;
  leagueId: string;
  scoringSettings?: Record<string, unknown> | null;
  rosterPositions: string[];
  rosterRequirements: NormalizedRosterRequirements;
  projectionRows: H10LeagueValueRow[];
  availablePlayers: CoveragePlayerLike[];
  boardRows: BlackbirdBoardRow[];
  recommendationRows?: CoverageRecommendationLike[];
}): ProjectionCoverageAudit {
  const enabledPositions = getEnabledPositions(input.rosterRequirements);
  const relevantProjectionRows = input.projectionRows.filter((row) => row.leagueId === input.leagueId);
  const projectionRowsByPosition = countRows(relevantProjectionRows.map((row) => row.position));
  const availablePlayersByPosition = countRows(input.availablePlayers.map((player) => player.position));
  const boardRowsByPosition = countRows(input.boardRows.map((row) => row.position));
  const recommendationRowsByPosition = countRows((input.recommendationRows ?? []).map((row) => row.position));
  const missingProjectionPositions = enabledPositions.filter((position) => (projectionRowsByPosition[position] ?? 0) === 0);
  const excludedPositionsWithReason = getAllCoveragePositions()
    .filter((position) => !enabledPositions.includes(position))
    .map((position) => ({ position, reason: exclusionReason(position, input.rosterRequirements) }));
  const suspiciousLowProjectionCount = countSuspiciousLowOffense(input.boardRows);
  const presentBoardPositions = enabledPositions.filter((position) => (boardRowsByPosition[position] ?? 0) > 0);
  const suspiciousSinglePositionOnly = enabledPositions.length > 1 && presentBoardPositions.length <= 1 && input.boardRows.length > 0;
  const providerCountDistribution = countProviderCounts(relevantProjectionRows);
  const failureReasons = [
    suspiciousSinglePositionOnly ? "board rows collapse to one enabled position" : null,
    missingProjectionPositions.some((position) => ["QB", "RB", "WR", "TE"].includes(position))
      ? "normal offensive positions have no joinable projections"
      : null,
    suspiciousLowProjectionCount >= Math.max(3, Math.ceil(input.boardRows.length * 0.2))
      ? "offensive board projections are suspiciously low"
      : null,
    enabledPositions.some((position) => (availablePlayersByPosition[position] ?? 0) > 0 && (boardRowsByPosition[position] ?? 0) === 0)
      ? "available players exist for enabled positions but no board rows joined"
      : null,
    enabledPositions.some((position) => (availablePlayersByPosition[position] ?? 0) > 0 && (projectionRowsByPosition[position] ?? 0) === 0)
      ? "available players exist for enabled positions but projections are unavailable"
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    draftRoomId: input.draftRoomId,
    leagueId: input.leagueId,
    scoringFingerprint: buildScoringFingerprint(input.scoringSettings, input.rosterPositions),
    rosterPositions: input.rosterPositions,
    enabledPositions,
    projectionRunIdsUsed: Array.from(
      new Set(relevantProjectionRows.map((row) => optionalString(row, "projectionRunId")).filter((id): id is string => Boolean(id)))
    ).sort(),
    totalProjectionRows: relevantProjectionRows.length,
    projectionRowsByPosition,
    availablePlayersByPosition,
    boardRowsByPosition,
    recommendationRowsByPosition,
    missingProjectionPositions,
    excludedPositionsWithReason,
    suspiciousLowProjectionCount,
    suspiciousSinglePositionOnly,
    providerCountDistribution,
    failureReasons,
    verdict: failureReasons.length ? "failed" : "passed",
  };
}

export function getEnabledPositions(requirements: NormalizedRosterRequirements): CoveragePosition[] {
  const enabled = new Set<CoveragePosition>();
  for (const position of getAllCoveragePositions()) {
    const internal = position === "DST" ? "DEF" : position;
    if (requirements.directStarters[internal] > 0) enabled.add(position);
  }
  if (requirements.offensiveFlexCount > 0) ["RB", "WR", "TE"].forEach((position) => enabled.add(position as CoveragePosition));
  if (requirements.superflexCount > 0) ["QB", "RB", "WR", "TE"].forEach((position) => enabled.add(position as CoveragePosition));
  if (requirements.idpFlexCount > 0) ["DL", "LB", "DB"].forEach((position) => enabled.add(position as CoveragePosition));
  return getAllCoveragePositions().filter((position) => enabled.has(position));
}

function countRows(positions: Array<string | null | undefined>): Record<string, number> {
  return positions.reduce<Record<string, number>>((acc, position) => {
    const normalized = normalizeDraftBoardPosition(position);
    if (normalized !== "UNK") acc[normalized] = (acc[normalized] ?? 0) + 1;
    return acc;
  }, {});
}

function countSuspiciousLowOffense(rows: BlackbirdBoardRow[]): number {
  return rows.filter((row) => {
    const position = normalizeDraftBoardPosition(row.position);
    return ["QB", "RB", "WR", "TE"].includes(position) && row.projectionPoints !== null && row.projectionPoints > 0 && row.projectionPoints < 10;
  }).length;
}

function countProviderCounts(rows: H10LeagueValueRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const count = String(optionalNumber(row, "providerCount") ?? 0);
    acc[count] = (acc[count] ?? 0) + 1;
    return acc;
  }, {});
}

function optionalString(row: H10LeagueValueRow, key: string): string | null {
  const value = (row as H10LeagueValueRow & Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function optionalNumber(row: H10LeagueValueRow, key: string): number | null {
  const value = (row as H10LeagueValueRow & Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildScoringFingerprint(scoringSettings: Record<string, unknown> | null | undefined, rosterPositions: string[]): string {
  const payload = stableStringify({ scoringSettings: scoringSettings ?? {}, rosterPositions });
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function exclusionReason(position: CoveragePosition, requirements: NormalizedRosterRequirements): string {
  if (position === "DST") return requirements.hasTeamDefense ? "covered by team defense slot" : "team defense is not enabled by roster settings";
  if (position === "K") return requirements.hasKicker ? "covered by kicker slot" : "kicker is not enabled by roster settings";
  if (["DL", "LB", "DB"].includes(position)) return requirements.hasIDP ? "covered by IDP settings" : "IDP is not enabled by roster settings";
  return "offensive position is not enabled by direct starter, flex, or superflex roster settings";
}

function getAllCoveragePositions(): CoveragePosition[] {
  return ["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"];
}
