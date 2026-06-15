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
  remaining_player_count?: number;
};

type CaseConfig = {
  name: "disabled" | "enabled_allowed" | "enabled_denied";
  port: number;
  internalFlag: boolean;
  allowlist: "auth_user" | "other_user" | "none";
};

type Snapshot = {
  legacyRecommendations: string;
  availablePlayerOrder: string;
  projections: string;
  draftRoomState: string;
  selectedSourceState: string;
  internalEnabled: boolean;
  internalAllowed: boolean;
  gating: string | null;
};

type Result = {
  caseName: CaseConfig["name"];
  roomId: string;
  leagueName: string | null;
  internalEnabled: boolean;
  internalAllowed: boolean;
  gating: string | null;
  internalLabelVisible: boolean;
  caveatVisible: boolean;
  legacyAccessible: boolean;
  noErrorOverlay: boolean;
  bannedLanguageFound: string[];
  mutationSafety: {
    legacyRecommendationsUnchanged: boolean;
    availablePlayerOrderUnchanged: boolean;
    projectionsUnchanged: boolean;
    draftRoomStateUnchanged: boolean;
    selectedSourceNotPersisted: boolean;
  };
  screenshots: string[];
  error: string | null;
};

type Artifact = {
  generatedAt: string;
  artifactVersion: "h10.18-internal-trusted-experiment-v1";
  verdict:
    | "H10.18 INTERNAL TRUSTED EXPERIMENTAL MODE READY"
    | "H10.18 BLOCKED BY USER/ADMIN GATING"
    | "H10.18 FAILED SAFETY GATES"
    | "H10.18 NEEDS UI FOLLOW-UP";
  flagsEvaluated: string[];
  userAdminGatingApproach: string;
  roomTested: Pick<InventoryRoom, "draftRoomId" | "leagueId" | "leagueName"> | null;
  results: Result[];
  safetyAssertions: {
    disabledMatchesH1017: boolean;
    enabledExposesInternalUiOnlyWhenAllowed: boolean;
    noPersistence: boolean;
    noMutation: boolean;
    noSourceSelectionPersistence: boolean;
    noLegacyReplacement: boolean;
    noBannedLanguage: boolean;
    historicalValidationCaveatVisible: boolean;
  };
  screenshots: string[];
  remainingRisks: string[];
};

const CASES: CaseConfig[] = [
  { name: "disabled", port: 3030, internalFlag: false, allowlist: "auth_user" },
  { name: "enabled_allowed", port: 3031, internalFlag: true, allowlist: "auth_user" },
  { name: "enabled_denied", port: 3032, internalFlag: true, allowlist: "other_user" },
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
  const room = selectRoom(loadValidationArtifact());
  if (!room) throw new Error("No H10 validation/live room available for internal trusted experiment diagnostic.");

  const browser = await chromium.launch();
  const results: Result[] = [];
  try {
    for (const config of CASES) {
      const server = await startServer(config, authUserId);
      try {
        results.push(await exerciseCase({ browser, config, authUserId, room, viewportName: "desktop", width: 1440, height: 1000 }));
        if (config.name === "enabled_allowed") {
          results.push(await exerciseCase({ browser, config, authUserId, room, viewportName: "tablet", width: 900, height: 900 }));
          results.push(await exerciseCase({ browser, config, authUserId, room, viewportName: "mobile", width: 390, height: 844 }));
        }
      } finally {
        stopServer(server);
      }
    }
  } finally {
    await browser.close();
  }

  const safetyAssertions = {
    disabledMatchesH1017: results.some((result) => result.caseName === "disabled" && !result.internalEnabled && !result.internalAllowed && !result.internalLabelVisible),
    enabledExposesInternalUiOnlyWhenAllowed:
      results.filter((result) => result.caseName === "enabled_allowed").every((result) => result.internalEnabled && result.internalAllowed && result.internalLabelVisible) &&
      results.filter((result) => result.caseName === "enabled_denied").every((result) => result.internalEnabled && !result.internalAllowed && !result.internalLabelVisible),
    noPersistence: results.every((result) => result.mutationSafety.selectedSourceNotPersisted),
    noMutation: results.every((result) =>
      result.mutationSafety.legacyRecommendationsUnchanged &&
      result.mutationSafety.availablePlayerOrderUnchanged &&
      result.mutationSafety.projectionsUnchanged &&
      result.mutationSafety.draftRoomStateUnchanged
    ),
    noSourceSelectionPersistence: results.every((result) => result.mutationSafety.selectedSourceNotPersisted),
    noLegacyReplacement: results.every((result) => result.mutationSafety.legacyRecommendationsUnchanged && result.legacyAccessible),
    noBannedLanguage: results.every((result) => result.bannedLanguageFound.length === 0),
    historicalValidationCaveatVisible: results.filter((result) => result.caseName === "enabled_allowed").every((result) => result.caveatVisible),
  };
  const failed = results.filter((result) => result.error || !result.noErrorOverlay).length;
  const screenshots = results.flatMap((result) => result.screenshots);
  const verdict =
    !safetyAssertions.enabledExposesInternalUiOnlyWhenAllowed
      ? "H10.18 BLOCKED BY USER/ADMIN GATING"
      : failed || !Object.values(safetyAssertions).every(Boolean)
        ? "H10.18 FAILED SAFETY GATES"
        : screenshots.length < 4
          ? "H10.18 NEEDS UI FOLLOW-UP"
          : "H10.18 INTERNAL TRUSTED EXPERIMENTAL MODE READY";

  const artifact: Artifact = {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h10.18-internal-trusted-experiment-v1",
    verdict,
    flagsEvaluated: [
      "ENABLE_H10_INTERNAL_TRUSTED_EXPERIMENT",
      "H10_INTERNAL_TRUSTED_USER_IDS",
      "BLACKBIRD_E2E_AUTH_USER_ID",
      "SCORING_VALIDATION_OPERATOR_USER_ID",
    ],
    userAdminGatingApproach:
      "No durable admin-role table was found. H10.18 uses the environment flag plus optional trusted-user allowlist; local e2e and scoring operator users are treated as test users.",
    roomTested: { draftRoomId: room.draftRoomId, leagueId: room.leagueId, leagueName: room.leagueName },
    results,
    safetyAssertions,
    screenshots,
    remainingRisks: [
      "True historical completed-draft outcome validation is not available yet.",
      "Production admin gating should eventually move from env allowlist to a durable user-role model.",
      "Browser auth uses the local server-only e2e bypass and does not exercise Google OAuth.",
    ],
  };
  writeArtifacts(artifact);
  console.info(JSON.stringify({ verdict: artifact.verdict, safetyAssertions: artifact.safetyAssertions, screenshots: artifact.screenshots.length }, null, 2));
  if (artifact.verdict !== "H10.18 INTERNAL TRUSTED EXPERIMENTAL MODE READY") process.exitCode = 1;
}

