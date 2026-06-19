import {
  runWarRoomV1Readiness,
  writeWarRoomV1ReadinessArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runWarRoomV1Readiness({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeWarRoomV1ReadinessArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird War Room V1 Readiness");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  categories:");
  for (const [category, status] of Object.entries(report.categorySummary)) {
    console.log(`    ${category}: ${status}`);
  }
  console.log("  conservative launch policy:");
  for (const [policy, count] of Object.entries(report.conservativeLaunchPolicy)) {
    console.log(`    ${policy}: ${count}`);
  }
  console.log("  source holdbacks:");
  console.log(`    depth chart source rows held back: ${report.sourceHoldbackSummary.depthChartSourceRowsHeldBack}`);
  console.log(`    depth chart unmatched rows: ${report.sourceHoldbackSummary.depthChartUnmatchedRows}`);
  console.log(`    free-agent unknown not auto-promoted: ${report.sourceHoldbackSummary.freeAgentUnknownRowsNotAutoPromoted}`);
  console.log(`    inactive/stale held back: ${report.sourceHoldbackSummary.inactiveStaleRowsHeldBack}`);
  console.log(`    position conflicts manual review: ${report.sourceHoldbackSummary.positionConflictsManualReview}`);
  console.log("  v8.2 safety:");
  console.log(`    enabled: ${report.v82Safety.enabled}`);
  console.log(`    safe rows allowed by final policy: ${report.v82Safety.safeRowsAllowedByFinalPolicy}`);
  console.log(`    safe rows held back: ${report.v82Safety.safeRowsHeldBack}`);
  console.log(`    controlled flag review remains blocked: ${report.v82Safety.controlledFlagReviewRemainsBlocked}`);
  console.log(`    zero checks preserved: ${report.v82Safety.zeroChecksPreserved}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
