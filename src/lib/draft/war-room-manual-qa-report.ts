import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  WarRoomManualQaArtifactPaths,
  WarRoomManualQaInput,
  WarRoomManualQaRecommendation,
  WarRoomManualQaReport,
  WarRoomManualQaSection,
  WarRoomManualQaSectionName,
  WarRoomManualQaStatus,
  WarRoomManualQaTriageItem,
} from "./war-room-manual-qa-report-types";

export const WAR_ROOM_MANUAL_QA_SECTIONS: WarRoomManualQaSectionName[] = [
  "environment",
  "draft_connection",
  "draft_state_loading",
  "board_modes",
  "draft_suggestions",
  "full_blackbird_rank",
  "available_blackbird_rank",
  "available_filtering",
  "pick_updates",
  "roster_construction",
  "plan_alignment",
  "gm_brief",
  "player_modal",
  "search_filter_load_more",
  "sync_status",
  "error_stale_states",
  "responsive_desktop",
  "responsive_tablet",
  "responsive_mobile",
  "data_policy_holdbacks",
  "v8_2_safety",
  "console_errors",
];

const DEFAULT_CRITICAL = new Set<WarRoomManualQaSectionName>([
  "environment",
  "draft_connection",
  "draft_state_loading",
  "board_modes",
  "draft_suggestions",
  "full_blackbird_rank",
  "available_blackbird_rank",
  "available_filtering",
  "pick_updates",
  "sync_status",
  "data_policy_holdbacks",
  "v8_2_safety",
  "console_errors",
]);

export function buildWarRoomManualQaReport(input: {
  projectionSeason: number;
  qa: WarRoomManualQaInput;
  inputPath?: string;
  generatedAt?: string;
}): WarRoomManualQaReport {
  const sections = normalizeSections(input.qa);
  const missingRequiredSections = WAR_ROOM_MANUAL_QA_SECTIONS.filter((name) => !input.qa[name]);
  const summary = countStatuses(sections);
  const triage = buildManualQaTriage(sections, missingRequiredSections);
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    inputPath: input.inputPath ?? null,
    recommendation: recommendManualQa(sections, missingRequiredSections),
    sections,
    summary,
    missingRequiredSections,
    triage,
    safetyGates: [
      { name: "no_live_outputs_changed", passed: true, detail: "Manual QA report reads local JSON and writes local artifacts only." },
      { name: "no_supabase_writes", passed: true, detail: "No Supabase client is imported or called." },
      { name: "rankings_unchanged", passed: true, detail: "Blackbird Rank ordering is not imported or recalculated." },
      { name: "draft_suggestions_unchanged", passed: true, detail: "Draft Suggestion ordering is not imported or recalculated." },
      { name: "war_room_scoring_unchanged", passed: true, detail: "War Room scoring logic is not imported or recalculated." },
      { name: "v8_2_not_enabled", passed: true, detail: "This report does not read or write feature flags." },
    ],
    overallNotes: input.qa.overall_notes ?? "",
  };
}

export function runWarRoomManualQaReport(input: {
  projectionSeason: number;
  inputPath: string;
  cwd?: string;
}): WarRoomManualQaReport {
  const cwd = input.cwd ?? process.cwd();
  const fullPath = path.resolve(cwd, input.inputPath);
  const qa = JSON.parse(readFileSync(fullPath, "utf8")) as WarRoomManualQaInput;
  return buildWarRoomManualQaReport({
    projectionSeason: input.projectionSeason,
    qa,
    inputPath: input.inputPath,
  });
}

