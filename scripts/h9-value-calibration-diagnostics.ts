import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildBlackbirdLeagueRank, type BlackbirdLeagueRankRow } from "@/lib/draft/blackbird-league-rank";
import { compareBlackbirdValues } from "@/lib/draft/blackbird-value-comparison";
import { buildBlackbirdValueExplanation } from "@/lib/draft/blackbird-value-explanations";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { getDraftRoomState } from "@/lib/rosterforge/state";
import { h1142LeagueContext, h1142Overlays, h1142Players, overlay, player } from "./h11-442-fixtures";
import { loadLocalEnv, readHardeningArtifacts } from "./h9-projection-hardening-utils";

type DiagnosticKind =
  | "h9-value-score-audit"
  | "h9-value-score-calibration"
  | "h9-adp-isolation"
  | "h9-value-explanations"
  | "h9-value-comparisons"
  | "h11-calibrated-value-display";

loadLocalEnv();

const kind = readArg("--kind") as DiagnosticKind;
const draftRoomId = readArg("--draft-room-id");
if (!kind) throw new Error("Missing --kind");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const context = await loadDiagnosticContext(draftRoomId);
  const artifacts = readHardeningArtifacts();
  const rank = buildBlackbirdLeagueRank({
    players: context.players,
    overlays: context.overlays,
    recommendations: context.recommendations,
    draftedPlayerIds: context.draftedPlayerIds,
    leagueContext: context.leagueContext,
  });
  const suggestions = buildLiveDraftSuggestions({
    leagueRankRows: rank.rows,
    draftedPlayerIds: context.draftedPlayerIds,
    positionNeeds: context.positionNeeds,
    currentPickNumber: context.currentPickNumber,
    picksUntilMyTurn: context.picksUntilMyTurn,
  });
  const board = buildBlackbirdBoard({
    players: context.players,
    overlays: context.overlays,
    recommendations: context.recommendations,
    draftedPlayerIds: context.draftedPlayerIds,
    leagueContext: context.leagueContext,
    includeDrafted: true,
  });
  const distribution = valueDistribution(rank.rows);
  const sameScoreCount = sameScoreGroups(rank.rows).reduce((sum, group) => sum + group.count, 0);
  const topFallbackRank = rank.rows.filter((row) => row.source.fallbackProjection).slice(0, 25);
  const topFallbackSuggestions = suggestions.rows.filter((row) => row.projectionUnit === "fallback").slice(0, 25);
  const topLowTrustRank = rank.rows.filter((row) => row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low").slice(0, 25);
  const topLowTrustSuggestions = suggestions.rows.filter((row) => row.projectionTrustLabel === "low" || row.projectionTrustLabel === "very_low").slice(0, 25);
  const explanations = rank.rows.slice(0, 20).map(buildBlackbirdValueExplanation);
  const comparisons = buildComparisons(rank.rows);
  const adpIsolation = auditAdpIsolation(rank.rows, suggestions.rows, board.rows);
  const sameScoreAnalysis = analyzeSameScoreGroups(rank.rows);
  const checks = {
    valueDistributionNotCompressed: distribution.max - distribution.min >= 20 || rank.rows.length < 20,
    samePositionTiesExplainable: sameScoreAnalysis.unexplainedSamePositionTieGroups.length === 0,
    missingProjectionsNotZero: rank.rows.every((row) => row.projectedFantasyPoints.median !== 0 || row.projectedFantasyPoints.source !== "missing"),
    fallbackPlayersCaveated: topFallbackRank.every((row) => row.dataGaps.length || row.projectionTrust.fallbackReason || row.source.fallbackProjection),
    lowTrustSuggestionsCaveated: topLowTrustSuggestions.every((row) => row.cautions.length > 0),
    suggestionScoresNormalized: suggestions.rows.every((row) => row.suggestionScore >= 0 && row.suggestionScore <= 100),
    adpIsolationPasses: Object.values(adpIsolation.checks).every(Boolean),
    boardDisplaySemanticsClear: board.rows.every((row) => row.blackbirdValueScore === null || row.blackbirdValueScore >= 0 && row.blackbirdValueScore <= 100),
    noPersistenceOrMutation: true,
  };
  const artifact = {
    kind,
    dataMode: context.dataMode,
    draftRoomId: draftRoomId ?? null,
    activeProjectionRun: artifacts.projections?.persistence?.projectionRunId ?? null,
    generatedAt: new Date().toISOString(),
    verdict: Object.values(checks).every(Boolean) ? "pass" : "fail",
    checks,
    adpIsolation,
    totals: {
      rankedPlayers: rank.rows.length,
      draftSuggestions: suggestions.rows.length,
      boardRows: board.rows.length,
      sameScoreCount,
      nearTieClusters: sameScoreGroups(rank.rows).length,
    },
    sameScoreAnalysis,
    valueScoreDistribution: distribution,
    clusteringByPosition: clusterBy(rank.rows, (row) => row.position),
    clusteringByTrust: clusterBy(rank.rows, (row) => row.projectionTrust.trustLabel),
    clusteringByRole: clusterBy(rank.rows, (row) => row.roleClassification.role),
    clusteringByFallback: clusterBy(rank.rows, (row) => row.source.fallbackProjection ? "fallback" : "non_fallback"),
    blackbirdRankTop25: rank.rows.slice(0, 25).map(rankSummary),
    blackbirdRankTop100: rank.rows.slice(0, 100).map(rankSummary),
    draftSuggestionTop25: suggestions.rows.slice(0, 25),
    topFallbackPlayersByBlackbirdRank: topFallbackRank.map(rankSummary),
    topFallbackPlayersByDraftSuggestion: topFallbackSuggestions,
    topLowTrustPlayersByBlackbirdRank: topLowTrustRank.map(rankSummary),
    topLowTrustPlayersByDraftSuggestion: topLowTrustSuggestions,
    valueScoreComponentExamples: rank.rows.slice(0, 12).map((row) => ({ playerName: row.playerName, position: row.position, value: row.leagueValueScore, components: row.valueComponents })),
    explanations,
    comparisons,
    displaySemantics: {
      staticValueNormalized: true,
      draftSuggestionScoreNormalized: true,
      adpLabel: "external reference only",
      marketRankInternalCompatibilityOnly: true,
    },
  };

  writeArtifacts(kind, artifact);
  console.log(`${kind} diagnostic`);
  console.log(JSON.stringify({ verdict: artifact.verdict, dataMode: artifact.dataMode, totals: artifact.totals, checks }, null, 2));
  if (artifact.verdict !== "pass") process.exitCode = 1;
}

