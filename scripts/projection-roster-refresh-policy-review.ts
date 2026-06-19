import {
  runProjectionRosterRefreshPolicyReview,
  writeProjectionRosterRefreshPolicyReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionRosterRefreshPolicyReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionRosterRefreshPolicyReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Roster Refresh Policy Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  policy groups:");
  for (const [group, count] of Object.entries(report.policyGroupCounts)) {
    console.log(`    ${group}: ${count}`);
  }
  console.log("  blockers / source expansion:");
  console.log(`    conflicts: ${report.conflicts.length}`);
  console.log(`    remaining manual-review rows: ${report.remainingManualReviewRows.length}`);
  console.log(`    active unmatched: ${report.activeCandidateUnmatched.totalRows}`);
  console.log(`    rookie/new unmatched: ${report.rookieNewUnmatched.totalRows}`);
  console.log(`    low-confidence unmatched: ${report.lowConfidenceUnmatched.totalRows}`);
  console.log(`    kicker policy rows: ${report.kickerPolicy.totalKRows}`);
  console.log("  v8.2 adoption impact:");
  console.log(`    safe subset confirmed-active rows: ${report.v82AdoptionImpact.safeSubsetRowsInsideConfirmedActiveClear}`);
  console.log(`    safe subset unmatched rows: ${report.v82AdoptionImpact.safeSubsetRowsInsideUnmatchedGroups}`);
  console.log(`    protected conflict/manual/kicker rows: ${report.v82AdoptionImpact.protectedRowsInsideConflictManualKickerGroups}`);
  console.log(`    safe subset remains intact: ${report.v82AdoptionImpact.safeSubsetRemainsIntact}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
