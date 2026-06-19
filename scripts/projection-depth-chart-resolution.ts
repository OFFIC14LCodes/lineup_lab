import {
  runProjectionDepthChartResolution,
  writeProjectionDepthChartResolutionArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionDepthChartResolution({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionDepthChartResolutionArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Depth Chart Resolution");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  source missing: ${report.sourceMissing}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  summary:");
  console.log(`    target depth-chart-source rows: ${report.summary.targetDepthChartSourceRows}`);
  console.log(`    source rows: ${report.summary.sourceRows}`);
  console.log(`    matched rows: ${report.summary.matchedRows}`);
  console.log(`    confirmed active/starter/backup: ${report.summary.confirmedActiveStarterBackup}`);
  console.log(`    reserve/practice squad: ${report.summary.reservePracticeSquad}`);
  console.log(`    inactive/injured: ${report.summary.inactiveInjured}`);
  console.log(`    conflicts: ${report.summary.teamConflicts + report.summary.positionConflicts}`);
  console.log(`    review candidates: ${report.summary.reviewCandidates}`);
  console.log(`    unmatched/source missing: ${report.summary.unmatched + report.summary.sourceMissing}`);
  console.log("  policy preview:");
  for (const [policy, count] of Object.entries(report.policyImpactPreview.h31DepthChartPreviewCounts)) {
    console.log(`    ${policy}: ${count}`);
  }
  console.log("  v8.2 controlled flag impact:");
  console.log(`    safe rows resolved by depth chart: ${report.v82ControlledFlagImpact.v82SafeRowsResolvedByDepthChart}`);
  console.log(`    safe rows newly allowed: ${report.v82ControlledFlagImpact.v82SafeRowsNewlyAllowed}`);
  console.log(`    safe rows still source-expansion-required: ${report.v82ControlledFlagImpact.v82SafeRowsStillSourceExpansionRequired}`);
  console.log(`    safe rows moved to manual review: ${report.v82ControlledFlagImpact.v82SafeRowsMovedToManualReview}`);
  console.log(`    controlled flag review remains blocked: ${report.v82ControlledFlagImpact.controlledFlagReviewRemainsBlocked}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
