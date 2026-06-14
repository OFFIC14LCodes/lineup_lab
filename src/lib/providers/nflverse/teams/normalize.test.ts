import { describe, expect, it } from "vitest";

import { normalizeNflTeamId, requireNflTeamId } from "./normalize";
import { NFL_TEAMS } from "./registry";

describe("normalizeNflTeamId", () => {
  it("returns the canonical ID for all 32 registry teams", () => {
    for (const team of NFL_TEAMS) {
      expect(normalizeNflTeamId(team.id)).toBe(team.id);
    }
  });

  it("resolves JAC → JAX", () => {
    expect(normalizeNflTeamId("JAC")).toBe("JAX");
    expect(normalizeNflTeamId("jac")).toBe("JAX");
  });

  it("resolves WSH → WAS", () => {
    expect(normalizeNflTeamId("WSH")).toBe("WAS");
  });

  it("resolves LAR → LA", () => {
    expect(normalizeNflTeamId("LAR")).toBe("LA");
  });

  it("resolves OAK → LV", () => {
    expect(normalizeNflTeamId("OAK")).toBe("LV");
  });

  it("resolves SD → LAC", () => {
    expect(normalizeNflTeamId("SD")).toBe("LAC");
  });

  it("resolves STL → LA", () => {
    expect(normalizeNflTeamId("STL")).toBe("LA");
  });

  it("returns null for free-agent markers", () => {
    expect(normalizeNflTeamId("FA")).toBeNull();
    expect(normalizeNflTeamId("NONE")).toBeNull();
    expect(normalizeNflTeamId("NULL")).toBeNull();
    expect(normalizeNflTeamId("null")).toBeNull();
  });

  it("returns null for empty / undefined", () => {
    expect(normalizeNflTeamId("")).toBeNull();
    expect(normalizeNflTeamId(null)).toBeNull();
    expect(normalizeNflTeamId(undefined)).toBeNull();
  });

  it("returns null for unrecognized abbreviations", () => {
    expect(normalizeNflTeamId("XYZ")).toBeNull();
    expect(normalizeNflTeamId("TEAM")).toBeNull();
  });

  it("is case-insensitive for known teams", () => {
    expect(normalizeNflTeamId("kc")).toBe("KC");
    expect(normalizeNflTeamId("Buf")).toBe("BUF");
    expect(normalizeNflTeamId("las")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(normalizeNflTeamId("  KC  ")).toBe("KC");
    expect(normalizeNflTeamId(" JAC ")).toBe("JAX");
  });
});

describe("requireNflTeamId", () => {
  it("returns the canonical ID for valid teams", () => {
    expect(requireNflTeamId("KC")).toBe("KC");
    expect(requireNflTeamId("LAR")).toBe("LA");
  });

  it("throws for unrecognized abbreviations", () => {
    expect(() => requireNflTeamId("XYZ")).toThrow("Unrecognized NFL team abbreviation");
    expect(() => requireNflTeamId(null)).toThrow("Unrecognized NFL team abbreviation");
  });

  it("includes context in error message when provided", () => {
    expect(() => requireNflTeamId("XYZ", "game_id 2025_01_XYZ_KC")).toThrow("game_id 2025_01_XYZ_KC");
  });
});
