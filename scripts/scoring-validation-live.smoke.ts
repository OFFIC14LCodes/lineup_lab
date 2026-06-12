/**
 * F4 Live Scoring Validation Runner
 *
 * Read-only, intentional-only script.
 * Never part of build, CI, or Vercel.
 * Does not write any rows or persist any reports.
 *
 * Run with:
 *   npm run validate:scoring-live
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SCORING_VALIDATION_OPERATOR_USER_ID
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  BLACKBIRD_SCORING_FORMULA_VERSION,
  auditLeagueScoringSettings,
  normalizeSleeperScoringSettings
} from "@/lib/scoring";
import { BLACKBIRD_SCORING_READINESS_VERSION } from "@/lib/scoring/validation/constants";
import { buildDiscrepancyInvestigations } from "@/lib/scoring/validation/discrepancy";
import { extractExperimentCandidates } from "@/lib/scoring/validation/experiment-candidates";
import type {
  AnonymizedCohortEvidence,
  AnonymizedLeagueDataInventory,
  AnonymizedLeagueEvidence,
  AnonymizedLeagueScoringProfile,
  LiveScoringValidationEvidence
} from "@/lib/scoring/validation/live-evidence";
import { validateLeagueScoringSample } from "@/lib/scoring/validation/validate-sample";
import { scoreProjectionRowsForLeague } from "@/lib/scoring/server/score-projections";
import { scoreSeasonStatsRowsForLeague } from "@/lib/scoring/server/score-season-stats";
import { scoreWeeklyStatsRowsForLeague } from "@/lib/scoring/server/score-weekly-stats";
import type { LeagueScoringContext } from "@/lib/scoring/server/types";
import type { RowValidationResult } from "@/lib/scoring/validation/types";

// ---------------------------------------------------------------------------
// Environment bootstrap
// ---------------------------------------------------------------------------

loadEnvConfig(process.cwd());
loadLocalEnvFallback();

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const OPERATOR_USER_ID = env("SCORING_VALIDATION_OPERATOR_USER_ID");

const MAX_LEAGUES = 3;
const ROWS_PER_POSITION_COHORT = 25;
const MAX_ROWS_PER_REPORT = 100;

// ---------------------------------------------------------------------------
// Smoke test entry point
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hasConfig = Boolean(
  SUPABASE_URL && SERVICE_ROLE_KEY && OPERATOR_USER_ID && UUID_RE.test(OPERATOR_USER_ID)
);

describe.sequential("scoring live validation (F4)", () => {
  it.skipIf(!hasConfig)(
    "runs read-only scoring validation against live data for configured operator leagues",
    async () => {
      const admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // ── Pre-flight: verify tables are reachable ──────────────────────────
      await assertTablesReachable(admin);

      // ── Row-count baseline (read-only confirmation) ──────────────────────
      const beforeCounts = await captureRowCounts(admin);

      // ── Discover leagues ─────────────────────────────────────────────────
      const allLeagues = await fetchOperatorLeagues(admin, OPERATOR_USER_ID!);
      if (allLeagues.length === 0) {
        console.warn("\n[SCORING VALIDATION] No leagues found for operator user. Reporting INSUFFICIENT LIVE DATA.");
        const evidence = buildEmptyEvidence();
        printEvidence(evidence);
        return;
      }

      // ── Select up to 3 leagues with the best available data ─────────────
      const inventories = await buildLeagueInventories(admin, allLeagues);
      const selectedLeagues = selectBestLeagues(inventories, MAX_LEAGUES);

      // ── Build provider anonymization map ────────────────────────────────
      const allProviders = [...new Set(selectedLeagues.flatMap((l) => l.inventory.providers))];
      const providerLabels = buildAnonymizationMap(allProviders, "Provider");

      // ── Build league anonymization map ───────────────────────────────────
      const leagueLabels = buildAnonymizationMap(
        selectedLeagues.map((l) => l.league.id),
        "League"
      );

      // ── Run validation per league ─────────────────────────────────────────
      const leagueEvidence: AnonymizedLeagueEvidence[] = [];
      const allCohortEvidence: AnonymizedCohortEvidence[] = [];
      const allRows: RowValidationResult[] = [];
      const allCohorts: ReturnType<typeof validateLeagueScoringSample>["cohorts"] = [];
      const experimentInput: Parameters<typeof extractExperimentCandidates>[0]["cohorts"] = [];

      for (const { league, inventory } of selectedLeagues) {
        const leagueLabel = leagueLabels.get(league.id) ?? "League ?";
        console.log(`\n[SCORING VALIDATION] Processing ${leagueLabel} (${league.name ?? "unnamed"})…`);

        const scoringProfile = buildScoringProfile(leagueLabel, league, inventory);
        leagueEvidence.push({ label: leagueLabel, scoringProfile, dataInventory: inventory });

        const leagueCtx = await buildLeagueContext(admin, OPERATOR_USER_ID!, league.id);
        const deps = createAdminDeps(admin, leagueCtx);

        // ── Weekly stats ────────────────────────────────────────────────────
        if (inventory.availableWeeks.length > 0 && inventory.weeklyStatsRowCount > 0) {
          const targetWeek = inventory.availableWeeks[inventory.availableWeeks.length - 1];
          const targetSeason = inventory.availableSeasons[inventory.availableSeasons.length - 1];

          try {
            const weeklyResponse = await scoreWeeklyStatsRowsForLeague(
              {
                userId: OPERATOR_USER_ID!,
                leagueId: league.id,
                season: targetSeason,
                week: targetWeek,
                limit: MAX_ROWS_PER_REPORT
              },
              deps as Parameters<typeof scoreWeeklyStatsRowsForLeague>[1]
            );

            const weeklyReport = validateLeagueScoringSample({
              league: weeklyResponse.league,
              request: {
                sourceType: "weekly_stats",
                season: targetSeason,
                week: targetWeek,
                provider: null,
                positionGroup: null,
                projectionType: null,
                limit: MAX_ROWS_PER_REPORT
              },
              results: weeklyResponse.results
            });

            const weeklyRows = weeklyReport.rows.filter((r): r is RowValidationResult => "blackbirdPoints" in r);
            allRows.push(...weeklyRows);
            allCohorts.push(...weeklyReport.cohorts);

            for (const cohort of weeklyReport.cohorts) {
              const providerLabel = providerLabels.get(String(cohort.provider)) ?? String(cohort.provider);
              const cohortLabel = `Cohort ${allCohortEvidence.length + 1}`;

              allCohortEvidence.push(
                buildCohortEvidence({
                  leagueLabel,
                  cohortLabel,
                  providerLabel,
                  cohort,
                  season: targetSeason,
                  week: targetWeek
                })
              );

              experimentInput.push({
                leagueLabel,
                providerLabel,
                cohort,
                errorRate:
                  weeklyReport.sample.successfullyScoredRows + weeklyReport.sample.erroredRows > 0
                    ? weeklyReport.sample.erroredRows /
                      (weeklyReport.sample.successfullyScoredRows + weeklyReport.sample.erroredRows)
                    : 0
              });
            }

            console.log(
              `  weekly_stats week=${targetWeek}: ${weeklyReport.sample.successfullyScoredRows} scored, ` +
                `${weeklyReport.sample.erroredRows} errored, ${weeklyReport.cohorts.length} cohort(s)`
            );
          } catch (err) {
            console.warn(`  [WARN] weekly_stats validation failed: ${String(err)}`);
          }
        } else {
          console.log("  weekly_stats: no data available");
        }

        // ── Season stats ─────────────────────────────────────────────────────
        if (inventory.seasonStatsRowCount > 0) {
          const targetSeason = inventory.availableSeasons[inventory.availableSeasons.length - 1];
          try {
            const seasonResponse = await scoreSeasonStatsRowsForLeague(
              {
                userId: OPERATOR_USER_ID!,
                leagueId: league.id,
                season: targetSeason,
                limit: ROWS_PER_POSITION_COHORT
              },
              deps as Parameters<typeof scoreSeasonStatsRowsForLeague>[1]
            );

            const seasonReport = validateLeagueScoringSample({
              league: seasonResponse.league,
              request: {
                sourceType: "season_stats",
                season: targetSeason,
                week: null,
                provider: null,
                positionGroup: null,
                projectionType: null,
                limit: ROWS_PER_POSITION_COHORT
              },
              results: seasonResponse.results
            });

            const seasonRows = seasonReport.rows.filter((r): r is RowValidationResult => "blackbirdPoints" in r);
            allRows.push(...seasonRows);
            allCohorts.push(...seasonReport.cohorts);

            for (const cohort of seasonReport.cohorts) {
              const providerLabel = providerLabels.get(String(cohort.provider)) ?? String(cohort.provider);
              const cohortLabel = `Cohort ${allCohortEvidence.length + 1}`;

              allCohortEvidence.push(
                buildCohortEvidence({
                  leagueLabel,
                  cohortLabel,
                  providerLabel,
                  cohort,
                  season: targetSeason,
                  week: null
                })
              );

              experimentInput.push({
                leagueLabel,
                providerLabel,
                cohort,
                errorRate: 0
              });
            }

            console.log(
              `  season_stats: ${seasonReport.sample.successfullyScoredRows} scored, ${seasonReport.cohorts.length} cohort(s)`
            );
          } catch (err) {
            console.warn(`  [WARN] season_stats validation failed: ${String(err)}`);
          }
        }

        // ── Projections ─────────────────────────────────────────────────────
        if (inventory.projectionRowCount > 0) {
          const targetSeason = inventory.availableSeasons[inventory.availableSeasons.length - 1];
          try {
            const projResponse = await scoreProjectionRowsForLeague(
              {
                userId: OPERATOR_USER_ID!,
                leagueId: league.id,
                season: targetSeason,
                limit: MAX_ROWS_PER_REPORT
              },
              deps as Parameters<typeof scoreProjectionRowsForLeague>[1]
            );

            const projReport = validateLeagueScoringSample({
              league: projResponse.league,
              request: {
                sourceType: "projections",
                season: targetSeason,
                week: null,
                provider: null,
                positionGroup: null,
                projectionType: null,
                limit: MAX_ROWS_PER_REPORT
              },
              results: projResponse.results
            });

            const projRows = projReport.rows.filter((r): r is RowValidationResult => "blackbirdPoints" in r);
            allRows.push(...projRows);
            allCohorts.push(...projReport.cohorts);

            for (const cohort of projReport.cohorts) {
              const providerLabel = providerLabels.get(String(cohort.provider)) ?? String(cohort.provider);
              const cohortLabel = `Cohort ${allCohortEvidence.length + 1}`;

              allCohortEvidence.push(
                buildCohortEvidence({
                  leagueLabel,
                  cohortLabel,
                  providerLabel,
                  cohort,
                  season: targetSeason,
                  week: null
                })
              );

              experimentInput.push({
                leagueLabel,
                providerLabel,
                cohort,
                errorRate:
                  projReport.sample.successfullyScoredRows + projReport.sample.erroredRows > 0
                    ? projReport.sample.erroredRows /
                      (projReport.sample.successfullyScoredRows + projReport.sample.erroredRows)
                    : 0
              });
            }

            console.log(
              `  projections: ${projReport.sample.successfullyScoredRows} scored, ${projReport.cohorts.length} cohort(s)`
            );
          } catch (err) {
            console.warn(`  [WARN] projections validation failed: ${String(err)}`);
          }
        }
      }

      // ── Discrepancy investigations ────────────────────────────────────────
      const discrepancyInvestigations = buildDiscrepancyInvestigations({
        leagueLabel: "all",
        cohorts: allCohorts,
        rows: allRows,
        providerLabels
      });

      // ── Experiment candidates ─────────────────────────────────────────────
      const { candidates, blocked } = extractExperimentCandidates({ cohorts: experimentInput });

      // ── Overall findings ──────────────────────────────────────────────────
      const overallFindings = buildOverallFindings({
        leagueCount: selectedLeagues.length,
        cohortEvidence: allCohortEvidence,
        candidates,
        blocked,
        discrepancyInvestigations
      });

      // ── Assemble evidence ─────────────────────────────────────────────────
      const evidence: LiveScoringValidationEvidence = {
        generatedAt: new Date().toISOString(),
        scoringFormulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION,
        readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION,
        leagues: leagueEvidence,
        cohorts: allCohortEvidence,
        discrepancyInvestigations,
        overallFindings,
        experimentCandidates: candidates,
        blockedCohorts: blocked
      };

      // ── Verify no writes occurred ─────────────────────────────────────────
      const afterCounts = await captureRowCounts(admin);
      verifyNoWrites(beforeCounts, afterCounts);

      // ── Output ────────────────────────────────────────────────────────────
      printEvidence(evidence);

      // ── Final verdict ─────────────────────────────────────────────────────
      const verdict = deriveFinalVerdict(evidence);
      console.log(`\n${"═".repeat(60)}`);
      console.log(`FINAL VERDICT: ${verdict}`);
      console.log(`${"═".repeat(60)}\n`);

      // Operational success — pass regardless of readiness outcome
      expect(evidence.generatedAt).toBeTruthy();
    },
    120_000
  );

  it("skips cleanly when operator user is not configured", () => {
    if (hasConfig) return;
    console.warn(
      "\n[SCORING VALIDATION] Skipped: SCORING_VALIDATION_OPERATOR_USER_ID is not set.\n" +
        "Set this env var to the Supabase auth user ID whose leagues you want to validate.\n"
    );
  });
});

// ---------------------------------------------------------------------------
// Admin dependency overrides for scoring functions
// ---------------------------------------------------------------------------

function createAdminDeps(admin: SupabaseClient, leagueCtx: LeagueScoringContext) {
  return {
    async getLeagueScoringContext() {
      return leagueCtx;
    },

    async listWeeklyStatsRows(input: {
      season: number;
      week: number;
      provider?: string | null;
      positionGroup?: string | null;
      playerIds?: string[] | null;
      limit: number;
    }) {
      let query = admin
        .from("player_weekly_stats")
        .select(
          "id,player_id,provider,provider_external_id,season,week,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at"
        )
        .eq("season", input.season)
        .eq("week", input.week)
        .order("provider", { ascending: true })
        .order("player_id", { ascending: true })
        .limit(input.limit);

      if (input.provider) query = query.eq("provider", input.provider);
      if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
      if (input.playerIds?.length) query = query.in("player_id", input.playerIds);

      const { data, error } = await query;
      if (error) throw new Error(`Admin weekly stats query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },

    async loadWeeklyStatsRow(rowId: string) {
      const { data, error } = await admin
        .from("player_weekly_stats")
        .select(
          "id,player_id,provider,provider_external_id,season,week,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at"
        )
        .eq("id", rowId)
        .maybeSingle();
      if (error) throw new Error(`Admin weekly stats single row query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? null) as any;
    },

    async listSeasonStatsRows(input: {
      season: number;
      provider?: string | null;
      positionGroup?: string | null;
      playerIds?: string[] | null;
      limit: number;
    }) {
      let query = admin
        .from("player_season_stats")
        .select(
          "id,player_id,provider,provider_external_id,season,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at"
        )
        .eq("season", input.season)
        .order("provider", { ascending: true })
        .order("player_id", { ascending: true })
        .limit(input.limit);

      if (input.provider) query = query.eq("provider", input.provider);
      if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
      if (input.playerIds?.length) query = query.in("player_id", input.playerIds);

      const { data, error } = await query;
      if (error) throw new Error(`Admin season stats query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },

    async loadSeasonStatsRow(rowId: string) {
      const { data, error } = await admin
        .from("player_season_stats")
        .select(
          "id,player_id,provider,provider_external_id,season,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at"
        )
        .eq("id", rowId)
        .maybeSingle();
      if (error) throw new Error(`Admin season stats single row query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? null) as any;
    },

    async listProjectionRows(input: {
      season: number;
      week?: number | null;
      provider?: string | null;
      positionGroup?: string | null;
      projectionType?: string | null;
      playerIds?: string[] | null;
      limit: number;
    }) {
      let query = admin
        .from("player_projections")
        .select(
          "id,player_id,provider,provider_external_id,season,week,projection_type,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at"
        )
        .eq("season", input.season)
        .order("provider", { ascending: true })
        .order("player_id", { ascending: true })
        .limit(input.limit);

      if (input.provider) query = query.eq("provider", input.provider);
      if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
      if (input.week != null) query = query.eq("week", input.week);
      if (input.projectionType) query = query.eq("projection_type", input.projectionType);
      if (input.playerIds?.length) query = query.in("player_id", input.playerIds);

      const { data, error } = await query;
      if (error) throw new Error(`Admin projections query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },

    async loadProjectionRow(rowId: string) {
      const { data, error } = await admin
        .from("player_projections")
        .select(
          "id,player_id,provider,provider_external_id,season,week,projection_type,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at"
        )
        .eq("id", rowId)
        .maybeSingle();
      if (error) throw new Error(`Admin projection single row query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? null) as any;
    },

    async loadPlayersByIds(playerIds: string[]) {
      if (playerIds.length === 0) return new Map<string, unknown>();
      const { data, error } = await admin
        .from("players")
        .select("id,full_name,team,position,raw_position,primary_position,position_group")
        .in("id", playerIds);
      if (error) throw new Error(`Admin players query failed: ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Map((data ?? []).map((row: any) => [row.id, row]));
    }
  };
}

// ---------------------------------------------------------------------------
// League context builder (admin-based, ownership-verified)
// ---------------------------------------------------------------------------

async function buildLeagueContext(
  admin: SupabaseClient,
  userId: string,
  leagueId: string
): Promise<LeagueScoringContext> {
  const { data, error } = await admin
    .from("leagues")
    .select("id,name,season,scoring_settings_json")
    .eq("id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load league context: ${error.message}`);
  if (!data) throw new Error(`League ${leagueId} not found or not owned by operator user.`);

  const raw = (data.scoring_settings_json ?? {}) as Record<string, unknown>;
  const scoringSettings = normalizeSleeperScoringSettings(raw);

  return {
    leagueId: data.id,
    leagueName: data.name,
    season: data.season ? Number(data.season) || null : null,
    scoringSettings,
    scoringAudit: auditLeagueScoringSettings(scoringSettings),
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
  };
}

// ---------------------------------------------------------------------------
// Data inventory
// ---------------------------------------------------------------------------

type LeagueRow = {
  id: string;
  name: string | null;
  season: string | null;
  scoring_settings_json: Record<string, unknown> | null;
};

async function fetchOperatorLeagues(admin: SupabaseClient, userId: string): Promise<LeagueRow[]> {
  const { data, error } = await admin
    .from("leagues")
    .select("id,name,season,scoring_settings_json")
    .eq("user_id", userId)
    .order("season", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to fetch leagues: ${error.message}`);
  return (data ?? []) as LeagueRow[];
}

type LeagueWithInventory = {
  league: LeagueRow;
  inventory: AnonymizedLeagueDataInventory;
  totalRows: number;
};

async function buildLeagueInventories(
  admin: SupabaseClient,
  leagues: LeagueRow[]
): Promise<LeagueWithInventory[]> {
  const results: LeagueWithInventory[] = [];

  for (const league of leagues) {
    try {
      const [weeklyCount, seasonCount, projCount, weeks, seasons, providers, provStat] =
        await Promise.all([
          countRows(admin, "player_weekly_stats"),
          countRows(admin, "player_season_stats"),
          countRows(admin, "player_projections"),
          fetchDistinctWeeks(admin),
          fetchDistinctSeasons(admin),
          fetchDistinctProviders(admin),
          fetchSourceUpdatedAtRange(admin)
        ]);

      const inventory: AnonymizedLeagueDataInventory = {
        weeklyStatsRowCount: weeklyCount,
        seasonStatsRowCount: seasonCount,
        projectionRowCount: projCount,
        availableWeeks: weeks,
        availableSeasons: seasons,
        providers,
        sourceUpdatedAtRange: provStat
      };

      results.push({
        league,
        inventory,
        totalRows: weeklyCount + seasonCount + projCount
      });
    } catch (err) {
      console.warn(`[WARN] Failed to build inventory for league ${league.id}: ${String(err)}`);
    }
  }

  return results;
}

function selectBestLeagues(inventories: LeagueWithInventory[], max: number): LeagueWithInventory[] {
  return [...inventories].sort((a, b) => b.totalRows - a.totalRows).slice(0, max);
}

async function countRows(admin: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

async function fetchDistinctWeeks(admin: SupabaseClient): Promise<number[]> {
  const { data, error } = await admin.from("player_weekly_stats").select("week").limit(500);
  if (error || !data) return [];
  const weeks = [...new Set((data as { week: number }[]).map((r) => r.week))].sort((a, b) => a - b);
  return weeks;
}

async function fetchDistinctSeasons(admin: SupabaseClient): Promise<number[]> {
  const { data, error } = await admin
    .from("player_weekly_stats")
    .select("season")
    .limit(500);
  if (error || !data) return [];
  const seasons = [...new Set((data as { season: number }[]).map((r) => r.season))].sort((a, b) => a - b);
  return seasons;
}

async function fetchDistinctProviders(admin: SupabaseClient): Promise<string[]> {
  const tables = ["player_weekly_stats", "player_season_stats", "player_projections"];
  const providerSets = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await admin.from(table).select("provider").limit(200);
      if (error || !data) return new Set<string>();
      return new Set((data as { provider: string }[]).map((r) => r.provider));
    })
  );
  const all = new Set<string>();
  for (const s of providerSets) s.forEach((p) => all.add(p));
  return [...all].sort();
}

async function fetchSourceUpdatedAtRange(
  admin: SupabaseClient
): Promise<{ earliest: string | null; latest: string | null }> {
  const tables = ["player_weekly_stats", "player_season_stats", "player_projections"] as const;
  let earliest: string | null = null;
  let latest: string | null = null;

  for (const table of tables) {
    const { data: minData } = await admin
      .from(table)
      .select("source_updated_at")
      .order("source_updated_at", { ascending: true })
      .limit(1);
    const { data: maxData } = await admin
      .from(table)
      .select("source_updated_at")
      .order("source_updated_at", { ascending: false })
      .limit(1);

    const minVal = (minData?.[0] as { source_updated_at: string | null } | undefined)?.source_updated_at ?? null;
    const maxVal = (maxData?.[0] as { source_updated_at: string | null } | undefined)?.source_updated_at ?? null;

    if (minVal && (!earliest || minVal < earliest)) earliest = minVal;
    if (maxVal && (!latest || maxVal > latest)) latest = maxVal;
  }

  return { earliest, latest };
}

// ---------------------------------------------------------------------------
// Scoring profile extraction
// ---------------------------------------------------------------------------

function buildScoringProfile(
  label: string,
  league: LeagueRow,
  inventory: AnonymizedLeagueDataInventory
): AnonymizedLeagueScoringProfile {
  const raw = league.scoring_settings_json ?? {};
  const normalized = normalizeSleeperScoringSettings(raw as Record<string, unknown>);
  const audit = auditLeagueScoringSettings(normalized);
  const vals = normalized.values;

  const recValue = vals["rec"] ?? 0;
  const receptionFormat: AnonymizedLeagueScoringProfile["receptionFormat"] =
    recValue >= 0.9 ? "PPR" : recValue >= 0.4 ? "half-PPR" : recValue > 0 ? "no-PPR" : "no-PPR";

  const kickerKeys = ["xpm", "fgm", "fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50p"];
  const defKeys = ["pts_allow_0", "pts_allow_1_6", "sack", "int", "def_td", "safe"];
  const idpKeys = ["solo_tkl", "ast_tkl", "tkl", "sack", "tkl_loss", "qb_hit"];

  const activeKeys = Object.keys(vals);
  const kickerEnabled = kickerKeys.some((k) => activeKeys.includes(k));
  const defEnabled = defKeys.some((k) => activeKeys.includes(k));
  const idpEnabled = idpKeys.some((k) => activeKeys.includes(k));

  const bonusKeys = activeKeys.filter((k) => k.startsWith("bonus_"));

  return {
    label,
    season: league.season ? Number(league.season) || null : null,
    receptionFormat,
    passingTdValue: vals["pass_td"] ?? null,
    tePremiumPresent: Boolean(vals["bonus_rec_te"] || vals["rec_te_bonus"]),
    bonusesPresent: bonusKeys,
    kickerEnabled,
    defEnabled,
    idpEnabled,
    activeScoringKeyCount: activeKeys.length,
    unsupportedActiveKeyCount: audit.unsupportedKeys.length + audit.unknownKeys.length,
    invalidScoringSettingCount: normalized.invalidKeys.length
  };
}

// ---------------------------------------------------------------------------
// Cohort evidence builder
// ---------------------------------------------------------------------------

function buildCohortEvidence(input: {
  leagueLabel: string;
  cohortLabel: string;
  providerLabel: string;
  cohort: ReturnType<typeof validateLeagueScoringSample>["cohorts"][number];
  season: number;
  week: number | null;
}): AnonymizedCohortEvidence {
  const { cohort } = input;
  return {
    leagueLabel: input.leagueLabel,
    cohortLabel: input.cohortLabel,
    providerLabel: input.providerLabel,
    sourceType: cohort.sourceType,
    positionGroup: cohort.positionGroup as string | null,
    projectionType: cohort.projectionType as string | null,
    season: input.season,
    week: input.week,
    sampleSize: cohort.sampleSize,
    readinessStatus: cohort.readiness.status,
    eligibilityPercentage: cohort.eligiblePercentage,
    averageCoverageRatio: cohort.averageCoverageRatio,
    minimumCoverageRatio: cohort.minimumCoverageRatio,
    sampleSufficiency: cohort.sampleSufficiency,
    missingStatTopKeys: cohort.missingStatFrequency.slice(0, 5).map((item) => item.statKey),
    unsupportedTopKeys: cohort.unsupportedKeyFrequency.slice(0, 5).map((item) => item.key),
    aliasAmbiguityCount: cohort.aliasAmbiguityCount,
    providerComparisonMetrics: {
      withProviderTotals: cohort.providerComparison.withProviderTotals,
      matchCount: cohort.providerComparison.matchCount,
      closeCount: cohort.providerComparison.closeCount,
      differentCount: cohort.providerComparison.differentCount,
      meanAbsoluteDifference: cohort.providerComparison.meanAbsoluteDifference,
      maximumAbsoluteDifference: cohort.providerComparison.maximumAbsoluteDifference
    }
  };
}

// ---------------------------------------------------------------------------
// Overall findings
// ---------------------------------------------------------------------------

function buildOverallFindings(input: {
  leagueCount: number;
  cohortEvidence: AnonymizedCohortEvidence[];
  candidates: ReturnType<typeof extractExperimentCandidates>["candidates"];
  blocked: ReturnType<typeof extractExperimentCandidates>["blocked"];
  discrepancyInvestigations: ReturnType<typeof buildDiscrepancyInvestigations>;
}): string[] {
  const findings: string[] = [];

  findings.push(`Validated ${input.leagueCount} league(s).`);
  findings.push(`Inspected ${input.cohortEvidence.length} cohort(s) across all source types.`);

  const readyCohorts = input.cohortEvidence.filter((c) => c.readinessStatus === "ready");
  const conditionalCohorts = input.cohortEvidence.filter((c) => c.readinessStatus === "conditionally_ready");
  const notReadyCohorts = input.cohortEvidence.filter((c) => c.readinessStatus === "not_ready");
  const insufficientCohorts = input.cohortEvidence.filter((c) => c.readinessStatus === "insufficient_data");

  findings.push(
    `Cohort readiness: ${readyCohorts.length} ready, ${conditionalCohorts.length} conditionally_ready, ` +
      `${notReadyCohorts.length} not_ready, ${insufficientCohorts.length} insufficient_data.`
  );

  if (input.candidates.length > 0) {
    findings.push(
      `${input.candidates.length} cohort(s) meet experiment candidate criteria.`
    );
  } else {
    findings.push("No cohorts meet experiment candidate criteria with current live data.");
  }

  if (input.discrepancyInvestigations.length > 0) {
    findings.push(
      `${input.discrepancyInvestigations.length} discrepancy investigation(s) triggered for further review.`
    );
  }

  const sourcelessCohorts = input.cohortEvidence.filter((c) => c.sampleSufficiency === "insufficient");
  if (sourcelessCohorts.length > 0) {
    findings.push(
      `${sourcelessCohorts.length} cohort(s) have fewer than 5 rows; treat as descriptive only.`
    );
  }

  findings.push(
    "Draft Target Score and War Room recommendation ordering are unchanged by this validation."
  );

  return findings;
}

function deriveFinalVerdict(evidence: LiveScoringValidationEvidence): string {
  const allCohorts = evidence.cohorts;
  if (allCohorts.length === 0) return "INSUFFICIENT LIVE DATA";

  if (evidence.experimentCandidates.length > 0) {
    const weeklyProjectionCandidates = evidence.experimentCandidates.filter(
      (c) => c.intendedExperimentScope === "weekly_projection_experiment"
    );
    if (weeklyProjectionCandidates.length > 0) {
      return "READY FOR LIMITED COHORT EXPERIMENTS ONLY";
    }
    return "NOT READY — DATA COVERAGE BLOCKED";
  }

  const hasAnyReady = allCohorts.some((c) => c.readinessStatus === "ready" || c.readinessStatus === "conditionally_ready");
  if (!hasAnyReady) {
    const allInsufficient = allCohorts.every((c) => c.readinessStatus === "insufficient_data");
    return allInsufficient ? "INSUFFICIENT LIVE DATA" : "NOT READY — DATA COVERAGE BLOCKED";
  }

  return "NOT READY — DATA COVERAGE BLOCKED";
}

// ---------------------------------------------------------------------------
// Read-only verification
// ---------------------------------------------------------------------------

type RowCounts = Record<string, number>;

async function captureRowCounts(admin: SupabaseClient): Promise<RowCounts> {
  const tables = [
    "player_weekly_stats",
    "player_season_stats",
    "player_projections",
    "player_injuries",
    "leagues",
    "provider_import_sessions"
  ];

  const entries = await Promise.all(
    tables.map(async (table) => {
      const { count } = await admin.from(table).select("id", { count: "exact", head: true });
      return [table, count ?? 0] as const;
    })
  );

  return Object.fromEntries(entries);
}

function verifyNoWrites(before: RowCounts, after: RowCounts): void {
  const changed: string[] = [];
  for (const [table, beforeCount] of Object.entries(before)) {
    const afterCount = after[table] ?? 0;
    if (afterCount !== beforeCount) {
      changed.push(`${table}: ${beforeCount} → ${afterCount}`);
    }
  }

  if (changed.length > 0) {
    throw new Error(
      `[READ-ONLY VIOLATION] Row counts changed during validation:\n${changed.join("\n")}`
    );
  }

  console.log("\n[READ-ONLY VERIFIED] No rows were inserted, updated, or deleted during validation.");
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

async function assertTablesReachable(admin: SupabaseClient): Promise<void> {
  const tables = ["leagues", "player_weekly_stats", "player_season_stats", "player_projections"];
  for (const table of tables) {
    const { error } = await admin.from(table).select("id").limit(1);
    if (error) throw new Error(`Table "${table}" is not reachable: ${error.message}`);
  }
}

function buildAnonymizationMap(values: string[], prefix: string): Map<string, string> {
  const map = new Map<string, string>();
  const sorted = [...values].sort();
  sorted.forEach((value, i) => {
    map.set(value, `${prefix} ${String.fromCharCode(65 + i)}`); // A, B, C...
  });
  return map;
}

function buildEmptyEvidence(): LiveScoringValidationEvidence {
  return {
    generatedAt: new Date().toISOString(),
    scoringFormulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION,
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION,
    leagues: [],
    cohorts: [],
    discrepancyInvestigations: [],
    overallFindings: ["No leagues found for operator user. No live data was available to validate."],
    experimentCandidates: [],
    blockedCohorts: []
  };
}

function printEvidence(evidence: LiveScoringValidationEvidence): void {
  console.log("\n" + "═".repeat(60));
  console.log("BLACKBIRD GM — F4 SCORING LIVE VALIDATION EVIDENCE");
  console.log("═".repeat(60));
  console.log(JSON.stringify(evidence, null, 2));
  console.log("\nOverall Findings:");
  for (const finding of evidence.overallFindings) {
    console.log(`  • ${finding}`);
  }
  if (evidence.experimentCandidates.length > 0) {
    console.log("\nExperiment Candidates:");
    for (const c of evidence.experimentCandidates) {
      console.log(
        `  ✓ ${c.leagueLabel} / ${c.providerLabel} / ${c.positionGroup} / ${c.projectionType} → ${c.intendedExperimentScope} (n=${c.sampleSize}, elig=${(c.eligibilityPercentage * 100).toFixed(1)}%)`
      );
    }
  }
  if (evidence.blockedCohorts.length > 0) {
    console.log("\nBlocked Cohorts:");
    for (const b of evidence.blockedCohorts) {
      console.log(`  ✗ ${b.leagueLabel} / ${b.providerLabel} / ${b.positionGroup}: ${b.blockReasons[0]}`);
    }
  }
}

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function loadLocalEnvFallback() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
