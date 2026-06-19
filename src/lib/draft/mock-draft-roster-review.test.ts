import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildMockDraftRosterReviewReport,
  validateIssueTags,
  writeMockDraftRosterReviewArtifacts,
} from "./mock-draft-roster-review";
import type { MockDraftRosterReviewInput } from "./mock-draft-roster-review-types";

describe("mock draft roster review", () => {
  it("generates roster review sections from template input", () => {
    const report = buildMockDraftRosterReviewReport({ projectionSeason: 2026, review: review() });

    expect(Object.keys(report.sections)).toEqual(
      expect.arrayContaining([
        "finalRosterByPosition",
        "projectedStartingLineup",
        "benchDepthStructure",
        "valuePicks",
        "reachPicks",
        "missedOpportunities",
        "overallRosterGrade",
      ]),
    );
  });

  it("preserves human review fields", () => {
    const report = buildMockDraftRosterReviewReport({ projectionSeason: 2026, review: review() });

    expect(report.humanReview).toMatchObject({
      looks_good: null,
      human_grade: null,
      human_notes: "",
      issue_tags: ["great_structure"],
    });
  });

  it("validates issue tags", () => {
    expect(validateIssueTags(["great_value", "bad_tag"])).toEqual(["bad_tag"]);
  });

  it("writes artifacts and reports no live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "roster-review-"));
    try {
      const report = buildMockDraftRosterReviewReport({ projectionSeason: 2026, review: review() });
      const artifacts = writeMockDraftRosterReviewArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function review(): MockDraftRosterReviewInput {
  return {
    draftRoomId: "template",
    season: 2026,
    leagueSettings: {},
    scoringSettings: {},
    rosterSettings: {},
    draftSlot: 5,
    picks: [],
    myDraftedRoster: [
      { playerId: "1", playerName: "QB One", position: "QB", team: "KC", projectedPoints: 300 },
      { playerId: "2", playerName: "RB One", position: "RB", team: "BUF", projectedPoints: 220 },
      { playerId: "3", playerName: "WR One", position: "WR", team: "DAL", projectedPoints: 210 },
    ],
    allDraftedRosters: [],
    recommendationsAtPicks: [],
    availableBoardStates: [],
    humanReview: {
      looks_good: null,
      human_grade: null,
      human_notes: "",
      issue_tags: ["great_structure"],
    },
  };
}
