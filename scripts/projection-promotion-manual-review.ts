import {
  runProjectionPromotionManualReview,
  writeProjectionPromotionManualReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionPromotionManualReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionPromotionManualReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Promotion Manual Review Packet");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  manual-review rows: ${report.summary.totalManualReviewRows}`);
  console.log(`  approve: ${report.summary.proposedActionCounts.approve_for_candidate_pool}`);
  console.log(`  keep shadow-only: ${report.summary.proposedActionCounts.keep_shadow_only}`);
  console.log(`  block: ${report.summary.proposedActionCounts.block_from_promotion}`);
  console.log(`  roster confirmation: ${report.summary.proposedActionCounts.needs_roster_confirmation}`);
  console.log(`  model policy review: ${report.summary.proposedActionCounts.needs_model_policy_review}`);
  console.log(`  kicker policy review: ${report.summary.proposedActionCounts.needs_kicker_policy_review}`);
  console.log(`  can proceed after human decisions: ${report.summary.canProceedAfterHumanDecisions}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
