import {
  runProjectionSleeperMetadataResolution,
  writeProjectionSleeperMetadataResolutionArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionSleeperMetadataResolution({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionSleeperMetadataResolutionArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Sleeper Metadata Resolution");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  summary:");
  console.log(`    target rows: ${report.summary.targetRows}`);
  console.log(`    metadata source rows: ${report.summary.metadataSourceRows}`);
  console.log(`    matched by Sleeper ID: ${report.summary.matchedBySleeperId}`);
  console.log(`    missing metadata: ${report.summary.missingMetadata}`);
  console.log(`    active plausible: ${report.summary.activePlausible}`);
  console.log(`    inactive/stale: ${report.summary.inactiveOrStale}`);
  console.log(`    free agent/unknown: ${report.summary.freeAgentOrUnknown}`);
  console.log(`    position conflicts: ${report.summary.positionConflicts}`);
  console.log(`    team conflicts: ${report.summary.teamConflicts}`);
  console.log("  v8.2 impact:");
  console.log(`    resolved: ${report.v82Impact.safeRowsResolvedBySleeperMetadata}`);
  console.log(`    held back: ${report.v82Impact.safeRowsStillHeldBack}`);
  console.log(`    active candidate preview: ${report.v82Impact.safeRowsMovedToActiveCandidatePreview}`);
  console.log(`    unblocks controlled flag review: ${report.v82Impact.unblocksControlledFlagReview}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
