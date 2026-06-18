import {
  runProjectionV82FeatureFlagPreview,
  writeProjectionV82FeatureFlagPreviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionV82FeatureFlagPreview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV82FeatureFlagPreviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection v8.2 Feature-Flag Selector Preview");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  feature flag: ${report.featureFlagName}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  disabled mode:");
  console.log(`    total rows: ${report.disabledMode.summary.totalRows}`);
  console.log(`    current path rows: ${report.disabledMode.summary.currentPathRows}`);
  console.log(`    v8.2 rows: ${report.disabledMode.summary.v82Rows}`);
  console.log("  enabled mode:");
  console.log(`    current path rows: ${report.enabledMode.summary.currentPathRows}`);
  console.log(`    v8.2 rows: ${report.enabledMode.summary.v82Rows}`);
  console.log(`    excluded rows: ${report.enabledMode.summary.excludedRows}`);
  console.log(`    blocked rows: ${report.enabledMode.summary.blockedRows}`);
  console.log(`    mismatches: ${report.enabledMode.summary.mismatches}`);
  console.log(`    protected-row violations: ${report.enabledMode.summary.protectedRowViolations}`);
  console.log("  missing artifacts mode:");
  console.log(`    v8.2 rows: ${report.missingArtifactsMode.summary.v82Rows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
