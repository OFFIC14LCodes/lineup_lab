import {
  runHistoricalMultiSeasonValidation,
  writeHistoricalMultiSeasonValidationArtifacts,
} from "@/lib/projections/backtesting/historical-multi-season-validation";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const seasonsArg = arg("--seasons");
  if (!seasonsArg) throw new Error("--seasons=2023,2024,2025 is required.");
  const seasons = seasonsArg.split(",").map((season) => Number(season.trim())).filter(Number.isInteger);
  if (!seasons.length) throw new Error("--seasons must include at least one year.");

  const report = runHistoricalMultiSeasonValidation({ seasons });
  const artifacts = writeHistoricalMultiSeasonValidationArtifacts(report);
  console.log("Blackbird Historical Multi-Season Validation");
  console.log(`  recommendation: ${report.productConfidenceRecommendation}`);
  console.log(`  available seasons: ${report.seasonsAvailable.join(", ") || "none"}`);
  console.log(`  not available seasons: ${report.seasonsNotAvailable.join(", ") || "none"}`);
  console.log(`  blackbird average rank: ${report.blackbirdSummary.averageRank}`);
  console.log(`  average missing score rate: ${report.reliabilitySummary.averageMissingScoreRate}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
