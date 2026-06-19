import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard, type BlackbirdBoardRow } from "@/lib/draft/blackbird-board";
import { findPlayerAgeMetadata, loadPlayerAgeLookup } from "@/lib/draft/player-age-source";
import { filterDraftablePlayers } from "@/lib/draft/player-draftability";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { CurrentSeasonAdpEnrichedPlayer } from "@/lib/projections/backtesting/current-season-adp-enrichment-types";

const WATCHLIST = [
  "Josh Allen",
  "Jalen Hurts",
  "Lamar Jackson",
  "Patrick Mahomes",
  "Jayden Daniels",
  "Joe Burrow",
  "Ja'Marr Chase",
  "Puka Nacua",
  "Justin Jefferson",
  "CeeDee Lamb",
  "Amon-Ra St. Brown",
  "Malik Nabers",
  "Brian Thomas",
  "Drake London",
  "Jahmyr Gibbs",
  "Bijan Robinson",
  "Saquon Barkley",
  "Jonathan Taylor",
  "Christian McCaffrey",
  "Derrick Henry",
  "Brock Bowers",
  "Trey McBride",
  "Sam LaPorta",
  "Travis Kelce",
];

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const projectionSeason = Number(args.get("projection-season") ?? args.get("season"));
if (!Number.isInteger(projectionSeason)) {
  console.error("Usage: npm run war-room:value-timing:audit -- --projection-season=2026 --market-format=SUPERFLEX");
  process.exit(1);
}

const marketFormat = (args.get("market-format") ?? "SUPERFLEX").toUpperCase();
const artifactPath = args.get("input") ?? path.join("artifacts", "projections", "backtesting", `current-season-adp-enriched-universe-${projectionSeason}.json`);
if (!existsSync(artifactPath)) throw new Error(`Missing current season enriched universe artifact: ${artifactPath}`);

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: CurrentSeasonAdpEnrichedPlayer[] };
const ageLookup = loadPlayerAgeLookup(projectionSeason);
const rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN", "BN", "BN", "BN", "BN"];
const players = (artifact.rows ?? []).map((row) => toDraftTarget(row, ageLookup));
const draftability = filterDraftablePlayers(players, { rosterPositions });
const board = buildBlackbirdBoard({
  players: draftability.players,
  draftedPlayerIds: [],
  leagueContext: {
    isSuperflex: true,
    isTwoQb: false,
    isDynasty: true,
    isBestBall: false,
    tePremium: 1,
    hasIDP: false,
    hasKicker: false,
    hasTeamDefense: false,
    rosterPositions,
    scoringSettings: {},
  },
  draftTiming: {
    teamCount: 12,
    currentPick: null,
    picksUntilNextTurn: null,
  },
  includeDrafted: true,
});

const report = buildReport({
  projectionSeason,
  marketFormat,
  rows: board.rows,
  filteredUnsupportedPositions: draftability.filteredPositions,
  filteredUnsupportedCount: draftability.filteredReasons.position_not_eligible,
});
const artifacts = writeArtifacts(report, projectionSeason);

console.log("Suggested Draft Spot Audit");
console.log(`  projection season: ${report.projectionSeason}`);
console.log(`  market format: ${report.marketFormat}`);
console.log(`  players with suggested draft spot: ${report.summary.playersWithSuggestedDraftSpot}`);
console.log(`  players missing market data: ${report.summary.playersMissingMarketData}`);
console.log(`  top positive value edges: ${report.topPositiveValueEdges.slice(0, 5).map((row) => `${row.playerName} +${row.marketEdgePicks}`).join(", ")}`);
console.log("  artifacts:");
console.log(`    ${artifacts.jsonPath}`);
console.log(`    ${artifacts.markdownPath}`);
console.log(`    ${artifacts.csvPath}`);

