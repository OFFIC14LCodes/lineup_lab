import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildNeedTimingDiagnostic } from "@/lib/draft/need-timing-intelligence";

type Scenario = {
  name: string;
  description: string;
  position: string;
  rosterSlots: string[];
  positionCounts: Record<string, number>;
  currentRound?: number;
  players: DraftTargetScorePlayer[];
  overlays: WarRoomValueOverlayRow[];
};

const scenarios: Scenario[] = [
  {
    name: "starter_need_fill_now",
    description: "Open DL starter need with a thin current tier and next-pick availability risk.",
    position: "DL",
    rosterSlots: ["DL", "LB", "DB", "BN"],
    positionCounts: { DL: 0 },
    players: [player("dl1", "DL", 20), player("wr1", "WR", 25)],
    overlays: [overlay("dl1", "DL", 40, 1), overlay("wr1", "WR", 44, 1)],
  },
  {
    name: "starter_need_wait_one_turn",
    description: "Open DL starter need, but several comparable DL options project to survive and WR value is stronger.",
    position: "DL",
    rosterSlots: ["DL", "LB", "DB", "BN"],
    positionCounts: { DL: 0 },
    players: [player("dl1", "DL", 48), player("dl2", "DL", 52), player("dl3", "DL", 56), player("dl4", "DL", 60), player("wr1", "WR", 16)],
    overlays: [overlay("dl1", "DL", 28, 1), overlay("dl2", "DL", 27, 1), overlay("dl3", "DL", 26, 1), overlay("dl4", "DL", 25, 1), overlay("wr1", "WR", 52, 1)],
  },
  {
    name: "kicker_wait",
    description: "Open K slot in an early round should not force a kicker.",
    position: "K",
    rosterSlots: ["QB", "RB", "WR", "TE", "K", "BN"],
    positionCounts: { K: 0 },
    currentRound: 5,
    players: [player("k1", "K", 120)],
    overlays: [overlay("k1", "K", 15, 1)],
  },
];

const artifact = {
  generatedAt: new Date().toISOString(),
  artifactVersion: "h10.11-need-timing-intelligence-v1",
  scenarios: scenarios.map((scenario) => {
    const diagnostic = buildNeedTimingDiagnostic({
      candidate: scenario.players[0],
      overlay: scenario.overlays[0],
      remainingPlayers: scenario.players,
      h10ValueOverlay: scenario.overlays,
      rosterRequirements: buildNormalizedRosterRequirements(scenario.rosterSlots),
      positionCounts: scenario.positionCounts,
      currentPickNumber: 24,
      currentRound: scenario.currentRound ?? 3,
      picksUntilMyNextPick: 12,
    });
    return {
      name: scenario.name,
      description: scenario.description,
      diagnostic,
    };
  }),
};

const dir = path.join(process.cwd(), "artifacts", "projections");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "h10-need-timing-intelligence.json"), JSON.stringify(artifact, null, 2));
writeFileSync(path.join(dir, "h10-need-timing-intelligence.md"), renderMarkdown(artifact));
console.log(JSON.stringify({
  scenarios: artifact.scenarios.length,
  actions: Object.fromEntries(artifact.scenarios.map((scenario) => [scenario.name, scenario.diagnostic.needTimingAction])),
  artifactPaths: {
    json: path.join(dir, "h10-need-timing-intelligence.json"),
    markdown: path.join(dir, "h10-need-timing-intelligence.md"),
  },
}, null, 2));

function renderMarkdown(input: typeof artifact) {
  return [
    "# H10.11 Need Timing Intelligence",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    ...input.scenarios.flatMap((scenario) => [
      `## ${scenario.name}`,
      "",
      scenario.description,
      "",
      `- Roster need status: ${scenario.diagnostic.rosterNeedStatus}`,
      `- Urgency: ${scenario.diagnostic.needUrgency}`,
      `- Future availability: ${scenario.diagnostic.futureAvailability}`,
      `- Tier drop risk: ${scenario.diagnostic.tierDropRisk}`,
      `- Opportunity cost: ${scenario.diagnostic.opportunityCost}`,
      `- Action: ${scenario.diagnostic.needTimingAction}`,
      `- Modifier: ${scenario.diagnostic.needTimingModifier}`,
      `- Reasons: ${scenario.diagnostic.needTimingReasons.join(" ")}`,
      "",
    ]),
  ].join("\n");
}

function player(id: string, position: string, adp: number): DraftTargetScorePlayer {
  return {
    sleeper_player_id: `s-${id}`,
    matched_player_id: id,
    player_name: id,
    position,
    team: "DAL",
    rank: adp,
    adp,
    projected_points: 100,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
  };
}

function overlay(id: string, position: string, value: number, tier: number): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: id,
    entityType: position === "DEF" ? "TEAM_DEFENSE" : "PLAYER",
    displayName: id,
    team: "DAL",
    position,
    medianPoints: 100,
    pointsAboveReplacement: value,
    pointsAboveStarterCutline: value / 2,
    riskAdjustedValue: value,
    confidenceAdjustedValue: value,
    tier,
    tierLabel: `Tier ${tier}`,
    positionScarcityScore: value,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: 0,
    confidenceLabel: "medium",
    riskLabel: "medium",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
  };
}
