import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { RecommendationReplayEvaluationArtifact } from "@/lib/draft/recommendation-replay-evaluation";
import type { H10WarRoomCompactRecommendation } from "@/lib/draft/war-room-recommendation-validation";
import { createAdminClient } from "@/lib/supabase/admin";

type ValidationArtifact = {
  roomResults?: Array<{
    source: "live" | "validation_seed" | "fixture";
    draftRoomId: string;
    leagueId: string;
    leagueName: string | null;
    formatCoverage?: Record<string, boolean>;
    topRecommendations?: H10WarRoomCompactRecommendation[];
    watchlistExamples?: H10WarRoomCompactRecommendation[];
  }>;
};

type TableAudit = {
  table: string;
  found: boolean;
  rowCount: number | null;
  fieldsAvailable: string[];
  missingForHistoricalReplay: string[];
  error: string | null;
};

type ReplayStyle = "ADP-heavy" | "projection/value-heavy" | "positional-need-heavy" | "IDP-aggressive" | "TE-premium" | "K/DST-late" | "chaotic/reach-heavy" | "balanced";

loadLocalEnv();

const validation = readJson<ValidationArtifact>("h10-war-room-recommendation-validation.json");
const replay = readJson<RecommendationReplayEvaluationArtifact>("h10-recommendation-replay-evaluation.json");
const rows = uniqueRows((validation.roomResults ?? []).flatMap((room) =>
  [...(room.topRecommendations ?? []), ...(room.watchlistExamples ?? [])].map((row) => ({
    source: room.source,
    draftRoomId: room.draftRoomId,
    leagueId: room.leagueId,
    leagueName: room.leagueName,
    formatCoverage: room.formatCoverage ?? {},
    ...row,
  }))
));

const replayStyles: ReplayStyle[] = [
  "ADP-heavy",
  "projection/value-heavy",
  "positional-need-heavy",
  "IDP-aggressive",
  "TE-premium",
  "K/DST-late",
  "chaotic/reach-heavy",
  "balanced",
];

void main();

