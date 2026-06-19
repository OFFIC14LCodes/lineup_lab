import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  MOCK_DRAFT_ROSTER_ISSUE_TAGS,
  type MockDraftRosterPlayer,
  type MockDraftRosterReviewArtifactPaths,
  type MockDraftRosterReviewInput,
  type MockDraftRosterReviewReport,
} from "./mock-draft-roster-review-types";

export function buildMockDraftRosterReviewReport(input: {
  projectionSeason: number;
  review: MockDraftRosterReviewInput;
  inputPath?: string;
  generatedAt?: string;
}): MockDraftRosterReviewReport {
  const roster = input.review.myDraftedRoster.length ? input.review.myDraftedRoster : defaultTemplateRoster();
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    inputPath: input.inputPath ?? null,
    draftRoomId: input.review.draftRoomId,
    sections: buildRosterSections(input.review, roster),
    invalidIssueTags: validateIssueTags(input.review.humanReview.issue_tags),
    humanReview: input.review.humanReview,
    safetyGates: safetyGates(),
  };
}

export function runMockDraftRosterReview(input: {
  projectionSeason: number;
  inputPath: string;
  cwd?: string;
}): MockDraftRosterReviewReport {
  const cwd = input.cwd ?? process.cwd();
  const review = JSON.parse(readFileSync(path.resolve(cwd, input.inputPath), "utf8")) as MockDraftRosterReviewInput;
  return buildMockDraftRosterReviewReport({
    projectionSeason: input.projectionSeason,
    review,
    inputPath: input.inputPath,
  });
}

export function writeMockDraftRosterReviewArtifacts(
  report: MockDraftRosterReviewReport,
  cwd = process.cwd(),
): MockDraftRosterReviewArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "war-room");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `mock-draft-roster-review-${report.projectionSeason}.json`);
  const markdownPath = path.join(artifactDir, `mock-draft-roster-review-${report.projectionSeason}.md`);
  const csvPath = path.join(artifactDir, `mock-draft-roster-review-${report.projectionSeason}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  writeFileSync(csvPath, renderCsv(report));
  return { jsonPath, markdownPath, csvPath };
}

export function validateIssueTags(tags: string[]): string[] {
  const allowed = new Set<string>(MOCK_DRAFT_ROSTER_ISSUE_TAGS);
  return tags.filter((tag) => !allowed.has(tag));
}

function buildRosterSections(input: MockDraftRosterReviewInput, roster: MockDraftRosterPlayer[]): Record<string, unknown> {
  const byPosition = roster.reduce<Record<string, number>>((acc, player) => {
    acc[player.position] = (acc[player.position] ?? 0) + 1;
    return acc;
  }, {});
  const sorted = [...roster].sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0));
  return {
    finalRosterByPosition: byPosition,
    projectedStartingLineup: sorted.slice(0, 10).map(playerSummary),
    benchDepthStructure: sorted.slice(10).map(playerSummary),
    positionAllocation: byPosition,
    stackCorrelationReview: "Template review: identify QB/WR/TE/team correlations after a filled mock draft.",
    byeWeekReview: "Template review: inspect bye week clusters when bye data is present.",
    rosterConstructionStrengths: [],
    rosterConstructionWeaknesses: [],
    valuePicks: [],
    reachPicks: [],
    missedOpportunities: [],
    riskProfile: roster.flatMap((player) => player.riskTags ?? []),
    floorCeilingBalance: "Template review: compare projected starters, bench upside, and fragile profiles.",
    formatFit: `Draft slot ${input.draftSlot}; league/scoring/roster settings are captured for human review.`,
    humanReviewNotes: input.humanReview.human_notes,
    overallRosterGrade: input.humanReview.human_grade,
  };
}

function defaultTemplateRoster(): MockDraftRosterPlayer[] {
  return [
    { playerId: "template-qb", playerName: "Template QB", position: "QB", team: "TBD", projectedPoints: null },
    { playerId: "template-rb", playerName: "Template RB", position: "RB", team: "TBD", projectedPoints: null },
    { playerId: "template-wr", playerName: "Template WR", position: "WR", team: "TBD", projectedPoints: null },
    { playerId: "template-te", playerName: "Template TE", position: "TE", team: "TBD", projectedPoints: null },
  ];
}

function playerSummary(player: MockDraftRosterPlayer): string {
  return `${player.playerName} (${player.position}${player.team ? `, ${player.team}` : ""})`;
}

function safetyGates() {
  return [
    { name: "no_live_outputs_changed", passed: true, detail: "Roster review reads local draft-result JSON only." },
    { name: "no_supabase_writes", passed: true, detail: "No Supabase client is imported or called." },
    { name: "rankings_unchanged", passed: true, detail: "Blackbird Rank ordering is not imported or recalculated." },
    { name: "draft_suggestions_unchanged", passed: true, detail: "Draft Suggestion ordering is not imported or recalculated." },
    { name: "war_room_scoring_unchanged", passed: true, detail: "War Room scoring logic is not imported or recalculated." },
    { name: "v8_2_not_enabled", passed: true, detail: "No feature flag is read or written." },
    { name: "mock_review_read_only", passed: true, detail: "Report generation is dry-run/read-only." },
  ];
}

function renderMarkdown(report: MockDraftRosterReviewReport): string {
  return `${[
    "# Mock Draft Roster Review",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Projection season: ${report.projectionSeason}`,
    `- Draft room: ${report.draftRoomId}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Human Review",
    "",
    `- Looks good: ${String(report.humanReview.looks_good)}`,
    `- Human grade: ${report.humanReview.human_grade ?? ""}`,
    `- Issue tags: ${report.humanReview.issue_tags.join(", ") || "none"}`,
    `- Invalid issue tags: ${report.invalidIssueTags.join(", ") || "none"}`,
    "",
    "## Review Sections",
    "",
    ...Object.keys(report.sections).map((section) => `- ${section}`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: MockDraftRosterReviewReport): string {
  const rows = [["section", "value"]];
  for (const [section, value] of Object.entries(report.sections)) {
    rows.push([section, JSON.stringify(value)]);
  }
  rows.push(["invalid_issue_tags", report.invalidIssueTags.join("|")]);
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}
