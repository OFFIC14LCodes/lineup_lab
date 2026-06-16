import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdContextualValue } from "@/lib/draft/blackbird-contextual-value";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import {
  buildPlayerContextSignals,
  buildPlayerContextSignalSummary,
  playerContextSignalsToSituationContext,
  type PlayerContextSignalInput,
  type PlayerContextSignals,
} from "@/lib/draft/player-context-signals";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

const inputs: PlayerContextSignalInput[] = [
  sample({ playerId: "qb", playerName: "Context QB", position: "QB", team: "BUF", age: 28, yearsExperience: 6, historicalGamesPlayed: 17, historicalGamesPossible: 17, weeklyStatTotals: [22, 24, 20, 25, 23, 21, 24, 23], projectedVolume: 575, sameTeamPositionProjectedVolumes: [575, 35], projectionConfidence: "high", matchStatus: "exact_id" }),
  sample({ playerId: "rb", playerName: "Context RB", position: "RB", team: "SEA", age: 24, yearsExperience: 3, historicalGamesPlayed: 14, historicalGamesPossible: 17, weeklyStatTotals: [12, 8, 14, 9, 13, 10, 12, 11], projectedVolume: 245, sameTeamPositionProjectedVolumes: [245, 165, 55], projectionConfidence: "medium", matchStatus: "exact_id" }),
  sample({ playerId: "wr", playerName: "Context WR", position: "WR", team: "DET", age: 22, yearsExperience: 1, historicalGamesPlayed: 16, historicalGamesPossible: 17, weeklyStatTotals: [7, 13, 6, 12, 8, 10, 11, 9], projectedVolume: 135, sameTeamPositionProjectedVolumes: [135, 122, 74], projectionConfidence: "medium", matchStatus: "exact_id" }),
  sample({ playerId: "te", playerName: "Context TE", position: "TE", team: "LV", age: 23, yearsExperience: 1, historicalGamesPlayed: 17, historicalGamesPossible: 17, weeklyStatTotals: [6, 7, 8, 6, 7, 8, 7, 6], projectedVolume: 118, sameTeamPositionProjectedVolumes: [118, 24], projectionConfidence: "medium", matchStatus: "exact_id" }),
  sample({ playerId: "dl", playerName: "Context DL", position: "DL", team: "DAL", age: 27, yearsExperience: 5, historicalGamesPlayed: 13, historicalGamesPossible: 17, weeklyStatTotals: [4, 1, 8, 3, 5, 2, 7, 4], projectedVolume: 72, sameTeamPositionProjectedVolumes: [72, 66, 38], projectionConfidence: "low", matchStatus: "exact_id" }),
  sample({ playerId: "lb", playerName: "Context LB", position: "LB", team: "BAL", age: 26, yearsExperience: 4, historicalGamesPlayed: 16, historicalGamesPossible: 17, weeklyStatTotals: [8, 9, 7, 8, 10, 8, 9, 7], projectedVolume: 145, sameTeamPositionProjectedVolumes: [145, 82, 45], projectionConfidence: "high", matchStatus: "exact_id" }),
  sample({ playerId: "db", playerName: "Context DB", position: "DB", team: "NYJ", age: 25, yearsExperience: 3, historicalGamesPlayed: 9, historicalGamesPossible: 17, weeklyStatTotals: [2, 9, 1, 8, 0, 7, 2, 6], projectedVolume: 95, sameTeamPositionProjectedVolumes: [105, 95, 88, 20], projectionConfidence: "low", matchStatus: "exact_id" }),
  sample({ playerId: "rookie", playerName: "Rookie Unknown", position: "WR", team: "CHI", age: 21, yearsExperience: 0, isRookie: true, projectionConfidence: "low", matchStatus: "exact_id" }),
  sample({ playerId: "unresolved", playerName: "Unresolved IDP", position: "LB", team: null, unresolvedIdentity: true, matchStatus: "ambiguous", projectionConfidence: "low" }),
];

const signals = inputs.map(buildPlayerContextSignals);
const summary = buildPlayerContextSignalSummary(signals);
const sampleContextCards = Object.fromEntries(["QB", "RB", "WR", "TE", "DL", "LB", "DB"].map((position) => {
  const signal = signals.find((row) => row.position === position);
  return [position, signal ? contextCard(signal) : null];
}));

