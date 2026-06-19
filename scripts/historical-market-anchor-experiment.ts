import {
  runHistoricalMarketAnchorExperiment,
  writeHistoricalMarketAnchorExperimentArtifacts,
} from "@/lib/projections/backtesting/historical-market-anchor-rank";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const universePath = arg("--universe") ?? undefined;

  const report = runHistoricalMarketAnchorExperiment({ season, universePath });
  const artifacts = writeHistoricalMarketAnchorExperimentArtifacts(report);
  console.log("Blackbird Historical Market Anchor Experiment");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  market source: ${report.marketFieldDiscovery.sourceUsed}`);
  console.log(`  players with ADP: ${report.marketFieldDiscovery.playersWithAdpRank}`);
  console.log(`  players with market rank: ${report.marketFieldDiscovery.playersWithMarketRank}`);
  console.log(`  average movement: ${report.defaultMovementSummary.averageRankMovement}`);
  console.log(`  max movement: ${report.defaultMovementSummary.maxRankMovement}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
