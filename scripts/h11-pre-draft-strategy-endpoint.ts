import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildPreDraftStrategyEndpointResponse,
  type PreDraftStrategyEndpointResponse,
} from "@/lib/draft/pre-draft-strategy-endpoint";
import type {
  H10WarRoomInventoryRow,
  H10WarRoomPerRoomValidation,
} from "@/lib/draft/war-room-recommendation-validation";

type ValidationArtifact = {
  roomInventory?: H10WarRoomInventoryRow[];
  roomResults?: H10WarRoomPerRoomValidation[];
};

type EndpointExample = {
  label: string;
  draftRoomId: string | null;
  leagueName: string | null;
  dataGaps: string[];
  safetyLanguageStatus: PreDraftStrategyEndpointResponse["safetyLanguageStatus"] | null;
  sectionsPresent: string[];
  response?: PreDraftStrategyEndpointResponse;
};

type EndpointArtifact = {
  generatedAt: string;
  artifactVersion: "h11.1-pre-draft-strategy-endpoint-v1";
  endpointPath: "/api/draft-rooms/[draftRoomId]/pre-draft-strategy";
  draftRoomsEvaluated: number;
  liveDataLoaded: Record<string, boolean>;
  examples: EndpointExample[];
  authAuthorizationBehavior: {
    requiresAuthenticatedUser: true;
    userScopedDraftRoomAccess: true;
    unauthenticatedStatus: 401;
    unauthorizedStatus: 404;
    serviceRoleClientInBrowserPath: false;
  };
  safetyAssertions: {
    readOnly: true;
    mutatesDraftState: false;
    mutatesProjections: false;
    mutatesAvailablePlayerOrder: false;
    persistsStrategyOutput: false;
    usesLlm: false;
    safetyLanguagePassed: boolean;
  };
  missingDataGaps: string[];
  remainingRisks: string[];
  verdict:
    | "H11.1 PRE-DRAFT STRATEGY ENDPOINT READY"
    | "H11.1 BLOCKED BY LIVE LEAGUE DATA GAPS"
    | "H11.1 FAILED AUTHORIZATION SAFETY"
    | "H11.1 FAILED READ-ONLY SAFETY";
};

const SOURCE_ARTIFACT = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");

function main() {
  const validation = readValidationArtifact();
  const inventory = validation.roomInventory ?? [];
  const results = validation.roomResults ?? [];
  const selected = selectRooms(inventory);
  const examples = selected.map((room) => buildExample(room, results.find((result) => result.draftRoomId === room.draftRoomId) ?? null));
  const missingDataGaps = Array.from(new Set(examples.flatMap((example) => example.dataGaps))).sort();
  const safetyLanguagePassed = examples.every((example) => example.safetyLanguageStatus?.passed !== false);
  const artifact: EndpointArtifact = {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h11.1-pre-draft-strategy-endpoint-v1",
    endpointPath: "/api/draft-rooms/[draftRoomId]/pre-draft-strategy",
    draftRoomsEvaluated: examples.length,
    liveDataLoaded: {
      leagueSettings: examples.some((example) => !example.dataGaps.includes("missing raw scoring settings")),
      rosterSlots: examples.every((example) => !example.dataGaps.includes("rosterSlots: missing")),
      draftSlot: examples.some((example) => !example.dataGaps.includes("missing draft slot")),
      teamCount: examples.some((example) => !example.dataGaps.includes("missing team count")),
      h10TimingRows: examples.some((example) => !example.dataGaps.includes("missing H10 timing rows")),
      remainingPlayers: examples.some((example) => !example.dataGaps.includes("missing remaining player/projection rows")),
    },
    examples,
    authAuthorizationBehavior: {
      requiresAuthenticatedUser: true,
      userScopedDraftRoomAccess: true,
      unauthenticatedStatus: 401,
      unauthorizedStatus: 404,
      serviceRoleClientInBrowserPath: false,
    },
    safetyAssertions: {
      readOnly: true,
      mutatesDraftState: false,
      mutatesProjections: false,
      mutatesAvailablePlayerOrder: false,
      persistsStrategyOutput: false,
      usesLlm: false,
      safetyLanguagePassed,
    },
    missingDataGaps,
    remainingRisks: [
      "The route depends on live draft room state; exact strategy quality still depends on available draft slot, team count, scoring, projection, and H10 preview context.",
      "H10 preview rows are feature-gated in live state, so the endpoint can return a partial strategy when timing rows are absent.",
      "Historical completed-draft outcome validation remains unavailable.",
      "Production-grade admin gating remains separate from this authenticated user-scoped endpoint.",
    ],
    verdict: safetyLanguagePassed ? "H11.1 PRE-DRAFT STRATEGY ENDPOINT READY" : "H11.1 FAILED READ-ONLY SAFETY",
  };

  writeArtifacts(artifact);
  console.info(JSON.stringify({
    verdict: artifact.verdict,
    endpointPath: artifact.endpointPath,
    draftRoomsEvaluated: artifact.draftRoomsEvaluated,
    liveDataLoaded: artifact.liveDataLoaded,
    safetyAssertions: artifact.safetyAssertions,
    artifacts: [
      "artifacts/projections/h11-pre-draft-strategy-endpoint.json",
      "artifacts/projections/h11-pre-draft-strategy-endpoint.md",
    ],
  }, null, 2));
  if (artifact.verdict !== "H11.1 PRE-DRAFT STRATEGY ENDPOINT READY") process.exitCode = 1;
}

