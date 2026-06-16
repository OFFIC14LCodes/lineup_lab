import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildNflverseDiagnostics } from "./nflverse-diagnostics";
import { NFLVERSE_FILES } from "./nflverse-csv-loader";
import { normalizeNflversePlayer, normalizeNflversePosition, normalizeNflverseWeeklyStat } from "./nflverse-normalizer";
import { validateNflverseFile } from "./nflverse-validation";

describe("nflverse data acquisition bridge", () => {
  it("validates required columns without guessing missing fields", () => {
    const dataDir = tempNflverseDir({
      players: "gsis_id,display_name,position\n00-1,Test Player,QB\n",
    });

    const result = validateNflverseFile("players", dataDir);
    expect(result.exists).toBe(true);
    expect(result.rowCount).toBe(1);
    expect(result.missingColumns).toContain("position_group");
    expect(result.missingColumns).toContain("espn_id");
  });

  it("normalizes nflverse identity and defensive positions", () => {
    const player = normalizeNflversePlayer({
      gsis_id: "00-abc",
      display_name: "Example Defender",
      position: "NT",
      position_group: "DL",
      latest_team: "JAC",
      nfl_id: "nfl-1",
      pfr_id: "pfr-1",
      espn_id: "espn-1",
      smart_id: "smart-1",
    });

    expect(player.playerId).toBe("00-abc");
    expect(player.position).toBe("DL");
    expect(player.team).toBe("JAX");
    expect(player.ids).toMatchObject({
      gsisId: "00-abc",
      nflId: "nfl-1",
      pfrId: "pfr-1",
      espnId: "espn-1",
      smartId: "smart-1",
    });
    expect(normalizeNflversePosition("CB", "DB")).toBe("DB");
    expect(normalizeNflversePosition("OLB", "LB")).toBe("LB");
  });

  it("preserves offensive, defensive, and kicking weekly stat fields", () => {
    const row = normalizeNflverseWeeklyStat({
      player_id: "00-1",
      player_display_name: "Example Player",
      position: "LB",
      season: "2025",
      week: "1",
      team: "CHI",
      opponent_team: "GB",
      carries: "3",
      rushing_yards: "12",
      def_tackles_solo: "7",
      def_sacks: "1.5",
      fg_made: "0",
      fantasy_points: "24.5",
      fantasy_points_ppr: "24.5",
    });

    expect(row.offensiveStats.carries).toBe(3);
    expect(row.defensiveStats.def_tackles_solo).toBe(7);
    expect(row.defensiveStats.def_sacks).toBe(1.5);
    expect(row.kickingStats.fg_made).toBe(0);
    expect(row.fantasyPointsPpr).toBe(24.5);
  });

  it("builds a dry-run diagnostic report from local nflverse files", () => {
    const dataDir = tempNflverseDir({
      players: [
        "gsis_id,display_name,position_group,position,nfl_id,pfr_id,espn_id,smart_id,birth_date,height,weight,college_name,latest_team,years_of_experience,rookie_season,last_season,draft_year,draft_round,draft_pick,draft_team",
        "00-1,Example QB,QB,QB,nfl-1,pfr-1,espn-1,smart-1,2000-01-01,74,220,Example,KC,2,2024,2025,2024,1,1,KC",
        "00-2,Example LB,LB,OLB,nfl-2,pfr-2,espn-2,smart-2,1999-01-01,73,235,Example,CHI,3,2023,2025,2023,2,40,CHI",
      ].join("\n") + "\n",
      rosters: [
        "season,team,position,depth_chart_position,full_name,gsis_id,espn_id,pfr_id,sleeper_id,smart_id,years_exp,rookie_year,draft_club,draft_number,week,game_type",
        "2025,KC,QB,QB,Example QB,00-1,espn-1,pfr-1,sleeper-1,smart-1,2,2024,KC,1,1,REG",
      ].join("\n") + "\n",
      playerStats: [
        "player_id,player_display_name,position,position_group,season,week,team,opponent_team,passing_yards,passing_tds,carries,rushing_yards,targets,receptions,receiving_yards,def_tackles_solo,def_sacks,fg_made,fg_att,fg_missed,fg_blocked,fg_made_0_19,fg_made_20_29,fg_made_30_39,fg_made_40_49,fg_made_50_59,fg_made_60_,pat_made,pat_att,pat_missed,pat_blocked,fantasy_points,fantasy_points_ppr",
        "00-1,Example QB,QB,QB,2025,1,KC,LAC,250,2,4,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,22,22",
        "00-2,Example LB,OLB,LB,2025,1,CHI,GB,0,0,0,0,0,0,0,8,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,24",
      ].join("\n") + "\n",
      schedules: "game_id,season,game_type,week,gameday,away_team,home_team,away_score,home_score,away_qb_id,home_qb_id\n2025_01_LAC_KC,2025,REG,1,2025-09-05,LAC,KC,20,24,00-a,00-1\n",
    });

    const report = buildNflverseDiagnostics(dataDir);
    expect(report.verdict).toBe("passed");
    expect(report.rowCounts.players).toBe(2);
    expect(report.fantasyRelevantPlayers).toBe(2);
    expect(report.positionCounts).toMatchObject({ QB: 1, LB: 1 });
    expect(report.identityCoverage.playersWithGsisId).toBe(2);
    expect(report.weeklyStatRows2025).toBe(2);
    expect(report.rosterRows2025).toBe(1);
    expect(report.statColumnCoverage.idpRowsWithPositiveDefensiveStats).toBe(1);
  });
});

function tempNflverseDir(files: Partial<Record<keyof typeof NFLVERSE_FILES, string>>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "blackbird-nflverse-"));
  mkdirSync(dir, { recursive: true });
  for (const [key, fileName] of Object.entries(NFLVERSE_FILES)) {
    writeFileSync(path.join(dir, fileName), files[key as keyof typeof NFLVERSE_FILES] ?? "\n");
  }
  return dir;
}
