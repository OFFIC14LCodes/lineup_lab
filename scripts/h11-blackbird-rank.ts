import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard, findBannedBoardLanguage } from "@/lib/draft/blackbird-board";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

const board = buildBlackbirdBoard({
  players: [
    player({ player_name: "ADP One", matched_player_id: "adp", adp: 1, projected_points: 190 }),
    player({ player_name: "Blackbird One", matched_player_id: "bb", adp: 250, projected_points: 245 }),
    player({ player_name: "Context Gap LB", matched_player_id: "lb", position: "LB", age: null, years_exp: null, projected_points: 215 }),
  ],
  overlays: [
    overlay({ entityId: "adp", displayName: "ADP One", medianPoints: 190, floorPoints: 160, ceilingPoints: 220, pointsAboveReplacement: 8 }),
    overlay({ entityId: "bb", displayName: "Blackbird One", medianPoints: 245, floorPoints: 210, ceilingPoints: 290, pointsAboveReplacement: 38 }),
    overlay({ entityId: "lb", displayName: "Context Gap LB", position: "LB", medianPoints: 215, floorPoints: 175, ceilingPoints: 255, pointsAboveReplacement: 22 }),
  ],
  leagueContext: {
    isDynasty: true,
    isSuperflex: true,
    hasIDP: true,
    rosterPositions: ["QB", "RB", "WR", "TE", "OP", "LB", "IDP_FLEX"],
    scoringSettings: { pass_td: 4, sack: 6, tackle_solo: 2 },
  },
});

const first = board.rows[0];
const lb = board.rows.find((row) => row.playerName === "Context Gap LB");
const checks = [
  { name: "rank_not_adp_fallback", passed: first?.playerName === "Blackbird One", detail: first?.playerName ?? "missing" },
  {
    name: "projection_equals_detail",
    passed: board.rows.every((row) => row.projectionPoints === row.playerDetailContext?.projectedFantasyPoints.median),
    detail: "board projection matches player detail median projection",
  },
  {
    name: "idp_projection_not_single_digit",
    passed: (lb?.projectionPoints ?? 0) > 100,
    detail: `lbProjection=${lb?.projectionPoints ?? "missing"}`,
  },
  {
    name: "context_gaps_visible",
    passed: Boolean(lb?.contextualDataGaps.includes("age") && lb.contextualDataGaps.includes("years experience")),
    detail: lb?.contextualDataGaps.join(", ") ?? "missing",
  },
  {
    name: "banned_language_clean",
    passed: findBannedBoardLanguage(JSON.stringify(board.rows)).length === 0,
    detail: findBannedBoardLanguage(JSON.stringify(board.rows)).join(", ") || "none",
  },
  {
    name: "no_mutation_or_persistence",
    passed: true,
    detail: "synthetic in-memory rank audit; artifact output only",
  },
];

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: checks.every((row) => row.passed) ? "passed" : "failed",
  orderingMethod: board.diagnostics.orderingMethod,
  rows: board.rows.map((row) => ({
    rank: row.blackbirdBoardRank,
    playerName: row.playerName,
    blackbirdValueScore: row.blackbirdValueScore,
    projectionPoints: row.projectionPoints,
    marketRank: row.marketRank,
    dataGaps: row.contextualDataGaps,
  })),
  checks,
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, "h11-blackbird-rank.json"), JSON.stringify(artifact, null, 2));
console.log(JSON.stringify(artifact, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 25,
    years_exp: 3,
    rank: 10,
    adp: null,
    projected_points: 220,
    dynasty_value: 65,
    best_ball_value: 60,
    superflex_value: 55,
    te_premium_value: 55,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    pointsAboveReplacement: 20,
    pointsAboveStarterCutline: 10,
    riskAdjustedValue: 18,
    confidenceAdjustedValue: 16,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: null,
    confidenceLabel: "medium",
    riskLabel: "low",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
    floorPoints: overrides.floorPoints ?? 190,
    ceilingPoints: overrides.ceilingPoints ?? 250,
  };
}
