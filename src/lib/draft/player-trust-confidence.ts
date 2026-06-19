import type { ProjectionTrust } from "@/lib/projections/projection-trust";

export type PlayerTrustConfidenceLabel = "high" | "medium" | "low" | "very_low" | "unknown";

export type PlayerTrustConfidenceReasonCode =
  | "missing_projection_confidence"
  | "missing_identity_confidence"
  | "missing_roster_confirmation"
  | "missing_sleeper_metadata"
  | "missing_historical_profile"
  | "fallback_projection"
  | "source_expansion_policy"
  | "manual_review_policy"
  | "blocked_or_archive_policy"
  | "trust_defaulted_low"
  | "trust_field_not_mapped"
  | "trust_overridden_by_data_gap"
  | "strong_identity"
  | "active_roster_confirmed"
  | "projection_present"
  | "market_evidence_present"
  | "source_confidence_present";

export type PlayerTrustConfidenceInput = {
  playerName?: string | null;
  position?: string | null;
  team?: string | null;
  currentTrust?: ProjectionTrust | null;
  currentConfidence?: string | null;
  projectionPoints?: number | null;
  projectionSource?: string | null;
  projectionUnit?: string | null;
  isFallback?: boolean | null;
  matchStatus?: string | null;
  matchConfidence?: number | null;
  inputCompleteness?: string | null;
  activePolicyClass?: string | null;
  policyGroup?: string | null;
  sourceConfidence?: string | null;
  sourceConfidenceScore?: number | null;
  marketAdp?: number | null;
  marketRank?: number | null;
  marketMatchType?: string | null;
  sleeperId?: string | null;
  playerId?: string | null;
  gsisId?: string | null;
  hasHistoricalProfile?: boolean | null;
  dataGaps?: string[] | null;
};

export type PlayerTrustConfidence = {
  label: Exclude<PlayerTrustConfidenceLabel, "unknown">;
  score: number;
  confidence: "high" | "medium" | "low" | "very_low";
  reasonCodes: PlayerTrustConfidenceReasonCode[];
  reasons: string[];
  dataGaps: string[];
  trueFallbackProjection: boolean;
};

const OFFENSE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

export function calibratePlayerTrustConfidence(input: PlayerTrustConfidenceInput): PlayerTrustConfidence {
  const policy = `${input.activePolicyClass ?? ""} ${input.policyGroup ?? ""}`.toLowerCase();
  const sourceConfidence = (input.sourceConfidence ?? input.currentConfidence ?? "").toLowerCase();
  const currentLabel = input.currentTrust?.trustLabel ?? labelFromConfidence(input.currentConfidence);
  const projectionPresent = finiteNumber(input.projectionPoints) !== null;
  const identityStrong = hasStrongIdentity(input);
  const activeConfirmed = policy.includes("confirmed_active_clear") || policy.includes("active_candidate") || policy.includes("active_clear");
  const marketEvidence = finiteNumber(input.marketRank) !== null || finiteNumber(input.marketAdp) !== null;
  const sourceConfidencePresent = ["high", "medium"].some((label) => sourceConfidence.includes(label)) || finiteNumber(input.sourceConfidenceScore) !== null;
  const blocked = policy.includes("blocked") || policy.includes("archive") || policy.includes("shadow");
  const manualReview = policy.includes("manual") || policy.includes("conflict") || policy.includes("non_active") || policy.includes("kicker_review");
  const sourceExpansion = policy.includes("source_expansion") || policy.includes("stale_unmatched") || policy.includes("unmatched_low_confidence");
  const trueFallbackProjection = Boolean(input.isFallback) || (input.projectionUnit ?? "").toLowerCase() === "fallback" || (input.projectionSource ?? "").toLowerCase().includes("fallback");

  const reasonCodes: PlayerTrustConfidenceReasonCode[] = [];
  if (!projectionPresent) reasonCodes.push("missing_projection_confidence");
  else reasonCodes.push("projection_present");
  if (!identityStrong) reasonCodes.push("missing_identity_confidence");
  else reasonCodes.push("strong_identity");
  if (!activeConfirmed) reasonCodes.push("missing_roster_confirmation");
  else reasonCodes.push("active_roster_confirmed");
  if (!input.sleeperId && !input.playerId) reasonCodes.push("missing_sleeper_metadata");
  if (input.hasHistoricalProfile === false) reasonCodes.push("missing_historical_profile");
  if (marketEvidence) reasonCodes.push("market_evidence_present");
  if (sourceConfidencePresent) reasonCodes.push("source_confidence_present");
  if (trueFallbackProjection) reasonCodes.push("fallback_projection");
  if (sourceExpansion) reasonCodes.push("source_expansion_policy");
  if (manualReview) reasonCodes.push("manual_review_policy");
  if (blocked) reasonCodes.push("blocked_or_archive_policy");
  if (currentLabel === "low" || currentLabel === "very_low") reasonCodes.push("trust_defaulted_low");
  if (!input.currentTrust && !input.currentConfidence) reasonCodes.push("trust_field_not_mapped");
  if ((input.dataGaps ?? []).length >= 5) reasonCodes.push("trust_overridden_by_data_gap");

  let score = 20;
  if (projectionPresent) score += 24;
  if (identityStrong) score += 18;
  if (activeConfirmed) score += 18;
  if (marketEvidence) score += 8;
  if (sourceConfidence.includes("high")) score += 8;
  else if (sourceConfidence.includes("medium")) score += 4;
  if (finiteNumber(input.sourceConfidenceScore) !== null) score += Math.max(0, Math.min(8, ((input.sourceConfidenceScore ?? 0) - 50) / 5));
  if (input.hasHistoricalProfile === true) score += 4;
  if (input.inputCompleteness === "full") score += 3;
  if (!OFFENSE_POSITIONS.has((input.position ?? "").toUpperCase())) score -= 8;
  if ((input.dataGaps ?? []).length >= 5) score -= 8;
  if (trueFallbackProjection) score -= 22;
  if (sourceExpansion) score -= 18;
  if (manualReview) score -= 26;
  if (blocked) score -= 45;

  if (blocked) score = Math.min(score, 24);
  if (manualReview || sourceExpansion) score = Math.min(score, 48);
  if (trueFallbackProjection) score = Math.min(score, 42);
  if (!projectionPresent) score = Math.min(score, 28);
  if (!identityStrong) score = Math.min(score, 52);
  if (!activeConfirmed) score = Math.min(score, 58);
  if (!sourceConfidence.includes("high") && !(finiteNumber(input.sourceConfidenceScore) !== null && (input.sourceConfidenceScore ?? 0) >= 85)) score = Math.min(score, 72);
  if (!marketEvidence) score = Math.min(score, 72);

  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const label = labelFromScore(roundedScore);
  return {
    label,
    score: roundedScore,
    confidence: label === "high" ? "high" : label === "medium" ? "medium" : label === "low" ? "low" : "very_low",
    reasonCodes: unique(reasonCodes),
    reasons: reasonsFor({ label, projectionPresent, identityStrong, activeConfirmed, marketEvidence, sourceConfidencePresent, trueFallbackProjection, blocked, manualReview, sourceExpansion }),
    dataGaps: unique(input.dataGaps ?? []),
    trueFallbackProjection,
  };
}

