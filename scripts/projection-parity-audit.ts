import {
  runProjectionParityAudit,
  writeProjectionParityAuditArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const targetSeason = Number(arg("--target-season"));
  if (!Number.isInteger(targetSeason)) throw new Error("--target-season=<year> is required.");
  const report = runProjectionParityAudit({
    targetSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionParityAuditArtifacts(report);

  console.log("Blackbird Projection Backtest Parity Audit");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  target season: ${report.targetSeason}`);
  console.log(`  weighted rows: ${report.rowUniverse.weightedRows}`);
  console.log(`  v7 rows: ${report.rowUniverse.v7Rows}`);
  console.log(`  shared rows: ${report.rowUniverse.sharedRows}`);
  console.log(`  PPG mismatches: ${report.ppgAnchorParity.mismatchedRows}/${report.ppgAnchorParity.comparedRows}`);
  console.log(`  games mismatches: ${report.gamesBaselineParity.mismatchedRows}/${report.gamesBaselineParity.comparedRows}`);
  console.log(`  TE fallback missing: ${report.fallbackAudit.TE.fallbackMissingRows}`);
  console.log(`  K fallback missing: ${report.fallbackAudit.K.fallbackMissingRows}`);
  console.log(`  v6/v7 identical rows: ${report.v6V7IdentityAudit.identicalRows}/${report.v6V7IdentityAudit.comparedRows}`);
  console.log(`  v8.1/v8.2 identical rows: ${report.v81V82IdentityAudit.identicalRows}/${report.v81V82IdentityAudit.comparedRows}`);
  console.log(`  v8.1/v8.2 different rows: ${report.v81V82IdentityAudit.differentRows}`);
  console.log(`  root causes: ${report.rootCauses.join(", ")}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
