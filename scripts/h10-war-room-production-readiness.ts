import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { DEFAULT_H10_RECOMMENDATION_SOURCE } from "@/lib/draft/war-room-recommendation-experiment-ui";
import { E2E_AUTH_COOKIE } from "@/lib/supabase/auth";

type InventoryRoom = {
  source: string;
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  has_uploaded_rankings?: boolean;
  legacyRecommendationCount?: number;
  remaining_player_count?: number;
  currentPickKnown?: boolean;
  picksUntilMyNextPickKnown?: boolean;
};

type SelectedRoom = InventoryRoom & { reason: "no_rankings_preview" | "uploaded_rankings_source_default" | "fallback" };

type ValidationArtifact = {
  roomInventory?: InventoryRoom[];
};

type FlagCase = {
  name: "preview_env_absent" | "preview_env_true" | "preview_env_false" | "experiment_env_true";
  port: number;
  preview: "absent" | boolean;
  experiment: boolean;
};

type ViewportCase = {
  name: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
};

type StateSnapshot = {
  legacyRecommendations: string;
  availablePlayerOrder: string;
  projections: string;
  draftRoomState: string;
  selectedSourceState: string;
  previewEnabled: boolean;
  experimentEnabled: boolean;
  rankingsUploaded: boolean;
  recommendationCount: number;
  previewCount: number;
};

type SafetyAssertions = {
  defaultSourceRemainsLegacy: boolean;
  sourceSwitchingDoesNotPersistState: boolean;
  blackbirdDoesNotMutateLegacyRows: boolean;
  blackbirdDoesNotMutateAvailablePlayerOrder: boolean;
  blackbirdDoesNotMutateProjectionPreview: boolean;
  blackbirdDoesNotMutateDraftState: boolean;
  noRecommendationPersistence: boolean;
  noProjectionMutation: boolean;
  noLegacyReplacement: boolean;
  noBannedRecommendationLanguage: boolean;
  productionE2EBypassGuardPresent: boolean;
};

type RoomResult = {
  flagCase: FlagCase["name"];
  roomId: string;
  leagueName: string | null;
  roomReason: SelectedRoom["reason"];
  loaded: boolean;
  expectedPreviewEnabled: boolean;
  actualPreviewEnabled: boolean;
  actualExperimentEnabled: boolean;
  expectedBlackbirdPrimaryAllowed: boolean;
  legacyPrimaryObserved: boolean;
  blackbirdPreviewObserved: boolean;
  selectorObserved: boolean;
  uploadedRankingsObserved: boolean;
  emptyStatesObserved: string[];
  labelsObserved: {
    experimental: boolean;
    readOnly: boolean;
    projectionMarketRosterTiming: boolean;
    caveat: boolean;
  };
  bannedLanguageFound: string[];
  safetyAssertions: SafetyAssertions;
  screenshotPaths: string[];
  error: string | null;
};

type Artifact = {
  generatedAt: string;
  artifactVersion: "h10.17-war-room-production-readiness-v1";
  verdict:
    | "H10.17 WAR ROOM PRODUCTION READINESS READY"
    | "H10.17 FAILED SAFETY GATES"
    | "H10.17 BLOCKED BY PRODUCTION ENV CONFIG"
    | "H10.17 NEEDS UI FOLLOW-UP";
  flagCases: FlagCase[];
  roomsTested: Array<Pick<SelectedRoom, "draftRoomId" | "leagueId" | "leagueName" | "reason">>;
  screenshots: string[];
  results: RoomResult[];
  aggregate: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    safetyAssertions: SafetyAssertions;
    productionE2EBypassGuardPresent: boolean;
  };
  remainingRisks: string[];
};

const FLAG_CASES: FlagCase[] = [
  { name: "preview_env_absent", port: 3020, preview: "absent", experiment: false },
  { name: "preview_env_true", port: 3021, preview: true, experiment: false },
  { name: "preview_env_false", port: 3022, preview: false, experiment: false },
  { name: "experiment_env_true", port: 3023, preview: true, experiment: true },
];

