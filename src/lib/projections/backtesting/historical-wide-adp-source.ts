import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import type {
  HistoricalWideAdpArtifactPaths,
  HistoricalWideAdpFormatSelection,
  HistoricalWideAdpNormalizedRow,
  HistoricalWideAdpReport,
  HistoricalWideAdpScoringFormat,
} from "./historical-wide-adp-source-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const SOURCE = "user_2026_preseason_adp";
const AS_OF_DATE = "2026-06-19";
const NOTE = "wide_adp_source_half_ppr_ppr_superflex";

const FORMAT_CONFIG: Record<HistoricalWideAdpScoringFormat, { label: string; adp: string[]; order: string[]; posRank: string[] }> = {
  HALF_PPR: {
    label: "Half PPR",
    adp: ["HALF PPR: ADP", "HALF PPR ADP", "HALF_PPR_ADP", "HALF PPR"],
    order: ["HALF PPR: ORDER", "HALF PPR ORDER", "HALF_PPR_ORDER", "HALF PPR: RANK"],
    posRank: ["HALF PPR: POS RANK", "HALF PPR POS RANK", "HALF_PPR_POS_RANK"],
  },
  PPR: {
    label: "PPR",
    adp: ["PPR: ADP", "PPR ADP", "PPR_ADP"],
    order: ["PPR: ORDER", "PPR ORDER", "PPR_ORDER", "PPR: RANK"],
    posRank: ["PPR: POS RANK", "PPR POS RANK", "PPR_POS_RANK"],
  },
  SUPERFLEX: {
    label: "Superflex",
    adp: ["SUPERFLEX: ADP", "SUPERFLEX ADP", "SUPERFLEX_ADP", "SUPER FLEX: ADP", "SUPER FLEX ADP"],
    order: ["SUPERFLEX: ORDER", "SUPERFLEX ORDER", "SUPERFLEX_ORDER", "SUPERFLEX: RANK", "SUPER FLEX: ORDER"],
    posRank: ["SUPERFLEX: POS RANK", "SUPERFLEX POS RANK", "SUPERFLEX_POS_RANK", "SUPER FLEX: POS RANK"],
  },
};

type CsvRow = Record<string, unknown>;

