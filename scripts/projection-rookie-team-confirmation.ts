import {
  runProjectionRookieTeamConfirmation,
  writeProjectionRookieTeamConfirmationArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const sourcePath = arg("--source");

  const report = runProjectionRookieTeamConfirmation({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
    sourcePath,
  });
  const artifacts = writeProjectionRookieTeamConfirmationArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Rookie Team Confirmation");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  source missing: ${report.sourceMissing}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  summary:");
  console.log(`    target rookie/new unmatched rows: ${report.summary.targetRookieNewUnmatchedRows}`);
  console.log(`    source rows: ${report.summary.sourceRows}`);
  console.log(`    matched rows: ${report.summary.matchedRows}`);
  console.log(`    confirmed team rows: ${report.summary.confirmedTeamRows}`);
  console.log(`    team conflict rows: ${report.summary.teamConflictRows}`);
  console.log(`    invalid source rows: ${report.summary.invalidSourceRows}`);
  console.log("  H21 integration preview:");
  for (const [classification, count] of Object.entries(report.h21IntegrationPreview.wouldMoveTo)) {
    console.log(`    ${classification}: ${count}`);
  }
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
