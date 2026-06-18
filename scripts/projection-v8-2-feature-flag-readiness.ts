import {
  runProjectionV82FeatureFlagReadiness,
  writeProjectionV82FeatureFlagReadinessArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionV82FeatureFlagReadiness({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV82FeatureFlagReadinessArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection v8.2 Disabled Feature-Flag Readiness");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  total rows: ${report.summary.totalRows}`);
  console.log(`  would use v8.2 under disabled flag: ${report.summary.wouldUseV82UnderFlag}`);
  console.log(`  would use current path under disabled flag: ${report.summary.wouldUseCurrentPathUnderFlag}`);
  console.log(`  excluded from flag pool: ${report.summary.excludedFromFlagPool}`);
  console.log(`  blocked from flag pool: ${report.summary.blockedFromFlagPool}`);
  console.log(`  manual-review rows remaining: ${report.summary.manualReviewRowsRemaining}`);
  console.log(`  unresolved rows remaining: ${report.summary.unresolvedRowsRemaining}`);
  console.log(`  K rows using v8.2: ${report.summary.kRowsUsingV82}`);
  console.log(`  critical movement rows using v8.2: ${report.summary.criticalMovementRowsUsingV82}`);
  console.log(`  meaningful rank movers using v8.2: ${report.summary.meaningfulRankMoversUsingV82}`);
  console.log(`  legacy rows using v8.2: ${report.summary.legacyRowsUsingV82}`);
  console.log(`  impact rows: ${report.impactSummary.rows}`);
  console.log(`  avg point delta: ${report.impactSummary.averageProjectedPointDelta ?? "n/a"}`);
  console.log(`  median point delta: ${report.impactSummary.medianProjectedPointDelta ?? "n/a"}`);
  console.log(`  max abs point delta: ${report.impactSummary.maxProjectedPointDelta ?? "n/a"}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
