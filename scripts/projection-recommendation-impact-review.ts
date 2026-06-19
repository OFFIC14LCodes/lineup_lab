import {
  runProjectionRecommendationImpactReview,
  writeProjectionRecommendationImpactReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionRecommendationImpactReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionRecommendationImpactReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Recommendation Impact Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  projection movement:");
  console.log(`    rows evaluated: ${report.summary.totalRowsEvaluated}`);
  console.log(`    v8.2 candidate rows: ${report.summary.v82CandidateRows}`);
  console.log(`    current-path protected rows: ${report.summary.currentPathProtectedRows}`);
  console.log(`    excluded rows: ${report.summary.excludedRows}`);
  console.log(`    blocked rows: ${report.summary.blockedRows}`);
  console.log(`    average point delta: ${report.summary.averageProjectedPointDelta}`);
  console.log(`    median point delta: ${report.summary.medianProjectedPointDelta}`);
  console.log(`    max point delta: ${report.summary.maxProjectedPointDelta}`);
  console.log("  Blackbird Rank impact:");
  console.log(`    method: ${report.blackbirdRankImpact.estimateMethod}`);
  console.log(`    rows with rank estimate: ${report.blackbirdRankImpact.rowsWithRankEstimate}`);
  console.log(`    top 300 affected rows: ${report.blackbirdRankImpact.top300AffectedRows.length}`);
  console.log("  Draft Suggestion impact:");
  console.log(`    method: ${report.draftSuggestionImpact.estimateMethod}`);
  console.log(`    top suggestion changed: ${report.draftSuggestionImpact.topSuggestionChanged}`);
  console.log(`    top 5 overlap: ${report.draftSuggestionImpact.top5SuggestionOverlap}`);
  console.log(`    top 10 overlap: ${report.draftSuggestionImpact.top10SuggestionOverlap}`);
  console.log("  protected rows:");
  console.log(`    K rows do not use v8.2: ${report.protectedRowChecks.kRowsDoNotUseV82}`);
  console.log(`    critical movers do not use v8.2: ${report.protectedRowChecks.criticalMovementRowsDoNotUseV82}`);
  console.log(`    meaningful rank movers do not use v8.2: ${report.protectedRowChecks.meaningfulRankMoversDoNotUseV82}`);
  console.log(`    legacy/stale rows do not use v8.2: ${report.protectedRowChecks.legacyStaleRowsDoNotUseV82}`);
  console.log(`    missing artifacts fail closed: ${report.protectedRowChecks.missingArtifactsFailClosed}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
