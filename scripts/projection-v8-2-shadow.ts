import {
  runProjectionV82Shadow,
  writeProjectionV82ShadowArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionV82Shadow({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV82ShadowArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection v8.2 Shadow Report");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  current model: ${report.currentModel}`);
  console.log(`  shadow model: ${report.shadowModel}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  current live rows: ${report.rowCoverage.currentLiveProjectionRows}`);
  console.log(`  v8.2 shadow rows: ${report.rowCoverage.v82ShadowRows}`);
  console.log(`  shared rows: ${report.rowCoverage.sharedRows}`);
  console.log(`  critical movement rows: ${report.criticalMovements.length}`);
  console.log(`  ranking movement estimated: ${report.rankingRiskPreview.estimated}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
