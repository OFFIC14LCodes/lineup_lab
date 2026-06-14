// H8: Contradiction detection and resolution.
// All evidence is preserved. Contradictions are recorded, not deleted.
// Resolution prefers: higher reliability tier, then recency.

import { evidencePriority, isStale } from "./evidence";
import type { ContradictionRecord, EvidenceRecord } from "./types";

// --------------------------------------------------------------------------
// Detect whether two evidence records contradict each other.
// Current heuristic: if both are active and their normalized claims differ
// materially, flag as contradiction. Callers handle semantic comparison.
// --------------------------------------------------------------------------

export type ContradictionCandidate = {
  evidenceA: EvidenceRecord;
  evidenceB: EvidenceRecord;
  fieldPath: string;
  reason: string;
};

// Compare two claim strings for contradiction.
// Simple heuristic: same field, different claim values for the same player/team.
// Callers should pass field-specific claim values, not raw full claims.
export function claimsContradict(claimA: string, claimB: string): boolean {
  const a = claimA.toLowerCase().trim();
  const b = claimB.toLowerCase().trim();
  if (a === b) return false;
  // Simple: both are non-empty and different → caller decides if this is a contradiction
  return a.length > 0 && b.length > 0;
}

// --------------------------------------------------------------------------
// Resolve a contradiction between two or more evidence records.
// Returns the winning record and the resolution method used.
// --------------------------------------------------------------------------

export type ContradictionResolution = {
  winner: EvidenceRecord;
  losers: EvidenceRecord[];
  method: "reliability_tier" | "recency" | "manual_override" | "unresolved";
  reason: string;
  manualReviewRequired: boolean;
};

export function resolveContradiction(
  records: EvidenceRecord[],
  asOf: Date = new Date()
): ContradictionResolution {
  const active = records.filter((r) => !isStale(r, asOf));
  const candidates = active.length > 0 ? active : records;

  if (candidates.length === 0) {
    throw new Error("Cannot resolve contradiction with no evidence records");
  }

  if (candidates.length === 1) {
    return {
      winner: candidates[0],
      losers: [],
      method: "reliability_tier",
      reason: "Only one active record",
      manualReviewRequired: false,
    };
  }

  // Sort by priority (tier * 1000 + recency minutes)
  const sorted = [...candidates].sort((a, b) => evidencePriority(b) - evidencePriority(a));
  const winner = sorted[0];
  const losers = sorted.slice(1);

  const winnerTier = winner.reliabilityTier;
  const runnerTier = sorted[1].reliabilityTier;

  if (winnerTier < runnerTier) {
    // Higher tier wins clearly
    return {
      winner,
      losers,
      method: "reliability_tier",
      reason: `Tier ${winnerTier} source outranks Tier ${runnerTier} source`,
      manualReviewRequired: false,
    };
  }

  if (winnerTier === runnerTier) {
    // Same tier — resolve by recency, but flag for review if both are recent
    const winnerDate = new Date(winner.publishedAt ?? winner.capturedAt);
    const runnerDate = new Date(sorted[1].publishedAt ?? sorted[1].capturedAt);
    const dayDiff = (winnerDate.getTime() - runnerDate.getTime()) / (1000 * 60 * 60 * 24);
    const manualReviewRequired = Math.abs(dayDiff) < 3; // Within 3 days → ambiguous

    return {
      winner,
      losers,
      method: "recency",
      reason: `Same-tier sources (Tier ${winnerTier}); winner is ${Math.abs(dayDiff).toFixed(0)} days more recent`,
      manualReviewRequired,
    };
  }

  return {
    winner,
    losers,
    method: "unresolved",
    reason: "Could not resolve contradiction automatically",
    manualReviewRequired: true,
  };
}

// --------------------------------------------------------------------------
// Build a ContradictionRecord from a resolution
// --------------------------------------------------------------------------

export function buildContradictionRecord(
  fieldPath: string,
  resolution: ContradictionResolution,
  allEvidence: EvidenceRecord[]
): ContradictionRecord {
  const supersededIds = allEvidence
    .filter((r) => r.evidenceId !== resolution.winner?.evidenceId)
    .map((r) => r.evidenceId);

  return {
    fieldPath,
    winningEvidenceId: resolution.winner?.evidenceId ?? null,
    supersededEvidenceIds: supersededIds,
    contradictionReason: resolution.reason,
    resolutionMethod: resolution.method,
    manualReviewRequired: resolution.manualReviewRequired,
    resolvedAt: resolution.method !== "unresolved" ? new Date().toISOString() : null,
  };
}

// --------------------------------------------------------------------------
// Detect role contradictions from claim sets
// Caller provides a map of fieldPath → { evidenceId, claimValue } pairs
// --------------------------------------------------------------------------

export type ClaimSet = {
  evidenceId: string;
  fieldPath: string;
  claimValue: string;
  reliabilityTier: number;
  publishedAt: string | null;
};

export function detectRoleContradictions(claims: ClaimSet[]): Array<{
  fieldPath: string;
  claimA: ClaimSet;
  claimB: ClaimSet;
}> {
  const contradictions: Array<{ fieldPath: string; claimA: ClaimSet; claimB: ClaimSet }> = [];

  // Group by fieldPath
  const byField = new Map<string, ClaimSet[]>();
  for (const claim of claims) {
    if (!byField.has(claim.fieldPath)) byField.set(claim.fieldPath, []);
    byField.get(claim.fieldPath)!.push(claim);
  }

  for (const [fieldPath, fieldClaims] of byField) {
    if (fieldClaims.length < 2) continue;
    const uniqueValues = new Set(fieldClaims.map((c) => c.claimValue.toLowerCase().trim()));
    if (uniqueValues.size > 1) {
      // Found different claims for same field
      const [a, b] = fieldClaims;
      contradictions.push({ fieldPath, claimA: a, claimB: b });
    }
  }

  return contradictions;
}

// --------------------------------------------------------------------------
// Determine if a field needs manual review
// --------------------------------------------------------------------------

export function requiresManualReview(opts: {
  contradictionCount: number;
  hasLowConfidenceOnly: boolean;
  hasUnresolved: boolean;
  sameTierContradiction: boolean;
}): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (opts.contradictionCount >= 2) reasons.push("multiple contradictions");
  if (opts.hasLowConfidenceOnly) reasons.push("only low-confidence evidence");
  if (opts.hasUnresolved) reasons.push("evidence conflict unresolved");
  if (opts.sameTierContradiction) reasons.push("same-tier sources disagree");
  return { required: reasons.length > 0, reasons };
}
