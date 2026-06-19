import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildMockDraftResultCaptureReport } from "@/lib/draft/mock-draft-result-capture";
import type { MockDraftResultCaptureInput } from "@/lib/draft/mock-draft-result-capture-types";

import type {
  HistoricalMockDraftEngineArtifactPaths,
  HistoricalMockDraftEngineReport,
  HistoricalMockDraftOrderPick,
  HistoricalMockDraftOrderType,
  HistoricalMockDraftPickLog,
  HistoricalMockDraftPlayer,
  HistoricalMockDraftScenario,
  HistoricalMockDraftStrategy,
  HistoricalMockDraftStrategyResult,
} from "./historical-mock-draft-engine-types";

const STARTER_TARGETS: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };

export function buildHistoricalMockDraftEngineReport(input: {
  projectionSeason: number;
  scenario: HistoricalMockDraftScenario;
  scenarioPath?: string;
  generatedAt?: string;
}): HistoricalMockDraftEngineReport {
  const draftOrder = generateHistoricalDraftOrder(input.scenario);
  const enoughInput = input.scenario.playerUniverseInput.players.length >= input.scenario.teams * input.scenario.rounds;
  const strategyResults = input.scenario.strategySet.map((strategy) =>
    simulateStrategyDraft({ strategy, scenario: input.scenario, draftOrder }),
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    scenarioPath: input.scenarioPath ?? null,
    recommendation: enoughInput
      ? "historical_mock_draft_engine_ready_for_season_scoring"
      : "historical_mock_draft_engine_needs_input_data",
    draftOrderType: input.scenario.draftOrderType,
    draftOrder,
    strategyResults,
    dataLeakageGuard: {
      allowedDraftTimeInputs: [
        "preseason projection snapshot for the historical season",
        "preseason ADP or market rank source if present",
        "league roster and scoring settings",
        "draft slot/order",
        "player universe as of draft time",
      ],
      disallowedOutcomeInputs: [
        "actual weekly results from the historical season",
        "final season fantasy points",
        "injury outcomes not known before the draft",
        "future ADP/rank/projection snapshots",
      ],
      actualSeasonScoringLoaded: false,
      futureOutcomeFieldsUsed: false,
    },
    safetyGates: [
      gate("no_live_outputs_changed", true, "Historical engine reads local scenario data and writes local artifacts only."),
      gate("no_supabase_writes", true, "No Supabase client is imported or called."),
      gate("rankings_unchanged", true, "Live Blackbird Rank ordering is not imported or mutated."),
      gate("draft_suggestions_unchanged", true, "Live Draft Suggestion ordering is not imported or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring logic is not imported or recalculated."),
      gate("v8_2_not_enabled", true, "No v8.2 feature flag is read or written."),
      gate("historical_backtest_no_future_leakage", true, "Only scenario preseason fields are used during draft simulation."),
      gate("actual_season_outcomes_not_used", true, "No actual season outcome data is loaded."),
      gate("dry_run_only", true, "Report is dry-run/read-only."),
    ],
  };
}

export function runHistoricalMockDraftEngine(input: {
  projectionSeason: number;
  scenarioPath: string;
  cwd?: string;
}): HistoricalMockDraftEngineReport {
  const cwd = input.cwd ?? process.cwd();
  const scenario = JSON.parse(readFileSync(path.resolve(cwd, input.scenarioPath), "utf8")) as HistoricalMockDraftScenario;
  return buildHistoricalMockDraftEngineReport({
    projectionSeason: input.projectionSeason,
    scenario,
    scenarioPath: input.scenarioPath,
  });
}

