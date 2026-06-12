import { describe, expect, it } from "vitest";

import { buildEvidenceComparison, normalizeCollegeForComparison, normalizeHeightToInches } from "./evidence";
import type { CanonicalPlayerInfo, NflversePlayerInfo } from "./types";

// ─── Test helpers ──────────────────────────────────────────────────────────

function makeSource(overrides: Partial<NflversePlayerInfo> = {}): NflversePlayerInfo {
  return {
    gsisId: "00-0036963",
    displayName: "John Smith",
    normalizedName: "john smith",
    positionGroup: "WR",
    rawPosition: "WR",
    latestTeam: "DET",
    espnId: null,
    birthDate: "1999-05-15",
    college: "Alabama",
    height: "72",
    weight: "200",
    status: "Active",
    lastSeason: 2025,
    suffix: null,
    rookieSeason: 2021,
    draftYear: 2021,
    draftRound: 2,
    draftPick: 50,
    ...overrides
  };
}

function makeCanonical(overrides: Partial<CanonicalPlayerInfo> = {}): CanonicalPlayerInfo {
  return {
    playerId: "aaaa-0001",
    sleeperId: "5844",
    fullName: "John Smith",
    normalizedName: "john smith",
    positionGroup: "WR",
    team: "DET",
    metaGsisId: null,
    metaEspnId: null,
    metaStatsId: null,
    metaBirthDate: "1999-05-15",
    metaCollege: "Alabama",
    metaHeightInches: 72,
    metaWeightLbs: 200,
    metaRookieYear: 2021,
    ...overrides
  };
}

// ─── normalizeHeightToInches ───────────────────────────────────────────────

describe("normalizeHeightToInches", () => {
  it("parses integer inch strings", () => {
    expect(normalizeHeightToInches("72")).toBe(72);
    expect(normalizeHeightToInches("74")).toBe(74);
  });

  it("parses feet+inch format with apostrophe", () => {
    expect(normalizeHeightToInches("6'2\"")).toBe(74);
    expect(normalizeHeightToInches("6'0\"")).toBe(72);
  });

  it("parses feet-inch format", () => {
    expect(normalizeHeightToInches("6-2")).toBe(74);
  });

  it("returns null for null/NA/empty", () => {
    expect(normalizeHeightToInches(null)).toBeNull();
    expect(normalizeHeightToInches("NA")).toBeNull();
    expect(normalizeHeightToInches("")).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(normalizeHeightToInches("30")).toBeNull();   // too short
    expect(normalizeHeightToInches("100")).toBeNull();  // too tall
  });
});

// ─── normalizeCollegeForComparison ────────────────────────────────────────

describe("normalizeCollegeForComparison", () => {
  it("takes primary school before semicolon for transfers", () => {
    expect(normalizeCollegeForComparison("Penn State; Western Kentucky")).toBe("pennstate");
  });

  it("resolves Ole Miss / Mississippi alias", () => {
    const olemiss = normalizeCollegeForComparison("Ole Miss");
    const mississippi = normalizeCollegeForComparison("Mississippi");
    expect(olemiss).toBe(mississippi);
  });

  it("resolves Southern Miss / Southern Mississippi alias", () => {
    const sm = normalizeCollegeForComparison("Southern Miss");
    const full = normalizeCollegeForComparison("Southern Mississippi");
    expect(sm).toBe(full);
  });

  it("returns null for null/empty/NA", () => {
    expect(normalizeCollegeForComparison(null)).toBeNull();
    expect(normalizeCollegeForComparison("")).toBeNull();
    expect(normalizeCollegeForComparison("NA")).toBeNull();
  });
});

// ─── buildEvidenceComparison — tier rules ─────────────────────────────────

describe("buildEvidenceComparison — name + position only", () => {
  it("classifies as high_confidence_review when no bio evidence is present", () => {
    const src = makeSource({ espnId: null, birthDate: null, college: null, height: null, weight: null, rookieSeason: null });
    const can = makeCanonical({ metaEspnId: null, metaBirthDate: null, metaCollege: null, metaHeightInches: null, metaWeightLbs: null, metaRookieYear: null });
    const evidence = buildEvidenceComparison(src, can);
    expect(evidence.tier).toBe("high_confidence_review");
    expect(evidence.strongMatches).toHaveLength(0);
    expect(evidence.mediumMatches).toHaveLength(0);
    expect(evidence.contradictions).toHaveLength(0);
    expect(evidence.approvalReason).toContain("name_and_position_only");
  });
});

describe("buildEvidenceComparison — exact birth date permits auto_approved", () => {
  it("auto_approved when birth dates match", () => {
    const evidence = buildEvidenceComparison(makeSource({ birthDate: "1999-05-15" }), makeCanonical({ metaBirthDate: "1999-05-15" }));
    expect(evidence.tier).toBe("auto_approved");
    expect(evidence.strongMatches.some((s) => s.field === "birth_date")).toBe(true);
  });

  it("still auto_approved when college also matches (strong + medium)", () => {
    const evidence = buildEvidenceComparison(makeSource({ birthDate: "1999-05-15", college: "Alabama" }), makeCanonical({ metaBirthDate: "1999-05-15", metaCollege: "Alabama" }));
    expect(evidence.tier).toBe("auto_approved");
  });
});

