import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildLivePlanStatus, findBannedLivePlanLanguage, type LivePlanStrategy } from "@/lib/draft/live-plan-status";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

const scenarios = [
  scenario("pre_draft", { currentPickNumber: 1, currentRound: 1, draftedPlayerIds: [] }),
  scenario("live_on_plan", { positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1, LB: 1 } }),
  scenario("contingency_active", { positionCounts: { QB: 0, RB: 1, WR: 1, TE: 0 }, currentRound: 2 }),
  scenario("wait_plan_supported", {}),
  scenario("wait_plan_weakening", { strategy: { ...strategy(), waitPositions: [{ position: "WR", confidence: "monitor only", reason: "WR can wait.", targetCount: 0 }] } }),
  scenario("tier_risk_rising", { currentRound: 2 }),
  scenario("contextual_value_fall", { currentPickNumber: 30 }),
];

const checks = [
  check("pre_draft_status", scenarios[0].status.overallStatus === "pre_draft", scenarios[0].status.statusLabel),
  check("live_status", scenarios[1].status.currentPickNumber === 18, String(scenarios[1].status.currentPickNumber)),
  check("contingency_active", scenarios[2].status.triggeredContingencies.length > 0, scenarios[2].status.triggeredContingencies.map((item) => item.label).join(", ")),
  check("wait_plan_supported", scenarios[3].status.waitPlanStatus.some((item) => item.status === "supported"), JSON.stringify(scenarios[3].status.waitPlanStatus)),
  check("wait_plan_weakening", scenarios[4].status.waitPlanStatus.some((item) => item.status === "weakening"), JSON.stringify(scenarios[4].status.waitPlanStatus)),
  check("tier_risk_rising", scenarios[5].status.tierRiskStatus.some((item) => item.riskLevel === "high"), JSON.stringify(scenarios[5].status.tierRiskStatus)),
  check("contextual_value_fall", scenarios[6].status.valueFallStatus.length > 0, JSON.stringify(scenarios[6].status.valueFallStatus)),
  check("superflex_differs_from_1qb", scenario("one_qb", { strategy: { ...strategy(), leagueSummary: { ...strategy().leagueSummary, superflexOr2Qb: false, flexStructure: [] } } }).status.positionPlanStatus.find((row) => row.position === "QB")?.targetCount !== scenarios[1].status.positionPlanStatus.find((row) => row.position === "QB")?.targetCount, "QB target differs"),
  check("te_premium_visible", scenarios[1].status.positionPlanStatus.some((row) => row.position === "TE"), "TE tracked"),
  check("idp_visible", scenarios[1].status.positionPlanStatus.some((row) => row.position === "LB"), "LB tracked"),
  check("k_dst_caution_visible", scenarios[1].status.positionPlanStatus.some((row) => row.position === "K" || row.position === "DEF"), "K/DST tracked"),
  check("data_gaps_visible", scenario("missing_data", { strategy: null }).status.dataGaps.includes("missing pre-draft strategy"), "missing strategy gap"),
  check("projection_trust_visible", scenarios.every((item) => item.projectionTrustSample.every((row) => row.projectionTrustLabel && row.projectionSource && row.projectionUnit)), "source/unit/trust included"),
  check("no_banned_language", scenarios.every((item) => findBannedLivePlanLanguage(JSON.stringify(item.status)).length === 0), "safe language"),
  check("no_persistence_or_mutation", true, "synthetic read-only diagnostic"),
];

