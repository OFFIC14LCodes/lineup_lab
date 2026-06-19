import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import type { HistoricalMockDraftPlayer } from "./historical-mock-draft-engine-types";
import type {
  HistoricalAdpCoverageReport,
  HistoricalAdpEnrichedUniversePlayer,
  HistoricalAdpMatchMethod,
  HistoricalAdpNormalizedRow,
  HistoricalAdpSourceArtifactPaths,
  HistoricalAdpSourceRecommendation,
  HistoricalAdpSourceReport,
  HistoricalAdpUniverseMatch,
} from "./historical-adp-source-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const REQUIRED_HEADERS = ["season", "source", "as_of_date", "player_name", "position", "team", "adp", "rank", "sleeper_id", "gsis_id", "player_id", "notes"];

type CsvRow = Record<string, unknown>;

export function normalizeHistoricalAdpSource(input: {
  season: number;
  inputPath: string;
  universePath?: string;
  marketFormat?: string;
  cwd?: string;
  generatedAt?: string;
}): HistoricalAdpSourceReport {
  const cwd = input.cwd ?? process.cwd();
  const universePath = input.universePath ?? path.join(OUTPUT_DIR, `historical-draft-universe-${input.season}.json`);
  const resolvedUniversePath = path.resolve(cwd, universePath);
  const universeExists = existsSync(resolvedUniversePath);
  const sourceRows = filterRowsByMarketFormat(readCsvRows(path.resolve(cwd, input.inputPath)), input.marketFormat);
  const parsed = normalizeRows(sourceRows, input.season);
  const deduped = dedupeRows(parsed.validRows);
  const universePlayers = universeExists ? readUniversePlayers(resolvedUniversePath) : [];
  const usableUniversePlayers = universePlayers.filter(isUsableUniversePlayer);
  const matches = matchAdpRowsToUniverse(deduped.rows, usableUniversePlayers);
  const enrichedUniversePlayers = enrichUniversePlayers(usableUniversePlayers, matches);
  const coverage = buildCoverage({
    sourceRows: sourceRows.length,
    normalizedRows: deduped.rows.length,
    invalidRows: parsed.invalidRows.length,
    duplicateRowsRemoved: deduped.duplicateRowsRemoved,
    conflictRows: deduped.conflicts.length,
    universeExists,
    universeRows: universePlayers.length,
    universePlayers: usableUniversePlayers,
    matches,
    enrichedUniversePlayers,
  });
  const recommendation = recommend(input.inputPath, coverage, universeExists);
  const asOfDates = [...new Set(deduped.rows.map((row) => row.asOfDate).filter((date): date is string => Boolean(date)))].sort();

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    inputPath: input.inputPath,
    universePath,
    universeExists,
    universeRows: universePlayers.length,
    universeUsableRows: usableUniversePlayers.length,
    adpRows: sourceRows.length,
    normalizedAdpRows: deduped.rows.length,
    recommendation,
    normalizedRows: deduped.rows,
    invalidRows: parsed.invalidRows,
    duplicateRowsRemoved: deduped.duplicateRowsRemoved,
    conflictRows: deduped.conflicts,
    matches,
    enrichedUniversePlayers,
    coverage,
    dataLeakageGuard: {
      asOfDates,
      sourceIsPreseasonHistorical: asOfDates.every((date) => isPreseasonDate(date, input.season)),
      adpNotGeneratedFromActualSeasonOutcomes: true,
      actualWeeklyOutcomesNotUsedInMatching: true,
      adpUsedOnlyInDraftSimulation: true,
    },
    safetyGates: [
      gate("no_live_outputs_changed", true, "Normalizer reads local CSV/universe artifacts and writes local backtesting artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("live_rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("live_draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("adp_not_used_as_value", true, "ADP/rank are normalized as market prior fields only."),
      gate("market_anchor_backtest_only", true, "External market fields are written only to historical backtesting artifacts."),
      gate("roster_eligibility_preserved", true, "Enrichment does not alter player positions or roster eligibility."),
      gate("historical_backtest_no_future_leakage", true, "No actual weekly or final season outcomes are read."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeHistoricalAdpSourceArtifacts(
  report: HistoricalAdpSourceReport,
  cwd = process.cwd(),
): HistoricalAdpSourceArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const normalizedBase = `historical-adp-${report.season}.normalized`;
  const enrichedBase = `historical-draft-universe-${report.season}.market-enriched`;
  const normalizedJsonPath = path.join(artifactDir, `${normalizedBase}.json`);
  const normalizedMarkdownPath = path.join(artifactDir, `${normalizedBase}.md`);
  const normalizedCsvPath = path.join(artifactDir, `${normalizedBase}.csv`);
  const enrichedJsonPath = path.join(artifactDir, `${enrichedBase}.json`);
  const enrichedMarkdownPath = path.join(artifactDir, `${enrichedBase}.md`);
  const enrichedCsvPath = path.join(artifactDir, `${enrichedBase}.csv`);

  writeFileSync(normalizedJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(normalizedMarkdownPath, renderNormalizedMarkdown(report), "utf8");
  writeFileSync(normalizedCsvPath, renderNormalizedCsv(report.normalizedRows), "utf8");
  writeFileSync(enrichedJsonPath, `${JSON.stringify({
    generatedAt: report.generatedAt,
    dryRun: true,
    readOnly: true,
    season: report.season,
    recommendation: report.recommendation,
    source: "historical_adp_source",
    universePath: report.universePath,
    universeExists: report.universeExists,
    universeRows: report.universeRows,
    universeUsableRows: report.universeUsableRows,
    adpRows: report.adpRows,
    normalizedAdpRows: report.normalizedAdpRows,
    coverage: report.coverage,
    playerUniverseInput: { players: report.enrichedUniversePlayers },
    h36PlayerUniverse: report.enrichedUniversePlayers,
    rows: report.enrichedUniversePlayers,
    dataLeakageGuard: report.dataLeakageGuard,
    safetyGates: report.safetyGates,
  }, null, 2)}\n`, "utf8");
  writeFileSync(enrichedMarkdownPath, renderEnrichedMarkdown(report), "utf8");
  writeFileSync(enrichedCsvPath, renderEnrichedCsv(report.enrichedUniversePlayers), "utf8");

  return { normalizedJsonPath, normalizedMarkdownPath, normalizedCsvPath, enrichedJsonPath, enrichedMarkdownPath, enrichedCsvPath };
}

export function normalizeHistoricalAdpCsvRow(row: CsvRow, season: number, rowNumber = 0): { row: HistoricalAdpNormalizedRow | null; error: string | null } {
  const rowSeason = numberField(row.season);
  if (rowSeason !== null && rowSeason !== season) return { row: null, error: `season ${rowSeason} does not match ${season}` };
  const playerName = stringField(row.player_name);
  const position = normalizePosition(stringField(row.position));
  if (!playerName) return { row: null, error: "player_name is required" };
  if (!position) return { row: null, error: "position is required" };
  const adp = numberField(row.adp);
  const rank = numberField(row.rank) ?? adp;
  if (adp !== null && adp <= 0) return { row: null, error: "adp must be a positive number" };
  if (rank === null || rank <= 0) return { row: null, error: "rank or adp must be a positive number" };
  const asOfDate = stringField(row.as_of_date);
  if (asOfDate && Number.isNaN(Date.parse(asOfDate))) return { row: null, error: "as_of_date must be parseable" };
  return {
    error: null,
    row: {
      season,
      source: stringField(row.source) || "unknown",
      asOfDate,
      scoringFormat: stringField(row.scoring_format),
      playerName,
      normalizedPlayerName: normalizeName(playerName),
      position,
      team: normalizeTeam(stringField(row.team)),
      adp,
      rank: round(rank),
      sleeperId: stringField(row.sleeper_id),
      gsisId: stringField(row.gsis_id),
      playerId: stringField(row.player_id),
      notes: splitNotes(stringField(row.notes)).concat(rowNumber ? [`source_row:${rowNumber}`] : []),
    },
  };
}

export function matchAdpRowsToUniverse(
  rows: HistoricalAdpNormalizedRow[],
  universePlayers: HistoricalMockDraftPlayer[],
): HistoricalAdpUniverseMatch[] {
  const indexes = buildUniverseIndexes(universePlayers);
  return rows.map((row) => {
    const exact = firstMatch([
      [row.playerId, indexes.byPlayerId, "player_id_exact" as const],
      [row.sleeperId, indexes.bySleeperId, "sleeper_id_exact" as const],
      [row.gsisId, indexes.byGsisId, "gsis_id_exact" as const],
    ]);
    if (exact) return toMatch(row, exact.player, exact.method, "exact", ["exact_id_match"]);

    const teamKey = key(row.normalizedPlayerName, row.position, row.team);
    const teamMatches = indexes.byNamePositionTeam.get(teamKey) ?? [];
    if (teamMatches.length === 1) return toMatch(row, teamMatches[0], "name_position_team_unique", "high", ["unique_name_position_team_match"]);
    if (teamMatches.length > 1) return reviewMatch(row, "name_position_team_conflict");

    const namePositionMatches = indexes.byNamePosition.get(key(row.normalizedPlayerName, row.position)) ?? [];
    if (namePositionMatches.length === 1) return toMatch(row, namePositionMatches[0], "name_position_review_candidate", "review", ["unique_name_position_without_team_review"]);
    if (namePositionMatches.length > 1) return reviewMatch(row, "name_position_conflict");
    return toMatch(row, null, "unmatched", "none", ["no_universe_match"]);
  });
}

function normalizeRows(sourceRows: CsvRow[], season: number) {
  const validRows: HistoricalAdpNormalizedRow[] = [];
  const invalidRows: HistoricalAdpSourceReport["invalidRows"] = [];
  sourceRows.forEach((row, index) => {
    const result = normalizeHistoricalAdpCsvRow(row, season, index + 2);
    if (result.row) validRows.push(result.row);
    else invalidRows.push({ rowNumber: index + 2, reason: result.error ?? "invalid_row", row });
  });
  return { validRows, invalidRows };
}

function dedupeRows(rows: HistoricalAdpNormalizedRow[]) {
  const byKey = new Map<string, HistoricalAdpNormalizedRow[]>();
  for (const row of rows) {
    const rowKey = row.playerId || row.sleeperId || row.gsisId || key(row.normalizedPlayerName, row.position, row.team);
    byKey.set(rowKey, [...(byKey.get(rowKey) ?? []), row]);
  }
  const deduped: HistoricalAdpNormalizedRow[] = [];
  const conflicts: HistoricalAdpSourceReport["conflictRows"] = [];
  let duplicateRowsRemoved = 0;
  for (const [rowKey, group] of byKey) {
    const uniqueRanks = new Set(group.map((row) => `${row.rank}|${row.adp ?? ""}|${row.source}|${row.asOfDate ?? ""}`));
    if (uniqueRanks.size > 1) {
      conflicts.push({ key: rowKey, rows: group, reason: "same player has conflicting ADP/rank/source rows" });
      deduped.push({ ...group[0], notes: [...group[0].notes, "conflict_kept_first"] });
      duplicateRowsRemoved += group.length - 1;
    } else {
      deduped.push(group[0]);
      duplicateRowsRemoved += group.length - 1;
    }
  }
  return { rows: deduped.sort((a, b) => a.rank - b.rank || a.playerName.localeCompare(b.playerName)), duplicateRowsRemoved, conflicts };
}

function enrichUniversePlayers(
  universePlayers: HistoricalMockDraftPlayer[],
  matches: HistoricalAdpUniverseMatch[],
): HistoricalAdpEnrichedUniversePlayer[] {
  const attachable = new Map(matches
    .filter((match) => match.universePlayerId && match.confidence !== "review")
    .map((match) => [match.universePlayerId, match]));
  return universePlayers.map((player) => {
    const match = attachable.get(player.playerId);
    return {
      ...player,
      adpRank: match?.adpRow.rank ?? player.adpRank ?? null,
      marketRank: match?.adpRow.rank ?? player.marketRank ?? null,
      adp: match?.adpRow.adp ?? player.adpRank ?? null,
      external_market_rank: match?.adpRow.rank ?? null,
      external_market_source: match?.adpRow.source ?? null,
      external_market_match_confidence: match?.confidence ?? null,
      external_market_notes: match ? match.notes : ["external_market_unmatched"],
      externalMarketSource: match?.adpRow.source ?? null,
      externalMarketMatchConfidence: match?.confidence ?? null,
      externalMarketNotes: match ? match.notes : ["external_market_unmatched"],
    };
  });
}

function buildCoverage(input: {
  sourceRows: number;
  normalizedRows: number;
  invalidRows: number;
  duplicateRowsRemoved: number;
  conflictRows: number;
  universeExists: boolean;
  universeRows: number;
  universePlayers: HistoricalMockDraftPlayer[];
  matches: HistoricalAdpUniverseMatch[];
  enrichedUniversePlayers: HistoricalAdpEnrichedUniversePlayer[];
}): HistoricalAdpCoverageReport {
  const matchedIds = new Set(input.matches
    .filter((match) => match.universePlayerId && match.confidence !== "review")
    .map((match) => match.universePlayerId)
    .filter((playerId): playerId is string => Boolean(playerId)));
  return {
    adpSourceRows: input.sourceRows,
    normalizedRows: input.normalizedRows,
    invalidRows: input.invalidRows,
    duplicateRowsRemoved: input.duplicateRowsRemoved,
    conflictRows: input.conflictRows,
    universeExists: input.universeExists,
    universeRows: input.universeRows,
    universeUsableRows: input.universePlayers.length,
    matchedByExactId: input.matches.filter((match) => match.matchMethod.endsWith("_exact")).length,
    matchedByNameTeamPosition: input.matches.filter((match) => match.matchMethod === "name_position_team_unique").length,
    reviewCandidates: input.matches.filter((match) => match.confidence === "review").length,
    unmatchedAdpRows: input.matches.filter((match) => match.matchMethod === "unmatched").length,
    universeRowsWithoutAdp: input.universePlayers.filter((player) => !matchedIds.has(player.playerId)).length,
    coverageByPosition: summarizeCoverage(input.universePlayers, matchedIds, (player) => normalizePosition(player.position)),
    coverageByRankBucket: summarizeCoverage(input.universePlayers, matchedIds, (player) => rankBucket(player.blackbirdRank ?? player.internalDraftRank ?? player.projectionRank ?? null)),
  };
}

function readCsvRows(filePath: string): CsvRow[] {
  if (!existsSync(filePath)) throw new Error(`Historical ADP CSV not found: ${filePath}`);
  const parsed = Papa.parse<CsvRow>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(`Historical ADP CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Historical ADP CSV missing headers: ${missing.join(", ")}`);
  return parsed.data;
}

function filterRowsByMarketFormat(rows: CsvRow[], marketFormat: string | undefined) {
  if (!marketFormat) return rows;
  const expected = normalizeMarketFormat(marketFormat);
  return rows.filter((row) => {
    const value = stringField(row.scoring_format);
    return !value || normalizeMarketFormat(value) === expected;
  });
}

function readUniversePlayers(filePath: string): HistoricalMockDraftPlayer[] {
  if (!existsSync(filePath)) return [];
  const artifact = JSON.parse(readFileSync(filePath, "utf8")) as {
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
    }>;
  };
  if (artifact.playerUniverseInput?.players?.length) return artifact.playerUniverseInput.players;
  if (artifact.h36PlayerUniverse?.length) return artifact.h36PlayerUniverse;
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
  })) ?? [];
}

function buildUniverseIndexes(players: HistoricalMockDraftPlayer[]) {
  return {
    byPlayerId: mapOne(players, (player) => player.playerId),
    bySleeperId: mapOne(players, (player) => player.sleeperId ?? null),
    byGsisId: mapOne(players, (player) => player.gsisId ?? null),
    byNamePositionTeam: mapMany(players, (player) => key(normalizeName(player.playerName), normalizePosition(player.position), normalizeTeam(player.nflTeam ?? null))),
    byNamePosition: mapMany(players, (player) => key(normalizeName(player.playerName), normalizePosition(player.position))),
  };
}

function firstMatch(items: Array<[string | null, Map<string, HistoricalMockDraftPlayer>, Extract<HistoricalAdpMatchMethod, "player_id_exact" | "sleeper_id_exact" | "gsis_id_exact">]>) {
  for (const [value, index, method] of items) {
    if (!value) continue;
    const player = index.get(value);
    if (player) return { player, method };
  }
  return null;
}

function toMatch(
  row: HistoricalAdpNormalizedRow,
  player: HistoricalMockDraftPlayer | null,
  method: HistoricalAdpMatchMethod,
  confidence: HistoricalAdpUniverseMatch["confidence"],
  notes: string[],
): HistoricalAdpUniverseMatch {
  return { adpRow: row, universePlayerId: player?.playerId ?? null, universePlayerName: player?.playerName ?? null, matchMethod: method, confidence, notes };
}

function reviewMatch(row: HistoricalAdpNormalizedRow, note: string) {
  return toMatch(row, null, "name_position_review_candidate", "review", [note]);
}

function recommend(inputPath: string, coverage: HistoricalAdpCoverageReport, universeExists: boolean): HistoricalAdpSourceRecommendation {
  if (inputPath.endsWith(".template.csv") || coverage.adpSourceRows === 0 || coverage.normalizedRows === 0) return "historical_adp_source_needs_real_csv";
  if (!universeExists || coverage.universeUsableRows === 0) return "historical_adp_source_needs_historical_universe";
  if (coverage.matchedByExactId + coverage.matchedByNameTeamPosition === 0 || coverage.reviewCandidates > coverage.normalizedRows / 2) return "historical_adp_source_needs_identifier_mapping";
  return "historical_adp_source_ready_for_market_anchor_retest";
}

function summarizeCoverage(players: HistoricalMockDraftPlayer[], matchedIds: Set<string>, keyFor: (player: HistoricalMockDraftPlayer) => string) {
  const keys = [...new Set(players.map(keyFor))].sort();
  return Object.fromEntries(keys.map((rowKey) => {
    const group = players.filter((player) => keyFor(player) === rowKey);
    const matchedRows = group.filter((player) => matchedIds.has(player.playerId)).length;
    return [rowKey, { universeRows: group.length, matchedRows, coverageRate: group.length ? round(matchedRows / group.length) : 0 }];
  }));
}

function rankBucket(rank: number | null) {
  if (rank === null) return "unknown";
  if (rank <= 50) return "001-050";
  if (rank <= 100) return "051-100";
  if (rank <= 150) return "101-150";
  if (rank <= 200) return "151-200";
  return "201+";
}

function renderNormalizedMarkdown(report: HistoricalAdpSourceReport) {
  const universeIssue = report.recommendation === "historical_adp_source_needs_historical_universe"
    ? [
      "",
      "## Universe Availability",
      "",
      "ADP source parsed successfully, but no historical draft universe exists for this season. Build the historical draft universe before expecting ADP matches.",
    ]
    : [];
  return `${[
    `# Historical ADP Source ${report.season}`,
    "",
    `- Recommendation: ${report.recommendation}`,
    `- Input: ${report.inputPath}`,
    `- Universe path: ${report.universePath}`,
    `- Universe exists: ${report.universeExists}`,
    `- Universe rows: ${report.universeRows}`,
    `- Universe usable rows: ${report.universeUsableRows}`,
    `- Source rows: ${report.coverage.adpSourceRows}`,
    `- Normalized rows: ${report.coverage.normalizedRows}`,
    `- Invalid rows: ${report.coverage.invalidRows}`,
    `- Duplicate rows removed: ${report.coverage.duplicateRowsRemoved}`,
    `- Conflict rows: ${report.coverage.conflictRows}`,
    `- As-of dates: ${report.dataLeakageGuard.asOfDates.join(", ") || "none"}`,
    ...universeIssue,
    "",
    "## Match Coverage",
    "",
    `- Universe rows: ${report.coverage.universeRows}`,
    `- Exact ID matches: ${report.coverage.matchedByExactId}`,
    `- Name/team/position matches: ${report.coverage.matchedByNameTeamPosition}`,
    `- Review candidates: ${report.coverage.reviewCandidates}`,
    `- Unmatched ADP rows: ${report.coverage.unmatchedAdpRows}`,
    `- Universe rows without ADP: ${report.coverage.universeRowsWithoutAdp}`,
    "",
    "## Safety Gates",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed}`),
    "",
  ].join("\n")}\n`;
}