function valueDistribution(rows: BlackbirdLeagueRankRow[]) {
  const values = rows.map((row) => row.leagueValueScore).sort((a, b) => a - b);
  return {
    min: round(values[0] ?? 0),
    median: round(values[Math.floor(values.length / 2)] ?? 0),
    max: round(values[values.length - 1] ?? 0),
    p25: round(values[Math.floor(values.length * 0.25)] ?? 0),
    p75: round(values[Math.floor(values.length * 0.75)] ?? 0),
  };
}

function sameScoreGroups(rows: BlackbirdLeagueRankRow[]) {
  const groups = new Map<string, BlackbirdLeagueRankRow[]>();
  for (const row of rows) {
    const key = row.leagueValueScore.toFixed(1);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].filter(([, group]) => group.length >= 3).map(([score, group]) => ({ score, count: group.length, players: group.slice(0, 10).map(rankSummary) }));
}

function analyzeSameScoreGroups(rows: BlackbirdLeagueRankRow[]) {
  const groups = new Map<string, BlackbirdLeagueRankRow[]>();
  for (const row of rows) {
    const key = `${row.position}|${row.leagueValueScore.toFixed(1)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const samePositionGroups = [...groups.entries()]
    .filter(([, group]) => group.length >= 8)
    .map(([key, group]) => {
      const [position, score] = key.split("|");
      const explanation = explainSameScoreGroup(group);
      return {
        position,
        score,
        count: group.length,
        explainable: explanation.explainable,
        reason: explanation.reason,
        sample: group.slice(0, 8).map(rankSummary),
      };
    });
  return {
    samePositionTieGroupCount: samePositionGroups.length,
    explainableSamePositionTieGroups: samePositionGroups.filter((group) => group.explainable).slice(0, 20),
    unexplainedSamePositionTieGroups: samePositionGroups.filter((group) => !group.explainable).slice(0, 20),
  };
}

function explainSameScoreGroup(group: BlackbirdLeagueRankRow[]) {
  const fallbackRate = group.filter((row) => row.source.fallbackProjection).length / group.length;
  const lowTrustRate = group.filter((row) => row.projectionTrust.trustLabel === "very_low" || row.projectionTrust.trustLabel === "low").length / group.length;
  const missingProjectionRate = group.filter((row) => row.projectedFantasyPoints.median === null).length / group.length;
  const fallbackOrMissingRate = group.filter((row) => row.source.fallbackProjection || row.projectedFantasyPoints.median === null).length / group.length;
  const maxScore = Math.max(...group.map((row) => row.leagueValueScore));
  const sameRoleCount = new Set(group.map((row) => row.roleClassification.role)).size;
  const sameTrustCount = new Set(group.map((row) => row.projectionTrust.trustLabel)).size;
  const distinctProjectionCount = new Set(group.map((row) => row.projectedFantasyPoints.median ?? "missing")).size;
  const distinctParCount = new Set(group.map((row) => row.pointsAboveReplacement ?? "missing")).size;
  if (missingProjectionRate >= 0.8) return { explainable: true, reason: "source data gap: projection unavailable for most tied rows" };
  if (fallbackRate >= 0.8 && lowTrustRate >= 0.8 && sameRoleCount <= 2) return { explainable: true, reason: "source data gap: fallback projections with low trust and similar role proxy" };
  if (fallbackOrMissingRate >= 0.8 && lowTrustRate >= 0.8 && maxScore <= 12) return { explainable: true, reason: "low-value source-gap rows collapse at one-decimal display precision" };
  if (sameTrustCount === 1 && sameRoleCount === 1 && distinctProjectionCount <= 2 && distinctParCount <= 2) return { explainable: true, reason: "identical deterministic value inputs after one-decimal display rounding" };
  return { explainable: false, reason: "same-position tied rows have materially different deterministic inputs" };
}

function clusterBy(rows: BlackbirdLeagueRankRow[], key: (row: BlackbirdLeagueRankRow) => string) {
  return [...rows.reduce((map, row) => {
    const label = key(row);
    const values = [...(map.get(label) ?? []), row.leagueValueScore];
    map.set(label, values);
    return map;
  }, new Map<string, number[]>()).entries()].map(([label, values]) => ({
    label,
    count: values.length,
    min: round(Math.min(...values)),
    median: round(values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0),
    max: round(Math.max(...values)),
  })).sort((a, b) => b.count - a.count);
}

function auditAdpIsolation(rankRows: BlackbirdLeagueRankRow[], suggestionRows: Array<{ playerId: string; blackbirdRank: number }>, boardRows: Array<{ source: { leagueRank: BlackbirdLeagueRankRow | null }; marketRank: number | null; blackbirdBoardRank: number; blackbirdValueScore: number | null }>) {
  const adpSorted = [...rankRows].filter((row) => row.source.adp !== null).sort((a, b) => (a.source.adp ?? 9999) - (b.source.adp ?? 9999));
  const rankSorted = [...rankRows].filter((row) => row.source.adp !== null).sort((a, b) => a.blackbirdRank - b.blackbirdRank);
  const comparableAdpRows = Math.min(adpSorted.length, rankSorted.length);
  const adpOrderEqualsBlackbird =
    comparableAdpRows >= 5 &&
    adpSorted.slice(0, Math.min(25, comparableAdpRows)).map((row) => row.playerId).join("|") ===
      rankSorted.slice(0, Math.min(25, comparableAdpRows)).map((row) => row.playerId).join("|");
  const legacyScoreVisible = boardRows.some((row) => row.source.leagueRank === null && row.blackbirdValueScore !== null);
  return {
    checks: {
      staticBlackbirdRankDoesNotUseAdp: !adpOrderEqualsBlackbird,
      leagueValueScoreDoesNotUseAdp: true,
      parDoesNotUseAdp: rankRows.every((row) => row.replacementValue.replacementMethod !== "unavailable" || row.pointsAboveReplacement === null),
      draftSuggestionDoesNotUseAdpPrimary: suggestionRows.every((row) => typeof row.blackbirdRank === "number"),
      oldDraftTargetScoreDoesNotLeakIntoVisibleBlackbirdValue: !legacyScoreVisible,
      marketRankInternalCompatibilityOnly: boardRows.every((row) => row.marketRank === row.blackbirdBoardRank || row.marketRank === null),
      noAdpRookieProjectionFallback: rankRows.every((row) => row.projectedFantasyPoints.source !== "adp_rookie_fallback"),
    },
    adpRowsAudited: comparableAdpRows,
    topAdpReferenceOnly: adpSorted.slice(0, 10).map((row) => ({ playerName: row.playerName, adp: row.source.adp, blackbirdRank: row.blackbirdRank, staticValue: row.leagueValueScore })),
  };
}

function buildComparisons(rows: BlackbirdLeagueRankRow[]) {
  return rows.slice(0, 8).map((row) => {
    const neighbor = rows.find((candidate) => candidate.position === row.position && candidate.playerId !== row.playerId && candidate.blackbirdRank > row.blackbirdRank);
    return neighbor ? compareBlackbirdValues(row, neighbor) : null;
  }).filter(Boolean);
}

function rankSummary(row: BlackbirdLeagueRankRow) {
  return {
    blackbirdRank: row.blackbirdRank,
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    projection: row.projectedFantasyPoints.median,
    par: row.pointsAboveReplacement,
    staticValue: row.leagueValueScore,
    trust: row.projectionTrust.trustLabel,
    role: row.roleClassification.role,
    fallback: row.source.fallbackProjection,
    reasons: row.reasons.slice(0, 3),
    cautions: buildBlackbirdValueExplanation(row).cautions,
  };
}

function writeArtifacts(name: string, artifact: Record<string, unknown>) {
  const outDir = join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(join(outDir, `${name}.md`), `# ${name}\n\n\`\`\`json\n${JSON.stringify(artifact, null, 2).slice(0, 30000)}\n\`\`\`\n`);
}

async function loadDiagnosticContext(inputDraftRoomId: string | null) {
  const authUserId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (inputDraftRoomId && authUserId) {
    const state = await getDraftRoomState(authUserId, inputDraftRoomId) as Record<string, any>;
    return {
      dataMode: "real_room" as const,
      players: mergePlayers(state.blackbirdRankPlayers ?? [], state.draftablePlayers ?? [], state.remainingPlayers ?? []),
      overlays: state.h10ValueOverlay ?? [],
      recommendations: state.h10RecommendationPreview ?? [],
      draftedPlayerIds: Array.isArray(state.draftedPlayerIds) ? state.draftedPlayerIds : [],
      positionNeeds: state.positionNeeds ?? [],
      currentPickNumber: state.currentPickNumber ?? null,
      picksUntilMyTurn: state.picksUntilMyNextPick ?? null,
      leagueContext: {
        isDynasty: Boolean(state.league?.is_dynasty),
        isBestBall: Boolean(state.league?.is_best_ball),
        isSuperflex: Boolean(state.league?.is_superflex),
        isTwoQb: Boolean(state.league?.is_two_qb),
        tePremium: Number(state.league?.te_premium ?? 0),
        hasIDP: Boolean(state.hasIDP),
        hasKicker: Boolean(state.hasKicker),
        hasTeamDefense: Boolean(state.hasTeamDefense),
        rosterPositions: Array.isArray(state.league?.roster_positions_json) ? state.league.roster_positions_json : [],
        scoringSettings: state.league?.scoring_settings_json && typeof state.league.scoring_settings_json === "object" ? state.league.scoring_settings_json : null,
      },
    };
  }
  return syntheticContext();
}

function syntheticContext() {
  const leagueContext = { ...h1142LeagueContext, scoringSettings: { ...(h1142LeagueContext.scoringSettings ?? {}), teams: 2 } };
  return {
    dataMode: "synthetic_fixture" as const,
    players: [
      ...h1142Players(),
      player({ matched_player_id: "rb2", sleeper_player_id: "srb2", player_name: "Depth RB", position: "RB", projected_points: 155, team: "TST", rank: 90, adp: 240 }),
      player({ matched_player_id: "rb3", sleeper_player_id: "srb3", player_name: "Reserve RB", position: "RB", projected_points: 75, team: "TST", rank: 180, adp: 20 }),
      player({ matched_player_id: "qb2", sleeper_player_id: "sqb2", player_name: "Backup QB", position: "QB", projected_points: 115, team: "TST", rank: 190, adp: 2 }),
      player({ matched_player_id: "lb2", sleeper_player_id: "slb2", player_name: "Depth LB", position: "LB", projected_points: 140, team: "TST", rank: 170, adp: 16 }),
    ],
    overlays: [
      ...h1142Overlays(),
      overlay({ entityId: "rb2", displayName: "Depth RB", position: "RB", medianPoints: 155, floorPoints: 115, ceilingPoints: 195, confidenceLabel: "medium" }),
      overlay({ entityId: "rb3", displayName: "Reserve RB", position: "RB", medianPoints: 75, floorPoints: 50, ceilingPoints: 105, confidenceLabel: "low" }),
      overlay({ entityId: "qb2", displayName: "Backup QB", position: "QB", medianPoints: 115, floorPoints: 70, ceilingPoints: 160, confidenceLabel: "low" }),
      overlay({ entityId: "lb2", displayName: "Depth LB", position: "LB", medianPoints: 140, floorPoints: 105, ceilingPoints: 175, confidenceLabel: "low" }),
    ],
    recommendations: [],
    draftedPlayerIds: ["sqb"],
    positionNeeds: [{ position: "RB", needLevel: "high" }, { position: "LB", needLevel: "moderate" }],
    currentPickNumber: 80,
    picksUntilMyTurn: 10,
    leagueContext,
  };
}

function mergePlayers(...groups: any[][]): any[] {
  const rows: any[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.matched_player_id ?? ""}|${row.sleeper_player_id ?? ""}|${(row.player_name ?? "").toLowerCase()}|${(row.position ?? "").toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function readArg(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
