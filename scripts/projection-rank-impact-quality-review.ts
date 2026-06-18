import {
  runProjectionRankImpactQualityReview,
  writeProjectionRankImpactQualityReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionRankImpactQualityReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionRankImpactQualityReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Rank Impact Quality Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  eligible rows: ${report.summary.eligibleRows}`);
  console.log(`  meaningful overall rank movers: ${report.summary.meaningfulOverallRankMovers}`);
  console.log(`  meaningful position rank movers: ${report.summary.meaningfulPositionRankMovers}`);
  console.log(`  small-points large-rank noise rows: ${report.summary.smallPointsLargeRankNoiseRows}`);
  console.log(`  deep-tier noise rows: ${report.summary.deepTierNoiseRows}`);
  console.log(`  QB/Superflex-sensitive rows: ${report.summary.qbSuperflexSensitiveRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
