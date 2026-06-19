import {
  runProjectionSleeperPolicyRefresh,
  writeProjectionSleeperPolicyRefreshArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionSleeperPolicyRefresh({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionSleeperPolicyRefreshArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Sleeper Policy Refresh");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  summary:");
  console.log(`    total Sleeper rows: ${report.summary.totalSleeperRows}`);
  console.log(`    active candidates gained from Sleeper metadata: ${report.summary.activeCandidatesGainedFromSleeperMetadata}`);
  console.log(`    held back from Sleeper metadata: ${report.summary.heldBackFromSleeperMetadata}`);
  console.log(`    inactive/stale held back: ${report.summary.inactiveStaleHeldBack}`);
  console.log(`    free-agent/unknown held back: ${report.summary.freeAgentUnknownHeldBack}`);
  console.log(`    manual-review position conflicts: ${report.summary.manualReviewPositionConflicts}`);
  console.log("  v8.2 safe subset impact:");
  console.log(`    newly allowed: ${report.v82SafeSubsetImpact.newlyAllowedBySleeperMetadata}`);
  console.log(`    still held back: ${report.v82SafeSubsetImpact.stillHeldBack}`);
  console.log(`    held back by inactive/stale: ${report.v82SafeSubsetImpact.heldBackByInactiveStale}`);
  console.log(`    held back by free-agent/unknown: ${report.v82SafeSubsetImpact.heldBackByFreeAgentUnknown}`);
  console.log(`    held back by position conflict: ${report.v82SafeSubsetImpact.heldBackByPositionConflict}`);
  console.log(`    controlled flag review remains blocked: ${report.v82SafeSubsetImpact.controlledFlagReviewRemainsBlocked}`);
  console.log("  source recommendations:");
  for (const source of report.sourceRecommendations) {
    console.log(`    ${source.sourceNeed}: ${source.rowsAffected} rows`);
  }
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
