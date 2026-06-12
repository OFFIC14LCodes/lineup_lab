import { NextResponse } from "next/server";

import {
  parseScoringInspectorQuery,
  requireScoringInspectorApiAccess,
  SCORING_INSPECTOR_ERROR_CODES,
  ScoringInspectorError,
  toScoringInspectorErrorPayload
} from "@/lib/scoring/server";
import { validateLeagueSampleServer } from "@/lib/scoring/server/validate-league-sample";

export async function GET(request: Request) {
  try {
    const user = await requireScoringInspectorApiAccess();
    const query = parseScoringInspectorQuery(new URL(request.url).searchParams);

    if (query.season == null) {
      throw new ScoringInspectorError(
        SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
        "Validation requires season.",
        400
      );
    }

    if (query.sourceType !== "projections" && query.projectionType) {
      throw new ScoringInspectorError(
        SCORING_INSPECTOR_ERROR_CODES.invalidRequest,
        "projectionType is only valid for projections.",
        400
      );
    }

    const response = await validateLeagueSampleServer({
      userId: user.id,
      leagueId: query.leagueId,
      sourceType: query.sourceType,
      season: query.season,
      week: query.week,
      provider: query.provider,
      positionGroup: query.positionGroup,
      projectionType: query.projectionType,
      limit: query.limit
    });

    return NextResponse.json(response);
  } catch (error) {
    const serialized = toScoringInspectorErrorPayload(error);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
