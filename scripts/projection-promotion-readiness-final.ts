import {
  runProjectionPromotionReadinessFinal,
  writeProjectionPromotionReadinessFinalArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionPromotionReadinessFinal({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
    decisionsFile: arg("--decisions-file"),
  });
  const artifacts = writeProjectionPromotionReadinessFinalArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Promotion Final Readiness");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  decisions file: ${report.decisionsFile ?? "default resolved decisions"}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  eligible rows: ${report.summary.eligibleRows}`);
  console.log(`  manual-review rows remaining: ${report.summary.manualReviewRowsRemaining}`);
  console.log(`  shadow-only rows: ${report.summary.shadowOnlyRows}`);
  console.log(`  blocked rows: ${report.summary.blockedRows}`);
  console.log(`  unresolved rows: ${report.summary.unresolvedRows}`);
  console.log(`  validation errors: ${report.summary.validationErrors}`);
  console.log(`  policy violations: ${report.summary.policyViolations}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
