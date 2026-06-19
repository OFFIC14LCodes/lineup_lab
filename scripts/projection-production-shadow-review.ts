import {
  runProjectionProductionShadowReview,
  writeProjectionProductionShadowReviewArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionProductionShadowReview({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionProductionShadowReviewArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Production Shadow Review");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  feature flag: ${report.featureFlagName}`);
  console.log(`  selector wired beyond dry-run: ${report.selectorWiredBeyondDryRun}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  disabled mode:");
  console.log(`    current path rows: ${report.disabledModeEquivalence.currentPathRows}`);
  console.log(`    v8.2 selected rows: ${report.disabledModeEquivalence.v82Rows}`);
  console.log(`    projection mismatches vs current: ${report.disabledModeEquivalence.projectionTotalMismatchesVsCurrent}`);
  console.log(`    ranking-affecting output delta rows: ${report.disabledModeEquivalence.rankingAffectingOutputDeltaRows}`);
  console.log("  enabled shadow:");
  console.log(`    total projection rows: ${report.summary.totalProjectionRows}`);
  console.log(`    current path rows: ${report.summary.currentPathRows}`);
  console.log(`    v8.2 shadow rows: ${report.summary.v82ShadowRows}`);
  console.log(`    excluded rows: ${report.summary.excludedRows}`);
  console.log(`    blocked rows: ${report.summary.blockedRows}`);
  console.log(`    K rows using v8.2: ${report.summary.kRowsUsingV82}`);
  console.log(`    critical movers using v8.2: ${report.summary.criticalMoversUsingV82}`);
  console.log(`    meaningful rank movers using v8.2: ${report.summary.meaningfulRankMoversUsingV82}`);
  console.log(`    legacy rows using v8.2: ${report.summary.legacyRowsUsingV82}`);
  console.log(`    missing-artifact fallback rows: ${report.summary.missingArtifactFallbackRows}`);
  console.log("  impact preview:");
  console.log(`    top projected point deltas: ${report.impactPreview.topProjectedPointDeltas.length}`);
  console.log(`    top estimated Blackbird Rank movements: ${report.impactPreview.topEstimatedBlackbirdRankMovementRows.length}`);
  console.log(`    top estimated Draft Suggestion movements: ${report.impactPreview.topEstimatedDraftSuggestionMovementRows.length}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
