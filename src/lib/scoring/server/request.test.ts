import { describe, expect, it } from "vitest";

import { parseScoringInspectorQuery } from "@/lib/scoring/server/request";
import { ScoringInspectorError } from "@/lib/scoring/server/errors";

describe("parseScoringInspectorQuery", () => {
  it("parses a valid weekly stats batch query", () => {
    const result = parseScoringInspectorQuery(
      new URLSearchParams({
        leagueId: "league-1",
        sourceType: "weekly_stats",
        season: "2026",
        week: "3",
        provider: "manual",
        positionGroup: "wr",
        projectionType: "weekly",
        limit: "10"
      })
    );

    expect(result).toEqual({
      leagueId: "league-1",
      sourceType: "weekly_stats",
      rowId: null,
      season: 2026,
      week: 3,
      provider: "manual",
      positionGroup: "WR",
      projectionType: "weekly",
      limit: 10
    });
  });

  it("defaults limit and optional filters", () => {
    const result = parseScoringInspectorQuery(
      new URLSearchParams({
        leagueId: "league-1",
        sourceType: "season_stats"
      })
    );

    expect(result.limit).toBe(25);
    expect(result.season).toBeNull();
    expect(result.week).toBeNull();
    expect(result.provider).toBeNull();
    expect(result.positionGroup).toBeNull();
    expect(result.projectionType).toBeNull();
  });

  it("rejects invalid source type", () => {
    expect(() =>
      parseScoringInspectorQuery(
        new URLSearchParams({
          leagueId: "league-1",
          sourceType: "injuries"
        })
      )
    ).toThrowError(ScoringInspectorError);
  });

  it("rejects invalid position group", () => {
    expect(() =>
      parseScoringInspectorQuery(
        new URLSearchParams({
          leagueId: "league-1",
          sourceType: "weekly_stats",
          positionGroup: "OL"
        })
      )
    ).toThrowErrorMatchingInlineSnapshot(`[ScoringInspectorError: positionGroup is invalid.]`);
  });

  it("rejects invalid week and excessive limit", () => {
    expect(() =>
      parseScoringInspectorQuery(
        new URLSearchParams({
          leagueId: "league-1",
          sourceType: "weekly_stats",
          week: "26"
        })
      )
    ).toThrowErrorMatchingInlineSnapshot(`[ScoringInspectorError: week must be between 1 and 25.]`);

    expect(() =>
      parseScoringInspectorQuery(
        new URLSearchParams({
          leagueId: "league-1",
          sourceType: "weekly_stats",
          limit: "101"
        })
      )
    ).toThrowErrorMatchingInlineSnapshot(`[ScoringInspectorError: limit must be between 1 and 100.]`);
  });

  it("rejects invalid projection type", () => {
    expect(() =>
      parseScoringInspectorQuery(
        new URLSearchParams({
          leagueId: "league-1",
          sourceType: "projections",
          projectionType: "dynasty"
        })
      )
    ).toThrowErrorMatchingInlineSnapshot(`[ScoringInspectorError: projectionType is invalid.]`);
  });
});