export function writeWarRoomManualQaArtifacts(
  report: WarRoomManualQaReport,
  cwd = process.cwd(),
): WarRoomManualQaArtifactPaths {
  const artifactDir = path.resolve(cwd, "artifacts", "war-room");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `war-room-manual-qa-report-${report.projectionSeason}.json`);
  const markdownPath = path.join(artifactDir, `war-room-manual-qa-report-${report.projectionSeason}.md`);
  const csvPath = path.join(artifactDir, `war-room-manual-qa-report-${report.projectionSeason}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  writeFileSync(csvPath, renderCsv(report));
  return { jsonPath, markdownPath, csvPath };
}

function normalizeSections(input: WarRoomManualQaInput): WarRoomManualQaSection[] {
  return WAR_ROOM_MANUAL_QA_SECTIONS.map((name) => ({
    name,
    status: input[name]?.status ?? "not_tested",
    critical: input[name]?.critical ?? DEFAULT_CRITICAL.has(name),
    notes: input[name]?.notes ?? "",
  }));
}

function countStatuses(sections: WarRoomManualQaSection[]): Record<WarRoomManualQaStatus, number> {
  return sections.reduce(
    (acc, section) => {
      acc[section.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, not_tested: 0 },
  );
}

export function recommendManualQa(
  sections: WarRoomManualQaSection[],
  missingRequiredSections: WarRoomManualQaSectionName[] = [],
): WarRoomManualQaRecommendation {
  if (missingRequiredSections.length > 0) return "war_room_manual_qa_blocked";
  if (sections.some((section) => section.status === "not_tested" && section.critical)) return "war_room_manual_qa_blocked";
  if (sections.some((section) => section.status === "fail")) return "war_room_manual_qa_needs_bugfix";
  if (sections.some((section) => section.status === "warn" || section.status === "not_tested")) return "war_room_manual_qa_passed_with_warnings";
  return "war_room_manual_qa_passed";
}

export function buildManualQaTriage(
  sections: WarRoomManualQaSection[],
  missingRequiredSections: WarRoomManualQaSectionName[] = [],
): WarRoomManualQaTriageItem[] {
  const missing = missingRequiredSections.map((area) => ({
    severity: "blocker" as const,
    area,
    description: "Required manual QA section is missing from the input.",
    suggested_next_action: "Add the missing section to the manual QA JSON and rerun the report.",
  }));
  const observed = sections
    .filter((section) => section.status !== "pass")
    .map((section) => ({
      severity: severityFor(section),
      area: section.name,
      description: section.notes || `${section.name} is ${section.status}.`,
      suggested_next_action: nextActionFor(section),
    }));
  return [...missing, ...observed];
}

function severityFor(section: WarRoomManualQaSection): WarRoomManualQaTriageItem["severity"] {
  if (section.status === "fail" && section.critical) return "blocker";
  if (section.status === "fail") return "high";
  if (section.status === "not_tested" && section.critical) return "blocker";
  if (section.status === "not_tested") return "medium";
  return section.critical ? "medium" : "low";
}

function nextActionFor(section: WarRoomManualQaSection): string {
  if (section.status === "fail") return "File a scoped UI/sync bug before launch readiness is approved.";
  if (section.status === "not_tested") return "Complete this browser QA step and rerun the report.";
  return "Review during final polish; ship only if the warning is acceptable.";
}

function renderMarkdown(report: WarRoomManualQaReport): string {
  return `${[
    "# War Room V1 Manual QA Report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Projection season: ${report.projectionSeason}`,
    `- Recommendation: ${report.recommendation}`,
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    "",
    "## Sections",
    "",
    "| Section | Status | Critical | Notes |",
    "| --- | --- | --- | --- |",
    ...report.sections.map((section) => `| ${section.name} | ${section.status} | ${section.critical} | ${(section.notes ?? "").replace(/\|/g, "/")} |`),
    "",
    "## Triage",
    "",
    "| Severity | Area | Suggested Next Action |",
    "| --- | --- | --- |",
    ...report.triage.map((item) => `| ${item.severity} | ${item.area} | ${item.suggested_next_action} |`),
    "",
  ].join("\n")}\n`;
}

function renderCsv(report: WarRoomManualQaReport): string {
  const rows = [["section", "status", "critical", "notes"]];
  for (const section of report.sections) {
    rows.push([section.name, section.status, String(section.critical), section.notes ?? ""]);
  }
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}
