// H8: Confidence computation for context fields and snapshots.
// Confidence is separate from whether the context is favorable or unfavorable.
// Multiple confirming sources raise confidence; contradictions lower it.

import { isStale, tierToConfidence } from "./evidence";
import type {
  ContextConfidence,
  ContextFieldStatus,
  ContextFieldValue,
  EvidenceRecord,
} from "./types";

// --------------------------------------------------------------------------
// Confidence label from numeric score
// --------------------------------------------------------------------------

export function scoreToConfidence(score: number): ContextConfidence {
  if (score >= 0.92) return "verified";
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "moderate";
  if (score >= 0.30) return "low";
  return "unresolved";
}

// --------------------------------------------------------------------------
// Recency decay weight (exponential, half-life 30 days)
// --------------------------------------------------------------------------

export function recencyDecayWeight(publishedAt: string | null, capturedAt: string, asOf: Date): number {
  const anchor = publishedAt ?? capturedAt;
  const diffMs = asOf.getTime() - new Date(anchor).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 1.0;
  const halfLifeDays = 30;
  return Math.exp(-0.693 * diffDays / halfLifeDays);
}

// --------------------------------------------------------------------------
// Compute field confidence from its supporting evidence records
//
// Factors:
//   - Source reliability tier (1–4 → 1.0–0.4)
//   - Recency decay (exponential, 30-day half-life)
//   - Source count (more sources → higher confidence, diminishing returns)
//   - Source agreement (disagreement lowers confidence)
//   - Directness (isObserved vs inferred)
//   - Contradiction count (each lowers by 0.12)
// --------------------------------------------------------------------------

export function computeFieldConfidence(
  evidenceRecords: EvidenceRecord[],
  contradictionCount: number,
  asOf: Date = new Date()
): ContextConfidence {
  if (evidenceRecords.length === 0) return "unresolved";

  // Filter to non-stale records for confidence calculation
  const active = evidenceRecords.filter((r) => !isStale(r, asOf));
  if (active.length === 0) return "unresolved";

  // Weighted score per record
  const weightedScores = active.map((r) => {
    const tierScore = tierToConfidence(r.reliabilityTier);
    const recencyScore = recencyDecayWeight(r.publishedAt, r.capturedAt, asOf);
    const directnessMultiplier = r.isObserved ? 1.0 : 0.75;
    return tierScore * recencyScore * directnessMultiplier;
  });

  // Base score: weighted average
  const total = weightedScores.reduce((s, w) => s + w, 0);
  let baseScore = total / active.length;

  // Source diversity bonus: log-scale, max +0.10
  const uniqueSources = new Set(active.map((r) => r.sourceName ?? r.sourceIdentifier ?? r.evidenceId)).size;
  const diversityBonus = Math.min(0.10, Math.log(uniqueSources) * 0.05);
  baseScore = Math.min(1.0, baseScore + diversityBonus);

  // Agreement multiplier: if best tier differs from majority → partial penalty
  const tierCounts = active.reduce<Record<number, number>>((acc, r) => {
    acc[r.reliabilityTier] = (acc[r.reliabilityTier] ?? 0) + 1;
    return acc;
  }, {});
  const highTierCount = (tierCounts[1] ?? 0) + (tierCounts[2] ?? 0);
  const agreementMultiplier = active.length > 1 && highTierCount === 0 ? 0.85 : 1.0;
  baseScore *= agreementMultiplier;

  // Contradiction penalty
  const contPenalty = Math.min(0.48, contradictionCount * 0.12);
  baseScore = Math.max(0, baseScore - contPenalty);

  return scoreToConfidence(Math.round(baseScore * 1000) / 1000);
}

// --------------------------------------------------------------------------
// Determine field status from evidence records
// --------------------------------------------------------------------------

export function computeFieldStatus(
  evidenceRecords: EvidenceRecord[],
  contradictionCount: number,
  asOf: Date = new Date()
): ContextFieldStatus {
  if (evidenceRecords.length === 0) return "unknown";
  if (contradictionCount > 0) return "contradicted";

  const allStale = evidenceRecords.every((r) => isStale(r, asOf));
  if (allStale) return "stale";

  // If any observed record present → observed
  const hasObserved = evidenceRecords.some((r) => r.isObserved && !isStale(r, asOf));
  if (hasObserved) return "observed";

  return "inferred";
}

// --------------------------------------------------------------------------
// Compute overall snapshot confidence from all fields
// --------------------------------------------------------------------------

type FieldSummary = {
  confidence: ContextConfidence;
  status: ContextFieldStatus;
};

export function computeOverallConfidence(fields: FieldSummary[]): ContextConfidence {
  if (fields.length === 0) return "unresolved";

  const scoreMap: Record<ContextConfidence, number> = {
    verified: 1.0,
    high: 0.85,
    moderate: 0.6,
    low: 0.35,
    unresolved: 0.0,
  };

  const unresolvedCount = fields.filter((f) => f.status === "unknown" || f.confidence === "unresolved").length;
  const contradictedCount = fields.filter((f) => f.status === "contradicted").length;
  const staleCount = fields.filter((f) => f.status === "stale").length;

  const scores = fields
    .filter((f) => f.confidence !== "unresolved")
    .map((f) => scoreMap[f.confidence]);

  if (scores.length === 0) return "unresolved";

  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;

  // Penalty for unknown / contradicted / stale ratio
  const problemRatio = (unresolvedCount + contradictedCount * 1.5 + staleCount * 0.5) / fields.length;
  const adjusted = Math.max(0, avg * (1 - problemRatio * 0.4));

  return scoreToConfidence(Math.round(adjusted * 1000) / 1000);
}

// --------------------------------------------------------------------------
// Count stale and unresolved fields in a snapshot
// --------------------------------------------------------------------------

export function countFieldProblems(
  fields: Array<Pick<ContextFieldValue<unknown>, "status">>,
  asOf: Date = new Date()
): { staleCount: number; unresolvedCount: number } {
  void asOf; // used by caller's field status computation
  let staleCount = 0;
  let unresolvedCount = 0;
  for (const f of fields) {
    if (f.status === "stale") staleCount++;
    if (f.status === "unknown") unresolvedCount++;
  }
  return { staleCount, unresolvedCount };
}
