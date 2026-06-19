import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildMockDraftResultCaptureReport,
  compareRecommendations,
  reconstructTeamRosters,
  writeMockDraftResultCaptureArtifacts,
} from "./mock-draft-result-capture";
import type { MockDraftResultCaptureInput } from "./mock-draft-result-capture-types";

describe("mock draft result capture", () => {
  it("parses mock draft results and reconstructs rosters", () => {
    const rosters = reconstructTeamRosters(capture());

    expect(rosters).toHaveLength(2);
    expect(rosters[0].teamId).toBe("team-1");
    expect(rosters[1].byPosition.WR).toHaveLength(1);
  });

  it("generates my team roster review and position allocation", () => {
    const report = buildMockDraftResultCaptureReport({ projectionSeason: 2026, capture: capture() });

    expect(report.recommendation).toBe("mock_draft_roster_review_ready_for_human_review");
    expect(report.myRosterByPosition).toMatchObject({ WR: ["Wide One (WR, DAL)"], RB: ["Back One (RB, BUF)"] });
    expect(report.positionAllocation).toMatchObject({ WR: 1, RB: 1, QB: 1, TE: 1 });
    expect(report.roundByRoundTeamBuild).toHaveLength(4);
  });

  it("generates starter and bench summaries plus all-team summary", () => {
    const report = buildMockDraftResultCaptureReport({ projectionSeason: 2026, capture: capture() });

    expect(report.starterCandidates).toEqual(expect.arrayContaining(["Wide One (WR, DAL)", "Back One (RB, BUF)"]));
    expect(report.benchDepth).toEqual([]);
    expect(report.allTeamSummary).toHaveLength(2);
    expect(report.allTeamSummary[0]).toHaveProperty("overallStructureGrade");
  });

  it("preserves human review fields and validates issue tags", () => {
    const input = capture();
    input.humanReview.issue_tags = ["great_structure", "bad_tag"];
    const report = buildMockDraftResultCaptureReport({ projectionSeason: 2026, capture: input });

    expect(report.humanReview.looks_good).toBeNull();
    expect(report.invalidIssueTags).toEqual(["bad_tag"]);
    expect(report.recommendation).toBe("mock_draft_roster_review_needs_bugfix");
  });

  it("reports recommendation comparison when snapshots are present", () => {
    const report = buildMockDraftResultCaptureReport({ projectionSeason: 2026, capture: capture() });

    expect(report.recommendationComparison).toMatchObject({
      status: "available",
      totalCompared: 1,
      actualPickMatchedTopRecommendation: 1,
      actualPickMatchedTop3: 1,
      actualPickMatchedTop5: 1,
    });
  });

  it("reports recommendation comparison missing behavior", () => {
    const picks = capture().picks.map((pick) => ({ ...pick, blackbirdRecommendation: null }));

    expect(compareRecommendations(picks)).toMatchObject({
      status: "recommendation_comparison_not_available",
      totalCompared: 0,
    });
  });

  it("aggregates transparent grades", () => {
    const report = buildMockDraftResultCaptureReport({ projectionSeason: 2026, capture: capture() });

    expect(report.grades).toMatchObject({
      roster_structure_grade: expect.any(String),
      starter_strength_grade: expect.any(String),
      depth_grade: expect.any(String),
      value_grade: "A",
      risk_grade: expect.any(String),
      format_fit_grade: expect.any(String),
      overall_grade: expect.any(String),
    });
    expect(report.grades.logic.join(" ")).toContain("Overall is the simple average");
  });

  it("writes artifacts and reports no live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "mock-capture-"));
    try {
      const report = buildMockDraftResultCaptureReport({ projectionSeason: 2026, capture: capture() });
      const artifacts = writeMockDraftResultCaptureArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function capture(): MockDraftResultCaptureInput {
  return {
    season: 2026,
    leagueSettings: { teams: 2 },
    scoringSettings: {},
    rosterSettings: { QB: 1, RB: 1, WR: 1, TE: 1 },
    teams: [
      { teamId: "team-1", draftSlot: 1 },
      { teamId: "team-2", draftSlot: 2 },
    ],
    myTeamId: "team-2",
    myDraftSlot: 2,
    draftRounds: 4,
    picks: [
      pick(1, 1, "team-1", "Quarter One", "QB", "KC"),
      {
        ...pick(2, 1, "team-2", "Wide One", "WR", "DAL"),
        blackbirdRecommendation: {
          topPlayerId: "p2",
          topPlayerName: "Wide One",
          top3PlayerIds: ["p2", "p3", "p4"],
          top5PlayerIds: ["p2", "p3", "p4", "p5", "p6"],
          reason: "Best value.",
        },
      },
      pick(3, 2, "team-2", "Back One", "RB", "BUF"),
      pick(4, 2, "team-1", "Wide Two", "WR", "PHI"),
      pick(5, 3, "team-1", "Back Two", "RB", "SF"),
      pick(6, 3, "team-2", "Quarter Two", "QB", "LAC"),
      pick(7, 4, "team-2", "Tight One", "TE", "MIN"),
      pick(8, 4, "team-1", "Tight Two", "TE", "DET"),
    ],
    humanReview: {
      looks_good: null,
      human_grade: null,
      human_notes: "",
      issue_tags: [],
    },
  };
}

function pick(
  pickNumber: number,
  round: number,
  teamId: string,
  playerName: string,
  position: string,
  nflTeam: string,
) {
  const draftSlot = teamId === "team-1" ? 1 : 2;
  return {
    pickNumber,
    round,
    draftSlot,
    teamId,
    playerId: `p${pickNumber}`,
    sleeperId: `s${pickNumber}`,
    playerName,
    position,
    nflTeam,
    projectedPoints: 200 - pickNumber,
    actualPickMade: true,
  };
}
