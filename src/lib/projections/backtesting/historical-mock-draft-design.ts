import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  HistoricalMockDraftDesignArtifactPaths,
  HistoricalMockDraftDesignReport,
} from "./historical-mock-draft-design-types";

export const HISTORICAL_MOCK_DRAFT_BASELINES = [
  "adp_only",
  "projection_only",
  "blackbird_rank_only",
  "need_based",
  "random_within_adp_band",
  "market_rank",
] as const;

export const HISTORICAL_MOCK_DRAFT_OUTCOME_METRICS = [
  "best_ball_total_points",
  "weekly_average",
  "starter_points",
  "bench_points",
  "positional_advantage",
  "replacement_value",
  "hit_rate",
  "bust_rate",
  "injury_games_lost",
  "regret_score",
] as const;

export function buildHistoricalMockDraftDesignReport(input: {
  projectionSeason: number;
  generatedAt?: string;
}): HistoricalMockDraftDesignReport {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    inputsRequired: [
      "preseason player pool available before the target season",
      "preseason ADP or market ranks timestamped before draft simulation",
      "preseason Blackbird projection/rank/suggestion inputs only",
      "league scoring settings",
      "roster settings",
      "draft order and slot",
      "actual season fantasy outcomes used only after draft simulation",
    ],
    draftSimulationStages: [
      "freeze preseason inputs",
      "initialize league and baseline drafters",
      "simulate picks without future-season outcomes",
      "record Blackbird recommendation context at each pick",
      "lock final rosters",
      "score rosters against actual season outcomes",
      "compare Blackbird against baseline drafters",
    ],
    baselineStrategies: [...HISTORICAL_MOCK_DRAFT_BASELINES],
    seasonScoringMethods: [...HISTORICAL_MOCK_DRAFT_OUTCOME_METRICS],
    dataLeakageRules: [
      "Draft phase must not read actual season points, games played, injuries, depth-chart changes, or post-draft ADP.",
      "All draft inputs must be timestamped at or before the preseason cutoff.",
      "Actual outcomes may be joined only after every simulated roster is locked.",
      "Backtest fixtures must preserve separate draft_input and season_outcome namespaces.",
    ],
    metrics: [...HISTORICAL_MOCK_DRAFT_OUTCOME_METRICS],
    futureImplementationPhases: [
      "phase 1: static design artifact and fixtures",
      "phase 2: one-season deterministic simulator",
      "phase 3: baseline drafters and best-ball scorer",
      "phase 4: multi-season replay and regret analysis",
      "phase 5: reporting UI after dry-run validation",
    ],
    knownLimitations: [
      "This design does not implement the draft simulator yet.",
      "Historical ADP availability and timestamp quality will determine leakage confidence.",
      "Best-ball scoring is a first scoring target and does not replace league-specific lineup rules.",
      "Injury games lost may be unavailable or inconsistent by season.",
    ],
    safetyGates: [
      { name: "no_live_outputs_changed", passed: true, detail: "Design artifact only; no live projection outputs are read or written." },
      { name: "no_supabase_writes", passed: true, detail: "No Supabase client is imported or called." },
      { name: "rankings_unchanged", passed: true, detail: "Blackbird Rank ordering is not imported or recalculated." },
      { name: "draft_suggestions_unchanged", passed: true, detail: "Draft Suggestion ordering is not imported or recalculated." },
      { name: "war_room_scoring_unchanged", passed: true, detail: "War Room scoring logic is not imported or recalculated." },
      { name: "v8_2_not_enabled", passed: true, detail: "No feature flag is read or written." },
      { name: "historical_backtest_no_future_leakage", passed: true, detail: "Design explicitly separates draft inputs from actual season outcomes." },
      { name: "mock_review_read_only", passed: true, detail: "Historical design is dry-run/read-only." },
    ],
  };
}

export function writeHistoricalMockDraftDesignArtifacts(
  report: HistoricalMockDraftDesignReport,
  cwd = process.cwd(),
): HistoricalMockDraftDesignArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `historical-mock-draft-design-${report.projectionSeason}.json`);
  const markdownPath = path.join(artifactDir, `historical-mock-draft-design-${report.projectionSeason}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  return { jsonPath, markdownPath };
}

function renderMarkdown(report: HistoricalMockDraftDesignReport): string {
  return `${[
    "# Historical Mock Draft Backtest Design",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Projection season: ${report.projectionSeason}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Baseline Drafters",
    "",
    ...report.baselineStrategies.map((item) => `- ${item}`),
    "",
    "## Season Outcome Metrics",
    "",
    ...report.seasonScoringMethods.map((item) => `- ${item}`),
    "",
    "## Data Leakage Rules",
    "",
    ...report.dataLeakageRules.map((item) => `- ${item}`),
    "",
    "## Future Phases",
    "",
    ...report.futureImplementationPhases.map((item) => `- ${item}`),
    "",
  ].join("\n")}\n`;
}
