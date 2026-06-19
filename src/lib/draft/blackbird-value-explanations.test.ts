import { describe, expect, it } from "vitest";

import { buildBlackbirdValueExplanation } from "./blackbird-value-explanations";
import { compareBlackbirdValues } from "./blackbird-value-comparison";
import { buildBlackbirdLeagueRank } from "./blackbird-league-rank";
import { player, overlay } from "../../../scripts/h11-442-fixtures";

describe("H9.15.3 deterministic value explanations", () => {
  it("explains projection trust, PAR, role, and data gaps without AI", () => {
    const row = buildBlackbirdLeagueRank({
      players: [player({ matched_player_id: "a", player_name: "Alpha", projected_points: 240 })],
      overlays: [overlay({ entityId: "a", displayName: "Alpha", medianPoints: 240, floorPoints: 200, ceilingPoints: 280 })],
      leagueContext: { rosterPositions: ["RB", "RB", "FLEX"], scoringSettings: { rec: 1 } },
    }).rows[0];

    const explanation = buildBlackbirdValueExplanation(row);

    expect(explanation.summary).toContain("Blackbird Rank");
    expect(explanation.primaryDrivers.map((driver) => driver.label)).toEqual(expect.arrayContaining(["Projection Trust", "PAR", "Role"]));
  });

  it("compares two players with deterministic deciding factors", () => {
    const rows = buildBlackbirdLeagueRank({
      players: [
        player({ matched_player_id: "a", player_name: "Alpha", projected_points: 260, rank: 10, adp: 12 }),
        player({ matched_player_id: "b", player_name: "Beta", projected_points: 180, rank: 140, adp: 145 }),
      ],
      overlays: [
        overlay({ entityId: "a", displayName: "Alpha", medianPoints: 260, floorPoints: 220, ceilingPoints: 300 }),
        overlay({ entityId: "b", displayName: "Beta", medianPoints: 180, floorPoints: 150, ceilingPoints: 230 }),
      ],
      leagueContext: { rosterPositions: ["RB", "RB", "FLEX"], scoringSettings: { rec: 1 } },
    }).rows;

    const comparison = compareBlackbirdValues(rows[0], rows[1]);

    expect(comparison.preferredPlayerId).toBe(rows[0].playerId);
    expect(comparison.decidingFactors.map((factor) => factor.factor)).toContain("PAR");
  });
});
