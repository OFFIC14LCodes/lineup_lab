import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import type {
  HistoricalWeeklyResultsArtifactPaths,
  HistoricalWeeklyResultsNormalizedRow,
  HistoricalWeeklyResultsReport,
  HistoricalWeeklyResultsSourceCandidate,
} from "./historical-weekly-results-source-types";

type CsvRow = Record<string, unknown>;

const NORMALIZED_COLUMNS = [
  "season",
  "week",
  "season_type",
  "player_id",
  "sleeper_id",
  "gsis_id",
  "player_name",
  "position",
  "team",
  "opponent",
  "fantasy_points",
  "passing_points",
  "rushing_points",
  "receiving_points",
  "td_points",
  "turnover_points",
  "kicking_points",
  "dst_points",
  "idp_points",
  "source",
  "source_updated_at",
  "notes",
];

export function runHistoricalWeeklyResultsNormalize(input: {
  season: number;
  cwd?: string;
  sourcePath?: string | null;
  generatedAt?: string;
}): HistoricalWeeklyResultsReport {
  const cwd = input.cwd ?? process.cwd();
  const sourceDiscovery = discoverHistoricalWeeklyResultSources({ season: input.season, cwd, sourcePath: input.sourcePath });
  const selected = sourceDiscovery.find((candidate) => candidate.selected && candidate.exists) ?? null;
  const sourceRows = selected ? readCsvRows(path.resolve(cwd, selected.path)) : [];
  const normalized = selected ? normalizeHistoricalWeeklyRows(sourceRows, { season: input.season, sourcePath: selected.path, generatedAt: input.generatedAt }) : [];
  const summary = summarizeNormalizedRows(normalized);
  const limitations = buildLimitations(selected, normalized);
  const recommendation = recommend(selected, summary, limitations);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    recommendation,
    sourceDiscovery,
    selectedSourcePath: selected?.path ?? null,
    summary,
    fantasyPointMethod: fantasyPointMethod(normalized),
    h37Integration: {
      weeklyResultsInputPath: `artifacts/projections/backtesting/historical-weekly-results-${input.season}.normalized.json`,
      scenarioTemplatePath: "data/backtesting/historical-season-outcome-scenario.template.json",
    },
    dataLeakageGuard: {
      weeklyOutcomesSourceIsOutcomeOnly: true,
      notUsedByH36DraftEngine: true,
      h37ScoringOnly: true,
      noDraftRankingsRecomputed: true,
      noLiveOutputsChanged: true,
    },
    limitations,
    safetyGates: [
      gate("no_live_outputs_changed", true, "Normalizer reads local weekly outcome files and writes local backtesting artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("outcomes_not_used_by_h36", true, "Weekly outcomes are prepared only for H37 scoring."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
    results: normalized,
  };
}

export function discoverHistoricalWeeklyResultSources(input: {
  season: number;
  cwd?: string;
  sourcePath?: string | null;
}): HistoricalWeeklyResultsSourceCandidate[] {
  const cwd = input.cwd ?? process.cwd();
  const paths = [
    input.sourcePath,
    `data/backtesting/historical-weekly-results-${input.season}.csv`,
    `data/nflverse/player_stats_${input.season}.csv`,
    `data/raw/nflverse/player_stats/${input.season}/stats_player_week_${input.season}.csv`,
    `data/nflreadr/player_stats_${input.season}.csv`,
    `artifacts/projections/backtesting/historical-weekly-results-${input.season}.csv`,
  ].filter(Boolean) as string[];
  const uniquePaths = [...new Set(paths)];
  const firstExisting = uniquePaths.find((candidatePath) => existsSync(path.resolve(cwd, candidatePath))) ?? null;

  return uniquePaths.map((candidatePath) => {
    const fullPath = path.resolve(cwd, candidatePath);
    if (!existsSync(fullPath)) return emptyCandidate(candidatePath, candidatePath === firstExisting);
    const rows = readCsvRows(fullPath);
    return summarizeSourceCandidate(candidatePath, rows, candidatePath === firstExisting);
  });
}

export function normalizeHistoricalWeeklyRows(
  rows: CsvRow[],
  input: { season: number; sourcePath: string; generatedAt?: string },
): HistoricalWeeklyResultsNormalizedRow[] {
  return rows
    .filter((row) => numberValue(row.season) === input.season)
    .map((row) => normalizeRow(row, input))
    .filter((row): row is HistoricalWeeklyResultsNormalizedRow => row !== null);
}

export function writeHistoricalWeeklyResultsArtifacts(
  report: HistoricalWeeklyResultsReport,
  cwd = process.cwd(),
): HistoricalWeeklyResultsArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-weekly-results-${report.season}.normalized`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report.results), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function normalizeRow(
  row: CsvRow,
  input: { season: number; sourcePath: string; generatedAt?: string },
): HistoricalWeeklyResultsNormalizedRow | null {
  const week = numberValue(row.week);
  const playerName = stringValue(row.player_display_name) ?? stringValue(row.player_name);
  const position = normalizePosition(stringValue(row.position) ?? "");
  if (!week || !playerName || !position) return null;

  const notes: string[] = [];
  const precomputedPpr = numberValue(row.fantasy_points_ppr);
  const precomputed = numberValue(row.fantasy_points);
  const calculated = calculateFantasyPoints(row);
  const fantasyPoints = precomputedPpr ?? precomputed ?? calculated.total;
  if (precomputedPpr !== null) notes.push("fantasy_points_ppr_precomputed");
  else if (precomputed !== null) notes.push("fantasy_points_precomputed");
  else if (calculated.available) notes.push("fantasy_points_calculated_from_stats");
  else notes.push("missing_scoring_inputs");

  if (calculated.limitations.length) notes.push(...calculated.limitations);

  return {
    season: input.season,
    week,
    season_type: stringValue(row.season_type),
    player_id: stringValue(row.player_id),
    sleeper_id: stringValue(row.sleeper_id),
    gsis_id: stringValue(row.gsis_id) ?? stringValue(row.player_id),
    player_name: playerName,
    position,
    team: stringValue(row.team),
    opponent: stringValue(row.opponent) ?? stringValue(row.opponent_team),
    fantasy_points: round(fantasyPoints ?? 0),
    passing_points: round(calculated.passing),
    rushing_points: round(calculated.rushing),
    receiving_points: round(calculated.receiving),
    td_points: round(calculated.td),
    turnover_points: round(calculated.turnover),
    kicking_points: round(calculated.kicking),
    dst_points: round(calculated.dst),
    idp_points: round(calculated.idp),
    source: input.sourcePath,
    source_updated_at: input.generatedAt ?? null,
    notes,
  };
}

function calculateFantasyPoints(row: CsvRow) {
  const hasOffense = hasAny(row, [
    "passing_yards",
    "passing_tds",
    "passing_interceptions",
    "rushing_yards",
    "rushing_tds",
    "receptions",
    "receiving_yards",
    "receiving_tds",
  ]);
  const passing = n(row.passing_yards) * 0.04 + n(row.passing_tds) * 4 + n(row.passing_2pt_conversions) * 2;
  const rushing = n(row.rushing_yards) * 0.1 + n(row.rushing_tds) * 6 + n(row.rushing_2pt_conversions) * 2;
  const receiving = n(row.receptions) + n(row.receiving_yards) * 0.1 + n(row.receiving_tds) * 6 + n(row.receiving_2pt_conversions) * 2;
  const turnover = (n(row.passing_interceptions) + n(row.rushing_fumbles_lost) + n(row.receiving_fumbles_lost) + n(row.sack_fumbles_lost)) * -2;
  const td = n(row.special_teams_tds) * 6 + n(row.fumble_recovery_tds) * 6;
  const kicking = n(row.fg_made) * 3 + n(row.fg_made_40_49) + n(row.fg_made_50_59) * 2 + n(row.fg_made_60_) * 3 + n(row.pat_made) - n(row.fg_missed) - n(row.pat_missed);
  const idp = n(row.def_sacks) * 3 + n(row.def_interceptions) * 3 + n(row.def_fumbles_forced) * 2 + n(row.def_fumbles) * 2 + n(row.def_tds) * 6 + n(row.def_safeties) * 2 + n(row.def_pass_defended) + n(row.def_tackles_solo) + n(row.def_tackle_assists) * 0.5;
  const dst = 0;
  const limitations = [];
  if (!hasColumn(row, "fumbles_lost") && !hasColumn(row, "rushing_fumbles_lost") && !hasColumn(row, "receiving_fumbles_lost")) {
    limitations.push("fumbles_lost_mapping_partial");
  }
  if (!hasAny(row, ["fg_made", "pat_made"])) limitations.push("kicking_scoring_not_available");
  if (!hasAny(row, ["def_sacks", "def_interceptions", "def_tackles_solo"])) limitations.push("idp_scoring_not_available");
  return {
    available: hasOffense || hasAny(row, ["fg_made", "pat_made", "def_sacks", "def_tackles_solo"]),
    passing,
    rushing,
    receiving,
    td,
    turnover,
    kicking,
    dst,
    idp,
    total: passing + rushing + receiving + turnover + td + kicking + dst + idp,
    limitations,
  };
}

function summarizeSourceCandidate(pathName: string, rows: CsvRow[], selected: boolean): HistoricalWeeklyResultsSourceCandidate {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return {
    path: pathName,
    exists: true,
    selected,
    rowCount: rows.length,
    seasonCoverage: uniqueNumbers(rows.map((row) => numberValue(row.season))),
    weekCoverage: uniqueNumbers(rows.map((row) => numberValue(row.week))),
    identifierCoverage: {
      player_id: rows.filter((row) => stringValue(row.player_id)).length,
      sleeper_id: rows.filter((row) => stringValue(row.sleeper_id)).length,
      gsis_id: rows.filter((row) => stringValue(row.gsis_id)).length,
      player_name: rows.filter((row) => stringValue(row.player_display_name) ?? stringValue(row.player_name)).length,
    },
    positionCoverage: rows.filter((row) => stringValue(row.position)).length,
    fantasyPointsPresent: columns.includes("fantasy_points") || columns.includes("fantasy_points_ppr"),
    scoringMustBeCalculated: !columns.includes("fantasy_points") && !columns.includes("fantasy_points_ppr"),
    columns,
  };
}

function summarizeNormalizedRows(rows: HistoricalWeeklyResultsNormalizedRow[]): HistoricalWeeklyResultsReport["summary"] {
  return {
    totalWeeklyRows: rows.length,
    playersCovered: new Set(rows.map((row) => row.player_id ?? row.gsis_id ?? `${row.player_name}|${row.position}`)).size,
    weeksCovered: uniqueNumbers(rows.map((row) => row.week)),
    positionsCovered: [...new Set(rows.map((row) => row.position))].sort(),
    exactIdCoverage: {
      player_id: rows.filter((row) => row.player_id).length,
      sleeper_id: rows.filter((row) => row.sleeper_id).length,
      gsis_id: rows.filter((row) => row.gsis_id).length,
    },
    rowsWithFantasyPoints: rows.filter((row) => !row.notes.includes("missing_scoring_inputs")).length,
    rowsCalculatedFromStats: rows.filter((row) => row.notes.includes("fantasy_points_calculated_from_stats")).length,
    rowsMissingScoringInputs: rows.filter((row) => row.notes.includes("missing_scoring_inputs")).length,
  };
}

function buildLimitations(selected: HistoricalWeeklyResultsSourceCandidate | null, rows: HistoricalWeeklyResultsNormalizedRow[]) {
  const limitations: string[] = [];
  if (!selected) limitations.push("No local historical weekly results source file was found.");
  if (selected && selected.identifierCoverage.sleeper_id === 0) limitations.push("Sleeper IDs are not present in the selected weekly source; H37 may rely on player_id/gsis_id or name+position fallback.");
  if (rows.some((row) => row.notes.includes("kicking_scoring_not_available"))) limitations.push("Kicking component scoring is only populated when source columns are available.");
  if (rows.some((row) => row.notes.includes("idp_scoring_not_available"))) limitations.push("IDP component scoring is only populated when source columns are available.");
  if (rows.some((row) => row.notes.includes("missing_scoring_inputs"))) limitations.push("Some rows did not contain precomputed points or enough raw scoring columns.");
  return [...new Set(limitations)];
}

function recommend(
  selected: HistoricalWeeklyResultsSourceCandidate | null,
  summary: HistoricalWeeklyResultsReport["summary"],
  limitations: string[],
): HistoricalWeeklyResultsReport["recommendation"] {
  if (!selected) return "historical_weekly_results_needs_source_file";
  if (summary.exactIdCoverage.player_id === 0 && summary.exactIdCoverage.gsis_id === 0 && summary.playersCovered > 0) return "historical_weekly_results_needs_identifier_mapping";
  if (summary.rowsWithFantasyPoints === 0 || limitations.includes("Some rows did not contain precomputed points or enough raw scoring columns.")) return "historical_weekly_results_needs_scoring_mapping";
  return "historical_weekly_results_ready_for_h37_scoring";
}

function fantasyPointMethod(rows: HistoricalWeeklyResultsNormalizedRow[]): HistoricalWeeklyResultsReport["fantasyPointMethod"] {
  if (!rows.length) return "not_available";
  if (rows.some((row) => row.notes.includes("fantasy_points_ppr_precomputed"))) return "precomputed_fantasy_points_ppr";
  if (rows.some((row) => row.notes.includes("fantasy_points_precomputed"))) return "precomputed_fantasy_points";
  if (rows.some((row) => row.notes.includes("fantasy_points_calculated_from_stats"))) return "calculated_from_stats";
  return "not_available";
}

function renderMarkdown(report: HistoricalWeeklyResultsReport) {
  const selected = report.sourceDiscovery.find((candidate) => candidate.selected);
  return `${[
    `# Historical Weekly Results Normalization ${report.season}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Recommendation: ${report.recommendation}`,
    `- Selected source: ${report.selectedSourcePath ?? "none"}`,
    `- Fantasy point method: ${report.fantasyPointMethod}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Source Discovery",
    "",
    `- Sources checked: ${report.sourceDiscovery.length}`,
    `- Selected row count: ${selected?.rowCount ?? 0}`,
    `- Season coverage: ${selected?.seasonCoverage.join(", ") || "none"}`,
    `- Week coverage: ${selected?.weekCoverage.join(", ") || "none"}`,
    `- Fantasy points present: ${selected?.fantasyPointsPresent ?? false}`,
    `- Scoring must be calculated: ${selected?.scoringMustBeCalculated ?? false}`,
    "",
    "## Coverage",
    "",
    `- Total weekly rows: ${report.summary.totalWeeklyRows}`,
    `- Players covered: ${report.summary.playersCovered}`,
    `- Weeks covered: ${report.summary.weeksCovered.join(", ") || "none"}`,
    `- Positions covered: ${report.summary.positionsCovered.join(", ") || "none"}`,
    `- Rows with fantasy points: ${report.summary.rowsWithFantasyPoints}`,
    `- Rows calculated from stats: ${report.summary.rowsCalculatedFromStats}`,
    `- Rows missing scoring inputs: ${report.summary.rowsMissingScoringInputs}`,
    "",
    "## H37 Integration",
    "",
    `- weeklyResultsInputPath: ${report.h37Integration.weeklyResultsInputPath}`,
    "",
    "## Limitations",
    "",
    ...(report.limitations.length ? report.limitations.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Data Leakage Guard",
    "",
    `- Outcome-only source: ${report.dataLeakageGuard.weeklyOutcomesSourceIsOutcomeOnly}`,
    `- Not used by H36: ${report.dataLeakageGuard.notUsedByH36DraftEngine}`,
    `- H37 scoring only: ${report.dataLeakageGuard.h37ScoringOnly}`,
    `- No draft rankings recomputed: ${report.dataLeakageGuard.noDraftRankingsRecomputed}`,
    `- No live outputs changed: ${report.dataLeakageGuard.noLiveOutputsChanged}`,
    "",
  ].join("\n")}\n`;
}

function renderCsv(rows: HistoricalWeeklyResultsNormalizedRow[]) {
  return [
    NORMALIZED_COLUMNS,
    ...rows.map((row) => NORMALIZED_COLUMNS.map((column) => {
      const value = row[column as keyof HistoricalWeeklyResultsNormalizedRow];
      return Array.isArray(value) ? value.join("|") : String(value ?? "");
    })),
  ].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function readCsvRows(filePath: string): CsvRow[] {
  const parsed = Papa.parse<CsvRow>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(`Historical weekly results CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function emptyCandidate(pathName: string, selected: boolean): HistoricalWeeklyResultsSourceCandidate {
  return {
    path: pathName,
    exists: false,
    selected,
    rowCount: 0,
    seasonCoverage: [],
    weekCoverage: [],
    identifierCoverage: { player_id: 0, sleeper_id: 0, gsis_id: 0, player_name: 0 },
    positionCoverage: 0,
    fantasyPointsPresent: false,
    scoringMustBeCalculated: false,
    columns: [],
  };
}

function hasAny(row: CsvRow, columns: string[]) {
  return columns.some((column) => hasColumn(row, column));
}

function hasColumn(row: CsvRow, column: string) {
  return Object.prototype.hasOwnProperty.call(row, column) && row[column] !== "" && row[column] !== "NA" && row[column] !== null && row[column] !== undefined;
}

function n(value: unknown) {
  return numberValue(value) ?? 0;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && value !== "NA") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return value === null || value === undefined ? null : String(value);
  const trimmed = value.trim();
  return trimmed && trimmed !== "NA" ? trimmed : null;
}

function uniqueNumbers(values: Array<number | null>) {
  return [...new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)))].sort((a, b) => a - b);
}

function normalizePosition(position: string): string {
  const upper = position.toUpperCase();
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  return upper;
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