type AuditRow = {
  rank: number;
  playerName: string;
  position: string | null;
  team: string | null;
  marketAdp: number | null;
  suggestedRange: string;
  timingLabel: string;
  marketEdgePicks: number | null;
  reachRisk: string;
  waitRisk: string;
  reason: string;
};

function buildReport(input: {
  projectionSeason: number;
  marketFormat: string;
  rows: BlackbirdBoardRow[];
  filteredUnsupportedPositions: string[];
  filteredUnsupportedCount: number;
}) {
  const rows = input.rows.map(toAuditRow);
  const topPositiveValueEdges = rows
    .filter((row) => row.marketEdgePicks !== null && row.marketEdgePicks > 0)
    .sort((a, b) => (b.marketEdgePicks ?? 0) - (a.marketEdgePicks ?? 0) || a.rank - b.rank)
    .slice(0, 25);
  const topReachRiskPlayers = rows
    .filter((row) => row.reachRisk === "high" || row.timingLabel === "avoid" || row.timingLabel === "do_not_reach")
    .sort((a, b) => (a.marketEdgePicks ?? 0) - (b.marketEdgePicks ?? 0) || a.rank - b.rank)
    .slice(0, 25);
  const watchlist = WATCHLIST.map((name) => rows.find((row) => normalizedName(row.playerName) === normalizedName(name)) ?? null)
    .filter((row): row is AuditRow => Boolean(row));

  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    marketFormat: input.marketFormat,
    summary: {
      totalRows: rows.length,
      playersWithSuggestedDraftSpot: rows.filter((row) => row.suggestedRange !== "Timing unknown").length,
      playersMissingMarketData: rows.filter((row) => row.marketAdp === null).length,
      topReachRiskCount: topReachRiskPlayers.length,
      filteredUnsupportedPositions: input.filteredUnsupportedPositions,
      filteredUnsupportedCount: input.filteredUnsupportedCount,
    },
    topPositiveValueEdges,
    topReachRiskPlayers,
    watchlist,
    rows,
  };
}

function toAuditRow(row: BlackbirdBoardRow): AuditRow {
  return {
    rank: row.blackbirdBoardRank,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    marketAdp: row.adp,
    suggestedRange: formatRange(row),
    timingLabel: row.suggestedDraftSpot.label,
    marketEdgePicks: row.suggestedDraftSpot.marketEdgePicks,
    reachRisk: row.suggestedDraftSpot.reachRisk,
    waitRisk: row.suggestedDraftSpot.waitRisk,
    reason: row.suggestedDraftSpot.reason,
  };
}

function formatRange(row: BlackbirdBoardRow): string {
  const spot = row.suggestedDraftSpot;
  if (spot.label === "avoid" || spot.label === "do_not_reach") return "Market too rich";
  if (spot.pickMin === null || spot.pickMax === null) return "Timing unknown";
  return `Round ${spot.round ?? "-"}, picks ${spot.pickMin}-${spot.pickMax}`;
}

