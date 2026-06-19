import {
  runHistoricalWeeklySourceExpansionReview,
  writeHistoricalWeeklySourceExpansionReviewArtifacts,
} from "@/lib/projections/backtesting/historical-weekly-source-expansion-review";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");

  const report = runHistoricalWeeklySourceExpansionReview({ season });
  const artifacts = writeHistoricalWeeklySourceExpansionReviewArtifacts(report);
  console.log("Blackbird Historical Weekly Source Expansion Review");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  h37 integration: ${report.h37IntegrationRecommendation}`);
  console.log(`  remaining missing players: ${report.remainingMissingPlayers.length}`);
  console.log(`  current missing rows: ${report.projectedCoverageImprovement.current_missing_rows}`);
  console.log(`  zero-season preview rows: ${report.projectedCoverageImprovement.missing_rows_that_could_become_zero_season_rows}`);
  console.log(`  projected missing rate: ${report.projectedCoverageImprovement.projected_missing_rate_after_safe_treatment}`);
  console.log(`  projected reliability: ${report.projectedCoverageImprovement.projected_reliability_grade}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
