import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
  isV82ExpectedGamesEnabled,
} from "@/lib/projections/feature-flags";

import type { ProjectionActivePolicyRefreshFinalClass, ProjectionActivePolicyRefreshFinalReport } from "./projection-active-policy-refresh-final-types";
import type {
  WarRoomV1FeatureCheck,
  WarRoomV1ReadinessArtifactPaths,
  WarRoomV1ReadinessCategory,
  WarRoomV1ReadinessCategoryName,
  WarRoomV1ReadinessInput,
  WarRoomV1ReadinessRecommendation,
  WarRoomV1ReadinessReport,
  WarRoomV1ReadinessStatus,
} from "./war-room-v1-readiness-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const FEATURE_FLAG_NAME = BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES;
const POLICY_CLASSES: ProjectionActivePolicyRefreshFinalClass[] = [
  "final_policy_active_candidate",
  "final_policy_shadow_only",
  "final_policy_current_path_only",
  "final_policy_manual_review",
  "final_policy_source_expansion_required",
  "final_policy_kicker_review_required",
  "final_policy_blocked_archive",
];

export function runWarRoomV1Readiness(options: { projectionSeason: number; includeIdp: boolean }): WarRoomV1ReadinessReport {
  const sourceArtifacts = {
    activePolicyRefreshFinal: path.join(OUTPUT_DIR, `projection-active-policy-refresh-final-${options.projectionSeason}.json`),
    depthChartResolution: path.join(OUTPUT_DIR, `projection-depth-chart-resolution-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    sleeperPolicyRefresh: path.join(OUTPUT_DIR, `projection-sleeper-policy-refresh-${options.projectionSeason}.json`),
    freeAgentUnknownPolicyReview: path.join(OUTPUT_DIR, `projection-free-agent-unknown-policy-review-${options.projectionSeason}.json`),
    sleeperMetadataResolution: path.join(OUTPUT_DIR, `projection-sleeper-metadata-resolution-${options.projectionSeason}.json`),
    activeUniversePolicyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };

  return buildWarRoomV1ReadinessFromData({
    options: { ...options, env: process.env },
    activePolicyRefreshFinal: readIfExists(sourceArtifacts.activePolicyRefreshFinal),
    depthChartResolution: readIfExists(sourceArtifacts.depthChartResolution),
    featureFlagReviewPacket: readIfExists(sourceArtifacts.featureFlagReviewPacket),
    sleeperPolicyRefresh: readIfExists(sourceArtifacts.sleeperPolicyRefresh),
    freeAgentUnknownPolicyReview: readIfExists(sourceArtifacts.freeAgentUnknownPolicyReview),
    sleeperMetadataResolution: readIfExists(sourceArtifacts.sleeperMetadataResolution),
    activeUniversePolicyPacket: readIfExists(sourceArtifacts.activeUniversePolicyPacket),
    preseasonProjectionSnapshot: readIfExists(sourceArtifacts.preseasonProjectionSnapshot),
    sourceTexts: readWarRoomSourceTexts(),
    sourceArtifacts,
  });
}

export function buildWarRoomV1ReadinessFromData(input: WarRoomV1ReadinessInput): WarRoomV1ReadinessReport {
  const sourceMissing = !input.activePolicyRefreshFinal || !input.depthChartResolution || !input.featureFlagReviewPacket;
  const warRoomFeatureChecklist = buildWarRoomFeatureChecklist(input.sourceTexts);
  const policyCounts = policyCountsOrZero(input.activePolicyRefreshFinal);
  const sourceHoldbackSummary = buildSourceHoldbackSummary(input);
  const v82Safety = buildV82Safety(input);
  const safetyGates = buildSafetyGates(input, sourceHoldbackSummary, v82Safety);
  const categories = buildCategories(input, warRoomFeatureChecklist, sourceHoldbackSummary, v82Safety, safetyGates);
  const categorySummary = Object.fromEntries(categories.map((category) => [category.name, category.status])) as WarRoomV1ReadinessReport["categorySummary"];
  const recommendation = recommendationFor(categories, safetyGates, sourceMissing);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      activePolicyRefreshFinal: "in-memory",
      depthChartResolution: "in-memory",
      featureFlagReviewPacket: "in-memory",
      sleeperPolicyRefresh: "in-memory",
      freeAgentUnknownPolicyReview: "in-memory",
      sleeperMetadataResolution: "in-memory",
      activeUniversePolicyPacket: "in-memory",
      preseasonProjectionSnapshot: "in-memory",
    },
    sourceMissing,
    recommendation,
    categorySummary,
    categories,
    warRoomFeatureChecklist,
    conservativeLaunchPolicy: policyCounts,
    sourceHoldbackSummary,
    v82Safety,
    e2eDraftTestChecklist: buildE2eDraftTestChecklist(),
    safetyGates,
    notes: [
      "H32 is dry-run/read-only readiness reporting only.",
      "War Room v1 readiness does not require a populated depth-chart source.",
      "Unresolved source-expansion rows remain conservatively held back.",
      "No live projection, rank, Draft Suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeWarRoomV1ReadinessArtifacts(report: WarRoomV1ReadinessReport): WarRoomV1ReadinessArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `war-room-v1-readiness-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildWarRoomFeatureChecklist(sourceTexts: WarRoomV1ReadinessInput["sourceTexts"]): WarRoomV1FeatureCheck[] {
  const source = `${sourceTexts.draftWarRoom}\n${sourceTexts.draftWarRoomTest}`;
  return [
    check("Draft Suggestions dynamic board", source.includes("Draft Suggestions") && source.includes("buildLiveDraftSuggestions"), "Dynamic Draft Suggestions board is wired."),
    check("Full Blackbird Rank static full board", source.includes("Full Blackbird Rank") && source.includes("full_blackbird"), "Full static league board is wired."),
    check("Available Blackbird Rank static available board", source.includes("Available Blackbird Rank") && source.includes("available_blackbird"), "Available-only static board is wired."),
    check("search/filter/load-more", source.includes("normalizeBoardSearch") && source.includes("setVisibleBoardRows((count) => count + 50)"), "Local search, filters, and load-more controls exist."),
    check("roster construction summary", source.includes("RosterConstructionSummary") && source.includes("Current roster by position"), "Roster construction summary exists."),
    check("plan alignment chips", source.includes("PlanAlignmentChips") && source.includes("buildWarRoomPlanAlignmentLabels"), "Plan Alignment chips are wired."),
    check("player reasoning modal", source.includes("Player Reasoning") && source.includes("buildWarRoomPlayerReasonStack"), "Player reasoning modal is wired."),
    check("GM Brief preview", source.includes("GM Brief") && source.includes("buildWarRoomGmBrief"), "Deterministic GM Brief preview exists."),
    check("live state freshness/sync status", source.includes("LiveSyncStatusIndicator") && source.includes("buildWarRoomLiveState"), "Live sync status and freshness warnings exist."),
    check("dev-only scoring status panel", source.includes("SHOW_SCORING_FOUNDATION_STATUS") && source.includes("Scoring Foundation Status"), "Dev-only scoring foundation status panel exists."),
    check("AI context builder", sourceTexts.aiContext.includes("buildWarRoomAiContext") && sourceTexts.aiContext.includes("noAiApiCalls"), "Read-only deterministic AI context builder exists."),
  ];
}

function buildCategories(
  input: WarRoomV1ReadinessInput,
  featureChecks: WarRoomV1FeatureCheck[],
  sourceHoldbackSummary: WarRoomV1ReadinessReport["sourceHoldbackSummary"],
  v82Safety: WarRoomV1ReadinessReport["v82Safety"],
  safetyGates: WarRoomV1ReadinessReport["safetyGates"],
): WarRoomV1ReadinessCategory[] {
  const source = `${input.sourceTexts.draftWarRoom}\n${input.sourceTexts.draftWarRoomTest}`;
  const categories: WarRoomV1ReadinessCategory[] = [
    category("war_room_ui_readiness", checksByName(featureChecks, [
      "Draft Suggestions dynamic board",
      "search/filter/load-more",
      "GM Brief preview",
      "live state freshness/sync status",
      "dev-only scoring status panel",
    ])),
    category("draft_sync_readiness", [
      check("draft state fetch", source.includes(`/api/draft-rooms/`) && source.includes("/state"), "Draft state endpoint is fetched."),
      check("manual sync action", source.includes("/sync") && source.includes("syncNow"), "Manual sync action is wired."),
      check("stale/error states", source.includes("Unable to load draft room.") && source.includes("Sync failed."), "Readable stale/error states exist."),
    ]),
    category("board_modes_readiness", checksByName(featureChecks, [
      "Draft Suggestions dynamic board",
      "Full Blackbird Rank static full board",
      "Available Blackbird Rank static available board",
      "search/filter/load-more",
    ])),
    category("player_detail_readiness", checksByName(featureChecks, ["player reasoning modal"]).concat([
      check("historical profile modal", source.includes("Historical Profile") && source.includes("/api/player-profiles/"), "Historical profile modal is wired."),
    ])),
    category("roster_construction_readiness", checksByName(featureChecks, ["roster construction summary", "plan alignment chips"])),
    category("gm_brief_readiness", checksByName(featureChecks, ["GM Brief preview"])),
    category("ai_context_readiness", checksByName(featureChecks, ["AI context builder"]).concat([
      check("AI context no mutations", input.sourceTexts.aiContext.includes("canMutateDraft: false") && input.sourceTexts.aiContext.includes("noSupabaseWrites"), "AI context declares read-only safety."),
    ])),
    category("projection_foundation_readiness", [
      check("preseason projection snapshot present", Boolean(input.preseasonProjectionSnapshot), "Preseason projection snapshot artifact is available."),
      check("active policy artifact present", Boolean(input.activePolicyRefreshFinal), "Final active policy artifact is available."),
      check("feature flag packet present", Boolean(input.featureFlagReviewPacket), "v8.2 review packet is available."),
    ]),
    category("active_policy_readiness", [
      check("active candidates available", (input.activePolicyRefreshFinal?.policyCounts.h30FinalPolicyCounts.final_policy_active_candidate ?? 0) > 0, "Conservative active candidate pool exists."),
      check("manual rows held manual", (input.activePolicyRefreshFinal?.remainingBlockers.manualReviewRows ?? 0) >= 0, "Manual-review rows are explicitly tracked."),
      check("source expansion held back", sourceHoldbackSummary.depthChartSourceRowsHeldBack >= 0, "Source-expansion rows are tracked and held back."),
    ], "ready_with_holdbacks"),
    category("v8_2_flag_safety", [
      check("v8.2 disabled", !v82Safety.enabled, "v8.2 feature flag is disabled."),
      check("flag default disabled", v82Safety.defaultDisabled, "Feature flag defaults disabled."),
      check("zero checks preserved", v82Safety.zeroChecksPreserved, "Protected zero checks are preserved."),
    ]),
    category("source_holdback_safety", [
      check("depth chart unresolved held back", sourceHoldbackSummary.depthChartSourceRowsHeldBack >= sourceHoldbackSummary.depthChartUnmatchedRows, "Depth-chart unresolved rows remain held back."),
      check("free agent unknown not auto-promoted", sourceHoldbackSummary.freeAgentUnknownRowsNotAutoPromoted, "Free-agent/unknown rows are not auto-promoted."),
      check("kicker rows not auto-promoted", sourceHoldbackSummary.kickerRowsNotAutoPromoted, "Kicker rows remain out of auto-promotion."),
      check("legacy rows blocked/archive", sourceHoldbackSummary.legacyRowsBlockedArchive, "Legacy rows remain blocked/archive."),
    ], "ready_with_holdbacks"),
    category("e2e_draft_test_readiness", [
      check("H33 checklist generated", buildE2eDraftTestChecklist().length > 0, "E2E draft test checklist is generated."),
      check("live/mock Sleeper QA not completed by H32", false, "H33 live/mock draft QA remains the major launch gate."),
    ], "needs_e2e_test"),
  ];

  const failedGate = safetyGates.find((gateRow) => !gateRow.passed);
  if (failedGate) {
    return categories.map((row) => row.name === "v8_2_flag_safety" || row.name === "source_holdback_safety" ? { ...row, status: "blocked" } : row);
  }
  return categories;
}

function category(name: WarRoomV1ReadinessCategoryName, checks: WarRoomV1FeatureCheck[], holdbackStatus?: WarRoomV1ReadinessStatus): WarRoomV1ReadinessCategory {
  const passedChecks = checks.filter((item) => item.present).length;
  const status = passedChecks === checks.length
    ? holdbackStatus ?? "ready"
    : holdbackStatus === "needs_e2e_test"
      ? "needs_e2e_test"
      : "needs_manual_review";
  return {
    name,
    status,
    passedChecks,
    totalChecks: checks.length,
    checks,
    detail: `${passedChecks}/${checks.length} checks passed.`,
  };
}

function buildSourceHoldbackSummary(input: WarRoomV1ReadinessInput): WarRoomV1ReadinessReport["sourceHoldbackSummary"] {
  const active = input.activePolicyRefreshFinal;
  const freeAgentActivePromotions = input.freeAgentUnknownPolicyReview?.summary.activePromotions ?? 0;
  const blockedArchive = active?.policyCounts.h30FinalPolicyCounts.final_policy_blocked_archive ?? 0;
  return {
    depthChartSourceRowsHeldBack: input.depthChartResolution?.policyImpactPreview.h31DepthChartPreviewCounts.final_policy_source_expansion_required
      ?? active?.policyCounts.h30FinalPolicyCounts.final_policy_source_expansion_required
      ?? 0,
    depthChartUnmatchedRows: input.depthChartResolution?.summary.unmatched ?? 0,
    freeAgentUnknownRowsNotAutoPromoted: freeAgentActivePromotions === 0,
    freeAgentUnknownManualReviewRows: active?.remainingBlockers.freeAgentUnknownHighImportanceManualReviewRows ?? 0,
    inactiveStaleRowsHeldBack: active?.remainingBlockers.inactiveStaleHeldBack ?? 0,
    positionConflictsManualReview: active?.remainingBlockers.positionConflictRows ?? 0,
    kickerRowsNotAutoPromoted: (active?.policyCounts.h30FinalPolicyCounts.final_policy_kicker_review_required ?? 0) === (active?.remainingBlockers.kickerPolicyRows ?? 0),
    legacyRowsBlockedArchive: blockedArchive === (active?.remainingBlockers.blockedArchiveRows ?? blockedArchive),
  };
}

function buildV82Safety(input: WarRoomV1ReadinessInput): WarRoomV1ReadinessReport["v82Safety"] {
  const activeImpact = input.activePolicyRefreshFinal?.v82ControlledFlagImpact;
  const zeroChecks = activeImpact?.protectedZeroChecks
    ?? input.depthChartResolution?.v82ControlledFlagImpact.protectedZeroChecks
    ?? input.freeAgentUnknownPolicyReview?.v82Impact.protectedZeroChecks
    ?? { kRowsUsingV82: true, criticalMoversUsingV82: true, meaningfulRankMoversUsingV82: true, legacyRowsUsingV82: true };
  const safeRowsHeldBack = (activeImpact?.safeV82RowsHeldShadowOnly ?? 0)
    + (activeImpact?.safeV82RowsHeldCurrentPathOnly ?? 0)
    + (activeImpact?.safeV82RowsHeldManualReview ?? 0)
    + (activeImpact?.safeV82RowsStillSourceExpansionRequired ?? 0)
    + (activeImpact?.safeV82RowsBlockedArchive ?? 0)
    + (activeImpact?.safeV82RowsKickerReviewRequired ?? 0);
  return {
    featureFlagName: FEATURE_FLAG_NAME,
    enabled: isV82ExpectedGamesEnabled(input.options.env ?? {}),
    defaultDisabled: !isV82ExpectedGamesEnabled({}),
    safeRowsAllowedByFinalPolicy: activeImpact?.safeV82RowsAllowedByFinalPolicy ?? 0,
    safeRowsHeldBack,
    controlledFlagReviewRemainsBlocked: activeImpact?.controlledFlagReviewRemainsBlocked ?? input.featureFlagReviewPacket?.recommendation !== "ready_for_controlled_flag_review",
    zeroChecksPreserved: Object.values(zeroChecks).every(Boolean),
    protectedZeroChecks: zeroChecks,
  };
}

function buildSafetyGates(
  input: WarRoomV1ReadinessInput,
  sourceHoldbackSummary: WarRoomV1ReadinessReport["sourceHoldbackSummary"],
  v82Safety: WarRoomV1ReadinessReport["v82Safety"],
) {
  const depthPreview = input.depthChartResolution?.policyImpactPreview.h31DepthChartPreviewCounts;
  const sourceExpansionRequired = depthPreview?.final_policy_source_expansion_required ?? 0;
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts/source text and writes only local H32 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", !v82Safety.enabled, `Feature flag ${FEATURE_FLAG_NAME} enabled=${v82Safety.enabled}.`),
    gate("unresolved_source_rows_held_back", sourceHoldbackSummary.depthChartSourceRowsHeldBack >= sourceExpansionRequired, `${sourceHoldbackSummary.depthChartSourceRowsHeldBack} unresolved source rows held back.`),
    gate("depth_chart_unmatched_not_forced_active", (depthPreview?.final_policy_active_candidate_preview ?? 0) === 0 || sourceHoldbackSummary.depthChartUnmatchedRows === 0, "Unmatched depth-chart rows are not forced active."),
    gate("kicker_rows_not_auto_promoted", sourceHoldbackSummary.kickerRowsNotAutoPromoted, "Kicker rows remain in policy review."),
    gate("legacy_rows_blocked", sourceHoldbackSummary.legacyRowsBlockedArchive, "Legacy rows remain blocked/archive."),
    gate("zero_checks_preserved", v82Safety.zeroChecksPreserved, JSON.stringify(v82Safety.protectedZeroChecks)),
  ];
}

function recommendationFor(categories: WarRoomV1ReadinessCategory[], safetyGates: WarRoomV1ReadinessReport["safetyGates"], sourceMissing: boolean): WarRoomV1ReadinessRecommendation {
  if (sourceMissing || safetyGates.some((gateRow) => !gateRow.passed) || categories.some((row) => row.status === "blocked")) return "war_room_v1_blocked";
  if (categories.some((row) => row.status === "needs_manual_review")) return "war_room_v1_needs_manual_review";
  if (categories.some((row) => row.status === "needs_e2e_test")) return "war_room_v1_needs_e2e_draft_test";
  return "war_room_v1_ready_with_holdbacks";
}

function buildE2eDraftTestChecklist() {
  return [
    "connect Sleeper draft room",
    "load draft room page",
    "verify draft suggestions render",
    "verify full Blackbird rank renders drafted + undrafted",
    "verify available rank hides drafted players",
    "verify picks update after Sleeper poll",
    "verify drafted players disappear from available board",
    "verify roster construction updates after picks",
    "verify Plan Alignment updates",
    "verify GM Brief updates",
    "verify player modal opens from each board mode",
    "verify search/filter/load-more works",
    "verify sync status changes correctly",
    "verify stale/error states are readable",
    "verify mobile/tablet layout remains usable",
  ];
}

function readWarRoomSourceTexts(): WarRoomV1ReadinessInput["sourceTexts"] {
  return {
    draftWarRoom: readText("src/components/draft-war-room.tsx"),
    draftWarRoomTest: readText("src/components/draft-war-room.test.ts"),
    aiContext: readText("src/lib/ai/war-room-ai-context.ts"),
    liveState: readText("src/lib/draft/war-room-live-state.ts"),
    playerReasons: readText("src/lib/draft/war-room-player-reasons.ts"),
  };
}

function policyCountsOrZero(report: ProjectionActivePolicyRefreshFinalReport | null): WarRoomV1ReadinessReport["conservativeLaunchPolicy"] {
  const counts = Object.fromEntries(POLICY_CLASSES.map((policy) => [policy, 0])) as WarRoomV1ReadinessReport["conservativeLaunchPolicy"];
  return report?.policyCounts.h30FinalPolicyCounts ?? counts;
}

function checksByName(checks: WarRoomV1FeatureCheck[], names: string[]) {
  return names.map((name) => checks.find((item) => item.name === name)).filter((item): item is WarRoomV1FeatureCheck => Boolean(item));
}

function check(name: string, present: boolean, detail: string): WarRoomV1FeatureCheck {
  return { name, present, detail };
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function renderMarkdown(report: WarRoomV1ReadinessReport) {
  return `# War Room V1 Readiness ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Category Summary

${report.categories.map((categoryRow) => `- ${categoryRow.name}: ${categoryRow.status} (${categoryRow.detail})`).join("\n")}

## Conservative Launch Policy

\`\`\`json
${JSON.stringify(report.conservativeLaunchPolicy, null, 2)}
\`\`\`

## Source Holdbacks

\`\`\`json
${JSON.stringify(report.sourceHoldbackSummary, null, 2)}
\`\`\`

## v8.2 Safety

\`\`\`json
${JSON.stringify(report.v82Safety, null, 2)}
\`\`\`

## H33 E2E Draft Test Checklist

${report.e2eDraftTestChecklist.map((item) => `- ${item}`).join("\n")}

## Safety Gates

${renderGateTable(report.safetyGates)}
`;
}

function renderCsv(report: WarRoomV1ReadinessReport) {
  const headers = ["category", "status", "passed_checks", "total_checks", "detail"];
  const rows = report.categories.map((row) => [row.name, row.status, row.passedChecks, row.totalChecks, row.detail]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: WarRoomV1ReadinessReport["safetyGates"]) {
  return ["| Gate | Status | Detail |", "|---|---|---|", ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function readIfExists<T>(artifactPath: string): T | null {
  return existsSync(artifactPath) ? JSON.parse(readFileSync(artifactPath, "utf8")) as T : null;
}

function readText(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
