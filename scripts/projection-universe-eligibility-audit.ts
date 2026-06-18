import {
  runProjectionUniverseEligibilityAudit,
  writeProjectionUniverseEligibilityAuditArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionUniverseEligibilityAudit({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionUniverseEligibilityAuditArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Universe Eligibility Audit");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  total projected rows: ${report.summary.totalProjectedRows}`);
  console.log(`  active plausible: ${report.summary.statusCounts.active_plausible}`);
  console.log(`  low-confidence plausible: ${report.summary.statusCounts.low_confidence_plausible}`);
  console.log(`  rookie/new: ${report.summary.statusCounts.rookie_or_new_player}`);
  console.log(`  stale historical: ${report.summary.statusCounts.stale_historical_signal}`);
  console.log(`  retired/legacy suspect: ${report.summary.statusCounts.retired_or_legacy_suspect}`);
  console.log(`  manual review required: ${report.summary.statusCounts.manual_review_required}`);
  console.log(`  critical movement rows: ${report.criticalMovementReview.length}`);
  console.log(`  kicker critical movement rows: ${report.kickerReview.criticalMovementRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
