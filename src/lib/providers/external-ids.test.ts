import { describe, expect, it } from "vitest";

import { detectExternalIdConflict } from "@/lib/providers/external-ids";

describe("detectExternalIdConflict", () => {
  it("allows remapping to the same player", () => {
    expect(
      detectExternalIdConflict(
        {
          player_id: "11111111-1111-4111-8111-111111111111",
          provider: "sleeper",
          external_id: "1234",
          external_type: "player"
        },
        "11111111-1111-4111-8111-111111111111"
      )
    ).toBeNull();
  });

  it("flags cross-player ownership conflicts", () => {
    expect(
      detectExternalIdConflict(
        {
          player_id: "11111111-1111-4111-8111-111111111111",
          provider: "sportsdataio",
          external_id: "9999",
          external_type: "provider_player"
        },
        "22222222-2222-4222-8222-222222222222"
      )
    ).toContain("already mapped to another player");
  });
});
