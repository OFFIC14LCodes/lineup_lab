import { describe, expect, it } from "vitest";

import { buildLeagueInventory, findLineagePairs, parseH6CliArgs, selectTargetLeagues } from "@/lib/draft-data/targeting";
import type { DraftDataLeague } from "@/lib/draft-data/types";

describe("H6 targeting", () => {
  const leagues = [
    league("row-2026-a", "ext-2026-a", 2026, "current", "ext-2025-a"),
    league("row-2026-b", "ext-2026-b", 2026, "current", null),
    league("row-2025-a", "ext-2025-a", 2025, "complete", null)
  ];

  it("parses separate performance and league config seasons", () => {
    expect(parseH6CliArgs(["--performance-season=2025", "--league-config-season=2026"])).toMatchObject({
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      deprecatedSeasonUsed: false
    });
  });

  it("preserves deprecated --season as performance season with a flag", () => {
    expect(parseH6CliArgs(["--season=2025"]).deprecatedSeasonUsed).toBe(true);
    expect(parseH6CliArgs(["--season=2025"]).performanceSeason).toBe(2025);
  });

  it("selects exact internal or external league ID before config-season filtering", () => {
    expect(selectTargetLeagues({ leagues, args: parseH6CliArgs(["--performance-season=2025", "--league-id=row-2026-b"]), operatorUserId: "user-1" })).toHaveLength(1);
    expect(selectTargetLeagues({ leagues, args: parseH6CliArgs(["--performance-season=2025", "--league-id=ext-2026-a"]), operatorUserId: "user-1" })[0]?.id).toBe("row-2026-a");
  });

  it("selects multiple operator-owned leagues by league config season", () => {
    const selected = selectTargetLeagues({
      leagues,
      args: parseH6CliArgs(["--performance-season=2025", "--league-config-season=2026"]),
      operatorUserId: "user-1"
    });
    expect(selected.map((league) => league.id)).toEqual(["row-2026-a", "row-2026-b"]);
  });

  it("fails clearly when no safe target exists", () => {
    expect(() =>
      selectTargetLeagues({
        leagues,
        args: parseH6CliArgs(["--performance-season=2025", "--league-config-season=2024"]),
        operatorUserId: "user-1"
      })
    ).toThrow(/No operator-owned leagues/);
  });

  it("reports inventory and lineage without auto-preferring historical config", () => {
    const inventory = buildLeagueInventory(leagues);
    expect(inventory[0]?.previousLeagueId).toBe("ext-2025-a");
    expect(findLineagePairs(leagues)[0]?.previousLeague?.id).toBe("row-2025-a");
  });
});

function league(id: string, platformLeagueId: string, season: number, status: string, previousLeagueId: string | null): DraftDataLeague {
  return {
    id,
    user_id: "user-1",
    platform: "sleeper",
    platform_league_id: platformLeagueId,
    name: id,
    season,
    status,
    total_teams: 12,
    scoring_settings_json: { rec: 1 },
    roster_positions_json: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
    settings_json: previousLeagueId ? { previous_league_id: previousLeagueId } : {}
  };
}

