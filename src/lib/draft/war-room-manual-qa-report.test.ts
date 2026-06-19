import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildManualQaTriage,
  buildWarRoomManualQaReport,
  recommendLaunchCandidate,
  recommendManualQa,
  WAR_ROOM_MANUAL_QA_SECTIONS,
  writeWarRoomManualQaArtifacts,
} from "./war-room-manual-qa-report";
import type { WarRoomManualQaInput, WarRoomManualQaSection } from "./war-room-manual-qa-report-types";

describe("war room manual QA report", () => {
  it("parses a template-shaped input and blocks while critical sections are not tested", () => {
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: qa("not_tested") });

    expect(report.sections).toHaveLength(WAR_ROOM_MANUAL_QA_SECTIONS.length);
    expect(report.recommendation).toBe("war_room_manual_qa_blocked");
    expect(report.summary.not_tested).toBe(WAR_ROOM_MANUAL_QA_SECTIONS.length);
  });

  it("passes when all sections pass", () => {
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: qa("pass") });

    expect(report.recommendation).toBe("war_room_manual_qa_passed");
    expect(report.launch_candidate_status).toBe("launch_candidate_pass");
    expect(report.triage).toHaveLength(0);
    expect(report.launch_candidate_triage).toHaveLength(0);
  });

  it("passes with warnings for non-critical warnings", () => {
    const input = qa("pass");
    input.responsive_mobile = { status: "warn", critical: false, notes: "Needs spacing polish." };
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: input });

    expect(report.recommendation).toBe("war_room_manual_qa_passed_with_warnings");
    expect(report.launch_candidate_status).toBe("launch_candidate_pass_with_warnings");
    expect(report.triage[0]).toMatchObject({ severity: "low", area: "responsive_mobile" });
    expect(report.launch_candidate_triage[0]).toMatchObject({
      area: "responsive_mobile",
      severity: "low",
      is_blocker: false,
      manual_retest_required: false,
    });
  });

  it("routes critical fails to bugfix triage", () => {
    const input = qa("pass");
    input.gm_brief = { status: "fail", critical: false, notes: "Brief is stale." };
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: input });

    expect(report.recommendation).toBe("war_room_manual_qa_needs_bugfix");
    expect(report.launch_candidate_status).toBe("launch_candidate_needs_bugfix");
    expect(report.triage[0]).toMatchObject({ severity: "high", area: "gm_brief" });
    expect(report.launch_candidate_triage[0]).toMatchObject({
      area: "gm_brief",
      severity: "high",
      is_blocker: false,
      recommended_fix_or_action: "File a scoped UI/sync bug and rerun manual QA after the fix.",
      manual_retest_required: true,
    });
  });

  it("blocks launch candidate when a blocker section fails", () => {
    const input = qa("pass");
    input.pick_updates = { status: "fail", critical: true, notes: "Pick did not update after sync." };
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: input });

    expect(report.recommendation).toBe("war_room_manual_qa_needs_bugfix");
    expect(report.launch_candidate_status).toBe("launch_candidate_blocked");
    expect(report.launch_candidate_triage[0]).toMatchObject({
      severity: "blocker",
      area: "pick_updates",
      is_blocker: true,
    });
  });

  it("blocks launch candidate when a required section is not tested", () => {
    const input = qa("pass");
    input.draft_suggestions = { status: "not_tested", critical: true, notes: "" };
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: input });

    expect(report.launch_candidate_status).toBe("launch_candidate_blocked");
    expect(report.launch_candidate_triage[0]).toMatchObject({
      severity: "blocker",
      area: "draft_suggestions",
      manual_retest_required: true,
    });
  });

  it("blocks when required sections are missing", () => {
    const sections = [{ name: "environment", status: "pass", critical: true, notes: "" }] as WarRoomManualQaSection[];

    expect(recommendManualQa(sections, ["draft_connection"])).toBe("war_room_manual_qa_blocked");
    expect(recommendLaunchCandidate(sections, ["draft_connection"])).toBe("launch_candidate_blocked");
    expect(buildManualQaTriage(sections, ["draft_connection"])[0]).toMatchObject({ severity: "blocker" });
  });

  it("writes local artifacts and reports no live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "manual-qa-"));
    try {
      const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: qa("pass") });
      const artifacts = writeWarRoomManualQaArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.launch_candidate_status).toBe("launch_candidate_pass");
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function qa(status: "pass" | "warn" | "fail" | "not_tested"): WarRoomManualQaInput {
  const input = {} as WarRoomManualQaInput;
  for (const name of WAR_ROOM_MANUAL_QA_SECTIONS) {
    input[name] = { status, critical: true, notes: "" };
  }
  return input;
}
