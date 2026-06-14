// H8: Staleness and expiration rules for evidence and context fields.
// Each evidence category has its own decay policy — no global expiration period.

import type { EvidenceCategory, EvidenceRecord, ExpirationPolicy } from "./types";

// --------------------------------------------------------------------------
// Default expiration policy by evidence category
// --------------------------------------------------------------------------

export const CATEGORY_EXPIRATION_POLICY: Record<EvidenceCategory, ExpirationPolicy> = {
  official_team: "until_superseded",
  official_league: "until_superseded",
  coach_quote: "coach_quote",
  depth_chart: "depth_chart",
  beat_report: "depth_chart",       // beat reports: treat like depth chart (21 days)
  transaction: "until_superseded",
  contract: "until_superseded",
  injury_report: "injury_report",
  practice_participation: "practice_report",
  game_usage: "seasonal",
  historical_stat: "seasonal",
  roster_move: "until_superseded",
  suspension: "until_superseded",
  manual_review: "until_superseded",
  user_entered: "depth_chart",
  model_inference: "seasonal",
};

// Expiration windows in days (null = never expires; 0 = immediate next-report)
const EXPIRATION_DAYS_BY_POLICY: Record<ExpirationPolicy, number | null> = {
  until_superseded: null,
  injury_report: 7,
  practice_report: 3,
  depth_chart: 21,
  coach_quote: 30,
  seasonal: 180,
  none: null,
};

// --------------------------------------------------------------------------
// Get the maximum allowed age (days) for a category before it is stale
// --------------------------------------------------------------------------

export function maxAgeDays(category: EvidenceCategory): number | null {
  const policy = CATEGORY_EXPIRATION_POLICY[category];
  return EXPIRATION_DAYS_BY_POLICY[policy];
}

// --------------------------------------------------------------------------
// Check if an evidence record is stale as of a given date
// --------------------------------------------------------------------------

export function isEvidenceStale(record: EvidenceRecord, asOf: Date = new Date()): boolean {
  // If explicit expiresAt is set, use it
  if (record.expiresAt) {
    return new Date(record.expiresAt) < asOf;
  }
  // Otherwise derive from category
  const days = maxAgeDays(record.evidenceCategory);
  if (days === null) return false;
  const anchor = record.publishedAt ?? record.capturedAt;
  const ageMs = asOf.getTime() - new Date(anchor).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > days;
}

// --------------------------------------------------------------------------
// Stale-after threshold for injury profiles (days)
// The injury profile becomes stale after this many days without a new report.
// --------------------------------------------------------------------------

export const INJURY_STALE_DAYS = 7;
export const DEPTH_CHART_STALE_DAYS = 21;
export const PRACTICE_REPORT_STALE_DAYS = 3;
export const COACH_QUOTE_STALE_DAYS = 30;

// --------------------------------------------------------------------------
// Stale check for a field based on its most recent evidence date
// --------------------------------------------------------------------------

export function isFieldStale(
  latestEvidenceAt: string | null,
  staleAfterDays: number,
  asOf: Date = new Date()
): boolean {
  if (!latestEvidenceAt) return true; // No evidence → treat as stale
  const ageMs = asOf.getTime() - new Date(latestEvidenceAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > staleAfterDays;
}

// --------------------------------------------------------------------------
// Which roster event categories should immediately invalidate a depth chart
// --------------------------------------------------------------------------

export const ROSTER_EVENT_CATEGORIES: EvidenceCategory[] = [
  "transaction",
  "roster_move",
  "injury_report",
  "suspension",
];

export function isRosterEvent(category: EvidenceCategory): boolean {
  return ROSTER_EVENT_CATEGORIES.includes(category);
}

// --------------------------------------------------------------------------
// Summarize staleness of an evidence collection
// --------------------------------------------------------------------------

export function summarizeEvidence(
  records: EvidenceRecord[],
  asOf: Date = new Date()
): {
  total: number;
  fresh: number;
  stale: number;
  unreviewedCount: number;
  oldestFreshAt: string | null;
  newestAt: string | null;
} {
  let fresh = 0;
  let stale = 0;
  let unreviewedCount = 0;
  let oldestFreshDate: Date | null = null;
  let newestDate: Date | null = null;

  for (const r of records) {
    const anchor = r.publishedAt ?? r.capturedAt;
    const d = new Date(anchor);
    if (!newestDate || d > newestDate) newestDate = d;

    if (isEvidenceStale(r, asOf)) {
      stale++;
    } else {
      fresh++;
      if (!oldestFreshDate || d < oldestFreshDate) oldestFreshDate = d;
    }

    if (r.reviewStatus === "pending") unreviewedCount++;
  }

  return {
    total: records.length,
    fresh,
    stale,
    unreviewedCount,
    oldestFreshAt: oldestFreshDate?.toISOString() ?? null,
    newestAt: newestDate?.toISOString() ?? null,
  };
}
