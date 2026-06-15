import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  auditPreDraftStrategyData,
  buildPreDraftStrategy,
  validateStrategyLanguage,
  type PreDraftStrategyDataAudit,
  type PreDraftStrategyInput,
  type PreDraftStrategyOutput,
} from "@/lib/draft/pre-draft-strategy";
import type {
  H10WarRoomInventoryRow,
  H10WarRoomPerRoomValidation,
} from "@/lib/draft/war-room-recommendation-validation";

type ValidationArtifact = {
  generatedAt: string;
  artifactVersion: string;
  roomInventory?: H10WarRoomInventoryRow[];
  roomResults?: H10WarRoomPerRoomValidation[];
};

type ExampleStrategy = {
  label: string;
  available: boolean;
  reason?: string;
  draftRoomId?: string;
  leagueName?: string | null;
  strategy?: PreDraftStrategyOutput;
};

type H11Artifact = {
  generatedAt: string;
  artifactVersion: "h11.0-pre-draft-strategy-design-v1";
  sourceArtifact: string;
  dataAvailabilityAudit: {
    aggregate: Record<string, unknown>;
    representative: PreDraftStrategyDataAudit | null;
  };
  strategyModelDesign: Array<{ section: keyof PreDraftStrategyOutput | "model"; purpose: string; deterministicInputs: string[] }>;
  examples: ExampleStrategy[];
  safety: {
    bannedLanguageFailures: string[];
    readOnly: boolean;
    mutatesDraftState: false;
    mutatesProjections: false;
    usesLlm: false;
  };
  missingDataRisks: string[];
  nextImplementationRecommendation: string;
  verdict: "H11.0 PRE-DRAFT STRATEGY DESIGN READY" | "H11.0 FAILED SAFETY GATES";
};

const SOURCE_ARTIFACT = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");

function main() {
  const validation = readValidationArtifact();
  const inventory = validation.roomInventory ?? [];
  const roomResults = validation.roomResults ?? [];
  const examples = buildExamples(inventory, roomResults);
  const bannedLanguageFailures = examples.flatMap((example) =>
    example.strategy ? validateStrategyLanguage(example.strategy).map((failure) => `${example.label}: ${failure}`) : []
  );
  const artifact: H11Artifact = {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h11.0-pre-draft-strategy-design-v1",
    sourceArtifact: path.relative(process.cwd(), SOURCE_ARTIFACT),
    dataAvailabilityAudit: {
      aggregate: buildAggregateAudit(inventory, roomResults),
      representative: examples.find((example) => example.strategy)?.strategy?.dataAvailabilityAudit ?? null,
    },
    strategyModelDesign: buildStrategyModelDesign(),
    examples,
    safety: {
      bannedLanguageFailures,
      readOnly: true,
      mutatesDraftState: false,
      mutatesProjections: false,
      usesLlm: false,
    },
    missingDataRisks: [
      "Exact pre-draft snake timing needs draft slot, team count, and round count on the H11 input.",
      "The H10 validation artifact has compact format flags but does not always include raw league scoring keys.",
      "Some representative rooms expose only the remaining pool visible to H10 validation, not a full pre-draft player universe.",
      "True historical completed-draft outcome validation is still unavailable.",
    ],
    nextImplementationRecommendation:
      "Implement an authenticated read-only pre-draft strategy endpoint that loads live league settings, draft order, roster slots, H10 projections, market data, and timing rows, then returns this H11 read model without persisting strategy choices.",
    verdict: bannedLanguageFailures.length === 0 ? "H11.0 PRE-DRAFT STRATEGY DESIGN READY" : "H11.0 FAILED SAFETY GATES",
  };

  writeArtifacts(artifact);
  console.info(JSON.stringify({
    verdict: artifact.verdict,
    examples: artifact.examples.map((example) => ({ label: example.label, available: example.available, draftRoomId: example.draftRoomId })),
    bannedLanguageFailures: artifact.safety.bannedLanguageFailures,
    artifacts: [
      "artifacts/projections/h11-pre-draft-strategy-design.json",
      "artifacts/projections/h11-pre-draft-strategy-design.md",
    ],
  }, null, 2));
  if (artifact.verdict !== "H11.0 PRE-DRAFT STRATEGY DESIGN READY") process.exitCode = 1;
}