const VIEWPORTS: ViewportCase[] = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 900, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const BANNED_LANGUAGE: Array<{ label: string; pattern: RegExp }> = [
  { label: "must draft", pattern: /\bmust draft\b/i },
  { label: "guaranteed", pattern: /\bguaranteed\b/i },
  { label: "lock", pattern: /\block\b/i },
  { label: "can't miss", pattern: /\bcan't miss\b/i },
  { label: "can’t miss", pattern: /\bcan’t miss\b/i },
  { label: "best pick", pattern: /\bbest pick\b/i },
  { label: "AI advice", pattern: /\bai advice\b/i },
  { label: "you should draft", pattern: /\byou should draft\b/i },
  { label: "final recommendation", pattern: /\bfinal recommendation\b/i },
];

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
  if (!rooms.length) throw new Error("No War Room validation rooms found. Run npm run validate:h10-war-room-recommendations -- --all first.");

  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    throw new Error(`Playwright Chromium launch failed. Run npx playwright install chromium. ${error instanceof Error ? error.message : String(error)}`);
  }

  const results: RoomResult[] = [];
  const screenshots: string[] = [];
  const productionE2EBypassGuardPresent = hasProductionE2EBypassGuard();

  try {
    for (const flagCase of FLAG_CASES) {
      const server = await startServer(flagCase, authUserId);
      try {
        for (const room of rooms) {
          const result = await exerciseRoom({ browser, flagCase, room, viewport: VIEWPORTS[0], productionE2EBypassGuardPresent });
          results.push(result);
          screenshots.push(...result.screenshotPaths);
        }

        if (flagCase.name === "preview_env_absent") {
          const primaryRoom = rooms[0];
          for (const viewport of VIEWPORTS.slice(1)) {
            const pathForViewport = await captureViewportScreenshot({ browser, flagCase, room: primaryRoom, viewport });
            screenshots.push(pathForViewport);
          }
        }
      } finally {
        stopServer(server);
      }
    }
  } finally {
    await browser.close();
  }

  const aggregateSafety = aggregateSafetyAssertions(results.map((result) => result.safetyAssertions));
  const failedResults = results.filter((result) => result.error || !result.loaded || !allSafetyPassed(result));
  const blocked = productionE2EBypassGuardPresent ? 0 : 1;
  const verdict = blocked
    ? "H10.17 BLOCKED BY PRODUCTION ENV CONFIG"
    : failedResults.length
      ? "H10.17 FAILED SAFETY GATES"
      : screenshots.length < 4
        ? "H10.17 NEEDS UI FOLLOW-UP"
        : "H10.17 WAR ROOM PRODUCTION READINESS READY";

  const artifact: Artifact = {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h10.17-war-room-production-readiness-v1",
    verdict,
    flagCases: FLAG_CASES,
    roomsTested: rooms.map((room) => ({
      draftRoomId: room.draftRoomId,
      leagueId: room.leagueId,
      leagueName: room.leagueName,
      reason: room.reason,
    })),
    screenshots,
    results,
    aggregate: {
      total: results.length,
      passed: results.length - failedResults.length,
      failed: failedResults.length,
      blocked,
      safetyAssertions: aggregateSafety,
      productionE2EBypassGuardPresent,
    },
    remainingRisks: [
      "Browser authentication uses the server-only local e2e bypass, not real OAuth.",
      "The harness disables War Room auto-sync so source-switching checks can isolate UI reads from Sleeper sync writes.",
      "Real production behavior still depends on Vercel environment variables and Supabase OAuth dashboard configuration.",
    ],
  };

  writeArtifacts(artifact);
  console.info(JSON.stringify({ verdict: artifact.verdict, aggregate: artifact.aggregate, screenshots: artifact.screenshots }, null, 2));
  if (artifact.verdict !== "H10.17 WAR ROOM PRODUCTION READINESS READY") process.exitCode = 1;
}

