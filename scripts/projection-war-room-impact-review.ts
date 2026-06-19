import {
  runProjectionWarRoomImpactReview,
  writeProjectionWarRoomImpactReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionWarRoomImpactReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionWarRoomImpactReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection War Room Impact Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  value impact:");
  console.log(`    rows evaluated: ${report.valueImpact.rowsEvaluated}`);
  console.log(`    rows with value estimate: ${report.valueImpact.rowsWithValueEstimate}`);
  console.log(`    rows with value movement: ${report.valueImpact.rowsWithValueMovement}`);
  console.log(`    average point delta: ${report.valueImpact.averageProjectedPointDelta}`);
  console.log(`    max point delta: ${report.valueImpact.maxProjectedPointDelta}`);
  console.log("  player reasoning:");
  console.log(`    likely changed rows: ${report.playerReasoningImpact.rowsWhereReasoningWouldLikelyChange}`);
  console.log(`    projection reason changes: ${report.playerReasoningImpact.rowsWhereProjectionReasonsChange}`);
  console.log("  GM Brief:");
  console.log(`    headline changed: ${report.gmBriefImpact.headlineChanged}`);
  console.log(`    top recommendation summary changed: ${report.gmBriefImpact.topRecommendationSummaryChanged}`);
  console.log("  Plan Alignment:");
  console.log(`    method: ${report.planAlignmentImpact.estimateMethod}`);
  console.log(`    rows with estimate: ${report.planAlignmentImpact.rowsWithPlanAlignmentEstimate}`);
  console.log(`    Plan Fit changed rows: ${report.planAlignmentImpact.planFitChangedRows}`);
  console.log(`    Need Fit changed rows: ${report.planAlignmentImpact.needFitChangedRows}`);
  console.log(`    Value Fit changed rows: ${report.planAlignmentImpact.valueFitChangedRows}`);
  console.log(`    Scarcity Fit changed rows: ${report.planAlignmentImpact.scarcityFitChangedRows}`);
  console.log(`    Format Fit changed rows: ${report.planAlignmentImpact.formatFitChangedRows}`);
  console.log(`    Depth/Luxury/Risk changed rows: ${report.planAlignmentImpact.depthLuxuryRiskCheckChangedRows}`);
  console.log("  risk/confidence:");
  console.log(`    estimated: ${report.riskConfidenceImpact.riskConfidenceEstimated}`);
  console.log(`    risk chip changed rows: ${report.riskConfidenceImpact.riskChipChangedRows}`);
  console.log(`    confidence chip changed rows: ${report.riskConfidenceImpact.confidenceChipChangedRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