export function applyCalibratedTrust(base: ProjectionTrust, calibration: PlayerTrustConfidence): ProjectionTrust {
  return {
    ...base,
    trustLabel: calibration.label,
    trustScore: calibration.score,
    fallbackReason: calibration.trueFallbackProjection ? base.fallbackReason ?? "unknown" : null,
    reasons: unique([...base.reasons, ...calibration.reasons]),
    dataGaps: calibration.dataGaps,
  };
}

function hasStrongIdentity(input: PlayerTrustConfidenceInput): boolean {
  const status = (input.matchStatus ?? "").toLowerCase();
  const marketMatch = (input.marketMatchType ?? "").toLowerCase();
  if (status.includes("unmatched") || status.includes("ambiguous")) return false;
  if (input.matchConfidence !== null && input.matchConfidence !== undefined && input.matchConfidence < 0.75) return false;
  return Boolean(input.playerId || input.sleeperId || input.gsisId || status.includes("exact") || marketMatch.includes("exact") || marketMatch.includes("name"));
}

function labelFromConfidence(value: string | null | undefined): Exclude<PlayerTrustConfidenceLabel, "unknown"> {
  const label = (value ?? "").toLowerCase();
  if (label.includes("very")) return "very_low";
  if (label.includes("low")) return "low";
  if (label.includes("high")) return "high";
  if (label.includes("medium")) return "medium";
  return "low";
}

function labelFromScore(score: number): Exclude<PlayerTrustConfidenceLabel, "unknown"> {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 30) return "low";
  return "very_low";
}

function reasonsFor(input: {
  label: string;
  projectionPresent: boolean;
  identityStrong: boolean;
  activeConfirmed: boolean;
  marketEvidence: boolean;
  sourceConfidencePresent: boolean;
  trueFallbackProjection: boolean;
  blocked: boolean;
  manualReview: boolean;
  sourceExpansion: boolean;
}): string[] {
  return [
    `Calibrated trust is ${input.label}.`,
    input.projectionPresent ? "Projection points are present." : "Projection points are missing.",
    input.identityStrong ? "Identity evidence is strong enough for board trust." : "Identity evidence is incomplete.",
    input.activeConfirmed ? "Current active roster policy supports draftability." : "Current active roster confirmation is missing or limited.",
    input.marketEvidence ? "Market ADP/rank is available as supporting evidence." : null,
    input.sourceConfidencePresent ? "Source confidence metadata is present." : null,
    input.trueFallbackProjection ? "True fallback projection caps trust." : null,
    input.blocked ? "Blocked/archive policy caps trust." : null,
    input.manualReview ? "Manual-review policy caps trust." : null,
    input.sourceExpansion ? "Source-expansion policy caps trust." : null,
  ].filter((reason): reason is string => Boolean(reason));
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}
