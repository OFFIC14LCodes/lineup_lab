import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";

import { findBannedStrategyUiLanguage } from "@/lib/draft/pre-draft-strategy-ui";
import { E2E_AUTH_COOKIE } from "@/lib/supabase/auth";

type InventoryRoom = {
  source: string;
  draftRoomId: string;
  leagueName: string | null;
  hasIDP?: boolean;
  hasKicker?: boolean;
  hasTeamDefense?: boolean;
  isSuperflex?: boolean;
};

type ValidationArtifact = {
  roomInventory?: InventoryRoom[];
};

type SmokeResult = {
  roomId: string;
  leagueName: string | null;
  endpointStatus: number | null;
  sectionsRendered: string[];
  dataGapsRendered: boolean;
  safetyCaveatsVisible: boolean;
  bannedLanguageFound: string[];
  mutationSafety: {
    draftStateUnchanged: boolean;
    availablePlayerOrderUnchanged: boolean;
    strategyEndpointStable: boolean;
  };
  screenshots: string[];
  responsive: Array<{ viewport: string; passed: boolean; error: string | null }>;
  error: string | null;
};

type SmokeArtifact = {
  generatedAt: string;
  verdict: "passed" | "failed" | "blocked";
  endpointPath: string;
  roomsTested: Array<{ draftRoomId: string; leagueName: string | null; reason: string }>;
  results: SmokeResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    mutationSafetyPassed: boolean;
    bannedLanguagePassed: boolean;
  };
  remainingRisks: string[];
};

