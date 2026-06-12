import { NextResponse } from "next/server";

import {
  getLeagueScoringContext,
  parseScoringInspectorQuery,
  requireScoringInspectorApiAccess,
  SCORING_INSPECTOR_ERROR_CODES,
  ScoringInspectorError,
  scoreProjectionRowsForLeague,
  scoreSeasonStatsRowsForLeague,
  scoreStoredProjectionForLeague,
  scoreStoredSeasonStatsForLeague,
  scoreStoredWeeklyStatsForLeague,
  scoreWeeklyStatsRowsForLeague,
  toScoringInspectorErrorPayload
} from "@/lib/scoring/server";
import type { ScoringInspectorResponse } from "@/lib/scoring/server/types";

export async function GET(request: Request) {
  try {
    const user = await requireScoringInspectorApiAccess();
    const query = parseScoringInspectorQuery(new URL(request.url).searchParams);
    const response = await inspectScoringQuery(user.id, query);
    return NextResponse.json(response);
  } catch (error) {
    const serialized = toScoringInspectorErrorPayload(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

async function inspectScoringQuery(
  userId: string,
  query: import("@/lib/scoring/server/types").ScoringInspectorQuery
): Promise<ScoringInspectorResponse> {
  if (query.rowId) {
    const league = await getLeagueScoringContext({
      userId,
      leagueId: query.leagueId
    });

    if (query.sourceType === "weekly_stats") {
      const result = await scoreStoredWeeklyStatsForLeague({
        userId,
        leagueId: query.leagueId,
        weeklyStatsRowId: query.rowId
      });
      return { league, sourceType: query.sourceType, results: [{ ok: true, result }] };
    }

    if (query.sourceType === "season_stats") {
      const result = await scoreStoredSeasonStatsForLeague({
        userId,
        leagueId: query.leagueId,
        seasonStatsRowId: query.rowId
      });
      return { league, sourceType: query.sourceType, results: [{ ok: true, result }] };
    }

    const result = await scoreStoredProjectionForLeague({
      userId,
      leagueId: query.leagueId,
      projectionRowId: query.rowId
    });
    return { league, sourceType: query.sourceType, results: [{ ok: true, result }] };
  }

  if (query.sourceType === "weekly_stats") {
    const season = query.season;
    const week = query.week;
    if (season == null || week == null) {
      throw new ScoringInspectorError(
        SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
        "Weekly scoring inspection requires season and week.",
        400
      );
    }

    const response = await scoreWeeklyStatsRowsForLeague({
      userId,
      leagueId: query.leagueId,
      season,
      week,
      provider: query.provider,
      positionGroup: query.positionGroup,
      limit: query.limit
    });
    return { league: response.league, sourceType: query.sourceType, results: response.results };
  }

  if (query.sourceType === "season_stats") {
    const season = query.season;
    if (season == null) {
      throw new ScoringInspectorError(
        SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
        "Season scoring inspection requires season.",
        400
      );
    }

    const response = await scoreSeasonStatsRowsForLeague({
      userId,
      leagueId: query.leagueId,
      season,
      provider: query.provider,
      positionGroup: query.positionGroup,
      limit: query.limit
    });
    return { league: response.league, sourceType: query.sourceType, results: response.results };
  }

  const season = query.season;
  if (season == null) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
      "Projection scoring inspection requires season.",
      400
    );
  }

  const response = await scoreProjectionRowsForLeague({
    userId,
    leagueId: query.leagueId,
    season,
    week: query.week,
    provider: query.provider,
    positionGroup: query.positionGroup,
    projectionType: query.projectionType,
    limit: query.limit
  });
  return { league: response.league, sourceType: query.sourceType, results: response.results };
}
