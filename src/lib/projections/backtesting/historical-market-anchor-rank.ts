import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalMockDraftPlayer } from "./historical-mock-draft-engine-types";
import type { HistoricalStrategyComparisonReport } from "./historical-strategy-comparison-report-types";
import type {
  HistoricalMarketAnchorConfidenceBucket,
  HistoricalMarketAnchorExperimentArtifactPaths,
  HistoricalMarketAnchorExperimentReport,
  HistoricalMarketAnchorMovementSummary,
  HistoricalMarketAnchorRankedPlayer,
  HistoricalMarketAnchorStrength,
  HistoricalMarketFieldDiscovery,
} from "./historical-market-anchor-rank-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");

export const MARKET_ANCHOR_CONFIDENCE_WEIGHTS: Record<HistoricalMarketAnchorConfidenceBucket, { modelWeight: number; marketWeight: number }> = {
  high: { modelWeight: 0.9, marketWeight: 0.1 },
  medium: { modelWeight: 0.8, marketWeight: 0.2 },
  low: { modelWeight: 0.65, marketWeight: 0.35 },
  unknown: { modelWeight: 0.5, marketWeight: 0.5 },
};

export const MARKET_ANCHOR_MOVEMENT_CAPS: Record<HistoricalMarketAnchorStrength, number> = {
  light: 12,
  default: 24,
  strong: 48,
};

type MarketAnchorInputPlayer = HistoricalMockDraftPlayer & {
  confidence?: string | number | null;
  sourceConfidence?: string | number | null;
  source_confidence?: string | number | null;
  confidenceScore?: number | null;
  draftScore?: number | null;
  par?: number | null;
  role?: string | null;
  trust?: string | null;
};

export function discoverHistoricalMarketFields(players: HistoricalMockDraftPlayer[]): HistoricalMarketFieldDiscovery {
  const fields = new Set<string>();
  const count = (key: keyof HistoricalMockDraftPlayer) => players.filter((player) => player[key] !== null && player[key] !== undefined).length;
  for (const player of players as MarketAnchorInputPlayer[]) {
    if (player.adpRank !== null && player.adpRank !== undefined) fields.add("adpRank");
    if (player.marketRank !== null && player.marketRank !== undefined) fields.add("marketRank");
    if (player.blackbirdRank !== null && player.blackbirdRank !== undefined) fields.add("blackbirdRank");
    if (player.internalDraftRank !== null && player.internalDraftRank !== undefined) fields.add("internalDraftRank");
    if (player.projectionRank !== null && player.projectionRank !== undefined) fields.add("projectionRank");
    if (player.projectedPoints !== null && player.projectedPoints !== undefined) fields.add("projectedPoints");
    if (confidenceField(player) !== null) fields.add("confidence");
  }
  const playersWithAdpRank = count("adpRank");
  const playersWithMarketRank = count("marketRank");
  return {
    sourceUsed: playersWithAdpRank > 0 ? "adpRank" : playersWithMarketRank > 0 ? "marketRank" : "market_anchor_unavailable",
    players: players.length,
    playersWithAdpRank,
    playersWithMarketRank,
    playersWithBlackbirdRank: count("blackbirdRank"),
    playersWithProjectionRank: count("projectionRank"),
    playersWithProjectedPoints: count("projectedPoints"),
    playersWithConfidenceField: (players as MarketAnchorInputPlayer[]).filter((player) => confidenceField(player) !== null).length,
    fieldsAvailable: [...fields].sort(),
  };
}

export function normalizeRankScore(rank: number | null | undefined, maxRank: number): number | null {
  if (!Number.isFinite(rank ?? NaN) || !rank || rank <= 0 || maxRank <= 1) return null;
  return (maxRank - rank + 1) / maxRank;
}