const PORT = 3022;
const SCREENSHOT_DIR = path.join(process.cwd(), "artifacts", "projections", "h11-pre-draft-strategy-ui-screenshots");
const REQUIRED_SECTIONS = [
  "Pre-Draft Strategy Preview",
  "League Summary",
  "Scoring Emphasis",
  "Roster Construction Plan",
  "Positional Priority Map",
  "Draft Slot Strategy",
  "Strategy Watchlists",
  "Contingency Plans",
  "Risk Notes",
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
  if (!rooms.length) throw new Error("No validation rooms found. Run npm run validate:h10-war-room-recommendations -- --all first.");

  const server = await startServer(authUserId);
  let browser: Browser | null = null;
  const results: SmokeResult[] = [];
  try {
    try {
      browser = await chromium.launch();
    } catch (error) {
      throw new Error(`Playwright Chromium launch failed. Run npx playwright install chromium. ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const room of rooms) {
      results.push(await exerciseRoom(browser, room));
    }
  } finally {
    stopServer(server);
    if (browser) await browser.close();
  }

  const failed = results.filter((result) => result.error || result.bannedLanguageFound.length || !allMutationSafetyPassed(result)).length;
  const artifact: SmokeArtifact = {
    generatedAt: new Date().toISOString(),
    verdict: failed ? "failed" : "passed",
    endpointPath: "/api/draft-rooms/[draftRoomId]/pre-draft-strategy",
    roomsTested: rooms.map((room) => ({ draftRoomId: room.draftRoomId, leagueName: room.leagueName, reason: room.reason })),
    results,
    summary: {
      total: results.length,
      passed: results.length - failed,
      failed,
      mutationSafetyPassed: results.every(allMutationSafetyPassed),
      bannedLanguagePassed: results.every((result) => result.bannedLanguageFound.length === 0),
    },
    remainingRisks: [
      "This harness uses the server-only local authenticated test path rather than a real OAuth session.",
      "The strategy panel is browser-smoked against representative rooms, not every possible league format.",
      "Opening strategy details is local browser state only and is not persisted.",
    ],
  };
  writeArtifacts(artifact);
  if (failed) process.exitCode = 1;
}

async function exerciseRoom(browser: Browser, room: ReturnType<typeof selectRooms>[number]): Promise<SmokeResult> {
  const screenshots: string[] = [];
  const responsive: SmokeResult["responsive"] = [];
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${PORT}` });
  await context.addCookies([{ name: E2E_AUTH_COOKIE, value: "enabled", domain: "127.0.0.1", path: "/", httpOnly: false, sameSite: "Lax" }]);
  const page = await context.newPage();
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const beforeState = await fetchJson(page, `/api/draft-rooms/${room.draftRoomId}/state`);
    const beforeStrategy = await fetchJson(page, `/api/draft-rooms/${room.draftRoomId}/pre-draft-strategy`);
    await page.goto(`/drafts/${room.draftRoomId}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByText("Pre-Draft Strategy Preview").waitFor({ timeout: 20_000 });

    const endpointStatus = beforeStrategy.status;
    const sectionsRendered: string[] = [];
    for (const section of REQUIRED_SECTIONS) {
      if (await page.getByText(section).first().isVisible().catch(() => false)) sectionsRendered.push(section);
    }

    const safetyCaveatsVisible =
      (await page.getByText("Read-only").first().isVisible().catch(() => false)) &&
      (await page.getByText("Experimental").first().isVisible().catch(() => false)) &&
      (await page.getByText("Historical outcome validation is not yet available.").first().isVisible().catch(() => false));
    const dataGapsRendered = await page.getByText("Strategy preview is partial because some draft context is missing.").isVisible().catch(() => false);
    const bodyText = await page.locator("body").innerText();
    const bannedLanguageFound = findBannedStrategyUiLanguage(bodyText);

    for (const viewport of [
      { name: "desktop", width: 1440, height: 1100 },
      { name: "mobile", width: 390, height: 900 },
    ]) {
      try {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.getByText("Pre-Draft Strategy Preview").waitFor({ timeout: 10_000 });
        const screenshotPath = path.join(SCREENSHOT_DIR, `${viewport.name}-${room.draftRoomId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshots.push(screenshotPath);
        responsive.push({ viewport: viewport.name, passed: true, error: null });
      } catch (error) {
        responsive.push({ viewport: viewport.name, passed: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const afterState = await fetchJson(page, `/api/draft-rooms/${room.draftRoomId}/state`);
    const afterStrategy = await fetchJson(page, `/api/draft-rooms/${room.draftRoomId}/pre-draft-strategy`);
    const beforeStateBody = recordOrNull(beforeState.body);
    const afterStateBody = recordOrNull(afterState.body);
    const beforeStrategyBody = recordOrNull(beforeStrategy.body);
    const afterStrategyBody = recordOrNull(afterStrategy.body);

    return {
      roomId: room.draftRoomId,
      leagueName: room.leagueName,
      endpointStatus,
      sectionsRendered,
      dataGapsRendered,
      safetyCaveatsVisible,
      bannedLanguageFound,
      mutationSafety: {
        draftStateUnchanged: stateSignature(beforeState.body) === stateSignature(afterState.body),
        availablePlayerOrderUnchanged: playerOrderSignature(beforeStateBody?.remainingPlayers) === playerOrderSignature(afterStateBody?.remainingPlayers),
        strategyEndpointStable: Boolean(beforeStrategyBody?.strategyPreviewLabel && afterStrategyBody?.strategyPreviewLabel),
      },
      screenshots,
      responsive,
      error: endpointStatus === 200 && REQUIRED_SECTIONS.every((section) => sectionsRendered.includes(section)) && safetyCaveatsVisible ? null : "Strategy panel smoke assertions failed.",
    };
  } catch (error) {
    return {
      roomId: room.draftRoomId,
      leagueName: room.leagueName,
      endpointStatus: null,
      sectionsRendered: [],
      dataGapsRendered: false,
      safetyCaveatsVisible: false,
      bannedLanguageFound: [],
      mutationSafety: {
        draftStateUnchanged: false,
        availablePlayerOrderUnchanged: false,
        strategyEndpointStable: false,
      },
      screenshots,
      responsive,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

async function fetchJson(page: Page, pathname: string): Promise<{ status: number; body: unknown }> {
  const absoluteUrl = `http://127.0.0.1:${PORT}${pathname}`;
  return page.evaluate(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }, absoluteUrl);
}

function selectRooms(artifact: ValidationArtifact) {
  const inventory = artifact.roomInventory ?? [];
  return [
    { room: inventory.find((row) => row.isSuperflex), reason: "superflex strategy coverage" },
    { room: inventory.find((row) => row.hasIDP), reason: "IDP strategy coverage" },
    { room: inventory.find((row) => row.hasKicker || row.hasTeamDefense), reason: "K/DST strategy coverage" },
  ]
    .filter((entry): entry is { room: InventoryRoom; reason: string } => Boolean(entry.room))
    .filter((entry, index, entries) => entries.findIndex((other) => other.room.draftRoomId === entry.room.draftRoomId) === index)
    .slice(0, 3)
    .map((entry) => ({ ...entry.room, reason: entry.reason }));
}

function loadValidationArtifact(): ValidationArtifact {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) throw new Error("Missing H10 validation artifact.");
  return JSON.parse(readFileSync(artifactPath, "utf8")) as ValidationArtifact;
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
  throw new Error("H11 strategy UI smoke server did not become ready.");
}

function stopServer(server: ChildProcess) {
  if (server.pid && process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  if (!server.killed) server.kill();
}

function writeArtifacts(artifact: SmokeArtifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h11-pre-draft-strategy-ui.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(dir, "h11-pre-draft-strategy-ui.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: SmokeArtifact) {
  return [
    "# H11.2 Pre-Draft Strategy UI",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    `Endpoint: ${artifact.endpointPath}`,
    "",
    "## Summary",
    "",
    `- Total: ${artifact.summary.total}`,
    `- Passed: ${artifact.summary.passed}`,
    `- Failed: ${artifact.summary.failed}`,
    `- Mutation safety passed: ${artifact.summary.mutationSafetyPassed}`,
    `- Banned language passed: ${artifact.summary.bannedLanguagePassed}`,
    "",
    "## Results",
    "",
    ...artifact.results.flatMap((result) => [
      `### ${result.leagueName ?? result.roomId}`,
      `- Endpoint status: ${result.endpointStatus}`,
      `- Sections rendered: ${result.sectionsRendered.join(", ")}`,
      `- Data gaps rendered: ${result.dataGapsRendered}`,
      `- Safety caveats visible: ${result.safetyCaveatsVisible}`,
      `- Banned language found: ${result.bannedLanguageFound.join(", ") || "none"}`,
      `- Mutation safety: ${JSON.stringify(result.mutationSafety)}`,
      `- Responsive: ${JSON.stringify(result.responsive)}`,
      `- Screenshots: ${result.screenshots.join(", ")}`,
      `- Error: ${result.error ?? "none"}`,
      "",
    ]),
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}

function buildBlockedArtifact(message: string): SmokeArtifact {
  return {
    generatedAt: new Date().toISOString(),
    verdict: "blocked",
    endpointPath: "/api/draft-rooms/[draftRoomId]/pre-draft-strategy",
    roomsTested: [],
    results: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      mutationSafetyPassed: false,
      bannedLanguagePassed: false,
    },
    remainingRisks: [message],
  };
}

function allMutationSafetyPassed(result: SmokeResult) {
  return Object.values(result.mutationSafety).every(Boolean);
}

function stateSignature(state: unknown) {
  const row = recordOrNull(state);
  return JSON.stringify({
    picks: row?.picks,
    room: row?.room,
    recommendations: row?.recommendations,
  });
}

function playerOrderSignature(players: unknown) {
  return arrayOrEmpty(players)
    .map((player) => {
      const row = recordOrNull(player);
      return row?.sleeper_player_id ?? row?.matched_player_id ?? row?.player_name ?? "";
    })
    .join("|");
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
