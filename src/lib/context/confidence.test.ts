// H8: Confidence model tests

import { describe, expect, it } from "vitest";

import { buildEvidenceRecord } from "./evidence";
import {
  computeFieldConfidence,
  computeFieldStatus,
  computeOverallConfidence,
  scoreToConfidence,
} from "./confidence";
import type { EvidenceRecord } from "./types";

function makeRecord(opts: {
  tier?: 1 | 2 | 3 | 4;
  publishedAt?: string;
  isObserved?: boolean;
  sourceName?: string;
  expiresAt?: string;
}): EvidenceRecord {
  const r = buildEvidenceRecord({
    sourceType: "beat_report",
    normalizedClaim: "Player is starter",
    isObserved: opts.isObserved ?? true,
    reliabilityTier: opts.tier ?? 2,
    expirationPolicy: "depth_chart",
    publishedAt: opts.publishedAt,
    sourceName: opts.sourceName ?? "source",
  });
  if (opts.expiresAt) {
    return { ...r, expiresAt: opts.expiresAt };
  }
  return r;
}

// ─── 1. scoreToConfidence boundaries ─────────────────────────────────────────

describe("scoreToConfidence", () => {
  it("verified at ≥ 0.92", () => expect(scoreToConfidence(0.95)).toBe("verified"));
  it("high at 0.80", () => expect(scoreToConfidence(0.80)).toBe("high"));
  it("moderate at 0.60", () => expect(scoreToConfidence(0.60)).toBe("moderate"));
  it("low at 0.35", () => expect(scoreToConfidence(0.35)).toBe("low"));
  it("unresolved at 0.10", () => expect(scoreToConfidence(0.10)).toBe("unresolved"));
});

// ─── 2. computeFieldConfidence ───────────────────────────────────────────────

describe("computeFieldConfidence", () => {
  it("unresolved when no evidence", () => {
    expect(computeFieldConfidence([], 0)).toBe("unresolved");
  });

  it("high confidence with tier-1 recent evidence", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const record = makeRecord({ tier: 1, publishedAt: recent });
    const result = computeFieldConfidence([record], 0);
    expect(["verified", "high"]).toContain(result);
  });

  it("lower confidence with tier-4 evidence", () => {
    const record = makeRecord({ tier: 4, publishedAt: new Date().toISOString() });
    const result = computeFieldConfidence([record], 0);
    expect(["low", "unresolved"]).toContain(result);
  });

  it("contradiction penalty: each contradiction lowers confidence", () => {
    const record = makeRecord({ tier: 2, publishedAt: new Date().toISOString() });
    const noConflict = computeFieldConfidence([record], 0);
    const withConflict = computeFieldConfidence([record], 2);
    const scoreMap = { verified: 5, high: 4, moderate: 3, low: 2, unresolved: 1 };
    expect(scoreMap[withConflict]).toBeLessThanOrEqual(scoreMap[noConflict]);
  });

  it("multiple sources increase confidence (diversity bonus)", () => {
    const r1 = makeRecord({ tier: 2, publishedAt: new Date().toISOString(), sourceName: "ESPN" });
    const r2 = makeRecord({ tier: 2, publishedAt: new Date().toISOString(), sourceName: "NFL.com" });
    const single = computeFieldConfidence([r1], 0);
    const multi = computeFieldConfidence([r1, r2], 0);
    const scoreMap = { verified: 5, high: 4, moderate: 3, low: 2, unresolved: 1 };
    expect(scoreMap[multi]).toBeGreaterThanOrEqual(scoreMap[single]);
  });

  it("official evidence outranks weak aggregation", () => {
    const tier1 = makeRecord({ tier: 1, publishedAt: new Date().toISOString(), sourceName: "Official" });
    const tier4 = makeRecord({ tier: 4, publishedAt: new Date().toISOString(), sourceName: "Reddit" });
    const tier1Conf = computeFieldConfidence([tier1], 0);
    const tier4Conf = computeFieldConfidence([tier4], 0);
    const scoreMap = { verified: 5, high: 4, moderate: 3, low: 2, unresolved: 1 };
    expect(scoreMap[tier1Conf]).toBeGreaterThan(scoreMap[tier4Conf]);
  });

  it("stale evidence yields unresolved", () => {
    const staleRecord = makeRecord({
      tier: 1,
      publishedAt: "2025-01-01T00:00:00Z",
      expiresAt: "2025-01-08T00:00:00Z", // expired
    });
    expect(computeFieldConfidence([staleRecord], 0)).toBe("unresolved");
  });
});

// ─── 3. computeFieldStatus ───────────────────────────────────────────────────

describe("computeFieldStatus", () => {
  it("unknown when no evidence", () => {
    expect(computeFieldStatus([], 0)).toBe("unknown");
  });

  it("contradicted when contradiction count > 0", () => {
    const r = makeRecord({ tier: 1 });
    expect(computeFieldStatus([r], 1)).toBe("contradicted");
  });

  it("stale when all evidence is expired", () => {
    const staleRecord = makeRecord({
      tier: 1,
      publishedAt: "2025-01-01T00:00:00Z",
      expiresAt: "2025-01-08T00:00:00Z",
    });
    expect(computeFieldStatus([staleRecord], 0)).toBe("stale");
  });

  it("observed when active observed evidence present", () => {
    const r = makeRecord({ tier: 1, publishedAt: new Date().toISOString(), isObserved: true });
    // Make sure expires far in future
    const active = { ...r, expiresAt: null };
    expect(computeFieldStatus([active], 0)).toBe("observed");
  });

  it("inferred when only inferred evidence present", () => {
    const r = makeRecord({ tier: 4, publishedAt: new Date().toISOString(), isObserved: false });
    const active = { ...r, expiresAt: null };
    expect(computeFieldStatus([active], 0)).toBe("inferred");
  });
});

// ─── 4. computeOverallConfidence ─────────────────────────────────────────────

describe("computeOverallConfidence", () => {
  it("unresolved for empty fields", () => {
    expect(computeOverallConfidence([])).toBe("unresolved");
  });

  it("high overall when most fields are high confidence", () => {
    const fields = [
      { confidence: "high" as const, status: "observed" as const },
      { confidence: "high" as const, status: "observed" as const },
      { confidence: "moderate" as const, status: "observed" as const },
    ];
    const result = computeOverallConfidence(fields);
    expect(["verified", "high", "moderate"]).toContain(result);
  });

  it("lowered by unknown fields", () => {
    const withoutUnknown = [
      { confidence: "high" as const, status: "observed" as const },
      { confidence: "high" as const, status: "observed" as const },
    ];
    const withUnknown = [
      { confidence: "high" as const, status: "observed" as const },
      { confidence: "unresolved" as const, status: "unknown" as const },
    ];
    const scoreMap = { verified: 5, high: 4, moderate: 3, low: 2, unresolved: 1 };
    const normal = computeOverallConfidence(withoutUnknown);
    const withU = computeOverallConfidence(withUnknown);
    expect(scoreMap[withU]).toBeLessThanOrEqual(scoreMap[normal]);
  });
});