function writeArtifacts(report: ReturnType<typeof buildReport>, season: number) {
  const outputDir = path.join(process.cwd(), "artifacts", "war-room");
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `suggested-draft-spot-audit-${season}.json`);
  const markdownPath = path.join(outputDir, `suggested-draft-spot-audit-${season}.md`);
  const csvPath = path.join(outputDir, `suggested-draft-spot-audit-${season}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report.rows), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function renderMarkdown(report: ReturnType<typeof buildReport>): string {
  return [
    `# Suggested Draft Spot Audit - ${report.projectionSeason}`,
    "",
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    `- Market format: ${report.marketFormat}`,
    `- Players with suggested draft spot: ${report.summary.playersWithSuggestedDraftSpot}`,
    `- Players missing market data: ${report.summary.playersMissingMarketData}`,
    `- Unsupported positions filtered: ${report.summary.filteredUnsupportedPositions.join(", ") || "none"} (${report.summary.filteredUnsupportedCount})`,
    "",
    "## Watchlist",
    "",
    "| Rank | Player | Pos | Team | ADP | Suggested | Edge | Timing | Reach | Wait |",
    "| ---: | --- | --- | --- | ---: | --- | ---: | --- | --- | --- |",
    ...report.watchlist.map(markdownRow),
    "",
    "## Top Positive Value Edges",
    "",
    "| Rank | Player | Pos | Team | ADP | Suggested | Edge | Timing |",
    "| ---: | --- | --- | --- | ---: | --- | ---: | --- |",
    ...report.topPositiveValueEdges.slice(0, 15).map((row) =>
      `| ${row.rank} | ${escapeMd(row.playerName)} | ${row.position ?? "-"} | ${row.team ?? "-"} | ${row.marketAdp ?? "-"} | ${row.suggestedRange} | ${row.marketEdgePicks ?? "-"} | ${row.timingLabel} |`
    ),
    "",
    "## Reach Risk",
    "",
    "| Rank | Player | Pos | Team | ADP | Suggested | Edge | Timing |",
    "| ---: | --- | --- | --- | ---: | --- | ---: | --- |",
    ...report.topReachRiskPlayers.slice(0, 15).map((row) =>
      `| ${row.rank} | ${escapeMd(row.playerName)} | ${row.position ?? "-"} | ${row.team ?? "-"} | ${row.marketAdp ?? "-"} | ${row.suggestedRange} | ${row.marketEdgePicks ?? "-"} | ${row.timingLabel} |`
    ),
    "",
  ].join("\n");
}

function markdownRow(row: AuditRow): string {
  return `| ${row.rank} | ${escapeMd(row.playerName)} | ${row.position ?? "-"} | ${row.team ?? "-"} | ${row.marketAdp ?? "-"} | ${row.suggestedRange} | ${row.marketEdgePicks ?? "-"} | ${row.timingLabel} | ${row.reachRisk} | ${row.waitRisk} |`;
}

function renderCsv(rows: AuditRow[]): string {
  const headers = ["rank", "player_name", "position", "team", "market_adp", "suggested_range", "timing_label", "market_edge_picks", "reach_risk", "wait_risk", "reason"];
  return [
    headers.join(","),
    ...rows.map((row) => [
      row.rank,
      csv(row.playerName),
      csv(row.position),
      csv(row.team),
      row.marketAdp ?? "",
      csv(row.suggestedRange),
      row.timingLabel,
      row.marketEdgePicks ?? "",
      row.reachRisk,
      row.waitRisk,
      csv(row.reason),
    ].join(",")),
  ].join("\n") + "\n";
}

function toDraftTarget(row: CurrentSeasonAdpEnrichedPlayer, ageLookup: ReturnType<typeof loadPlayerAgeLookup>): ScoredDraftTarget & {
  activePolicyClass?: string | null;
  policyGroup?: string | null;
  confidence?: string | null;
  confidenceScore?: number | null;
  gsisId?: string | null;
  marketRank?: number | null;
  marketFormat?: string | null;
  marketMatchType?: string | null;
  externalMarketMatchConfidence?: string | null;
  marketAnchorRank?: number | null;
} {
  const age = findPlayerAgeMetadata(ageLookup, row);
  return {
    sleeper_player_id: row.sleeperId,
    matched_player_id: row.playerId,
    player_name: row.playerName,
    position: row.position,
    team: row.team,
    age: age.age,
    yearsExperience: age.yearsExperience,
    fantasyPositions: age.fantasyPositions,
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
    confidence: row.confidence,
    confidenceScore: row.confidenceScore,
    gsisId: row.gsisId,
    marketRank: row.marketRank,
    marketFormat: row.marketFormat,
    marketMatchType: row.externalMarketMatchConfidence,
    externalMarketMatchConfidence: row.externalMarketMatchConfidence,
    marketAnchorRank: row.marketAnchorRank,
  };
}

function csv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeMd(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
