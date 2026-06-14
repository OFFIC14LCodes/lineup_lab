// H8: Contradiction detection and resolution tests

import { describe, expect, it } from "vitest";

import { buildEvidenceRecord } from "./evidence";
import {
  buildContradictionRecord,
  claimsContradict,
  detectRoleContradictions,
  requiresManualReview,
  resolveContradiction,
} from "./contradictions";
import type { EvidenceRecord } from "./types";

function makeRecord(opts: {
  tier: 1 | 2 | 3 | 4;
  claim?: string;
  publishedAt?: string;
  sourceName?: string;
  expiresAt?: string;
}): EvidenceRecord {
  const r = buildEvidenceRecord({
    sourceType: "beat_report",
    normalizedClaim: opts.claim ?? "Player is starter",
    isObserved: true,
    reliabilityTier: opts.tier,
    expirationPolicy: "depth_chart",
    publishedAt: opts.publishedAt ?? new Date().toISOString(),
    sourceName: opts.sourceName ?? `source-${opts.tier}`,
  });
  if (opts.expiresAt) return { ...r, expiresAt: opts.expiresAt };
  return r;
}

// ─── 1. claimsContradict ─────────────────────────────────────────────────────

describe("claimsContradict", () => {
  it("same claim does not contradict", () => {
    expect(claimsContradict("starter", "starter")).toBe(false);
  });
  it("same claim (case insensitive) does not contradict", () => {
    expect(claimsContradict("Starter", "starter")).toBe(false);
  });
  it("different claims contradict", () => {
    expect(claimsContradict("starter", "backup")).toBe(true);
  });
  it("empty vs non-empty does not contradict (empty ignored)", () => {
    expect(claimsContradict("", "starter")).toBe(false);
  });
});

// ─── 2. resolveContradiction — reliability tier wins ─────────────────────────

describe("resolveContradiction — reliability tier", () => {
  it("tier 1 beats tier 4 regardless of recency", () => {
    const tier1 = makeRecord({ tier: 1, publishedAt: "2026-05-01T00:00:00Z", claim: "QB1" });
    const tier4 = makeRecord({ tier: 4, publishedAt: "2026-06-10T00:00:00Z", claim: "QB2" });
    const resolution = resolveContradiction([tier1, tier4]);
    expect(resolution.winner.reliabilityTier).toBe(1);
    expect(resolution.method).toBe("reliability_tier");
    expect(resolution.manualReviewRequired).toBe(false);
  });

  it("official evidence outranks weak aggregation", () => {
    const official = makeRecord({ tier: 1, claim: "Named starter" });
    const community = makeRecord({ tier: 4, claim: "Playing backup" });
    const resolution = resolveContradiction([community, official]);
    expect(resolution.winner.evidenceId).toBe(official.evidenceId);
  });
});

// ─── 3. resolveContradiction — recency when same tier ────────────────────────

describe("resolveContradiction — recency", () => {
  it("newer evidence wins when same tier", () => {
    const older = makeRecord({ tier: 2, publishedAt: "2026-05-01T00:00:00Z" });
    const newer = makeRecord({ tier: 2, publishedAt: "2026-06-10T00:00:00Z" });
    const resolution = resolveContradiction([older, newer]);
    expect(resolution.winner.evidenceId).toBe(newer.evidenceId);
    expect(resolution.method).toBe("recency");
  });

  it("flags manual review when same-tier sources are within 3 days", () => {
    const d1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const d2 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const r1 = makeRecord({ tier: 2, publishedAt: d1 });
    const r2 = makeRecord({ tier: 2, publishedAt: d2 });
    const resolution = resolveContradiction([r1, r2]);
    expect(resolution.manualReviewRequired).toBe(true);
  });
});

// ─── 4. All evidence preserved in contradiction record ────────────────────────

describe("buildContradictionRecord — evidence preservation", () => {
  it("does not delete loser evidence", () => {
    const tier1 = makeRecord({ tier: 1, claim: "starter" });
    const tier4 = makeRecord({ tier: 4, claim: "backup" });
    const resolution = resolveContradiction([tier1, tier4]);
    const record = buildContradictionRecord("roleProfile.primaryRole", resolution, [tier1, tier4]);
    expect(record.supersededEvidenceIds).toContain(tier4.evidenceId);
    expect(record.winningEvidenceId).toBe(tier1.evidenceId);
  });

  it("records winning evidence ID and reason", () => {
    const a = makeRecord({ tier: 1 });
    const b = makeRecord({ tier: 3 });
    const resolution = resolveContradiction([a, b]);
    const record = buildContradictionRecord("someField", resolution, [a, b]);
    expect(record.contradictionReason).toBeTruthy();
    expect(record.winningEvidenceId).toBeTruthy();
  });
});

// ─── 5. detectRoleContradictions ─────────────────────────────────────────────

describe("detectRoleContradictions", () => {
  it("detects different claims for same field", () => {
    const claims = [
      { evidenceId: "e1", fieldPath: "roleProfile.depthChartPosition", claimValue: "WR1", reliabilityTier: 2, publishedAt: null },
      { evidenceId: "e2", fieldPath: "roleProfile.depthChartPosition", claimValue: "WR2", reliabilityTier: 3, publishedAt: null },
    ];
    const contradictions = detectRoleContradictions(claims);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].fieldPath).toBe("roleProfile.depthChartPosition");
  });

  it("no contradiction when claims agree", () => {
    const claims = [
      { evidenceId: "e1", fieldPath: "roleProfile.depthChartPosition", claimValue: "WR1", reliabilityTier: 2, publishedAt: null },
      { evidenceId: "e2", fieldPath: "roleProfile.depthChartPosition", claimValue: "WR1", reliabilityTier: 3, publishedAt: null },
    ];
    expect(detectRoleContradictions(claims)).toHaveLength(0);
  });

  it("ignores fields with single claim", () => {
    const claims = [
      { evidenceId: "e1", fieldPath: "roleProfile.primaryRole", claimValue: "starter", reliabilityTier: 1, publishedAt: null },
    ];
    expect(detectRoleContradictions(claims)).toHaveLength(0);
  });
});

// ─── 6. requiresManualReview ─────────────────────────────────────────────────

describe("requiresManualReview", () => {
  it("requires review for multiple contradictions", () => {
    const r = requiresManualReview({
      contradictionCount: 2,
      hasLowConfidenceOnly: false,
      hasUnresolved: false,
      sameTierContradiction: false,
    });
    expect(r.required).toBe(true);
    expect(r.reasons).toContain("multiple contradictions");
  });

  it("requires review for same-tier conflict", () => {
    const r = requiresManualReview({
      contradictionCount: 1,
      hasLowConfidenceOnly: false,
      hasUnresolved: false,
      sameTierContradiction: true,
    });
    expect(r.required).toBe(true);
  });

  it("no review needed when clean", () => {
    const r = requiresManualReview({
      contradictionCount: 0,
      hasLowConfidenceOnly: false,
      hasUnresolved: false,
      sameTierContradiction: false,
    });
    expect(r.required).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });
});
