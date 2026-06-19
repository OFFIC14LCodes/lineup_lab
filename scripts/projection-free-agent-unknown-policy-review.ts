import {
  runProjectionFreeAgentUnknownPolicyReview,
  writeProjectionFreeAgentUnknownPolicyReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionFreeAgentUnknownPolicyReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionFreeAgentUnknownPolicyReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Free-Agent/Unknown Policy Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  summary:");
  console.log(`    target rows: ${report.summary.targetRows}`);
  console.log(`    active promotions: ${report.summary.activePromotions}`);
  console.log(`    shadow-only: ${report.summary.byPolicyClass.free_agent_unknown_shadow_only}`);
  console.log(`    current-path-only: ${report.summary.byPolicyClass.free_agent_unknown_current_path_only}`);
  console.log(`    manual review: ${report.summary.byPolicyClass.free_agent_unknown_manual_review}`);
  console.log(`    blocked/archive: ${report.summary.byPolicyClass.free_agent_unknown_blocked_archive}`);
  console.log(`    source-expansion-required: ${report.summary.byPolicyClass.free_agent_unknown_source_expansion_required}`);
  console.log("  importance:");
  console.log(`    high: ${report.summary.byImportanceBucket.high_projection_importance}`);
  console.log(`    moderate: ${report.summary.byImportanceBucket.moderate_projection_importance}`);
  console.log(`    low: ${report.summary.byImportanceBucket.low_projection_importance}`);
  console.log(`    insufficient: ${report.summary.byImportanceBucket.insufficient_projection_importance_data}`);
  console.log("  v8.2 impact:");
  console.log(`    reviewed safe rows: ${report.v82Impact.freeAgentUnknownV82SafeRowsReviewed}`);
  console.log(`    controlled flag review remains blocked: ${report.v82Impact.controlledFlagReviewRemainsBlocked}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
