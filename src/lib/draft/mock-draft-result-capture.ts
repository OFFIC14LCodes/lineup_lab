import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { validateIssueTags } from "./mock-draft-roster-review";
import type {
  MockDraftGradeSummary,
  MockDraftRecommendationComparison,
  MockDraftResultCaptureArtifactPaths,
  MockDraftResultCaptureInput,
  MockDraftResultCaptureRecommendation,
  MockDraftResultCaptureReport,
  MockDraftResultPick,
  MockDraftTeamRoster,
  MockDraftTeamSummary,
} from "./mock-draft-result-capture-types";

const STARTER_TARGETS = { QB: 1, RB: 2, WR: 2, TE: 1 } as const;
const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB", "IDP"];

export function buildMockDraftResultCaptureReport(input: {
  projectionSeason: number;
  capture: MockDraftResultCaptureInput;
  inputPath?: string;
  generatedAt?: string;
}): MockDraftResultCaptureReport {
  const allTeamRosters = reconstructTeamRosters(input.capture);
  const myRoster = allTeamRosters.find((team) => team.teamId === input.capture.myTeamId);
  const myPicks = myRoster?.picks ?? [];
  const positionAllocation = countPositions(myPicks);
  const starterCandidates = selectStarterCandidates(myPicks);
  const benchDepth = myPicks.filter((pick) => !starterCandidates.includes(playerLabel(pick))).map(playerLabel);
  const grades = gradeRoster(myPicks, positionAllocation, input.capture);
  const invalidIssueTags = validateIssueTags(input.capture.humanReview.issue_tags);
  const recommendation = recommend(input.capture, myPicks, invalidIssueTags);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    inputPath: input.inputPath ?? null,
    recommendation,
    allTeamRosters,
    myRosterByPosition: Object.fromEntries(
      Object.entries(groupByPosition(myPicks)).map(([position, picks]) => [position, picks.map(playerLabel)]),
    ),
    starterCandidates,
    benchDepth,
    positionAllocation,
    draftCapitalByPosition: buildDraftCapitalByPosition(myPicks),
    roundByRoundTeamBuild: myPicks
      .sort((a, b) => a.pickNumber - b.pickNumber)
      .map((pick) => ({ round: pick.round, playerName: pick.playerName, position: pick.position, pickNumber: pick.pickNumber })),
    myTeamReview: buildMyTeamReview(myPicks, input.capture, grades),
    allTeamSummary: allTeamRosters.map((team) => summarizeTeam(team)),
    recommendationComparison: compareRecommendations(myPicks),
    grades,
    invalidIssueTags,
    humanReview: input.capture.humanReview,
    safetyGates: safetyGates(),
  };
}

export function runMockDraftResultCapture(input: {
  projectionSeason: number;
  inputPath: string;
  cwd?: string;
}): MockDraftResultCaptureReport {
  const cwd = input.cwd ?? process.cwd();
  const capture = JSON.parse(readFileSync(path.resolve(cwd, input.inputPath), "utf8")) as MockDraftResultCaptureInput;
  return buildMockDraftResultCaptureReport({
    projectionSeason: input.projectionSeason,
    capture,
    inputPath: input.inputPath,
  });
}

