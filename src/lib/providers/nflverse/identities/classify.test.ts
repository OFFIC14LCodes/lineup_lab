import { describe, expect, it } from "vitest";

import {
  classifyRootCause,
  isLegacyGsisId,
  isPositionCompatible,
  isRepairableViaEspnId,
  isRepairableViaGsisId
} from "./classify";
import type { CanonicalPlayerInfo } from "./types";

const A: CanonicalPlayerInfo = {
  playerId: "aaaa-0001",
  sleeperId: "1234",
  fullName: "Travis Kelce",
  normalizedName: "travis kelce",
  positionGroup: "TE",
  team: "KC",
  metaGsisId: null,
  metaEspnId: null,
  metaStatsId: null,
  metaBirthDate: null,
  metaCollege: null,
  metaHeightInches: null,
  metaWeightLbs: null,
  metaRookieYear: null
};

const B: CanonicalPlayerInfo = {
  playerId: "bbbb-0002",
  sleeperId: "5678",
  fullName: "Travis Kelce II",
  normalizedName: "travis kelce",
  positionGroup: "RB",
  team: "NE",
  metaGsisId: null,
  metaEspnId: null,
  metaStatsId: null,
  metaBirthDate: null,
  metaCollege: null,
  metaHeightInches: null,
  metaWeightLbs: null,
  metaRookieYear: null
};

function make(overrides: Partial<CanonicalPlayerInfo> = {}): CanonicalPlayerInfo {
  return { ...A, ...overrides };
}

describe("isLegacyGsisId", () => {
  it("returns false for standard format", () => {
    expect(isLegacyGsisId("00-0039337")).toBe(false);
  });
  it("returns true for legacy alphanumeric", () => {
    expect(isLegacyGsisId("ALL637395")).toBe(true);
  });
  it("returns false for other formats", () => {
    expect(isLegacyGsisId("12345")).toBe(false);
  });
});

describe("isPositionCompatible", () => {
  it("returns true when both null", () => {
    expect(isPositionCompatible(null, null)).toBe(true);
  });
  it("returns true when positions match", () => {
    expect(isPositionCompatible("TE", "TE")).toBe(true);
  });
  it("returns false when positions differ", () => {
    expect(isPositionCompatible("QB", "TE")).toBe(false);
  });
  it("returns true when one side is null", () => {
    expect(isPositionCompatible("QB", null)).toBe(true);
    expect(isPositionCompatible(null, "RB")).toBe(true);
  });
});

describe("classifyRootCause", () => {
  const base = { gsisId: "00-0030506", espnId: "15847", positionGroup: "TE" };

  it("returns canonical_player_missing when no name candidates", () => {
    expect(classifyRootCause({
      nflversePlayer: base,
      allNameCandidates: [],
      positionCompatibleCandidates: [],
      hasExistingMapping: false
    })).toBe("canonical_player_missing");
  });

  it("returns position_mismatch when all candidates have incompatible positions", () => {
    expect(classifyRootCause({
      nflversePlayer: { ...base, positionGroup: "TE" },
      allNameCandidates: [make({ positionGroup: "QB" })],
      positionCompatibleCandidates: [],
      hasExistingMapping: false
    })).toBe("position_mismatch");
  });

  it("returns duplicate_canonical_candidate when multiple position-compatible matches", () => {
    expect(classifyRootCause({
      nflversePlayer: base,
      allNameCandidates: [A, B],
      positionCompatibleCandidates: [A, B],
      hasExistingMapping: false
    })).toBe("duplicate_canonical_candidate");
  });

  it("returns canonical_gsis_missing when exactly one candidate has no meta.gsis_id", () => {
    expect(classifyRootCause({
      nflversePlayer: base,
      allNameCandidates: [make({ positionGroup: "TE", metaGsisId: null })],
      positionCompatibleCandidates: [make({ positionGroup: "TE", metaGsisId: null })],
      hasExistingMapping: false
    })).toBe("canonical_gsis_missing");
  });

  it("returns identifier_format_mismatch when candidate gsis_id differs from source", () => {
    expect(classifyRootCause({
      nflversePlayer: base,
      allNameCandidates: [make({ positionGroup: "TE", metaGsisId: "00-0099999" })],
      positionCompatibleCandidates: [make({ positionGroup: "TE", metaGsisId: "00-0099999" })],
      hasExistingMapping: false
    })).toBe("identifier_format_mismatch");
  });

  it("returns conflicting_external_mapping when existing mapping flag is set", () => {
    expect(classifyRootCause({
      nflversePlayer: base,
      allNameCandidates: [make()],
      positionCompatibleCandidates: [make()],
      hasExistingMapping: true
    })).toBe("conflicting_external_mapping");
  });

  it("returns legacy_or_duplicate_source_identity for legacy GSIS format", () => {
    expect(classifyRootCause({
      nflversePlayer: { ...base, gsisId: "ALL637395" },
      allNameCandidates: [],
      positionCompatibleCandidates: [],
      hasExistingMapping: false
    })).toBe("legacy_or_duplicate_source_identity");
  });

  it("returns source_identifier_missing when candidate has gsis_id match but nflverse has no espn_id", () => {
    // This shouldn't normally happen (if gsis_id matched, bootstrap would have found it)
    // but classified as unknown in that path
    expect(classifyRootCause({
      nflversePlayer: { ...base, espnId: null, positionGroup: "TE" },
      allNameCandidates: [make({ positionGroup: "TE", metaGsisId: "00-0030506", metaEspnId: null })],
      positionCompatibleCandidates: [make({ positionGroup: "TE", metaGsisId: "00-0030506", metaEspnId: null })],
      hasExistingMapping: false
    })).toBe("source_identifier_missing");
  });

  it("returns canonical_espn_missing when candidate has gsis_id match but no meta espn_id", () => {
    // canonical.gsis_id matches → should have been found by bridge; if still unresolved
    // with espnId in nflverse but not in canonical, classify as espn_missing
    expect(classifyRootCause({
      nflversePlayer: base,
      allNameCandidates: [make({ positionGroup: "TE", metaGsisId: null, metaEspnId: null })],
      positionCompatibleCandidates: [make({ positionGroup: "TE", metaGsisId: null, metaEspnId: null })],
      hasExistingMapping: false
    })).toBe("canonical_gsis_missing"); // gsis_id missing takes priority over espn_id missing
  });
});

describe("isRepairableViaGsisId", () => {
  it("returns true for canonical_gsis_missing", () => {
    expect(isRepairableViaGsisId("canonical_gsis_missing")).toBe(true);
  });
  it("returns false for other causes", () => {
    expect(isRepairableViaGsisId("canonical_player_missing")).toBe(false);
    expect(isRepairableViaGsisId("duplicate_canonical_candidate")).toBe(false);
  });
});

describe("isRepairableViaEspnId", () => {
  it("returns true for canonical_espn_missing with nflverse espn_id present", () => {
    expect(isRepairableViaEspnId("canonical_espn_missing", "15847")).toBe(true);
  });
  it("returns false when espn_id is null", () => {
    expect(isRepairableViaEspnId("canonical_espn_missing", null)).toBe(false);
  });
  it("returns false for non-espn-missing cause", () => {
    expect(isRepairableViaEspnId("canonical_gsis_missing", "15847")).toBe(false);
  });
});
