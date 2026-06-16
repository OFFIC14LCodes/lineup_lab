import { describe, expect, it } from "vitest";

import { makeIdentityRecord, matchPlayerIdentity } from "@/lib/data-acquisition/player-identity";

import { normalizeSleeperPlayer } from "./sleeper-player-normalizer";

describe("Sleeper player acquisition normalizer", () => {
  it("normalizes identity fields and preserves external IDs", () => {
    const player = normalizeSleeperPlayer({
      player_id: "7547",
      full_name: "Amon-Ra St. Brown",
      first_name: "Amon-Ra",
      last_name: "St. Brown",
      search_full_name: "amonra st brown",
      position: "WR",
      fantasy_positions: ["WR"],
      team: "DET",
      status: "Active",
      active: true,
      age: "26",
      birth_date: "1999-10-24",
      height: "6'0\"",
      weight: "202",
      college: "USC",
      years_exp: "5",
      injury_status: "Healthy",
      search_rank: "15",
      espn_id: "4374302",
      metadata: {
        pfr_id: "StxxAm00",
        sportradar_id: "sr-1",
      },
    });

    expect(player?.sleeperId).toBe("7547");
    expect(player?.position).toBe("WR");
    expect(player?.height).toBe(72);
    expect(player?.weight).toBe(202);
    expect(player?.active).toBe(true);
    expect(player?.externalIds).toMatchObject({
      espn_id: "4374302",
      pfr_id: "StxxAm00",
      sportradar_id: "sr-1",
    });
  });

  it("supports exact identity matching through Sleeper ID", () => {
    const sleeper = normalizeSleeperPlayer({
      player_id: "8676",
      full_name: "Rashid Shaheed",
      position: "WR",
      team: "SEA",
      active: true,
    });
    if (!sleeper) throw new Error("Sleeper test player did not normalize");

    const source = makeIdentityRecord({
      source: "sleeper_export",
      playerId: sleeper.sleeperId,
      playerName: sleeper.playerName,
      position: sleeper.position,
      team: sleeper.team,
      active: sleeper.active,
      ids: { sleeperId: sleeper.sleeperId },
      sourceRefs: ["data/sleeper/raw/players-nfl.json"],
    });
    const candidate = makeIdentityRecord({
      source: "nflverse_rosters",
      playerId: "00-0037545",
      playerName: "Rashid Shaheed",
      position: "WR",
      team: "SEA",
      ids: { sleeperId: "8676", gsisId: "00-0037545" },
    });

    if (!source || !candidate) throw new Error("Identity records did not build");
    const match = matchPlayerIdentity(source, [candidate]);
    expect(match.confidence).toBe("exact_id");
    expect(match.preservedIds.sleeperId).toBe("8676");
    expect(match.preservedIds.gsisId).toBe("00-0037545");
  });
});
