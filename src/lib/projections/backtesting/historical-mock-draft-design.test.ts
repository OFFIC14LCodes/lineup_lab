import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHistoricalMockDraftDesignReport,
  HISTORICAL_MOCK_DRAFT_BASELINES,
  HISTORICAL_MOCK_DRAFT_OUTCOME_METRICS,
  writeHistoricalMockDraftDesignArtifacts,
} from "./historical-mock-draft-design";

describe("historical mock draft design", () => {
  it("generates baseline strategies and season outcome metrics", () => {
    const report = buildHistoricalMockDraftDesignReport({ projectionSeason: 2026 });

    expect(report.baselineStrategies).toEqual([...HISTORICAL_MOCK_DRAFT_BASELINES]);
    expect(report.seasonScoringMethods).toEqual([...HISTORICAL_MOCK_DRAFT_OUTCOME_METRICS]);
  });

  it("includes future leakage guard text", () => {
    const report = buildHistoricalMockDraftDesignReport({ projectionSeason: 2026 });

    expect(report.dataLeakageRules.join(" ")).toContain("must not read actual season points");
    expect(report.safetyGates.find((gate) => gate.name === "historical_backtest_no_future_leakage")?.passed).toBe(true);
  });

  it("writes artifacts and reports no live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "historical-design-"));
    try {
      const report = buildHistoricalMockDraftDesignReport({ projectionSeason: 2026 });
      const artifacts = writeHistoricalMockDraftDesignArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
