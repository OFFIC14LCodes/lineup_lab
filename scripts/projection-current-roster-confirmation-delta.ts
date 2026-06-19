import {
  runProjectionCurrentRosterConfirmationDelta,
  writeProjectionCurrentRosterConfirmationDeltaArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionCurrentRosterConfirmationDelta({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionCurrentRosterConfirmationDeltaArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;

  console.log("Blackbird Projection Current Roster Confirmation Delta");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  real source status: ${report.realSourceStatus}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  console.log("  delta:");
  console.log(`    matched rows: ${report.before.matchedRows} -> ${report.after.matchedRows} (${report.delta.matchedRows})`);
  console.log(`    unmatched rows: ${report.before.unmatchedRows} -> ${report.after.unmatchedRows} (${report.delta.unmatchedRows})`);
  console.log(`    confirmed active: ${report.before.confirmedActive} -> ${report.after.confirmedActive} (${report.delta.confirmedActive})`);
  console.log(`    confirmed non-active: ${report.before.confirmedNonActive} -> ${report.after.confirmedNonActive} (${report.delta.confirmedNonActive})`);
  console.log(`    legacy/archive confirmed: ${report.before.legacyArchiveConfirmed} -> ${report.after.legacyArchiveConfirmed} (${report.delta.legacyArchiveConfirmed})`);
  console.log(`    stale review resolved: ${report.before.staleReviewResolved} -> ${report.after.staleReviewResolved} (${report.delta.staleReviewResolved})`);
  console.log(`    manual review resolved: ${report.before.manualReviewResolved} -> ${report.after.manualReviewResolved} (${report.delta.manualReviewResolved})`);
  console.log(`    K rows with roster/depth status: ${report.before.kRowsWithRosterDepthStatus} -> ${report.after.kRowsWithRosterDepthStatus} (${report.delta.kRowsWithRosterDepthStatus})`);
  if (report.nextCommand) console.log(`  next command: ${report.nextCommand}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
