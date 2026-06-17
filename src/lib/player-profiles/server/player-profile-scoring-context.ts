import "server-only";

import { BLACKBIRD_SCORING_FORMULA_VERSION, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/auth";

import { DEFAULT_PLAYER_PROFILE_SCORING } from "../player-profile-scoring";
import {
  buildPlayerProfileScoringMetadata,
  scoringProfileFromNormalizedSettings,
  type PlayerProfileScoringContext,
} from "../player-profile-rescoring";

type DraftRoomRow = {
  id: string;
  league_id: string | null;
  leagues?: LeagueRow | LeagueRow[] | null;
};

type LeagueRow = {
  id: string;
  name: string | null;
  scoring_settings_json: Record<string, unknown> | null;
};

export async function resolvePlayerProfileScoringContext(input: {
  draftRoomId?: string | null;
  leagueId?: string | null;
}): Promise<PlayerProfileScoringContext> {
  const draftRoomId = cleanId(input.draftRoomId);
  const leagueId = cleanId(input.leagueId);

  if (!draftRoomId && !leagueId) {
    return defaultScoringContext("default", []);
  }

  const user = await getSessionUser();
  if (!user) {
    return defaultScoringContext("fallback", ["League scoring unavailable because the request is not authenticated."]);
  }

  try {
    const supabase = createAdminClient();

    if (draftRoomId) {
      const { data, error } = await supabase
        .from("draft_rooms")
        .select("id,league_id,leagues(id,name,scoring_settings_json)")
        .eq("id", draftRoomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        return defaultScoringContext("fallback", ["Draft room scoring unavailable; using default profile scoring."]);
      }

      const room = data as DraftRoomRow;
      const league = Array.isArray(room.leagues) ? room.leagues[0] : room.leagues;
      if (!league?.scoring_settings_json || typeof league.scoring_settings_json !== "object") {
        return defaultScoringContext("fallback", ["Draft room league scoring settings are missing; using default profile scoring."]);
      }

      return leagueScoringContext({
        source: "draft_room",
        id: room.league_id ?? league.id,
        label: league.name ? `${league.name} scoring` : "Draft room league scoring",
        settings: league.scoring_settings_json,
      });
    }

    if (leagueId) {
      const { data, error } = await supabase
        .from("leagues")
        .select("id,name,scoring_settings_json")
        .eq("id", leagueId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        return defaultScoringContext("fallback", ["League scoring unavailable; using default profile scoring."]);
      }

      const league = data as LeagueRow;
      if (!league.scoring_settings_json || typeof league.scoring_settings_json !== "object") {
        return defaultScoringContext("fallback", ["League scoring settings are missing; using default profile scoring."]);
      }

      return leagueScoringContext({
        source: "league",
        id: league.id,
        label: league.name ? `${league.name} scoring` : "League scoring",
        settings: league.scoring_settings_json,
      });
    }
  } catch {
    return defaultScoringContext("fallback", ["League scoring lookup failed; using default profile scoring."]);
  }

  return defaultScoringContext("default", []);
}

function leagueScoringContext(input: {
  source: "draft_room" | "league";
  id: string;
  label: string;
  settings: Record<string, unknown>;
}): PlayerProfileScoringContext {
  const normalized = normalizeSleeperScoringSettings(input.settings);
  const scoringProfile = scoringProfileFromNormalizedSettings({
    id: `${input.source}:${input.id}`,
    label: input.label,
    version: BLACKBIRD_SCORING_FORMULA_VERSION,
    scoringSettings: normalized,
    notes: ["Historical profile points are recalculated at read time from preserved raw stat fields."],
  });

  return {
    scoringProfile,
    metadata: buildPlayerProfileScoringMetadata({
      scoringSource: input.source,
      scoringProfile,
      warnings: normalized.invalidKeys.length
        ? [`${normalized.invalidKeys.length} invalid league scoring setting(s) were ignored.`]
        : [],
    }),
  };
}

function defaultScoringContext(source: "default" | "fallback", warnings: string[]): PlayerProfileScoringContext {
  return {
    scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
    metadata: buildPlayerProfileScoringMetadata({
      scoringSource: source,
      scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
      warnings,
    }),
  };
}

function cleanId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
