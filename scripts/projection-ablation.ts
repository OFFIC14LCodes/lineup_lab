import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { BLACKBIRD_SCORING_FORMULA_VERSION, normalizeSleeperScoringSettings } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PLAYER_PROFILE_SCORING,
  buildPlayerProfileScoringMetadata,
  rescoreHistoricalPlayerProfile,
  scoringProfileFromNormalizedSettings,
  type HistoricalPlayerProfileSnapshot,
  type PlayerProfileScoringContext,
} from "@/lib/player-profiles";
import {
  discoverExistingProjectionSource,
  runProjectionAblation,
  writeProjectionAblationArtifacts,
  type ProjectionBacktestOptions,
} from "@/lib/projections/backtesting";

import { arg, loadLocalEnv } from "./h9-projection-hardening-utils";

loadLocalEnv();

void main();

async function main() {
  const options = parseOptions();
  const scoringContext = await resolveScoringContext(options);
  const existingProjectionSource = discoverExistingProjectionSource({
    targetSeason: options.targetSeason,
    explicitPath: arg("--existing-projections-path"),
  });
  const profiles = loadProfiles().map((profile) => rescoreHistoricalPlayerProfile(profile, scoringContext.scoringProfile));
  const report = runProjectionAblation({
    source: {
      profiles,
      scoringProfile: scoringContext.scoringProfile,
      scoringMetadata: scoringContext.metadata,
      existingProjectionSource,
    },
    options,
  });
  const artifacts = writeProjectionAblationArtifacts(report);

  console.log("Blackbird Projection Ablation");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  target season: ${report.targetSeason}`);
  console.log(`  players evaluated: ${report.rows.filter((row) => row.modelName === "weighted_recent_ppg").length}`);
  console.log(`  variants evaluated: ${report.variantsEvaluated.join(", ")}`);
  console.log(`  leakage safe: ${report.leakageSafety.passed}`);
  console.log(`  weighted recent MAE PPG: ${report.overall.weighted_recent_ppg?.maePpg ?? "n/a"}`);
  console.log(`  blackbird v2 MAE PPG: ${report.overall.blackbird_v2?.maePpg ?? "n/a"}`);
  console.log(`  blackbird v3 MAE PPG: ${report.overall.blackbird_v3?.maePpg ?? "n/a"}`);
  console.log("  artifacts:");
  console.log(`    ${relative(artifacts.jsonPath)}`);
  console.log(`    ${relative(artifacts.markdownPath)}`);
  console.log(`    ${relative(artifacts.csvPath)}`);
}

function parseOptions(): ProjectionBacktestOptions {
  const targetSeason = Number(arg("--target-season"));
  if (!Number.isInteger(targetSeason)) throw new Error("--target-season=<year> is required.");
  const positionsArg = arg("--positions");
  return {
    targetSeason,
    positions: positionsArg ? positionsArg.split(",").map((position) => position.trim().toUpperCase()).filter(Boolean) : null,
    includeIdp: process.argv.includes("--include-idp"),
    includeExistingProjections: true,
    scoring: "default",
    draftRoomId: arg("--draft-room-id"),
    leagueId: arg("--league-id"),
  };
}

function loadProfiles(): HistoricalPlayerProfileSnapshot[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "player-profiles.json");
  if (!existsSync(artifactPath)) throw new Error("Missing artifacts/projections/player-profiles.json. Run npm run profiles:build first.");
  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Player profile artifact root is not an array.");
  return parsed as HistoricalPlayerProfileSnapshot[];
}

async function resolveScoringContext(options: ProjectionBacktestOptions): Promise<PlayerProfileScoringContext> {
  if (options.draftRoomId || options.leagueId) {
    const scoring = await loadLeagueScoring(options);
    if (scoring) return scoring;
    return defaultScoringContext("fallback", ["Requested draft-room/league scoring was unavailable; using default profile scoring."]);
  }
  return defaultScoringContext("default", []);
}

async function loadLeagueScoring(options: ProjectionBacktestOptions): Promise<PlayerProfileScoringContext | null> {
  try {
    const supabase = createAdminClient();
    if (options.draftRoomId) {
      const { data, error } = await supabase
        .from("draft_rooms")
        .select("id,league_id,leagues(id,name,scoring_settings_json)")
        .eq("id", options.draftRoomId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as { league_id: string | null; leagues?: { id: string; name: string | null; scoring_settings_json: Record<string, unknown> | null } | Array<{ id: string; name: string | null; scoring_settings_json: Record<string, unknown> | null }> | null };
      const league = Array.isArray(row.leagues) ? row.leagues[0] : row.leagues;
      if (!league?.scoring_settings_json) return null;
      return leagueScoringContext({
        source: "draft_room",
        id: row.league_id ?? league.id,
        label: league.name ? `${league.name} scoring` : "Draft room league scoring",
        settings: league.scoring_settings_json,
      });
    }
    if (options.leagueId) {
      const { data, error } = await supabase
        .from("leagues")
        .select("id,name,scoring_settings_json")
        .eq("id", options.leagueId)
        .maybeSingle();
      if (error || !data) return null;
      const league = data as { id: string; name: string | null; scoring_settings_json: Record<string, unknown> | null };
      if (!league.scoring_settings_json) return null;
      return leagueScoringContext({
        source: "league",
        id: league.id,
        label: league.name ? `${league.name} scoring` : "League scoring",
        settings: league.scoring_settings_json,
      });
    }
  } catch {
    return null;
  }
  return null;
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
    notes: ["Historical actuals are recalculated from preserved weekly stat fields for this dry-run ablation."],
  });
  return {
    scoringProfile,
    metadata: buildPlayerProfileScoringMetadata({
      scoringSource: input.source,
      scoringProfile,
      warnings: normalized.invalidKeys.length ? [`${normalized.invalidKeys.length} invalid league scoring setting(s) were ignored.`] : [],
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

function relative(filePath: string) {
  return path.relative(process.cwd(), filePath);
}
