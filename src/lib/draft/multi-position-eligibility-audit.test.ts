import { describe, expect, it } from "vitest";

import { buildMultiPositionEligibilityAudit } from "./multi-position-eligibility-audit";
import { buildNormalizedRosterRequirements } from "./roster-slots";
import type { ScoredDraftTarget } from "./scoring";

describe("H57.1 multi-position eligibility audit", () => {
  it("reports trusted, Travis Hunter, and suppressed combo classes", () => {
    const report = buildMultiPositionEligibilityAudit({
      projectionSeason: 2026,
      players: [
        player({ sleeper_player_id: "p1", matched_player_id: "p1", player_name: "Flexible Edge", position: "LB", fantasyPositions: ["LB", "DL"] }),
        player({ sleeper_player_id: "p2", matched_player_id: "p2", player_name: "Travis Hunter", position: "WR", fantasyPositions: ["WR", "DB"] }),
        player({ sleeper_player_id: "p3", matched_player_id: "p3", player_name: "Fake Flex", position: "QB", fantasyPositions: ["QB", "TE"] }),
      ],
      boardRows: [
        {
          playerId: "p1",
          playerName: "Flexible Edge",
          position: "LB",
          team: "TST",
          blackbirdBoardRank: 1,
        } as never,
      ],
      rosterRequirements: buildNormalizedRosterRequirements(["DL", "DB", "BN"]),
    });

    expect(report.summary.playersWithMultipleRawEligiblePositions).toBe(3);
    expect(report.summary.classes.trusted_idp_multi_position).toBe(1);
    expect(report.summary.classes.travis_hunter_wr_db).toBe(1);
    expect(report.summary.classes.suppressed_unsupported_combo).toBe(1);
    expect(report.summary.secondaryPositionChangesDraftability).toBe(2);
    expect(report.summary.secondaryPositionChangesValue).toBe(2);
    expect(report.summary.combos["LB/DL"]).toBe(1);
    expect(report.summary.combos["WR/DB"]).toBe(1);
    expect(report.summary.suppressedComboExamples[0]).toContain("Fake Flex QB/TE");
    expect(report.summary.trustedIdpExamples[0]).toContain("Flexible Edge LB/DL");
    expect(report.summary.travisHunterRows[0]?.displayPosition).toBe("WR/DB");
  });
});

function player(overrides: Partial<ScoredDraftTarget>): ScoredDraftTarget {
  return {
    sleeper_player_id: "p1",
    matched_player_id: "p1",
    player_name: "Player",
    position: "LB",
    team: "TST",
    rank: 1,
    adp: null,
    projected_points: null,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: null,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    ...overrides,
  };
}
