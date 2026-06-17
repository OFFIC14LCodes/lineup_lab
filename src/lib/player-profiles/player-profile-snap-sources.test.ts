import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadPlayerProfileSnapSources, markSnapSourceMatches } from "./player-profile-snap-sources";

describe("player profile snap and participation sources", () => {
  it("loads, validates, and indexes snap count rows", () => {
    const root = fixtureProject({
      snapCsv: [
        "game_id,pfr_game_id,season,game_type,week,player,pfr_player_id,position,team,opponent,offense_snaps,offense_pct,defense_snaps,defense_pct,st_snaps,st_pct",
        "2025_01_A_B,202509010aaa,2025,REG,1,Test Runner,TestRu00,RB,TST,OPP,48,0.8,0,0,3,0.1",
      ].join("\n"),
      participationCsv: [
        "nflverse_game_id,play_id,offense_players,defense_players",
        "2025_01_A_B,1,00-0000001;00-0000002,00-0000003",
        "2025_01_A_B,2,00-0000001,00-0000003;00-0000004",
      ].join("\n"),
    });

    try {
      const sources = loadPlayerProfileSnapSources(root);

      expect(sources.diagnostics.snapCounts.exists).toBe(true);
      expect(sources.diagnostics.snapCounts.missingColumns).toEqual([]);
      expect(sources.diagnostics.snapCounts.rowCount).toBe(1);
      expect(sources.diagnostics.snapCounts.seasons).toEqual([2025]);
      expect(sources.snapCountsByPfrId.get("TestRu00")?.[0]?.offenseSnapShare).toBe(0.8);
      expect(sources.participationByGsisId.get("00-0000001")?.[0]?.offensePlays).toBe(2);
      expect(sources.participationByGsisId.get("00-0000003")?.[0]?.defensePlays).toBe(2);

      const matched = markSnapSourceMatches(sources, { matchedPfrIds: new Set(["TestRu00"]), matchedGsisIds: new Set(["00-0000001"]) });
      expect(matched.snapCounts.matchedRows).toBe(1);
      expect(matched.participation.matchedRows).toBe(1);
      expect(matched.participation.unmatchedRows).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports missing required columns without throwing", () => {
    const root = fixtureProject({
      snapCsv: "season,week,player\n2025,1,Incomplete",
      participationCsv: "nflverse_game_id,play_id\n2025_01_A_B,1",
    });

    try {
      const sources = loadPlayerProfileSnapSources(root);

      expect(sources.snapCountsByPfrId.size).toBe(0);
      expect(sources.participationByGsisId.size).toBe(0);
      expect(sources.diagnostics.snapCounts.missingColumns).toContain("pfr_player_id");
      expect(sources.diagnostics.participation.missingColumns).toContain("offense_players");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureProject(input: { snapCsv: string; participationCsv: string }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "blackbird-snap-sources-"));
  const dataDir = path.join(root, "data", "nflverse");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "snap_counts_2018_2025.csv"), `${input.snapCsv}\n`, "utf8");
  writeFileSync(path.join(dataDir, "participation_2018_2025.csv"), `${input.participationCsv}\n`, "utf8");
  return root;
}