function readValidationArtifact(): ValidationArtifact {
  if (!existsSync(SOURCE_ARTIFACT)) {
    throw new Error("Missing artifacts/projections/h10-war-room-recommendation-validation.json. Run npm run validate:h10-war-room-recommendations -- --all first.");
  }
  return JSON.parse(readFileSync(SOURCE_ARTIFACT, "utf8")) as ValidationArtifact;
}

function buildExamples(inventory: H10WarRoomInventoryRow[], roomResults: H10WarRoomPerRoomValidation[]): ExampleStrategy[] {
  return [
    buildExample("superflex/2QB room", inventory.find((room) => room.isSuperflex || room.is2QB), roomResults, {
      rosterSlots: ["QB", "SUPER_FLEX", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN", "BN"],
      draftSlot: 3,
      teamCount: 12,
      rounds: 20,
    }),
    buildExample("TE premium room", inventory.find((room) => room.isTEPremium), roomResults, {
      rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN"],
      scoringSettings: { rec: 1, bonus_rec_te: 0.5 },
      draftSlot: 6,
      teamCount: 12,
      rounds: 18,
    }),
    buildExample("IDP mixed room", inventory.find((room) => room.hasIDP), roomResults, {
      rosterSlots: ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "IDP", "BN", "BN", "BN", "BN", "BN", "BN"],
      draftSlot: 8,
      teamCount: 12,
      rounds: 24,
    }),
    buildExample("K/DST room", inventory.find((room) => room.hasKicker || room.hasTeamDefense), roomResults, {
      rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "K", "DEF", "BN", "BN"],
      draftSlot: 10,
      teamCount: 12,
      rounds: 16,
    }),
    buildExample("shallow roster room", inventory.find((room) => room.benchDepth <= 4), roomResults, {
      rosterSlots: ["QB", "RB", "WR", "TE", "FLEX", "BN", "BN"],
      draftSlot: 12,
      teamCount: 12,
      rounds: 12,
    }),
  ];
}

function buildExample(
  label: string,
  room: H10WarRoomInventoryRow | undefined,
  roomResults: H10WarRoomPerRoomValidation[],
  overrides: Partial<PreDraftStrategyInput>
): ExampleStrategy {
  if (!room) {
    return { label, available: false, reason: "No representative room exists in the H10 validation artifact." };
  }
  const input: PreDraftStrategyInput = {
    room,
    roomResult: roomResults.find((result) => result.draftRoomId === room.draftRoomId) ?? null,
    rosterSlots: overrides.rosterSlots ?? null,
    scoringSettings: overrides.scoringSettings ?? null,
    draftSlot: overrides.draftSlot ?? null,
    teamCount: overrides.teamCount ?? null,
    rounds: overrides.rounds ?? null,
  };
  return {
    label,
    available: true,
    draftRoomId: room.draftRoomId,
    leagueName: room.leagueName,
    strategy: buildPreDraftStrategy(input),
  };
}

function buildAggregateAudit(inventory: H10WarRoomInventoryRow[], roomResults: H10WarRoomPerRoomValidation[]) {
  const aggregateInput = inventory[0]
    ? {
        room: inventory[0],
        roomResult: roomResults.find((result) => result.draftRoomId === inventory[0].draftRoomId) ?? null,
      }
    : null;
  return {
    roomsAudited: inventory.length,
    roomResultsAudited: roomResults.length,
    superflexOr2QbRooms: inventory.filter((room) => room.isSuperflex || room.is2QB).length,
    tePremiumRooms: inventory.filter((room) => room.isTEPremium).length,
    idpRooms: inventory.filter((room) => room.hasIDP).length,
    kickerRooms: inventory.filter((room) => room.hasKicker).length,
    dstRooms: inventory.filter((room) => room.hasTeamDefense).length,
    shallowRosterRooms: inventory.filter((room) => room.benchDepth <= 4).length,
    roomsWithUploadedRankings: inventory.filter((room) => room.has_uploaded_rankings).length,
    h10RecommendationRowsAvailable: roomResults.reduce((sum, room) => sum + room.topRecommendations.length, 0),
    h10WaitPlanRowsAvailable: roomResults.reduce((sum, room) => sum + room.topRecommendations.filter((row) => row.waitPlanTargetCount > 0 || row.waitPlanBacked).length, 0),
    representativeAudit: aggregateInput ? auditPreDraftStrategyData(aggregateInput) : null,
  };
}

