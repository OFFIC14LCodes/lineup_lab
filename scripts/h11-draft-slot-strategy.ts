import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildDraftSlotStrategyCalibration } from "@/lib/draft/draft-slot-strategy";
import { buildPreDraftStrategy, validateStrategyLanguage, type PreDraftStrategyInput } from "@/lib/draft/pre-draft-strategy";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

type Artifact = {
  generatedAt: string;
  verdict: "H11.3 DRAFT SLOT STRATEGY READY" | "H11.3 DRAFT SLOT STRATEGY NEEDS REVISION";
  slotClassificationsTested: Array<ReturnType<typeof buildDraftSlotStrategyCalibration>>;
  sampleStrategyOutputs: Array<{
    label: string;
    draftSlotBand: string;
    maxWaitUntilNextPick: number | null;
    projectedUserPicks: number[];
    slotStrategySummary: string;
    languageFailures: string[];
  }>;
  dataGaps: string[];
  bannedLanguageStatus: { passed: boolean; failures: string[] };
  remainingRisks: string[];
};

const cases = [
  { label: "8-team early", draftSlot: 1, teamCount: 8 },
  { label: "10-team early-middle", draftSlot: 3, teamCount: 10 },
  { label: "12-team middle", draftSlot: 6, teamCount: 12 },
  { label: "12-team near-turn", draftSlot: 11, teamCount: 12 },
  { label: "14-team late turn", draftSlot: 14, teamCount: 14 },
  { label: "unknown team count fallback", draftSlot: 5, teamCount: null },
];

const slotClassificationsTested = cases.map((row) => buildDraftSlotStrategyCalibration({ ...row, rounds: 18 }));
const sampleStrategyOutputs = cases.slice(0, 5).map((row) => {
  const strategy = buildPreDraftStrategy(baseInput(row));
  return {
    label: row.label,
    draftSlotBand: strategy.draftSlotStrategy.draftSlotBand,
    maxWaitUntilNextPick: strategy.draftSlotStrategy.maxWaitUntilNextPick,
    projectedUserPicks: strategy.draftSlotStrategy.projectedUserPicks.slice(0, 6).map((pick) => pick.overallPick),
    slotStrategySummary: strategy.draftSlotStrategy.slotStrategySummary,
    languageFailures: validateStrategyLanguage(strategy),
  };
});

const languageFailures = sampleStrategyOutputs.flatMap((row) => row.languageFailures);
const dataGaps = Array.from(new Set(slotClassificationsTested.flatMap((row) => row.dataGaps)));
const artifact: Artifact = {
  generatedAt: new Date().toISOString(),
  verdict: languageFailures.length ? "H11.3 DRAFT SLOT STRATEGY NEEDS REVISION" : "H11.3 DRAFT SLOT STRATEGY READY",
  slotClassificationsTested,
  sampleStrategyOutputs,
  dataGaps,
  bannedLanguageStatus: { passed: languageFailures.length === 0, failures: Array.from(new Set(languageFailures)) },
  remainingRisks: [
    "Pick windows are deterministic snake-draft approximations and do not model traded picks.",
    "Unknown team count and draft slot contexts return partial strategy with explicit data gaps.",
  ],
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, "h11-draft-slot-strategy.json"), JSON.stringify(artifact, null, 2));
writeFileSync(path.join(OUTPUT_DIR, "h11-draft-slot-strategy.md"), renderMarkdown(artifact));
console.log(JSON.stringify({ verdict: artifact.verdict, artifacts: ["artifacts/projections/h11-draft-slot-strategy.json", "artifacts/projections/h11-draft-slot-strategy.md"] }, null, 2));
if (artifact.verdict !== "H11.3 DRAFT SLOT STRATEGY READY") process.exitCode = 1;

function baseInput(row: { draftSlot: number | null; teamCount: number | null }): PreDraftStrategyInput {
  return {
    room: {
      draftRoomId: "diagnostic-room",
      leagueId: "diagnostic-league",
      leagueName: "Diagnostic League",
      season: "2026",
      positions_present: ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"],
      hasIDP: true,
      hasKicker: true,
      hasTeamDefense: true,
      isSuperflex: true,
      is2QB: false,
      isTEPremium: true,
      benchDepth: 8,
      currentPickKnown: true,
      picksUntilMyNextPickKnown: true,
      remaining_player_count: 120,
    },
    roomResult: { formats: [], rowsByPosition: {}, contextLimitations: [], topRecommendations: [], watchlistExamples: [] },
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "SUPER_FLEX", "FLEX", "DL", "LB", "DB", "K", "DEF", "BN", "BN", "BN"],
    scoringSettings: { rec: 1, bonus_rec_te: 0.5 },
    draftSlot: row.draftSlot,
    teamCount: row.teamCount,
    rounds: 18,
  };
}

function renderMarkdown(artifact: Artifact): string {
  return [
    "# H11.3 Draft Slot Strategy",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Slot Classifications Tested",
    "",
    ...artifact.slotClassificationsTested.map((row) => `- Slot ${row.draftSlot ?? "unknown"} / ${row.teamCount ?? "unknown"} teams: ${row.draftSlotBand}, turn=${row.isTurnPick}, nearTurn=${row.isNearTurn}, maxWait=${row.maxWaitUntilNextPick ?? "unknown"}`),
    "",
    "## Sample Outputs",
    "",
    ...artifact.sampleStrategyOutputs.flatMap((row) => [
      `### ${row.label}`,
      `- Band: ${row.draftSlotBand}`,
      `- Max wait: ${row.maxWaitUntilNextPick ?? "unknown"}`,
      `- Projected picks: ${row.projectedUserPicks.join(", ")}`,
      `- Summary: ${row.slotStrategySummary}`,
      `- Language failures: ${row.languageFailures.join(", ") || "none"}`,
      "",
    ]),
    "## Data Gaps",
    "",
    ...(artifact.dataGaps.length ? artifact.dataGaps.map((gap) => `- ${gap}`) : ["- None"]),
    "",
    "## Remaining Risks",
    "",
    ...artifact.remainingRisks.map((risk) => `- ${risk}`),
    "",
  ].join("\n");
}
