import {
  runProjectionV82SnapshotDiffGuard,
  writeProjectionV82SnapshotDiffGuardArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionV82SnapshotDiffGuard({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV82SnapshotDiffGuardArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection v8.2 Snapshot Diff Guard");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  default snapshot:");
  console.log(`    selector flag enabled: ${report.defaultSnapshot.selectorFlagEnabled}`);
  console.log(`    selector rows: ${report.defaultSnapshot.selectorRows}`);
  console.log(`    v8.2 selected rows: ${report.defaultSnapshot.v82SelectedRows}`);
  console.log(`    current path rows: ${report.defaultSnapshot.currentPathRows}`);
  console.log(`    projection deltas vs current path: ${report.defaultSnapshot.projectionDeltasVsCurrentPath}`);
  console.log(`    ranking-affecting deltas: ${report.defaultSnapshot.rankingAffectingDeltas}`);
  console.log("  enabled validation:");
  console.log(`    strategy: ${report.enabledValidation.strategy}`);
  console.log(`    v8.2 rows: ${report.enabledValidation.summary.v82Rows}`);
  console.log(`    current path rows: ${report.enabledValidation.summary.currentPathRows}`);
  console.log(`    K rows using v8.2: ${report.enabledValidation.summary.kRowsUsingV82}`);
  console.log(`    critical movers using v8.2: ${report.enabledValidation.summary.criticalMovementRowsUsingV82}`);
  console.log(`    meaningful rank movers using v8.2: ${report.enabledValidation.summary.meaningfulRankMoversUsingV82}`);
  console.log(`    legacy rows using v8.2: ${report.enabledValidation.summary.legacyRowsUsingV82}`);
  console.log("  missing artifacts:");
  console.log(`    v8.2 selected rows: ${report.missingArtifacts.v82SelectedRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
