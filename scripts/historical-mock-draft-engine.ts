import {
  runHistoricalMockDraftEngine,
  writeHistoricalMockDraftEngineArtifacts,
} from "@/lib/projections/backtesting/historical-mock-draft-engine";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  const scenarioPath = arg("--scenario");
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  if (!scenarioPath) throw new Error("--scenario=<path> is required.");

  const report = runHistoricalMockDraftEngine({ projectionSeason, scenarioPath });
  const artifacts = writeHistoricalMockDraftEngineArtifacts(report);
  console.log("Blackbird Historical Mock Draft Engine");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  draft order: ${report.draftOrderType}`);
  console.log(`  strategies: ${report.strategyResults.length}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
