import {
  buildHistoricalMockDraftDesignReport,
  writeHistoricalMockDraftDesignArtifacts,
} from "@/lib/projections/backtesting/historical-mock-draft-design";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = buildHistoricalMockDraftDesignReport({ projectionSeason });
  const artifacts = writeHistoricalMockDraftDesignArtifacts(report);
  console.log("Blackbird Historical Mock Draft Backtest Design");
  console.log(`  baseline drafters: ${report.baselineStrategies.length}`);
  console.log(`  outcome metrics: ${report.seasonScoringMethods.length}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
}
