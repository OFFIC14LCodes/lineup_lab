import { normalizePlayerName, normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import type { SourceMatchResult } from "./data-source-types";

export type AcquisitionIdentityCandidate = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
};

export type AcquisitionIdentityInput = {
  playerId?: string | null;
  playerName?: string | null;
  position?: string | null;
  team?: string | null;
};

export function matchAcquiredPlayer(input: AcquisitionIdentityInput, candidates: AcquisitionIdentityCandidate[]): SourceMatchResult {
  if (input.playerId) {
    const exact = candidates.filter((candidate) => candidate.playerId === input.playerId);
    if (exact.length === 1) return { playerId: exact[0].playerId, rowIndex: candidates.indexOf(exact[0]), matchStatus: "matched_player_id", unresolvedReason: null };
    if (exact.length > 1) return { playerId: null, rowIndex: null, matchStatus: "ambiguous", unresolvedReason: `ambiguous playerId ${input.playerId}` };
  }
  const name = normalizePlayerName(input.playerName ?? "");
  const position = normalizePrimaryPosition(input.position) ?? (input.position ?? "").toUpperCase();
  if (!name || !position) return { playerId: null, rowIndex: null, matchStatus: "unmatched", unresolvedReason: "missing playerName or position" };
  const team = normalizeTeam(input.team ?? null);
  const byNamePosition = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => normalizePlayerName(candidate.playerName) === name && (normalizePrimaryPosition(candidate.position) ?? candidate.position.toUpperCase()) === position);
  if (team) {
    const byTeam = byNamePosition.filter(({ candidate }) => normalizeTeam(candidate.team) === team);
    if (byTeam.length === 1) return { playerId: byTeam[0].candidate.playerId, rowIndex: byTeam[0].index, matchStatus: "matched_name_position_team", unresolvedReason: null };
    if (byTeam.length > 1) return { playerId: null, rowIndex: null, matchStatus: "ambiguous", unresolvedReason: `ambiguous name+position+team match for ${input.playerName}` };
  }
  if (byNamePosition.length === 1) return { playerId: byNamePosition[0].candidate.playerId, rowIndex: byNamePosition[0].index, matchStatus: "matched_name_position", unresolvedReason: null };
  if (byNamePosition.length > 1) return { playerId: null, rowIndex: null, matchStatus: "ambiguous", unresolvedReason: `ambiguous name+position match for ${input.playerName}` };
  return { playerId: null, rowIndex: null, matchStatus: "unmatched", unresolvedReason: "no canonical rookie row matched acquired identity" };
}