async function exerciseRoom(input: {
  browser: Browser;
  flagCase: FlagCase;
  room: SelectedRoom;
  viewport: ViewportCase;
  productionE2EBypassGuardPresent: boolean;
}): Promise<RoomResult> {
  const screenshotPaths: string[] = [];
  let context: BrowserContext | null = null;
  try {
    context = await newAuthedContext(input.browser, input.flagCase, input.viewport);
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const before = await fetchState(page, input.room.draftRoomId);
    await page.goto(`/drafts/${input.room.draftRoomId}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByRole("heading", { name: /draft board/i }).waitFor({ timeout: 20_000 });

    let bodyText = await page.locator("body").innerText();
    const screenshotPath = screenshotFile(`${input.flagCase.name}-${input.room.reason}-${input.viewport.name}-${input.room.draftRoomId}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshotPaths.push(screenshotPath);

    let blackbirdPreviewObserved = /blackbird (value )?preview/i.test(bodyText);
    const selectorObserved = await page.getByText("Recommendation Source").isVisible().catch(() => false);
    const expectedPreviewEnabled = input.flagCase.preview !== false;
    const expectedBlackbirdPrimaryAllowed = !before.rankingsUploaded && before.recommendationCount === 0 && before.previewCount > 0 && expectedPreviewEnabled;
    const legacyPrimaryObserved =
      before.rankingsUploaded && !blackbirdPreviewObserved && !selectorObserved
        ? true
        : await isLegacyPrimary(page);

    if (input.flagCase.experiment && selectorObserved) {
      await page.getByRole("button", { name: /blackbird value preview/i }).click();
      await page.getByText(/preview diagnostics|blackbird preview/i).waitFor({ timeout: 10_000 }).catch(() => undefined);
      const blackbirdText = await page.locator("body").innerText();
      bodyText = `${bodyText}\n${blackbirdText}`;
      blackbirdPreviewObserved = blackbirdPreviewObserved || /blackbird (value )?preview/i.test(blackbirdText);
      await page.getByRole("button", { name: /^legacy$/i }).click();
    }
    const lowerText = bodyText.toLowerCase();
    const labelsObserved = {
      experimental: lowerText.includes("experimental"),
      readOnly: lowerText.includes("read-only"),
      projectionMarketRosterTiming:
        lowerText.includes("current projections") &&
        lowerText.includes("market value") &&
        lowerText.includes("roster need") &&
        lowerText.includes("pick timing"),
      caveat: lowerText.includes("not final draft advice") || lowerText.includes("confidence and risk caveats"),
    };

    const after = await fetchState(page, input.room.draftRoomId);
    const mutationSafety = compareState(before, after);
    const safetyAssertions: SafetyAssertions = {
      defaultSourceRemainsLegacy: DEFAULT_H10_RECOMMENDATION_SOURCE === "legacy",
      sourceSwitchingDoesNotPersistState: mutationSafety.selectedSourceNotPersisted,
      blackbirdDoesNotMutateLegacyRows: mutationSafety.legacyRecommendationsUnchanged,
      blackbirdDoesNotMutateAvailablePlayerOrder: mutationSafety.availablePlayerOrderUnchanged,
      blackbirdDoesNotMutateProjectionPreview: mutationSafety.projectionsUnchanged,
      blackbirdDoesNotMutateDraftState: mutationSafety.draftRoomStateUnchanged,
      noRecommendationPersistence: mutationSafety.selectedSourceNotPersisted,
      noProjectionMutation: mutationSafety.projectionsUnchanged,
      noLegacyReplacement: mutationSafety.legacyRecommendationsUnchanged,
      noBannedRecommendationLanguage: findBannedLanguage(bodyText).length === 0,
      productionE2EBypassGuardPresent: input.productionE2EBypassGuardPresent,
    };

    return {
      flagCase: input.flagCase.name,
      roomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      roomReason: input.room.reason,
      loaded: true,
      expectedPreviewEnabled,
      actualPreviewEnabled: before.previewEnabled,
      actualExperimentEnabled: before.experimentEnabled,
      expectedBlackbirdPrimaryAllowed,
      legacyPrimaryObserved,
      blackbirdPreviewObserved,
      selectorObserved,
      uploadedRankingsObserved: before.rankingsUploaded,
      emptyStatesObserved: findEmptyStates(bodyText),
      labelsObserved,
      bannedLanguageFound: findBannedLanguage(bodyText),
      safetyAssertions,
      screenshotPaths,
      error: null,
    };
  } catch (error) {
    return {
      flagCase: input.flagCase.name,
      roomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      roomReason: input.room.reason,
      loaded: false,
      expectedPreviewEnabled: input.flagCase.preview !== false,
      actualPreviewEnabled: false,
      actualExperimentEnabled: false,
      expectedBlackbirdPrimaryAllowed: false,
      legacyPrimaryObserved: false,
      blackbirdPreviewObserved: false,
      selectorObserved: false,
      uploadedRankingsObserved: Boolean(input.room.has_uploaded_rankings),
      emptyStatesObserved: [],
      labelsObserved: { experimental: false, readOnly: false, projectionMarketRosterTiming: false, caveat: false },
      bannedLanguageFound: [],
      safetyAssertions: buildFailedSafety(input.productionE2EBypassGuardPresent),
      screenshotPaths,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context?.close();
  }
}

async function captureViewportScreenshot(input: {
  browser: Browser;
  flagCase: FlagCase;
  room: SelectedRoom;
  viewport: ViewportCase;
}) {
  const context = await newAuthedContext(input.browser, input.flagCase, input.viewport);
  try {
    const page = await context.newPage();
    await page.goto(`/drafts/${input.room.draftRoomId}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByRole("heading", { name: /draft board/i }).waitFor({ timeout: 20_000 });
    const screenshotPath = screenshotFile(`${input.viewport.name}-war-room-${input.room.draftRoomId}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } finally {
    await context.close();
  }
}

async function newAuthedContext(browser: Browser, flagCase: FlagCase, viewport: ViewportCase) {
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${flagCase.port}`,
    viewport: { width: viewport.width, height: viewport.height },
  });
  await context.addCookies([{ name: E2E_AUTH_COOKIE, value: "enabled", domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" }]);
  return context;
}

async function fetchState(page: Page, draftRoomId: string): Promise<StateSnapshot> {
  const payload = await page.evaluate(async (id) => {
    const response = await fetch(`/api/draft-rooms/${id}/state`, { cache: "no-store" });
    return { ok: response.ok, status: response.status, body: await response.json() as Record<string, unknown> };
  }, draftRoomId);
  if (!payload.ok) throw new Error(`State request failed: ${payload.status} ${JSON.stringify(payload.body)}`);
  return stateSnapshot(payload.body);
}

function stateSnapshot(state: Record<string, unknown>): StateSnapshot {
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
    previewEnabled: state.h10RecommendationPreviewEnabled === true,
    experimentEnabled: state.h10RecommendationExperimentEnabled === true,
    rankingsUploaded: state.rankingsUploaded === true,
    recommendationCount: recommendations.length,
    previewCount: h10RecommendationPreview.length,
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

function compareState(before: StateSnapshot, after: StateSnapshot) {
  return {
    legacyRecommendationsUnchanged: before.legacyRecommendations === after.legacyRecommendations,
    availablePlayerOrderUnchanged: before.availablePlayerOrder === after.availablePlayerOrder,
    projectionsUnchanged: before.projections === after.projections,
    draftRoomStateUnchanged: before.draftRoomState === after.draftRoomState,
    selectedSourceNotPersisted: before.selectedSourceState === after.selectedSourceState,
  };
}

async function isLegacyPrimary(page: Page) {
  const recommendedTargets = page.getByRole("heading", { name: /recommended targets/i });
  if (!(await recommendedTargets.isVisible().catch(() => false))) return false;
  const selectedLegacy = await page.getByRole("button", { name: /^legacy$/i }).evaluate((button) => button.className.includes("border-brand")).catch(() => false);
  if (selectedLegacy) return true;
  return page.getByText(/recommendations need uploaded rankings|no actionable recommendations yet|draft target score/i).isVisible().catch(() => false);
}

function findEmptyStates(text: string) {
  const checks = [
    "Recommendations need uploaded rankings",
    "No H10 preview rows available",
    "No synced draft picks yet",
    "No available players match these filters",
    "Team columns need synced league roster metadata",
    "Your draft slot is not detected yet",
  ];
  return checks.filter((phrase) => text.includes(phrase));
}

function findBannedLanguage(text: string) {
  return BANNED_LANGUAGE.filter((entry) => entry.pattern.test(text)).map((entry) => entry.label);
}

function allSafetyPassed(result: RoomResult) {
  const expectedFlagState =
    result.actualPreviewEnabled === result.expectedPreviewEnabled &&
    result.actualExperimentEnabled === (result.flagCase === "experiment_env_true");
  const expectedUiState =
    result.expectedPreviewEnabled === false
      ? !result.blackbirdPreviewObserved
      : result.expectedBlackbirdPrimaryAllowed || result.legacyPrimaryObserved || result.blackbirdPreviewObserved;
  const sourceDefaultSafe = result.uploadedRankingsObserved ? result.legacyPrimaryObserved : true;
  const requiredLabelsSafe =
    !result.blackbirdPreviewObserved ||
    (result.labelsObserved.experimental && result.labelsObserved.readOnly && result.labelsObserved.projectionMarketRosterTiming && result.labelsObserved.caveat);
  return (
    result.loaded &&
    expectedFlagState &&
    expectedUiState &&
    sourceDefaultSafe &&
    requiredLabelsSafe &&
    Object.values(result.safetyAssertions).every(Boolean)
  );
}

function selectRooms(artifact: ValidationArtifact): SelectedRoom[] {
  const inventory = (artifact.roomInventory ?? []).filter((room) => room.source === "live" || room.source === "validation_seed");
  const selected: SelectedRoom[] = [];
  const noRankings = inventory.find((room) => room.has_uploaded_rankings === false && (room.remaining_player_count ?? 0) > 0);
  const uploadedRankings = inventory.find((room) => room.has_uploaded_rankings === true && (room.remaining_player_count ?? 0) > 0);
  if (noRankings) selected.push({ ...noRankings, reason: "no_rankings_preview" });
  if (uploadedRankings && uploadedRankings.draftRoomId !== noRankings?.draftRoomId) {
    selected.push({ ...uploadedRankings, reason: "uploaded_rankings_source_default" });
  }
  if (!selected.length && inventory[0]) selected.push({ ...inventory[0], reason: "fallback" });
  return selected.slice(0, 2);
}

async function startServer(flagCase: FlagCase, authUserId: string): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ENABLE_BLACKBIRD_E2E_AUTH_BYPASS: "true",
    BLACKBIRD_E2E_AUTH_USER_ID: authUserId,
    DISABLE_WAR_ROOM_AUTO_SYNC_FOR_E2E: "true",
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT: String(flagCase.experiment),
  };
  if (flagCase.preview === "absent") delete env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW;
  else env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW = String(flagCase.preview);

  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(flagCase.port)], {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
  });
  await waitForServer(flagCase.port, child);
  return child;
}

async function waitForServer(port: number, child: ChildProcess) {
  const url = `http://127.0.0.1:${port}/login`;
  const started = Date.now();
  while (Date.now() - started < 90_000) {
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

function hasProductionE2EBypassGuard() {
  const source = readFileSync(path.join(process.cwd(), "src", "lib", "supabase", "auth.ts"), "utf8");
  return source.includes("process.env.NODE_ENV === \"production\"") && source.includes("ENABLE_BLACKBIRD_E2E_AUTH_BYPASS");
}

function loadValidationArtifact(): ValidationArtifact {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) throw new Error("Missing artifacts/projections/h10-war-room-recommendation-validation.json.");
  return JSON.parse(readFileSync(artifactPath, "utf8")) as ValidationArtifact;
}

function buildFailedSafety(productionE2EBypassGuardPresent: boolean): SafetyAssertions {
  return {
    defaultSourceRemainsLegacy: DEFAULT_H10_RECOMMENDATION_SOURCE === "legacy",
    sourceSwitchingDoesNotPersistState: false,
    blackbirdDoesNotMutateLegacyRows: false,
    blackbirdDoesNotMutateAvailablePlayerOrder: false,
    blackbirdDoesNotMutateProjectionPreview: false,
    blackbirdDoesNotMutateDraftState: false,
    noRecommendationPersistence: false,
    noProjectionMutation: false,
    noLegacyReplacement: false,
    noBannedRecommendationLanguage: false,
    productionE2EBypassGuardPresent,
  };
}

function aggregateSafetyAssertions(assertions: SafetyAssertions[]): SafetyAssertions {
  const fallback = buildFailedSafety(hasProductionE2EBypassGuard());
  const keys = Object.keys(assertions[0] ?? fallback) as Array<keyof SafetyAssertions>;
  return Object.fromEntries(keys.map((key) => [key, assertions.every((row) => row[key])])) as SafetyAssertions;
}

function buildBlockedArtifact(reason: string): Artifact {
  const productionE2EBypassGuardPresent = existsSync(path.join(process.cwd(), "src", "lib", "supabase", "auth.ts"))
    ? hasProductionE2EBypassGuard()
    : false;
  return {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h10.17-war-room-production-readiness-v1",
    verdict: "H10.17 BLOCKED BY PRODUCTION ENV CONFIG",
    flagCases: FLAG_CASES,
    roomsTested: [],
    screenshots: [],
    results: [],
    aggregate: {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 1,
      safetyAssertions: buildFailedSafety(productionE2EBypassGuardPresent),
      productionE2EBypassGuardPresent,
    },
    remainingRisks: [reason],
  };
}

function writeArtifacts(artifact: Artifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h10-war-room-production-readiness.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(dir, "h10-war-room-production-readiness.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: Artifact) {
  return [
    "# H10.17 War Room Production Readiness",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Aggregate",
    "",
    `- Total checks: ${artifact.aggregate.total}`,
    `- Passed: ${artifact.aggregate.passed}`,
    `- Failed: ${artifact.aggregate.failed}`,
    `- Blocked: ${artifact.aggregate.blocked}`,
    `- Production e2e bypass guard present: ${artifact.aggregate.productionE2EBypassGuardPresent}`,
    `- Safety assertions: ${JSON.stringify(artifact.aggregate.safetyAssertions)}`,
    "",
    "## Rooms",
    "",
    ...artifact.results.map((result) => [
      `### ${result.flagCase} / ${result.leagueName ?? result.roomId}`,
      "",
      `- Loaded: ${result.loaded}`,
      `- Preview flag: expected ${result.expectedPreviewEnabled}, actual ${result.actualPreviewEnabled}`,
      `- Experiment flag actual: ${result.actualExperimentEnabled}`,
      `- Uploaded rankings observed: ${result.uploadedRankingsObserved}`,
      `- Legacy primary observed: ${result.legacyPrimaryObserved}`,
      `- Blackbird preview observed: ${result.blackbirdPreviewObserved}`,
      `- Selector observed: ${result.selectorObserved}`,
      `- Labels observed: ${JSON.stringify(result.labelsObserved)}`,
      `- Empty states observed: ${result.emptyStatesObserved.join(", ") || "None"}`,
      `- Banned language: ${result.bannedLanguageFound.join(", ") || "None"}`,
      `- Safety assertions: ${JSON.stringify(result.safetyAssertions)}`,
      `- Screenshots: ${result.screenshotPaths.join(", ") || "None"}`,
      `- Error: ${result.error ?? "None"}`,
      "",
    ].join("\n")),
    "## Screenshots",
    "",
    ...artifact.screenshots.map((screenshot) => `- ${screenshot}`),
    "",
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}

function screenshotFile(fileName: string) {
  const dir = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-production-screenshots");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName.replace(/[^a-zA-Z0-9._-]/g, "-"));
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
