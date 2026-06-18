import {
  runProjectionPromotionCandidatePool,
  writeProjectionPromotionCandidatePoolArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionPromotionCandidatePool({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionPromotionCandidatePoolArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Promotion Candidate Pool");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  total rows: ${report.summary.totalRows}`);
  console.log(`  eligible: ${report.summary.classificationCounts.eligible_for_projection_promotion}`);
  console.log(`  manual review: ${report.summary.classificationCounts.manual_review_before_promotion}`);
  console.log(`  shadow only: ${report.summary.classificationCounts.shadow_only}`);
  console.log(`  blocked: ${report.summary.classificationCounts.blocked_from_promotion}`);
  console.log(`  K eligible: ${report.kickerPolicy.eligibleKRows}/${report.kickerPolicy.totalKRows}`);
  console.log(`  critical movement rows: ${report.criticalMovementRows.length}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
