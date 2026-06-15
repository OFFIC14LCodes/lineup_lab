import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";

import { buildBlackbirdBoard, findBannedBoardLanguage } from "@/lib/draft/blackbird-board";
import { buildProjectionCoverageAudit } from "@/lib/draft/projection-coverage";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import { E2E_AUTH_COOKIE } from "@/lib/supabase/auth";

const PORT = 3023;
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "h11-war-room-blackbird-board-screenshots");

type Artifact = {
  generatedAt: string;
  verdict: "passed" | "failed" | "blocked";
  boardOrderingMethod: string;
  syntheticAudit: ReturnType<typeof buildBlackbirdBoard>["diagnostics"] & {
    exampleRows: Array<Pick<ReturnType<typeof buildBlackbirdBoard>["rows"][number], "blackbirdBoardRank" | "playerName" | "projectionPoints" | "marketRank" | "dataStatus">>;
  };
  browserSmoke: {
    draftRoomId: string | null;
    visible: boolean;
    loadMoreVisible: boolean;
    loadedMore: boolean;
    projectionColumnVisible: boolean;
    blackbirdRankColumnVisible: boolean;
    valueColumnVisible: boolean;
    positionFilterWorks: boolean;
    mobileUsable: boolean;
    bannedLanguageFound: string[];
    mutationSafety: {
      draftStateUnchanged: boolean;
      availablePlayerOrderUnchanged: boolean;
    };
    projectionCoverage: {
      verdict: "passed" | "failed" | "not_evaluated";
      failureReasons: string[];
      boardRowsByPosition: Record<string, number>;
      missingProjectionPositions: string[];
    };
    screenshots: string[];
    error: string | null;
  };
  remainingRisks: string[];
};

loadLocalEnv();

