import { describe, expect, it } from "vitest";

import {
  auditLeagueRoster,
  classifyScoringKeyProjectability,
  relevantScoringKeys,
  type DataPresence,
} from "./idp-dst-k-audit";

function data(overrides: Partial<DataPresence> = {}): DataPresence {
  const fields = new Set(["xpm", "fgm_40_49", "solo_tkl", "sack", "kickoff_return_yards"]);
  const teamFields = new Set(["points_allowed", "yards_allowed"]);
  return {
    hasIdpWeeklyRows: true,
    hasDstWeeklyRows: false,
    hasKickerWeeklyRows: true,
    hasTeamGameRows: true,
    hasField: (field) => fields.has(field),
    hasTeamField: (field) => teamFields.has(field),
    ...overrides,
  };
}

describe("H9.7 roster requirement audit", () => {
  it("detects IDP, kicker, team defense, and return requirements without mixing them into offense", () => {
    const audit = auditLeagueRoster({
      leagueId: "league-1",
      leagueName: "League",
      season: 2026,
      rosterPositions: ["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB", "IDP_FLEX", "BN"],
      scoringSettings: { kick_ret_yd: 0.04, rec: 1 },
    });

    expect(audit.uses_idp).toBe(true);
    expect(audit.uses_dst).toBe(true);
    expect(audit.uses_kicker).toBe(true);
    expect(audit.uses_return_scoring).toBe(true);
    expect(audit.idp_slots).toBe(4);
    expect(audit.dst_slots).toBe(1);
    expect(audit.k_slots).toBe(1);
    expect(audit.war_room_required).toBe(true);
  });
});

describe("H9.7 scoring-key projectability", () => {
  it("classifies kicker keys as projectable only when K rows and stats exist", () => {
    expect(classifyScoringKeyProjectability("xpm", "kicker", data())).toBe("PROJECTABLE_NOW");
    expect(classifyScoringKeyProjectability("fgm_50p", "kicker", data())).toBe("UNSUPPORTED_NEEDS_DATA");
    expect(classifyScoringKeyProjectability("xpm", "kicker", data({ hasKickerWeeklyRows: false }))).toBe("UNSUPPORTED_NEEDS_DATA");
  });

  it("classifies IDP volume keys separately from missing IDP data", () => {
    expect(classifyScoringKeyProjectability("solo_tkl", "idp", data())).toBe("PROJECTABLE_NOW");
    expect(classifyScoringKeyProjectability("qb_hit", "idp", data())).toBe("UNSUPPORTED_NEEDS_DATA");
    expect(classifyScoringKeyProjectability("solo_tkl", "idp", data({ hasIdpWeeklyRows: false }))).toBe("UNSUPPORTED_NEEDS_DATA");
  });

  it("classifies DST allowance keys from team-game context and does not require offensive rows", () => {
    expect(classifyScoringKeyProjectability("pts_allow_0", "dst", data())).toBe("PROJECTABLE_NOW");
    expect(classifyScoringKeyProjectability("yds_allow_550p", "dst", data())).toBe("PROJECTABLE_NOW");
    expect(classifyScoringKeyProjectability("sack", "dst", data())).toBe("UNSUPPORTED_NEEDS_DATA");
  });

  it("keeps return scoring separate from the offensive projection model", () => {
    expect(classifyScoringKeyProjectability("kick_ret_yd", "return", data())).toBe("PROJECTABLE_APPROXIMATION");
    expect(classifyScoringKeyProjectability("return_fd", "return", data())).toBe("UNSUPPORTED_NEEDS_DATA");
  });

  it("extracts only non-offensive audit keys from league scoring settings", () => {
    expect(relevantScoringKeys({ rec: 1, xpm: 1, sack: 1, kick_ret_yd: 0.04, pass_yd: 0.04 })).toEqual([
      "kick_ret_yd",
      "sack",
      "xpm",
    ]);
  });
});
