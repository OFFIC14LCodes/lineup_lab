import {
  runProjectionCrosswalkEnhancedConfirmation,
  writeProjectionCrosswalkEnhancedConfirmationArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionCrosswalkEnhancedConfirmation({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionCrosswalkEnhancedConfirmationArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Crosswalk-Enhanced Confirmation");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  before/after:");
  for (const [key, value] of Object.entries(report.beforeAfterSummary)) {
    console.log(`    ${key}: ${value}`);
  }
  console.log("  H21 policy preview:");
  for (const [key, value] of Object.entries(report.h21PolicyImpactPreview.wouldMoveTo)) {
    console.log(`    ${key}: ${value}`);
  }
  console.log("  v8.2 safe subset:");
  console.log(`    resolved: ${report.v82SafeSubsetImpact.safeRowsResolvedByCrosswalkEnhancedConfirmation}`);
  console.log(`    held back: ${report.v82SafeSubsetImpact.safeRowsStillHeldBack}`);
  console.log(`    active candidate preview: ${report.v82SafeSubsetImpact.safeRowsMovedToActiveCandidatePreview}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
