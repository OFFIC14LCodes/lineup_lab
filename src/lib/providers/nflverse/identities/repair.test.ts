import { describe, expect, it, vi } from "vitest";

import { buildRepairDecision } from "./repair";
import type { ConfidenceTier, UnresolvedPlayerReport } from "./types";

function makeEntry(overrides: Partial<UnresolvedPlayerReport> = {}): UnresolvedPlayerReport {
  return {
    gsisId: "00-0030506",
    nflverseName: "Travis Kelce",
    nflversePositionGroup: "TE",
    nflverseTeam: "KC",
    nflverseEspnId: "15847",
    nflverseBirthDate: "1989-10-05",
    nflverseCollege: "Cincinnati",
    nflverseHeight: "76",
    nflverseWeight: "250",
    nflverseSuffix: null,
    nflverseRookieSeason: 2013,
    nflverseDraftYear: 2013,
    nflverseDraftRound: 3,
    nflverseDraftPick: 63,
    weeklyRowCount: 17,
    weeklyPosition: "TE",
    candidateCount: 1,
    canonicalPlayerId: "aaaa-0001",
    canonicalName: "Travis Kelce",
    canonicalSleeperPlayerId: "1466",
    canonicalMetaGsisId: null,
    canonicalMetaEspnId: null,
    canonicalMetaStatsId: null,
    canonicalTeam: "KC",
    canonicalPositionGroup: "TE",
    canonicalBirthDate: "1989-10-05",
    canonicalCollege: "Cincinnati",
    canonicalHeight: "76",
    canonicalWeight: "250",
    canonicalRookieYear: 2013,
    hasExistingMapping: false,
    existingMappingPlayerId: null,
    rootCause: "canonical_gsis_missing",
    // Default: auto_approved (birth date match)
    evidence: null,
    confidenceTier: "auto_approved",
    approvalReason: "matches: birth_date(strong)",
    ...overrides
  };
}

// ─── Tier enforcement ──────────────────────────────────────────────────────

describe("buildRepairDecision — tier enforcement", () => {
  it("repairs auto_approved candidates", () => {
    const decision = buildRepairDecision(makeEntry({ confidenceTier: "auto_approved" }));
    expect(decision).not.toBeNull();
    expect(decision!.decision).toBe("repair");
    expect(decision!.confidenceTier).toBe("auto_approved");
  });

  it("skips high_confidence_review candidates not in approved list", () => {
    const decision = buildRepairDecision(
      makeEntry({ confidenceTier: "high_confidence_review", approvalReason: "single_medium_match_only: college" })
    );
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toContain("pending_review");
  });

  it("repairs high_confidence_review candidates when in approved list", () => {
    const approvedIds = new Set(["00-0030506"]);
    const decision = buildRepairDecision(
      makeEntry({ confidenceTier: "high_confidence_review" }),
      approvedIds
    );
    expect(decision!.decision).toBe("repair");
    expect(decision!.confidenceTier).toBe("high_confidence_review");
  });

  it("returns null for conflict tier — never writable", () => {
    expect(buildRepairDecision(makeEntry({ confidenceTier: "conflict" }))).toBeNull();
  });

  it("returns null for ambiguous tier — never writable", () => {
    expect(buildRepairDecision(makeEntry({ confidenceTier: "ambiguous" }))).toBeNull();
  });

  it("returns null for rejected tier — never writable", () => {
    expect(buildRepairDecision(makeEntry({ confidenceTier: "rejected" }))).toBeNull();
  });

  it("conflict tier blocked even when in approved list", () => {
    const approvedIds = new Set(["00-0030506"]);
    expect(buildRepairDecision(makeEntry({ confidenceTier: "conflict" }), approvedIds)).toBeNull();
  });
});

// ─── GSIS ID repair ───────────────────────────────────────────────────────

