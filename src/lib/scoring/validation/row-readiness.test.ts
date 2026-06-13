import { describe, expect, it } from "vitest";

import { evaluateLeagueScoringReadiness, evaluateRowScoringReadiness } from "@/lib/scoring/validation";
import { auditLeagueScoringSettings, normalizeSleeperScoringSettings, scoreFantasyStats } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import type { LeagueScoringContext, StoredRowScoringResult } from "@/lib/scoring/server/types";

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

function makeResult(input: {
  scoringSettings: Record<string, unknown>;
  stats: Record<string, unknown>;
  positionGroup: "WR" | "TE" | "K" | "DEF" | "LB" | null;
  sourceType?: "actual" | "projection";
  projectionType?: "weekly" | "season" | "rest_of_season" | null;
  providerPoints?: number | null;
  aggregateCompatibility?: StoredRowScoringResult["aggregateCompatibility"];
}) {
  const blackbird = scoreFantasyStats({
    stats: input.stats,
    scoringSettings: input.scoringSettings,
    positionGroup: input.positionGroup,
    statSource: input.sourceType ?? "actual"
  });

  return {
    league: { id: "league-1", name: "League One" },
    player: {
      id: "player-1",
      name: "Player One",
      team: "CHI",
      positionGroup: input.positionGroup
    },
    source: {
      table: input.sourceType === "projection" ? "player_projections" : "player_weekly_stats",
      rowId: "row-1",
      provider: "manual",
      providerExternalId: null,
      season: 2026,
      week: input.projectionType === "season" || input.projectionType === "rest_of_season" ? null : 1,
      projectionType: input.projectionType ?? null,
      sourceUpdatedAt: new Date().toISOString(),
      ingestedAt: new Date().toISOString()
    },
    blackbird,
    providerComparison: input.providerPoints == null
      ? null
      : {
          providerPoints: input.providerPoints,
          blackbirdPoints: blackbird.totalPoints,
          difference: blackbird.totalPoints - input.providerPoints,
          absoluteDifference: Math.abs(blackbird.totalPoints - input.providerPoints),
          percentDifference: input.providerPoints === 0 ? null : Math.abs(blackbird.totalPoints - input.providerPoints) / Math.abs(input.providerPoints),
          comparisonStatus: Math.abs(blackbird.totalPoints - input.providerPoints) <= 0.01 ? "match" : "different",
          warnings: []
        },
    aggregateCompatibility: input.aggregateCompatibility ?? null,
    contextWarnings: []
  } satisfies StoredRowScoringResult;
}

describe("evaluateRowScoringReadiness", () => {
  it("returns ready for a complete weekly PPR projection", () => {
    const league = makeLeague({ rec: 1, rec_yd: 0.1, rec_td: 6 });
    const result = makeResult({
      scoringSettings: { rec: 1, rec_yd: 0.1, rec_td: 6 },
      stats: { rec: 6, rec_yd: 80, rec_td: 1 },
      positionGroup: "WR",
      sourceType: "projection",
      projectionType: "weekly",
      providerPoints: 20
    });

    const readiness = evaluateRowScoringReadiness({
      result,
      sourceType: "projections",
      leagueReadiness: evaluateLeagueScoringReadiness({ league, positionGroup: "WR" })
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.eligibleForRecommendationExperiment).toBe(true);
    expect(readiness.scoringValidationStatus).toBe("ready");
  });

  it("returns not ready when a core PPR stat is missing", () => {
    const league = makeLeague({ rec: 1, rec_yd: 0.1 });
    const result = makeResult({
      scoringSettings: { rec: 1, rec_yd: 0.1 },
      stats: { rec_yd: 80 },
      positionGroup: "WR",
      sourceType: "projection",
      projectionType: "weekly",
      providerPoints: 8
    });

    const readiness = evaluateRowScoringReadiness({
      result,
      sourceType: "projections",
      leagueReadiness: evaluateLeagueScoringReadiness({ league, positionGroup: "WR" })
    });

    expect(readiness.status).toBe("not_ready");
  });

  it("returns conditionally ready for aggregate season projection limitations", () => {
    const league = makeLeague({ rec: 1, bonus_rec_yd_100: 3 });
    const result = makeResult({
      scoringSettings: { rec: 1, bonus_rec_yd_100: 3 },
      stats: { rec: 80, rec_yd: 1100 },
      positionGroup: "WR",
      sourceType: "projection",
      projectionType: "season",
      providerPoints: 190,
      aggregateCompatibility: {
        safeKeys: ["rec"],
        aggregateUnsafeKeys: ["bonus_rec_yd_100"],
        reasons: ["Weekly threshold bonus bonus_rec_yd_100 cannot be reconstructed exactly from aggregate totals."],
        isExact: false,
        warnings: []
      }
    });

    const readiness = evaluateRowScoringReadiness({
      result,
      sourceType: "projections",
      leagueReadiness: evaluateLeagueScoringReadiness({ league, positionGroup: "WR" })
    });

    expect(readiness.status).toBe("conditionally_ready");
    expect(readiness.eligibleExperimentScope).toBe("season_value_experiment");
  });

  it("caps score when position is missing", () => {
    const league = makeLeague({ rec: 1 });
    const result = makeResult({
      scoringSettings: { rec: 1 },
      stats: { rec: 5 },
      positionGroup: null
    });

    const readiness = evaluateRowScoringReadiness({
      result,
      sourceType: "weekly_stats",
      leagueReadiness: evaluateLeagueScoringReadiness({ league, positionGroup: null })
    });

    expect(readiness.status).toBe("insufficient_data");
    expect(readiness.score).toBeLessThanOrEqual(40);
  });

  it("allows weekly actual rows to be scoring-ready while remaining experiment-ineligible", () => {
    const league = makeLeague({ rec: 1, rec_yd: 0.1, rec_td: 6 });
    const result = makeResult({
      scoringSettings: { rec: 1, rec_yd: 0.1, rec_td: 6 },
      stats: { rec: 6, rec_yd: 80, rec_td: 1 },
      positionGroup: "WR",
      sourceType: "actual",
      providerPoints: 20
    });

    const readiness = evaluateRowScoringReadiness({
      result,
      sourceType: "weekly_stats",
      leagueReadiness: evaluateLeagueScoringReadiness({ league, positionGroup: "WR" })
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.scoringValidationStatus).toBe("ready");
    expect(readiness.eligibleForRecommendationExperiment).toBe(false);
    expect(readiness.recommendationExperimentEligibility).toEqual({
      eligible: false,
      scope: "none"
    });
  });
});
