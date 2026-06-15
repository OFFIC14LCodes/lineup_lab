import { describe, expect, it } from "vitest";

import { buildCombinedProjectionReadModel, type CombinedProjectionRow } from "./combined-projection-read-model";
import { PROJECTION_METHOD } from "./constants";
import { H911_PROJECTION_METHOD } from "./idp-k-persistence";
import {
  DST_PREVIEW_WARNING,
  filterProjectionPreviewRows,
  summarizeProjectionPreview,
} from "./load-combined-projection-preview";

const league = {
  id: "league-1",
  name: "Fixture League",
  season: 2026,
  roster_positions_json: ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "DEF"],
  scoring_settings_json: {},
};

const runs = [
  {
    projection_run_id: "off-run",
    method: PROJECTION_METHOD,
    projection_version: 2,
    selection_scope: null,
    run_status: "complete",
    completed_at: "2026-06-14T00:00:00Z",
  },
  {
    projection_run_id: "idp-run",
    method: H911_PROJECTION_METHOD,
    projection_version: 1,
    selection_scope: null,
    run_status: "complete",
    completed_at: "2026-06-14T00:00:00Z",
  },
];

const players = [
  { id: "qb-1", full_name: "Avery Quarterback", team: "DAL", position: "QB", position_group: "QB" },
  { id: "wr-1", full_name: "Blake Wideout", team: "NYJ", position: "WR", position_group: "WR" },
  { id: "lb-1", full_name: "Casey Linebacker", team: "CHI", position: "LB", position_group: "LB" },
  { id: "k-1", full_name: "Devin Kicker", team: "MIA", position: "K", position_group: "K" },
];

const outputs = [
  output("off-run", "qb-1", "QB", 310, "medium", 1),
  output("off-run", "wr-1", "WR", 210, "high", 1),
  output("idp-run", "lb-1", "LB", 145, "low", 1),
  output("idp-run", "k-1", "K", 120, "very_low", 1),
];

const marketComparisons = [
  {
    projection_run_id: "off-run",
    canonical_player_id: "qb-1",
    league_id: "league-1",
    market_overall_adp: 24,
    market_position_rank: 3,
    rank_delta: 2,
    market_discrepancy_label: "ABOVE_MARKET",
    compatibility_label: "FULLY_COMPATIBLE",
    market_confidence_label: "medium",
    reason_codes: ["MARKET_COMPATIBLE"],
    format_warnings_json: [],
  },
];

const reasons = [
  {
    projection_run_id: "idp-run",
    canonical_player_id: "lb-1",
    league_id: "league-1",
    reason_code: "IDP_UNRESOLVED_ROWS_EXCLUDED",
    explanation: "Unresolved IDP rows excluded.",
  },
  {
    projection_run_id: "idp-run",
    canonical_player_id: "k-1",
    league_id: "league-1",
    reason_code: "K_TEAM_ENVIRONMENT_NOT_MODELED",
    explanation: "Kicker team environment not modeled.",
  },
];

