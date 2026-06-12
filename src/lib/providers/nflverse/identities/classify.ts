import type { CanonicalPlayerInfo, NflversePlayerInfo, UnresolvedRootCause } from "./types";

const FANTASY_POSITION_GROUPS = new Set(["QB", "RB", "WR", "TE"]);

// Standard GSIS IDs start with "00-" followed by 7 digits.
// Legacy alphanumeric IDs (e.g. "ALL637395") are valid but rare.
const STANDARD_GSIS_PATTERN = /^00-\d{7}$/;
const LEGACY_GSIS_PATTERN = /^[A-Z]{3}\d{6}$/;

export function isLegacyGsisId(gsisId: string): boolean {
  return LEGACY_GSIS_PATTERN.test(gsisId) && !STANDARD_GSIS_PATTERN.test(gsisId);
}

export function isPositionCompatible(
  nflverseGroup: string | null,
  canonicalGroup: string | null
): boolean {
  if (!nflverseGroup || !canonicalGroup) return true;
  return nflverseGroup === canonicalGroup;
}

// Classify the root cause for a single unresolved 2025 GSIS ID.
// All inputs are pre-computed; no DB calls happen here.
export function classifyRootCause(params: {
  nflversePlayer: Pick<NflversePlayerInfo, "gsisId" | "espnId" | "positionGroup">;
  allNameCandidates: CanonicalPlayerInfo[];    // all canonical players matching normalized name
  positionCompatibleCandidates: CanonicalPlayerInfo[]; // subset compatible with nflverse position
  hasExistingMapping: boolean;
}): UnresolvedRootCause {
  const { nflversePlayer, allNameCandidates, positionCompatibleCandidates, hasExistingMapping } = params;

  // Legacy or known-duplicate GSIS formats are a distinct category
  if (isLegacyGsisId(nflversePlayer.gsisId)) {
    return "legacy_or_duplicate_source_identity";
  }

  // An existing player_external_ids row exists for a DIFFERENT player — conflict
  if (hasExistingMapping) {
    return "conflicting_external_mapping";
  }

  // No canonical player found by name at all
  if (allNameCandidates.length === 0) {
    return "canonical_player_missing";
  }

  // Name candidates found but ALL have incompatible positions
  if (allNameCandidates.length > 0 && positionCompatibleCandidates.length === 0) {
    return "position_mismatch";
  }

  // Multiple position-compatible candidates — ambiguous, needs manual review
  if (positionCompatibleCandidates.length > 1) {
    return "duplicate_canonical_candidate";
  }

  // Exactly one position-compatible candidate from here on
  const candidate = positionCompatibleCandidates[0];

  // Candidate has a gsis_id in metadata but it doesn't match our source ID
  if (candidate.metaGsisId && candidate.metaGsisId !== nflversePlayer.gsisId) {
    return "identifier_format_mismatch";
  }

  // Candidate has no gsis_id in metadata — this is the most recoverable case
  if (!candidate.metaGsisId) {
    return "canonical_gsis_missing";
  }

  // Candidate has no espn_id and nflverse has one
  if (!candidate.metaEspnId && nflversePlayer.espnId) {
    return "canonical_espn_missing";
  }

  // nflverse player has no usable identifier
  if (!nflversePlayer.espnId) {
    return "source_identifier_missing";
  }

  return "unknown";
}

// Determine whether a root cause is recoverable through trusted metadata repair.
export function isRepairableViaGsisId(
  rootCause: UnresolvedRootCause
): boolean {
  return rootCause === "canonical_gsis_missing";
}

export function isRepairableViaEspnId(
  rootCause: UnresolvedRootCause,
  nflverseEspnId: string | null
): boolean {
  return rootCause === "canonical_espn_missing" && nflverseEspnId !== null;
}

// Quick summary — which root causes can be automatically repaired.
export const REPAIRABLE_ROOT_CAUSES = new Set<UnresolvedRootCause>([
  "canonical_gsis_missing",
  "canonical_espn_missing"
]);

export { FANTASY_POSITION_GROUPS };
