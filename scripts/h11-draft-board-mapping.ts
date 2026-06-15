import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeDraftBoardPosition } from "@/lib/draft/draft-board-display";
import { getDraftRoomState } from "@/lib/rosterforge/state";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

type MappingArtifact = {
  generatedAt: string;
  verdict: "passed" | "failed";
  draftRoomId: string;
  teamCount: number | null;
  myDraftSlot: number | null;
  teamSlots: Array<{ rosterId: string; label: string; draftSlot: number; mappingSource: string | null }>;
  pickColumnMismatches: Array<{ pickNo: number; round: number | null; pickSlot: number | null; pickRosterId: string | null; columnRosterId: string | null }>;
  duplicateSlots: number[];
  missingSlots: number[];
  mySlotHighlightResolvable: boolean;
  positionNormalizationExamples: Record<string, string>;
  failureReasons: string[];
};

loadLocalEnv();

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const artifact = failedArtifact(message);
  writeArtifacts(artifact);
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const userId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (!userId) throw new Error("Missing BLACKBIRD_E2E_AUTH_USER_ID or SCORING_VALIDATION_OPERATOR_USER_ID.");
  const draftRoomId = process.argv.find((arg) => arg.startsWith("--draft-room-id="))?.split("=")[1] ?? selectDraftRoomId();
  if (!draftRoomId) throw new Error("No draft room found for H11 draft board mapping.");
  const state = await getDraftRoomState(userId, draftRoomId);
  const teamsBySlot = new Map(state.draftBoardTeams.map((team) => [team.draftSlot, team]));
  const duplicateSlots = findDuplicates(state.draftBoardTeams.map((team) => team.draftSlot));
  const teamCount = state.teamCount ?? (state.draftBoardTeams.length || null);
  const missingSlots = teamCount
    ? Array.from({ length: teamCount }, (_, index) => index + 1).filter((slot) => !teamsBySlot.has(slot))
    : [];
  const pickColumnMismatches = state.picks
    .map((pick) => {
      const slot = pick.pick_in_round ?? inferDraftSlotForPick(pick.pick_no, teamCount ?? state.draftBoardTeams.length);
      const team = teamsBySlot.get(slot);
      return {
        pickNo: pick.pick_no,
        round: pick.round,
        pickSlot: slot,
        pickRosterId: pick.platform_roster_id,
        columnRosterId: team?.rosterId ?? null,
      };
    })
    .filter((row) => row.pickRosterId && row.columnRosterId && row.pickRosterId !== row.columnRosterId);
  const mySlotHighlightResolvable = state.myDraftSlot === null || state.draftBoardTeams.some((team) => team.draftSlot === state.myDraftSlot);
  const fallbackOnly = state.draftBoardTeams.length > 0 && state.draftBoardTeams.every((team) => team.mappingSource === "roster_id_fallback");
  const failureReasons = [
    duplicateSlots.length ? `duplicate draft slots: ${duplicateSlots.join(", ")}` : null,
    missingSlots.length ? `missing draft slots: ${missingSlots.join(", ")}` : null,
    pickColumnMismatches.length ? "one or more picks map to a different roster than the rendered slot column" : null,
    !mySlotHighlightResolvable ? "my draft slot does not resolve to a rendered team column" : null,
    fallbackOnly && state.picks.length > 0 ? "all team columns used roster_id fallback even though pick history is available" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const artifact: MappingArtifact = {
    generatedAt: new Date().toISOString(),
    verdict: failureReasons.length ? "failed" : "passed",
    draftRoomId,
    teamCount,
    myDraftSlot: state.myDraftSlot,
    teamSlots: state.draftBoardTeams.map((team) => ({
      rosterId: team.rosterId,
      label: team.label,
      draftSlot: team.draftSlot,
      mappingSource: team.mappingSource ?? null,
    })),
    pickColumnMismatches,
    duplicateSlots,
    missingSlots,
    mySlotHighlightResolvable,
    positionNormalizationExamples: {
      S: normalizeDraftBoardPosition("S"),
      SS: normalizeDraftBoardPosition("SS"),
      FS: normalizeDraftBoardPosition("FS"),
      CB: normalizeDraftBoardPosition("CB"),
      DE: normalizeDraftBoardPosition("DE"),
      DT: normalizeDraftBoardPosition("DT"),
      ILB: normalizeDraftBoardPosition("ILB"),
      OLB: normalizeDraftBoardPosition("OLB"),
      MLB: normalizeDraftBoardPosition("MLB"),
      "D/ST": normalizeDraftBoardPosition("D/ST"),
      DST: normalizeDraftBoardPosition("DST"),
      DEF: normalizeDraftBoardPosition("DEF"),
    },
    failureReasons,
  };
  writeArtifacts(artifact);
  console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-draft-board-mapping.json" }, null, 2));
  if (artifact.verdict !== "passed") process.exitCode = 1;
}

function selectDraftRoomId(): string | null {
  const artifactPath = path.join(OUTPUT_DIR, "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) return null;
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { roomInventory?: Array<{ draftRoomId: string; isSuperflex?: boolean; hasIDP?: boolean }> };
  return artifact.roomInventory?.find((room) => room.isSuperflex || room.hasIDP)?.draftRoomId ?? artifact.roomInventory?.[0]?.draftRoomId ?? null;
}

function inferDraftSlotForPick(pickNo: number, teamCount: number) {
  const round = Math.ceil(pickNo / teamCount);
  const pickInRound = ((pickNo - 1) % teamCount) + 1;
  return round % 2 === 0 ? teamCount - pickInRound + 1 : pickInRound;
}

function findDuplicates(values: number[]): number[] {
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return Array.from(dupes).sort((a, b) => a - b);
}

function writeArtifacts(artifact: MappingArtifact) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, "h11-draft-board-mapping.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, "h11-draft-board-mapping.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: MappingArtifact): string {
  return [
    "# H11.3.1 Draft Board Mapping",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    `Draft room: ${artifact.draftRoomId}`,
    `Team count: ${artifact.teamCount ?? "unknown"}`,
    `My draft slot: ${artifact.myDraftSlot ?? "unknown"}`,
    "",
    "## Team Slots",
    "",
    ...artifact.teamSlots.map((team) => `- Slot ${team.draftSlot}: ${team.label} (${team.rosterId}, ${team.mappingSource ?? "unknown"})`),
    "",
    "## Checks",
    "",
    `- Duplicate slots: ${artifact.duplicateSlots.join(", ") || "none"}`,
    `- Missing slots: ${artifact.missingSlots.join(", ") || "none"}`,
    `- Pick column mismatches: ${artifact.pickColumnMismatches.length}`,
    `- My slot highlight resolvable: ${artifact.mySlotHighlightResolvable}`,
    `- Position normalization: ${JSON.stringify(artifact.positionNormalizationExamples)}`,
    `- Failure reasons: ${artifact.failureReasons.join("; ") || "none"}`,
    "",
  ].join("\n");
}

function failedArtifact(message: string): MappingArtifact {
  return {
    generatedAt: new Date().toISOString(),
    verdict: "failed",
    draftRoomId: "unknown",
    teamCount: null,
    myDraftSlot: null,
    teamSlots: [],
    pickColumnMismatches: [],
    duplicateSlots: [],
    missingSlots: [],
    mySlotHighlightResolvable: false,
    positionNormalizationExamples: {},
    failureReasons: [message],
  };
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
