import {
  runProjectionPromotionReviewDecisions,
  writeProjectionPromotionReviewDecisionArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionPromotionReviewDecisions({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
    decisionsFile: arg("--decisions-file"),
  });
  const artifacts = writeProjectionPromotionReviewDecisionArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Promotion Review Decisions");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  decisions file: ${report.decisionsFile ?? "default decisions"}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  default unresolved: ${report.summary.defaultDecisionCounts.unresolved}`);
  console.log(`  default kicker policy review: ${report.summary.defaultDecisionCounts.needs_kicker_policy_review}`);
  console.log(`  resolved eligible: ${report.summary.eligibleRows}`);
  console.log(`  resolved manual-review remaining: ${report.summary.manualReviewRowsRemaining}`);
  console.log(`  resolved shadow-only: ${report.summary.shadowOnlyRows}`);
  console.log(`  resolved blocked: ${report.summary.blockedRows}`);
  console.log(`  unresolved rows: ${report.summary.unresolvedRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.templateCsvPath}`);
  console.log(`    ${artifacts.templateJsonPath}`);
  console.log(`    ${artifacts.resolvedJsonPath}`);
  console.log(`    ${artifacts.resolvedMarkdownPath}`);
  console.log(`    ${artifacts.resolvedCsvPath}`);
}
