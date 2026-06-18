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
  buildPreseasonProjectionSnapshot,
  writePreseasonProjectionSnapshotArtifacts,
} from "@/lib/projections/backtesting";

import { arg, loadLocalEnv } from "./h9-projection-hardening-utils";

loadLocalEnv();

void main();

async function main() {
  const targetSeason = Number(arg("--target-season"));
  if (!Number.isInteger(targetSeason)) throw new Error("--target-season=<year> is required.");
  const includeIdp = process.argv.includes("--include-idp");
  const universe = parseUniverse(arg("--universe"));
  const draftRoomId = arg("--draft-room-id");
  const scoringContext = await resolveScoringContext(draftRoomId);
  const profiles = loadProfiles().map((profile) => rescoreHistoricalPlayerProfile(profile, scoringContext.scoringProfile));
  const snapshot = buildPreseasonProjectionSnapshot({
    profiles,
    scoringMetadata: scoringContext.metadata,
    options: { targetSeason, includeIdp, universe },
  });
  const artifacts = writePreseasonProjectionSnapshotArtifacts(snapshot);
  const expectedGamesSelector = snapshot.diagnostics.expectedGamesSelector ?? {
    flagEnabled: false,
    readinessArtifactsAvailable: false,
    totalSelectorRows: 0,
    selectedV82Rows: 0,
    currentPathRows: 0,
  };

  console.log("Blackbird Preseason Projection Snapshot");
  console.log(`  dry run: true`);
  console.log(`  target season: ${snapshot.metadata.targetSeason}`);
  console.log(`  projection season: ${snapshot.metadata.projectionSeason}`);
  console.log(`  leakage safe: ${snapshot.metadata.leakageSafe}`);
  console.log(`  input seasons: ${snapshot.metadata.inputSeasons.join(",") || "none"}`);
  console.log(`  players projected: ${snapshot.diagnostics.playersProjected}`);
  console.log(`  players skipped: ${snapshot.diagnostics.playersSkipped}`);
  console.log(`  universe: ${snapshot.diagnostics.universe}`);
  console.log(`  players skipped no-signal: ${snapshot.diagnostics.playersSkippedNoSignal}`);
  console.log(`  no-prior count: ${snapshot.diagnostics.noPriorCount}`);
  console.log(`  IDP count: ${snapshot.diagnostics.idpCount}`);
  console.log(`  expected-games selector flag enabled: ${expectedGamesSelector.flagEnabled}`);
  console.log(`  expected-games selector readiness artifacts available: ${expectedGamesSelector.readinessArtifactsAvailable}`);
  console.log(`  expected-games selector rows: ${expectedGamesSelector.totalSelectorRows}`);
  console.log(`  v8.2 selected rows: ${expectedGamesSelector.selectedV82Rows}`);
  console.log(`  current path rows: ${expectedGamesSelector.currentPathRows}`);
  console.log("  artifacts:");
  console.log(`    ${relative(artifacts.jsonPath)}`);
  console.log(`    ${relative(artifacts.markdownPath)}`);
  console.log(`    ${relative(artifacts.csvPath)}`);
}

function parseUniverse(value: string | null) {
  if (!value) return "fantasy-relevant" as const;
  if (value === "all" || value === "fantasy-relevant" || value === "evaluated-backtest") return value;
  throw new Error("--universe must be one of all, fantasy-relevant, evaluated-backtest.");
}

function loadProfiles(): HistoricalPlayerProfileSnapshot[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "player-profiles.json");
  if (!existsSync(artifactPath)) throw new Error("Missing artifacts/projections/player-profiles.json. Run npm run profiles:build first.");
  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Player profile artifact root is not an array.");
  return parsed as HistoricalPlayerProfileSnapshot[];
}

async function resolveScoringContext(draftRoomId: string | null): Promise<PlayerProfileScoringContext> {
  if (!draftRoomId) return defaultScoringContext([]);
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("draft_rooms")
      .select("id,league_id,leagues(id,name,scoring_settings_json)")
      .eq("id", draftRoomId)
      .maybeSingle();
    if (error || !data) return defaultScoringContext(["Requested draft-room scoring was unavailable; using default profile scoring."]);
    const row = data as { league_id: string | null; leagues?: { id: string; name: string | null; scoring_settings_json: Record<string, unknown> | null } | Array<{ id: string; name: string | null; scoring_settings_json: Record<string, unknown> | null }> | null };
    const league = Array.isArray(row.leagues) ? row.leagues[0] : row.leagues;
    if (!league?.scoring_settings_json) return defaultScoringContext(["Draft-room league scoring settings were unavailable; using default profile scoring."]);
    const normalized = normalizeSleeperScoringSettings(league.scoring_settings_json);
    const scoringProfile = scoringProfileFromNormalizedSettings({
      id: `draft_room:${draftRoomId}`,
      label: league.name ? `${league.name} preseason snapshot scoring` : "Draft room preseason snapshot scoring",
      version: BLACKBIRD_SCORING_FORMULA_VERSION,
      scoringSettings: normalized,
      notes: ["Preseason projection snapshot actuals are not read; historical profile rows are rescored before target-season exclusion."],
    });
    return {
      scoringProfile,
      metadata: buildPlayerProfileScoringMetadata({
        scoringSource: "draft_room",
        scoringProfile,
        warnings: normalized.invalidKeys.length ? [`${normalized.invalidKeys.length} invalid league scoring setting(s) were ignored.`] : [],
      }),
    };
  } catch {
    return defaultScoringContext(["Draft-room scoring lookup failed; using default profile scoring."]);
  }
}

function defaultScoringContext(warnings: string[]): PlayerProfileScoringContext {
  return {
    scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
    metadata: buildPlayerProfileScoringMetadata({
      scoringSource: warnings.length ? "fallback" : "default",
      scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
      warnings,
    }),
  };
}

function relative(filePath: string) {
  return path.relative(process.cwd(), filePath);
}
