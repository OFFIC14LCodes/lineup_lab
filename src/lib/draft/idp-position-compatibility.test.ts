import { describe, expect, it } from "vitest";

import { getIdpPositionCompatibility, normalizeIdpPositionGroup } from "./idp-position-compatibility";

describe("IDP position compatibility", () => {
  it.each([
    ["S", "DB"],
    ["CB", "DB"],
    ["FS", "DB"],
    ["SS", "DB"],
  ])("maps %s to DB", (source, expected) => {
    expect(normalizeIdpPositionGroup(source)).toBe(expected);
  });

  it.each([
    ["DE", "DL"],
    ["DT", "DL"],
  ])("maps %s to DL", (source, expected) => {
    expect(normalizeIdpPositionGroup(source)).toBe(expected);
  });

  it.each([
    ["ILB", "LB"],
    ["OLB", "LB"],
    ["MLB", "LB"],
  ])("maps %s to LB", (source, expected) => {
    expect(normalizeIdpPositionGroup(source)).toBe(expected);
  });

  it("allows source position compatible with grouped H10 position", () => {
    expect(getIdpPositionCompatibility("SS", "DB")).toMatchObject({
      compatible: true,
      normalizedSource: "DB",
      normalizedTarget: "DB",
      reasonCodes: ["IDP_POSITION_GROUP_COMPATIBLE", "IDP_HYBRID_POSITION_NORMALIZED"],
    });
  });

  it("allows LB/DB hybrid groups with explicit normalization", () => {
    expect(getIdpPositionCompatibility("DB", "LB")).toMatchObject({
      compatible: true,
      reasonCodes: ["IDP_POSITION_GROUP_COMPATIBLE", "IDP_HYBRID_POSITION_NORMALIZED"],
    });
  });

  it("rejects incompatible IDP groups without name fallback", () => {
    expect(getIdpPositionCompatibility("DB", "DL")).toMatchObject({
      compatible: false,
      rejectionReason: "IDP_POSITION_MISMATCH_REJECTED",
    });
  });
});
