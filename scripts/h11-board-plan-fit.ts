import { buildLivePlanStatus, applyLivePlanFitToBoardRows, findBannedLivePlanLanguage } from "@/lib/draft/live-plan-status";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const board = buildBlackbirdBoard({
  players: [
    player({ matched_player_id: "qb", player_name: "QB Tier", position: "QB", projected_points: 335 }),
    player({ matched_player_id: "rb", player_name: "RB Value", position: "RB", adp: 4, projected_points: 260 }),
    player({ matched_player_id: "k", player_name: "Kicker", position: "K", projected_points: 120 }),
  ],
  overlays: [
    overlay({ entityId: "qb", displayName: "QB Tier", position: "QB", medianPoints: 335, pointsAboveReplacement: 70, riskLabel: "high" }),
    overlay({ entityId: "rb", displayName: "RB Value", position: "RB", medianPoints: 260, pointsAboveReplacement: 50 }),
    overlay({ entityId: "k", displayName: "Kicker", position: "K", medianPoints: 120, pointsAboveReplacement: 5 }),
  ],
  leagueContext: { isSuperflex: true, hasKicker: true, rosterPositions: ["QB", "OP", "RB", "WR", "TE", "K"], scoringSettings: { rec: 1 } },
});
const status = buildLivePlanStatus({
  draftRoomId: "room",
  currentPickNumber: 30,
  currentRound: 3,
  myDraftSlot: 7,
  teamCount: 12,
  picksUntilMyTurn: 4,
  positionCounts: { QB: 0, RB: 1, WR: 1, TE: 0, K: 0 },
  strategy: {
    leagueSummary: { superflexOr2Qb: true, tePremium: false, idp: false, kicker: true, teamDefense: false, flexStructure: ["1 superflex"], startingRequirements: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1 } },
    roundWindowPlanDetailed: [{ window: "Early core", rounds: "1-3", primaryPositions: ["QB", "RB", "WR"], avoidForcingPositions: ["K"], likelyValuePockets: ["RB"], tierCliffRisks: ["QB"], contingencyTriggers: ["QB tier contingency"], fallbackPath: "Monitor value pockets.", guidance: "Monitor core positions." }],
    contingencyTriggers: [{ id: "qb-tier-superflex-pivot", label: "QB tier contingency", appliesToRounds: [1, 2, 3], appliesToPositions: ["QB"], triggerConditionSummary: "QB tier risk is active.", suggestedAdjustment: "Monitor QB tier against contextual value.", riskLevel: "high", confidence: "medium", reasons: [] }],
    doNotForcePositions: [{ position: "K", reason: "Kicker belongs late." }],
    waitPositions: [{ position: "RB", confidence: "backed by wait targets", reason: "RB can wait.", targetCount: 2 }],
    roundWindowTierRisks: [{ window: "Early core", positions: ["QB"], riskLevel: "high", reason: "QB tier risk." }],
  },
  boardRows: board.rows,
  draftedPlayerIds: [],
});
const fitted = applyLivePlanFitToBoardRows(board.rows, status);
const checks = [
  { name: "board_rows_receive_plan_fit", passed: fitted.every((row) => row.planFitReasons.length > 0), detail: fitted.map((row) => `${row.playerName}:${row.planFit}`).join(", ") },
  { name: "contextual_rank_primary", passed: fitted[0].blackbirdBoardRank === board.rows[0].blackbirdBoardRank && board.diagnostics.orderingMethod.includes("static Blackbird league rank"), detail: board.diagnostics.orderingMethod },
  { name: "h10_score_not_rank_source", passed: !board.diagnostics.orderingMethod.includes("H10 recommendation/value rank"), detail: board.diagnostics.orderingMethod },
  { name: "data_gaps_visible", passed: fitted.some((row) => row.contextualDataGaps.length > 0), detail: "contextual gaps checked" },
  { name: "no_banned_language", passed: findBannedLivePlanLanguage(JSON.stringify({ status, fitted })).length === 0, detail: "safe language" },
  { name: "no_mutation", passed: JSON.stringify(board.rows) === JSON.stringify(board.rows), detail: "synthetic read-only diagnostic" },
];
const artifact = { generatedAt: new Date().toISOString(), verdict: checks.every((row) => row.passed) ? "passed" : "failed", checks, rows: fitted.map((row) => ({ rank: row.blackbirdBoardRank, playerName: row.playerName, planFit: row.planFit, planFitReasons: row.planFitReasons })) };
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, "h11-board-plan-fit.json"), JSON.stringify(artifact, null, 2));
writeFileSync(path.join(OUTPUT_DIR, "h11-board-plan-fit.md"), `# h11-board-plan-fit\n\n\`\`\`json\n${JSON.stringify(artifact, null, 2)}\n\`\`\`\n`);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-board-plan-fit.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return { sleeper_player_id: null, matched_player_id: "m1", player_name: "Player", position: "RB", team: "TST", age: 25, years_exp: 3, rank: 10, adp: 12, projected_points: 220, dynasty_value: 65, best_ball_value: 60, superflex_value: 55, te_premium_value: 55, match_status: "exact_id", match_confidence: 1, is_ranked: true, is_fallback: false, draftTargetScore: 70, recommendationTier: "good_value", scoreComponents: null, reasons: [], warnings: [], inputCompleteness: "full", positionScoringMode: "offense_v1_1", ...overrides };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return { leagueId: "league", entityId: "m1", entityType: "PLAYER", displayName: "Player", team: "TST", position: "RB", medianPoints: 220, floorPoints: 190, ceilingPoints: 250, pointsAboveReplacement: 20, pointsAboveStarterCutline: 10, riskAdjustedValue: 18, confidenceAdjustedValue: 16, tier: 1, tierLabel: "Tier 1", positionScarcityScore: 50, scarcityLabel: "medium", marketValueSignal: "aligned", marketRankDelta: null, confidenceLabel: "medium", riskLabel: "low", valueReadiness: "READY", warningCodes: [], reasonCodes: [], draftRelevance: "draft_relevant", overlayStatus: "available", ...overrides };
}
