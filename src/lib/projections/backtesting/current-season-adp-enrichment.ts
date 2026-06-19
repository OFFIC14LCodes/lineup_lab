import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import { filterDraftEligiblePlayers } from "@/lib/draft/league-position-eligibility";

import type { HistoricalAdpNormalizedRow } from "./historical-adp-source-types";
import {
  MARKET_ANCHOR_CONFIDENCE_WEIGHTS,
  MARKET_ANCHOR_MOVEMENT_CAPS,
} from "./historical-market-anchor-rank";
import type { HistoricalMarketAnchorConfidenceBucket } from "./historical-market-anchor-rank-types";
import type {
  CurrentSeasonAdpEnrichedPlayer,
  CurrentSeasonAdpEnrichmentArtifactPaths,
  CurrentSeasonAdpEnrichmentReport,
  CurrentSeasonAdpMatch,
  CurrentSeasonAdpMatchMethod,
  CurrentSeasonUniversePlayer,
} from "./current-season-adp-enrichment-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const DEFAULT_VARIANT = "blackbird_availability_calibrated";
const NO_K_SUPERFLEX_ROSTER = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN", "BN"];

type CsvRow = Record<string, unknown>;

type SnapshotRow = {
  sleeperId?: string | null;
  gsisId?: string | null;
  playerName?: string | null;
  normalizedName?: string | null;
  position?: string | null;
  team?: string | null;
  projectedTotalPoints?: number | null;
  confidence?: string | null;
  confidenceScore?: number | null;
  variant?: string | null;
};

type ActivePolicyRow = {
  playerId?: string | null;
  sleeperId?: string | null;
  player?: string | null;
  playerName?: string | null;
  position?: string | null;
  projectionTeam?: string | null;
  team?: string | null;
  finalPolicyClass?: string | null;
  policyGroup?: string | null;
};

