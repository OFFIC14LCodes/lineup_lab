import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard, type BlackbirdBoardRow } from "@/lib/draft/blackbird-board";
import { filterDraftablePlayers } from "@/lib/draft/player-draftability";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import { buildWarRoomBoardPipelineDiagnostics } from "./war-room-board-pipeline-diagnostics";

describe("war room board pipeline diagnostics", () => {
  it("keeps the site board aligned to the corrected audit-style Blackbird rank", () => {
    const rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN"];
    const draftable = filterDraftablePlayers([
      player({ name: "Josh Allen", position: "QB", rank: 1, marketRank: 1, projection: 430, sourceConfidence: "high" }),
      player({ name: "Puka Nacua", position: "WR", rank: 16, marketRank: 16, projection: 390, sourceConfidence: "high" }),
      player({ name: "Jahmyr Gibbs", position: "RB", rank: 8, marketRank: 8, projection: 370, sourceConfidence: "high" }),
      player({ name: "Jalen Hurts", position: "QB", rank: 10, marketRank: 10, projection: 365, sourceConfidence: "high" }),
      player({ name: "Ja'Marr Chase", position: "WR", rank: 3, marketRank: 3, projection: 360, sourceConfidence: "high" }),
      player({ name: "Bijan Robinson", position: "RB", rank: 5, marketRank: 5, projection: 340, sourceConfidence: "high" }),
      player({ name: "Justin Jefferson", position: "WR", rank: 7, marketRank: 7, projection: 320, sourceConfidence: "high" }),
      player({ name: "Caleb Williams", position: "QB", rank: 50, marketRank: 50, projection: 250, sourceConfidence: "medium" }),
      player({ name: "Bo Nix", position: "QB", rank: 60, marketRank: 60, projection: 240, sourceConfidence: "medium" }),
      player({ name: "Tyler Warren", position: "TE", rank: 70, marketRank: 70, projection: 180, sourceConfidence: "medium" }),
      player({ name: "IDP Intruder", position: "LB", rank: 2, marketRank: 2, projection: 500, sourceConfidence: "high" }),
      player({ name: "Tom Brady", position: "QB", rank: 4, marketRank: 4, projection: 400, activePolicyClass: "final_policy_blocked_archive" }),
    ], { rosterPositions });
    const board = buildBlackbirdBoard({
      players: draftable.players,
      leagueContext: {
        isSuperflex: true,
        rosterPositions,
        hasIDP: false,
        hasKicker: false,
        hasTeamDefense: false,
        scoringSettings: {},
      },
      includeDrafted: true,
    });
    const diagnostics = buildWarRoomBoardPipelineDiagnostics({
      auditRows: board.rows,
      serverPayloadRows: board.rows,
      clientSortedRows: board.rows,
    });
    const topNames = diagnostics.clientSortedTop25.map((row) => row.playerName);

    expect(diagnostics.top25MatchesAudit).toBe(true);
    expect(topNames[0]).toBe("Josh Allen");
    ["Jahmyr Gibbs", "Jalen Hurts", "Ja'Marr Chase", "Bijan Robinson", "Justin Jefferson"].forEach((name) => {
      expect(topNames.indexOf(name)).toBeGreaterThanOrEqual(0);
      expect(topNames.indexOf(name)).toBeLessThan(10);
    });
    expect(topNames.indexOf("Caleb Williams")).toBeGreaterThan(4);
    expect(topNames.indexOf("Bo Nix")).toBeGreaterThan(4);
    expect(topNames).not.toContain("IDP Intruder");
    expect(topNames).not.toContain("Tom Brady");
    expect(board.rows.find((row) => row.playerName === "Ja'Marr Chase")?.projectionTrust.trustLabel).toBe("high");
    expect(board.rows.find((row) => row.playerName === "Justin Jefferson")?.projectionTrust.trustLabel).toBe("high");
  });

  it("reports mismatches between audit, server payload, client sort, and rendered rows", () => {
    const audit = [row("Josh Allen", 1), row("Puka Nacua", 2)] as BlackbirdBoardRow[];
    const server = [row("Caleb Williams", 1), row("Josh Allen", 2)] as BlackbirdBoardRow[];
    const diagnostics = buildWarRoomBoardPipelineDiagnostics({
      auditRows: audit,
      serverPayloadRows: server,
      clientSortedRows: server,
      renderedRows: server,
    });

    expect(diagnostics.top25MatchesAudit).toBe(false);
    expect(diagnostics.mismatches[0]).toMatchObject({
      rank: 1,
      audit: "Josh Allen",
      serverPayload: "Caleb Williams",
      clientSorted: "Caleb Williams",
      rendered: "Caleb Williams",
    });
  });
});

function player(input: {
  name: string;
  position: string;
  rank: number;
  marketRank: number;
  projection: number;
  sourceConfidence?: "high" | "medium" | "low";
  activePolicyClass?: string;
}): ScoredDraftTarget & {
  activePolicyClass?: string;
  policyGroup?: string;
  confidence?: string;
  confidenceScore?: number;
  marketRank?: number;
  marketMatchType?: string;
} {
  return {
    sleeper_player_id: `s-${input.name}`,
    matched_player_id: `p-${input.name}`,
    player_name: input.name,
    position: input.position,
    team: "TST",
    rank: input.rank,
    adp: input.marketRank,
    projected_points: input.projection,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: input.position === "QB" ? 90 : null,
    te_premium_value: null,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: Math.max(0, 100 - input.rank),
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: ["QB", "RB", "WR", "TE"].includes(input.position) ? "offense_v1_1" : "unsupported",
    activePolicyClass: input.activePolicyClass ?? "final_policy_confirmed_active_clear",
    policyGroup: input.activePolicyClass?.includes("blocked") ? "legacy_blocked" : "confirmed_active_clear",
    confidence: input.sourceConfidence ?? "high",
    confidenceScore: input.sourceConfidence === "medium" ? 70 : input.sourceConfidence === "low" ? 50 : 90,
    marketRank: input.marketRank,
    marketMatchType: "name_team_position",
  };
}

function row(playerName: string, rank: number): Partial<BlackbirdBoardRow> {
  return {
    playerName,
    blackbirdBoardRank: rank,
    position: "QB",
    team: "TST",
    projectionTrust: {
      playerId: playerName,
      playerName,
      position: "QB",
      team: "TST",
      projectionRunId: null,
      projectionVersion: null,
      projectionUnit: "season",
      projectionSource: "uploaded_projection",
      hasStatBackedProjection: false,
      hasScoredFantasyProjection: true,
      hasProjectedComponents: false,
      trustScore: 90,
      trustLabel: "high",
      fallbackReason: null,
      reasons: [],
      dataGaps: [],
    },
  };
}