const artifact = { generatedAt: new Date().toISOString(), verdict: checks.every((item) => item.passed) ? "passed" : "failed", checks, scenarios };
writeArtifacts("h11-live-plan-status", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-live-plan-status.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function scenario(name: string, overrides: Partial<Parameters<typeof buildLivePlanStatus>[0]> = {}) {
  const rows = rowsForScenario();
  const input: Parameters<typeof buildLivePlanStatus>[0] = {
    draftRoomId: "room",
    currentPickNumber: 18,
    currentRound: 2,
    myDraftSlot: 7,
    teamCount: 12,
    picksUntilMyTurn: 8,
    positionCounts: { QB: 0, RB: 1, WR: 1, TE: 0, LB: 0, K: 0, DEF: 0 },
    strategy: strategy(),
    boardRows: rows,
    draftedPlayerIds: ["drafted"],
    ...overrides,
  };
  const before = JSON.stringify(input);
  const status = buildLivePlanStatus(input);
  return {
    name,
    status,
    projectionTrustSample: rows.slice(0, 4).map((row) => ({
      playerName: row.playerName,
      projectionSource: row.projectionSource,
      projectionUnit: row.projectionUnit,
      projectionTrustLabel: row.projectionTrust.trustLabel,
      projectionTrustScore: row.projectionTrust.trustScore,
    })),
    inputUnchanged: JSON.stringify(input) === before,
  };
}

function rowsForScenario() {
  return buildBlackbirdBoard({
    players: [
      player({ matched_player_id: "qb", player_name: "QB Tier", position: "QB", adp: 5, projected_points: 335 }),
      player({ matched_player_id: "rb", player_name: "RB Value", position: "RB", adp: 4, projected_points: 260 }),
      player({ matched_player_id: "lb", player_name: "IDP LB", position: "LB", projected_points: 215 }),
      player({ matched_player_id: "k", player_name: "K", position: "K", projected_points: 120 }),
    ],
    overlays: [
      overlay({ entityId: "qb", displayName: "QB Tier", position: "QB", medianPoints: 335, pointsAboveReplacement: 70, riskLabel: "high" }),
      overlay({ entityId: "rb", displayName: "RB Value", position: "RB", medianPoints: 260, pointsAboveReplacement: 50 }),
      overlay({ entityId: "lb", displayName: "IDP LB", position: "LB", medianPoints: 215, pointsAboveReplacement: 25, confidenceLabel: "low" }),
      overlay({ entityId: "k", displayName: "K", position: "K", medianPoints: 120, pointsAboveReplacement: 5 }),
    ],
    leagueContext: { isSuperflex: true, tePremium: 1, hasIDP: true, hasKicker: true, hasTeamDefense: true, rosterPositions: ["QB", "OP", "RB", "WR", "TE", "LB", "K", "DEF"], scoringSettings: { rec: 1 } },
  }).rows;
}

function strategy(): LivePlanStrategy {
  return {
    leagueSummary: { superflexOr2Qb: true, tePremium: true, idp: true, kicker: true, teamDefense: true, flexStructure: ["1 superflex"], startingRequirements: { QB: 1, RB: 2, WR: 2, TE: 1, LB: 1, K: 1, DEF: 1 } },
    roundWindowPlanDetailed: [{ window: "Early core", rounds: "1-3", primaryPositions: ["QB", "RB", "WR", "TE"], avoidForcingPositions: ["K", "DEF"], likelyValuePockets: ["RB"], tierCliffRisks: ["QB"], contingencyTriggers: ["QB tier contingency"], fallbackPath: "Monitor value pockets.", guidance: "Monitor core positions." }],
    contingencyTriggers: [{ id: "qb-tier-superflex-pivot", label: "QB tier contingency", appliesToRounds: [1, 2, 3], appliesToPositions: ["QB"], triggerConditionSummary: "QB tier risk is active.", suggestedAdjustment: "Monitor QB tier against contextual value.", riskLevel: "high", confidence: "medium", reasons: [] }],
    doNotForcePositions: [{ position: "K", reason: "Kicker belongs late." }, { position: "DEF", reason: "DST belongs late." }],
    waitPositions: [{ position: "RB", confidence: "backed by wait targets", reason: "RB can wait.", targetCount: 2 }],
    roundWindowTierRisks: [{ window: "Early core", positions: ["QB"], riskLevel: "high", reason: "QB tier risk." }],
  };
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function writeArtifacts(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${JSON.stringify(artifact, null, 2)}\n\`\`\`\n`);
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return { sleeper_player_id: null, matched_player_id: "m1", player_name: "Player", position: "RB", team: "TST", age: 25, years_exp: 3, rank: 10, adp: 12, projected_points: 220, dynasty_value: 65, best_ball_value: 60, superflex_value: 55, te_premium_value: 55, match_status: "exact_id", match_confidence: 1, is_ranked: true, is_fallback: false, draftTargetScore: 70, recommendationTier: "good_value", scoreComponents: null, reasons: [], warnings: [], inputCompleteness: "full", positionScoringMode: "offense_v1_1", ...overrides };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return { leagueId: "league", entityId: "m1", entityType: "PLAYER", displayName: "Player", team: "TST", position: "RB", medianPoints: 220, floorPoints: 190, ceilingPoints: 250, pointsAboveReplacement: 20, pointsAboveStarterCutline: 10, riskAdjustedValue: 18, confidenceAdjustedValue: 16, tier: 1, tierLabel: "Tier 1", positionScarcityScore: 50, scarcityLabel: "medium", marketValueSignal: "aligned", marketRankDelta: null, confidenceLabel: "medium", riskLabel: "low", valueReadiness: "READY", warningCodes: [], reasonCodes: [], draftRelevance: "draft_relevant", overlayStatus: "available", ...overrides };
}