export function normalizeHistoricalWideAdpSource(input: {
  season: number;
  inputPath: string;
  cwd?: string;
  generatedAt?: string;
}): HistoricalWideAdpReport {
  const cwd = input.cwd ?? process.cwd();
  const resolvedInput = path.resolve(cwd, input.inputPath);
  const inputExists = existsSync(resolvedInput);
  const parsedRows = inputExists ? readWideRows(resolvedInput) : [];
  const normalized = normalizeWideRows(parsedRows, input.season);
  const duplicates = countDuplicatePlayerFormatRows(normalized.rows);
  const rowsByScoringFormat = summarizeByFormat(normalized.rows);
  const rowsByPosition = summarizeByPosition(normalized.rows);
  const recommendation = !inputExists
    ? "wide_adp_source_needs_input_file"
    : normalized.rows.length > 0 && normalized.invalidRows.length < parsedRows.length
      ? "wide_adp_source_ready_for_market_anchor"
      : "wide_adp_source_needs_header_mapping";

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    inputPath: input.inputPath,
    inputExists,
    recommendation,
    sourcePlayerRows: parsedRows.length,
    normalizedRows: normalized.rows.length,
    rowsByScoringFormat,
    rowsByPosition,
    rowsMissingAdp: normalized.rows.filter((row) => row.adp === null).length,
    rowsMissingOrderRank: normalized.rows.filter((row) => row.rank === null).length,
    duplicatePlayerFormatRows: duplicates,
    invalidRows: normalized.invalidRows,
    normalizedAdpRows: normalized.rows,
    dataLeakageGuard: {
      sourceAsOfDate: AS_OF_DATE,
      sourceIsPreseason: true,
      adpNotUsedAsValue: true,
      actualSeasonOutcomesNotUsed: true,
    },
    safetyGates: [
      gate("no_live_outputs_changed", true, "Wide ADP normalizer writes local backtesting artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("live_rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("live_draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("adp_not_used_as_value", true, "ADP/order are source market prior fields only."),
      gate("market_anchor_source_only", true, "Rows are normalized for market-anchor experiments only."),
      gate("roster_eligibility_preserved", true, "Normalizer does not alter league roster eligibility."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function writeHistoricalWideAdpArtifacts(
  report: HistoricalWideAdpReport,
  cwd = process.cwd(),
): HistoricalWideAdpArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-adp-${report.season}.normalized`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report.normalizedAdpRows), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function selectHistoricalMarketFormat(input: {
  rosterPositions?: string[] | null;
  scoringSettings?: Record<string, unknown> | null;
}): HistoricalWideAdpFormatSelection {
  const positions = (input.rosterPositions ?? []).map((position) => position.trim().toUpperCase());
  const hasSuperflex = positions.some((position) => ["SUPER_FLEX", "SUPERFLEX", "SF", "OP", "2QB"].includes(position))
    || positions.filter((position) => position === "QB").length > 1;
  if (hasSuperflex) return { selectedFormat: "SUPERFLEX", fallbackUsed: false, reason: "superflex_or_2qb_roster_detected" };

  const receptionValue = receptionScoringValue(input.scoringSettings ?? {});
  if (receptionValue !== null && receptionValue >= 1) return { selectedFormat: "PPR", fallbackUsed: false, reason: "full_ppr_scoring_detected" };
  if (receptionValue !== null && receptionValue > 0) return { selectedFormat: "HALF_PPR", fallbackUsed: false, reason: "half_ppr_scoring_detected" };
  return { selectedFormat: "PPR", fallbackUsed: true, reason: "ppr_default_used_when_market_format_unclear" };
}

function normalizeWideRows(rows: CsvRow[], season: number) {
  const normalizedRows: HistoricalWideAdpNormalizedRow[] = [];
  const invalidRows: HistoricalWideAdpReport["invalidRows"] = [];
  rows.forEach((row, index) => {
    const playerName = stringValue(readHeader(row, ["NAME", "PLAYER", "PLAYER NAME"]));
    const position = normalizePosition(stringValue(readHeader(row, ["POS", "POSITION"])));
    if (!playerName || !position) {
      invalidRows.push({ rowNumber: index + 2, reason: "NAME and POS are required", row });
      return;
    }
    for (const format of Object.keys(FORMAT_CONFIG) as HistoricalWideAdpScoringFormat[]) {
      const adp = numberValue(readHeader(row, FORMAT_CONFIG[format].adp));
      const rank = numberValue(readHeader(row, FORMAT_CONFIG[format].order));
      if (adp === null && rank === null) continue;
      normalizedRows.push({
        season,
        source: SOURCE,
        asOfDate: AS_OF_DATE,
        scoringFormat: format,
        playerName,
        position,
        team: normalizeTeam(stringValue(readHeader(row, ["TEAM", "NFL TEAM"]))),
        adp,
        rank,
        posRank: stringValue(readHeader(row, FORMAT_CONFIG[format].posRank)),
        sleeperId: null,
        gsisId: null,
        playerId: null,
        notes: [NOTE],
      });
    }
  });
  return { rows: normalizedRows, invalidRows };
}

function readWideRows(filePath: string): CsvRow[] {
  const content = readFileSync(filePath, "utf8");
  const delimiter = filePath.endsWith(".txt") && content.includes("\t") ? "\t" : "";
  const parsed = Papa.parse<CsvRow>(content, { header: true, skipEmptyLines: true, dynamicTyping: false, delimiter });
  if (parsed.errors.length) throw new Error(`Historical wide ADP parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function readHeader(row: CsvRow, names: string[]) {
  const byHeader = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const name of names) {
    const value = byHeader.get(normalizeHeader(name));
    if (value !== undefined) return value;
  }
  return null;
}

function summarizeByFormat(rows: HistoricalWideAdpNormalizedRow[]) {
  return {
    HALF_PPR: rows.filter((row) => row.scoringFormat === "HALF_PPR").length,
    PPR: rows.filter((row) => row.scoringFormat === "PPR").length,
    SUPERFLEX: rows.filter((row) => row.scoringFormat === "SUPERFLEX").length,
  };
}

function summarizeByPosition(rows: HistoricalWideAdpNormalizedRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.position] = (acc[row.position] ?? 0) + 1;
    return acc;
  }, {});
}

function countDuplicatePlayerFormatRows(rows: HistoricalWideAdpNormalizedRow[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const key = `${normalizeName(row.playerName)}|${row.position}|${row.team ?? ""}|${row.scoringFormat}`;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function receptionScoringValue(settings: Record<string, unknown>) {
  const candidateKeys = ["rec", "reception", "receptions", "ppr", "points_per_reception"];
  for (const [key, value] of Object.entries(settings)) {
    if (!candidateKeys.includes(key.toLowerCase())) continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function renderMarkdown(report: HistoricalWideAdpReport) {
  return `${[
    `# Historical Wide ADP Source ${report.season}`,
    "",
    `- Recommendation: ${report.recommendation}`,
    `- Input: ${report.inputPath}`,
    `- Input exists: ${report.inputExists}`,
    `- Source player rows: ${report.sourcePlayerRows}`,
    `- Normalized rows: ${report.normalizedRows}`,
    `- Missing ADP rows: ${report.rowsMissingAdp}`,
    `- Missing order/rank rows: ${report.rowsMissingOrderRank}`,
    `- Duplicate player/format rows: ${report.duplicatePlayerFormatRows}`,
    `- Invalid rows: ${report.invalidRows.length}`,
    "",
    "## Rows By Scoring Format",
    "",
    ...Object.entries(report.rowsByScoringFormat).map(([format, count]) => `- ${format}: ${count}`),
    "",
    "## Rows By Position",
    "",
    ...Object.entries(report.rowsByPosition).sort().map(([position, count]) => `- ${position}: ${count}`),
    "",
    "## Safety Gates",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed}`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(rows: HistoricalWideAdpNormalizedRow[]) {
  const headers = ["season", "source", "as_of_date", "scoring_format", "player_name", "position", "team", "adp", "rank", "pos_rank", "sleeper_id", "gsis_id", "player_id", "notes"];
  return `${[headers, ...rows.map((row) => [
    String(row.season),
    row.source,
    row.asOfDate,
    row.scoringFormat,
    row.playerName,
    row.position,
    row.team ?? "",
    String(row.adp ?? ""),
    String(row.rank ?? ""),
    row.posRank ?? "",
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.playerId ?? "",
    row.notes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() || null : value == null ? null : String(value).trim() || null;
}

function numberValue(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ").replace(/_/g, " ");
}

function normalizePosition(value: string | null) {
  const upper = value?.toUpperCase().trim() ?? "";
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  return upper;
}

function normalizeTeam(value: string | null) {
  const upper = value?.toUpperCase().trim() ?? "";
  return upper || null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
