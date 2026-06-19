import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalMockDraftPlayer, HistoricalMockDraftScenario, HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type { HistoricalWeeklyResultsInput } from "./historical-season-outcome-scorer-types";
import type {
  HistoricalDraftUniverseArtifactPaths,
  HistoricalDraftUniverseIdentifierCoveragePreview,
  HistoricalDraftUniverseOptions,
  HistoricalDraftUniverseReport,
  HistoricalDraftUniverseRow,
  HistoricalDraftUniverseSourceDiscovery,
} from "./historical-draft-universe-builder-types";

const OUTPUT_DIR = path.join("artifacts", "projections", "backtesting");
const OFFENSE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const IDP_POSITIONS = new Set(["DL", "LB", "DB", "IDP", "DE", "DT", "CB", "S", "SAF", "FS", "ILB", "MLB", "OLB"]);
const VARIANT_PRIORITY = [
  "blackbird_expected_games_v8_1_calibrated_gate",
  "blackbird_expected_games_v8_cohort_blend",
  "blackbird_expected_games_v7_family_selective",
  "blackbird_expected_games_v6_gated",
  "blackbird_expected_games_v5_selective",
  "blackbird_expected_games_v4",
  "blackbird_cohort_calibrated_v3",
  "blackbird_calibrated_v2",
  "blackbird_availability_calibrated",
  "blackbird_existing_projection_v1",
];

