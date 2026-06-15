import { describe, expect, it } from "vitest";

import {
  buildSourceAvailability,
  fieldCoverage,
  normalizeH98PlayerRow,
} from "./special-teams-defense-ingest";

const BASE = {
  season: "2025",
  week: "1",
  season_type: "REG",
  team: "BAL",
  opponent_team: "BUF",
};

describe("H9.8 source availability", () => {
  it("classifies present and missing fields without requiring a migration", () => {
    const availability = buildSourceAvailability({
      sourceColumns: new Set(["def_tackles_solo", "fg_made", "points_allowed"]),
      canonicalDbColumns: new Set(["stats_json", "points_allowed"]),
    });

    expect(availability.find((row) => row.field === "def_tackles_solo")).toMatchObject({
      category: "idp",
      present_in_source: true,
      present_in_canonical_db: true,
      requires_migration: false,
      requires_import_script: true,
    });
    expect(availability.find((row) => row.field === "blocked_kicks")).toMatchObject({
      present_in_source: false,
      requires_migration: false,
    });
    expect(availability.find((row) => row.field === "points_allowed")).toMatchObject({
      category: "dst",
      present_in_canonical_db: true,
      requires_import_script: false,
    });
  });
});

describe("H9.8 IDP normalization", () => {
  it("maps defensive source fields and preserves known zero separately from unavailable", () => {
    const result = normalizeH98PlayerRow({
      ...BASE,
      player_id: "00-0030001",
      player_display_name: "Line Backer",
      position: "OLB",
      position_group: "LB",
      def_tackles_solo: "6",
      def_tackle_assists: "2",
      def_tackles_with_assist: "8",
      def_sacks: "0",
      def_interceptions: "1",
      def_pass_defended: "1",
      def_fumbles_forced: "0",
      fumble_recovery_own: "1",
      fumble_recovery_opp: "0",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.row.category).toBe("idp");
    expect(result.row.positionGroup).toBe("LB");
    expect(result.row.stats).toMatchObject({
      solo_tkl: 6,
      ast_tkl: 2,
      tkl: 8,
      sack: 0,
      int: 1,
      pd: 1,
      ff: 0,
      fr: 1,
    });

    const coverage = fieldCoverage([result.row], ["sack", "qb_hit", "safe"]);
    expect(coverage.knownZeroFields).toContain("sack");
    expect(coverage.unavailableFields).toEqual(["qb_hit", "safe"]);
  });

  it("detects all-zero IDP rows", () => {
    const result = normalizeH98PlayerRow({
      ...BASE,
      player_id: "00-0030002",
      player_display_name: "Depth Defender",
      position: "CB",
      position_group: "DB",
      def_tackles_solo: "0",
      def_tackle_assists: "0",
      def_sacks: "0",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.row.allZeroStats).toBe(true);
  });
});

describe("H9.8 kicker normalization", () => {
  it("maps FG/XP stats and derives misses only from available attempts and makes", () => {
    const result = normalizeH98PlayerRow({
      ...BASE,
      player_id: "00-0030003",
      player_display_name: "Place Kicker",
      position: "K",
      position_group: "SPEC",
      fg_made: "2",
      fg_att: "3",
      fg_made_50_59: "1",
      fg_made_60_: "0",
      pat_made: "4",
      pat_att: "4",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.row.category).toBe("kicker");
    expect(result.row.positionGroup).toBe("K");
    expect(result.row.stats).toMatchObject({
      fgm: 2,
      fga: 3,
      fgmiss: 1,
      fgm_50_59: 1,
      fgm_60p: 0,
      fgm_50p: 1,
      xpm: 4,
      xpa: 4,
      xpmiss: 0,
    });
    expect(result.row.stats).not.toHaveProperty("fga_50p");
  });
});

describe("H9.8 category separation", () => {
  it("rejects offensive and non-kicker special-teams rows from IDP/K ingestion", () => {
    expect(normalizeH98PlayerRow({ ...BASE, player_id: "00-1", position: "WR", position_group: "WR" })).toMatchObject({
      ok: false,
      category: null,
    });
    expect(normalizeH98PlayerRow({ ...BASE, player_id: "00-2", position: "P", position_group: "SPEC" })).toMatchObject({
      ok: false,
      category: null,
    });
  });
});