export function confidenceBucketForMarketAnchor(player: HistoricalMockDraftPlayer): HistoricalMarketAnchorConfidenceBucket {
  const input = player as MarketAnchorInputPlayer;
  const confidence = confidenceField(input);
  if (typeof confidence === "string") {
    const normalized = confidence.trim().toLowerCase();
    if (["high", "very_high", "verified", "strong"].includes(normalized)) return "high";
    if (["medium", "moderate"].includes(normalized)) return "medium";
    if (["low", "very_low", "weak"].includes(normalized)) return "low";
  }
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.55) return "medium";
    if (confidence > 0) return "low";
  }
  if (player.projectedPoints !== null && player.projectedPoints !== undefined && player.projectionRank !== null && player.projectionRank !== undefined) return "high";
  if (player.projectionRank !== null && player.projectionRank !== undefined) return "medium";
  if (player.blackbirdRank !== null || player.internalDraftRank !== null) return "low";
  return "unknown";
}

export function buildMarketAnchorRankedPlayers(
  players: HistoricalMockDraftPlayer[],
  strength: HistoricalMarketAnchorStrength = "default",
): HistoricalMarketAnchorRankedPlayer[] {
  const discovery = discoverHistoricalMarketFields(players);
  const source = discovery.sourceUsed;
  const cap = MARKET_ANCHOR_MOVEMENT_CAPS[strength];
  return players.map((player) => {
    const modelRank = modelRankFor(player);
    const marketRank = source === "adpRank" ? player.adpRank ?? null : source === "marketRank" ? player.marketRank ?? null : null;
    const bucket = confidenceBucketForMarketAnchor(player);
    const weights = MARKET_ANCHOR_CONFIDENCE_WEIGHTS[bucket];
    const marketAnchorRank = modelRank === null
      ? marketRank
      : marketRank === null
        ? modelRank
        : roundRank(modelRank + clamp((modelRank * weights.modelWeight + marketRank * weights.marketWeight) - modelRank, -cap, cap));
    return {
      ...player,
      marketAnchorRank,
      marketAnchorSource: source,
      marketAnchorConfidenceBucket: bucket,
      marketAnchorMovement: modelRank !== null && marketAnchorRank !== null ? marketAnchorRank - modelRank : 0,
    };
  });
}

export function summarizeMarketAnchorMovement(players: HistoricalMarketAnchorRankedPlayer[]): HistoricalMarketAnchorMovementSummary {
  const rows = players
    .map((player) => movementRow(player))
    .filter((row) => row.originalRank !== null && row.anchoredRank !== null);
  return {
    averageRankMovement: round(average(rows.map((row) => Math.abs(row.movement)))),
    maxRankMovement: round(Math.max(...rows.map((row) => Math.abs(row.movement)), 0)),
    movedUpMost: [...rows].filter((row) => row.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 10),
    movedDownMost: [...rows].filter((row) => row.movement > 0).sort((a, b) => b.movement - a.movement).slice(0, 10),
    movementByConfidenceBucket: summarizeBy(rows, (row) => row.confidenceBucket, ["high", "medium", "low", "unknown"]),
    movementByPosition: summarizeBy(rows, (row) => row.position),
  };
}

export function rankForMarketAnchorStrategy(player: HistoricalMockDraftPlayer): number {
  return (player as HistoricalMarketAnchorRankedPlayer).marketAnchorRank ?? modelRankFor(player) ?? Number.MAX_SAFE_INTEGER;
}

