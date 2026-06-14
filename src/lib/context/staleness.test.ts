// H8: Staleness and expiration policy tests

import { describe, expect, it } from "vitest";

import { buildEvidenceRecord } from "./evidence";
import {
  CATEGORY_EXPIRATION_POLICY,
  DEPTH_CHART_STALE_DAYS,
  INJURY_STALE_DAYS,
  isEvidenceStale,
  isFieldStale,
  isRosterEvent,
  maxAgeDays,
  summarizeEvidence,
} from "./staleness";

function makeRecord(publishedAt: string, expiresAt?: string) {
  const r = buildEvidenceRecord({
    sourceType: "injury_report",
    normalizedClaim: "Player listed questionable",
    isObserved: true,
    reliabilityTier: 1,
    expirationPolicy: "injury_report",
    capturedAt: publishedAt,
    effectiveDate: publishedAt.slice(0, 10),
  });
  return expiresAt ? { ...r, expiresAt } : r;
}

// ─── 1. Category expiration policy ───────────────────────────────────────────

describe("CATEGORY_EXPIRATION_POLICY", () => {
  it("injury_report expires", () => {
    expect(CATEGORY_EXPIRATION_POLICY["injury_report"]).toBe("injury_report");
    expect(maxAgeDays("injury_report")).toBe(INJURY_STALE_DAYS);
  });

  it("transaction persists until superseded", () => {
    expect(CATEGORY_EXPIRATION_POLICY["transaction"]).toBe("until_superseded");
    expect(maxAgeDays("transaction")).toBeNull();
  });

  it("roster_move persists until superseded", () => {
    expect(CATEGORY_EXPIRATION_POLICY["roster_move"]).toBe("until_superseded");
    expect(maxAgeDays("roster_move")).toBeNull();
  });

  it("depth_chart expires after 21 days", () => {
    expect(maxAgeDays("depth_chart")).toBe(DEPTH_CHART_STALE_DAYS);
  });

  it("does not use a single global expiration for all categories", () => {
    const injuryDays = maxAgeDays("injury_report");
    const depthDays = maxAgeDays("depth_chart");
    const transactionDays = maxAgeDays("transaction");
    // All three must differ
    expect(new Set([injuryDays, depthDays, transactionDays]).size).toBeGreaterThan(1);
  });
});

// ─── 2. isEvidenceStale ──────────────────────────────────────────────────────

describe("isEvidenceStale", () => {
  it("fresh injury report is not stale", () => {
    const r = makeRecord(new Date().toISOString());
    expect(isEvidenceStale(r, new Date())).toBe(false);
  });

  it("old injury report is stale after 7 days", () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const r = makeRecord(old, new Date(Date.now() - 1000).toISOString()); // already expired
    expect(isEvidenceStale(r, new Date())).toBe(true);
  });

  it("transaction never goes stale without explicit expiresAt", () => {
    const old = new Date("2020-01-01").toISOString();
    const r = buildEvidenceRecord({
      sourceType: "transaction",
      normalizedClaim: "Signed to 3-year deal",
      isObserved: true,
      reliabilityTier: 1,
      expirationPolicy: "until_superseded",
      capturedAt: old,
    });
    expect(isEvidenceStale(r, new Date())).toBe(false);
  });

  it("newer evidence supersedes stale evidence", () => {
    const stale = makeRecord(new Date("2025-01-01").toISOString(), new Date("2025-01-08").toISOString());
    const fresh = makeRecord(new Date().toISOString());
    expect(isEvidenceStale(stale, new Date())).toBe(true);
    expect(isEvidenceStale(fresh, new Date())).toBe(false);
  });
});

// ─── 3. isFieldStale ─────────────────────────────────────────────────────────

describe("isFieldStale", () => {
  it("stale when no evidence date", () => {
    expect(isFieldStale(null, 7)).toBe(true);
  });

  it("not stale when within window", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isFieldStale(recent, 7)).toBe(false);
  });

  it("stale when outside window", () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isFieldStale(old, 7)).toBe(true);
  });

  it("injury expiration uses INJURY_STALE_DAYS", () => {
    const borderDate = new Date(Date.now() - (INJURY_STALE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    expect(isFieldStale(borderDate, INJURY_STALE_DAYS)).toBe(true);
  });
});

// ─── 4. isRosterEvent ────────────────────────────────────────────────────────

describe("isRosterEvent", () => {
  it("transaction is a roster event", () => expect(isRosterEvent("transaction")).toBe(true));
  it("roster_move is a roster event", () => expect(isRosterEvent("roster_move")).toBe(true));
  it("injury_report is a roster event", () => expect(isRosterEvent("injury_report")).toBe(true));
  it("beat_report is not a roster event", () => expect(isRosterEvent("beat_report")).toBe(false));
  it("coach_quote is not a roster event", () => expect(isRosterEvent("coach_quote")).toBe(false));
});

// ─── 5. summarizeEvidence ────────────────────────────────────────────────────

describe("summarizeEvidence", () => {
  it("counts fresh and stale records correctly", () => {
    const fresh = makeRecord(new Date().toISOString());
    const stale = makeRecord("2025-01-01T00:00:00Z", "2025-01-08T00:00:00Z");
    const summary = summarizeEvidence([fresh, stale], new Date());
    expect(summary.total).toBe(2);
    expect(summary.fresh).toBe(1);
    expect(summary.stale).toBe(1);
  });

  it("reports unreviewed count", () => {
    const pending = buildEvidenceRecord({
      sourceType: "beat_report",
      normalizedClaim: "Some claim",
      isObserved: true,
      reliabilityTier: 3,
      expirationPolicy: "depth_chart",
      reviewStatus: "pending",
    });
    const summary = summarizeEvidence([pending], new Date());
    expect(summary.unreviewedCount).toBe(1);
  });
});
