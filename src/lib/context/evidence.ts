// H8: Evidence record creation, hashing, validation, and decay.
// Evidence records are immutable once created. The evidenceId is a deterministic
// hash of the source + claim, preventing duplicate ingestion.

import { createHash } from "node:crypto";

import type {
  EvidenceCategory,
  EvidenceRecord,
  ExpirationPolicy,
  ReliabilityTier,
  ReviewStatus,
} from "./types";

export const EVIDENCE_VERSION = "h8-evidence-v1";

// --------------------------------------------------------------------------
// Expiration windows by policy (in days; null = does not expire)
// --------------------------------------------------------------------------

const EXPIRATION_DAYS: Record<ExpirationPolicy, number | null> = {
  until_superseded: null,
  injury_report: 7,
  practice_report: 3,
  depth_chart: 21,
  coach_quote: 30,
  seasonal: 180,
  none: null,
};

const TIER_RELIABILITY_LABELS: Record<ReliabilityTier, string> = {
  1: "official",
  2: "direct_quote_or_credentialed",
  3: "established_analyst_or_aggregator",
  4: "secondary_or_unverified",
};

// --------------------------------------------------------------------------
// Compute expiration date for a given policy, anchored to effectiveDate
// --------------------------------------------------------------------------

export function computeExpiresAt(
  policy: ExpirationPolicy,
  effectiveDate: string | null,
  capturedAt: string
): string | null {
  const days = EXPIRATION_DAYS[policy];
  if (days === null) return null;
  const anchor = effectiveDate ?? capturedAt;
  const d = new Date(anchor);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// --------------------------------------------------------------------------
// Reliability tier → base confidence score (0–1)
// --------------------------------------------------------------------------

export function tierToConfidence(tier: ReliabilityTier): number {
  const scores: Record<ReliabilityTier, number> = { 1: 1.0, 2: 0.85, 3: 0.65, 4: 0.4 };
  return scores[tier];
}

export function reliabilityLabel(tier: ReliabilityTier): string {
  return TIER_RELIABILITY_LABELS[tier];
}

// --------------------------------------------------------------------------
// Deterministic evidence ID
// The evidenceId must be stable across re-ingestion of the same claim.
// --------------------------------------------------------------------------

export function computeEvidenceId(opts: {
  sourceName: string | null;
  sourceUrl: string | null;
  sourceIdentifier: string | null;
  normalizedClaim: string;
  effectiveDate: string | null;
  playerId: string | null;
  teamId: string | null;
}): string {
  const parts = [
    opts.sourceName ?? "",
    opts.sourceUrl ?? opts.sourceIdentifier ?? "",
    opts.normalizedClaim,
    opts.effectiveDate ?? "",
    opts.playerId ?? "",
    opts.teamId ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

// --------------------------------------------------------------------------
// Source hash for deduplication of raw source content
// --------------------------------------------------------------------------

export function hashSourceContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// --------------------------------------------------------------------------
// Build an EvidenceRecord
// --------------------------------------------------------------------------

export function buildEvidenceRecord(opts: {
  sourceType: EvidenceCategory;
  sourceName?: string;
  sourceUrl?: string;
  sourceIdentifier?: string;
  author?: string;
  organization?: string;
  publishedAt?: string;
  effectiveDate?: string;
  season?: number;
  playerId?: string;
  teamId?: string;
  normalizedClaim: string;
  rawExcerpt?: string;
  isObserved: boolean;
  reliabilityTier: ReliabilityTier;
  expirationPolicy: ExpirationPolicy;
  sourceHash?: string;
  reviewStatus?: ReviewStatus;
  capturedAt?: string;
}): EvidenceRecord {
  const now = opts.capturedAt ?? new Date().toISOString();
  const evidenceId = computeEvidenceId({
    sourceName: opts.sourceName ?? null,
    sourceUrl: opts.sourceUrl ?? null,
    sourceIdentifier: opts.sourceIdentifier ?? null,
    normalizedClaim: opts.normalizedClaim,
    effectiveDate: opts.effectiveDate ?? null,
    playerId: opts.playerId ?? null,
    teamId: opts.teamId ?? null,
  });

  return {
    evidenceId,
    sourceType: opts.sourceType,
    sourceName: opts.sourceName ?? null,
    sourceUrl: opts.sourceUrl ?? null,
    sourceIdentifier: opts.sourceIdentifier ?? null,
    author: opts.author ?? null,
    organization: opts.organization ?? null,
    publishedAt: opts.publishedAt ?? null,
    capturedAt: now,
    effectiveDate: opts.effectiveDate ?? null,
    season: opts.season ?? null,
    playerId: opts.playerId ?? null,
    teamId: opts.teamId ?? null,
    evidenceCategory: opts.sourceType,
    normalizedClaim: opts.normalizedClaim,
    rawExcerpt: opts.rawExcerpt ?? null,
    isObserved: opts.isObserved,
    confidence: tierToConfidence(opts.reliabilityTier),
    reliabilityTier: opts.reliabilityTier,
    expirationPolicy: opts.expirationPolicy,
    expiresAt: computeExpiresAt(opts.expirationPolicy, opts.effectiveDate ?? null, now),
    sourceHash: opts.sourceHash ?? null,
    parserVersion: EVIDENCE_VERSION,
    reviewStatus: opts.reviewStatus ?? "pending",
  };
}

// --------------------------------------------------------------------------
// Staleness check
// --------------------------------------------------------------------------

export function isStale(record: EvidenceRecord, asOf: Date = new Date()): boolean {
  if (!record.expiresAt) return false;
  return new Date(record.expiresAt) < asOf;
}

// --------------------------------------------------------------------------
// Evidence sorting: prefer tier-1 recent > tier-1 old > tier-2 recent, etc.
// Used in contradiction resolution.
// --------------------------------------------------------------------------

export function evidencePriority(record: EvidenceRecord): number {
  const tierScore = (5 - record.reliabilityTier) * 1_000_000;
  const recencyScore = record.publishedAt
    ? Math.floor(new Date(record.publishedAt).getTime() / 1000 / 60) // minutes since epoch
    : Math.floor(new Date(record.capturedAt).getTime() / 1000 / 60);
  return tierScore + recencyScore;
}

// --------------------------------------------------------------------------
// Validate a normalized claim is non-empty and not copyrighted prose
// (heuristic: reject anything over 500 chars — full articles are not allowed)
// --------------------------------------------------------------------------

export function validateClaim(claim: string): { valid: boolean; reason?: string } {
  if (!claim || !claim.trim()) {
    return { valid: false, reason: "Normalized claim must not be empty" };
  }
  if (claim.length > 500) {
    return { valid: false, reason: "Claim exceeds 500 characters — store factual summary, not full article text" };
  }
  return { valid: true };
}

// --------------------------------------------------------------------------
// Build a model inference evidence record (tier 4, inferred)
// --------------------------------------------------------------------------

export function buildInferenceEvidence(opts: {
  normalizedClaim: string;
  playerId?: string;
  teamId?: string;
  inferenceMethod: string;
  season?: number;
  capturedAt?: string;
}): EvidenceRecord {
  return buildEvidenceRecord({
    sourceType: "model_inference",
    sourceName: "Blackbird GM",
    sourceIdentifier: `blackbird-${opts.inferenceMethod}`,
    normalizedClaim: opts.normalizedClaim,
    isObserved: false,
    reliabilityTier: 4,
    expirationPolicy: "seasonal",
    playerId: opts.playerId,
    teamId: opts.teamId,
    season: opts.season,
    reviewStatus: "approved",
    capturedAt: opts.capturedAt,
  });
}

// --------------------------------------------------------------------------
// Build a manual review evidence record (tier 1, observed)
// --------------------------------------------------------------------------

export function buildManualEvidence(opts: {
  normalizedClaim: string;
  playerId?: string;
  teamId?: string;
  author?: string;
  effectiveDate?: string;
  season?: number;
  rawExcerpt?: string;
  capturedAt?: string;
}): EvidenceRecord {
  return buildEvidenceRecord({
    sourceType: "manual_review",
    sourceName: opts.author ?? "manual",
    normalizedClaim: opts.normalizedClaim,
    rawExcerpt: opts.rawExcerpt,
    isObserved: true,
    reliabilityTier: 1,
    expirationPolicy: "until_superseded",
    playerId: opts.playerId,
    teamId: opts.teamId,
    season: opts.season,
    effectiveDate: opts.effectiveDate,
    author: opts.author,
    reviewStatus: "approved",
    capturedAt: opts.capturedAt,
  });
}
