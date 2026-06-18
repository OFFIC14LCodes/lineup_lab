import {
  runProjectionSelectorPipelinePreview,
  writeProjectionSelectorPipelinePreviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionSelectorPipelinePreview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionSelectorPipelinePreviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Selector Pipeline Preview");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  feature flag: ${report.featureFlagName}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  disabled mode:");
  console.log(`    rows evaluated: ${report.disabledMode.summary.rowsEvaluated}`);
  console.log(`    current path rows: ${report.disabledMode.summary.currentPathRows}`);
  console.log(`    v8.2 rows: ${report.disabledMode.summary.v82Rows}`);
  console.log(`    projection mismatches vs current: ${report.disabledMode.summary.projectionTotalMismatchesVsCurrent}`);
  console.log(`    max projection delta vs current: ${report.disabledMode.summary.maxProjectionDeltaVsCurrent}`);
  console.log("  enabled mode:");
  console.log(`    current path rows: ${report.enabledMode.summary.currentPathRows}`);
  console.log(`    v8.2 rows: ${report.enabledMode.summary.v82Rows}`);
  console.log(`    excluded rows: ${report.enabledMode.summary.excludedRows}`);
  console.log(`    blocked rows: ${report.enabledMode.summary.blockedRows}`);
  console.log(`    mismatches with selector preview: ${report.enabledMode.summary.mismatchesWithSelectorPreview}`);
  console.log(`    mismatches with readiness: ${report.enabledMode.summary.mismatchesWithReadiness}`);
  console.log(`    protected-row violations: ${report.enabledMode.summary.protectedRowViolations}`);
  console.log("  missing artifacts mode:");
  console.log(`    v8.2 rows: ${report.missingArtifactsMode.summary.v82Rows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
