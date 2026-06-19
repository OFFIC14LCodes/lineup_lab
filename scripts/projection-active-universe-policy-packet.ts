import {
  runProjectionActiveUniversePolicyPacket,
  writeProjectionActiveUniversePolicyPacketArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionActiveUniversePolicyPacket({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionActiveUniversePolicyPacketArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Active Universe Policy Packet");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  conservative policy counts:");
  for (const [classification, count] of Object.entries(report.policyCounts.byClassification)) {
    console.log(`    ${classification}: ${count}`);
  }
  console.log("  source expansion priorities:");
  for (const summary of report.sourceExpansionPriorities) {
    console.log(`    ${summary.sourceNeed}: ${summary.rowsAffected} rows (${summary.v82SafeSubsetRowsAffected} v8.2 safe-subset)`);
  }
  console.log("  v8.2 conservative policy impact:");
  console.log(`    allowed safe v8.2 rows: ${report.v82ConservativePolicyImpact.safeV82RowsAllowedByConservativePolicy}`);
  console.log(`    safe v8.2 held by source expansion: ${report.v82ConservativePolicyImpact.safeV82RowsHeldBackBySourceExpansion}`);
  console.log(`    safe v8.2 held by policy: ${report.v82ConservativePolicyImpact.safeV82RowsHeldBackByKickerManualCurrentPathPolicy}`);
  console.log(`    v8.2 remains safe: ${report.v82ConservativePolicyImpact.v82RemainsSafe}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