const unknown = buildPlayerContextSignals({ playerId: "unknown", playerName: "Unknown RB", position: "RB", age: 24, yearsExperience: 3 });
const stableStarter = signals.find((signal) => signal.playerId === "rb") ?? unknown;
const contextualUnknown = contextualValue(unknown);
const contextualKnown = contextualValue(stableStarter);
const checks = [
  check("age_available_counted", summary.playersWithAge >= 7, `${summary.playersWithAge}`),
  check("years_experience_available_counted", summary.playersWithYearsExperience >= 7, `${summary.playersWithYearsExperience}`),
  check("derived_role_counted", summary.playersWithInferredRole >= 7, `${summary.playersWithInferredRole}`),
  check("snap_share_not_fabricated", summary.playersWithProjectedSnapShare === 0, `${summary.playersWithProjectedSnapShare}`),
  check("coaching_score_not_fabricated", summary.playersWithCoachingEnvironmentScore === 0, `${summary.playersWithCoachingEnvironmentScore}`),
  check("injury_proxy_counted", summary.playersWithInjuryRisk >= 7, `${summary.playersWithInjuryRisk}`),
  check("role_stability_proxy_counted", summary.playersWithRoleStability >= 7, `${summary.playersWithRoleStability}`),
  check("contextual_value_uses_available_fields", contextualKnown.valueScoreComponents.depthChartRole > contextualUnknown.valueScoreComponents.depthChartRole, `${contextualKnown.valueScoreComponents.depthChartRole} > ${contextualUnknown.valueScoreComponents.depthChartRole}`),
  check("unknown_fields_neutral_defaulted", contextualUnknown.valueScoreComponents.coachingEnvironment === 50 && contextualUnknown.valueScoreComponents.projectedSnapShare === 50, `coaching=${contextualUnknown.valueScoreComponents.coachingEnvironment}, snap=${contextualUnknown.valueScoreComponents.projectedSnapShare}`),
  check("unknown_fields_shown_as_data_gaps", unknown.dataGaps.includes("coaching environment") && unknown.dataGaps.includes("actual snap share"), unknown.dataGaps.join(", ")),
  check("derived_signals_labeled_proxy", signals.filter((signal) => signal.roleStability.label !== "unknown").every((signal) => signal.roleStability.reasons.join(" ").includes("Derived proxy")), "role stability reasons"),
  check("no_external_sources_claimed", signals.every((signal) => !signal.dataSources.some((source) => /scrape|paid|external api/i.test(source))), "internal/source-ready only"),
];

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: checks.every((row) => row.passed) ? "passed" : "failed",
  summary,
  sampleContextCards,
  contextualValueIntegration: {
    knownContextValueScore: contextualKnown.valueScore,
    unknownContextValueScore: contextualUnknown.valueScore,
    knownDepthChartComponent: contextualKnown.valueScoreComponents.depthChartRole,
    unknownDepthChartComponent: contextualUnknown.valueScoreComponents.depthChartRole,
    unknownCoachingComponent: contextualUnknown.valueScoreComponents.coachingEnvironment,
    unknownSnapShareComponent: contextualUnknown.valueScoreComponents.projectedSnapShare,
    unknownDataGaps: contextualUnknown.dataGaps,
  },
  checks,
  acquisitionPlan: [
    "Use internal player age, years experience, team, position, identity status, projection confidence, historical games, and weekly stat consistency first.",
    "Use derived/proxy role stability, missed-game injury risk, and projected role only when historical or projection-volume inputs exist.",
    "Leave coaching environment, team environment, confirmed injury status, and actual snap share unknown until approved data sources are connected.",
    "Feed context through situationContext so the value model can use available fields while neutral-defaulting unknowns.",
  ],
};

writeArtifacts("h11-player-context-signals", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-player-context-signals.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function sample(overrides: PlayerContextSignalInput): PlayerContextSignalInput {
  return { dataSources: ["synthetic diagnostic fixture"], ...overrides };
}

function contextCard(signal: PlayerContextSignals) {
  return {
    playerId: signal.playerId,
    playerName: signal.playerName,
    position: signal.position,
    team: signal.team,
    age: signal.age,
    yearsExperience: signal.yearsExperience,
    depthChartRole: signal.depthChartRole,
    projectedSnapShare: signal.projectedSnapShare,
    coachingEnvironment: signal.coachingEnvironment,
    teamEnvironment: signal.teamEnvironment,
    injuryRisk: signal.injuryRisk,
    roleStability: signal.roleStability,
    confidence: signal.confidence,
    dataSources: signal.dataSources,
    dataGaps: signal.dataGaps,
  };
}

function contextualValue(signal: PlayerContextSignals) {
  return buildBlackbirdContextualValue({
    player: player({
      matched_player_id: signal.playerId,
      player_name: signal.playerName,
      position: signal.position,
      team: signal.team,
      age: signal.age,
      years_exp: signal.yearsExperience,
    }),
    overlay: overlay({
      entityId: signal.playerId,
      displayName: signal.playerName,
      position: signal.position,
      team: signal.team,
      confidenceLabel: signal.confidence,
    }),
    situationContext: playerContextSignalsToSituationContext(signal),
    leagueContext: {
      isDynasty: true,
      isBestBall: false,
      isSuperflex: true,
      tePremium: 1,
      hasIDP: true,
      rosterPositions: ["QB", "OP", "RB", "WR", "TE", "DL", "LB", "DB"],
      scoringSettings: { rec: 1, sack: 6, tackle_solo: 2 },
    },
  });
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function writeArtifacts(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), json);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), renderMarkdown(name, artifact));
}

function renderMarkdown(name: string, artifact: unknown) {
  const row = artifact as typeof artifact & { verdict?: string; summary?: unknown; checks?: Array<{ name: string; passed: boolean; detail: string }> };
  return [
    `# ${name}`,
    "",
    `Verdict: ${row.verdict ?? "unknown"}`,
    "",
    "## Summary",
    "",
    "```json",
    JSON.stringify(row.summary ?? {}, null, 2),
    "```",
    "",
    "## Checks",
    "",
    ...(row.checks ?? []).map((checkRow) => `- ${checkRow.passed ? "PASS" : "FAIL"} ${checkRow.name}: ${checkRow.detail}`),
    "",
    "## Full Artifact",
    "",
    "```json",
    JSON.stringify(artifact, null, 2),
    "```",
    "",
  ].join("\n");
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: null,
    matched_player_id: "p",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 24,
    years_exp: 3,
    rank: 10,
    adp: 12,
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
    entityId: "p",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    floorPoints: 190,
    ceilingPoints: 260,
    pointsAboveReplacement: 30,
    pointsAboveStarterCutline: 12,
    riskAdjustedValue: 24,
    confidenceAdjustedValue: 22,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 60,
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
  };
}
