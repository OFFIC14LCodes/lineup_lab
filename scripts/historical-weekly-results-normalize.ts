import {
  runHistoricalWeeklyResultsNormalize,
  writeHistoricalWeeklyResultsArtifacts,
} from "@/lib/projections/backtesting/historical-weekly-results-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  const sourcePath = arg("--source");
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");

  const report = runHistoricalWeeklyResultsNormalize({ season, sourcePath });
  const artifacts = writeHistoricalWeeklyResultsArtifacts(report);
  console.log("Blackbird Historical Weekly Results Normalizer");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  selected source: ${report.selectedSourcePath ?? "none"}`);
  console.log(`  total weekly rows: ${report.summary.totalWeeklyRows}`);
  console.log(`  players covered: ${report.summary.playersCovered}`);
  console.log(`  weeks covered: ${report.summary.weeksCovered.join(", ") || "none"}`);
  console.log(`  fantasy point method: ${report.fantasyPointMethod}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}