describe("H9.14 combined projection preview helpers", () => {
  it("returns rows for a selected league through the H9.13 read model", () => {
    const model = fixtureModel();

    expect(model.rows.map((row) => row.leagueId)).toEqual(["league-1", "league-1", "league-1"]);
    expect(model.rows.map((row) => row.displayName)).toContain("Avery Quarterback");
  });

  it("keeps league relevance filtering and includeAllPositions override explicit", () => {
    const relevant = fixtureModel({ includeAllPositions: false });
    const all = fixtureModel({ includeAllPositions: true });

    expect(relevant.rows.map((row) => row.positionGroup)).not.toContain("K");
    expect(all.rows.map((row) => row.positionGroup)).toContain("K");
  });

  it("adds DST dry-run rows with warning and no persistence", () => {
    const model = fixtureModel({ includeDstDryRun: true });
    const dst = model.rows.find((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN");
    const summary = summarizeProjectionPreview({
      rows: model.rows,
      filters: { leagueId: "league-1", includeDstDryRun: true },
      leagues: [league],
      coverage: model.leagueCoverage[0],
      dstArtifactAvailable: true,
      marketComparisonsLoaded: true,
    });

    expect(dst).toMatchObject({
      entityType: "TEAM_DEFENSE",
      isPersisted: false,
      marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE",
    });
    expect(dst?.warningCodes).toContain("DST_BIG_PLAY_COMPONENTS_UNAVAILABLE");
    expect(summary.dstIncluded).toBe(true);
    expect(summary.dryRunRows).toBe(1);
    expect(DST_PREVIEW_WARNING).toContain("allowance-only");
  });

  it("labels IDP/K as not implemented for market and offensive rows as available or no compatible market", () => {
    const model = fixtureModel({ includeAllPositions: true });
    const qb = model.rows.find((row) => row.entityId === "qb-1");
    const wr = model.rows.find((row) => row.entityId === "wr-1");
    const lb = model.rows.find((row) => row.entityId === "lb-1");
    const kicker = model.rows.find((row) => row.entityId === "k-1");

    expect(qb?.marketComparisonStatus).toBe("AVAILABLE");
    expect(wr?.marketComparisonStatus).toBe("NO_COMPATIBLE_MARKET");
    expect(lb?.marketComparisonStatus).toBe("NOT_IMPLEMENTED_FOR_SOURCE");
    expect(kicker?.marketComparisonStatus).toBe("NOT_IMPLEMENTED_FOR_SOURCE");
  });

  it("filters deterministically by source, readiness, market status, confidence, and search", () => {
    const rows = fixtureModel({ includeAllPositions: true, includeDstDryRun: true }).rows;

    expect(filterProjectionPreviewRows(rows, { projectionSource: "IDP_K_BASELINE_V1" }).map(ids)).toEqual(["lb-1", "k-1"]);
    expect(filterProjectionPreviewRows(rows, { readiness: "READY" }).map(ids)).toEqual(["qb-1", "wr-1"]);
    expect(filterProjectionPreviewRows(rows, { marketStatus: "AVAILABLE" }).map(ids)).toEqual(["qb-1"]);
    expect(filterProjectionPreviewRows(rows, { confidenceLabel: "very_low" }).map(ids)).toEqual(["k-1", "DAL"]);
    expect(filterProjectionPreviewRows(rows, { search: "wideout" }).map(ids)).toEqual(["wr-1"]);
    expect(filterProjectionPreviewRows(rows, { search: "DAL" }).map(ids)).toEqual(["qb-1", "DAL"]);
  });

  it("summary reconciles counts with market status distribution and warning count", () => {
    const rows = fixtureModel({ includeAllPositions: true, includeDstDryRun: true }).rows;
    const summary = summarizeProjectionPreview({
      rows,
      filters: { leagueId: "league-1", includeDstDryRun: true },
      leagues: [league],
      coverage: null,
      dstArtifactAvailable: true,
      marketComparisonsLoaded: true,
    });

    expect(summary.rowsShown).toBe(rows.length);
    expect(summary.persistedRows + summary.dryRunRows).toBe(rows.length);
    expect(summary.marketAvailableCount + summary.noCompatibleMarketCount + summary.notImplementedMarketCount).toBe(rows.length);
    expect(summary.warningCount).toBe(rows.reduce((count, row) => count + row.warningCodes.length, 0));
  });

  it("does not expose H10 value or War Room recommendation fields", () => {
    const rowKeys = new Set(Object.keys(fixtureModel({ includeDstDryRun: true }).rows[0] ?? {}));
    const summaryKeys = new Set(Object.keys(summarizeProjectionPreview({
      rows: fixtureModel({ includeDstDryRun: true }).rows,
      filters: { leagueId: "league-1" },
      leagues: [league],
      coverage: null,
      dstArtifactAvailable: true,
      marketComparisonsLoaded: true,
    })));

    for (const forbidden of ["value", "valuation", "recommendation", "warRoomRank", "draftTargetScore"]) {
      expect(rowKeys.has(forbidden)).toBe(false);
      expect(summaryKeys.has(forbidden)).toBe(false);
    }
  });
});

function fixtureModel(options: { includeDstDryRun?: boolean; includeAllPositions?: boolean } = {}) {
  return buildCombinedProjectionReadModel({
    runs,
    outputs,
    players,
    leagues: [league],
    reasons,
    marketComparisons,
    dstOutputs: options.includeDstDryRun ? [
      {
        leagueId: "league-1",
        leagueName: "Fixture League",
        team: "DAL",
        position: "DST",
        confidence: "very_low",
        downsidePoints: 70,
        floorPoints: 80,
        medianPoints: 90,
        ceilingPoints: 100,
        upsidePoints: 110,
        projectedPositionRank: 1,
        scoringReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY",
        reasonCodes: ["DST_BIG_PLAY_COMPONENTS_UNAVAILABLE", "DST_ALLOWANCE_ONLY"],
        materialMissingScoringKeys: ["sacks", "interceptions"],
        projectedComponents: {},
      },
    ] : [],
    options: {
      leagueIds: ["league-1"],
      includeDstDryRun: options.includeDstDryRun ?? false,
      includeAllPositions: options.includeAllPositions ?? false,
    },
  });
}

function output(runId: string, playerId: string, position: string, median: number, confidence: string, rank: number) {
  return {
    projection_run_id: runId,
    canonical_player_id: playerId,
    league_id: "league-1",
    position,
    projected_ppg_when_in_role: median / 17,
    floor_ppg: (median - 20) / 17,
    ceiling_ppg: (median + 20) / 17,
    downside_points: median - 40,
    floor_points: median - 20,
    median_points: median,
    ceiling_points: median + 20,
    upside_points: median + 40,
    projection_confidence_label: confidence,
    projected_position_rank: rank,
    projection_method: runId === "off-run" ? PROJECTION_METHOD : H911_PROJECTION_METHOD,
  };
}

function ids(row: CombinedProjectionRow) {
  return row.entityId;
}