export function writeMockDraftResultCaptureArtifacts(
  report: MockDraftResultCaptureReport,
  cwd = process.cwd(),
): MockDraftResultCaptureArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "war-room");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `mock-draft-result-capture-${report.projectionSeason}.json`);
  const markdownPath = path.join(artifactDir, `mock-draft-result-capture-${report.projectionSeason}.md`);
  const csvPath = path.join(artifactDir, `mock-draft-result-capture-${report.projectionSeason}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  writeFileSync(csvPath, renderCsv(report));
  return { jsonPath, markdownPath, csvPath };
}

export function reconstructTeamRosters(input: MockDraftResultCaptureInput): MockDraftTeamRoster[] {
  return input.teams
    .map((team) => {
      const picks = input.picks.filter((pick) => pick.teamId === team.teamId).sort((a, b) => a.pickNumber - b.pickNumber);
      return {
        teamId: team.teamId,
        draftSlot: team.draftSlot,
        picks,
        byPosition: groupByPosition(picks),
      };
    })
    .sort((a, b) => a.draftSlot - b.draftSlot);
}

function buildMyTeamReview(
  picks: MockDraftResultPick[],
  input: MockDraftResultCaptureInput,
  grades: MockDraftGradeSummary,
): Record<string, unknown> {
  const byPosition = groupByPosition(picks);
  return {
    finalRosterByPosition: Object.fromEntries(Object.entries(byPosition).map(([position, rows]) => [position, rows.map(playerLabel)])),
    projectedStartingLineup: selectStarterCandidates(picks),
    benchDepthStructure: picks.filter((pick) => !selectStarterCandidates(picks).includes(playerLabel(pick))).map(playerLabel),
    positionAllocation: countPositions(picks),
    stackCorrelationReview: stackNotes(picks),
    byeWeekReview: byeWeekNotes(picks),
    rosterConstructionStrengths: strengthsFor(picks),
    rosterConstructionWeaknesses: weaknessesFor(picks),
    valuePicks: valuePicks(picks),
    reachPicks: [],
    missedOpportunities: missedOpportunities(compareRecommendations(picks)),
    riskProfile: riskProfile(picks),
    floorCeilingBalance: "Conservative template balance: grade uses starters, depth, value, risk, and format fit.",
    formatFit: `Draft slot ${input.myDraftSlot}; roster settings captured for human review.`,
    humanReviewNotes: input.humanReview.human_notes,
    overallRosterGrade: grades.overall_grade,
  };
}

function summarizeTeam(team: MockDraftTeamRoster): MockDraftTeamSummary {
  const counts = countPositions(team.picks);
  const holes = obviousRosterHoles(counts);
  return {
    teamId: team.teamId,
    draftSlot: team.draftSlot,
    counts,
    starterCoverage: holes.length ? `Missing ${holes.join(", ")}` : "Core starter positions covered.",
    benchDepth: team.picks.length > Object.values(STARTER_TARGETS).reduce((sum, value) => sum + value, 0) ? "Bench depth present." : "Depth still developing.",
    stackCorrelationNotes: stackNotes(team.picks),
    obviousRosterHoles: holes,
    overallStructureGrade: letterGrade(100 - holes.length * 15),
  };
}

export function compareRecommendations(picks: MockDraftResultPick[]): MockDraftRecommendationComparison {
  const comparable = picks.filter((pick) => pick.blackbirdRecommendation);
  if (!comparable.length) {
    return {
      status: "recommendation_comparison_not_available",
      totalCompared: 0,
      actualPickMatchedTopRecommendation: 0,
      actualPickMatchedTop3: 0,
      actualPickMatchedTop5: 0,
      missedRecommendationCandidates: [],
      divergences: [],
    };
  }
  const top = comparable.filter((pick) => pick.blackbirdRecommendation?.topPlayerId === pick.playerId);
  const top3 = comparable.filter((pick) => pick.blackbirdRecommendation?.top3PlayerIds?.includes(pick.playerId));
  const top5 = comparable.filter((pick) => pick.blackbirdRecommendation?.top5PlayerIds?.includes(pick.playerId));
  const divergences = comparable
    .filter((pick) => pick.blackbirdRecommendation?.topPlayerId && pick.blackbirdRecommendation.topPlayerId !== pick.playerId)
    .map((pick) => ({
      pickNumber: pick.pickNumber,
      actualPlayerId: pick.playerId,
      topPlayerId: pick.blackbirdRecommendation?.topPlayerId ?? null,
      reason: pick.blackbirdRecommendation?.reason ?? null,
    }));
  return {
    status: "available",
    totalCompared: comparable.length,
    actualPickMatchedTopRecommendation: top.length,
    actualPickMatchedTop3: top3.length,
    actualPickMatchedTop5: top5.length,
    missedRecommendationCandidates: divergences.map((item) => item.topPlayerId).filter((value): value is string => Boolean(value)),
    divergences,
  };
}

function gradeRoster(
  picks: MockDraftResultPick[],
  counts: Record<string, number>,
  input: MockDraftResultCaptureInput,
): MockDraftGradeSummary {
  const holes = obviousRosterHoles(counts).length;
  const depth = Math.max(0, picks.length - 6);
  const recommendations = compareRecommendations(picks);
  const valueScore =
    recommendations.status === "available" && recommendations.totalCompared > 0
      ? Math.round((recommendations.actualPickMatchedTop5 / recommendations.totalCompared) * 100)
      : 75;
  const riskPenalty = picks.flatMap((pick) => pick.riskTags ?? []).length * 5;
  const structureScore = 100 - holes * 15;
  const starterScore = 100 - holes * 20;
  const depthScore = Math.min(100, 70 + depth * 5);
  const riskScore = Math.max(50, 90 - riskPenalty);
  const formatFitScore = input.rosterSettings ? 85 : 75;
  const overall = Math.round((structureScore + starterScore + depthScore + valueScore + riskScore + formatFitScore) / 6);
  return {
    roster_structure_grade: letterGrade(structureScore),
    starter_strength_grade: letterGrade(starterScore),
    depth_grade: letterGrade(depthScore),
    value_grade: letterGrade(valueScore),
    risk_grade: letterGrade(riskScore),
    format_fit_grade: letterGrade(formatFitScore),
    overall_grade: letterGrade(overall),
    logic: [
      "Roster structure starts at 100 and loses 15 points per obvious starter-position hole.",
      "Starter strength starts at 100 and loses 20 points per obvious starter-position hole.",
      "Depth starts at 70 and gains 5 points per bench candidate above core starters.",
      "Value uses top-5 recommendation match rate when recommendation snapshots exist; otherwise it defaults to a neutral 75.",
      "Risk starts at 90 and loses 5 points per risk tag.",
      "Overall is the simple average of structure, starter, depth, value, risk, and format-fit scores.",
    ],
  };
}

function recommend(
  input: MockDraftResultCaptureInput,
  myPicks: MockDraftResultPick[],
  invalidIssueTags: string[],
): MockDraftResultCaptureRecommendation {
  if (invalidIssueTags.length) return "mock_draft_roster_review_needs_bugfix";
  if (!input.teams.length || !input.picks.length || !input.myTeamId) return "mock_draft_roster_review_needs_input_data";
  if (!myPicks.length) return "mock_draft_roster_review_needs_input_data";
  return "mock_draft_roster_review_ready_for_human_review";
}

function groupByPosition(picks: MockDraftResultPick[]): Record<string, MockDraftResultPick[]> {
  return picks.reduce<Record<string, MockDraftResultPick[]>>((acc, pick) => {
    const position = normalizePosition(pick.position);
    acc[position] = [...(acc[position] ?? []), pick];
    return acc;
  }, {});
}

function countPositions(picks: MockDraftResultPick[]): Record<string, number> {
  const counts = Object.fromEntries(POSITION_ORDER.map((position) => [position, 0]));
  for (const pick of picks) {
    const position = normalizePosition(pick.position);
    counts[position] = (counts[position] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).filter(([, value]) => value > 0));
}

function selectStarterCandidates(picks: MockDraftResultPick[]): string[] {
  const byPosition = groupByPosition([...picks].sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0)));
  return Object.entries(STARTER_TARGETS).flatMap(([position, count]) => (byPosition[position] ?? []).slice(0, count).map(playerLabel));
}

function buildDraftCapitalByPosition(picks: MockDraftResultPick[]): Record<string, number[]> {
  return picks.reduce<Record<string, number[]>>((acc, pick) => {
    const position = normalizePosition(pick.position);
    acc[position] = [...(acc[position] ?? []), pick.round];
    return acc;
  }, {});
}

function stackNotes(picks: MockDraftResultPick[]): string[] {
  const qbTeams = new Set(picks.filter((pick) => normalizePosition(pick.position) === "QB").map((pick) => pick.nflTeam).filter(Boolean));
  const passCatchers = picks.filter((pick) => ["WR", "TE"].includes(normalizePosition(pick.position)) && pick.nflTeam && qbTeams.has(pick.nflTeam));
  return passCatchers.length ? passCatchers.map((pick) => `QB stack candidate with ${pick.playerName} (${pick.nflTeam}).`) : ["No obvious QB/pass-catcher stack detected."];
}

function byeWeekNotes(picks: MockDraftResultPick[]): string[] {
  const withBye = picks.filter((pick) => pick.byeWeek);
  if (!withBye.length) return ["Bye week data not available."];
  return Object.entries(
    withBye.reduce<Record<string, number>>((acc, pick) => {
      const week = String(pick.byeWeek);
      acc[week] = (acc[week] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([week, count]) => `Week ${week}: ${count} players.`);
}

function strengthsFor(picks: MockDraftResultPick[]): string[] {
  const counts = countPositions(picks);
  const strengths: string[] = [];
  if ((counts.WR ?? 0) >= 1) strengths.push("WR anchor present.");
  if ((counts.RB ?? 0) >= 1) strengths.push("RB starter candidate present.");
  if ((counts.QB ?? 0) >= 1) strengths.push("QB starter candidate present.");
  if ((counts.TE ?? 0) >= 1) strengths.push("TE starter candidate present.");
  return strengths;
}

function weaknessesFor(picks: MockDraftResultPick[]): string[] {
  return obviousRosterHoles(countPositions(picks)).map((position) => `${position} starter coverage is thin.`);
}

function valuePicks(picks: MockDraftResultPick[]): string[] {
  return picks
    .filter((pick) => pick.blackbirdRecommendation?.top5PlayerIds?.includes(pick.playerId))
    .map((pick) => `${pick.playerName} matched top-5 recommendation at pick ${pick.pickNumber}.`);
}

function missedOpportunities(comparison: MockDraftRecommendationComparison): string[] {
  if (comparison.status !== "available") return ["Recommendation comparison not available."];
  return comparison.missedRecommendationCandidates.map((playerId) => `Missed recommended candidate ${playerId}.`);
}

function riskProfile(picks: MockDraftResultPick[]): string[] {
  const tags = picks.flatMap((pick) => pick.riskTags ?? []);
  return tags.length ? tags : ["No explicit risk tags captured."];
}

function obviousRosterHoles(counts: Record<string, number>): string[] {
  return Object.entries(STARTER_TARGETS)
    .filter(([position, target]) => (counts[position] ?? 0) < target)
    .map(([position]) => position);
}

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function playerLabel(pick: MockDraftResultPick): string {
  return `${pick.playerName} (${normalizePosition(pick.position)}${pick.nflTeam ? `, ${pick.nflTeam}` : ""})`;
}

function normalizePosition(position: string): string {
  const normalized = position.toUpperCase();
  if (["DEF", "D/ST"].includes(normalized)) return "DST";
  if (["DL", "LB", "DB", "IDP"].includes(normalized)) return "IDP";
  return normalized;
}

function safetyGates() {
  return [
    { name: "no_live_outputs_changed", passed: true, detail: "Capture report reads local mock draft JSON only." },
    { name: "no_supabase_writes", passed: true, detail: "No Supabase client is imported or called." },
    { name: "rankings_unchanged", passed: true, detail: "Blackbird Rank ordering is not imported or recalculated." },
    { name: "draft_suggestions_unchanged", passed: true, detail: "Draft Suggestion ordering is not imported or recalculated." },
    { name: "war_room_scoring_unchanged", passed: true, detail: "War Room scoring logic is not imported or recalculated." },
    { name: "v8_2_not_enabled", passed: true, detail: "No feature flag is read or written." },
    { name: "mock_review_read_only", passed: true, detail: "Mock draft result capture is dry-run/read-only." },
  ];
}

function renderMarkdown(report: MockDraftResultCaptureReport): string {
  return `${[
    "# Mock Draft Result Capture",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Projection season: ${report.projectionSeason}`,
    `- Recommendation: ${report.recommendation}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## My Team Review",
    "",
    `- Overall grade: ${report.grades.overall_grade}`,
    `- Starter candidates: ${report.starterCandidates.join(", ") || "none"}`,
    `- Bench depth: ${report.benchDepth.join(", ") || "none"}`,
    "",
    "## Grade Logic",
    "",
    ...report.grades.logic.map((item) => `- ${item}`),
    "",
    "## All-Team Summary",
    "",
    "| Team | Slot | Counts | Holes | Grade |",
    "| --- | --- | --- | --- | --- |",
    ...report.allTeamSummary.map((team) => `| ${team.teamId} | ${team.draftSlot} | ${JSON.stringify(team.counts)} | ${team.obviousRosterHoles.join(", ") || "none"} | ${team.overallStructureGrade} |`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: MockDraftResultCaptureReport): string {
  const rows = [["team_id", "draft_slot", "counts", "starter_coverage", "bench_depth", "holes", "grade"]];
  for (const team of report.allTeamSummary) {
    rows.push([
      team.teamId,
      String(team.draftSlot),
      JSON.stringify(team.counts),
      team.starterCoverage,
      team.benchDepth,
      team.obviousRosterHoles.join("|"),
      team.overallStructureGrade,
    ]);
  }
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}
