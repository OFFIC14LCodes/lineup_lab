import { describe, expect, it } from "vitest";

import { canTransitionImportSessionStatus, validateApprovedPlayerId } from "@/lib/providers/import/workflow";

describe("provider import workflow guards", () => {
  it("validates allowed session transitions", () => {
    expect(canTransitionImportSessionStatus("ready", "executing")).toBe(true);
    expect(canTransitionImportSessionStatus("completed", "executing")).toBe(false);
    expect(canTransitionImportSessionStatus("expired", "ready")).toBe(false);
  });

  it("rejects substituting a different player for mapping-required rows", () => {
    expect(() =>
      validateApprovedPlayerId(
        {
          record: {} as never,
          playerId: "allowed-player",
          provider: "manual",
          providerExternalId: "external",
          externalType: "player",
          suggestedMappingMethod: "manual",
          confidence: 1,
          reasons: [],
          warnings: [],
          proposedExternalMapping: {
            player_id: "allowed-player",
            provider: "manual",
            external_id: "external",
            external_type: "player"
          }
        },
        "different-player"
      )
    ).toThrow("server-selected player");
  });

  it("accepts only stored candidates for review rows", () => {
    expect(validateApprovedPlayerId({
      record: {} as never,
      code: "PLAYER_UNRESOLVED",
      reasons: [],
      warnings: [],
      candidatePlayerIds: ["one", "two"]
    }, "two")).toBe("two");

    expect(() =>
      validateApprovedPlayerId({
        record: {} as never,
        code: "PLAYER_UNRESOLVED",
        reasons: [],
        warnings: [],
        candidatePlayerIds: ["one", "two"]
      }, "three")
    ).toThrow("not valid");
  });
});
