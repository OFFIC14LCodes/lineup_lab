import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildManualQaTriage,
  buildWarRoomManualQaReport,
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
    expect(report.triage).toHaveLength(0);
  });

  it("passes with warnings for non-critical warnings", () => {
    const input = qa("pass");
    input.responsive_mobile = { status: "warn", critical: false, notes: "Needs spacing polish." };
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: input });

    expect(report.recommendation).toBe("war_room_manual_qa_passed_with_warnings");
    expect(report.triage[0]).toMatchObject({ severity: "low", area: "responsive_mobile" });
  });

  it("routes critical fails to bugfix triage", () => {
    const input = qa("pass");
    input.pick_updates = { status: "fail", critical: true, notes: "Pick did not update after sync." };
    const report = buildWarRoomManualQaReport({ projectionSeason: 2026, qa: input });

    expect(report.recommendation).toBe("war_room_manual_qa_needs_bugfix");
    expect(report.triage[0]).toMatchObject({ severity: "blocker", area: "pick_updates" });
  });

  it("blocks when required sections are missing", () => {
    const sections = [{ name: "environment", status: "pass", critical: true, notes: "" }] as WarRoomManualQaSection[];

    expect(recommendManualQa(sections, ["draft_connection"])).toBe("war_room_manual_qa_blocked");
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