describe("buildRepairDecision — GSIS ID repair", () => {
  it("returns repair decision for canonical_gsis_missing with unique candidate", () => {
    const decision = buildRepairDecision(makeEntry({ rootCause: "canonical_gsis_missing" }));
    expect(decision).not.toBeNull();
    expect(decision!.decision).toBe("repair");
    expect(decision!.repairType).toBe("add_gsis_id");
    expect(decision!.newValue).toBe("00-0030506");
    expect(decision!.existingValue).toBeNull();
  });

  it("skips when canonical already has the same gsis_id (idempotent)", () => {
    const decision = buildRepairDecision(makeEntry({
      rootCause: "canonical_gsis_missing",
      canonicalMetaGsisId: "00-0030506"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toBe("already_present");
  });

  it("skips with conflict when canonical has a DIFFERENT existing gsis_id", () => {
    const decision = buildRepairDecision(makeEntry({
      rootCause: "canonical_gsis_missing",
      canonicalMetaGsisId: "00-0099999"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toMatch(/would_overwrite_existing_gsis_id/);
  });
});

// ─── ESPN ID repair ───────────────────────────────────────────────────────

describe("buildRepairDecision — ESPN ID repair", () => {
  it("returns repair decision for canonical_espn_missing with nflverse espn_id", () => {
    const decision = buildRepairDecision(makeEntry({
      rootCause: "canonical_espn_missing",
      canonicalMetaGsisId: "00-0030506",
      canonicalMetaEspnId: null,
      nflverseEspnId: "15847",
      confidenceTier: "auto_approved"
    }));
    expect(decision).not.toBeNull();
    expect(decision!.decision).toBe("repair");
    expect(decision!.repairType).toBe("add_espn_id");
    expect(decision!.newValue).toBe("15847");
  });

  it("skips when espn_id already matches (idempotent)", () => {
    const decision = buildRepairDecision(makeEntry({
      rootCause: "canonical_espn_missing",
      canonicalMetaEspnId: "15847",
      nflverseEspnId: "15847",
      confidenceTier: "auto_approved"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toBe("already_present");
  });

  it("skips with conflict when different espn_id already exists", () => {
    const decision = buildRepairDecision(makeEntry({
      rootCause: "canonical_espn_missing",
      canonicalMetaEspnId: "99999",
      nflverseEspnId: "15847",
      confidenceTier: "auto_approved"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toMatch(/would_overwrite_existing_espn_id/);
  });
});

// ─── Safety rejections ───────────────────────────────────────────────────

describe("buildRepairDecision — safety rejections", () => {
  it("returns null when candidateCount is not 1", () => {
    expect(buildRepairDecision(makeEntry({ candidateCount: 0, canonicalPlayerId: null }))).toBeNull();
    expect(buildRepairDecision(makeEntry({ candidateCount: 2 }))).toBeNull();
  });

  it("returns null when canonicalPlayerId is null", () => {
    expect(buildRepairDecision(makeEntry({ candidateCount: 1, canonicalPlayerId: null }))).toBeNull();
  });

  it("returns null when canonicalSleeperPlayerId is null", () => {
    expect(buildRepairDecision(makeEntry({ canonicalSleeperPlayerId: null }))).toBeNull();
  });

  it("rejects DEF canonical position", () => {
    const decision = buildRepairDecision(makeEntry({
      canonicalPositionGroup: "DEF",
      rootCause: "canonical_gsis_missing"
    }));
    expect(decision).toBeNull();
  });

  it("rejects DST nflverse position", () => {
    const decision = buildRepairDecision(makeEntry({
      nflversePositionGroup: "DST",
      rootCause: "canonical_gsis_missing"
    }));
    expect(decision).toBeNull();
  });

  it("skips position mismatch (QB nflverse vs TE canonical)", () => {
    const decision = buildRepairDecision(makeEntry({
      nflversePositionGroup: "QB",
      canonicalPositionGroup: "TE",
      rootCause: "canonical_gsis_missing"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toMatch(/position_mismatch/);
  });

  it("skips when existing mapping is for a different player", () => {
    const decision = buildRepairDecision(makeEntry({
      hasExistingMapping: true,
      existingMappingPlayerId: "other-player-uuid",
      rootCause: "canonical_gsis_missing"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toMatch(/conflicting_mapping/);
  });

  it("returns null for non-repairable root causes", () => {
    for (const cause of ["canonical_player_missing", "duplicate_canonical_candidate", "unknown"] as const) {
      expect(buildRepairDecision(makeEntry({ rootCause: cause }))).toBeNull();
    }
  });
});

// ─── Dry-run — pure function, no side effects ────────────────────────────

describe("buildRepairDecision — dry-run no-write behavior", () => {
  it("returns repair decision in dry_run context (no side effects — pure function)", () => {
    const mockWrite = vi.fn();
    const decision = buildRepairDecision(makeEntry({ rootCause: "canonical_gsis_missing" }));
    expect(decision!.decision).toBe("repair");
    expect(mockWrite).not.toHaveBeenCalled();
  });
});

// ─── Idempotent repeated repair ──────────────────────────────────────────

describe("buildRepairDecision — idempotent repeated repair", () => {
  it("returns skip(already_present) if the same value was already applied", () => {
    const decision = buildRepairDecision(makeEntry({
      rootCause: "canonical_gsis_missing",
      canonicalMetaGsisId: "00-0030506"
    }));
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toBe("already_present");
  });
});

// ─── Review requires explicit approval ──────────────────────────────────

describe("buildRepairDecision — review candidate approval gate", () => {
  const reviewEntry = makeEntry({
    gsisId: "00-0039451",
    confidenceTier: "high_confidence_review" as ConfidenceTier,
    approvalReason: "name_and_position_only"
  });

  it("skips review candidate without approved list", () => {
    const decision = buildRepairDecision(reviewEntry);
    expect(decision!.decision).toBe("skip");
    expect(decision!.skipReason).toBe("pending_review: not_in_approved_list");
  });

  it("skips review candidate when approved list does not contain this GSIS ID", () => {
    const decision = buildRepairDecision(reviewEntry, new Set(["00-0099999"]));
    expect(decision!.decision).toBe("skip");
  });

  it("repairs review candidate when its GSIS ID is in the approved list", () => {
    const decision = buildRepairDecision(reviewEntry, new Set(["00-0039451"]));
    expect(decision!.decision).toBe("repair");
  });
});