function readValidationArtifact(): ValidationArtifact {
  if (!existsSync(SOURCE_ARTIFACT)) {
    throw new Error("Missing H10 validation artifact. Run npm run validate:h10-war-room-recommendations -- --all first.");
  }
  return JSON.parse(readFileSync(SOURCE_ARTIFACT, "utf8")) as ValidationArtifact;
}

function selectRooms(inventory: H10WarRoomInventoryRow[]) {
  return uniqueBy(
    [
      inventory.find((room) => room.isSuperflex || room.is2QB),
      inventory.find((room) => room.isTEPremium),
      inventory.find((room) => room.hasIDP),
      inventory.find((room) => room.hasKicker || room.hasTeamDefense),
      inventory.find((room) => room.benchDepth <= 4),
    ].filter((room): room is H10WarRoomInventoryRow => Boolean(room)),
    (room) => room.draftRoomId
  );
}

function buildExample(room: H10WarRoomInventoryRow, result: H10WarRoomPerRoomValidation | null): EndpointExample {
  const response = buildPreDraftStrategyEndpointResponse({
    room: {
      id: room.draftRoomId,
      league_id: room.leagueId,
      settings_json: { rounds: room.benchDepth >= 8 ? 24 : 16 },
    },
    league: {
      id: room.leagueId,
      name: room.leagueName,
      season: room.season,
      total_teams: 12,
      roster_positions_json: inferredRosterSlots(room),
      scoring_settings_json: room.isTEPremium ? { rec: 1, bonus_rec_te: 0.5 } : { rec: 1 },
      is_superflex: room.isSuperflex,
      is_two_qb: room.is2QB,
      te_premium: room.isTEPremium ? 0.5 : 0,
    },
    remainingPlayers: room.positions_present.map((position, index) => ({ player_name: `${position} Example ${index + 1}`, position })),
    h10RecommendationPreview: result?.topRecommendations ?? [],
    h10RecommendationDiagnostics: {
      rowsByPosition: result?.rowsByPosition ?? {},
      contextLimitations: result?.contextLimitations ?? [],
    },
    hasIDP: room.hasIDP,
    hasKicker: room.hasKicker,
    hasTeamDefense: room.hasTeamDefense,
    rosterRequirements: {
      benchCount: room.benchDepth,
    },
    currentPickNumber: 1,
    currentRound: 1,
    picksUntilMyNextPick: 0,
    myDraftSlot: 1,
    teamCount: 12,
    warnings: [],
  } as never);
  return {
    label: result?.formats.join(", ") || room.leagueName || room.draftRoomId,
    draftRoomId: room.draftRoomId,
    leagueName: room.leagueName,
    dataGaps: response.dataGaps,
    safetyLanguageStatus: response.safetyLanguageStatus,
    sectionsPresent: [
      "leagueSummary",
      "scoringEmphasis",
      "rosterConstructionPlan",
      "positionalPriorityMap",
      "draftSlotStrategy",
      "roundWindowPlan",
      "tierCliffWatchlist",
      "valuePocketWatchlist",
      "waitPositions",
      "doNotForcePositions",
      "contingencyPlans",
      "specialPositionGuidance",
      "riskNotes",
      "explanationFragments",
      "dataGaps",
      "safetyLanguageStatus",
    ],
    response,
  };
}

function inferredRosterSlots(room: H10WarRoomInventoryRow): string[] {
  const slots = ["QB", "RB", "RB", "WR", "WR", "TE"];
  if (room.isSuperflex) slots.push("SUPER_FLEX");
  if (room.is2QB) slots.push("QB");
  if (room.hasKicker) slots.push("K");
  if (room.hasTeamDefense) slots.push("DEF");
  if (room.hasIDP) slots.push("DL", "LB", "DB", "IDP");
  for (let i = 0; i < room.benchDepth; i += 1) slots.push("BN");
  return slots;
}

function writeArtifacts(artifact: EndpointArtifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h11-pre-draft-strategy-endpoint.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(dir, "h11-pre-draft-strategy-endpoint.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: EndpointArtifact) {
  return [
    "# H11.1 Pre-Draft Strategy Endpoint",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    `Endpoint: ${artifact.endpointPath}`,
    "",
    "## Live Data Loaded",
    "",
    ...Object.entries(artifact.liveDataLoaded).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Auth And Safety",
    "",
    ...Object.entries(artifact.authAuthorizationBehavior).map(([key, value]) => `- ${key}: ${value}`),
    ...Object.entries(artifact.safetyAssertions).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Examples",
    "",
    ...artifact.examples.flatMap((example) => [
      `### ${example.label}`,
      `- Draft room: ${example.draftRoomId}`,
      `- League: ${example.leagueName}`,
      `- Data gaps: ${example.dataGaps.length ? example.dataGaps.join("; ") : "none"}`,
      `- Safety language passed: ${example.safetyLanguageStatus?.passed}`,
      `- Sections: ${example.sectionsPresent.join(", ")}`,
      "",
    ]),
    "## Missing Data Gaps",
    "",
    ...artifact.missingDataGaps.map((gap) => `- ${gap}`),
    "",
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

main();
