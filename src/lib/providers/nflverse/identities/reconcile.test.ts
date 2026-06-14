import { describe, expect, it } from "vitest";

import { evaluateGsisReconciliationTarget } from "./reconcile";
import type { CanonicalPlayerInfo, NflversePlayerInfo } from "./types";

const nflversePlayer: NflversePlayerInfo = {
  gsisId: "00-0039108",
  displayName: "Will Anderson Jr.",
  normalizedName: "will anderson jr",
  positionGroup: "DL",
  rawPosition: "DE",
  latestTeam: "HOU",
  espnId: "4685724",
  birthDate: "2001-09-02",
  college: "Alabama",
  height: "76",
  weight: "243",
  status: "ACT",
  lastSeason: 2026,
  suffix: "Jr.",
  rookieSeason: 2023,
  draftYear: 2023,
  draftRound: 1,
  draftPick: 3
};

const canonicalPlayer: CanonicalPlayerInfo = {
  playerId: "11111111-1111-4111-8111-111111111111",
  sleeperId: "10827",
  fullName: "Will Anderson Jr.",
  normalizedName: "will anderson jr",
  positionGroup: "DL",
  team: "HOU",
  metaGsisId: null,
  metaEspnId: null,
  metaStatsId: null,
  metaBirthDate: "2001-09-02",
  metaCollege: "Alabama",
  metaHeightInches: 76,
  metaWeightLbs: 243,
  metaRookieYear: 2023
};

describe("evaluateGsisReconciliationTarget", () => {
  it("marks an auto-approved unique candidate as repairable", () => {
    const result = evaluateGsisReconciliationTarget({
      gsisId: nflversePlayer.gsisId,
      nflversePlayer,
      allNameCandidates: [canonicalPlayer],
      existingMappingPlayerId: null
    });

    expect(result.status).toBe("repairable");
    expect(result.canonicalPlayer?.playerId).toBe(canonicalPlayer.playerId);
    expect(result.evidenceTier).toBe("auto_approved");
  });

  it("marks a fully repaired target as existing", () => {
    const result = evaluateGsisReconciliationTarget({
      gsisId: nflversePlayer.gsisId,
      nflversePlayer,
      allNameCandidates: [{ ...canonicalPlayer, metaGsisId: nflversePlayer.gsisId }],
      existingMappingPlayerId: canonicalPlayer.playerId
    });

    expect(result.status).toBe("existing");
    expect(result.reason).toBe("mapping_and_metadata_already_present");
  });

  it("marks an existing mapping to another player as conflict", () => {
    const result = evaluateGsisReconciliationTarget({
      gsisId: nflversePlayer.gsisId,
      nflversePlayer,
      allNameCandidates: [canonicalPlayer],
      existingMappingPlayerId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.status).toBe("conflict");
    expect(result.reason).toContain("existing_mapping_conflict");
  });

  it("marks a canonical metadata mismatch as conflict", () => {
    const result = evaluateGsisReconciliationTarget({
      gsisId: nflversePlayer.gsisId,
      nflversePlayer,
      allNameCandidates: [{ ...canonicalPlayer, metaGsisId: "00-0099999" }],
      existingMappingPlayerId: null
    });

    expect(result.status).toBe("conflict");
    expect(result.reason).toContain("canonical_gsis_conflict");
  });

  it("marks multiple compatible candidates as unresolved", () => {
    const result = evaluateGsisReconciliationTarget({
      gsisId: nflversePlayer.gsisId,
      nflversePlayer,
      allNameCandidates: [
        canonicalPlayer,
        { ...canonicalPlayer, playerId: "33333333-3333-4333-8333-333333333333", sleeperId: "9999" }
      ],
      existingMappingPlayerId: null
    });

    expect(result.status).toBe("unresolved");
    expect(result.reason).toBe("duplicate_canonical_candidates");
  });
});
