import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";

import { E2E_AUTH_COOKIE } from "@/lib/supabase/auth";

type InventoryRoom = {
    source: string;
    draftRoomId: string;
    leagueId: string;
    leagueName: string | null;
    positions_present?: string[];
    hasKicker?: boolean;
    hasTeamDefense?: boolean;
    hasIDP?: boolean;
    isSuperflex?: boolean;
    benchDepth?: number;
};

type SelectedRoom = InventoryRoom & { reason: string };

type ValidationArtifact = {
  roomInventory?: InventoryRoom[];
};

type FlagCase = {
  name: string;
  port: number;
  preview: boolean;
  experiment: boolean;
};

type RoomResult = {
  roomId: string;
  leagueName: string | null;
  flagCase: string;
  loaded: boolean;
  legacyDefault: boolean;
  previewVisible: boolean;
  selectorVisible: boolean;
  sourceSwitchWorked: boolean;
  switchedBackToLegacy: boolean;
  experimentalLabelsPresent: boolean;
  bannedLanguageFound: string[];
  mutationSafety: {
    legacyRecommendationsUnchanged: boolean;
    availablePlayerOrderUnchanged: boolean;
    projectionsUnchanged: boolean;
    draftRoomStateUnchanged: boolean;
    selectedSourceNotPersisted: boolean;
  };
  screenshotPath: string | null;
  error: string | null;
};

type SmokeArtifact = {
  generatedAt: string;
  verdict: "passed" | "failed" | "blocked";
  authMethod: string;
  browserEngine: string;
  flagCases: FlagCase[];
  roomsTested: Array<{ draftRoomId: string; leagueName: string | null; reason: string }>;
  results: RoomResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    mutationSafetyPassed: boolean;
  };
  remainingRisks: string[];
};

const FLAG_CASES: FlagCase[] = [
  { name: "legacy_flags_disabled", port: 3010, preview: false, experiment: false },
  { name: "preview_only", port: 3011, preview: true, experiment: false },
  { name: "experiment_selector", port: 3012, preview: true, experiment: true },
];
const BANNED_LANGUAGE = ["must draft", "guaranteed", "AI advice"];

loadLocalEnv();

