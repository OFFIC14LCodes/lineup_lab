import {
  runProjectionRookieNewTargetDiagnostics,
  writeProjectionRookieNewTargetDiagnosticsArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionRookieNewTargetDiagnostics({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionRookieNewTargetDiagnosticsArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Rookie/New Target Diagnostics");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  identity classes:");
  for (const [classification, count] of Object.entries(report.summary.identityClassCounts)) {
    console.log(`    ${classification}: ${count}`);
  }
  console.log("  source strategies:");
  for (const [strategy, count] of Object.entries(report.summary.sourceStrategyCounts)) {
    console.log(`    ${strategy}: ${count}`);
  }
  console.log("  source coverage:");
  console.log(`    target rows with sleeper id only: ${report.sourceCoverageSummary.targetRowsWithSleeperIdOnly}`);
  console.log(`    target rows with gsis id: ${report.sourceCoverageSummary.targetRowsWithGsisId}`);
  console.log(`    found in current roster source: ${report.sourceCoverageSummary.targetRowsFoundInCurrentRosterSource}`);
  console.log(`    found in rookie source: ${report.sourceCoverageSummary.targetRowsFoundInRookieSource}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
