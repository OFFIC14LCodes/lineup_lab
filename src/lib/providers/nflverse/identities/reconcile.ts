import type { CanonicalPlayerInfo, ConfidenceTier, NflversePlayerInfo } from "./types";
import { buildEvidenceComparison } from "./evidence";
import { isPositionCompatible } from "./classify";

export type ReconcileTargetStatus =
  | "repairable"
  | "existing"
  | "conflict"
  | "unresolved";

export type ReconcileTargetReport = {
  gsisId: string;
  nflversePlayer: NflversePlayerInfo | null;
  candidateCount: number;
  canonicalPlayer: CanonicalPlayerInfo | null;
  evidenceTier: ConfidenceTier | null;
  approvalReason: string | null;
  existingMappingPlayerId: string | null;
  status: ReconcileTargetStatus;
  reason: string;
};

export function evaluateGsisReconciliationTarget(input: {
  gsisId: string;
  nflversePlayer: NflversePlayerInfo | null;
  allNameCandidates: CanonicalPlayerInfo[];
  existingMappingPlayerId: string | null;
}): ReconcileTargetReport {
  const { gsisId, nflversePlayer, allNameCandidates, existingMappingPlayerId } = input;

  if (!nflversePlayer) {
    return {
      gsisId,
      nflversePlayer: null,
      candidateCount: 0,
      canonicalPlayer: null,
      evidenceTier: null,
      approvalReason: null,
      existingMappingPlayerId,
      status: "unresolved",
      reason: "nflverse_player_missing"
    };
  }

  const compatibleCandidates = allNameCandidates.filter((candidate) =>
    isPositionCompatible(nflversePlayer.positionGroup, candidate.positionGroup)
  );

  if (compatibleCandidates.length === 0) {
    return {
      gsisId,
      nflversePlayer,
      candidateCount: 0,
      canonicalPlayer: null,
      evidenceTier: null,
      approvalReason: null,
      existingMappingPlayerId,
      status: "unresolved",
      reason: allNameCandidates.length === 0 ? "canonical_candidate_missing" : "position_mismatch"
    };
  }

  if (compatibleCandidates.length > 1) {
    return {
      gsisId,
      nflversePlayer,
      candidateCount: compatibleCandidates.length,
      canonicalPlayer: null,
      evidenceTier: null,
      approvalReason: null,
      existingMappingPlayerId,
      status: "unresolved",
      reason: "duplicate_canonical_candidates"
    };
  }

  const canonicalPlayer = compatibleCandidates[0]!;
  const evidence = buildEvidenceComparison(nflversePlayer, canonicalPlayer);

  if (existingMappingPlayerId && existingMappingPlayerId !== canonicalPlayer.playerId) {
    return {
      gsisId,
      nflversePlayer,
      candidateCount: 1,
      canonicalPlayer,
      evidenceTier: evidence.tier,
      approvalReason: evidence.approvalReason,
      existingMappingPlayerId,
      status: "conflict",
      reason: `existing_mapping_conflict:${existingMappingPlayerId}`
    };
  }

  if (canonicalPlayer.metaGsisId && canonicalPlayer.metaGsisId !== gsisId) {
    return {
      gsisId,
      nflversePlayer,
      candidateCount: 1,
      canonicalPlayer,
      evidenceTier: evidence.tier,
      approvalReason: evidence.approvalReason,
      existingMappingPlayerId,
      status: "conflict",
      reason: `canonical_gsis_conflict:${canonicalPlayer.metaGsisId}`
    };
  }

  if (evidence.tier !== "auto_approved") {
    return {
      gsisId,
      nflversePlayer,
      candidateCount: 1,
      canonicalPlayer,
      evidenceTier: evidence.tier,
      approvalReason: evidence.approvalReason,
      existingMappingPlayerId,
      status: "unresolved",
      reason: `evidence_not_auto_approved:${evidence.tier}`
    };
  }

  if (existingMappingPlayerId === canonicalPlayer.playerId && canonicalPlayer.metaGsisId === gsisId) {
    return {
      gsisId,
      nflversePlayer,
      candidateCount: 1,
      canonicalPlayer,
      evidenceTier: evidence.tier,
      approvalReason: evidence.approvalReason,
      existingMappingPlayerId,
      status: "existing",
      reason: "mapping_and_metadata_already_present"
    };
  }

  return {
    gsisId,
    nflversePlayer,
    candidateCount: 1,
    canonicalPlayer,
    evidenceTier: evidence.tier,
    approvalReason: evidence.approvalReason,
    existingMappingPlayerId,
    status: "repairable",
    reason: "auto_approved_unique_candidate"
  };
}