export function runCurrentSeasonAdpEnrichment(input: {
  season: number;
  marketFormat: string;
  adpPath?: string;
  snapshotPath?: string;
  activePolicyPath?: string;
  cwd?: string;
  generatedAt?: string;
}): CurrentSeasonAdpEnrichmentReport {
  const cwd = input.cwd ?? process.cwd();
  const adpPath = input.adpPath ?? path.join(OUTPUT_DIR, `historical-adp-${input.season}.normalized.csv`);
  const snapshotPath = input.snapshotPath ?? path.join(OUTPUT_DIR, `preseason-projection-snapshot-${input.season}.json`);
  const activePolicyPath = input.activePolicyPath ?? path.join(OUTPUT_DIR, `projection-active-policy-refresh-final-${input.season}.json`);
  const resolvedAdpPath = path.resolve(cwd, adpPath);
  const resolvedSnapshotPath = path.resolve(cwd, snapshotPath);
  const resolvedActivePolicyPath = path.resolve(cwd, activePolicyPath);
  const adpExists = existsSync(resolvedAdpPath);
  const snapshotExists = existsSync(resolvedSnapshotPath);
  const activePolicyExists = existsSync(resolvedActivePolicyPath);
  const adpRows = adpExists ? readAdpRows(resolvedAdpPath, input.season, input.marketFormat) : [];
  const universe = snapshotExists && activePolicyExists ? readCurrentUniverse(resolvedSnapshotPath, resolvedActivePolicyPath) : [];
  const matches = matchCurrentAdpRows(adpRows, universe);
  const enrichedUniverse = buildEnrichedUniverse(universe, matches, input.marketFormat);
  const eligible = filterDraftEligiblePlayers(enrichedUniverse, { rosterPositions: NO_K_SUPERFLEX_ROSTER });
  const movementPreview = buildMarketPreview(eligible.players, adpRows, eligible.filteredPositions, eligible.filteredCount);
  const matchedIds = matchedUniverseIds(matches);
  const exactIdMatches = matches.filter((match) => match.matchMethod.endsWith("_exact")).length;
  const nameTeamPositionMatches = matches.filter((match) => match.matchMethod === "name_position_team_unique").length;
  const uniqueNamePositionMatches = matches.filter((match) => match.matchMethod === "unique_name_position").length;
  const reviewCandidates = matches.filter((match) => match.confidence === "review").length;
  const unmatchedAdpRows = matches.filter((match) => match.matchMethod === "unmatched").length;
  const recommendation = universe.length === 0
    ? "current_adp_enrichment_needs_current_universe"
    : exactIdMatches + nameTeamPositionMatches + uniqueNamePositionMatches === 0
      ? "current_adp_enrichment_needs_identifier_mapping"
      : "current_adp_enrichment_ready_for_market_anchor_review";
  const kRowsExistInAdp = adpRows.some((row) => row.position === "K");

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    marketFormat: normalizeMarketFormat(input.marketFormat),
    recommendation,
    sourceArtifacts: { adpPath, snapshotPath, activePolicyPath },
    sourceDiscovery: { adpExists, snapshotExists, activePolicyExists, currentUniverseRows: universe.length },
    matchQuality: {
      currentUniverseRows: universe.length,
      adpRowsForSelectedMarketFormat: adpRows.length,
      exactIdMatches,
      nameTeamPositionMatches,
      uniqueNamePositionMatches,
      reviewCandidates,
      unmatchedAdpRows,
      universeRowsWithoutAdp: universe.filter((player) => !matchedIds.has(player.playerId)).length,
      coverageByPosition: summarizeCoverage(universe, matchedIds, (player) => player.position),
      coverageByActivePolicyGroup: summarizeCoverage(universe, matchedIds, (player) => player.policyGroup ?? "unknown"),
      coverageByConfidenceBucket: summarizeCoverage(universe, matchedIds, (player) => confidenceBucket(player)),
    },
    marketSanityPreview: movementPreview,
    warRoomSafetyPreview: {
      adpMarketSourceParsed: adpRows.length > 0,
      superflexMarketRowsAvailable: normalizeMarketFormat(input.marketFormat) === "SUPERFLEX" && adpRows.length > 0,
      kRowsExistInAdpSource: kRowsExistInAdp,
      kExcludedByRosterEligibilityWhenNoKSlot: !kRowsExistInAdp || !eligible.players.some((player) => player.position === "K"),
      dstIdpExcludedWhenUnsupported: !eligible.players.some((player) => ["DST", "DEF", "DL", "LB", "DB"].includes(player.position)),
      liveDraftSuggestionsUnchanged: true,
      liveBlackbirdRankUnchanged: true,
    },
    matches,
    enrichedUniverse,
    safetyGates: [
      gate("no_live_outputs_changed", true, "Current ADP enrichment writes local backtesting artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("live_rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("live_draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("adp_not_used_as_value", true, "ADP is used only as a market prior / sanity anchor preview."),
      gate("roster_eligibility_preserved", true, "Eligibility filtering is applied after market matching and ADP never enables positions."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeCurrentSeasonAdpEnrichmentArtifacts(
  report: CurrentSeasonAdpEnrichmentReport,
  cwd = process.cwd(),
): CurrentSeasonAdpEnrichmentArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const reportBase = `current-season-adp-enrichment-${report.season}`;
  const universeBase = `current-season-adp-enriched-universe-${report.season}`;
  const reportJsonPath = path.join(artifactDir, `${reportBase}.json`);
  const reportMarkdownPath = path.join(artifactDir, `${reportBase}.md`);
  const reportCsvPath = path.join(artifactDir, `${reportBase}.csv`);
  const enrichedJsonPath = path.join(artifactDir, `${universeBase}.json`);
  const enrichedCsvPath = path.join(artifactDir, `${universeBase}.csv`);
  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(reportMarkdownPath, renderMarkdown(report), "utf8");
  writeFileSync(reportCsvPath, renderMovementCsv(report), "utf8");
  writeFileSync(enrichedJsonPath, `${JSON.stringify({
    generatedAt: report.generatedAt,
    dryRun: true,
    readOnly: true,
    season: report.season,
    marketFormat: report.marketFormat,
    recommendation: report.recommendation,
    rows: report.enrichedUniverse,
    safetyGates: report.safetyGates,
  }, null, 2)}\n`, "utf8");
  writeFileSync(enrichedCsvPath, renderEnrichedCsv(report.enrichedUniverse), "utf8");
  return { reportJsonPath, reportMarkdownPath, reportCsvPath, enrichedJsonPath, enrichedCsvPath };
}

export function matchCurrentAdpRows(
  rows: HistoricalAdpNormalizedRow[],
  universe: CurrentSeasonUniversePlayer[],
): CurrentSeasonAdpMatch[] {
  const indexes = buildUniverseIndexes(universe);
  return rows.map((row) => {
    const exact = firstMatch([
      [row.playerId, indexes.byPlayerId, "player_id_exact" as const],
      [row.sleeperId, indexes.bySleeperId, "sleeper_id_exact" as const],
      [row.gsisId, indexes.byGsisId, "gsis_id_exact" as const],
    ]);
    if (exact) return toMatch(row, exact.player, exact.method, "exact", ["exact_id_match"]);

    const teamMatches = indexes.byNamePositionTeam.get(key(row.normalizedPlayerName, row.position, row.team)) ?? [];
    if (teamMatches.length === 1) return toMatch(row, teamMatches[0], "name_position_team_unique", "high", ["unique_name_position_team_match"]);
    if (teamMatches.length > 1) return toMatch(row, null, "review_candidate", "review", ["name_position_team_conflict"]);

    const namePositionMatches = indexes.byNamePosition.get(key(row.normalizedPlayerName, row.position)) ?? [];
    if (namePositionMatches.length === 1) return toMatch(row, namePositionMatches[0], "unique_name_position", "high", ["unique_name_position_without_team"]);
    if (namePositionMatches.length > 1) return toMatch(row, null, "review_candidate", "review", ["name_position_conflict"]);
    return toMatch(row, null, "unmatched", "none", ["no_current_universe_match"]);
  });
}

function readCurrentUniverse(snapshotPath: string, activePolicyPath: string): CurrentSeasonUniversePlayer[] {
  const snapshotRows = readJson<{ rows?: SnapshotRow[] }>(snapshotPath).rows ?? [];
  const activeRows = readJson<{ rows?: ActivePolicyRow[] }>(activePolicyPath).rows ?? [];
  const preferredSnapshotRows = snapshotRows.filter((row) => row.variant === DEFAULT_VARIANT);
  const snapshotBySleeper = new Map(preferredSnapshotRows.map((row) => [stringField(row.sleeperId), row]));
  const players = activeRows.map((row) => {
    const snapshot = snapshotBySleeper.get(stringField(row.playerId)) ?? snapshotBySleeper.get(stringField(row.sleeperId)) ?? null;
    const playerName = stringField(row.player) ?? stringField(row.playerName) ?? stringField(snapshot?.playerName) ?? "";
    const position = normalizePosition(stringField(row.position) ?? stringField(snapshot?.position));
    const team = normalizeTeam(stringField(row.projectionTeam) ?? stringField(row.team) ?? stringField(snapshot?.team));
    return {
      playerId: stringField(row.playerId) ?? stringField(snapshot?.sleeperId) ?? "",
      sleeperId: stringField(row.sleeperId) ?? stringField(snapshot?.sleeperId) ?? stringField(row.playerId),
      gsisId: stringField(snapshot?.gsisId),
      playerName,
      normalizedPlayerName: normalizeName(playerName),
      position,
      team,
      projectedPoints: numberField(snapshot?.projectedTotalPoints),
      modelRank: null,
      confidence: stringField(snapshot?.confidence),
      confidenceScore: numberField(snapshot?.confidenceScore),
      policyGroup: stringField(row.policyGroup),
      activePolicyClass: stringField(row.finalPolicyClass),
      sourceVariant: stringField(snapshot?.variant),
    };
  }).filter((player) => player.playerId && player.playerName && player.position);

  const ranked = [...players].sort((a, b) => (b.projectedPoints ?? -Infinity) - (a.projectedPoints ?? -Infinity) || a.playerName.localeCompare(b.playerName));
  const rankByPlayerId = new Map(ranked.map((player, index) => [player.playerId, index + 1]));
  return players.map((player) => ({ ...player, modelRank: rankByPlayerId.get(player.playerId) ?? null }));
}

function readAdpRows(filePath: string, season: number, marketFormat: string): HistoricalAdpNormalizedRow[] {
  const parsed = Papa.parse<CsvRow>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(`Current ADP CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data.map((row, index) => normalizeAdpRow(row, season, index + 2))
    .filter((row): row is HistoricalAdpNormalizedRow => Boolean(row))
    .filter((row) => !row.scoringFormat || normalizeMarketFormat(row.scoringFormat) === normalizeMarketFormat(marketFormat));
}

function normalizeAdpRow(row: CsvRow, season: number, rowNumber: number): HistoricalAdpNormalizedRow | null {
  const playerName = stringField(row.player_name);
  const position = normalizePosition(stringField(row.position));
  const rank = numberField(row.rank) ?? numberField(row.adp);
  if (!playerName || !position || rank === null || rank <= 0) return null;
  return {
    season,
    source: stringField(row.source) ?? "unknown",
    asOfDate: stringField(row.as_of_date),
    scoringFormat: stringField(row.scoring_format),
    playerName,
    normalizedPlayerName: normalizeName(playerName),
    position,
    team: normalizeTeam(stringField(row.team)),
    adp: numberField(row.adp),
    rank,
    sleeperId: stringField(row.sleeper_id),
    gsisId: stringField(row.gsis_id),
    playerId: stringField(row.player_id),
    notes: [`source_row:${rowNumber}`],
  };
}

function buildEnrichedUniverse(
  universe: CurrentSeasonUniversePlayer[],
  matches: CurrentSeasonAdpMatch[],
  marketFormat: string,
): CurrentSeasonAdpEnrichedPlayer[] {
  const attachable = new Map(matches
    .filter((match) => match.universePlayerId && match.matchMethod !== "review_candidate")
    .map((match) => [match.universePlayerId, match]));
  return universe.map((player) => {
    const match = attachable.get(player.playerId);
    const withMarket = {
      ...player,
      adp: match?.adpRow.adp ?? null,
      marketRank: match?.adpRow.rank ?? null,
      marketFormat: normalizeMarketFormat(marketFormat),
      externalMarketSource: match?.adpRow.source ?? null,
      externalMarketMatchConfidence: match?.confidence ?? null,
      externalMarketNotes: match?.notes ?? ["external_market_unmatched"],
      marketAnchorRank: null,
      marketAnchorMovement: 0,
      marketAnchorConfidenceBucket: confidenceBucket(player),
    };
    return applyMarketAnchor(withMarket);
  });
}

function applyMarketAnchor(player: CurrentSeasonAdpEnrichedPlayer): CurrentSeasonAdpEnrichedPlayer {
  const modelRank = player.modelRank;
  const marketRank = player.marketRank;
  const bucket = player.marketAnchorConfidenceBucket;
  const weights = MARKET_ANCHOR_CONFIDENCE_WEIGHTS[bucket];
  const cap = MARKET_ANCHOR_MOVEMENT_CAPS.default;
  const marketAnchorRank = modelRank === null
    ? marketRank
    : marketRank === null
      ? modelRank
      : roundRank(modelRank + clamp((modelRank * weights.modelWeight + marketRank * weights.marketWeight) - modelRank, -cap, cap));
  return {
    ...player,
    marketAnchorRank,
    marketAnchorMovement: modelRank !== null && marketAnchorRank !== null ? round(marketAnchorRank - modelRank) : 0,
  };
}

function buildMarketPreview(
  eligiblePlayers: CurrentSeasonAdpEnrichedPlayer[],
  adpRows: HistoricalAdpNormalizedRow[],
  unsupportedPositionsFiltered: string[],
  unsupportedPlayersFiltered: number,
): CurrentSeasonAdpEnrichmentReport["marketSanityPreview"] {
  const rows = eligiblePlayers
    .filter((player) => player.marketRank !== null && player.modelRank !== null && player.marketAnchorRank !== null)
    .map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      team: player.team,
      modelRank: player.modelRank,
      marketRank: player.marketRank,
      marketAnchorRank: player.marketAnchorRank,
      movement: player.marketAnchorMovement,
      confidenceBucket: player.marketAnchorConfidenceBucket,
      policyGroup: player.policyGroup,
    }));
  const moves = rows.map((row) => Math.abs(row.movement));
  return {
    playersWithMarketAdp: eligiblePlayers.filter((player) => player.marketRank !== null).length,
    playersWithoutMarketAdp: eligiblePlayers.filter((player) => player.marketRank === null).length,
    averageRankMovement: round(average(moves)),
    maxRankMovement: round(Math.max(...moves, 0)),
    top25MovedUp: [...rows].filter((row) => row.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 25),
    top25MovedDown: [...rows].filter((row) => row.movement > 0).sort((a, b) => b.movement - a.movement).slice(0, 25),
    movementByPosition: summarizeMovement(rows, (row) => row.position),
    movementByConfidenceBucket: summarizeMovement(rows, (row) => row.confidenceBucket),
    movementByActivePolicyGroup: summarizeMovement(rows, (row) => row.policyGroup ?? "unknown"),
    unsupportedPositionsFiltered,
    unsupportedPlayersFiltered,
    kRowsPresentInAdp: adpRows.some((row) => row.position === "K"),
    kExcludedByNoKLeague: !eligiblePlayers.some((player) => player.position === "K"),
  };
}

function buildUniverseIndexes(players: CurrentSeasonUniversePlayer[]) {
  return {
    byPlayerId: mapOne(players, (player) => player.playerId),
    bySleeperId: mapOne(players, (player) => player.sleeperId),
    byGsisId: mapOne(players, (player) => player.gsisId),
    byNamePositionTeam: mapMany(players, (player) => key(player.normalizedPlayerName, player.position, player.team)),
    byNamePosition: mapMany(players, (player) => key(player.normalizedPlayerName, player.position)),
  };
}

function firstMatch(items: Array<[string | null, Map<string, CurrentSeasonUniversePlayer>, Extract<CurrentSeasonAdpMatchMethod, "player_id_exact" | "sleeper_id_exact" | "gsis_id_exact">]>) {
  for (const [value, index, method] of items) {
    if (!value) continue;
    const player = index.get(value);
    if (player) return { player, method };
  }
  return null;
}

function toMatch(
  row: HistoricalAdpNormalizedRow,
  player: CurrentSeasonUniversePlayer | null,
  method: CurrentSeasonAdpMatchMethod,
  confidence: CurrentSeasonAdpMatch["confidence"],
  notes: string[],
): CurrentSeasonAdpMatch {
  return { adpRow: row, universePlayerId: player?.playerId ?? null, universePlayerName: player?.playerName ?? null, matchMethod: method, confidence, notes };
}

function matchedUniverseIds(matches: CurrentSeasonAdpMatch[]) {
  return new Set(matches
    .filter((match) => match.universePlayerId && match.matchMethod !== "review_candidate")
    .map((match) => match.universePlayerId)
    .filter((playerId): playerId is string => Boolean(playerId)));
}

function summarizeCoverage<T extends CurrentSeasonUniversePlayer>(players: T[], matchedIds: Set<string>, keyFor: (player: T) => string) {
  const keys = [...new Set(players.map(keyFor))].sort();
  return Object.fromEntries(keys.map((rowKey) => {
    const group = players.filter((player) => keyFor(player) === rowKey);
    const matchedRows = group.filter((player) => matchedIds.has(player.playerId)).length;
    return [rowKey, { universeRows: group.length, matchedRows, coverageRate: group.length ? round(matchedRows / group.length) : 0 }];
  }));
}

function summarizeMovement<T extends { movement: number }>(rows: T[], keyFor: (row: T) => string) {
  const keys = [...new Set(rows.map(keyFor))].sort();
  return Object.fromEntries(keys.map((rowKey) => {
    const group = rows.filter((row) => keyFor(row) === rowKey);
    const moves = group.map((row) => Math.abs(row.movement));
    return [rowKey, { players: group.length, averageMovement: round(average(moves)), maxMovement: round(Math.max(...moves, 0)) }];
  }));
}

function confidenceBucket(player: Pick<CurrentSeasonUniversePlayer, "confidence" | "confidenceScore" | "projectedPoints" | "modelRank">): HistoricalMarketAnchorConfidenceBucket {
  const confidence = player.confidence?.toLowerCase() ?? "";
  if (["high", "very_high", "verified", "strong"].includes(confidence)) return "high";
  if (["medium", "moderate"].includes(confidence)) return "medium";
  if (["low", "very_low", "weak"].includes(confidence)) return "low";
  if (typeof player.confidenceScore === "number" && Number.isFinite(player.confidenceScore)) {
    if (player.confidenceScore >= 80) return "high";
    if (player.confidenceScore >= 55) return "medium";
    if (player.confidenceScore > 0) return "low";
  }
  if (player.projectedPoints !== null && player.modelRank !== null) return "medium";
  return "unknown";
}

function renderMarkdown(report: CurrentSeasonAdpEnrichmentReport) {
  return `${[
    `# Current Season ADP Enrichment ${report.season}`,
    "",
    `- Recommendation: ${report.recommendation}`,
    `- Market format: ${report.marketFormat}`,
    `- Current universe rows: ${report.matchQuality.currentUniverseRows}`,
    `- ADP rows for selected format: ${report.matchQuality.adpRowsForSelectedMarketFormat}`,
    `- Exact ID matches: ${report.matchQuality.exactIdMatches}`,
    `- Name/team/position matches: ${report.matchQuality.nameTeamPositionMatches}`,
    `- Unique name/position matches: ${report.matchQuality.uniqueNamePositionMatches}`,
    `- Review candidates: ${report.matchQuality.reviewCandidates}`,
    `- Unmatched ADP rows: ${report.matchQuality.unmatchedAdpRows}`,
    `- Universe rows without ADP: ${report.matchQuality.universeRowsWithoutAdp}`,
    "",
    "## Market Sanity Preview",
    "",
    `- Players with market ADP: ${report.marketSanityPreview.playersWithMarketAdp}`,
    `- Players without market ADP: ${report.marketSanityPreview.playersWithoutMarketAdp}`,
    `- Average rank movement: ${report.marketSanityPreview.averageRankMovement}`,
    `- Max rank movement: ${report.marketSanityPreview.maxRankMovement}`,
    `- Unsupported positions filtered: ${report.marketSanityPreview.unsupportedPositionsFiltered.join(", ") || "none"}`,
    `- K rows present in ADP: ${report.marketSanityPreview.kRowsPresentInAdp}`,
    `- K excluded by no-K league: ${report.marketSanityPreview.kExcludedByNoKLeague}`,
    "",
    "## War Room Safety Preview",
    "",
    `- ADP market source parsed: ${report.warRoomSafetyPreview.adpMarketSourceParsed}`,
    `- Superflex market rows available: ${report.warRoomSafetyPreview.superflexMarketRowsAvailable}`,
    `- K rows exist in ADP source: ${report.warRoomSafetyPreview.kRowsExistInAdpSource}`,
    `- K excluded by roster eligibility when no K slot: ${report.warRoomSafetyPreview.kExcludedByRosterEligibilityWhenNoKSlot}`,
    `- DST/IDP excluded when unsupported: ${report.warRoomSafetyPreview.dstIdpExcludedWhenUnsupported}`,
    `- Live Draft Suggestions unchanged: ${report.warRoomSafetyPreview.liveDraftSuggestionsUnchanged}`,
    `- Live Blackbird Rank unchanged: ${report.warRoomSafetyPreview.liveBlackbirdRankUnchanged}`,
    "",
    "## Safety Gates",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed}`),
    "",
  ].join("\n")}\n`;
}

function renderMovementCsv(report: CurrentSeasonAdpEnrichmentReport) {
  const headers = ["direction", "player_id", "player_name", "position", "team", "model_rank", "market_rank", "market_anchor_rank", "movement", "confidence_bucket", "policy_group"];
  const rows = [
    ...report.marketSanityPreview.top25MovedUp.map((row) => ["up", ...movementCsvRow(row)]),
    ...report.marketSanityPreview.top25MovedDown.map((row) => ["down", ...movementCsvRow(row)]),
  ];
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function movementCsvRow(row: CurrentSeasonAdpEnrichmentReport["marketSanityPreview"]["top25MovedUp"][number]) {
  return [
    row.playerId,
    row.playerName,
    row.position,
    row.team ?? "",
    String(row.modelRank ?? ""),
    String(row.marketRank ?? ""),
    String(row.marketAnchorRank ?? ""),
    String(row.movement),
    row.confidenceBucket,
    row.policyGroup ?? "",
  ];
}

function renderEnrichedCsv(rows: CurrentSeasonAdpEnrichedPlayer[]) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player_name", "position", "team", "projected_points", "model_rank", "adp", "market_rank", "market_format", "market_anchor_rank", "market_anchor_movement", "confidence", "confidence_bucket", "policy_group", "match_confidence", "market_notes"];
  return `${[headers, ...rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.playerName,
    row.position,
    row.team ?? "",
    String(row.projectedPoints ?? ""),
    String(row.modelRank ?? ""),
    String(row.adp ?? ""),
    String(row.marketRank ?? ""),
    row.marketFormat,
    String(row.marketAnchorRank ?? ""),
    String(row.marketAnchorMovement),
    row.confidence ?? "",
    row.marketAnchorConfidenceBucket,
    row.policyGroup ?? "",
    row.externalMarketMatchConfidence ?? "",
    row.externalMarketNotes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function mapOne(players: CurrentSeasonUniversePlayer[], keyFor: (player: CurrentSeasonUniversePlayer) => string | null) {
  const index = new Map<string, CurrentSeasonUniversePlayer>();
  for (const player of players) {
    const value = keyFor(player);
    if (value && !index.has(value)) index.set(value, player);
  }
  return index;
}

function mapMany(players: CurrentSeasonUniversePlayer[], keyFor: (player: CurrentSeasonUniversePlayer) => string) {
  const index = new Map<string, CurrentSeasonUniversePlayer[]>();
  for (const player of players) {
    const rowKey = keyFor(player);
    index.set(rowKey, [...(index.get(rowKey) ?? []), player]);
  }
  return index;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function normalizeMarketFormat(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizePosition(value: string | null | undefined) {
  const upper = (value ?? "").trim().toUpperCase();
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  return upper;
}

function normalizeTeam(value: string | null | undefined) {
  const upper = (value ?? "").trim().toUpperCase();
  return upper || null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() || null : value == null ? null : String(value).trim() || null;
}

function numberField(value: unknown) {
  const text = stringField(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function key(...parts: Array<string | null>) {
  return parts.map((part) => part ?? "").join("|");
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

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