export function runHistoricalDraftUniverseBuilder(input: {
  season: number;
  includeIdp?: boolean;
  includeK?: boolean;
  includeDst?: boolean;
  minProjectionPoints?: number | null;
  cwd?: string;
  generatedAt?: string;
}): HistoricalDraftUniverseReport {
  const cwd = input.cwd ?? process.cwd();
  const options: HistoricalDraftUniverseOptions = {
    season: input.season,
    includeIdp: input.includeIdp ?? false,
    includeK: input.includeK ?? false,
    includeDst: input.includeDst ?? false,
    minProjectionPoints: input.minProjectionPoints ?? 25,
  };
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${input.season}.json`);
  const snapshot = existsSync(path.resolve(cwd, snapshotPath))
    ? readJson<PreseasonProjectionSnapshot>(path.resolve(cwd, snapshotPath))
    : null;
  const sourceDiscovery = discoverSources(snapshotPath, snapshot);
  const rows = snapshot ? buildUniverseRows(snapshot, options) : [];
  const h36PlayerUniverse = toH36Players(rows);
  const weeklyPath = path.join(OUTPUT_DIR, `historical-weekly-results-${input.season}.normalized.json`);
  const weeklyResults = existsSync(path.resolve(cwd, weeklyPath))
    ? readJson<HistoricalWeeklyResultsInput>(path.resolve(cwd, weeklyPath)).results
    : [];
  const identifierCoveragePreview = previewWeeklyCoverage(rows, weeklyResults);
  const generatedH36ScenarioPath = `data/backtesting/historical-mock-draft-scenario.${input.season}.generated.json`;
  const generatedH36Scenario = buildGeneratedScenario({ season: input.season, artifactPath: `${OUTPUT_DIR.replaceAll("\\", "/")}/historical-draft-universe-${input.season}.json` });
  const summary = {
    universeRows: rows.length,
    positions: [...new Set(rows.map((row) => row.position))].sort(),
    teams: [...new Set(rows.map((row) => row.team).filter((team): team is string => Boolean(team)))].sort(),
    rankingFallbackUsed: rows.length ? "blackbird_rank_fallback: projected preseason total points descending; ties by projection_ppg, source confidence, and player name" : null,
    projectionFieldUsed: rows.length ? "projectedTotalPoints" : null,
    rowsWithPlayerId: rows.filter((row) => row.player_id).length,
    rowsWithSleeperId: rows.filter((row) => row.sleeper_id).length,
    rowsWithGsisId: rows.filter((row) => row.gsis_id).length,
  };

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    season: input.season,
    recommendation: recommend(Boolean(snapshot), rows, identifierCoveragePreview),
    options,
    sourceDiscovery,
    summary,
    identifierCoveragePreview,
    generatedH36ScenarioPath,
    h36PlayerUniverse,
    generatedH36Scenario,
    rows,
    dataLeakageGuard: {
      actualWeeklyOutcomesNotUsedForRanking: true,
      weeklyOutcomesUsedOnlyForIdentifierCoveragePreview: true,
      noOutcomePointsJoinedIntoDraftUniverse: true,
      noFutureFieldsUsed: snapshot?.diagnostics.leakageSafety.passed ?? false,
    },
    limitations: limitations(options, rows, identifierCoveragePreview),
    safetyGates: [
      gate("no_live_outputs_changed", true, "Builder reads local preseason artifacts and writes local backtesting artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "v8.2 feature flag state is not read or changed; v8.2 snapshot variants are excluded from row selection."),
      gate("actual_outcomes_not_used_for_ranking", true, "Weekly outcomes are used only for identifier coverage preview."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function buildUniverseRows(snapshot: PreseasonProjectionSnapshot, options: HistoricalDraftUniverseOptions): HistoricalDraftUniverseRow[] {
  const rows = selectOneSnapshotRowPerPlayer(snapshot.rows)
    .filter((row) => positionAllowed(row.position, options))
    .filter((row) => options.minProjectionPoints == null || row.projectedTotalPoints >= options.minProjectionPoints)
    .map((row) => toUniverseRow(row));
  return rows
    .sort((a, b) => b.projection_points - a.projection_points || (b.projection_ppg ?? 0) - (a.projection_ppg ?? 0) || confidenceScore(b.source_confidence) - confidenceScore(a.source_confidence) || a.player_name.localeCompare(b.player_name))
    .map((row, index) => ({ ...row, blackbird_rank: row.blackbird_rank ?? index + 1, blackbird_rank_fallback: row.blackbird_rank_fallback ?? index + 1 }));
}

export function writeHistoricalDraftUniverseArtifacts(
  report: HistoricalDraftUniverseReport,
  cwd = process.cwd(),
): HistoricalDraftUniverseArtifactPaths {
  const artifactDir = path.resolve(cwd, OUTPUT_DIR);
  mkdirSync(artifactDir, { recursive: true });
  const base = `historical-draft-universe-${report.season}`;
  const jsonPath = path.join(artifactDir, `${base}.json`);
  const markdownPath = path.join(artifactDir, `${base}.md`);
  const csvPath = path.join(artifactDir, `${base}.csv`);
  const scenarioPath = path.resolve(cwd, report.generatedH36ScenarioPath);
  mkdirSync(path.dirname(scenarioPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify({ ...report, playerUniverseInput: { players: report.h36PlayerUniverse } }, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report.rows), "utf8");
  writeFileSync(scenarioPath, `${JSON.stringify(report.generatedH36Scenario, null, 2)}\n`, "utf8");
  return { jsonPath, markdownPath, csvPath, scenarioPath };
}

function selectOneSnapshotRowPerPlayer(rows: PreseasonProjectionSnapshotRow[]): PreseasonProjectionSnapshotRow[] {
  const byPlayer = new Map<string, PreseasonProjectionSnapshotRow>();
  for (const row of rows.filter((item) => !item.variant.includes("v8_2"))) {
    const key = row.gsisId ?? row.sleeperId ?? `${row.normalizedName}|${normalizePosition(row.position)}`;
    const current = byPlayer.get(key);
    if (!current || variantRank(row.variant) < variantRank(current.variant)) byPlayer.set(key, row);
  }
  return [...byPlayer.values()];
}

function toUniverseRow(row: PreseasonProjectionSnapshotRow): HistoricalDraftUniverseRow {
  const position = normalizePosition(row.position);
  const playerId = row.gsisId ?? row.sleeperId ?? `${row.normalizedName}-${position}`;
  return {
    player_id: playerId,
    sleeper_id: row.sleeperId,
    gsis_id: row.gsisId,
    player_name: row.playerName,
    position,
    team: row.team,
    age: null,
    years_exp: null,
    projection_points: round(row.projectedTotalPoints),
    projection_ppg: round(row.projectedPpg),
    blackbird_rank: null,
    blackbird_rank_fallback: null,
    blackbird_score: round(row.confidenceScore),
    draft_score: round(row.projectedTotalPoints),
    adp: null,
    market_rank: null,
    source: row.source,
    source_confidence: row.confidence,
    notes: [
      "preseason_snapshot_only",
      "blackbird_rank_fallback_from_projected_points",
      row.matchConfidence ? `match_confidence:${row.matchConfidence}` : "",
    ].filter(Boolean),
  };
}

function toH36Players(rows: HistoricalDraftUniverseRow[]): HistoricalMockDraftPlayer[] {
  return rows.map((row) => ({
    playerId: row.player_id,
    sleeperId: row.sleeper_id,
    playerName: row.player_name,
    position: row.position,
    nflTeam: row.team,
    blackbirdRank: row.blackbird_rank,
    internalDraftRank: row.blackbird_rank_fallback,
    projectionRank: row.blackbird_rank_fallback,
    adpRank: row.adp,
    marketRank: row.market_rank ?? row.blackbird_rank_fallback,
    projectedPoints: row.projection_points,
  }));
}

function buildGeneratedScenario(input: { season: number; artifactPath: string }): HistoricalMockDraftScenario {
  const strategies: HistoricalMockDraftStrategy[] = ["blackbird_rank_only", "projection_only", "adp_only", "market_rank", "need_based", "random_within_adp_band"];
  return {
    historicalSeason: input.season,
    leagueType: "best_ball",
    teams: 12,
    rounds: 15,
    draftOrderType: "third_round_reversal",
    draftSlots: Array.from({ length: 12 }, (_, index) => index + 1),
    myDraftSlot: 2,
    rosterSettings: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2, BENCH: 6 },
    scoringSettings: {},
    strategySet: strategies,
    randomSeed: input.season,
    playerUniverseInput: { artifactPath: input.artifactPath },
    projectionSnapshotInput: { artifactPath: `artifacts/projections/backtesting/preseason-projection-snapshot-${input.season}.json`, asOf: `${input.season}-08-01`, source: "preseason projection snapshot" },
    adpInput: { source: "not_available_v1" },
    marketRankInput: { source: "blackbird_rank_fallback" },
  };
}

function previewWeeklyCoverage(rows: HistoricalDraftUniverseRow[], weeklyRows: HistoricalWeeklyResultsInput["results"]): HistoricalDraftUniverseIdentifierCoveragePreview {
  const exactKeys = new Set(weeklyRows.flatMap((row) => [row.player_id, row.sleeper_id, row.gsis_id].filter((value): value is string => Boolean(value))));
  const namePositionKeys = new Set(weeklyRows.map((row) => `${normalizeName(row.player_name)}|${normalizePosition(row.position)}`));
  const byPosition: HistoricalDraftUniverseIdentifierCoveragePreview["matchRateByPosition"] = {};
  let exact = 0;
  let fallback = 0;
  let missing = 0;
  for (const row of rows) {
    const position = row.position;
    byPosition[position] = byPosition[position] ?? { total: 0, exact: 0, fallback: 0, missing: 0, matchRate: 0 };
    byPosition[position].total += 1;
    if ([row.player_id, row.sleeper_id, row.gsis_id].some((value) => value && exactKeys.has(value))) {
      exact += 1;
      byPosition[position].exact += 1;
    } else if (namePositionKeys.has(`${normalizeName(row.player_name)}|${row.position}`)) {
      fallback += 1;
      byPosition[position].fallback += 1;
    } else {
      missing += 1;
      byPosition[position].missing += 1;
    }
  }
  for (const item of Object.values(byPosition)) item.matchRate = item.total ? round((item.exact + item.fallback) / item.total) : 0;
  return {
    universePlayers: rows.length,
    playersWithWeeklyResultExactIdMatch: exact,
    playersWithWeeklyResultNamePositionFallback: fallback,
    playersMissingWeeklyOutcome: missing,
    matchRateByPosition: byPosition,
  };
}

function discoverSources(snapshotPath: string, snapshot: PreseasonProjectionSnapshot | null): HistoricalDraftUniverseSourceDiscovery {
  const rows = snapshot?.rows ?? [];
  return {
    preseasonProjectionSnapshot: {
      path: snapshotPath,
      exists: Boolean(snapshot),
      rows: rows.length,
      playersWithPlayerId: rows.filter((row) => row.gsisId || row.sleeperId).length,
      playersWithSleeperId: rows.filter((row) => row.sleeperId).length,
      playersWithGsisId: rows.filter((row) => row.gsisId).length,
      playersWithPlayerName: rows.filter((row) => row.playerName).length,
      positionsCovered: [...new Set(rows.map((row) => normalizePosition(row.position)))].sort(),
      teamsCovered: [...new Set(rows.map((row) => row.team).filter((team): team is string => Boolean(team)))].sort(),
      rankingFieldsAvailable: [],
      projectionFieldsAvailable: ["projectedTotalPoints", "projectedPpg", "floorPoints", "medianPoints", "ceilingPoints"],
      adpMarketFieldsAvailable: [],
      blackbirdRankLikeFieldsAvailable: ["projectedTotalPoints", "confidenceScore", "variant"],
    },
  };
}

function recommend(
  snapshotFound: boolean,
  rows: HistoricalDraftUniverseRow[],
  preview: HistoricalDraftUniverseIdentifierCoveragePreview,
): HistoricalDraftUniverseReport["recommendation"] {
  if (!snapshotFound) return "historical_draft_universe_needs_preseason_snapshot";
  if (!rows.length) return "historical_draft_universe_needs_ranking_fields";
  if (preview.universePlayers && preview.playersWithWeeklyResultExactIdMatch / preview.universePlayers < 0.5) return "historical_draft_universe_needs_identifier_mapping";
  return "historical_draft_universe_ready_for_h36_h37";
}

function limitations(options: HistoricalDraftUniverseOptions, rows: HistoricalDraftUniverseRow[], preview: HistoricalDraftUniverseIdentifierCoveragePreview) {
  const items: string[] = [];
  if (!options.includeIdp) items.push("Default H36.1 build excludes IDP for initial H36/H37 scoring.");
  if (!options.includeK) items.push("Default H36.1 build excludes kickers.");
  if (!options.includeDst) items.push("Default H36.1 build excludes DST.");
  if (options.minProjectionPoints != null) items.push(`Draft universe is filtered to preseason projection_points >= ${options.minProjectionPoints}.`);
  if (rows.every((row) => row.adp == null)) items.push("ADP is not present in the selected preseason snapshot; adp strategy falls back to projected ranking in H36.");
  if (preview.playersMissingWeeklyOutcome > 0) items.push("Some universe players have no 2025 weekly outcome match; H37 will score those missing weeks as zero.");
  return items;
}

function positionAllowed(position: string, options: HistoricalDraftUniverseOptions): boolean {
  const normalized = normalizePosition(position);
  if (OFFENSE_POSITIONS.has(normalized)) return true;
  if (normalized === "K") return options.includeK;
  if (normalized === "DST") return options.includeDst;
  if (IDP_POSITIONS.has(normalized)) return options.includeIdp;
  return false;
}

function normalizePosition(position: string): string {
  const upper = position.toUpperCase();
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  if (["DE", "DT"].includes(upper)) return "DL";
  if (["CB", "S", "SAF", "FS"].includes(upper)) return "DB";
  if (["ILB", "MLB", "OLB"].includes(upper)) return "LB";
  return upper;
}

function variantRank(variant: string) {
  const index = VARIANT_PRIORITY.indexOf(variant);
  return index === -1 ? VARIANT_PRIORITY.length : index;
}

function confidenceScore(confidence: string) {
  return { high: 4, medium: 3, low: 2, very_low: 1 }[confidence] ?? 0;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function renderMarkdown(report: HistoricalDraftUniverseReport) {
  return `${[
    `# Historical Draft Universe ${report.season}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Recommendation: ${report.recommendation}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Source Discovery",
    "",
    `- Snapshot: ${report.sourceDiscovery.preseasonProjectionSnapshot.path}`,
    `- Snapshot rows: ${report.sourceDiscovery.preseasonProjectionSnapshot.rows}`,
    `- Player ID rows: ${report.sourceDiscovery.preseasonProjectionSnapshot.playersWithPlayerId}`,
    `- Sleeper ID rows: ${report.sourceDiscovery.preseasonProjectionSnapshot.playersWithSleeperId}`,
    `- GSIS ID rows: ${report.sourceDiscovery.preseasonProjectionSnapshot.playersWithGsisId}`,
    `- Projection fields: ${report.sourceDiscovery.preseasonProjectionSnapshot.projectionFieldsAvailable.join(", ")}`,
    `- Rank-like fields: ${report.sourceDiscovery.preseasonProjectionSnapshot.blackbirdRankLikeFieldsAvailable.join(", ")}`,
    "",
    "## Universe",
    "",
    `- Rows: ${report.summary.universeRows}`,
    `- Positions: ${report.summary.positions.join(", ") || "none"}`,
    `- Teams: ${report.summary.teams.length}`,
    `- Projection field used: ${report.summary.projectionFieldUsed ?? "none"}`,
    `- Ranking fallback: ${report.summary.rankingFallbackUsed ?? "none"}`,
    "",
    "## H37 Identifier Coverage Preview",
    "",
    `- Universe players: ${report.identifierCoveragePreview.universePlayers}`,
    `- Exact ID matches: ${report.identifierCoveragePreview.playersWithWeeklyResultExactIdMatch}`,
    `- Name/position fallback matches: ${report.identifierCoveragePreview.playersWithWeeklyResultNamePositionFallback}`,
    `- Missing weekly outcomes: ${report.identifierCoveragePreview.playersMissingWeeklyOutcome}`,
    "",
    "## Generated H36 Scenario",
    "",
    `- ${report.generatedH36ScenarioPath}`,
    "",
    "## Data Leakage Guard",
    "",
    `- Actual weekly outcomes not used for ranking: ${report.dataLeakageGuard.actualWeeklyOutcomesNotUsedForRanking}`,
    `- Weekly outcomes only for coverage preview: ${report.dataLeakageGuard.weeklyOutcomesUsedOnlyForIdentifierCoveragePreview}`,
    `- No outcome points joined into draft universe: ${report.dataLeakageGuard.noOutcomePointsJoinedIntoDraftUniverse}`,
    `- No future fields used: ${report.dataLeakageGuard.noFutureFieldsUsed}`,
    "",
    "## Limitations",
    "",
    ...(report.limitations.length ? report.limitations.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n")}\n`;
}

function renderCsv(rows: HistoricalDraftUniverseRow[]) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player_name", "position", "team", "projection_points", "projection_ppg", "blackbird_rank", "blackbird_rank_fallback", "blackbird_score", "draft_score", "adp", "market_rank", "source", "source_confidence", "notes"];
  return [
    headers,
    ...rows.map((row) => headers.map((header) => {
      const value = row[header as keyof HistoricalDraftUniverseRow];
      return Array.isArray(value) ? value.join("|") : String(value ?? "");
    })),
  ].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
