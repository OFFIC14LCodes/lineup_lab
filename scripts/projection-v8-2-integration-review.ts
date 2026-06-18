import {
  runProjectionV82IntegrationReview,
  writeProjectionV82IntegrationReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const targetSeason = Number(arg("--target-season"));
  if (!Number.isInteger(targetSeason)) throw new Error("--target-season=<year> is required.");

  const report = runProjectionV82IntegrationReview({
    targetSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV82IntegrationReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);
  const allRows = report.modelQualitySummary.allRows;

  console.log("Blackbird Projection v8.2 Integration Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  target season: ${report.targetSeason}`);
  console.log(`  model: ${report.model}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  rows evaluated: ${allRows.rows}`);
  console.log(`  v8.2 total MAE delta vs v7: ${allRows.v82TotalMaeDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.2 total MAE delta vs v8.1: ${allRows.v82TotalMaeDeltaVsV81 ?? "n/a"}`);
  console.log(`  v8.2 games MAE delta vs v7: ${allRows.v82GamesMaeDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.2 distinct rows vs v7: ${allRows.v82DifferentFromV7Rows}/${allRows.rows}`);
  console.log(`  v8.2 distinct rows vs v8.1: ${allRows.v82DifferentFromV81Rows}/${allRows.rows}`);
  console.log(`  critical movement rows: ${report.impactPreview.riskCounts.critical}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