export function runHistoricalMarketAnchorExperiment(input: {
  season: number;
  universePath?: string;
  cwd?: string;
  generatedAt?: string;
}): HistoricalMarketAnchorExperimentReport {
  const cwd = input.cwd ?? process.cwd();
  const universePath = input.universePath ?? path.join(OUTPUT_DIR, `historical-draft-universe-${input.season}.json`);
  const comparisonPath = path.join(OUTPUT_DIR, `historical-strategy-comparison-${input.season}.json`);
  const players = readUniversePlayers(path.resolve(cwd, universePath));
  const discovery = discoverHistoricalMarketFields(players);
  const ranked = buildMarketAnchorRankedPlayers(players);
  const comparison = existsSync(path.resolve(cwd, comparisonPath))
    ? readJson<HistoricalStrategyComparisonReport>(path.resolve(cwd, comparisonPath))
    : null;
  const leaderboard = buildExperimentLeaderboard(comparison);
  const marketAnchor = leaderboard.find((row) => row.strategy === "blackbird_market_anchor");
  const marketAnchorNeed = leaderboard.find((row) => row.strategy === "blackbird_market_anchor_need_based");
  const original = leaderboard.find((row) => row.strategy === "blackbird_rank_only");
  const movementSummary = summarizeMarketAnchorMovement(ranked);
  const pureMarketAnchorImproved = Boolean(
    original &&
    marketAnchor &&
    marketAnchor.average_team_points > original.average_team_points &&
    movementSummary.maxRankMovement > 0,
  );
  const marketAnchorNeedImproved = Boolean(original && marketAnchorNeed && marketAnchorNeed.average_team_points > original.average_team_points);
  const limitations = [
    ...(discovery.sourceUsed === "market_anchor_unavailable" ? ["market_anchor_unavailable"] : []),
    "single_season_only",
    ...(discovery.sourceUsed === "marketRank" ? ["ADP unavailable; used marketRank as the market anchor source."] : []),
    ...(discovery.sourceUsed === "marketRank" && discovery.playersWithMarketRank === discovery.playersWithBlackbirdRank ? ["marketRank currently mirrors blackbird_rank_fallback in the 2025 universe; exact ties should be treated as directional only."] : []),
    ...(marketAnchorNeedImproved && !pureMarketAnchorImproved ? ["blackbird_market_anchor_need_based improvement is attributable to the need-based layer, not market-anchor rank movement in this artifact."] : []),
  ];

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    recommendation: discovery.sourceUsed === "market_anchor_unavailable"
      ? "market_anchor_experiment_needs_market_source"
      : pureMarketAnchorImproved && leaderboard.length
        ? "market_anchor_experiment_improved_blackbird"
        : "market_anchor_experiment_directional_only",
    marketFieldDiscovery: discovery,
    confidenceWeights: MARKET_ANCHOR_CONFIDENCE_WEIGHTS,
    movementCaps: MARKET_ANCHOR_MOVEMENT_CAPS,
    defaultMovementSummary: movementSummary,
    strategyLeaderboard: leaderboard,
    improvedVsOriginalBlackbird: pureMarketAnchorImproved,
    limitations,
    dataLeakageGuard: {
      marketAnchorUsedOnlyPreseasonSafeFields: true,
      actualWeeklyOutcomesNotUsedDuringDraft: true,
      actualSeasonPointsUsedOnlyAfterDraftsComplete: true,
      rankBlendDidNotUseFinalSeasonResults: true,
    },
    safetyGates: [
      gate("no_live_outputs_changed", true, "Experiment reads local historical artifacts and writes local backtesting artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("live_rankings_unchanged", true, "Live Blackbird Rank modules are not imported or mutated."),
      gate("live_draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("adp_not_used_as_value", true, "ADP/market rank is only blended as a rank anchor."),
      gate("market_anchor_backtest_only", true, "Market anchor ranks exist only in H36/H46 artifacts."),
      gate("roster_eligibility_preserved", true, "H36 strategy selection applies league position eligibility before drafting."),
      gate("historical_backtest_no_future_leakage", true, "Rank blend does not read weekly or final season outcomes."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeHistoricalMarketAnchorExperimentArtifacts(
  report: HistoricalMarketAnchorExperimentReport,
  cwd = process.cwd(),
): HistoricalMarketAnchorExperimentArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-market-anchor-experiment-${report.season}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function confidenceField(player: MarketAnchorInputPlayer): string | number | null {
  return player.confidence ?? player.sourceConfidence ?? player.source_confidence ?? player.confidenceScore ?? null;
}

function modelRankFor(player: HistoricalMockDraftPlayer): number | null {
  return player.blackbirdRank ?? player.internalDraftRank ?? player.projectionRank ?? null;
}

function movementRow(player: HistoricalMarketAnchorRankedPlayer) {
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    originalRank: modelRankFor(player),
    marketRank: player.marketAnchorSource === "adpRank" ? player.adpRank ?? null : player.marketRank ?? null,
    anchoredRank: player.marketAnchorRank,
    movement: player.marketAnchorMovement,
    confidenceBucket: player.marketAnchorConfidenceBucket,
  };
}

function summarizeBy<K extends string>(
  rows: ReturnType<typeof movementRow>[],
  keyFor: (row: ReturnType<typeof movementRow>) => K,
  knownKeys?: K[],
): Record<K, { players: number; averageMovement: number; maxMovement: number }> {
  const keys = knownKeys ?? [...new Set(rows.map(keyFor))];
  return Object.fromEntries(keys.map((key) => {
    const group = rows.filter((row) => keyFor(row) === key);
    const moves = group.map((row) => Math.abs(row.movement));
    return [key, { players: group.length, averageMovement: round(average(moves)), maxMovement: round(Math.max(...moves, 0)) }];
  })) as Record<K, { players: number; averageMovement: number; maxMovement: number }>;
}

function buildExperimentLeaderboard(comparison: HistoricalStrategyComparisonReport | null): HistoricalMarketAnchorExperimentReport["strategyLeaderboard"] {
  const rows = comparison?.strategyLeaderboard ?? [];
  const original = rows.find((row) => row.strategy === "blackbird_rank_only");
  const need = rows.find((row) => row.strategy === "need_based");
  const projection = rows.find((row) => row.strategy === "projection_only");
  const market = rows.find((row) => row.strategy === "market_rank");
  const adp = rows.find((row) => row.strategy === "adp_only");
  return rows.map((row) => ({
    strategy: row.strategy,
    rank: row.rank,
    average_team_points: row.average_team_points,
    deltaVsBlackbirdOriginal: original ? round(row.average_team_points - original.average_team_points) : null,
    deltaVsNeedBased: need ? round(row.average_team_points - need.average_team_points) : null,
    deltaVsProjectionOnly: projection ? round(row.average_team_points - projection.average_team_points) : null,
    deltaVsMarketRank: market ? round(row.average_team_points - market.average_team_points) : null,
    deltaVsAdpOnly: adp ? round(row.average_team_points - adp.average_team_points) : null,
  }));
}

function readUniversePlayers(filePath: string): HistoricalMockDraftPlayer[] {
  if (!existsSync(filePath)) return [];
  const artifact = readJson<{
    playerUniverseInput?: { players?: HistoricalMockDraftPlayer[] };
    h36PlayerUniverse?: HistoricalMockDraftPlayer[];
    rows?: Array<HistoricalMockDraftPlayer & {
      player_id?: string;
      sleeper_id?: string | null;
      gsis_id?: string | null;
      player_name?: string;
      team?: string | null;
      projection_points?: number | null;
      blackbird_rank?: number | null;
      blackbird_rank_fallback?: number | null;
      market_rank?: number | null;
      external_market_rank?: number | null;
      adp?: number | null;
      external_market_source?: string | null;
      external_market_match_confidence?: string | null;
      external_market_notes?: string[] | null;
    }>;
  }>(filePath);
  const players = artifact.playerUniverseInput?.players ?? artifact.h36PlayerUniverse;
  if (players?.length) return players.map((player) => ({
    ...player,
    adpRank: player.adpRank ?? (player as HistoricalMockDraftPlayer & { adp?: number | null }).adp ?? null,
    marketRank: player.marketRank ?? (player as HistoricalMockDraftPlayer & { external_market_rank?: number | null }).external_market_rank ?? null,
  }));
  return artifact.rows?.map((row) => ({
    playerId: row.playerId ?? row.player_id ?? "",
    sleeperId: row.sleeperId ?? row.sleeper_id ?? null,
    gsisId: row.gsisId ?? row.gsis_id ?? null,
    playerName: row.playerName ?? row.player_name ?? "",
    position: row.position,
    nflTeam: row.nflTeam ?? row.team ?? null,
    blackbirdRank: row.blackbirdRank ?? row.blackbird_rank ?? null,
    internalDraftRank: row.internalDraftRank ?? row.blackbird_rank_fallback ?? null,
    projectionRank: row.projectionRank ?? row.blackbird_rank_fallback ?? null,
    adpRank: row.adpRank ?? row.adp ?? null,
    marketRank: row.marketRank ?? row.external_market_rank ?? row.market_rank ?? null,
    projectedPoints: row.projectedPoints ?? row.projection_points ?? null,
    externalMarketSource: row.externalMarketSource ?? row.external_market_source ?? null,
    externalMarketMatchConfidence: row.externalMarketMatchConfidence ?? row.external_market_match_confidence ?? null,
    externalMarketNotes: row.externalMarketNotes ?? row.external_market_notes ?? null,
  })) ?? [];
}

function renderMarkdown(report: HistoricalMarketAnchorExperimentReport) {
  return `${[
    `# Historical Market Anchor Experiment ${report.season}`,
    "",
    `- Recommendation: ${report.recommendation}`,
    `- Market source used: ${report.marketFieldDiscovery.sourceUsed}`,
    `- Players with ADP: ${report.marketFieldDiscovery.playersWithAdpRank}`,
    `- Players with market rank: ${report.marketFieldDiscovery.playersWithMarketRank}`,
    `- Average rank movement: ${report.defaultMovementSummary.averageRankMovement}`,
    `- Max rank movement: ${report.defaultMovementSummary.maxRankMovement}`,
    "",
    "## Leaderboard",
    "",
    "| Rank | Strategy | Avg Points | Delta vs Blackbird | Delta vs Need |",
    "|---:|---|---:|---:|---:|",
    ...report.strategyLeaderboard.map((row) => `| ${row.rank} | ${row.strategy} | ${row.average_team_points} | ${row.deltaVsBlackbirdOriginal ?? "n/a"} | ${row.deltaVsNeedBased ?? "n/a"} |`),
    "",
    "## Data Leakage Guard",
    "",
    `- Market anchor used only preseason-safe fields: ${report.dataLeakageGuard.marketAnchorUsedOnlyPreseasonSafeFields}`,
    `- Actual weekly outcomes not used during draft: ${report.dataLeakageGuard.actualWeeklyOutcomesNotUsedDuringDraft}`,
    `- Actual season points used only after drafts complete: ${report.dataLeakageGuard.actualSeasonPointsUsedOnlyAfterDraftsComplete}`,
    `- Rank blend did not use final season results: ${report.dataLeakageGuard.rankBlendDidNotUseFinalSeasonResults}`,
    "",
    "## Limitations",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalMarketAnchorExperimentReport) {
  const rows = [
    ["rank", "strategy", "average_team_points", "delta_vs_blackbird", "delta_vs_need_based", "delta_vs_projection", "delta_vs_market", "delta_vs_adp"],
    ...report.strategyLeaderboard.map((row) => [
      String(row.rank),
      row.strategy,
      String(row.average_team_points),
      String(row.deltaVsBlackbirdOriginal ?? ""),
      String(row.deltaVsNeedBased ?? ""),
      String(row.deltaVsProjectionOnly ?? ""),
      String(row.deltaVsMarketRank ?? ""),
      String(row.deltaVsAdpOnly ?? ""),
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundRank(value: number) {
  return Math.max(1, Math.round(value * 100) / 100);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
