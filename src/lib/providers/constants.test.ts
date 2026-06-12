import { describe, expect, it } from "vitest";

import {
  normalizeExternalEntityType,
  normalizeMappingMethod,
  normalizeMappingStatus,
  normalizeProviderName
} from "@/lib/providers/constants";

describe("provider constants", () => {
  it("normalizes supported provider names", () => {
    expect(normalizeProviderName("Sleeper")).toBe("sleeper");
    expect(normalizeProviderName(" sportsdataio ")).toBe("sportsdataio");
  });

  it("rejects unknown provider names", () => {
    expect(() => normalizeProviderName("unknown-provider")).toThrow("Unsupported provider");
  });

  it("normalizes external types and mapping states", () => {
    expect(normalizeExternalEntityType("TEAM_DEFENSE")).toBe("team_defense");
    expect(normalizeMappingStatus("VERIFIED")).toBe("verified");
    expect(normalizeMappingMethod("exact_name_team")).toBe("exact_name_team");
  });
});
