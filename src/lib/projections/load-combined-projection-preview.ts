import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import {
  buildCombinedProjectionReadModel,
  selectLatestCompleteRun,
  type CombinedProjectionReadModel,
  type CombinedProjectionRow,
  type CombinedProjectionSource,
  type LeagueCoverageSummary,
  type LeagueReadRow,
  type MarketComparisonReadRow,
  type MarketComparisonStatus,
  type PlayerReadRow,
  type ProjectionOutputReadRow,
  type ProjectionReadiness,
  type ProjectionReasonReadRow,
  type ProjectionRunReadRow,
} from "@/lib/projections/combined-projection-read-model";
import { PROJECTION_METHOD } from "@/lib/projections/constants";
import type { H912LeagueOutput } from "@/lib/projections/dst-baseline-projections";
import { H911_PROJECTION_METHOD } from "@/lib/projections/idp-k-persistence";
export { DST_PREVIEW_WARNING } from "@/lib/projections/projection-preview-constants";
import { createClient } from "@/lib/supabase/server";

export type ProjectionPreviewFilters = {
  leagueId?: string | null;
  includeDstDryRun?: boolean;
  includeAllPositions?: boolean;
  position?: string | null;
  search?: string | null;
  projectionSource?: CombinedProjectionSource | null;
  confidenceLabel?: string | null;
  marketStatus?: MarketComparisonStatus | null;
  readiness?: ProjectionReadiness | null;
};

export type ProjectionPreviewSummary = {
  rowsShown: number;
  leagueSelected: string;
  positionsIncluded: string[];
  sourcesIncluded: string[];
  persistedRows: number;
  dryRunRows: number;
  marketAvailableCount: number;
  noCompatibleMarketCount: number;
  notImplementedMarketCount: number;
  warningCount: number;
  dstIncluded: boolean;
  dstRowsIncluded: number;
  dstRequested: boolean;
  dstArtifactAvailable: boolean;
  marketComparisonsUnavailable: boolean;
};

export type ProjectionPreviewResult = {
  filters: ProjectionPreviewFilters;
  leagues: LeagueReadRow[];
  rows: CombinedProjectionRow[];
  coverage: LeagueCoverageSummary | null;
  summary: ProjectionPreviewSummary;
  selectedRuns: CombinedProjectionReadModel["selectedRuns"];
  diagnostics: string[];
};

const PROJECTION_SOURCES: CombinedProjectionSource[] = [
  "OFFENSE_BASELINE_V1",
  "IDP_K_BASELINE_V1",
  "DST_ALLOWANCE_BASELINE_V1_DRY_RUN",
];

export async function loadCombinedProjectionPreview(filters: ProjectionPreviewFilters): Promise<ProjectionPreviewResult> {
  const client = await createClient();
  const normalized = normalizeFilters(filters);
  const leagues = await loadLeagues(client);

  if (!normalized.leagueId) {
    return emptyPreviewResult({
      filters: normalized,
      leagues,
      diagnostics: ["Select a league to inspect combined projection rows."],
      dstArtifactAvailable: normalized.includeDstDryRun ? dstArtifactExists() : false,
    });
  }

  const selectedLeague = leagues.find((league) => league.id === normalized.leagueId);
  if (!selectedLeague) {
    return emptyPreviewResult({
      filters: normalized,
      leagues,
      diagnostics: ["Selected league was not found for season 2026."],
      dstArtifactAvailable: normalized.includeDstDryRun ? dstArtifactExists() : false,
    });
  }

  const runs = await loadRuns(client);
  const offensiveRun = selectLatestCompleteRun(runs, PROJECTION_METHOD);
  const idpKRun = selectLatestCompleteRun(runs, H911_PROJECTION_METHOD);
  const runIds = [offensiveRun?.projection_run_id, idpKRun?.projection_run_id].filter((id): id is string => Boolean(id));
  const leagueIds = [selectedLeague.id];
  const outputs = await loadOutputs(client, runIds, leagueIds);
  const playerIds = [...new Set(outputs.map((output) => output.canonical_player_id))];
  const [players, reasons, marketComparisons] = await Promise.all([
    loadPlayers(client, playerIds),
    loadReasons(client, runIds, playerIds),
    loadMarketComparisons(client, offensiveRun?.projection_run_id ?? null, leagueIds),
  ]);
  const dstArtifactAvailable = normalized.includeDstDryRun ? dstArtifactExists() : false;
  const dstOutputs = loadDstOutputs(normalized.includeDstDryRun ?? false, leagueIds);
  const model = buildCombinedProjectionReadModel({
    runs,
    outputs,
    players,
    leagues: [selectedLeague],
    reasons,
    marketComparisons,
    dstOutputs,
    options: {
      leagueIds,
      includeDstDryRun: normalized.includeDstDryRun,
      includeAllPositions: normalized.includeAllPositions,
      position: normalized.position,
    },
  });
  const rows = filterProjectionPreviewRows(model.rows, normalized);
  const summary = summarizeProjectionPreview({
    rows,
    filters: normalized,
    leagues,
    coverage: model.leagueCoverage[0] ?? null,
    dstArtifactAvailable,
    marketComparisonsLoaded: marketComparisons.length > 0,
  });
  const diagnostics = diagnosticsForPreview({
    rows,
    preFilterRows: model.rows,
    filters: normalized,
    dstArtifactAvailable,
    marketComparisonsLoaded: marketComparisons.length > 0,
  });

  return {
    filters: normalized,
    leagues,
    rows,
    coverage: model.leagueCoverage[0] ?? null,
    summary,
    selectedRuns: model.selectedRuns,
    diagnostics,
  };
}

