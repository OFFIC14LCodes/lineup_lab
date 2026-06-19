import {
  runProjectionActivePolicyRefreshFinal,
  writeProjectionActivePolicyRefreshFinalArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionActivePolicyRefreshFinal({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionActivePolicyRefreshFinalArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Active Policy Refresh Final");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  final policy counts:");
  for (const [policyClass, count] of Object.entries(report.policyCounts.h30FinalPolicyCounts)) {
    console.log(`    ${policyClass}: ${count}`);
  }
  console.log("  remaining blockers:");
  console.log(`    manual review rows: ${report.remainingBlockers.manualReviewRows}`);
  console.log(`    kicker policy rows: ${report.remainingBlockers.kickerPolicyRows}`);
  console.log(`    position conflict rows: ${report.remainingBlockers.positionConflictRows}`);
  console.log(`    inactive/stale held back: ${report.remainingBlockers.inactiveStaleHeldBack}`);
  console.log(`    source-expansion rows: ${report.remainingBlockers.remainingSourceExpansionRows}`);
  console.log(`    blocked/archive rows: ${report.remainingBlockers.blockedArchiveRows}`);
  console.log("  v8.2 controlled flag impact:");
  console.log(`    allowed by final policy: ${report.v82ControlledFlagImpact.safeV82RowsAllowedByFinalPolicy}`);
  console.log(`    held shadow-only: ${report.v82ControlledFlagImpact.safeV82RowsHeldShadowOnly}`);
  console.log(`    held current-path-only: ${report.v82ControlledFlagImpact.safeV82RowsHeldCurrentPathOnly}`);
  console.log(`    held manual-review: ${report.v82ControlledFlagImpact.safeV82RowsHeldManualReview}`);
  console.log(`    source-expansion required: ${report.v82ControlledFlagImpact.safeV82RowsStillSourceExpansionRequired}`);
  console.log(`    blocked/archive: ${report.v82ControlledFlagImpact.safeV82RowsBlockedArchive}`);
  console.log(`    controlled flag review remains blocked: ${report.v82ControlledFlagImpact.controlledFlagReviewRemainsBlocked}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
