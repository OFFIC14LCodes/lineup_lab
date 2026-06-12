import type { ImportTemplateDefinition } from "@/lib/providers/import/types";

export const IMPORT_TEMPLATES: Record<ImportTemplateDefinition["datasetKind"], ImportTemplateDefinition> = {
  weekly_stats: {
    datasetKind: "weekly_stats",
    title: "Weekly Stats",
    csvHeaders: [
      "provider_external_id",
      "full_name",
      "team",
      "position",
      "season",
      "week",
      "season_type",
      "game_id",
      "opponent",
      "home_away",
      "game_date",
      "provider_fantasy_points",
      "source_updated_at",
      "data_version",
      "stat_pass_yd",
      "stat_pass_td",
      "stat_rush_yd",
      "stat_rec_yd",
      "meta_note"
    ],
    requiredFields: [
      { name: "provider_external_id or enough player identity fields", required: true },
      { name: "season", required: true },
      { name: "week", required: true },
      { name: "season_type", required: true },
      { name: "stats", required: true, description: "Use stat_ prefixed CSV columns or a stats object in JSON." }
    ],
    optionalFields: [
      { name: "external_type" },
      { name: "full_name" },
      { name: "first_name" },
      { name: "last_name" },
      { name: "team" },
      { name: "position" },
      { name: "game_id" },
      { name: "opponent" },
      { name: "home_away" },
      { name: "game_date" },
      { name: "provider_fantasy_points" },
      { name: "source_updated_at" },
      { name: "data_version" },
      { name: "metadata" }
    ]
  },
  season_stats: {
    datasetKind: "season_stats",
    title: "Season Stats",
    csvHeaders: [
      "provider_external_id",
      "full_name",
      "team",
      "position",
      "season",
      "season_type",
      "games_played",
      "games_started",
      "provider_fantasy_points",
      "source_updated_at",
      "data_version",
      "stat_tackle_solo",
      "stat_sack",
      "meta_note"
    ],
    requiredFields: [
      { name: "provider_external_id or enough player identity fields", required: true },
      { name: "season", required: true },
      { name: "season_type", required: true },
      { name: "stats", required: true }
    ],
    optionalFields: [
      { name: "team" },
      { name: "position" },
      { name: "games_played" },
      { name: "games_started" },
      { name: "provider_fantasy_points" },
      { name: "source_updated_at" },
      { name: "data_version" },
      { name: "metadata" }
    ]
  },
  projection: {
    datasetKind: "projection",
    title: "Projection",
    csvHeaders: [
      "provider_external_id",
      "full_name",
      "team",
      "position",
      "season",
      "week",
      "season_type",
      "projection_type",
      "scoring_format",
      "opponent",
      "provider_fantasy_points",
      "source_updated_at",
      "version",
      "stat_pass_yd",
      "stat_rec",
      "meta_note"
    ],
    requiredFields: [
      { name: "provider_external_id or enough player identity fields", required: true },
      { name: "season", required: true },
      { name: "projection_type", required: true },
      { name: "stats", required: true }
    ],
    optionalFields: [
      { name: "week" },
      { name: "season_type" },
      { name: "scoring_format" },
      { name: "team" },
      { name: "opponent" },
      { name: "position" },
      { name: "provider_fantasy_points" },
      { name: "source_updated_at" },
      { name: "version" },
      { name: "metadata" }
    ]
  },
  injury: {
    datasetKind: "injury",
    title: "Injury",
    csvHeaders: [
      "provider_external_id",
      "full_name",
      "team",
      "position",
      "season",
      "week",
      "status",
      "practice_status",
      "game_status",
      "body_part",
      "injury_type",
      "description",
      "expected_return",
      "observed_at",
      "source_updated_at",
      "is_current",
      "meta_note"
    ],
    requiredFields: [
      { name: "provider_external_id or enough player identity fields", required: true },
      { name: "observed_at or source_updated_at", required: true }
    ],
    optionalFields: [
      { name: "season" },
      { name: "week" },
      { name: "team" },
      { name: "position" },
      { name: "status" },
      { name: "practice_status" },
      { name: "game_status" },
      { name: "body_part" },
      { name: "injury_type" },
      { name: "description" },
      { name: "expected_return" },
      { name: "is_current" },
      { name: "execution_mode" },
      { name: "metadata" }
    ]
  }
};
