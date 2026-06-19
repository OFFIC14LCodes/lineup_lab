import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import {
  buildMultiPositionEligibilityAudit,
  renderMultiPositionEligibilityAuditCsv,
  renderMultiPositionEligibilityAuditMarkdown,
  type MultiPositionEligibilityAuditReport,
} from "@/lib/draft/multi-position-eligibility-audit";
import { filterDraftablePlayers } from "@/lib/draft/player-draftability";
import { findPlayerAgeMetadata, loadPlayerAgeLookup } from "@/lib/draft/player-age-source";
import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { CurrentSeasonAdpEnrichedPlayer } from "@/lib/projections/backtesting/current-season-adp-enrichment-types";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const projectionSeason = Number(args.get("projection-season") ?? args.get("season"));
if (!Number.isInteger(projectionSeason)) {
  console.error("Usage: npm run war-room:multi-position:audit -- --projection-season=2026");
  process.exit(1);
}

const artifactPath = args.get("input") ?? path.join("artifacts", "projections", "backtesting", `current-season-adp-enriched-universe-${projectionSeason}.json`);
if (!existsSync(artifactPath)) throw new Error(`Missing current season enriched universe artifact: ${artifactPath}`);

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: CurrentSeasonAdpEnrichedPlayer[] };
const ageLookup = loadPlayerAgeLookup(projectionSeason);
const rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "DL", "LB", "IDP_FLEX", "BN", "BN", "BN"];
const rosterRequirements = buildNormalizedRosterRequirements(rosterPositions);
const players = (artifact.rows ?? []).map((row) => toDraftTarget(row, ageLookup));
const draftability = filterDraftablePlayers(players, { rosterRequirements });
const board = buildBlackbirdBoard({
  players: draftability.players,
  draftedPlayerIds: [],
  leagueContext: {
    isSuperflex: true,
    isTwoQb: false,
    isDynasty: true,
    isBestBall: false,
    tePremium: 1,
    hasIDP: true,
    hasKicker: false,
    hasTeamDefense: false,
    rosterPositions,
    scoringSettings: {},
  },
  includeDrafted: true,
});
const report = buildMultiPositionEligibilityAudit({
  projectionSeason,
  players,
  boardRows: board.rows,
  rosterRequirements,
});
const artifacts = writeArtifacts(report, projectionSeason);

console.log("Multi-Position Eligibility Audit");
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  projection season: ${report.projectionSeason}`);
console.log(`  recommendation: ${report.recommendation}`);
console.log(`  multi-position source rows: ${report.summary.playersWithMultipleRawEligiblePositions}`);
console.log(`  multi-position players on board: ${report.summary.multiPositionPlayersOnBoard}`);
console.log(`  secondary position changes draftability: ${report.summary.secondaryPositionChangesDraftability}`);
console.log(`  secondary position changes roster fit: ${report.summary.secondaryPositionChangesRosterFit}`);
console.log(`  secondary position changes value: ${report.summary.secondaryPositionChangesValue}`);
console.log(`  classes: ${Object.entries(report.summary.classes).map(([eligibilityClass, count]) => `${eligibilityClass}:${count}`).join(", ")}`);
console.log(`  combos: ${Object.entries(report.summary.combos).map(([combo, count]) => `${combo}:${count}`).join(", ") || "none"}`);
console.log("  artifacts:");
console.log(`    ${artifacts.jsonPath}`);
console.log(`    ${artifacts.markdownPath}`);
console.log(`    ${artifacts.csvPath}`);

function writeArtifacts(report: MultiPositionEligibilityAuditReport, season: number) {
  const outputDir = path.join(process.cwd(), "artifacts", "war-room");
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `multi-position-eligibility-audit-${season}.json`);
  const markdownPath = path.join(outputDir, `multi-position-eligibility-audit-${season}.md`);
  const csvPath = path.join(outputDir, `multi-position-eligibility-audit-${season}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMultiPositionEligibilityAuditMarkdown(report), "utf8");
  writeFileSync(csvPath, renderMultiPositionEligibilityAuditCsv(report.rows), "utf8");
  return { jsonPath, markdownPath, csvPath };
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
