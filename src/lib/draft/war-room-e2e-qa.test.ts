import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildWarRoomE2eQaReport,
  writeWarRoomE2eQaArtifacts,
} from "./war-room-e2e-qa";
import type { WarRoomE2eQaPolicyReadiness, WarRoomE2eQaScenario } from "./war-room-e2e-qa-types";

describe("buildWarRoomE2eQaReport", () => {
  it("aggregates QA sections and recommends manual live QA after deterministic mock pass", () => {
    const report = buildWarRoomE2eQaReport(baseInput());

    expect(report.dryRun).toBe(true);
    expect(report.readOnly).toBe(true);
    expect(report.recommendation).toBe("war_room_e2e_ready_for_manual_live_test");
    expect(report.sections).toHaveLength(16);
    expect(report.sectionSummary.board_modes).toBe("pass");
    expect(report.sectionSummary.responsive_layout).toBe("warn");
    expect(report.safetyGates.every((gate) => gate.status === "pass")).toBe(true);
  });

  it("validates board mode and available/drafted player invariants", () => {
    const report = buildWarRoomE2eQaReport(baseInput());

    expect(report.boardInvariants).toEqual({
      draftSuggestionsOnlyAvailable: true,
      availableBlackbirdRankOnlyAvailable: true,
      fullBlackbirdRankIncludesDraftedAndUndrafted: true,
      fullBlackbirdRankMarksDrafted: true,
      draftedExcludedFromAvailableBoards: true,
    });
    expect(report.sectionSummary.available_player_filtering).toBe("pass");
    expect(report.sectionSummary.drafted_player_handling).toBe("pass");
  });

  it("validates before and after pick reactive state changes", () => {
    const report = buildWarRoomE2eQaReport(baseInput());

    expect(report.reactiveStateInvariants.availableCountDecreasesAfterPick).toBe(true);
    expect(report.reactiveStateInvariants.draftedPlayerDisappearsFromAvailableBoard).toBe(true);
    expect(report.reactiveStateInvariants.myRosterUpdatesForUserPick).toBe(true);
    expect(report.reactiveStateInvariants.rosterConstructionChangesAfterUserPick).toBe(true);
    expect(report.reactiveStateInvariants.planAlignmentRecalculatesAfterChange).toBe(true);
    expect(report.reactiveStateInvariants.gmBriefRecalculatesAfterChange).toBe(true);
    expect(report.reactiveStateInvariants.syncTimestampFreshnessUpdates).toBe(true);
  });

  it("validates player modal, search, filter, load-more, and sync checklists", () => {
    const report = buildWarRoomE2eQaReport(baseInput());

    expect(Object.values(report.playerModalChecklist).every(Boolean)).toBe(true);
    expect(Object.values(report.searchFilterLoadMoreChecklist).every(Boolean)).toBe(true);
    expect(Object.values(report.syncStatusChecklist).every(Boolean)).toBe(true);
    expect(report.sectionSummary.player_modal).toBe("pass");
    expect(report.sectionSummary.search_filter_load_more).toBe("pass");
    expect(report.sectionSummary.sync_status).toBe("pass");
    expect(report.sectionSummary.error_and_stale_states).toBe("pass");
  });

  it("validates data policy holdbacks and v8.2 safety", () => {
    const report = buildWarRoomE2eQaReport(baseInput());

    expect(report.sectionSummary.data_policy_holdbacks).toBe("pass");
    expect(report.sectionSummary.v8_2_safety).toBe("pass");
  });

  it("blocks when v8.2 safety evidence is missing", () => {
    const report = buildWarRoomE2eQaReport(baseInput({ v1Readiness: null }));

    expect(report.recommendation).toBe("war_room_e2e_blocked");
    expect(report.sectionSummary.v8_2_safety).toBe("fail");
  });
});

describe("writeWarRoomE2eQaArtifacts", () => {
  it("writes local report artifacts without live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "war-room-e2e-qa-"));
    try {
      const report = buildWarRoomE2eQaReport(baseInput());
      const artifacts = writeWarRoomE2eQaArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.safetyGates.find((gate) => gate.name === "no_supabase_writes")?.status).toBe("pass");
      expect(report.safetyGates.find((gate) => gate.name === "no_rank_or_suggestion_reorder")?.status).toBe("pass");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function baseInput(overrides: Partial<Parameters<typeof buildWarRoomE2eQaReport>[0]> = {}) {
  return {
    projectionSeason: 2026,
    scenario: scenario(),
    scenarioPath: "data/war-room/war-room-e2e-scenario.template.json",
    v1Readiness: readiness(),
    sourceText: [
      "Why Blackbird Likes",
      "Fit With Your Roster",
      "Projection Profile",
      "Risk and Confidence",
      "Draft Timing / Value Note",
      "Data Gaps / Things to Verify",
      "Filtered by:",
      "No players match this search.",
      "sm:",
      "lg:",
    ].join("\n"),
    generatedAt: "2026-06-18T12:00:00.000Z",
    ...overrides,
  };
}

function scenario(): WarRoomE2eQaScenario {
  return {
    season: 2026,
    leagueType: "dynasty",
    teams: 12,
    rounds: 20,
    draftSlot: 5,
    rosterSettings: {},
    scoringSettings: {},
    picks: [],
    myRoster: [],
    availablePlayersSample: [],
  };
}

function readiness(): WarRoomE2eQaPolicyReadiness {
  return {
    sourceMissing: false,
    recommendation: "war_room_v1_needs_e2e_draft_test",
    sourceHoldbackSummary: {
      depthChartSourceRowsHeldBack: 1101,
      depthChartUnmatchedRows: 1101,
      freeAgentUnknownRowsNotAutoPromoted: true,
      inactiveStaleRowsHeldBack: 138,
      kickerRowsNotAutoPromoted: true,
      legacyRowsBlockedArchive: true,
    },
    v82Safety: {
      enabled: false,
      defaultDisabled: true,
      controlledFlagReviewRemainsBlocked: true,
      zeroChecksPreserved: true,
      protectedZeroChecks: {
        kRowsUsingV82: true,
        criticalMoversUsingV82: true,
        meaningfulRankMoversUsingV82: true,
        legacyRowsUsingV82: true,
      },
    },
  };
}
