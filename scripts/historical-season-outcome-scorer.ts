import {
  runHistoricalSeasonOutcomeScorer,
  writeHistoricalSeasonOutcomeScorerArtifacts,
} from "@/lib/projections/backtesting/historical-season-outcome-scorer";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  const scenarioPath = arg("--scenario");
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  if (!scenarioPath) throw new Error("--scenario=<path> is required.");

  const report = runHistoricalSeasonOutcomeScorer({ projectionSeason, scenarioPath });
  const artifacts = writeHistoricalSeasonOutcomeScorerArtifacts(report);
  console.log("Blackbird Historical Season Outcome Scorer");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  actual weekly results found: ${report.actualWeeklyResultsFound}`);
  console.log(`  result rows: ${report.weeklyInputCoverage.resultRows}`);
  console.log(`  strategy outcomes: ${report.strategyOutcomes.length}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
