import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdContextualValue, assignBlackbirdRanks, type BlackbirdLeagueContext } from "@/lib/draft/blackbird-contextual-value";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

type Check = { name: string; passed: boolean; detail: string };

const checks: Check[] = [];

const dynastyYoung = value({ player_name: "Young RB", age: 23, dynasty_value: 70 }, overlay({ displayName: "Young RB" }), { isDynasty: true });
const dynastyOld = value({ player_name: "Old RB", age: 30, dynasty_value: 70 }, overlay({ displayName: "Old RB" }), { isDynasty: true });
checks.push(check("dynasty_age_lift", dynastyYoung.valueScore > dynastyOld.valueScore, `${dynastyYoung.valueScore} > ${dynastyOld.valueScore}`));

const redraftYoung = value({ player_name: "Young WR", position: "WR", age: 24 }, overlay({ displayName: "Young WR", position: "WR" }), { isDynasty: false });
const redraftOld = value({ player_name: "Old WR", position: "WR", age: 29 }, overlay({ displayName: "Old WR", position: "WR" }), { isDynasty: false });
checks.push(check("redraft_age_neutrality", Math.abs(redraftYoung.valueScore - redraftOld.valueScore) < 3, `${redraftYoung.valueScore} vs ${redraftOld.valueScore}`));

const bestBall = value({}, overlay({ floorPoints: 150, medianPoints: 220, ceilingPoints: 340 }), { isBestBall: true });
const managed = value({}, overlay({ floorPoints: 150, medianPoints: 220, ceilingPoints: 340 }), { isBestBall: false });
checks.push(check("best_ball_ceiling_lift", bestBall.valueScore > managed.valueScore, `${bestBall.valueScore} > ${managed.valueScore}`));

const superflex = value({ position: "QB" }, overlay({ position: "QB" }), { isSuperflex: true, rosterPositions: ["QB", "OP"] });
const standardQb = value({ position: "QB" }, overlay({ position: "QB" }), { isSuperflex: false, rosterPositions: ["QB"] });
checks.push(check("superflex_qb_lift", superflex.valueScore > standardQb.valueScore, `${superflex.valueScore} > ${standardQb.valueScore}`));

const tePremium = value({ position: "TE" }, overlay({ position: "TE" }), { tePremium: 1, rosterPositions: ["TE"] });
const standardTe = value({ position: "TE" }, overlay({ position: "TE" }), { tePremium: 0, rosterPositions: ["TE"] });
checks.push(check("te_premium_lift", tePremium.valueScore > standardTe.valueScore, `${tePremium.valueScore} > ${standardTe.valueScore}`));

const idp = value(
  { position: "LB", player_name: "IDP LB" },
  overlay({ position: "LB", displayName: "IDP LB", medianPoints: 220, floorPoints: 180, ceilingPoints: 260 }),
  { hasIDP: true, rosterPositions: ["LB", "IDP_FLEX"], scoringSettings: { sack: 6, tackle_solo: 2 } }
);
checks.push(check("idp_supported", idp.valueScoreComponents.idpFormatFit > 50, `idpFormatFit=${idp.valueScoreComponents.idpFormatFit}`));
checks.push(check("context_gaps_explicit", idp.dataGaps.includes("projected snap share"), idp.dataGaps.join(", ")));

const earlyAdp = value({ player_name: "Early ADP", adp: 1 }, overlay({ displayName: "Early ADP" }));
const lateAdp = value({ player_name: "Late ADP", adp: 250 }, overlay({ displayName: "Late ADP" }));
checks.push(check("adp_not_used", earlyAdp.valueScore === lateAdp.valueScore, `${earlyAdp.valueScore} === ${lateAdp.valueScore}`));

const ranked = assignBlackbirdRanks([
  value({ player_name: "Alpha", matched_player_id: "a" }, overlay({ entityId: "a", displayName: "Alpha", medianPoints: 205, pointsAboveReplacement: 18 })),
  value({ player_name: "Beta", matched_player_id: "b" }, overlay({ entityId: "b", displayName: "Beta", medianPoints: 230, pointsAboveReplacement: 35 })),
]);
checks.push(check("deterministic_rank_order", ranked[0]?.playerName === "Beta" && ranked[1]?.playerName === "Alpha", ranked.map((row) => row.playerName).join(" > ")));

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: checks.every((row) => row.passed) ? "passed" : "failed",
  checks,
  sampleValues: { dynastyYoung, dynastyOld, bestBall, superflex, tePremium, idp },
  persistence: "none",
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, "h11-contextual-value.json"), JSON.stringify(artifact, null, 2));
console.log(JSON.stringify(artifact, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function check(name: string, passed: boolean, detail: string): Check {
  return { name, passed, detail };
}

function value(playerOverrides: Partial<ScoredDraftTarget>, overlayRow: WarRoomValueOverlayRow, leagueContext: BlackbirdLeagueContext = {}) {
  return buildBlackbirdContextualValue({
    player: player(playerOverrides),
    overlay: overlayRow,
    leagueContext: { rosterPositions: ["QB", "RB", "WR", "TE", "FLEX"], scoringSettings: { rec: 1 }, ...leagueContext },
    positionPeers: [
      { projection: 150, floor: 120, ceiling: 180, par: 5, value: 5 },
      { projection: 260, floor: 220, ceiling: 310, par: 45, value: 45 },
    ],
  });
}

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
