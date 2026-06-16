import { describe, expect, it } from "vitest";

import { makeIdentityRecord } from "./identity-normalization";
import { matchPlayerIdentity } from "./identity-matcher";
import type { PlayerIdentityRecord } from "./identity-match-types";

describe("Blackbird player identity matcher", () => {
  it("applies approved manual overrides before exact ID matches", () => {
    const source = record({ playerName: "Wrong Attachment", position: "WR", sleeperId: "s1" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_rosters", playerId: "wrong", playerName: "Wrong Attachment", position: "WR", sleeperId: "s1", gsisId: "00-wrong" }),
      record({ source: "nflverse_rosters", playerId: "right", playerName: "Correct Player", position: "DB", gsisId: "00-right" }),
    ], {
      manualOverrides: [{ sleeperId: "s1", gsisId: "00-right", reason: "profile was attached to the wrong player", reviewStatus: "approved", sourceRow: 2 }],
    });

    expect(match.confidence).toBe("manual_override");
    expect(match.matchedPlayer?.playerId).toBe("right");
    expect(match.preservedIds.sleeperId).toBe("s1");
    expect(match.preservedIds.gsisId).toBe("00-right");
    expect(match.matchReasons).toContain("manual override applied: sleeper_id s1 -> gsis_id 00-right");
  });

  it("flags manual overrides whose target gsis_id is missing", () => {
    const source = record({ playerName: "Missing Target", position: "WR", sleeperId: "s1" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_rosters", playerName: "Missing Target", position: "WR", sleeperId: "s1", gsisId: "00-wrong" }),
    ], {
      manualOverrides: [{ sleeperId: "s1", gsisId: "00-missing", reason: "test missing target", reviewStatus: "approved", sourceRow: 2 }],
    });

    expect(match.confidence).toBe("conflict");
    expect(match.matchedPlayer).toBeNull();
    expect(match.conflictReasons).toContain("manual override target gsis_id not found: 00-missing");
  });

  it("flags duplicate approved manual overrides for the same sleeper_id", () => {
    const source = record({ playerName: "Duplicate Override", position: "WR", sleeperId: "s1" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_rosters", playerName: "Duplicate Override", position: "WR", sleeperId: "s1", gsisId: "00-wrong" }),
    ], {
      manualOverrides: [
        { sleeperId: "s1", gsisId: "00-one", reason: "one", reviewStatus: "approved", sourceRow: 2 },
        { sleeperId: "s1", gsisId: "00-two", reason: "two", reviewStatus: "approved", sourceRow: 3 },
      ],
    });

    expect(match.confidence).toBe("conflict");
    expect(match.conflictReasons[0]).toContain("multiple approved manual overrides");
  });

  it("matches by exact preserved source ID", () => {
    const source = record({ playerName: "Amon-Ra St. Brown", position: "WR", sleeperId: "7547" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_rosters", playerName: "Amon-Ra St. Brown", position: "WR", sleeperId: "7547", gsisId: "00-0036963" }),
    ]);

    expect(match.confidence).toBe("exact_id");
    expect(match.preservedIds.sleeperId).toBe("7547");
    expect(match.preservedIds.gsisId).toBe("00-0036963");
    expect(match.matchReasons).toContain("exact ID match: sleeper_id");
  });

  it("matches normalized names with suffix handling", () => {
    const source = record({ playerName: "Marvin Harrison Jr.", position: "WR", team: "ARI" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_players", playerName: "Marvin Harrison", position: "WR", team: "ARI", gsisId: "00-rookie" }),
    ]);

    expect(match.confidence).toBe("strong");
    expect(match.matchReasons).toContain("normalized full name match");
    expect(match.matchReasons).toContain("team match");
  });

  it("normalizes apostrophes, punctuation, and hyphens", () => {
    const source = record({ playerName: "Ka'imi Fairbairn", position: "K", team: "HOU" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_players", playerName: "Kaimi Fairbairn", position: "K", team: "HOU" }),
      record({ source: "nflverse_players", playerName: "Jean-Luc Example", position: "WR", team: "NO" }),
    ]);

    expect(match.confidence).toBe("strong");
    expect(match.matchedPlayer?.playerName).toBe("Kaimi Fairbairn");
  });

  it("lowers confidence when team differs but name and position match", () => {
    const source = record({ playerName: "Kenneth Gainwell", position: "RB", team: "PHI" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_players", playerName: "Kenneth Gainwell", position: "RB", team: "TB" }),
    ]);

    expect(match.confidence).toBe("medium");
    expect(match.matchReasons.some((reason) => reason.includes("team mismatch lowered confidence"))).toBe(true);
  });

  it("keeps position mismatch as a weak explainable match", () => {
    const source = record({ playerName: "Taysom Hill", position: "TE", team: "NO" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_players", playerName: "Taysom Hill", position: "QB", team: "NO" }),
    ]);

    expect(match.confidence).toBe("weak");
    expect(match.conflictReasons).toContain("position mismatch: TE vs QB");
  });

  it("flags duplicate best candidates as a conflict", () => {
    const source = record({ playerName: "Duplicate Player", position: "WR", team: "KC" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_players", playerId: "nfl-1", playerName: "Duplicate Player", position: "WR", team: "KC" }),
      record({ source: "nflverse_players", playerId: "nfl-2", playerName: "Duplicate Player", position: "WR", team: "KC" }),
    ]);

    expect(match.confidence).toBe("conflict");
    expect(match.candidateCount).toBe(2);
    expect(match.conflictReasons[0]).toContain("duplicate candidates");
  });

  it("returns unmatched when no reasonable candidate exists", () => {
    const source = record({ playerName: "No Match", position: "DB", team: "DEN" });
    const match = matchPlayerIdentity(source, [
      record({ source: "nflverse_players", playerName: "Other Player", position: "DB", team: "DEN" }),
    ]);

    expect(match.confidence).toBe("unmatched");
    expect(match.matchedPlayer).toBeNull();
  });
});

function record(input: {
  source?: PlayerIdentityRecord["source"];
  playerId?: string;
  playerName: string;
  position: string;
  team?: string;
  sleeperId?: string;
  gsisId?: string;
}): PlayerIdentityRecord {
  const result = makeIdentityRecord({
    source: input.source ?? "blackbird_context",
    playerId: input.playerId ?? input.sleeperId ?? input.gsisId ?? input.playerName,
    playerName: input.playerName,
    position: input.position,
    team: input.team ?? null,
    ids: {
      blackbirdPlayerId: input.source ? null : input.playerId ?? null,
      sleeperId: input.sleeperId ?? null,
      gsisId: input.gsisId ?? null,
    },
  });
  if (!result) throw new Error("test identity record failed to build");
  return result;
}