export function filterProjectionPreviewRows(rows: CombinedProjectionRow[], filters: ProjectionPreviewFilters): CombinedProjectionRow[] {
  const normalized = normalizeFilters(filters);
  const search = normalized.search?.toLowerCase() ?? null;
  return rows.filter((row) => {
    if (normalized.projectionSource && row.projectionSource !== normalized.projectionSource) return false;
    if (normalized.confidenceLabel && row.confidenceLabel !== normalized.confidenceLabel) return false;
    if (normalized.marketStatus && row.marketComparisonStatus !== normalized.marketStatus) return false;
    if (normalized.readiness && row.projectionReadiness !== normalized.readiness) return false;
    if (search) {
      const haystack = [row.displayName, row.team, row.position, row.entityId].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function summarizeProjectionPreview(input: {
  rows: CombinedProjectionRow[];
  filters: ProjectionPreviewFilters;
  leagues: LeagueReadRow[];
  coverage: LeagueCoverageSummary | null;
  dstArtifactAvailable: boolean;
  marketComparisonsLoaded: boolean;
}): ProjectionPreviewSummary {
  const selectedLeague = input.leagues.find((league) => league.id === input.filters.leagueId);
  const rows = input.rows;
  return {
    rowsShown: rows.length,
    leagueSelected: selectedLeague?.name ?? selectedLeague?.id ?? "None",
    positionsIncluded: uniqueSorted(rows.map((row) => row.positionGroup)),
    sourcesIncluded: uniqueSorted(rows.map((row) => row.projectionSource)),
    persistedRows: rows.filter((row) => row.isPersisted).length,
    dryRunRows: rows.filter((row) => !row.isPersisted).length,
    marketAvailableCount: rows.filter((row) => row.marketComparisonStatus === "AVAILABLE").length,
    noCompatibleMarketCount: rows.filter((row) => row.marketComparisonStatus === "NO_COMPATIBLE_MARKET").length,
    notImplementedMarketCount: rows.filter((row) => row.marketComparisonStatus === "NOT_IMPLEMENTED_FOR_SOURCE").length,
    warningCount: rows.reduce((count, row) => count + row.warningCodes.length, 0),
    dstIncluded: rows.some((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN"),
    dstRowsIncluded: rows.filter((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN").length,
    dstRequested: Boolean(input.filters.includeDstDryRun),
    dstArtifactAvailable: input.dstArtifactAvailable,
    marketComparisonsUnavailable: rows.some((row) => row.projectionSource === "OFFENSE_BASELINE_V1") && !input.marketComparisonsLoaded,
  };
}

function emptyPreviewResult(input: {
  filters: ProjectionPreviewFilters;
  leagues: LeagueReadRow[];
  diagnostics: string[];
  dstArtifactAvailable: boolean;
}): ProjectionPreviewResult {
  return {
    filters: input.filters,
    leagues: input.leagues,
    rows: [],
    coverage: null,
    summary: summarizeProjectionPreview({
      rows: [],
      filters: input.filters,
      leagues: input.leagues,
      coverage: null,
      dstArtifactAvailable: input.dstArtifactAvailable,
      marketComparisonsLoaded: false,
    }),
    selectedRuns: {
      OFFENSE_BASELINE_V1: null,
      IDP_K_BASELINE_V1: null,
      DST_ALLOWANCE_BASELINE_V1_DRY_RUN: null,
    },
    diagnostics: input.diagnostics,
  };
}

function diagnosticsForPreview(input: {
  rows: CombinedProjectionRow[];
  preFilterRows: CombinedProjectionRow[];
  filters: ProjectionPreviewFilters;
  dstArtifactAvailable: boolean;
  marketComparisonsLoaded: boolean;
}): string[] {
  const diagnostics: string[] = [];
  if (input.preFilterRows.length === 0) diagnostics.push("Selected league has no combined projection rows.");
  if (input.preFilterRows.length > 0 && input.rows.length === 0) diagnostics.push("Current filters returned zero rows.");
  if (input.filters.includeDstDryRun && !input.dstArtifactAvailable) diagnostics.push("DST dry-run was requested, but the DST artifact is unavailable.");
  if (input.filters.includeDstDryRun && input.dstArtifactAvailable && !input.preFilterRows.some((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN")) {
    diagnostics.push("DST dry-run was requested, but no DST rows were available for this league after relevance filtering.");
  }
  if (input.preFilterRows.some((row) => row.projectionSource === "OFFENSE_BASELINE_V1") && !input.marketComparisonsLoaded) {
    diagnostics.push("Market comparisons are unavailable for the selected offensive projection run and league.");
  }
  return diagnostics;
}

function normalizeFilters(filters: ProjectionPreviewFilters): ProjectionPreviewFilters {
  return {
    leagueId: blankToNull(filters.leagueId),
    includeDstDryRun: Boolean(filters.includeDstDryRun),
    includeAllPositions: Boolean(filters.includeAllPositions),
    position: normalizePosition(blankToNull(filters.position)),
    search: blankToNull(filters.search),
    projectionSource: PROJECTION_SOURCES.includes(filters.projectionSource as CombinedProjectionSource) ? filters.projectionSource : null,
    confidenceLabel: blankToNull(filters.confidenceLabel),
    marketStatus: ["AVAILABLE", "NO_COMPATIBLE_MARKET", "NOT_IMPLEMENTED_FOR_SOURCE"].includes(filters.marketStatus ?? "") ? filters.marketStatus : null,
    readiness: ["READY", "LOW_CONFIDENCE_BASELINE", "SCORING_PARTIAL_ALLOWANCE_ONLY"].includes(filters.readiness ?? "") ? filters.readiness : null,
  };
}

async function loadRuns(client: SupabaseClient): Promise<ProjectionRunReadRow[]> {
  return loadAllPagesWith<ProjectionRunReadRow>(
    (from, to) => client
      .from("projection_runs")
      .select("projection_run_id,method,projection_version,selection_scope,run_status,completed_at")
      .in("method", [PROJECTION_METHOD, H911_PROJECTION_METHOD])
      .order("method", { ascending: true })
      .order("projection_version", { ascending: false })
      .order("completed_at", { ascending: false })
      .range(from, to),
    { table: "projection_runs" }
  );
}

async function loadLeagues(client: SupabaseClient): Promise<LeagueReadRow[]> {
  return loadAllPagesWith<LeagueReadRow>(
    (from, to) => {
      return client
        .from("leagues")
        .select("id,name,season,roster_positions_json,scoring_settings_json")
        .eq("season", "2026")
        .order("name", { ascending: true })
        .range(from, to);
    },
    { table: "leagues" }
  );
}

async function loadOutputs(client: SupabaseClient, runIds: string[], leagueIds: string[]): Promise<ProjectionOutputReadRow[]> {
  if (runIds.length === 0 || leagueIds.length === 0) return [];
  return loadAllPagesWith<ProjectionOutputReadRow>(
    (from, to) => client
      .from("player_projection_outputs")
      .select("projection_run_id,canonical_player_id,league_id,position,projected_ppg_when_in_role,floor_ppg,ceiling_ppg,downside_points,floor_points,median_points,ceiling_points,upside_points,projection_confidence_label,projected_position_rank,projection_method")
      .in("projection_run_id", runIds)
      .in("league_id", leagueIds)
      .order("league_id", { ascending: true })
      .order("position", { ascending: true })
      .order("projected_position_rank", { ascending: true })
      .range(from, to),
    { table: "player_projection_outputs" }
  );
}

async function loadPlayers(client: SupabaseClient, playerIds: string[]): Promise<PlayerReadRow[]> {
  if (playerIds.length === 0) return [];
  const rows: PlayerReadRow[] = [];
  for (const batch of chunks(playerIds, 200)) {
    rows.push(...await loadAllPagesWith<PlayerReadRow>(
      (from, to) => client
        .from("players")
        .select("id,full_name,team,position,position_group")
        .in("id", batch)
        .order("id", { ascending: true })
        .range(from, to),
      { table: "players" }
    ));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadReasons(client: SupabaseClient, runIds: string[], playerIds: string[]): Promise<ProjectionReasonReadRow[]> {
  if (runIds.length === 0 || playerIds.length === 0) return [];
  const rows: ProjectionReasonReadRow[] = [];
  for (const batch of chunks(playerIds, 200)) {
    rows.push(...await loadAllPagesWith<ProjectionReasonReadRow>(
      (from, to) => client
        .from("projection_reasons")
        .select("projection_run_id,canonical_player_id,league_id,reason_code,explanation")
        .in("projection_run_id", runIds)
        .in("canonical_player_id", batch)
        .order("projection_run_id", { ascending: true })
        .order("canonical_player_id", { ascending: true })
        .order("reason_code", { ascending: true })
        .range(from, to),
      { table: "projection_reasons" }
    ));
  }
  return rows.sort((a, b) =>
    a.projection_run_id.localeCompare(b.projection_run_id) ||
    a.canonical_player_id.localeCompare(b.canonical_player_id) ||
    a.reason_code.localeCompare(b.reason_code)
  );
}

async function loadMarketComparisons(client: SupabaseClient, offensiveRunId: string | null, leagueIds: string[]): Promise<MarketComparisonReadRow[]> {
  if (!offensiveRunId || leagueIds.length === 0) return [];
  return loadAllPagesWith<MarketComparisonReadRow>(
    (from, to) => client
      .from("player_projection_market_comparisons")
      .select("projection_run_id,canonical_player_id,league_id,market_overall_adp,market_position_rank,rank_delta,market_discrepancy_label,compatibility_label,market_confidence_label,reason_codes,format_warnings_json")
      .eq("projection_run_id", offensiveRunId)
      .in("league_id", leagueIds)
      .order("league_id", { ascending: true })
      .order("canonical_player_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_market_comparisons" }
  );
}

function loadDstOutputs(includeDstDryRun: boolean, leagueIds: string[]): H912LeagueOutput[] {
  if (!includeDstDryRun || !dstArtifactExists()) return [];
  const artifact = JSON.parse(readFileSync(dstArtifactPath(), "utf8")) as { leagueOutputs?: H912LeagueOutput[] };
  const leagueFilter = new Set(leagueIds);
  return (artifact.leagueOutputs ?? []).filter((row) => leagueFilter.has(row.leagueId));
}

function dstArtifactExists(): boolean {
  return existsSync(dstArtifactPath());
}

function dstArtifactPath(): string {
  return path.join(process.cwd(), "artifacts", "projections", "h9-dst-projections-2025-to-2026.json");
}

function blankToNull(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function normalizePosition(position: string | null): string | null {
  if (!position) return null;
  const normalized = position.toUpperCase();
  return normalized === "DEF" ? "DST" : normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}