function renderEnrichedMarkdown(report: HistoricalAdpSourceReport) {
  const universeIssue = report.recommendation === "historical_adp_source_needs_historical_universe"
    ? [
      "",
      "ADP source parsed successfully, but no historical draft universe exists for this season. Build the historical draft universe before expecting ADP matches.",
    ]
    : [];
  return `${[
    `# Historical Draft Universe ${report.season} Market Enriched`,
    "",
    `- Recommendation: ${report.recommendation}`,
    `- Universe path: ${report.universePath}`,
    `- Universe exists: ${report.universeExists}`,
    `- Universe rows: ${report.coverage.universeRows}`,
    `- Universe usable rows: ${report.coverage.universeUsableRows}`,
    `- Matched rows: ${report.coverage.universeRows - report.coverage.universeRowsWithoutAdp}`,
    `- Universe rows without ADP: ${report.coverage.universeRowsWithoutAdp}`,
    ...universeIssue,
    "",
    "## Coverage By Position",
    "",
    "| Position | Universe Rows | Matched Rows | Coverage |",
    "|---|---:|---:|---:|",
    ...Object.entries(report.coverage.coverageByPosition).map(([position, row]) => `| ${position} | ${row.universeRows} | ${row.matchedRows} | ${row.coverageRate} |`),
    "",
  ].join("\n")}\n`;
}

function renderNormalizedCsv(rows: HistoricalAdpNormalizedRow[]) {
  const headers = ["season", "source", "as_of_date", "scoring_format", "player_name", "position", "team", "adp", "rank", "sleeper_id", "gsis_id", "player_id", "notes"];
  return `${[headers, ...rows.map((row) => [
    String(row.season),
    row.source,
    row.asOfDate ?? "",
    row.scoringFormat ?? "",
    row.playerName,
    row.position,
    row.team ?? "",
    String(row.adp ?? ""),
    String(row.rank),
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.playerId ?? "",
    row.notes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function renderEnrichedCsv(rows: HistoricalAdpEnrichedUniversePlayer[]) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player_name", "position", "team", "blackbird_rank", "projection_rank", "adp", "external_market_rank", "external_market_source", "external_market_match_confidence", "external_market_notes"];
  return `${[headers, ...rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.playerName,
    row.position,
    row.nflTeam ?? "",
    String(row.blackbirdRank ?? ""),
    String(row.projectionRank ?? ""),
    String(row.adp ?? ""),
    String(row.external_market_rank ?? ""),
    row.external_market_source ?? "",
    row.external_market_match_confidence ?? "",
    row.external_market_notes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function isPreseasonDate(date: string, season: number) {
  const parsed = new Date(date);
  return parsed.getUTCFullYear() <= season && parsed.getUTCMonth() <= 8;
}

function isUsableUniversePlayer(player: HistoricalMockDraftPlayer) {
  return Boolean(player.playerId && player.playerName && player.position);
}

function mapOne(players: HistoricalMockDraftPlayer[], keyFor: (player: HistoricalMockDraftPlayer) => string | null) {
  const index = new Map<string, HistoricalMockDraftPlayer>();
  for (const player of players) {
    const value = keyFor(player);
    if (value && !index.has(value)) index.set(value, player);
  }
  return index;
}

function mapMany(players: HistoricalMockDraftPlayer[], keyFor: (player: HistoricalMockDraftPlayer) => string) {
  const index = new Map<string, HistoricalMockDraftPlayer[]>();
  for (const player of players) index.set(keyFor(player), [...(index.get(keyFor(player)) ?? []), player]);
  return index;
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

function splitNotes(value: string | null) {
  return value ? value.split(/[|;]/).map((item) => item.trim()).filter(Boolean) : [];
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

function normalizeMarketFormat(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function key(...parts: Array<string | null>) {
  return parts.map((part) => part ?? "").join("|");
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
