import { describe, expect, it } from "vitest";

import { validateLeagueScoringSample } from "@/lib/scoring/validation";
import { auditLeagueScoringSettings, normalizeSleeperScoringSettings, scoreFantasyStats } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import type { LeagueScoringContext, StoredRowBatchItem } from "@/lib/scoring/server/types";

function makeLeague(scoringSettings: Record<string, unknown>): LeagueScoringContext {
  const normalized = normalizeSleeperScoringSettings(scoringSettings);
  return {
    leagueId: "league-1",
    leagueName: "League One",
    season: 2026,
    scoringSettings: normalized,
    scoringAudit: auditLeagueScoringSettings(normalized),
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
  };
}

function makeOkRow(rowId: string, scoringSettings: Record<string, unknown>, stats: Record<string, unknown>): StoredRowBatchItem {
  return {
    ok: true,
    result: {
      league: { id: "league-1", name: "League One" },
      player: { id: rowId, name: `Player ${rowId}`, team: "CHI", positionGroup: "WR" },
      source: {
        table: "player_weekly_stats",
        rowId,
        provider: "manual",
        providerExternalId: null,
        season: 2026,
        week: 1,
        projectionType: null,
        sourceUpdatedAt: new Date().toISOString(),
        ingestedAt: new Date().toISOString()
      },
      blackbird: scoreFantasyStats({
        stats,
        scoringSettings,
        positionGroup: "WR"
      }),
      providerComparison: null,
      aggregateCompatibility: null,
      contextWarnings: []
    }
  };
}

describe("validateLeagueScoringSample", () => {
  it("returns insufficient overall readiness for a small perfect sample", () => {
    const report = validateLeagueScoringSample({
      league: makeLeague({ rec: 1 }),
      request: {
        sourceType: "weekly_stats",
        season: 2026,
        week: 1,
        provider: null,
        positionGroup: "WR",
        projectionType: null,
        limit: 2
      },
      results: [
        makeOkRow("row-1", { rec: 1 }, { rec: 5 }),
        makeOkRow("row-2", { rec: 1 }, { rec: 4 })
      ]
    });

    expect(report.overallRecommendationReadiness.status).toBe("insufficient_data");
    expect(report.sample.successfullyScoredRows).toBe(2);
  });

  it("retains mixed row successes and errors", () => {
    const report = validateLeagueScoringSample({
      league: makeLeague({ rec: 1 }),
      request: {
        sourceType: "weekly_stats",
        season: 2026,
        week: 1,
        provider: null,
        positionGroup: "WR",
        projectionType: null,
        limit: 2
      },
      results: [
        makeOkRow("row-1", { rec: 1 }, { rec: 5 }),
        {
          ok: false,
          error: {
            rowId: "row-2",
            code: "ROW_NOT_FOUND",
            message: "Player missing",
            source: {
              table: "player_weekly_stats",
              provider: "manual",
              season: 2026,
              week: 1,
              projectionType: null
            }
          }
        }
      ]
    });

    expect(report.sample.erroredRows).toBe(1);
    expect(report.rows).toHaveLength(2);
  });
});
