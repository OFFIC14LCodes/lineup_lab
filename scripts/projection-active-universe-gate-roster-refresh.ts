import {
  runProjectionActiveUniverseGateRosterRefresh,
  writeProjectionActiveUniverseGateRosterRefreshArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionActiveUniverseGateRosterRefresh({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionActiveUniverseGateRosterRefreshArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Active Universe Gate Roster Refresh");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  matched/unmatched/conflicts:");
  console.log(`    matched rows: ${report.matchedSummary.matchedRows}`);
  console.log(`    unmatched rows: ${report.matchedSummary.unmatchedRows}`);
  console.log(`    conflicts: ${report.matchedSummary.conflicts}`);
  console.log("  refreshed status counts:");
  for (const [status, count] of Object.entries(report.beforeAfterStatusCounts.refreshedStatusCounts)) {
    console.log(`    ${status}: ${count}`);
  }
  console.log("  status changes:");
  console.log(`    active confirmed increase: ${report.statusChangeSummary.activeConfirmedIncrease}`);
  console.log(`    active confirmed decrease: ${report.statusChangeSummary.activeConfirmedDecrease}`);
  console.log(`    stale review resolved: ${report.statusChangeSummary.staleStatusReviewResolved}`);
  console.log(`    manual review resolved: ${report.statusChangeSummary.manualReviewResolved}`);
  console.log(`    low confidence resolved: ${report.statusChangeSummary.lowConfidenceResolved}`);
  console.log(`    kicker policy unchanged: ${report.statusChangeSummary.kickerPolicyUnchanged}`);
  console.log("  v8.2 safe subset:");
  console.log(`    rows that would use v8.2: ${report.v82SafeSubsetCrossReference.rowsThatWouldUseV82UnderEnabledSafeFlag}`);
  console.log(`    rows staying current path: ${report.v82SafeSubsetCrossReference.rowsThatStayCurrentPath}`);
  console.log(`    rows excluded/blocked: ${report.v82SafeSubsetCrossReference.rowsExcludedOrBlocked}`);
  console.log(`    K rows using v8.2: ${report.v82SafeSubsetCrossReference.packetSummary.kRowsUsingV82}`);
  console.log(`    critical movers using v8.2: ${report.v82SafeSubsetCrossReference.packetSummary.criticalMoversUsingV82}`);
  console.log(`    meaningful rank movers using v8.2: ${report.v82SafeSubsetCrossReference.packetSummary.meaningfulRankMoversUsingV82}`);
  console.log(`    legacy rows using v8.2: ${report.v82SafeSubsetCrossReference.packetSummary.legacyRowsUsingV82}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
