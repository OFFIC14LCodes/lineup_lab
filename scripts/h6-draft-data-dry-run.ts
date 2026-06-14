import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { aggregateLeagueDraftData } from "@/lib/draft-data/aggregate";
import { buildContextRoadmap, buildTeamContextFoundation } from "@/lib/draft-data/context";
import { buildLeagueInventory, findLineagePairs, parseH6CliArgs, selectTargetLeagues } from "@/lib/draft-data/targeting";
import type {
  DraftDataAggregationResult,
  DraftDataDerivedWeeklyRow,
  DraftDataLeague,
  DraftDataPlayer,
  DraftDataWeeklyRow,
  PbpDerivedBatchStatus
} from "@/lib/draft-data/types";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnv();

type Args = ReturnType<typeof parseH6CliArgs>;

type SupabaseLike = SupabaseClient<any>;

async function main() {
  const args = parseArgs();
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceRole) {
    console.error("Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const operatorUserId = process.env["SCORING_VALIDATION_OPERATOR_USER_ID"]?.trim() || null;
  console.log(`[h6-draft-data] performanceSeason=${args.performanceSeason} leagueConfigSeason=${args.leagueConfigSeason ?? "explicit-required"} mode=dry_run`);
  console.log("[h6-draft-data] DRY RUN - no database rows will be inserted or updated.");
  if (args.deprecatedSeasonUsed) {
    console.warn("[h6-draft-data] --season is deprecated and now means --performance-season. Pass --league-config-season or --league-id explicitly.");
  }

  const ownedLeagueInventory = await loadOwnedLeagues(supabase, operatorUserId);
  const leagues = selectTargetLeagues({ leagues: ownedLeagueInventory, args, operatorUserId });
  const weeklyRows = await loadWeeklyRows(supabase, args.performanceSeason);
  const derivedRows = await loadDerivedRows(supabase, args.performanceSeason);
  const players = await loadPlayers(supabase, [...new Set(weeklyRows.map((row) => row.player_id))]);
  const teamRows = await loadTeamRows(supabase, args.performanceSeason);
  // Derive PBP batch status from already-loaded derived rows (avoids querying
  // football_import_batches which has no provider column and uses report_json not metadata_json).
  const pbpDerivedBatchStatus = derivePbpBatchStatus(derivedRows);
  const generatedAt = new Date().toISOString();

  console.log(`[h6-draft-data] pbpDerivedBatchStatus=${pbpDerivedBatchStatus} (from ${derivedRows.length} derived rows)`);

  const results = leagues.map((league) =>
    aggregateLeagueDraftData({
      league,
      performanceSeason: args.performanceSeason,
      leagueConfigSeason: Number(league.season),
      weeklyRows,
      players,
      derivedRows,
      pbpDerivedBatchStatus,
      generatedAt
    })
  );
  const teamContext = buildTeamContextFoundation(args.performanceSeason, teamRows);
  const roadmap = buildContextRoadmap();

  const artifact = {
    generatedAt,
    mode: "dry_run",
    performanceSeason: args.performanceSeason,
    requestedLeagueConfigSeason: args.leagueConfigSeason,
    leagueCount: leagues.length,
    ownedLeagueInventory: buildLeagueInventory(ownedLeagueInventory),
    selectedLeagueIds: leagues.map((league) => league.id),
    lineage: findLineagePairs(ownedLeagueInventory).map((item) => ({
      leagueId: item.league.id,
      platformLeagueId: item.league.platform_league_id,
      previousLeagueId: item.previousLeagueId,
      previousOwnedLeagueRowId: item.previousLeague?.id ?? null,
      previousOwnedLeagueSeason: item.previousLeague?.season ?? null
    })),
    applicability: {
      safeHistoricalFormatFields: [
        "scoring_settings_json",
        "roster_positions_json",
        "total_teams",
        "lineup requirements",
        "Superflex/2QB",
        "TE premium",
        "best-ball designation",
        "roster depth",
        "replacement-level format assumptions"
      ],
      notHistoricalFacts: [
        "current fantasy team rosters",
        "current draft state",
        "current transactions",
        "current standings"
      ]
    },
    sourceCounts: {
      weeklyRows: weeklyRows.length,
      derivedRows: derivedRows.length,
      players: players.length,
      teamGameRows: teamRows.length,
      pbpDerivedBatchStatus
    },
    results,
    teamContext,
    contextRoadmap: roadmap
  };

  writeArtifacts(args.performanceSeason, artifact, results);
  printSummary(args.performanceSeason, artifact, results);
}

function parseArgs(): Args {
  try {
    return parseH6CliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function loadOwnedLeagues(supabase: SupabaseLike, operatorUserId: string | null): Promise<DraftDataLeague[]> {
  if (!operatorUserId) {
    throw new Error("SCORING_VALIDATION_OPERATOR_USER_ID is required for H6 league inventory. This avoids unrestricted service-role league enumeration.");
  }
  const { data, error } = await withRetry("load leagues", () => {
    return supabase
      .from("leagues")
      .select("id,user_id,platform,platform_league_id,name,season,status,total_teams,is_dynasty,is_best_ball,is_superflex,is_two_qb,te_premium,scoring_settings_json,roster_positions_json,settings_json")
      .eq("user_id", operatorUserId)
      .order("season", { ascending: false })
      .order("name", { ascending: true });
  });
  if (error) throw new Error(`Failed to load leagues: ${error.message}`);
  return (data ?? []) as DraftDataLeague[];
}

async function loadWeeklyRows(supabase: SupabaseLike, season: number): Promise<DraftDataWeeklyRow[]> {
  return loadAllPages<DraftDataWeeklyRow>((from, to) =>
    supabase
      .from("player_weekly_stats")
      .select("id,player_id,season,week,season_type,game_id,team,opponent,position_group,stats_json,provider_fantasy_points,metadata_json")
      .eq("season", season)
      .eq("season_type", "regular")
      .in("position_group", ["QB", "RB", "WR", "TE"])
      .order("week", { ascending: true })
      .range(from, to)
  );
}

async function loadDerivedRows(supabase: SupabaseLike, season: number): Promise<DraftDataDerivedWeeklyRow[]> {
  return loadAllPages<DraftDataDerivedWeeklyRow>((from, to) =>
    supabase
      .from("player_weekly_derived_stats")
      .select("player_id,season,week,season_type,stat_scope,stats_json,completeness")
      .eq("season", season)
      .eq("season_type", "regular")
      .eq("stat_scope", "nflverse_pbp_derived")
      .range(from, to)
  );
}

async function loadPlayers(supabase: SupabaseLike, playerIds: string[]): Promise<DraftDataPlayer[]> {
  const chunks = chunk(playerIds, 100);
  const players: DraftDataPlayer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const ids = chunks[i]!;
    const { data, error } = await withRetry(`load players chunk ${i + 1}/${chunks.length}`, () =>
      supabase
        .from("players")
        .select("id,full_name,position,team,primary_position,position_group,raw_position")
        .in("id", ids)
    );
    if (error) throw new Error(`Failed to load players: ${error.message}`);
    players.push(...((data ?? []) as DraftDataPlayer[]));
  }
  return players;
}

// Derive PBP batch completeness from loaded derived rows.
// football_import_batches has no "provider" column and uses "report_json" not "metadata_json".
// The player_weekly_derived_stats.completeness field is the authoritative per-row indicator:
//   - "not_run" if no derived rows exist for this season
//   - "partial"  if any row has completeness="partial" (batch was interrupted)
//   - "complete" if all rows have completeness="complete"
function derivePbpBatchStatus(derivedRows: DraftDataDerivedWeeklyRow[]): PbpDerivedBatchStatus {
  if (derivedRows.length === 0) return "not_run";
  if (derivedRows.some((row) => row.completeness === "partial")) return "partial";
  return "complete";
}

async function loadTeamRows(supabase: SupabaseLike, season: number) {
  return loadAllPages<{
    season: number;
    team_id: string;
    points_scored: number | null;
    points_allowed: number | null;
    offensive_yards: number | null;
    yards_allowed: number | null;
  }>((from, to) =>
    supabase
      .from("team_game_stats")
      .select("season,team_id,points_scored,points_allowed,offensive_yards,yards_allowed")
      .eq("season", season)
      .eq("season_type", "REG")
      .range(from, to)
  );
}

async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await withRetry(`load rows ${from}-${from + pageSize - 1}`, () => fetchPage(from, from + pageSize - 1));
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function withRetry<T>(label: string, operation: () => PromiseLike<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await operation();
      const responseError = getResponseError(result);
      if (!responseError || !isTransientError(responseError)) {
        return result;
      }
      if (attempt === attempts) {
        return result;
      }
      const delayMs = 300 * 2 ** (attempt - 1);
      console.warn(`[h6-draft-data] transient read response (${label}), retry ${attempt}/${attempts - 1} in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientError(error)) break;
      const delayMs = 300 * 2 ** (attempt - 1);
      console.warn(`[h6-draft-data] transient read failure (${label}), retry ${attempt}/${attempts - 1} in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function getResponseError(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const error = (value as { error?: unknown }).error;
  if (!error) return null;
  if (error instanceof Error) return error;
  if (typeof error === "object" && "message" in error) return new Error(String((error as { message: unknown }).message));
  return new Error(String(error));
}

function isTransientError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|timeout|terminated|ECONNRESET|ETIMEDOUT|429|502|503|504/i.test(message);
}

function writeArtifacts(season: number, artifact: unknown, results: DraftDataAggregationResult[]) {
  const artifactDir = path.join(process.cwd(), "artifacts", "draft-data");
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(path.join(artifactDir, `h6-player-profiles-${season}.json`), JSON.stringify(artifact, null, 2), "utf8");
  writeFileSync(path.join(artifactDir, `h6-player-profiles-${season}.md`), buildMarkdown(season, results), "utf8");
}

function buildMarkdown(season: number, results: DraftDataAggregationResult[]) {
  const lines = [
    `# H6 Draft Data Profiles ${season}`,
    "",
    "Mode: dry-run diagnostic. No database rows were written.",
    "",
    "| League | Profiles | QB1 | RB1 | WR1 | TE1 |",
    "|---|---:|---|---|---|---|"
  ];

  for (const result of results) {
    lines.push(
      `| ${result.leagueFormat.leagueId} | ${result.profiles.length} | ${topName(result, "QB")} | ${topName(result, "RB")} | ${topName(result, "WR")} | ${topName(result, "TE")} |`
    );
  }

  lines.push(
    "",
    "## Evidence Standard",
    "",
    "- Stored weekly rows are valid scoring data.",
    "- Inactive, bye, missing, and unresolved identity weeks are not inferred as zero.",
    "- Situation fields remain unknown unless source-backed.",
    "- Replacement level is preliminary and should not yet drive live recommendations."
  );
  return `${lines.join("\n")}\n`;
}

function topName(result: DraftDataAggregationResult, position: "QB" | "RB" | "WR" | "TE") {
  return result.profiles.find((profile) => profile.position === position && profile.ranks.positionPpg === 1)?.playerName ?? "n/a";
}

function printSummary(season: number, artifact: { [key: string]: unknown }, results: DraftDataAggregationResult[]) {
  const sourceCounts = artifact["sourceCounts"] as Record<string, number>;
  console.log("\n=== H6 Draft Data Dry Run ===");
  console.log(`Performance:       ${season}`);
  console.log(`Leagues:           ${results.length}`);
  console.log(`Weekly rows:       ${sourceCounts.weeklyRows}`);
  console.log(`Derived rows:      ${sourceCounts.derivedRows}`);
  console.log(`Players loaded:    ${sourceCounts.players}`);
  console.log(`Team rows:         ${sourceCounts.teamGameRows}`);
  console.log("");

  for (const result of results) {
    const { profiles, leagueSummary, diagnostics } = result;
    const byPosition = countBy(profiles.map((p) => p.position));
    const confidenceDist = countBy(profiles.map((p) => p.scoringCompleteness.historicalScoreConfidence));
    console.log(
      `League ${result.leagueFormat.leagueId} config=${result.leagueFormat.leagueConfigSeason}: ${profiles.length} profiles, positions=${JSON.stringify(byPosition)}`
    );
    console.log(
      `  pbpBatch=${diagnostics.pbpDerivedBatchStatus} knownZeroInferences=${diagnostics.knownZeroInferencesApplied}`
    );
    console.log(
      `  confidence: complete=${leagueSummary.completeProfiles} high=${leagueSummary.highConfidenceProfiles} moderate=${leagueSummary.moderateConfidenceProfiles} low=${leagueSummary.lowConfidenceProfiles} unusable=${leagueSummary.unusableProfiles}`
    );
    console.log(
      `  avgCompleteness=${leagueSummary.averageScoringCompletenessRatio.toFixed(3)} minCompleteness=${leagueSummary.minimumScoringCompletenessRatio.toFixed(3)}`
    );
    if (leagueSummary.mostCommonLimitationKeys.length > 0) {
      const topLimitations = leagueSummary.mostCommonLimitationKeys.slice(0, 3)
        .map((l) => `${l.scoringKey}(${l.reason}):${l.affectedProfileCount}`).join(", ");
      console.log(`  topLimitations: ${topLimitations}`);
    }
    // Log confidence distribution for quick scan
    console.log(`  byConfidence=${JSON.stringify(confidenceDist)}`);
    for (const [position, summary] of Object.entries(result.replacementSummary.positionSummaries)) {
      console.log(
        `  ${position}: demand=${summary.starterDemand} cutoff=${summary.replacementRank} replacement=${summary.replacementPlayerName ?? "n/a"} ppg=${summary.replacementPointsPerGame ?? "n/a"}`
      );
    }
  }

  console.log("\nArtifacts written:");
  console.log(`  artifacts/draft-data/h6-player-profiles-${season}.json`);
  console.log(`  artifacts/draft-data/h6-player-profiles-${season}.md`);
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

main().catch((error) => {
  console.error("[h6-draft-data] Fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
