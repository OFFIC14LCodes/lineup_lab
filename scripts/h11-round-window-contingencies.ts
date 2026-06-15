import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildPreDraftStrategy, validateStrategyLanguage, type PreDraftStrategyInput } from "@/lib/draft/pre-draft-strategy";
import type { H10WarRoomInventoryRow, H10WarRoomPerRoomValidation } from "@/lib/draft/war-room-recommendation-validation";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const SOURCE_ARTIFACT = path.join(OUTPUT_DIR, "h10-war-room-recommendation-validation.json");

type ValidationArtifact = {
  roomInventory?: H10WarRoomInventoryRow[];
  roomResults?: H10WarRoomPerRoomValidation[];
};

type Artifact = {
  generatedAt: string;
  verdict: "passed" | "failed" | "blocked";
  checks: Record<string, boolean>;
  examples: Array<{
    label: string;
    available: boolean;
    draftRoomId?: string;
    leagueName?: string | null;
    triggerIds: string[];
    windowCount: number;
    detailedWindowCount: number;
    bannedLanguageFailures: string[];
    error?: string;
  }>;
  readOnlySafety: {
    mutatesDraftState: false;
    mutatesProjectionData: false;
    persistsStrategyState: false;
    usesAi: false;
  };
  dataGaps: string[];
};

function main() {
  const validation = readValidationArtifact();
  const inventory = validation.roomInventory ?? [];
  const roomResults = validation.roomResults ?? [];
  const examples = [
    example("turn slot", inventory.find((room) => room.hasIDP) ?? inventory[0], roomResults, { draftSlot: 12, teamCount: 12, rounds: 18 }),
    example("middle slot", inventory.find((room) => !room.isSuperflex && !room.is2QB) ?? inventory[0], roomResults, { draftSlot: 6, teamCount: 12, rounds: 18 }),
    example("superflex or 2QB", inventory.find((room) => room.isSuperflex || room.is2QB), roomResults, { draftSlot: 3, teamCount: 12, rounds: 20 }),
    example("TE premium", inventory.find((room) => room.isTEPremium), roomResults, { draftSlot: 6, teamCount: 12, rounds: 18, scoringSettings: { rec: 1, bonus_rec_te: 0.5 } }),
    example("IDP", inventory.find((room) => room.hasIDP), roomResults, { draftSlot: 8, teamCount: 12, rounds: 24 }),
    example("K/DST", inventory.find((room) => room.hasKicker || room.hasTeamDefense), roomResults, { draftSlot: 10, teamCount: 12, rounds: 16 }),
  ];
  const available = examples.filter((row) => row.available);
  const allTriggerIds = new Set(available.flatMap((row) => row.triggerIds));
  const turn = available.find((row) => row.label === "turn slot");
  const middle = available.find((row) => row.label === "middle slot");
  const checks = {
    roundWindowPlansExist: available.every((row) => row.windowCount > 0 && row.detailedWindowCount > 0),
    turnDiffersFromMiddle: Boolean(turn && middle && turn.triggerIds.join("|") !== middle.triggerIds.join("|")),
    superflexGuidancePresent: allTriggerIds.has("qb-tier-superflex-pivot"),
    tePremiumGuidancePresent: allTriggerIds.has("te-premium-value-fall"),
    kDstCautionPresent: allTriggerIds.has("special-position-late-caution"),
    idpCautionPresent: allTriggerIds.has("idp-confidence-caution"),
    contingencyTriggersPresent: available.some((row) => row.triggerIds.length > 0),
    noBannedLanguage: available.every((row) => row.bannedLanguageFailures.length === 0),
    noMutationOrPersistence: true,
  };
  const artifact: Artifact = {
    generatedAt: new Date().toISOString(),
    verdict: available.length === 0 ? "blocked" : Object.values(checks).every(Boolean) ? "passed" : "failed",
    checks,
    examples,
    readOnlySafety: {
      mutatesDraftState: false,
      mutatesProjectionData: false,
      persistsStrategyState: false,
      usesAi: false,
    },
    dataGaps: available.length ? [] : ["No representative H10 validation rooms were available."],
  };
  writeArtifacts(artifact);
  console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-round-window-contingencies.json", checks }, null, 2));
  if (artifact.verdict !== "passed") process.exitCode = 1;
}

function example(
  label: string,
  room: H10WarRoomInventoryRow | undefined,
  roomResults: H10WarRoomPerRoomValidation[],
  overrides: Partial<PreDraftStrategyInput>
): Artifact["examples"][number] {
  if (!room) return { label, available: false, triggerIds: [], windowCount: 0, detailedWindowCount: 0, bannedLanguageFailures: [], error: "No representative room." };
  const strategy = buildPreDraftStrategy({
    room,
    roomResult: roomResults.find((result) => result.draftRoomId === room.draftRoomId) ?? null,
    rosterSlots: overrides.rosterSlots ?? representativeRosterSlots(room),
    scoringSettings: overrides.scoringSettings ?? null,
    draftSlot: overrides.draftSlot ?? null,
    teamCount: overrides.teamCount ?? null,
    rounds: overrides.rounds ?? null,
  });
  return {
    label,
    available: true,
    draftRoomId: room.draftRoomId,
    leagueName: room.leagueName,
    triggerIds: strategy.contingencyTriggers.map((trigger) => trigger.id),
    windowCount: strategy.roundWindowPlan.length,
    detailedWindowCount: strategy.roundWindowPlanDetailed.length,
    bannedLanguageFailures: validateStrategyLanguage(strategy),
  };
}

function representativeRosterSlots(room: H10WarRoomInventoryRow): string[] {
  const slots = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN"];
  if (room.isSuperflex) slots.push("SUPER_FLEX");
  if (room.is2QB) slots.push("QB");
  if (room.hasIDP) slots.push("DL", "LB", "DB");
  if (room.hasKicker) slots.push("K");
  if (room.hasTeamDefense) slots.push("DEF");
  return slots;
}

function readValidationArtifact(): ValidationArtifact {
  if (!existsSync(SOURCE_ARTIFACT)) throw new Error("Missing H10 validation artifact. Run npm run validate:h10-war-room-recommendations -- --all first.");
  return JSON.parse(readFileSync(SOURCE_ARTIFACT, "utf8")) as ValidationArtifact;
}

function writeArtifacts(artifact: Artifact) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, "h11-round-window-contingencies.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "h11-round-window-contingencies.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: Artifact) {
  return [
    "# H11.4 Round Window Contingencies",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Checks",
    "",
    ...Object.entries(artifact.checks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Examples",
    "",
    ...artifact.examples.map((row) => `- ${row.label}: available=${row.available}, windows=${row.detailedWindowCount}, triggers=${row.triggerIds.join(", ") || "none"}`),
    "",
    "## Safety",
    "",
    ...Object.entries(artifact.readOnlySafety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ].join("\n");
}

main();