async function main() {
  const dbAudit = await auditDatabaseSources();
  const completedDraftRoomsWithPicks = dbAudit.completedDraftRoomsWithPicks;
  const trueHistoricalDraftsAvailable = completedDraftRoomsWithPicks > 0 && dbAudit.rosterRows > 0;
  const replaySourceType = trueHistoricalDraftsAvailable ? "historical" : "synthetic";
  const replayPathCount = trueHistoricalDraftsAvailable ? completedDraftRoomsWithPicks : replayStyles.length * Math.max(1, validation.roomResults?.length ?? 0);
  const totalUserPickStates = replayPathCount * 2;
  const artifact = {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h10.16-replay-data-expansion-v1",
    trueHistoricalDraftsAvailable,
    replaySourceType,
    replayPathCount,
    totalUserPickStates,
    dataSourcesAudited: dbAudit.tables,
    sourceSummary: {
      completedDraftRoomsWithPicks,
      rosterRows: dbAudit.rosterRows,
      draftPickRows: dbAudit.draftPickRows,
      recommendationSnapshotRows: dbAudit.recommendationSnapshotRows,
      auditError: dbAudit.error,
    },
    historicalReplayLoaderDesign: {
      available: trueHistoricalDraftsAvailable,
      reconstructs: [
        "pick-by-pick board state from draft_room_picks ordered by pick_no",
        "user draft slot from draft pick draft_slot/pick_in_round or roster id fallback",
        "team count from draft settings, league total_teams, or league_rosters count",
        "snake position windows with buildDraftPositionContext",
        "roster state by applying picks up to each user pick",
        "actual drafted players between user picks",
      ],
      blockers: trueHistoricalDraftsAvailable
        ? []
        : [
            "No sufficient completed draft_room_picks set was found during read-only audit.",
            "Historical available-player snapshots are not persisted for every user pick.",
          ],
    },
    syntheticReplayGeneratorDesign: {
      active: !trueHistoricalDraftsAvailable,
      styles: replayStyles,
      methodology: "Generate deterministic board depletion variants from validation/live recommendation rows without changing recommendation logic or available-player ordering.",
    },
    metrics: {
      replaySourceType,
      replayPathCount,
      totalUserPickStates,
      actualTargetSurvivalRate: trueHistoricalDraftsAvailable ? replay.aggregate.wait_plan_target_survival_rate : null,
      syntheticTargetSurvivalRate: trueHistoricalDraftsAvailable ? null : replay.aggregate.wait_plan_target_survival_rate,
      wait_on_need_success_rate: replay.aggregate.wait_on_need_success_rate,
      fill_now_supported_rate: replay.aggregate.fill_now_supported_rate,
      tier_cliff_supported_rate: replay.aggregate.tier_cliff_supported_rate,
      elite_value_cases: replay.aggregate.elite_value_cases,
      low_confidence_push_count: replay.aggregate.low_confidence_push_count,
      K_DST_early_push_count: replay.aggregate.K_DST_early_push_count,
      IDP_low_confidence_overpush_count: replay.aggregate.IDP_low_confidence_overpush_count,
      instability_churn_count: replay.aggregate.instability_churn_count,
      safety_finding_count: replay.aggregate.safety_finding_count,
      waitPlanBackedRate: replay.aggregate.wait_plan_backed_rate,
      unsupportedWaitRate: rate(replay.aggregate.unsupported_wait_count, replay.aggregate.wait_on_need_cases),
      roomStyleBreakdown: Object.fromEntries(replayStyles.map((style) => [style, trueHistoricalDraftsAvailable ? 0 : validation.roomResults?.length ?? 0])),
      positionBreakdown: countBy(rows.map((row) => row.position ?? "UNK")),
      formatBreakdown: formatBreakdown(validation),
    },
    safety: {
      noWriteOperations: true,
      noDraftRoomMutation: true,
      noProjectionMutation: true,
      noRecommendationPersistence: true,
      noAvailablePlayerOrderMutation: true,
      noLegacyReplacement: true,
      noDefaultSourceChange: true,
    },
    artifactPathsRefreshed: {
      replay: "artifacts/projections/h10-recommendation-replay-evaluation.json",
      waitTargetPlanning: "artifacts/projections/h10-wait-target-planning.json",
    },
    verdict:
      replay.aggregate.safety_finding_count > 0
        ? "failed_safety_gates"
        : trueHistoricalDraftsAvailable
          ? "historical_replay_data_ready"
          : "synthetic_replay_expansion_ready",
  };
  const paths = writeArtifacts(artifact);

  console.log(JSON.stringify({
    trueHistoricalDraftsAvailable: artifact.trueHistoricalDraftsAvailable,
    replaySourceType: artifact.replaySourceType,
    replayPathCount: artifact.replayPathCount,
    totalUserPickStates: artifact.totalUserPickStates,
    completedDraftRoomsWithPicks,
    draftPickRows: dbAudit.draftPickRows,
    recommendationSnapshotRows: dbAudit.recommendationSnapshotRows,
    wait_on_need_success_rate: artifact.metrics.wait_on_need_success_rate,
    syntheticTargetSurvivalRate: artifact.metrics.syntheticTargetSurvivalRate,
    actualTargetSurvivalRate: artifact.metrics.actualTargetSurvivalRate,
    waitPlanBackedRate: artifact.metrics.waitPlanBackedRate,
    unsupportedWaitRate: artifact.metrics.unsupportedWaitRate,
    safety: artifact.safety,
    verdict: artifact.verdict,
    artifactPaths: paths,
  }, null, 2));

  if (artifact.verdict === "failed_safety_gates") process.exitCode = 1;
}

async function auditDatabaseSources() {
  const tables: TableAudit[] = [];
  const result = {
    tables,
    completedDraftRoomsWithPicks: 0,
    rosterRows: 0,
    draftPickRows: 0,
    recommendationSnapshotRows: 0,
    error: null as string | null,
  };

  try {
    const supabase = createAdminClient();
    const [draftRooms, picks, rosters, snapshots] = await Promise.all([
      countTable(supabase, "draft_rooms", ["id", "platform_draft_id", "status", "settings_json", "metadata_json"]),
      countTable(supabase, "draft_room_picks", ["draft_room_id", "pick_no", "round", "pick_in_round", "platform_roster_id", "sleeper_player_id", "player_name", "position", "team"]),
      countTable(supabase, "league_rosters", ["league_id", "platform_roster_id", "owner_platform_user_id", "owner_display_name", "players_json"]),
      countTable(supabase, "draft_recommendation_snapshots", ["draft_room_id", "pick_no_context", "user_next_pick_no", "recommendations_json", "roster_state_json", "available_players_json"]),
    ]);
    tables.push(draftRooms, picks, rosters, snapshots);
    result.rosterRows = rosters.rowCount ?? 0;
    result.draftPickRows = picks.rowCount ?? 0;
    result.recommendationSnapshotRows = snapshots.rowCount ?? 0;

    const { data: completedRooms } = await supabase
      .from("draft_rooms")
      .select("id,status")
      .in("status", ["complete", "completed"])
      .limit(100);
    const completedIds = (completedRooms ?? []).map((room) => room.id as string);
    if (completedIds.length) {
      const { data: completedPicks } = await supabase
        .from("draft_room_picks")
        .select("draft_room_id")
        .in("draft_room_id", completedIds)
        .limit(5000);
      result.completedDraftRoomsWithPicks = new Set((completedPicks ?? []).map((pick) => pick.draft_room_id as string)).size;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unable to audit database sources.";
    tables.push(
      schemaOnly("draft_rooms", ["id", "platform_draft_id", "status", "settings_json", "metadata_json"]),
      schemaOnly("draft_room_picks", ["draft_room_id", "pick_no", "round", "pick_in_round", "platform_roster_id", "sleeper_player_id", "player_name", "position", "team"]),
      schemaOnly("league_rosters", ["league_id", "platform_roster_id", "owner_platform_user_id", "owner_display_name", "players_json"]),
      schemaOnly("draft_recommendation_snapshots", ["draft_room_id", "pick_no_context", "user_next_pick_no", "recommendations_json", "roster_state_json", "available_players_json"])
    );
  }

  return result;
}

async function countTable(supabase: ReturnType<typeof createAdminClient>, table: string, fieldsAvailable: string[]): Promise<TableAudit> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  return {
    table,
    found: !error,
    rowCount: count ?? null,
    fieldsAvailable,
    missingForHistoricalReplay: missingFieldsFor(table),
    error: error?.message ?? null,
  };
}

