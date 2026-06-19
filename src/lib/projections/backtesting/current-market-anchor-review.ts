import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { filterDraftEligiblePlayers } from "@/lib/draft/league-position-eligibility";

import type { CurrentSeasonAdpEnrichedPlayer, CurrentSeasonAdpEnrichmentReport } from "./current-season-adp-enrichment-types";
import type {
  CurrentMarketAnchorReviewArtifactPaths,
  CurrentMarketAnchorReviewInputArtifact,
  CurrentMarketAnchorReviewReport,
  CurrentMarketAnchorReviewRow,
} from "./current-market-anchor-review-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const NO_K_SUPERFLEX_ROSTER = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN", "BN"];
const MOVEMENT_CAP = 24;
const SUPERFLEX_QB_EXAMPLES = [
  { playerName: "Josh Allen", expectedSuperflexOrder: 1 },
  { playerName: "Lamar Jackson", expectedSuperflexOrder: 2 },
  { playerName: "Jayden Daniels", expectedSuperflexOrder: 4 },
  { playerName: "Joe Burrow", expectedSuperflexOrder: 6 },
];

export function runCurrentMarketAnchorReview(input: {
  season: number;
  marketFormat: string;
  enrichmentPath?: string;
  enrichedUniversePath?: string;
  wideAdpPath?: string;
  snapshotPath?: string;
  activePolicyPath?: string;
  cwd?: string;
  generatedAt?: string;
}): CurrentMarketAnchorReviewReport {
  const cwd = input.cwd ?? process.cwd();
  const enrichmentPath = input.enrichmentPath ?? path.join(OUTPUT_DIR, `current-season-adp-enrichment-${input.season}.json`);
  const enrichedUniversePath = input.enrichedUniversePath ?? path.join(OUTPUT_DIR, `current-season-adp-enriched-universe-${input.season}.json`);
  const wideAdpPath = input.wideAdpPath ?? path.join(OUTPUT_DIR, `historical-adp-${input.season}.normalized.json`);
  const snapshotPath = input.snapshotPath ?? path.join(OUTPUT_DIR, `preseason-projection-snapshot-${input.season}.json`);
  const activePolicyPath = input.activePolicyPath ?? path.join(OUTPUT_DIR, `projection-active-policy-refresh-final-${input.season}.json`);
  const enrichment = readJson<CurrentMarketAnchorReviewInputArtifact>(path.resolve(cwd, enrichmentPath));
  const enrichedArtifact = existsSync(path.resolve(cwd, enrichedUniversePath))
    ? readJson<{ rows?: CurrentSeasonAdpEnrichedPlayer[] }>(path.resolve(cwd, enrichedUniversePath))
    : null;
  const universe = enrichedArtifact?.rows ?? enrichment.enrichedUniverse ?? [];
  const eligible = filterDraftEligiblePlayers(universe, { rosterPositions: NO_K_SUPERFLEX_ROSTER });
  const draftableRows = eligible.players;
  const marketRows = draftableRows.filter((player) => player.marketRank !== null);
  const movementRows = marketRows.map(toReviewRow);
  const movements = movementRows.map((row) => Math.abs(row.rankDelta));
  const matchQualityAudit = buildMatchQualityAudit(enrichment);
  const superflexSanity = buildSuperflexSanity(enrichment, universe);
  const rosterEligibilitySafety = {
    kRowsPresentInAdpSource: enrichment.warRoomSafetyPreview.kRowsExistInAdpSource,
    kRowsFilteredForNoKLeague: enrichment.warRoomSafetyPreview.kExcludedByRosterEligibilityWhenNoKSlot,
    dstRowsFilteredIfUnsupported: enrichment.warRoomSafetyPreview.dstIdpExcludedWhenUnsupported || eligible.filteredPositions.includes("DEF"),
    idpRowsFilteredIfUnsupported: enrichment.warRoomSafetyPreview.dstIdpExcludedWhenUnsupported || eligible.filteredPositions.some((position) => ["DB", "DL", "LB"].includes(position)),
    unsupportedPositionsFiltered: eligible.filteredPositions,
    noUnsupportedPositionsInMarketAnchorDraftablePreview: !draftableRows.some((player) => ["K", "DST", "DEF", "DB", "DL", "LB"].includes(player.position)),
  };
  const recommendationImpactPreview = buildRecommendationImpactPreview(draftableRows);
  const recommendation = recommend({
    movementCapRespected: superflexSanity.maxMovementCapRespected,
    skillPositionMovementWithinCap: superflexSanity.skillPositionMovementWithinCap,
    unsupportedPositionsFiltered: rosterEligibilitySafety.noUnsupportedPositionsInMarketAnchorDraftablePreview,
    riskGrade: matchQualityAudit.matchQualityRiskGrade,
    reviewCandidates: matchQualityAudit.reviewCandidates,
    unmatchedAdpRows: matchQualityAudit.unmatchedAdpRows,
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    marketFormat: normalizeMarketFormat(input.marketFormat),
    recommendation,
    sourceArtifacts: { enrichmentPath, enrichedUniversePath, wideAdpPath, snapshotPath, activePolicyPath },
    movementQuality: {
      playersWithMarketAdp: enrichment.marketSanityPreview.playersWithMarketAdp,
      playersWithoutMarketAdp: enrichment.marketSanityPreview.playersWithoutMarketAdp,
      averageRankMovement: round(average(movements)),
      medianRankMovement: round(median(movements)),
      maxRankMovement: round(Math.max(...movements, 0)),
      playersMovedUp: movementRows.filter((row) => row.rankDelta < 0).length,
      playersMovedDown: movementRows.filter((row) => row.rankDelta > 0).length,
      playersUnchanged: movementRows.filter((row) => row.rankDelta === 0).length,
      movementByPosition: summarizeMovement(movementRows, (row) => row.position),
      movementByConfidenceTrustBucket: summarizeMovement(movementRows, (row) => row.confidenceTrust ?? "unknown"),
      movementByActivePolicyGroup: summarizeMovement(movementRows, (row) => row.activePolicy ?? "unknown"),
    },
    topMovementTables: {
      top50MovedUp: [...movementRows].filter((row) => row.rankDelta < 0).sort((a, b) => a.rankDelta - b.rankDelta).slice(0, 50),
      top50MovedDown: [...movementRows].filter((row) => row.rankDelta > 0).sort((a, b) => b.rankDelta - a.rankDelta).slice(0, 50),
      top50QbMovement: topPosition(movementRows, "QB"),
      top50RbMovement: topPosition(movementRows, "RB"),
      top50WrMovement: topPosition(movementRows, "WR"),
      top50TeMovement: topPosition(movementRows, "TE"),
      top50LowConfidenceMoved: topConfidence(movementRows, ["low", "very_low", "unknown"]),
      top50HighConfidenceMoved: topConfidence(movementRows, ["high"]),
    },
    superflexSanity,
    matchQualityAudit,
    reviewCandidates: {
      candidateRows: enrichment.matches.filter((match) => match.confidence === "review"),
      unmatchedRows: enrichment.matches.filter((match) => match.matchMethod === "unmatched"),
      mismatchCandidates: enrichment.matches.filter((match) => match.notes.some((note) => note.includes("conflict") || note.includes("mismatch"))),
    },
    rosterEligibilitySafety,
    recommendationImpactPreview,
    sourceSummary: {
      matchQuality: enrichment.matchQuality,
      marketSanityPreview: enrichment.marketSanityPreview,
      warRoomSafetyPreview: enrichment.warRoomSafetyPreview,
    },
    safetyGates: [
      gate("no_live_outputs_changed", true, "Review reads local H48 artifacts and writes local review artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("live_rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("live_draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("adp_not_used_as_value", true, "ADP is reviewed only as a market prior / sanity anchor."),
      gate("market_anchor_review_only", true, "No War Room market anchor path is activated."),
      gate("roster_eligibility_preserved", rosterEligibilitySafety.noUnsupportedPositionsInMarketAnchorDraftablePreview, "Unsupported positions are filtered from draftable preview rows."),
      gate("unsupported_positions_filtered", rosterEligibilitySafety.unsupportedPositionsFiltered.length > 0, "K/DST/IDP unsupported positions are filtered for the reviewed league shape."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeCurrentMarketAnchorReviewArtifacts(
  report: CurrentMarketAnchorReviewReport,
  cwd = process.cwd(),
): CurrentMarketAnchorReviewArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `current-market-anchor-review-${report.season}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildMatchQualityAudit(enrichment: CurrentSeasonAdpEnrichmentReport): CurrentMarketAnchorReviewReport["matchQualityAudit"] {
  const warnings = [
    ...(enrichment.matchQuality.exactIdMatches === 0
      ? ["Market source currently relies on name/team/position matching. This is acceptable for dry-run review but should be ID-backed or reviewed before live activation."]
      : []),
  ];
  const riskyRows = enrichment.matchQuality.reviewCandidates + enrichment.matchQuality.unmatchedAdpRows;
  const matchQualityRiskGrade = riskyRows > 20 || enrichment.matchQuality.nameTeamPositionMatches + enrichment.matchQuality.uniqueNamePositionMatches === 0
    ? "high"
    : warnings.length || riskyRows > 0
      ? "medium"
      : "low";
  return {
    exactIdMatches: enrichment.matchQuality.exactIdMatches,
    nameTeamPositionMatches: enrichment.matchQuality.nameTeamPositionMatches,
    uniqueNamePositionMatches: enrichment.matchQuality.uniqueNamePositionMatches,
    reviewCandidates: enrichment.matchQuality.reviewCandidates,
    unmatchedAdpRows: enrichment.matchQuality.unmatchedAdpRows,
    matchQualityRiskGrade,
    warnings,
  };
}

function buildSuperflexSanity(
  enrichment: CurrentSeasonAdpEnrichmentReport,
  universe: CurrentSeasonAdpEnrichedPlayer[],
): CurrentMarketAnchorReviewReport["superflexSanity"] {
  const examples = SUPERFLEX_QB_EXAMPLES.map((example) => {
    const player = universe.find((row) => row.playerName === example.playerName && row.position === "QB");
    return {
      playerName: example.playerName,
      expectedSuperflexOrder: example.expectedSuperflexOrder,
      actualSuperflexOrder: player?.marketRank ?? null,
      marketAnchorMovement: player?.marketAnchorMovement ?? null,
      passed: player?.marketRank === example.expectedSuperflexOrder && (player.marketAnchorMovement ?? 0) <= 0,
    };
  });
  const skillRows = universe.filter((row) => ["RB", "WR", "TE"].includes(row.position) && row.marketRank !== null);
  const qbRows = universe.filter((row) => row.position === "QB" && row.marketRank !== null);
  return {
    eliteQbsPulledUpward: examples.filter((row) => row.passed).length >= 3,
    nonSuperflexPprOnlyBehaviorNotUsed: enrichment.marketFormat === "SUPERFLEX" && enrichment.warRoomSafetyPreview.superflexMarketRowsAvailable,
    qbsHaveMateriallyDifferentMarketOrderThanOneQb: qbRows.some((row) => (row.marketRank ?? 999) <= 6),
    skillPositionMovementWithinCap: skillRows.every((row) => Math.abs(row.marketAnchorMovement) <= MOVEMENT_CAP),
    maxMovementCapRespected: universe.every((row) => Math.abs(row.marketAnchorMovement) <= MOVEMENT_CAP),
    examples,
  };
}

function buildRecommendationImpactPreview(players: CurrentSeasonAdpEnrichedPlayer[]): CurrentMarketAnchorReviewReport["recommendationImpactPreview"] {
  const withRanks = players.filter((player) => player.modelRank !== null && player.marketAnchorRank !== null);
  if (!withRanks.length) {
    return {
      status: "not_available_v1",
      currentTop25BeforeMarketAnchor: [],
      top25AfterMarketAnchor: [],
      playersEnteringTop25: [],
      playersLeavingTop25: [],
      topRecommendationChanged: "not_available_v1",
      draftSignalTopChanged: "not_available_v1",
    };
  }
  const before = [...withRanks].sort((a, b) => (a.modelRank ?? 999999) - (b.modelRank ?? 999999)).slice(0, 25).map(toReviewRow);
  const after = [...withRanks].sort((a, b) => (a.marketAnchorRank ?? 999999) - (b.marketAnchorRank ?? 999999)).slice(0, 25).map(toReviewRow);
  const beforeNames = new Set(before.map((row) => row.playerName));
  const afterNames = new Set(after.map((row) => row.playerName));
  return {
    status: "available",
    currentTop25BeforeMarketAnchor: before,
    top25AfterMarketAnchor: after,
    playersEnteringTop25: after.filter((row) => !beforeNames.has(row.playerName)).map((row) => row.playerName),
    playersLeavingTop25: before.filter((row) => !afterNames.has(row.playerName)).map((row) => row.playerName),
    topRecommendationChanged: before[0]?.playerName !== after[0]?.playerName,
    draftSignalTopChanged: "not_available_v1",
  };
}

function recommend(input: {
  movementCapRespected: boolean;
  skillPositionMovementWithinCap: boolean;
  unsupportedPositionsFiltered: boolean;
  riskGrade: "low" | "medium" | "high";
  reviewCandidates: number;
  unmatchedAdpRows: number;
}) {
  if (!input.movementCapRespected || !input.skillPositionMovementWithinCap) return "current_market_anchor_needs_tuning";
  if (!input.unsupportedPositionsFiltered) return "current_market_anchor_blocked";
  if (input.riskGrade === "high") return "current_market_anchor_needs_id_mapping";
  if (input.reviewCandidates > 5 || input.unmatchedAdpRows > 5) return "current_market_anchor_needs_manual_review";
  return "current_market_anchor_ready_for_feature_flag_preview";
}

function toReviewRow(player: CurrentSeasonAdpEnrichedPlayer): CurrentMarketAnchorReviewRow {
  return {
    playerName: player.playerName,
    position: player.position,
    team: player.team,
    originalBlackbirdRank: player.modelRank,
    marketAdp: player.adp,
    marketRank: player.marketRank,
    marketFormat: player.marketFormat,
    marketAnchorRank: player.marketAnchorRank,
    rankDelta: player.marketAnchorMovement,
    confidenceTrust: player.confidence ?? player.marketAnchorConfidenceBucket,
    activePolicy: player.policyGroup ?? player.activePolicyClass,
    matchType: player.externalMarketMatchConfidence,
    notes: player.externalMarketNotes,
  };
}

function topPosition(rows: CurrentMarketAnchorReviewRow[], position: string) {
  return [...rows].filter((row) => row.position === position).sort(byAbsMovementDesc).slice(0, 50);
}

function topConfidence(rows: CurrentMarketAnchorReviewRow[], buckets: string[]) {
  return [...rows].filter((row) => buckets.includes((row.confidenceTrust ?? "unknown").toLowerCase())).sort(byAbsMovementDesc).slice(0, 50);
}

function byAbsMovementDesc(a: CurrentMarketAnchorReviewRow, b: CurrentMarketAnchorReviewRow) {
  return Math.abs(b.rankDelta) - Math.abs(a.rankDelta) || a.playerName.localeCompare(b.playerName);
}

function summarizeMovement(rows: CurrentMarketAnchorReviewRow[], keyFor: (row: CurrentMarketAnchorReviewRow) => string) {
  const keys = [...new Set(rows.map(keyFor))].sort();
  return Object.fromEntries(keys.map((rowKey) => {
    const group = rows.filter((row) => keyFor(row) === rowKey);
    const moves = group.map((row) => Math.abs(row.rankDelta));
    return [rowKey, { players: group.length, averageMovement: round(average(moves)), maxMovement: round(Math.max(...moves, 0)) }];
  }));
}

function renderMarkdown(report: CurrentMarketAnchorReviewReport) {
  return `${[
    `# Current Market Anchor Review ${report.season}`,
    "",
    `- Recommendation: ${report.recommendation}`,
    `- Market format: ${report.marketFormat}`,
    `- Players with market ADP: ${report.movementQuality.playersWithMarketAdp}`,
    `- Average rank movement: ${report.movementQuality.averageRankMovement}`,
    `- Median rank movement: ${report.movementQuality.medianRankMovement}`,
    `- Max rank movement: ${report.movementQuality.maxRankMovement}`,
    `- Players moved up: ${report.movementQuality.playersMovedUp}`,
    `- Players moved down: ${report.movementQuality.playersMovedDown}`,
    `- Players unchanged: ${report.movementQuality.playersUnchanged}`,
    "",
    "## Match Quality",
    "",
    `- Exact ID matches: ${report.matchQualityAudit.exactIdMatches}`,
    `- Name/team/position matches: ${report.matchQualityAudit.nameTeamPositionMatches}`,
    `- Unique name/position matches: ${report.matchQualityAudit.uniqueNamePositionMatches}`,
    `- Review candidates: ${report.matchQualityAudit.reviewCandidates}`,
    `- Unmatched ADP rows: ${report.matchQualityAudit.unmatchedAdpRows}`,
    `- Risk grade: ${report.matchQualityAudit.matchQualityRiskGrade}`,
    ...report.matchQualityAudit.warnings.map((warning) => `- Warning: ${warning}`),
    "",
    "## Superflex Sanity",
    "",
    `- Elite QBs pulled upward: ${report.superflexSanity.eliteQbsPulledUpward}`,
    `- Non-Superflex PPR-only behavior not used: ${report.superflexSanity.nonSuperflexPprOnlyBehaviorNotUsed}`,
    `- QB market order differs materially from 1QB: ${report.superflexSanity.qbsHaveMateriallyDifferentMarketOrderThanOneQb}`,
    `- Skill position movement within cap: ${report.superflexSanity.skillPositionMovementWithinCap}`,
    `- Max movement cap respected: ${report.superflexSanity.maxMovementCapRespected}`,
    "",
    "## Roster Eligibility Safety",
    "",
    `- K rows present in ADP source: ${report.rosterEligibilitySafety.kRowsPresentInAdpSource}`,
    `- K rows filtered for no-K league: ${report.rosterEligibilitySafety.kRowsFilteredForNoKLeague}`,
    `- DST rows filtered if unsupported: ${report.rosterEligibilitySafety.dstRowsFilteredIfUnsupported}`,
    `- IDP rows filtered if unsupported: ${report.rosterEligibilitySafety.idpRowsFilteredIfUnsupported}`,
    `- Unsupported positions filtered: ${report.rosterEligibilitySafety.unsupportedPositionsFiltered.join(", ") || "none"}`,
    `- No unsupported positions in market-anchor draftable preview: ${report.rosterEligibilitySafety.noUnsupportedPositionsInMarketAnchorDraftablePreview}`,
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: CurrentMarketAnchorReviewReport) {
  const headers = ["table", "player_name", "position", "team", "original_blackbird_rank", "market_adp", "market_rank", "market_format", "market_anchor_rank", "rank_delta", "confidence_trust", "active_policy", "match_type", "notes"];
  const rows = [
    ...report.topMovementTables.top50MovedUp.map((row) => ["top_moved_up", ...csvRow(row)]),
    ...report.topMovementTables.top50MovedDown.map((row) => ["top_moved_down", ...csvRow(row)]),
    ...report.topMovementTables.top50QbMovement.map((row) => ["top_qb_movement", ...csvRow(row)]),
    ...report.topMovementTables.top50RbMovement.map((row) => ["top_rb_movement", ...csvRow(row)]),
    ...report.topMovementTables.top50WrMovement.map((row) => ["top_wr_movement", ...csvRow(row)]),
    ...report.topMovementTables.top50TeMovement.map((row) => ["top_te_movement", ...csvRow(row)]),
  ];
  return `${[headers, ...rows].map((row) => row.map(cell).join(",")).join("\n")}\n`;
}

function csvRow(row: CurrentMarketAnchorReviewRow) {
  return [
    row.playerName,
    row.position,
    row.team ?? "",
    String(row.originalBlackbirdRank ?? ""),
    String(row.marketAdp ?? ""),
    String(row.marketRank ?? ""),
    row.marketFormat,
    String(row.marketAnchorRank ?? ""),
    String(row.rankDelta),
    row.confidenceTrust ?? "",
    row.activePolicy ?? "",
    row.matchType ?? "",
    row.notes.join("|"),
  ];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function normalizeMarketFormat(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function cell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
