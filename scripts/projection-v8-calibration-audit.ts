import {
  runProjectionV8CalibrationAudit,
  writeProjectionV8CalibrationAuditArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const targetSeason = Number(arg("--target-season"));
  if (!Number.isInteger(targetSeason)) throw new Error("--target-season=<year> is required.");
  const report = runProjectionV8CalibrationAudit({
    targetSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV8CalibrationAuditArtifacts(report);
  const allRows = report.cohortBreakdowns.find((row) => row.segment === "all_rows");

  console.log("Blackbird Projection v8 Calibration Audit");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  target season: ${report.targetSeason}`);
  console.log(`  v7/v8 compared rows: ${report.identitySummary.comparedRows}`);
  console.log(`  v8 different rows: ${report.identitySummary.differentRows}`);
  console.log(`  v7/v8.1 compared rows: ${report.v81IdentitySummary.v7ComparedRows}`);
  console.log(`  v8/v8.1 compared rows: ${report.v81IdentitySummary.v8ComparedRows}`);
  console.log(`  v7/v8.2 compared rows: ${report.v82IdentitySummary.v7ComparedRows}`);
  console.log(`  v7/v8.2 different rows: ${report.v82IdentitySummary.v7DifferentRows}`);
  console.log(`  v8.1/v8.2 compared rows: ${report.v82IdentitySummary.v81ComparedRows}`);
  console.log(`  v8.1/v8.2 different rows: ${report.v82IdentitySummary.v81DifferentRows}`);
  console.log(`  v8 games MAE delta vs v7: ${allRows?.gamesMaeDelta ?? "n/a"}`);
  console.log(`  v8 total MAE delta vs v7: ${allRows?.totalMaeDelta ?? "n/a"}`);
  console.log(`  v8.1 games MAE delta vs v7: ${allRows?.v81GamesMaeDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.1 games MAE delta vs v8: ${allRows?.v81GamesMaeDeltaVsV8 ?? "n/a"}`);
  console.log(`  v8.1 total MAE delta vs v7: ${allRows?.v81TotalMaeDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.1 total MAE delta vs v8: ${allRows?.v81TotalMaeDeltaVsV8 ?? "n/a"}`);
  console.log(`  v8.1 total RMSE delta vs v7: ${allRows?.v81TotalRmseDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.1 total bias delta vs v7: ${allRows?.v81TotalBiasDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.2 games MAE delta vs v7: ${allRows?.v82GamesMaeDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.2 games MAE delta vs v8.1: ${allRows?.v82GamesMaeDeltaVsV81 ?? "n/a"}`);
  console.log(`  v8.2 total MAE delta vs v7: ${allRows?.v82TotalMaeDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.2 total MAE delta vs v8.1: ${allRows?.v82TotalMaeDeltaVsV81 ?? "n/a"}`);
  console.log(`  v8.2 total RMSE delta vs v7: ${allRows?.v82TotalRmseDeltaVsV7 ?? "n/a"}`);
  console.log(`  v8.2 total bias delta vs v7: ${allRows?.v82TotalBiasDeltaVsV7 ?? "n/a"}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
