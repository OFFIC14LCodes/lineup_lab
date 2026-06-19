import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import {
  buildDynastyCalibrationAudit,
  renderDynastyCalibrationAuditCsv,
  renderDynastyCalibrationAuditMarkdown,
} from "@/lib/draft/dynasty-calibration-audit";
import { filterDraftablePlayers } from "@/lib/draft/player-draftability";
import { findPlayerAgeMetadata, loadPlayerAgeLookup } from "@/lib/draft/player-age-source";
import type { DynastyCalibrationAuditReport } from "@/lib/draft/dynasty-calibration-audit-types";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { CurrentSeasonAdpEnrichedPlayer } from "@/lib/projections/backtesting/current-season-adp-enrichment-types";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const projectionSeason = Number(args.get("projection-season") ?? args.get("season"));
if (!Number.isInteger(projectionSeason)) {
  console.error("Usage: npm run war-room:dynasty-calibration:audit -- --projection-season=2026 --market-format=SUPERFLEX");
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
const commonInput = {
  players: draftability.players,
  draftedPlayerIds: [],
  draftTiming: {
    teamCount: 12,
    currentPick: null,
    picksUntilNextTurn: null,
  },
  includeDrafted: true,
};
const beforeBoard = buildBlackbirdBoard({
  ...commonInput,
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
});
const afterBoard = buildBlackbirdBoard({
  ...commonInput,
  leagueContext: {
    isSuperflex: marketFormat === "SUPERFLEX",
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
});
const report = buildDynastyCalibrationAudit({
  projectionSeason,
  marketFormat,
  beforeRows: beforeBoard.rows,
  afterRows: afterBoard.rows,
  unsupportedPlayersFiltered: draftability.filteredReasons.position_not_eligible,
  unsupportedPositionsFiltered: draftability.filteredPositions,
});
const artifacts = writeArtifacts(report, projectionSeason);

console.log("Dynasty Calibration Audit");
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  projection season: ${report.projectionSeason}`);
console.log(`  market format: ${report.marketFormat}`);
console.log(`  recommendation: ${report.recommendation}`);
console.log(`  top 50 age coverage: ${report.summary.top50RowsWithAge}/50`);
for (const name of ["Jonathan Taylor", "Derrick Henry", "Brock Bowers", "Trey McBride", "Travis Kelce", "Justin Jefferson", "Malik Nabers", "Jayden Daniels"]) {
  const row = report.rows.find((candidate) => normalizedName(candidate.playerName) === normalizedName(name));
  console.log(`  ${name}: before ${row?.beforeRank ?? "missing"} -> after ${row?.afterRank ?? "missing"} age ${row?.age ?? "n/a"} asset ${row?.dynastyAssetScore ?? "n/a"}`);
}
console.log("  artifacts:");
console.log(`    ${artifacts.jsonPath}`);
console.log(`    ${artifacts.markdownPath}`);
console.log(`    ${artifacts.csvPath}`);

function writeArtifacts(report: DynastyCalibrationAuditReport, season: number) {
  const outputDir = path.join(process.cwd(), "artifacts", "war-room");
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `dynasty-calibration-audit-${season}.json`);
  const markdownPath = path.join(outputDir, `dynasty-calibration-audit-${season}.md`);
  const csvPath = path.join(outputDir, `dynasty-calibration-audit-${season}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderDynastyCalibrationAuditMarkdown(report), "utf8");
  writeFileSync(csvPath, renderDynastyCalibrationAuditCsv(report.rows), "utf8");
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

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
