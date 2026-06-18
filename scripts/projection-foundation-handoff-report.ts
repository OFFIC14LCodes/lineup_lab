import {
  runProjectionFoundationHandoffReport,
  writeProjectionFoundationHandoffArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionFoundationHandoffReport({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionFoundationHandoffArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection/Scoring Foundation Handoff");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.currentRecommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  current safe subset:");
  console.log(`    total 2026 rows: ${report.currentSafeSubset.total2026Rows}`);
  console.log(`    would use v8.2 under enabled flag: ${report.currentSafeSubset.wouldUseV82UnderEnabledFlag}`);
  console.log(`    would use current path: ${report.currentSafeSubset.wouldUseCurrentPath}`);
  console.log(`    excluded from flag pool: ${report.currentSafeSubset.excludedFromFlagPool}`);
  console.log(`    blocked from flag pool: ${report.currentSafeSubset.blockedFromFlagPool}`);
  console.log(`    K rows using v8.2: ${report.currentSafeSubset.kRowsUsingV82}`);
  console.log(`    critical movers using v8.2: ${report.currentSafeSubset.criticalMoversUsingV82}`);
  console.log(`    meaningful rank movers using v8.2: ${report.currentSafeSubset.meaningfulRankMoversUsingV82}`);
  console.log(`    legacy rows using v8.2: ${report.currentSafeSubset.legacyRowsUsingV82}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
}
