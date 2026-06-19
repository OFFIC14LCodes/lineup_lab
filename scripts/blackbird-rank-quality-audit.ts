import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import {
  buildBlackbirdRankQualityAudit,
  renderBlackbirdRankQualityAuditCsv,
  renderBlackbirdRankQualityAuditMarkdown,
} from "@/lib/draft/blackbird-rank-quality-audit";
import { buildMarketAnchorBoardPreview } from "@/lib/draft/market-anchor-board-preview";
import { filterDraftablePlayers } from "@/lib/draft/player-draftability";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import { isMarketAnchorRankEnabled } from "@/lib/projections/feature-flags";
import type { CurrentSeasonAdpEnrichedPlayer } from "@/lib/projections/backtesting/current-season-adp-enrichment-types";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const projectionSeason = Number(args.get("projection-season") ?? args.get("season"));
if (!Number.isInteger(projectionSeason)) {
  console.error("Usage: npm run war-room:blackbird-rank:audit -- --projection-season=2026");
  process.exit(1);
}

const artifactPath = args.get("input") ?? path.join("artifacts", "projections", "backtesting", `current-season-adp-enriched-universe-${projectionSeason}.json`);
if (!existsSync(artifactPath)) {
  throw new Error(`Missing current season enriched universe artifact: ${artifactPath}`);
}

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: CurrentSeasonAdpEnrichedPlayer[]; marketFormat?: string };
const rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN", "BN", "BN", "BN", "BN"];
const players = (artifact.rows ?? []).map(toDraftTarget);
const eligible = filterDraftablePlayers(players, { rosterPositions });
const board = buildBlackbirdBoard({
  players: eligible.players,
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
const rows = isMarketAnchorRankEnabled()
  ? buildMarketAnchorBoardPreview({
      rows: board.rows,
      rosterPositions,
      marketFormat: artifact.marketFormat ?? "SUPERFLEX",
      projectionSeason,
      flagEnabled: true,
    }).rows
  : board.rows;
const report = buildBlackbirdRankQualityAudit({
  projectionSeason,
  leagueFormat: "SUPERFLEX_NO_K",
  rows,
  draftability: eligible,
});
const artifacts = writeArtifacts(report, projectionSeason);

console.log("Blackbird Rank Quality Audit");
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  projection season: ${report.projectionSeason}`);
console.log(`  verdict: ${report.verdict}`);
console.log(`  recommendation: ${report.recommendation}`);
console.log(`  rows audited: ${report.rowsAudited}`);
for (const name of ["Ja'Marr Chase", "Bijan Robinson", "Justin Jefferson"]) {
  const player = report.watchedPlayers.find((row) => row.player_name === name);
  console.log(`  ${name}: rank ${player?.current_rank ?? "missing"} (${player?.bug_codes.join(", ") || "none"})`);
}
console.log("  artifacts:");
console.log(`    ${artifacts.jsonPath}`);
console.log(`    ${artifacts.markdownPath}`);
console.log(`    ${artifacts.csvPath}`);
if (report.verdict === "failed") process.exitCode = 1;

function writeArtifacts(report: ReturnType<typeof buildBlackbirdRankQualityAudit>, season: number) {
  const outputDir = path.join(process.cwd(), "artifacts", "war-room");
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `blackbird-rank-quality-audit-${season}.json`);
  const markdownPath = path.join(outputDir, `blackbird-rank-quality-audit-${season}.md`);
  const csvPath = path.join(outputDir, `blackbird-rank-quality-audit-${season}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderBlackbirdRankQualityAuditMarkdown(report), "utf8");
  writeFileSync(csvPath, renderBlackbirdRankQualityAuditCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function toDraftTarget(row: CurrentSeasonAdpEnrichedPlayer): ScoredDraftTarget & {
  activePolicyClass?: string | null;
  policyGroup?: string | null;
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
  };
}