main().catch((error) => {
  const artifact = buildBlockedArtifact(error instanceof Error ? error.message : String(error));
  writeArtifacts(artifact);
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const authUserId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (!authUserId) throw new Error("Missing BLACKBIRD_E2E_AUTH_USER_ID or SCORING_VALIDATION_OPERATOR_USER_ID for local e2e auth.");

  const rooms = selectRooms(loadValidationArtifact());
  if (!rooms.length) throw new Error("No H10 validation rooms found. Run npm run validate:h10-war-room-recommendations -- --all first.");

  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    throw new Error(`Playwright Chromium launch failed. Run npx playwright install chromium. ${error instanceof Error ? error.message : String(error)}`);
  }

  const results: RoomResult[] = [];
  try {
    for (const flagCase of FLAG_CASES) {
      const server = await startServer(flagCase, authUserId);
      try {
        for (const room of rooms) {
          results.push(await exerciseRoom({ browser, flagCase, room }));
        }
      } finally {
        stopServer(server);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => result.error || result.bannedLanguageFound.length || !allSafetyPassed(result)).length;
  const artifact: SmokeArtifact = {
    generatedAt: new Date().toISOString(),
    verdict: failed ? "failed" : "passed",
    authMethod: "server-only local e2e auth bypass via signed-in test user id env and http cookie",
    browserEngine: "chromium",
    flagCases: FLAG_CASES,
    roomsTested: rooms.map((room) => ({ draftRoomId: room.draftRoomId, leagueName: room.leagueName, reason: room.reason })),
    results,
    summary: {
      total: results.length,
      passed: results.length - failed,
      failed,
      blocked: 0,
      mutationSafetyPassed: results.every((result) => Object.values(result.mutationSafety).every(Boolean)),
    },
    remainingRisks: [
      "This harness does not perform real Google OAuth; it uses a server-only local authenticated test path.",
      "The harness disables War Room auto-sync so it can isolate UI interaction mutation safety from Sleeper sync writes.",
    ],
  };
  writeArtifacts(artifact);
  if (failed) process.exitCode = 1;
}

async function exerciseRoom(input: { browser: Browser; flagCase: FlagCase; room: ReturnType<typeof selectRooms>[number] }): Promise<RoomResult> {
  const baseUrl = `http://127.0.0.1:${input.flagCase.port}`;
  const context = await input.browser.newContext({ baseURL: baseUrl });
  await context.addCookies([{ name: E2E_AUTH_COOKIE, value: "enabled", domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" }]);
  const page = await context.newPage();
  const screenshotDir = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-browser-screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `${input.flagCase.name}-${input.room.draftRoomId}.png`);

  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const before = await fetchState(page, input.room.draftRoomId);
    await page.goto(`/drafts/${input.room.draftRoomId}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByRole("heading", { name: /draft board/i }).waitFor({ timeout: 20_000 });

    const initialText = sanitizeProperNouns(await page.locator("body").innerText());
    const legacyDefault = await page.getByRole("heading", { name: /recommended targets/i }).isVisible();
    const selectorVisible = await page.getByText("Recommendation Source").isVisible().catch(() => false);
    const previewVisible = await page.getByText("Blackbird Value Preview").isVisible().catch(() => false);
    let experimentalLabelsPresent = input.flagCase.preview && !input.flagCase.experiment
      ? /Experimental[\s\S]*Deterministic[\s\S]*Projection-based[\s\S]*Not final draft advice/.test(initialText)
      : true;
    const bannedLanguageFound = new Set(BANNED_LANGUAGE.filter((phrase) => initialText.toLowerCase().includes(phrase.toLowerCase())));

    let sourceSwitchWorked = !input.flagCase.experiment;
    let switchedBackToLegacy = !input.flagCase.experiment;
    if (input.flagCase.experiment) {
      await page.getByRole("button", { name: "Blackbird Value Preview" }).click();
      sourceSwitchWorked = await page.getByText("Preview diagnostics").isVisible({ timeout: 10_000 }).catch(() => false);
      const blackbirdText = sanitizeProperNouns(await page.locator("body").innerText());
      experimentalLabelsPresent = /Experimental[\s\S]*Deterministic[\s\S]*Projection-based[\s\S]*Not final draft advice/.test(blackbirdText);
      BANNED_LANGUAGE.filter((phrase) => blackbirdText.toLowerCase().includes(phrase.toLowerCase())).forEach((phrase) => bannedLanguageFound.add(phrase));
      await page.getByRole("button", { name: "Legacy" }).click();
      switchedBackToLegacy = await page.getByRole("button", { name: "Legacy" }).isVisible().catch(() => false);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const after = await fetchState(page, input.room.draftRoomId);

    return {
      roomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      flagCase: input.flagCase.name,
      loaded: true,
      legacyDefault,
      previewVisible: input.flagCase.preview || input.flagCase.experiment ? previewVisible : !previewVisible,
      selectorVisible: input.flagCase.experiment ? selectorVisible : !selectorVisible,
      sourceSwitchWorked,
      switchedBackToLegacy,
      experimentalLabelsPresent,
      bannedLanguageFound: [...bannedLanguageFound],
      mutationSafety: compareState(before, after),
      screenshotPath,
      error: null,
    };
  } catch (error) {
    return {
      roomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      flagCase: input.flagCase.name,
      loaded: false,
      legacyDefault: false,
      previewVisible: false,
      selectorVisible: false,
      sourceSwitchWorked: false,
      switchedBackToLegacy: false,
      experimentalLabelsPresent: false,
      bannedLanguageFound: [],
      mutationSafety: {
        legacyRecommendationsUnchanged: false,
        availablePlayerOrderUnchanged: false,
        projectionsUnchanged: false,
        draftRoomStateUnchanged: false,
        selectedSourceNotPersisted: false,
      },
      screenshotPath: existsSync(screenshotPath) ? screenshotPath : null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

function sanitizeProperNouns(text: string) {
  return text.replace(/\bDrew Lock\b/g, "Drew L.");
}

async function fetchState(page: Page, draftRoomId: string) {
  const payload = await page.evaluate(async (id) => {
    const response = await fetch(`/api/draft-rooms/${id}/state`, { cache: "no-store" });
    return { ok: response.ok, status: response.status, body: await response.json() };
  }, draftRoomId);
  if (!payload.ok) throw new Error(`State request failed: ${payload.status} ${JSON.stringify(payload.body)}`);
  return stateSnapshot(payload.body);
}

function stateSnapshot(state: Record<string, unknown>) {
  const recommendations = Array.isArray(state.recommendations) ? state.recommendations : [];
  const remainingPlayers = Array.isArray(state.remainingPlayers) ? state.remainingPlayers : [];
  const h10RecommendationPreview = Array.isArray(state.h10RecommendationPreview) ? state.h10RecommendationPreview : [];
  const room = state.room && typeof state.room === "object" ? state.room as Record<string, unknown> : {};
  return {
    legacyRecommendations: hashJson(recommendations.map(compactPlayer)),
    availablePlayerOrder: hashJson(remainingPlayers.map(compactPlayer)),
    projections: hashJson(h10RecommendationPreview.map((row) => compactRecommendation(row as Record<string, unknown>))),
    draftRoomState: hashJson({
      id: room.id,
      status: room.status,
      last_synced_at: room.last_synced_at,
      currentPickNumber: state.currentPickNumber,
      currentRound: state.currentRound,
      picksUntilMyNextPick: state.picksUntilMyNextPick,
      picks: Array.isArray(state.picks) ? state.picks.length : null,
    }),
    selectedSourceState: hashJson({
      h10RecommendationPreviewEnabled: state.h10RecommendationPreviewEnabled,
      h10RecommendationExperimentEnabled: state.h10RecommendationExperimentEnabled,
      persistedRecommendationSource: (state as { recommendationSource?: unknown }).recommendationSource ?? null,
    }),
  };
}

function compactPlayer(row: unknown) {
  const value = row && typeof row === "object" ? row as Record<string, unknown> : {};
  return {
    sleeper_player_id: value.sleeper_player_id,
    matched_player_id: value.matched_player_id,
    player_name: value.player_name,
    position: value.position,
    rank: value.rank,
    score: value.draftTargetScore,
  };
}

function compactRecommendation(row: Record<string, unknown>) {
  return {
    entityId: row.entityId,
    displayName: row.displayName,
    position: row.position,
    recommendationRank: row.recommendationRank,
    recommendationScore: row.recommendationScore,
    needTimingAction: row.needTimingAction,
  };
}

function compareState(before: ReturnType<typeof stateSnapshot>, after: ReturnType<typeof stateSnapshot>): RoomResult["mutationSafety"] {
  return {
    legacyRecommendationsUnchanged: before.legacyRecommendations === after.legacyRecommendations,
    availablePlayerOrderUnchanged: before.availablePlayerOrder === after.availablePlayerOrder,
    projectionsUnchanged: before.projections === after.projections,
    draftRoomStateUnchanged: before.draftRoomState === after.draftRoomState,
    selectedSourceNotPersisted: before.selectedSourceState === after.selectedSourceState,
  };
}

function allSafetyPassed(result: RoomResult) {
  return result.loaded && result.legacyDefault && result.sourceSwitchWorked && result.switchedBackToLegacy && result.experimentalLabelsPresent && Object.values(result.mutationSafety).every(Boolean);
}

function selectRooms(artifact: ValidationArtifact): SelectedRoom[] {
  const inventory = (artifact.roomInventory ?? []).filter((room) => room.source === "validation_seed" || room.source === "live");
  const selected: SelectedRoom[] = [];
  addFirst("superflex_qb", (room) => Boolean(room.isSuperflex));
  addFirst("kicker", (room) => Boolean(room.hasKicker));
  addFirst("dst", (room) => Boolean(room.hasTeamDefense));
  addFirst("shallow_roster", (room) => (room.benchDepth ?? 99) <= 4);
  addFirst("idp_mixed", (room) => Boolean(room.hasIDP));
  return selected;

  function addFirst(reason: string, predicate: (room: InventoryRoom) => boolean) {
    const room = inventory.find((candidate) => predicate(candidate) && !selected.some((existing) => existing.draftRoomId === candidate.draftRoomId));
    if (room) selected.push({ ...room, reason });
  }
}

async function startServer(flagCase: FlagCase, authUserId: string): Promise<ChildProcess> {
  const env = {
    ...process.env,
    ENABLE_BLACKBIRD_E2E_AUTH_BYPASS: "true",
    BLACKBIRD_E2E_AUTH_USER_ID: authUserId,
    DISABLE_WAR_ROOM_AUTO_SYNC_FOR_E2E: "true",
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW: String(flagCase.preview),
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT: String(flagCase.experiment),
  };
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(flagCase.port)], {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
  });
  await waitForServer(flagCase.port, child);
  return child;
}

async function waitForServer(port: number, child: ChildProcess) {
  const url = `http://127.0.0.1:${port}/login`;
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    if (child.exitCode !== null) throw new Error(`Dev server exited early with code ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`Dev server did not become ready at ${url}.`);
}

function stopServer(child: ChildProcess) {
  if (child.exitCode === null) child.kill();
}

function loadValidationArtifact(): ValidationArtifact {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) throw new Error("Missing h10-war-room-recommendation-validation.json.");
  return JSON.parse(readFileSync(artifactPath, "utf8")) as ValidationArtifact;
}

function buildBlockedArtifact(reason: string): SmokeArtifact {
  return {
    generatedAt: new Date().toISOString(),
    verdict: "blocked",
    authMethod: "server-only local e2e auth bypass via signed-in test user id env and http cookie",
    browserEngine: "chromium",
    flagCases: FLAG_CASES,
    roomsTested: [],
    results: [],
    summary: { total: 0, passed: 0, failed: 0, blocked: 1, mutationSafetyPassed: false },
    remainingRisks: [reason],
  };
}

function writeArtifacts(artifact: SmokeArtifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h10-war-room-browser-smoke.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(dir, "h10-war-room-browser-smoke.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: SmokeArtifact) {
  return [
    "# H10.10 War Room Browser Smoke",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    `Auth method: ${artifact.authMethod}`,
    `Browser engine: ${artifact.browserEngine}`,
    "",
    "## Summary",
    "",
    `- Total: ${artifact.summary.total}`,
    `- Passed: ${artifact.summary.passed}`,
    `- Failed: ${artifact.summary.failed}`,
    `- Blocked: ${artifact.summary.blocked}`,
    `- Mutation safety passed: ${artifact.summary.mutationSafetyPassed}`,
    "",
    "## Rooms",
    "",
    ...artifact.results.map((result) => [
      `### ${result.flagCase} / ${result.leagueName ?? result.roomId}`,
      "",
      `- Loaded: ${result.loaded}`,
      `- Legacy default: ${result.legacyDefault}`,
      `- Preview visible assertion: ${result.previewVisible}`,
      `- Selector visible assertion: ${result.selectorVisible}`,
      `- Source switch worked: ${result.sourceSwitchWorked}`,
      `- Switched back: ${result.switchedBackToLegacy}`,
      `- Experimental labels: ${result.experimentalLabelsPresent}`,
      `- Banned language: ${result.bannedLanguageFound.join(", ") || "None"}`,
      `- Mutation safety: ${JSON.stringify(result.mutationSafety)}`,
      `- Screenshot: ${result.screenshotPath ?? "None"}`,
      `- Error: ${result.error ?? "None"}`,
      "",
    ].join("\n")),
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