function buildStrategyModelDesign(): H11Artifact["strategyModelDesign"] {
  return [
    { section: "model", purpose: "Pure deterministic read model for pre-draft planning.", deterministicInputs: ["league settings", "roster slots", "draft slot", "team count", "H10 rows"] },
    { section: "leagueSummary", purpose: "Summarize league format, roster structure, and available timing context.", deterministicInputs: ["room flags", "roster slots", "draft metadata"] },
    { section: "scoringEmphasis", purpose: "Convert format signals into positional emphasis.", deterministicInputs: ["scoring settings", "format flags", "roster requirements"] },
    { section: "positionalPriorityMap", purpose: "Rank positional planning priority without selecting a player.", deterministicInputs: ["starter counts", "tier risk", "market signals", "special-position rules"] },
    { section: "draftSlotStrategy", purpose: "Describe early, middle, or turn timing behavior.", deterministicInputs: ["draft slot", "team count", "snake timing"] },
    { section: "roundWindowPlan", purpose: "Define broad windows for anchors, value pockets, depth, IDP, and K/DST.", deterministicInputs: ["format flags", "roster requirements"] },
    { section: "tierCliffWatchlist", purpose: "List visible tier risk from compact H10 rows.", deterministicInputs: ["tierDropRisk", "tierCliff component", "H10 tier"] },
    { section: "valuePocketWatchlist", purpose: "List market value pockets from H10 market signals.", deterministicInputs: ["marketValueSignal", "marketValue component"] },
    { section: "waitPositions", purpose: "Surface H10 wait-plan-backed positions.", deterministicInputs: ["needTimingAction", "waitPlanBacked", "waitPlanTargetCount"] },
    { section: "doNotForcePositions", purpose: "Prevent early forcing of low-priority or high-opportunity-cost slots.", deterministicInputs: ["K/DST flags", "needTimingAction", "opportunityCost"] },
    { section: "contingencyPlans", purpose: "Generate if/then fallback plans for tier risk and wait uncertainty.", deterministicInputs: ["tier risk", "format flags", "wait target coverage"] },
    { section: "specialPositionGuidance", purpose: "Handle IDP, kicker, and team defense with explicit caveats.", deterministicInputs: ["IDP/K/DST flags", "roster requirements"] },
    { section: "riskNotes", purpose: "Document missing inputs and validation limits.", deterministicInputs: ["data audit", "source artifact coverage"] },
  ];
}

function writeArtifacts(artifact: H11Artifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h11-pre-draft-strategy-design.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(dir, "h11-pre-draft-strategy-design.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: H11Artifact) {
  return [
    "# H11.0 Pre-Draft Strategy Design",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Data Availability",
    "",
    ...Object.entries(artifact.dataAvailabilityAudit.aggregate).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`),
    "",
    "## Strategy Model",
    "",
    ...artifact.strategyModelDesign.map((section) => `- ${section.section}: ${section.purpose} Inputs: ${section.deterministicInputs.join(", ")}.`),
    "",
    "## Examples",
    "",
    ...artifact.examples.flatMap((example) => [
      `### ${example.label}`,
      example.available
        ? `- Room: ${example.leagueName ?? example.draftRoomId}`
        : `- Unavailable: ${example.reason}`,
      example.strategy ? `- Formats: ${example.strategy.leagueSummary.formats.join(", ")}` : "",
      example.strategy ? `- Draft slot archetype: ${example.strategy.draftSlotStrategy.archetype}` : "",
      example.strategy ? `- Priority map: ${JSON.stringify(example.strategy.positionalPriorityMap)}` : "",
      example.strategy ? `- Tier cliffs: ${JSON.stringify(example.strategy.tierCliffWatchlist.slice(0, 3))}` : "",
      example.strategy ? `- Value pockets: ${JSON.stringify(example.strategy.valuePocketWatchlist.slice(0, 3))}` : "",
      "",
    ]),
    "## Safety",
    "",
    `- Read-only: ${artifact.safety.readOnly}`,
    `- Mutates draft state: ${artifact.safety.mutatesDraftState}`,
    `- Mutates projections: ${artifact.safety.mutatesProjections}`,
    `- Uses LLM: ${artifact.safety.usesLlm}`,
    `- Banned language failures: ${artifact.safety.bannedLanguageFailures.length}`,
    "",
    "## Missing Data / Risks",
    "",
    ...artifact.missingDataRisks.map((risk) => `- ${risk}`),
    "",
    "## Next Implementation Recommendation",
    "",
    artifact.nextImplementationRecommendation,
    "",
  ].filter((line) => line !== "").join("\n");
}

main();
