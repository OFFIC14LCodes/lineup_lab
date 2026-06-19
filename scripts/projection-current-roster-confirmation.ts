import {
  runProjectionCurrentRosterConfirmation,
  writeProjectionCurrentRosterConfirmationArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionCurrentRosterConfirmation({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionCurrentRosterConfirmationArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;

  console.log("Blackbird Projection Current Roster Confirmation");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  source status: ${report.sourceStatus}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  console.log("  summary:");
  console.log(`    total projection rows: ${report.summary.totalProjectionRows}`);
  console.log(`    roster source rows: ${report.summary.rosterSourceRows}`);
  console.log(`    matched rows: ${report.summary.matchedRows}`);
  console.log(`    unmatched rows: ${report.summary.unmatchedRows}`);
  console.log(`    confirmed active: ${report.summary.confirmedActive}`);
  console.log(`    confirmed non-active: ${report.summary.confirmedNonActive}`);
  console.log(`    confirmed free agent: ${report.summary.confirmedFreeAgent}`);
  console.log(`    confirmed IR/PUP/NFI: ${report.summary.confirmedIrPupNfi}`);
  console.log(`    conflicts: ${report.summary.conflicts}`);
  console.log("  H16 preview:");
  console.log(`    active confirmed increase: ${report.h16IntegrationPreview.activeConfirmedIncrease}`);
  console.log(`    active confirmed decrease: ${report.h16IntegrationPreview.activeConfirmedDecrease}`);
  console.log(`    stale status review resolved: ${report.h16IntegrationPreview.staleStatusReviewResolved}`);
  console.log(`    legacy archive blocked confirmed: ${report.h16IntegrationPreview.legacyArchiveBlockedConfirmed}`);
  console.log(`    manual review required resolved: ${report.h16IntegrationPreview.manualReviewRequiredResolved}`);
  console.log(`    kicker policy unaffected: ${report.h16IntegrationPreview.kickerPolicyUnaffected}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
