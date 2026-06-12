import "server-only";

import { createClient } from "@/lib/supabase/server";
import { BLACKBIRD_SCORING_FORMULA_VERSION, auditLeagueScoringSettings, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { SCORING_INSPECTOR_ERROR_CODES, ScoringInspectorError } from "@/lib/scoring/server/errors";
import type { LeagueScoringContext } from "@/lib/scoring/server/types";

type LeagueRow = {
  id: string;
  name: string | null;
  season: string | null;
  scoring_settings_json: Record<string, unknown> | null;
};

type Dependencies = {
  loadLeague: (userId: string, leagueId: string) => Promise<LeagueRow | null>;
};

const defaultDependencies: Dependencies = {
  async loadLeague(userId, leagueId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leagues")
      .select("id,name,season,scoring_settings_json")
      .eq("id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new ScoringInspectorError(
        SCORING_INSPECTOR_ERROR_CODES.internalError,
        "Unable to load league scoring settings.",
        500
      );
    }

    return (data as LeagueRow | null) ?? null;
  }
};

export async function getLeagueScoringContext(
  args: { leagueId: string; userId: string },
  dependencyOverrides: Partial<Dependencies> = {}
): Promise<LeagueScoringContext> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const league = await dependencies.loadLeague(args.userId, args.leagueId);

  if (!league) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.leagueNotFound,
      "League not found for this user.",
      404
    );
  }

  if (!league.scoring_settings_json || typeof league.scoring_settings_json !== "object") {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.scoringSettingsMissing,
      "League scoring settings are missing.",
      409
    );
  }

  const scoringSettings = normalizeSleeperScoringSettings(league.scoring_settings_json);
  const scoringAudit = auditLeagueScoringSettings(scoringSettings);

  return {
    leagueId: league.id,
    leagueName: league.name,
    season: league.season ? Number(league.season) || null : null,
    scoringSettings,
    scoringAudit,
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
  };
}