describe("buildEvidenceComparison — exact ESPN ID permits auto_approved", () => {
  it("auto_approved when ESPN IDs match", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: null, espnId: "4569371" }),
      makeCanonical({ metaBirthDate: null, metaEspnId: "4569371" })
    );
    expect(evidence.tier).toBe("auto_approved");
    expect(evidence.strongMatches.some((s) => s.field === "espn_id")).toBe(true);
  });
});

describe("buildEvidenceComparison — multiple bio signals permit auto_approved", () => {
  it("auto_approved with 2 medium signals (college + height)", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: null, espnId: null, college: "Alabama", height: "72", weight: null, rookieSeason: null }),
      makeCanonical({ metaBirthDate: null, metaEspnId: null, metaCollege: "Alabama", metaHeightInches: 72, metaWeightLbs: null, metaRookieYear: null })
    );
    expect(evidence.tier).toBe("auto_approved");
    expect(evidence.mediumMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("auto_approved with 3 medium signals (height + weight + rookie_year)", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: null, espnId: null, college: null, height: "72", weight: "200", rookieSeason: 2021 }),
      makeCanonical({ metaBirthDate: null, metaEspnId: null, metaCollege: null, metaHeightInches: 72, metaWeightLbs: 200, metaRookieYear: 2021 })
    );
    expect(evidence.tier).toBe("auto_approved");
    expect(evidence.mediumMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("high_confidence_review with only 1 medium signal", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: null, espnId: null, college: "Alabama", height: null, weight: null, rookieSeason: null }),
      makeCanonical({ metaBirthDate: null, metaEspnId: null, metaCollege: "Alabama", metaHeightInches: null, metaWeightLbs: null, metaRookieYear: null })
    );
    expect(evidence.tier).toBe("high_confidence_review");
    expect(evidence.mediumMatches).toHaveLength(1);
  });
});

describe("buildEvidenceComparison — birth date contradiction blocks repair", () => {
  it("conflict when birth dates both present but differ", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: "1999-05-15" }),
      makeCanonical({ metaBirthDate: "2000-05-15" })
    );
    expect(evidence.tier).toBe("conflict");
    expect(evidence.contradictions.some((c) => c.field === "birth_date")).toBe(true);
    expect(evidence.strongMatches).toHaveLength(0);
  });

  it("conflict even when all other signals match (birth date is hard block)", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: "1999-05-15", college: "Alabama", height: "72", weight: "200" }),
      makeCanonical({ metaBirthDate: "2000-05-15", metaCollege: "Alabama", metaHeightInches: 72, metaWeightLbs: 200 })
    );
    expect(evidence.tier).toBe("conflict");
    expect(evidence.contradictions[0]!.field).toBe("birth_date");
  });
});

describe("buildEvidenceComparison — ESPN ID contradiction blocks repair", () => {
  it("conflict when ESPN IDs both present but differ", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ espnId: "4569371", birthDate: null }),
      makeCanonical({ metaEspnId: "9999999", metaBirthDate: null })
    );
    expect(evidence.tier).toBe("conflict");
    expect(evidence.contradictions.some((c) => c.field === "espn_id")).toBe(true);
  });
});

describe("buildEvidenceComparison — suffix ambiguity requires review", () => {
  it("high_confidence_review when nflverse has suffix not present in canonical name", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ suffix: "Jr.", birthDate: "1999-05-15" }),
      makeCanonical({ metaBirthDate: "1999-05-15", fullName: "John Smith" }) // no "Jr." in name
    );
    // Birth date match is a strong signal but suffix conflict bumps to review
    expect(evidence.tier).toBe("high_confidence_review");
    expect(evidence.approvalReason).toContain("suffix_requires_review");
  });

  it("auto_approved when canonical name includes the suffix", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ suffix: "Jr.", birthDate: "1999-05-15" }),
      makeCanonical({ metaBirthDate: "1999-05-15", fullName: "John Smith Jr." })
    );
    expect(evidence.tier).toBe("auto_approved");
  });
});

describe("buildEvidenceComparison — metadata merge preserves unrelated fields", () => {
  it("evidence comparison does not mutate source or canonical objects", () => {
    const src = makeSource();
    const can = makeCanonical();
    const srcCopy = { ...src };
    const canCopy = { ...can };
    buildEvidenceComparison(src, can);
    expect(src).toEqual(srcCopy);
    expect(can).toEqual(canCopy);
  });
});

describe("buildEvidenceComparison — weight tolerance", () => {
  it("medium match when weights within 10 lbs", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: null, espnId: null, college: null, weight: "205", rookieSeason: null }),
      makeCanonical({ metaBirthDate: null, metaEspnId: null, metaCollege: null, metaWeightLbs: 200, metaRookieYear: null })
    );
    expect(evidence.mediumMatches.some((m) => m.field === "weight")).toBe(true);
  });

  it("no weight signal when difference exceeds 10 lbs", () => {
    const evidence = buildEvidenceComparison(
      makeSource({ birthDate: null, espnId: null, college: null, weight: "220", rookieSeason: null }),
      makeCanonical({ metaBirthDate: null, metaEspnId: null, metaCollege: null, metaWeightLbs: 200, metaRookieYear: null })
    );
    expect(evidence.mediumMatches.some((m) => m.field === "weight")).toBe(false);
  });
});
