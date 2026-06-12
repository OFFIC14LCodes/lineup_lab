import "server-only";

import type { ProjectionType } from "@/lib/providers/data-types";
import { ScoringInspectorError, SCORING_INSPECTOR_ERROR_CODES } from "@/lib/scoring/server/errors";
import { scoreProjectionRowsForLeague } from "@/lib/scoring/server/score-projections";
import { scoreSeasonStatsRowsForLeague } from "@/lib/scoring/server/score-season-stats";
import { scoreWeeklyStatsRowsForLeague } from "@/lib/scoring/server/score-weekly-stats";
import type { PositionGroup } from "@/lib/scoring/types";
import type { ProviderName } from "@/lib/providers/types";
import type { ScoringInspectorSourceType } from "@/lib/scoring/server/types";
import { READINESS_SAMPLE_LIMITS, validateLeagueScoringSample } from "@/lib/scoring/validation";

export async function validateLeagueSampleServer(args: {
  userId: string;
  leagueId: string;
  sourceType: ScoringInspectorSourceType;
  season: number;
  week?: number | null;
  provider?: ProviderName | null;
  positionGroup?: PositionGroup | null;
  projectionType?: ProjectionType | null;
  limit?: number;
}) {
  const limit = clampLimit(args.limit ?? READINESS_SAMPLE_LIMITS.defaultLimit);

  if (args.sourceType === "weekly_stats") {
    if (args.week == null) {
      throw new ScoringInspectorError(
        SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
        "Weekly validation requires week.",
        400
      );
    }

    const response = await scoreWeeklyStatsRowsForLeague({
      userId: args.userId,
      leagueId: args.leagueId,
      season: args.season,
      week: args.week,
      provider: args.provider,
      positionGroup: args.positionGroup,
      limit
    });

    return validateLeagueScoringSample({
      league: response.league,
      request: {
        sourceType: args.sourceType,
        season: args.season,
        week: args.week,
        provider: args.provider ?? null,
        positionGroup: args.positionGroup ?? null,
        projectionType: null,
        limit
      },
      results: response.results
    });
  }

  if (args.sourceType === "season_stats") {
    const response = await scoreSeasonStatsRowsForLeague({
      userId: args.userId,
      leagueId: args.leagueId,
      season: args.season,
      provider: args.provider,
      positionGroup: args.positionGroup,
      limit
    });

    return validateLeagueScoringSample({
      league: response.league,
      request: {
        sourceType: args.sourceType,
        season: args.season,
        week: null,
        provider: args.provider ?? null,
        positionGroup: args.positionGroup ?? null,
        projectionType: null,
        limit
      },
      results: response.results
    });
  }

  const response = await scoreProjectionRowsForLeague({
    userId: args.userId,
    leagueId: args.leagueId,
    season: args.season,
    week: args.week,
    provider: args.provider,
    positionGroup: args.positionGroup,
    projectionType: args.projectionType,
    limit
  });

  return validateLeagueScoringSample({
    league: response.league,
    request: {
      sourceType: args.sourceType,
      season: args.season,
      week: args.week ?? null,
      provider: args.provider ?? null,
      positionGroup: args.positionGroup ?? null,
      projectionType: args.projectionType ?? null,
      limit
    },
    results: response.results
  });
}

function clampLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > READINESS_SAMPLE_LIMITS.maxLimit) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      `limit must be between 1 and ${READINESS_SAMPLE_LIMITS.maxLimit}.`,
      400
    );
  }

  return limit;
}
