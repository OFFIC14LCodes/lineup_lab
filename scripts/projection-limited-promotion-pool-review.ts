import {
  runProjectionLimitedPromotionPoolReview,
  writeProjectionLimitedPromotionPoolReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionLimitedPromotionPoolReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionLimitedPromotionPoolReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Limited Promotion-Pool Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  eligible rows: ${report.movementSummary.rows}`);
  console.log(`  critical movement rows excluded: ${report.excludedCounts.criticalMovementRowsExcluded}`);
  console.log(`  K rows excluded: ${report.excludedCounts.kRowsExcluded}`);
  console.log(`  legacy/retired rows excluded: ${report.excludedCounts.legacyRetiredRowsExcluded}`);
  console.log(`  manual-review rows remaining: ${report.excludedCounts.manualReviewRowsRemaining}`);
  console.log(`  10-20 movement rows: ${report.movementSummary.movementBuckets["10-20"]}`);
  console.log(`  20+ movement rows: ${report.movementSummary.movementBuckets["20+"]}`);
  console.log(`  rows with rank estimate: ${report.rankImpactPreview.rowsWithRankMovementEstimate}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