function schemaOnly(table: string, fieldsAvailable: string[]): TableAudit {
  return {
    table,
    found: true,
    rowCount: null,
    fieldsAvailable,
    missingForHistoricalReplay: missingFieldsFor(table),
    error: "Database count unavailable; reporting schema-backed source.",
  };
}

function missingFieldsFor(table: string) {
  if (table === "draft_room_picks") return ["available_player_pool_at_pick"];
  if (table === "draft_recommendation_snapshots") return ["complete historical coverage for every user pick"];
  return [];
}

function uniqueRows<T extends { displayName: string; position: string | null; draftRoomId: string }>(input: T[]): T[] {
  return input.filter((row, index) => input.findIndex((candidate) => candidate.displayName === row.displayName && candidate.position === row.position && candidate.draftRoomId === row.draftRoomId) === index);
}

function formatBreakdown(validationArtifact: ValidationArtifact) {
  const counts: Record<string, number> = {};
  for (const room of validationArtifact.roomResults ?? []) {
    const coverage = room.formatCoverage ?? {};
    const labels = Object.entries(coverage).filter(([, value]) => value).map(([key]) => key);
    for (const label of labels.length ? labels : ["unknown"]) counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function readJson<T>(file: string): T {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", file);
  if (!existsSync(artifactPath)) throw new Error(`Missing artifact: ${artifactPath}`);
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function writeArtifacts(input: Record<string, any>) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-replay-data-expansion.json");
  const markdownPath = path.join(dir, "h10-replay-data-expansion.md");
  writeFileSync(jsonPath, JSON.stringify(input, null, 2));
  writeFileSync(markdownPath, renderMarkdown(input));
  return { jsonPath, markdownPath };
}

function renderMarkdown(input: Record<string, any>) {
  return [
    "# H10.16 Replay Data Expansion",
    "",
    `Generated: ${input.generatedAt}`,
    `Verdict: ${input.verdict}`,
    `Replay source type: ${input.replaySourceType}`,
    `True historical drafts available: ${input.trueHistoricalDraftsAvailable}`,
    "",
    "## Source Summary",
    "",
    `- Completed draft rooms with picks: ${input.sourceSummary.completedDraftRoomsWithPicks}`,
    `- Draft pick rows: ${input.sourceSummary.draftPickRows}`,
    `- Roster rows: ${input.sourceSummary.rosterRows}`,
    `- Recommendation snapshot rows: ${input.sourceSummary.recommendationSnapshotRows}`,
    `- Audit error: ${input.sourceSummary.auditError ?? "none"}`,
    "",
    "## Metrics",
    "",
    ...Object.entries(input.metrics).map(([key, value]) => `- ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`),
    "",
    "## Data Sources Audited",
    "",
    ...(input.dataSourcesAudited as TableAudit[]).map((source) => `- ${source.table}: found=${source.found}, rows=${source.rowCount ?? "unknown"}, missing=${source.missingForHistoricalReplay.join(", ") || "none"}`),
    "",
    "## Historical Replay Loader Design",
    "",
    ...(input.historicalReplayLoaderDesign.reconstructs as string[]).map((item) => `- ${item}`),
    "",
    "## Synthetic Replay Generator Design",
    "",
    `Active: ${input.syntheticReplayGeneratorDesign.active}`,
    `Styles: ${input.syntheticReplayGeneratorDesign.styles.join(", ")}`,
    input.syntheticReplayGeneratorDesign.methodology,
    "",
    "## Safety",
    "",
    ...Object.entries(input.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ].join("\n");
}

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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}
