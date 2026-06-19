import {
  runProjectionCrosswalkUnmatchedClassification,
  writeProjectionCrosswalkUnmatchedClassificationArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionCrosswalkUnmatchedClassification({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionCrosswalkUnmatchedClassificationArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Crosswalk-Unmatched Classification");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  source priority: ${report.sourcePriorityRecommendation.recommendedSourcePriority}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  classifications:");
  for (const [classification, count] of Object.entries(report.summary.byClassification)) {
    console.log(`    ${classification}: ${count}`);
  }
  console.log("  H21 policy preview:");
  for (const [classification, count] of Object.entries(report.h21PolicyPreview.wouldRemainUnder)) {
    console.log(`    ${classification}: ${count}`);
  }
  console.log("  v8.2 impact:");
  console.log(`    safe rows affected: ${report.v82Impact.safeRowsAffected}`);
  console.log(`    safe rows still held back: ${report.v82Impact.safeRowsStillHeldBack}`);
  console.log(`    blocks controlled flag review: ${report.v82Impact.blocksControlledFlagReview}`);
  console.log(`    zero checks preserved: ${report.v82Impact.zeroChecksPreserved}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