async function exerciseCase(input: {
  browser: Browser;
  config: CaseConfig;
  authUserId: string;
  room: InventoryRoom;
  viewportName: string;
  width: number;
  height: number;
}): Promise<Result> {
  const context = await input.browser.newContext({
    baseURL: `http://127.0.0.1:${input.config.port}`,
    viewport: { width: input.width, height: input.height },
  });
  await context.addCookies([{ name: E2E_AUTH_COOKIE, value: "enabled", domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" }]);
  const screenshots: string[] = [];
  try {
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const before = await fetchState(page, input.room.draftRoomId);
    await page.goto(`/drafts/${input.room.draftRoomId}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByRole("heading", { name: /draft board/i }).waitFor({ timeout: 20_000 });
    const text = await page.locator("body").innerText();
    const screenshotPath = screenshotFile(`${input.config.name}-${input.viewportName}-${input.room.draftRoomId}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots.push(screenshotPath);
    const after = await fetchState(page, input.room.draftRoomId);
    return {
      caseName: input.config.name,
      roomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      internalEnabled: before.internalEnabled,
      internalAllowed: before.internalAllowed,
      gating: before.gating,
      internalLabelVisible: /Blackbird Trusted Preview|Internal Blackbird Mode/i.test(text),
      caveatVisible: /Synthetic replay validated; historical outcome validation not yet available/i.test(text),
      legacyAccessible: /Legacy Draft Target Score|Recommendations need uploaded rankings|No actionable recommendations yet/i.test(text),
      noErrorOverlay: await page.locator("[data-nextjs-dialog]").count() === 0,
      bannedLanguageFound: findBannedLanguage(text),
      mutationSafety: compareState(before, after),
      screenshots,
      error: null,
    };
  } catch (error) {
    return {
      caseName: input.config.name,
      roomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      internalEnabled: false,
      internalAllowed: false,
      gating: null,
      internalLabelVisible: false,
      caveatVisible: false,
      legacyAccessible: false,
      noErrorOverlay: false,
      bannedLanguageFound: [],
      mutationSafety: {
        legacyRecommendationsUnchanged: false,
        availablePlayerOrderUnchanged: false,
        projectionsUnchanged: false,
        draftRoomStateUnchanged: false,
        selectedSourceNotPersisted: false,
      },
      screenshots,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

async function fetchState(page: Page, draftRoomId: string): Promise<Snapshot> {
  const payload = await page.evaluate(async (id) => {
    const response = await fetch(`/api/draft-rooms/${id}/state`, { cache: "no-store" });
    return { ok: response.ok, status: response.status, body: await response.json() as Record<string, unknown> };
  }, draftRoomId);
  if (!payload.ok) throw new Error(`State request failed: ${payload.status} ${JSON.stringify(payload.body)}`);
  return snapshot(payload.body);
}

function snapshot(state: Record<string, unknown>): Snapshot {
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
      persistedRecommendationSource: (state as { recommendationSource?: unknown }).recommendationSource ?? null,
      internalAllowed: state.h10InternalTrustedExperimentAllowed,
    }),
    internalEnabled: state.h10InternalTrustedExperimentEnabled === true,
    internalAllowed: state.h10InternalTrustedExperimentAllowed === true,
    gating: typeof state.h10InternalTrustedExperimentGating === "string" ? state.h10InternalTrustedExperimentGating : null,
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

function compareState(before: Snapshot, after: Snapshot): Result["mutationSafety"] {
  return {
    legacyRecommendationsUnchanged: before.legacyRecommendations === after.legacyRecommendations,
    availablePlayerOrderUnchanged: before.availablePlayerOrder === after.availablePlayerOrder,
    projectionsUnchanged: before.projections === after.projections,
    draftRoomStateUnchanged: before.draftRoomState === after.draftRoomState,
    selectedSourceNotPersisted: before.selectedSourceState === after.selectedSourceState,
  };
}

async function startServer(config: CaseConfig, authUserId: string): Promise<ChildProcess> {
  const env = {
    ...process.env,
    ENABLE_BLACKBIRD_E2E_AUTH_BYPASS: "true",
    BLACKBIRD_E2E_AUTH_USER_ID: authUserId,
    DISABLE_WAR_ROOM_AUTO_SYNC_FOR_E2E: "true",
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW: "true",
    ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT: "false",
    ENABLE_H10_INTERNAL_TRUSTED_EXPERIMENT: String(config.internalFlag),
    H10_INTERNAL_TRUSTED_USER_IDS: config.allowlist === "auth_user" ? authUserId : config.allowlist === "other_user" ? "00000000-0000-4000-8000-000000000000" : "",
  };
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(config.port)], {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
  });
  await waitForServer(config.port, child);
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

function selectRoom(artifact: { roomInventory?: InventoryRoom[] }) {
  return (artifact.roomInventory ?? []).find((room) => (room.source === "live" || room.source === "validation_seed") && (room.remaining_player_count ?? 0) > 0) ?? null;
}

function loadValidationArtifact() {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) throw new Error("Missing h10-war-room-recommendation-validation.json.");
  return JSON.parse(readFileSync(artifactPath, "utf8")) as { roomInventory?: InventoryRoom[] };
}

function findBannedLanguage(text: string) {
  return BANNED_LANGUAGE.filter((entry) => entry.pattern.test(text)).map((entry) => entry.label);
}

function buildBlockedArtifact(reason: string): Artifact {
  return {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h10.18-internal-trusted-experiment-v1",
    verdict: "H10.18 BLOCKED BY USER/ADMIN GATING",
    flagsEvaluated: ["ENABLE_H10_INTERNAL_TRUSTED_EXPERIMENT", "H10_INTERNAL_TRUSTED_USER_IDS"],
    userAdminGatingApproach: "Unable to evaluate; diagnostic blocked before browser run.",
    roomTested: null,
    results: [],
    safetyAssertions: {
      disabledMatchesH1017: false,
      enabledExposesInternalUiOnlyWhenAllowed: false,
      noPersistence: false,
      noMutation: false,
      noSourceSelectionPersistence: false,
      noLegacyReplacement: false,
      noBannedLanguage: false,
      historicalValidationCaveatVisible: false,
    },
    screenshots: [],
    remainingRisks: [reason],
  };
}

function writeArtifacts(artifact: Artifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h10-internal-trusted-experiment.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(dir, "h10-internal-trusted-experiment.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: Artifact) {
  return [
    "# H10.18 Internal Trusted Experimental Mode",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Gating",
    "",
    artifact.userAdminGatingApproach,
    "",
    "## Safety Assertions",
    "",
    ...Object.entries(artifact.safetyAssertions).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Results",
    "",
    ...artifact.results.map((result) => [
      `### ${result.caseName}`,
      `- Internal enabled: ${result.internalEnabled}`,
      `- Internal allowed: ${result.internalAllowed}`,
      `- Gating: ${result.gating ?? "unknown"}`,
      `- Internal label visible: ${result.internalLabelVisible}`,
      `- Historical caveat visible: ${result.caveatVisible}`,
      `- Legacy accessible: ${result.legacyAccessible}`,
      `- No error overlay: ${result.noErrorOverlay}`,
      `- Banned language: ${result.bannedLanguageFound.join(", ") || "None"}`,
      `- Mutation safety: ${JSON.stringify(result.mutationSafety)}`,
      `- Screenshots: ${result.screenshots.join(", ") || "None"}`,
      `- Error: ${result.error ?? "None"}`,
      "",
    ].join("\n")),
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}

function screenshotFile(fileName: string) {
  const dir = path.join(process.cwd(), "artifacts", "projections", "h10-internal-trusted-experiment-screenshots");
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
