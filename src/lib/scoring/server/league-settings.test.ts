import { describe, expect, it } from "vitest";

import { getLeagueScoringContext } from "@/lib/scoring/server/league-settings";

describe("getLeagueScoringContext", () => {
  it("loads an owned league and preserves audit visibility for unsupported keys", async () => {
    const result = await getLeagueScoringContext(
      {
        userId: "user-1",
        leagueId: "league-1"
      },
      {
        async loadLeague() {
          return {
            id: "league-1",
            name: "Test League",
            season: "2026",
            scoring_settings_json: {
              rec: 1,
              rec_te_bonus: 0.5,
              mystery_bonus: 2
            }
          };
        }
      }
    );

    expect(result.leagueId).toBe("league-1");
    expect(result.leagueName).toBe("Test League");
    expect(result.season).toBe(2026);
    expect(result.scoringSettings.values.rec).toBe(1);
    expect(result.scoringAudit.unsupportedKeys).toContain("mystery_bonus");
    expect(result.scoringAudit.unknownKeys).toContain("mystery_bonus");
  });

  it("rejects a missing or non-owned league", async () => {
    await expect(
      getLeagueScoringContext(
        {
          userId: "user-1",
          leagueId: "league-1"
        },
        {
          async loadLeague() {
            return null;
          }
        }
      )
    ).rejects.toMatchObject({
      code: "LEAGUE_NOT_FOUND",
      status: 404
    });
  });

  it("rejects missing scoring settings without substituting defaults", async () => {
    await expect(
      getLeagueScoringContext(
        {
          userId: "user-1",
          leagueId: "league-1"
        },
        {
          async loadLeague() {
            return {
              id: "league-1",
              name: "Test League",
              season: "2026",
              scoring_settings_json: null
            };
          }
        }
      )
    ).rejects.toMatchObject({
      code: "SCORING_SETTINGS_MISSING",
      status: 409
    });
  });
});
