// H8: Evidence model tests

import { describe, expect, it } from "vitest";

import {
  buildEvidenceRecord,
  buildInferenceEvidence,
  buildManualEvidence,
  computeEvidenceId,
  computeExpiresAt,
  evidencePriority,
  hashSourceContent,
  isStale,
  tierToConfidence,
  validateClaim,
} from "./evidence";

// ─── 1. Evidence immutability (deterministic ID) ─────────────────────────────

describe("computeEvidenceId — deterministic hashing", () => {
  it("produces same ID for same inputs", () => {
    const opts = {
      sourceName: "ESPN",
      sourceUrl: "https://espn.com/article",
      sourceIdentifier: null,
      normalizedClaim: "Patrick Mahomes named starter",
      effectiveDate: "2026-06-01",
      playerId: "player-uuid-1",
      teamId: null,
    };
    expect(computeEvidenceId(opts)).toBe(computeEvidenceId(opts));
  });

  it("produces different IDs for different claims", () => {
    const base = { sourceName: "ESPN", sourceUrl: null, sourceIdentifier: null, effectiveDate: null, playerId: "p1", teamId: null };
    const id1 = computeEvidenceId({ ...base, normalizedClaim: "Named starter" });
    const id2 = computeEvidenceId({ ...base, normalizedClaim: "Named backup" });
    expect(id1).not.toBe(id2);
  });

  it("is 32 hex characters", () => {
    const id = computeEvidenceId({
      sourceName: null, sourceUrl: null, sourceIdentifier: "abc",
      normalizedClaim: "test claim", effectiveDate: null, playerId: null, teamId: null,
    });
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ─── 2. Source hash ──────────────────────────────────────────────────────────

describe("hashSourceContent", () => {
  it("is deterministic", () => {
    expect(hashSourceContent("hello")).toBe(hashSourceContent("hello"));
  });
  it("differs for different content", () => {
    expect(hashSourceContent("hello")).not.toBe(hashSourceContent("world"));
  });
});

// ─── 3. Claim validation ─────────────────────────────────────────────────────

describe("validateClaim", () => {
  it("accepts short factual claims", () => {
    expect(validateClaim("Patrick Mahomes named starter").valid).toBe(true);
  });
  it("rejects empty claims", () => {
    expect(validateClaim("").valid).toBe(false);
    expect(validateClaim("   ").valid).toBe(false);
  });
  it("rejects claims over 500 characters", () => {
    const long = "x".repeat(501);
    const r = validateClaim(long);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/500/);
  });
  it("accepts exactly 500 characters", () => {
    expect(validateClaim("x".repeat(500)).valid).toBe(true);
  });
});

// ─── 4. Reliability tier → confidence ────────────────────────────────────────

describe("tierToConfidence", () => {
  it("tier 1 = 1.0", () => expect(tierToConfidence(1)).toBe(1.0));
  it("tier 2 < tier 1", () => expect(tierToConfidence(2)).toBeLessThan(tierToConfidence(1)));
  it("tier 4 = 0.4", () => expect(tierToConfidence(4)).toBe(0.4));
});

// ─── 5. Expiration ───────────────────────────────────────────────────────────

describe("computeExpiresAt", () => {
  it("injury_report expires in 7 days", () => {
    const result = computeExpiresAt("injury_report", "2026-06-01", "2026-06-01T12:00:00Z");
    expect(result).toBeTruthy();
    const expDate = new Date(result!);
    const anchorDate = new Date("2026-06-01");
    const diffDays = (expDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("until_superseded never expires", () => {
    expect(computeExpiresAt("until_superseded", "2026-06-01", "2026-06-01T12:00:00Z")).toBeNull();
  });

  it("uses capturedAt when effectiveDate is null", () => {
    const result = computeExpiresAt("practice_report", null, "2026-06-01T12:00:00Z");
    expect(result).toBeTruthy();
  });
});

// ─── 6. Staleness ───────────────────────────────────────────────────────────

describe("isStale", () => {
  it("not stale when expiresAt is in the future", () => {
    const record = buildEvidenceRecord({
      sourceType: "injury_report",
      normalizedClaim: "Player is out week 1",
      isObserved: true,
      reliabilityTier: 1,
      expirationPolicy: "injury_report",
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
    expect(isStale(record, new Date())).toBe(false);
  });

  it("stale when expiresAt is in the past", () => {
    const old = new Date("2025-01-01T00:00:00Z");
    const record = buildEvidenceRecord({
      sourceType: "injury_report",
      normalizedClaim: "Old injury report",
      isObserved: true,
      reliabilityTier: 1,
      expirationPolicy: "injury_report",
      effectiveDate: "2025-01-01",
      capturedAt: "2025-01-01T00:00:00Z",
    });
    expect(isStale(record, new Date())).toBe(true);
    void old;
  });
});

// ─── 7. Evidence priority (for contradiction resolution) ─────────────────────

describe("evidencePriority", () => {
  it("tier 1 outranks tier 4", () => {
    const tier1 = buildEvidenceRecord({
      sourceType: "official_team",
      normalizedClaim: "Starter confirmed",
      isObserved: true,
      reliabilityTier: 1,
      expirationPolicy: "until_superseded",
      publishedAt: "2026-06-01T00:00:00Z",
    });
    const tier4 = buildEvidenceRecord({
      sourceType: "user_entered",
      normalizedClaim: "Maybe starter",
      isObserved: false,
      reliabilityTier: 4,
      expirationPolicy: "depth_chart",
      publishedAt: "2026-06-10T00:00:00Z", // more recent but lower tier
    });
    expect(evidencePriority(tier1)).toBeGreaterThan(evidencePriority(tier4));
  });

  it("same tier: more recent wins", () => {
    const older = buildEvidenceRecord({
      sourceType: "beat_report",
      normalizedClaim: "WR2",
      isObserved: true,
      reliabilityTier: 2,
      expirationPolicy: "depth_chart",
      publishedAt: "2026-05-01T00:00:00Z",
    });
    const newer = buildEvidenceRecord({
      sourceType: "beat_report",
      normalizedClaim: "WR1",
      isObserved: true,
      reliabilityTier: 2,
      expirationPolicy: "depth_chart",
      publishedAt: "2026-06-10T00:00:00Z",
    });
    expect(evidencePriority(newer)).toBeGreaterThan(evidencePriority(older));
  });
});

// ─── 8. buildEvidenceRecord ──────────────────────────────────────────────────

describe("buildEvidenceRecord", () => {
  it("sets reliabilityTier and confidence correctly", () => {
    const r = buildEvidenceRecord({
      sourceType: "coach_quote",
      normalizedClaim: "He is our starter",
      isObserved: true,
      reliabilityTier: 2,
      expirationPolicy: "coach_quote",
    });
    expect(r.reliabilityTier).toBe(2);
    expect(r.confidence).toBe(tierToConfidence(2));
  });

  it("evidenceId is stable across re-creation with same inputs", () => {
    const opts = {
      sourceType: "depth_chart" as const,
      sourceName: "ESPN",
      normalizedClaim: "QB1 named",
      isObserved: true,
      reliabilityTier: 3 as const,
      expirationPolicy: "depth_chart" as const,
      playerId: "p1",
      effectiveDate: "2026-06-01",
    };
    const r1 = buildEvidenceRecord(opts);
    const r2 = buildEvidenceRecord(opts);
    expect(r1.evidenceId).toBe(r2.evidenceId);
  });
});

// ─── 9. buildInferenceEvidence ───────────────────────────────────────────────

describe("buildInferenceEvidence", () => {
  it("sets isObserved=false and tier=4", () => {
    const r = buildInferenceEvidence({
      normalizedClaim: "Inferred carry share from PBP",
      playerId: "p1",
      inferenceMethod: "h2_pbp_season_2025",
      season: 2025,
    });
    expect(r.isObserved).toBe(false);
    expect(r.reliabilityTier).toBe(4);
    expect(r.reviewStatus).toBe("approved");
  });
});

// ─── 10. buildManualEvidence ─────────────────────────────────────────────────

describe("buildManualEvidence", () => {
  it("sets isObserved=true and tier=1", () => {
    const r = buildManualEvidence({
      normalizedClaim: "Depth chart confirmed by team PR",
      playerId: "p2",
    });
    expect(r.isObserved).toBe(true);
    expect(r.reliabilityTier).toBe(1);
    expect(r.expirationPolicy).toBe("until_superseded");
  });
});
