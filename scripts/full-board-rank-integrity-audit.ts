import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import {
  buildFullBoardRankIntegrityAudit,
  renderFullBoardRankIntegrityCsv,
  renderFullBoardRankIntegrityMarkdown,
} from "@/lib/draft/full-board-rank-integrity-audit";
import { filterDraftablePlayers } from "@/lib/draft/player-draftability";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { CurrentSeasonAdpEnrichedPlayer } from "@/lib/projections/backtesting/current-season-adp-enrichment-types";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const projectionSeason = Number(args.get("projection-season") ?? args.get("season"));
if (!Number.isInteger(projectionSeason)) {
  console.error("Usage: npm run war-room:full-board-rank:audit -- --projection-season=2026 --market-format=SUPERFLEX");
  process.exit(1);
}

const marketFormat = (args.get("market-format") ?? "SUPERFLEX").toUpperCase();
const artifactPath = args.get("input") ?? path.join("artifacts", "projections", "backtesting", `current-season-adp-enriched-universe-${projectionSeason}.json`);
if (!existsSync(artifactPath)) throw new Error(`Missing current season enriched universe artifact: ${artifactPath}`);

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: CurrentSeasonAdpEnrichedPlayer[]; marketFormat?: string };
const rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN", "BN", "BN", "BN", "BN"];
const players = (artifact.rows ?? []).map(toDraftTarget);
const draftability = filterDraftablePlayers(players, { rosterPositions });
const board = buildBlackbirdBoard({
  players: draftability.players,
  draftedPlayerIds: [],
  leagueContext: {
    isSuperflex: true,
    isTwoQb: false,
    isDynasty: false,
    isBestBall: false,
    tePremium: 0,
    hasIDP: false,
    hasKicker: false,
    hasTeamDefense: false,
    rosterPositions,
    scoringSettings: {},
  },
  includeDrafted: true,
});
const legacyWatchlistExcludedCount = ["Tom Brady", "Drew Brees", "Andrew Luck", "Ben Roethlisberger", "Philip Rivers", "Eli Manning"]
  .filter((name) => draftability.filteredExamples.some((row) => normalizedName(row.player_name ?? "") === normalizedName(name))).length;
const unsupportedPositionExcludedCount = draftability.filteredReasons.position_not_eligible;
const report = buildFullBoardRankIntegrityAudit({
  projectionSeason,
  marketFormat,
  leagueFormat: "SUPERFLEX_NO_K",
  rows: board.rows,
  legacyWatchlistExcludedCount,
  unsupportedPositionExcludedCount,
});
const artifacts = writeArtifacts(report, projectionSeason);

console.log("Full Board Rank Integrity Audit");
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  projection season: ${report.projectionSeason}`);
console.log(`  market format: ${report.marketFormat}`);
console.log(`  recommendation: ${report.recommendation}`);
console.log(`  draftable players: ${report.summary.total_draftable_players}`);
console.log(`  suspicious drops: ${report.summary.players_with_suspicious_drops}`);
console.log(`  suspicious boosts: ${report.summary.players_with_suspicious_boosts}`);
console.log(`  low trust in top 100: ${report.summary.players_with_low_trust_in_top_100}`);
console.log("  artifacts:");
console.log(`    ${artifacts.jsonPath}`);
console.log(`    ${artifacts.markdownPath}`);
console.log(`    ${artifacts.csvPath}`);
if (report.recommendation === "full_board_rank_has_blocking_leakage" || report.recommendation === "full_board_rank_blocked") {
  process.exitCode = 1;
}

function writeArtifacts(report: ReturnType<typeof buildFullBoardRankIntegrityAudit>, season: number) {
  const outputDir = path.join(process.cwd(), "artifacts", "war-room");
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `full-board-rank-integrity-audit-${season}.json`);
  const markdownPath = path.join(outputDir, `full-board-rank-integrity-audit-${season}.md`);
  const csvPath = path.join(outputDir, `full-board-rank-integrity-audit-${season}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderFullBoardRankIntegrityMarkdown(report), "utf8");
  writeFileSync(csvPath, renderFullBoardRankIntegrityCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function toDraftTarget(row: CurrentSeasonAdpEnrichedPlayer): ScoredDraftTarget & {
  activePolicyClass?: string | null;
  policyGroup?: string | null;
  marketRank?: number | null;
  marketFormat?: string | null;
  marketMatchType?: string | null;
  externalMarketMatchConfidence?: string | null;
  marketAnchorRank?: number | null;
} {
  return {
    sleeper_player_id: row.sleeperId,
    matched_player_id: row.playerId,
    player_name: row.playerName,
    position: row.position,
    team: row.team,
    rank: row.modelRank,
    adp: row.adp,
    projected_points: row.projectedPoints,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: row.position === "QB" && row.modelRank !== null ? Math.max(0, 100 - row.modelRank) : null,
    te_premium_value: null,
    match_status: row.externalMarketMatchConfidence === "exact" ? "exact_id" : "name_match",
    match_confidence: row.externalMarketMatchConfidence === "exact" ? 1 : 0.8,
    is_ranked: row.modelRank !== null,
    is_fallback: false,
    draftTargetScore: row.modelRank === null ? null : Math.max(0, 100 - row.modelRank / 3),
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: row.externalMarketNotes ?? [],
    inputCompleteness: row.projectedPoints === null ? "partial" : "full",
    positionScoringMode: ["QB", "RB", "WR", "TE"].includes(row.position) ? "offense_v1_1" : "unsupported",
    activePolicyClass: row.activePolicyClass,
    policyGroup: row.policyGroup,
    marketRank: row.marketRank,
    marketFormat: row.marketFormat,
    marketMatchType: row.externalMarketMatchConfidence,
    externalMarketMatchConfidence: row.externalMarketMatchConfidence,
    marketAnchorRank: row.marketAnchorRank,
  };
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