export function writeHistoricalMockDraftEngineArtifacts(
  report: HistoricalMockDraftEngineReport,
  cwd = process.cwd(),
): HistoricalMockDraftEngineArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "projections", "backtesting");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `historical-mock-draft-engine-${report.projectionSeason}.json`);
  const markdownPath = path.join(artifactDir, `historical-mock-draft-engine-${report.projectionSeason}.md`);
  const csvPath = path.join(artifactDir, `historical-mock-draft-engine-${report.projectionSeason}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  writeFileSync(csvPath, renderCsv(report));
  return { jsonPath, markdownPath, csvPath };
}

export function generateHistoricalDraftOrder(scenario: Pick<HistoricalMockDraftScenario, "teams" | "rounds" | "draftOrderType">): HistoricalMockDraftOrderPick[] {
  const order: HistoricalMockDraftOrderPick[] = [];
  for (let round = 1; round <= scenario.rounds; round += 1) {
    const slots = roundSlots(scenario.teams, round, scenario.draftOrderType);
    for (let index = 0; index < slots.length; index += 1) {
      order.push({
        overallPick: order.length + 1,
        round,
        pickInRound: index + 1,
        draftSlot: slots[index],
      });
    }
  }
  return order;
}

function roundSlots(teams: number, round: number, type: HistoricalMockDraftOrderType): number[] {
  const forward = Array.from({ length: teams }, (_, index) => index + 1);
  const reverse = [...forward].reverse();
  if (type === "snake") return round % 2 === 1 ? forward : reverse;
  if (round === 1) return forward;
  if (round === 2 || round === 3) return reverse;
  return round % 2 === 0 ? forward : reverse;
}

function simulateStrategyDraft(input: {
  strategy: HistoricalMockDraftStrategy;
  scenario: HistoricalMockDraftScenario;
  draftOrder: HistoricalMockDraftOrderPick[];
}): HistoricalMockDraftStrategyResult {
  const available = new Map(input.scenario.playerUniverseInput.players.map((player) => [player.playerId, player]));
  const rosters = new Map<number, HistoricalMockDraftPickLog[]>();
  const pickLog: HistoricalMockDraftPickLog[] = [];
  const fallback = input.strategy === "blackbird_rank_only" && input.scenario.playerUniverseInput.players.some((player) => !player.blackbirdRank)
    ? "blackbirdRank missing for at least one player; internalDraftRank/projection fallback used where needed."
    : null;

  for (const orderPick of input.draftOrder) {
    const roster = rosters.get(orderPick.draftSlot) ?? [];
    const player = choosePlayer({
      strategy: input.strategy,
      available: [...available.values()],
      roster,
      seed: input.scenario.randomSeed + orderPick.overallPick,
    });
    if (!player) continue;
    available.delete(player.playerId);
    const log: HistoricalMockDraftPickLog = {
      ...orderPick,
      strategy: input.strategy,
      playerId: player.playerId,
      playerName: player.playerName,
      position: normalizePosition(player.position),
      nflTeam: player.nflTeam,
      rankSource: rankSource(input.strategy, player),
    };
    pickLog.push(log);
    rosters.set(orderPick.draftSlot, [...roster, log]);
  }

  const myTeamRoster = rosters.get(input.scenario.myDraftSlot) ?? [];
  const capture = buildCaptureInput(input.scenario, input.strategy, pickLog);
  const review = input.strategy === "blackbird_rank_only"
    ? buildMockDraftResultCaptureReport({ projectionSeason: input.scenario.historicalSeason, capture })
    : null;

  return {
    strategy: input.strategy,
    teamRosters: input.scenario.draftSlots.map((slot) => ({ draftSlot: slot, picks: rosters.get(slot) ?? [] })),
    pickLog,
    myTeamRoster,
    positionCounts: countPositions(myTeamRoster),
    starterCoverageEstimate: starterCoverage(myTeamRoster),
    benchDepthEstimate: benchDepth(myTeamRoster),
    draftCapitalByPosition: draftCapitalByPosition(myTeamRoster),
    reachesValueNotes: reachesValueNotes(input.strategy, pickLog),
    blackbirdFallbackUsed: fallback,
    rosterReview: review,
  };
}

function choosePlayer(input: {
  strategy: HistoricalMockDraftStrategy;
  available: HistoricalMockDraftPlayer[];
  roster: HistoricalMockDraftPickLog[];
  seed: number;
}): HistoricalMockDraftPlayer | null {
  if (!input.available.length) return null;
  if (input.strategy === "need_based") {
    const need = biggestNeed(input.roster);
    return sortByStrategy(input.available.filter((player) => normalizePosition(player.position) === need), "projection_only")[0]
      ?? sortByStrategy(input.available, "projection_only")[0];
  }
  if (input.strategy === "random_within_adp_band") {
    const band = sortByStrategy(input.available, "adp_only").slice(0, Math.min(5, input.available.length));
    return band[Math.floor(seededRandom(input.seed) * band.length)];
  }
  return sortByStrategy(input.available, input.strategy)[0];
}

function sortByStrategy(players: HistoricalMockDraftPlayer[], strategy: HistoricalMockDraftStrategy): HistoricalMockDraftPlayer[] {
  return [...players].sort((a, b) => rankFor(a, strategy) - rankFor(b, strategy) || a.playerName.localeCompare(b.playerName));
}

function rankFor(player: HistoricalMockDraftPlayer, strategy: HistoricalMockDraftStrategy): number {
  if (strategy === "blackbird_rank_only") return player.blackbirdRank ?? player.internalDraftRank ?? player.projectionRank ?? Number.MAX_SAFE_INTEGER;
  if (strategy === "projection_only" || strategy === "need_based") return player.projectionRank ?? Number.MAX_SAFE_INTEGER;
  if (strategy === "adp_only" || strategy === "random_within_adp_band") return player.adpRank ?? Number.MAX_SAFE_INTEGER;
  if (strategy === "market_rank") return player.marketRank ?? Number.MAX_SAFE_INTEGER;
  return Number.MAX_SAFE_INTEGER;
}

function rankSource(strategy: HistoricalMockDraftStrategy, player: HistoricalMockDraftPlayer): string {
  if (strategy === "blackbird_rank_only") return player.blackbirdRank ? "blackbirdRank" : player.internalDraftRank ? "internalDraftRank" : "projectionRankFallback";
  if (strategy === "projection_only" || strategy === "need_based") return "projectionRank";
  if (strategy === "adp_only" || strategy === "random_within_adp_band") return "adpRank";
  return "marketRank";
}

function biggestNeed(roster: HistoricalMockDraftPickLog[]): string {
  const counts = countPositions(roster);
  return Object.entries(STARTER_TARGETS).sort((a, b) => ((counts[a[0]] ?? 0) / a[1]) - ((counts[b[0]] ?? 0) / b[1]))[0]?.[0] ?? "WR";
}

function buildCaptureInput(
  scenario: HistoricalMockDraftScenario,
  strategy: HistoricalMockDraftStrategy,
  pickLog: HistoricalMockDraftPickLog[],
): MockDraftResultCaptureInput {
  return {
    season: scenario.historicalSeason,
    leagueSettings: { leagueType: scenario.leagueType, teams: scenario.teams, strategy },
    scoringSettings: scenario.scoringSettings,
    rosterSettings: scenario.rosterSettings,
    teams: scenario.draftSlots.map((slot) => ({ teamId: `slot-${slot}`, draftSlot: slot })),
    myTeamId: `slot-${scenario.myDraftSlot}`,
    myDraftSlot: scenario.myDraftSlot,
    draftRounds: scenario.rounds,
    picks: pickLog.map((pick) => ({
      pickNumber: pick.overallPick,
      round: pick.round,
      draftSlot: pick.draftSlot,
      teamId: `slot-${pick.draftSlot}`,
      playerId: pick.playerId,
      playerName: pick.playerName,
      position: pick.position,
      nflTeam: pick.nflTeam,
      actualPickMade: true,
    })),
    humanReview: { looks_good: null, human_grade: null, human_notes: "", issue_tags: [] },
  };
}

function countPositions(picks: Array<{ position: string }>): Record<string, number> {
  return picks.reduce<Record<string, number>>((acc, pick) => {
    const position = normalizePosition(pick.position);
    acc[position] = (acc[position] ?? 0) + 1;
    return acc;
  }, {});
}

function starterCoverage(picks: HistoricalMockDraftPickLog[]): string {
  const holes = Object.entries(STARTER_TARGETS).filter(([pos, target]) => (countPositions(picks)[pos] ?? 0) < target).map(([pos]) => pos);
  return holes.length ? `Starter holes: ${holes.join(", ")}` : "Core starters covered.";
}

function benchDepth(picks: HistoricalMockDraftPickLog[]): string {
  const starterTotal = Object.values(STARTER_TARGETS).reduce((sum, value) => sum + value, 0);
  return picks.length > starterTotal ? `${picks.length - starterTotal} bench/depth picks.` : "No bench depth beyond core starters yet.";
}

function draftCapitalByPosition(picks: HistoricalMockDraftPickLog[]): Record<string, number[]> {
  return picks.reduce<Record<string, number[]>>((acc, pick) => {
    acc[pick.position] = [...(acc[pick.position] ?? []), pick.round];
    return acc;
  }, {});
}

function reachesValueNotes(strategy: HistoricalMockDraftStrategy, picks: HistoricalMockDraftPickLog[]): string[] {
  if (!picks.length) return [];
  return [`${strategy} selected ${picks.length} players without duplicates; source-rank reach/value scoring deferred to H37 outcome analysis.`];
}

function normalizePosition(position: string): string {
  const upper = position.toUpperCase();
  if (["DEF", "D/ST"].includes(upper)) return "DST";
  if (["DL", "LB", "DB"].includes(upper)) return "IDP";
  return upper;
}

function seededRandom(seed: number): number {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function renderMarkdown(report: HistoricalMockDraftEngineReport): string {
  return `${[
    "# Historical Mock Draft Engine",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Projection season: ${report.projectionSeason}`,
    `- Recommendation: ${report.recommendation}`,
    `- Draft order: ${report.draftOrderType}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Strategies",
    "",
    "| Strategy | Picks | My roster | Starter coverage | Bench depth |",
    "| --- | --- | --- | --- | --- |",
    ...report.strategyResults.map((result) => `| ${result.strategy} | ${result.pickLog.length} | ${result.myTeamRoster.map((pick) => `${pick.playerName} (${pick.position})`).join(", ")} | ${result.starterCoverageEstimate} | ${result.benchDepthEstimate} |`),
    "",
    "## Data Leakage Guard",
    "",
    `- Actual season scoring loaded: ${report.dataLeakageGuard.actualSeasonScoringLoaded}`,
    `- Future outcome fields used: ${report.dataLeakageGuard.futureOutcomeFieldsUsed}`,
    "",
    ...report.dataLeakageGuard.allowedDraftTimeInputs.map((item) => `- Allowed: ${item}`),
    ...report.dataLeakageGuard.disallowedOutcomeInputs.map((item) => `- Disallowed: ${item}`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: HistoricalMockDraftEngineReport): string {
  const rows = [["strategy", "overall_pick", "round", "draft_slot", "player_id", "player_name", "position", "rank_source"]];
  for (const result of report.strategyResults) {
    for (const pick of result.pickLog) {
      rows.push([result.strategy, String(pick.overallPick), String(pick.round), String(pick.draftSlot), pick.playerId, pick.playerName, pick.position, pick.rankSource]);
    }
  }
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}