main().catch((error) => {
  const artifact = blockedArtifact(error instanceof Error ? error.message : String(error));
  writeArtifacts(artifact);
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const synthetic = buildSyntheticAudit();
  const authUserId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (!authUserId) throw new Error("Missing BLACKBIRD_E2E_AUTH_USER_ID or SCORING_VALIDATION_OPERATOR_USER_ID for local e2e auth.");
  const draftRoomId = selectDraftRoomId();
  if (!draftRoomId) throw new Error("No H10 validation room found. Run npm run validate:h10-war-room-recommendations -- --all first.");

  const server = await startServer(authUserId);
  let browser: Browser | null = null;
  let browserSmoke: Artifact["browserSmoke"];
  try {
    browser = await chromium.launch();
    browserSmoke = await smokeBoard(browser, draftRoomId);
  } finally {
    stopServer(server);
    if (browser) await browser.close();
  }

  const failed =
    synthetic.bannedLanguageFound.length > 0 ||
    browserSmoke.error !== null ||
    browserSmoke.bannedLanguageFound.length > 0 ||
    !browserSmoke.mutationSafety.draftStateUnchanged ||
    !browserSmoke.mutationSafety.availablePlayerOrderUnchanged;
  const artifact: Artifact = {
    generatedAt: new Date().toISOString(),
    verdict: failed ? "failed" : "passed",
    boardOrderingMethod: synthetic.orderingMethod,
    syntheticAudit: {
      ...synthetic,
      exampleRows: buildSyntheticRows().rows.slice(0, 5).map((row) => ({
        blackbirdBoardRank: row.blackbirdBoardRank,
        playerName: row.playerName,
        projectionPoints: row.projectionPoints,
        marketRank: row.marketRank,
        dataStatus: row.dataStatus,
      })),
    },
    browserSmoke,
    remainingRisks: [
      "Browser smoke uses local authenticated E2E bypass rather than a real OAuth session.",
      "The board is smoked against one representative room; pure sorting tests cover edge cases.",
      "Blackbird rank is deterministic from the current draft room context and does not use ADP as the primary order.",
    ],
  };
  writeArtifacts(artifact);
  console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-war-room-blackbird-board.json" }, null, 2));
  if (failed) process.exitCode = 1;
}

async function smokeBoard(browser: Browser, draftRoomId: string): Promise<Artifact["browserSmoke"]> {
  const screenshots: string[] = [];
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: E2E_AUTH_COOKIE, value: "enabled", domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" }]);
  const page = await context.newPage();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const beforeState = await fetchJson(page, `/api/draft-rooms/${draftRoomId}/state`);
    await page.goto(`/drafts/${draftRoomId}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByText("Blackbird Board").waitFor({ timeout: 20_000 });

    const visible = await page.getByText("Blackbird Board").first().isVisible();
    const projectionCoverage = buildBrowserProjectionCoverage(draftRoomId, recordOrNull(beforeState.body));
    const projectionColumnVisible = await page.getByRole("columnheader", { name: "Proj" }).isVisible().catch(() => false);
    const blackbirdRankColumnVisible = await page.getByRole("columnheader", { name: "Blackbird Rank" }).isVisible().catch(() => false);
    const valueColumnVisible = await page.getByRole("columnheader", { name: "Value" }).isVisible().catch(() => false);
    const loadMore = page.getByRole("button", { name: "Load more" });
    const loadMoreVisible = await loadMore.isVisible().catch(() => false);
    let loadedMore = false;
    if (loadMoreVisible) {
      const beforeRows = await page.locator("tbody tr").count();
      await loadMore.click();
      await page.waitForTimeout(250);
      loadedMore = (await page.locator("tbody tr").count()) > beforeRows;
    } else {
      loadedMore = await page.getByText(/Showing \d+ of \d+ filtered players/).isVisible().catch(() => false);
    }

    const selectedPosition = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const positionSelect = selects.find((select) => {
        const values = Array.from(select.options).map((option) => option.value);
        return values.includes("All") && values.includes("QB") && values.includes("RB");
      });
      if (!positionSelect) return null;
      positionSelect.value = "QB";
      positionSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return positionSelect.value;
    });
    await page.waitForTimeout(250);
    const positionFilterWorks = selectedPosition === "QB" && await page.locator("tbody").innerText().then((text) => text.includes("QB") || text.includes("No available players match these filters.")).catch(() => false);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `desktop-${draftRoomId}.png`), fullPage: true });
    screenshots.push(path.join(SCREENSHOT_DIR, `desktop-${draftRoomId}.png`));

    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByText("Blackbird Board").waitFor({ timeout: 10_000 });
    const mobileUsable = await page.getByText("Blackbird Board").isVisible().catch(() => false);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `mobile-${draftRoomId}.png`), fullPage: true });
    screenshots.push(path.join(SCREENSHOT_DIR, `mobile-${draftRoomId}.png`));

    const bodyText = await page.locator("body").innerText();
    const afterState = await fetchJson(page, `/api/draft-rooms/${draftRoomId}/state`);
    return {
      draftRoomId,
      visible,
      loadMoreVisible,
      loadedMore,
      projectionColumnVisible,
      blackbirdRankColumnVisible,
      valueColumnVisible,
      positionFilterWorks,
      mobileUsable,
      bannedLanguageFound: findBannedBoardLanguage(bodyText),
      mutationSafety: {
        draftStateUnchanged: stateSignature(beforeState.body) === stateSignature(afterState.body),
        availablePlayerOrderUnchanged: playerOrderSignature(recordOrNull(beforeState.body)?.remainingPlayers) === playerOrderSignature(recordOrNull(afterState.body)?.remainingPlayers),
      },
      projectionCoverage,
      screenshots,
      error: visible && projectionColumnVisible && blackbirdRankColumnVisible && valueColumnVisible && loadedMore && positionFilterWorks && mobileUsable && projectionCoverage.verdict !== "failed" ? null : "Blackbird board browser assertions failed.",
    };
  } catch (error) {
    return {
      draftRoomId,
      visible: false,
      loadMoreVisible: false,
      loadedMore: false,
      projectionColumnVisible: false,
      blackbirdRankColumnVisible: false,
      valueColumnVisible: false,
      positionFilterWorks: false,
      mobileUsable: false,
      bannedLanguageFound: [],
      mutationSafety: { draftStateUnchanged: false, availablePlayerOrderUnchanged: false },
      projectionCoverage: { verdict: "not_evaluated", failureReasons: [], boardRowsByPosition: {}, missingProjectionPositions: [] },
      screenshots,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

async function fetchJson(page: Page, pathname: string): Promise<{ status: number; body: unknown }> {
  const url = `http://127.0.0.1:${PORT}${pathname}`;
  return page.evaluate(async (target) => {
    const response = await fetch(target, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }, url);
}

function buildSyntheticAudit() {
  return buildSyntheticRows().diagnostics;
}

function buildSyntheticRows() {
  return buildBlackbirdBoard({
    players: [
      player({ player_name: "Alpha WR", matched_player_id: "alpha", projected_points: 260, adp: 24, draftTargetScore: 74 }),
      player({ player_name: "Bravo QB", matched_player_id: "bravo", position: "QB", projected_points: 330, adp: 8, draftTargetScore: 88 }),
      player({ player_name: "Charlie RB", matched_player_id: "charlie", projected_points: null, adp: null, draftTargetScore: null }),
      player({ player_name: "Delta LB", matched_player_id: "delta", position: "LB", projected_points: 145, adp: 180, draftTargetScore: 62 }),
      player({ player_name: "Echo K", matched_player_id: "echo", position: "K", projected_points: null, adp: null, draftTargetScore: null }),
    ],
    overlays: [
      overlay({ entityId: "alpha", medianPoints: 261, pointsAboveReplacement: 20 }),
      overlay({ entityId: "bravo", position: "QB", medianPoints: 332, pointsAboveReplacement: 40 }),
      overlay({ entityId: "charlie", overlayStatus: "missing_projection", medianPoints: null, pointsAboveReplacement: null }),
      overlay({ entityId: "delta", position: "LB", medianPoints: 145, pointsAboveReplacement: 12, confidenceLabel: "low" }),
      overlay({ entityId: "echo", position: "K", overlayStatus: "missing_projection", medianPoints: null, pointsAboveReplacement: null }),
    ],
    recommendations: [
      recommendation({ entityId: "bravo", displayName: "Bravo QB", position: "QB", recommendationRank: 1, recommendationScore: 91, needTimingAction: "fill_now" }),
      recommendation({ entityId: "alpha", displayName: "Alpha WR", recommendationRank: 2, recommendationScore: 84, needTimingAction: "monitor" }),
      recommendation({ entityId: "delta", displayName: "Delta LB", position: "LB", recommendationRank: 3, recommendationScore: 70, needTimingAction: "wait_one_turn", waitPlanTargetCount: 2 }),
    ],
    draftedPlayerIds: ["not-present"],
  });
}

function selectDraftRoomId(): string | null {
  const artifactPath = path.join(OUTPUT_DIR, "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) return null;
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { roomInventory?: Array<{ draftRoomId: string; isSuperflex?: boolean; hasIDP?: boolean }> };
  return artifact.roomInventory?.find((room) => room.isSuperflex || room.hasIDP)?.draftRoomId ?? artifact.roomInventory?.[0]?.draftRoomId ?? null;
}

async function startServer(authUserId: string): Promise<ChildProcess> {
  const env = {
    ...process.env,
    PORT: String(PORT),
    ENABLE_BLACKBIRD_E2E_AUTH_BYPASS: "true",
    BLACKBIRD_E2E_AUTH_USER_ID: authUserId,
    DISABLE_WAR_ROOM_AUTO_SYNC_FOR_E2E: "true",
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW: "true",
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT: "true",
  };
  const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", String(PORT)], {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
    windowsHide: true,
  });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/`);
      if (response.ok || response.status < 500) return server;
    } catch {
      await sleep(500);
    }
  }
  stopServer(server);
  throw new Error("H11.3 board smoke server did not become ready.");
}

function stopServer(server: ChildProcess) {
  if (server.pid && process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  if (!server.killed) server.kill();
}

function writeArtifacts(artifact: Artifact) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, "h11-war-room-blackbird-board.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, "h11-war-room-blackbird-board.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: Artifact): string {
  return [
    "# H11.3 War Room Blackbird Board",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Ordering",
    "",
    artifact.boardOrderingMethod,
    "",
    "## Coverage",
    "",
    `- Rows audited: ${artifact.syntheticAudit.availableRows}`,
    `- H10 rows: ${artifact.syntheticAudit.h10RowsMatched}`,
    `- Projection rows: ${artifact.syntheticAudit.projectionRows}`,
    `- Blackbird rank rows: ${artifact.syntheticAudit.marketRows}`,
    `- Fallback ordered rows: ${artifact.syntheticAudit.fallbackOrderedRows}`,
    "",
    "## Example Rows",
    "",
    ...artifact.syntheticAudit.exampleRows.map((row) => `- #${row.blackbirdBoardRank} ${row.playerName}: proj=${row.projectionPoints ?? "unavailable"}, blackbirdRank=${row.marketRank ?? "unavailable"}`),
    "",
    "## Browser Smoke",
    "",
    `- Draft room: ${artifact.browserSmoke.draftRoomId ?? "none"}`,
    `- Visible: ${artifact.browserSmoke.visible}`,
    `- Load more visible: ${artifact.browserSmoke.loadMoreVisible}`,
    `- Loaded more: ${artifact.browserSmoke.loadedMore}`,
    `- Position filter works: ${artifact.browserSmoke.positionFilterWorks}`,
    `- Mobile usable: ${artifact.browserSmoke.mobileUsable}`,
    `- Banned language: ${artifact.browserSmoke.bannedLanguageFound.join(", ") || "none"}`,
    `- Mutation safety: ${JSON.stringify(artifact.browserSmoke.mutationSafety)}`,
    `- Projection coverage: ${artifact.browserSmoke.projectionCoverage.verdict}`,
    `- Projection coverage failures: ${artifact.browserSmoke.projectionCoverage.failureReasons.join("; ") || "none"}`,
    `- Board rows by position: ${JSON.stringify(artifact.browserSmoke.projectionCoverage.boardRowsByPosition)}`,
    `- Screenshots: ${artifact.browserSmoke.screenshots.join(", ")}`,
    `- Error: ${artifact.browserSmoke.error ?? "none"}`,
    "",
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}

function blockedArtifact(message: string): Artifact {
  return {
    generatedAt: new Date().toISOString(),
    verdict: "blocked",
    boardOrderingMethod: "not evaluated",
    syntheticAudit: { ...buildSyntheticAudit(), exampleRows: [] },
    browserSmoke: {
      draftRoomId: null,
      visible: false,
      loadMoreVisible: false,
      loadedMore: false,
      projectionColumnVisible: false,
      blackbirdRankColumnVisible: false,
      valueColumnVisible: false,
      positionFilterWorks: false,
      mobileUsable: false,
      bannedLanguageFound: [],
      mutationSafety: { draftStateUnchanged: false, availablePlayerOrderUnchanged: false },
      projectionCoverage: { verdict: "not_evaluated", failureReasons: [], boardRowsByPosition: {}, missingProjectionPositions: [] },
      screenshots: [],
      error: message,
    },
    remainingRisks: [message],
  };
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: overrides.matched_player_id ?? "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    rank: 10,
    adp: 12,
    projected_points: 220,
    dynasty_value: 10,
    best_ball_value: 10,
    superflex_value: 10,
    te_premium_value: 10,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    pointsAboveReplacement: 20,
    pointsAboveStarterCutline: 10,
    riskAdjustedValue: 18,
    confidenceAdjustedValue: 16,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: null,
    confidenceLabel: "medium",
    riskLabel: "low",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
    floorPoints: overrides.floorPoints ?? 190,
    ceilingPoints: overrides.ceilingPoints ?? 250,
  };
}

function recommendation(overrides: Partial<WarRoomRecommendationRow> = {}): WarRoomRecommendationRow {
  return {
    leagueId: "league",
    draftRoomId: "room",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    recommendationRank: 1,
    recommendationTier: "strong_target",
    recommendationScore: 80,
    scoreComponents: { leagueValue: 20, rosterNeed: 10, scarcity: 5, tierCliff: 5, marketValue: 5, availabilityRisk: 2, needTiming: 0, confidencePenalty: 0, formatPenalty: 0 },
    primaryReason: "Value signal",
    explanationFragments: [],
    reasonCodes: [],
    warningCodes: [],
    h10: { medianPoints: 220, pointsAboveReplacement: 20, riskAdjustedValue: 18, tier: 1, marketValueSignal: "aligned", confidenceLabel: "medium", valueReadiness: "READY" },
    draftContext: { currentRound: 1, currentPick: 1, picksUntilNextUserPick: 12, positionNeedLevel: null, starterSlotNeed: false, benchDepthNeed: false, tierDropBeforeNextPick: null },
    rosterNeedStatus: "filled",
    needUrgency: "low",
    futureAvailability: "likely_available_next_pick",
    tierDropRisk: "low",
    opportunityCost: "low",
    needTimingAction: "monitor",
    needTimingReasons: [],
    survivalConfidence: "medium",
    survivalConfidenceScore: 50,
    comparableOptionsNow: 5,
    comparableOptionsLikelyNextPick: 4,
    comparableOptionsLikelyNextTwoPicks: 3,
    waitRisk: "low",
    waitRiskReasons: [],
    needTimingAdjustedBySurvival: false,
    waitPlanTargets: [],
    waitPlanTargetCount: 0,
    waitPlanStrongTargetCount: 0,
    waitPlanSurvivalSummary: "Stable",
    waitPlanRisk: "low",
    waitPlanReason: "Stable",
    waitPlanBacked: false,
    waitPlanFallbackAction: null,
    needTimingAdjustedByWaitPlan: false,
    status: "recommendable",
    ...overrides,
  };
}

function stateSignature(state: unknown) {
  const row = recordOrNull(state);
  return JSON.stringify({ picks: row?.picks, room: row?.room, recommendations: row?.recommendations });
}

function playerOrderSignature(players: unknown) {
  return Array.isArray(players)
    ? players.map((player) => recordOrNull(player)?.sleeper_player_id ?? recordOrNull(player)?.matched_player_id ?? recordOrNull(player)?.player_name ?? "").join("|")
    : "";
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function buildBrowserProjectionCoverage(draftRoomId: string, state: Record<string, unknown> | null): Artifact["browserSmoke"]["projectionCoverage"] {
  if (!state) {
    return { verdict: "not_evaluated", failureReasons: ["state response unavailable"], boardRowsByPosition: {}, missingProjectionPositions: [] };
  }
  const room = recordOrNull(state.room);
  const league = recordOrNull(state.league);
  const leagueId = String(room?.league_id ?? "");
  const remainingPlayers = Array.isArray(state.remainingPlayers) ? (state.remainingPlayers as ScoredDraftTarget[]) : [];
  const recommendations = Array.isArray(state.h10RecommendationPreview) ? (state.h10RecommendationPreview as WarRoomRecommendationRow[]) : [];
  const board = buildBlackbirdBoard({
    players: remainingPlayers,
    overlays: Array.isArray(state.h10ValueOverlay) ? (state.h10ValueOverlay as WarRoomValueOverlayRow[]) : [],
    recommendations,
    draftedPlayerIds: Array.isArray(state.draftedPlayerIds) ? state.draftedPlayerIds.filter((id): id is string => typeof id === "string") : [],
  });
  const rosterRequirements = recordOrNull(state.rosterRequirements);
  if (!rosterRequirements) {
    return { verdict: "not_evaluated", failureReasons: ["roster requirements unavailable"], boardRowsByPosition: {}, missingProjectionPositions: [] };
  }
  const audit = buildProjectionCoverageAudit({
    draftRoomId,
    leagueId,
    scoringSettings: recordOrNull(league?.scoring_settings_json),
    rosterPositions: Array.isArray(league?.roster_positions_json) ? league.roster_positions_json.filter((slot): slot is string => typeof slot === "string") : [],
    rosterRequirements: rosterRequirements as Parameters<typeof buildProjectionCoverageAudit>[0]["rosterRequirements"],
    projectionRows: loadH10ValueRows().filter((row) => row.leagueId === leagueId),
    availablePlayers: remainingPlayers,
    boardRows: board.rows,
    recommendationRows: recommendations,
  });
  return {
    verdict: audit.verdict,
    failureReasons: audit.failureReasons,
    boardRowsByPosition: audit.boardRowsByPosition,
    missingProjectionPositions: audit.missingProjectionPositions,
  };
}

function loadH10ValueRows(): H10LeagueValueRow[] {
  const artifactPath = path.join(OUTPUT_DIR, "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] } | H10LeagueValueRow[];
  return Array.isArray(parsed) ? parsed : parsed.rows ?? [];
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
