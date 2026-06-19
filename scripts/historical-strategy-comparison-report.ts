import {
  runHistoricalStrategyComparisonReport,
  writeHistoricalStrategyComparisonArtifacts,
} from "@/lib/projections/backtesting/historical-strategy-comparison-report";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");

  const report = runHistoricalStrategyComparisonReport({ season });
  const artifacts = writeHistoricalStrategyComparisonArtifacts(report);
  console.log("Blackbird Historical Strategy Comparison");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  reliability grade: ${report.missingScoreCoverage.reliabilityGrade}`);
  console.log(`  blackbird rank: ${report.blackbirdFocus.blackbirdOverallRank}`);
  console.log(`  missing score rate: ${report.missingScoreCoverage.missingScoreRate}`);
  console.log(`  strategies: ${report.strategyLeaderboard.length}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}

