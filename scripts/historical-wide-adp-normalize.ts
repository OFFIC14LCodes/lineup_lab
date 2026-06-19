import {
  normalizeHistoricalWideAdpSource,
  writeHistoricalWideAdpArtifacts,
} from "@/lib/projections/backtesting/historical-wide-adp-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<wide-adp-path> is required.");

  const report = normalizeHistoricalWideAdpSource({ season, inputPath });
  const artifacts = writeHistoricalWideAdpArtifacts(report);

  console.log("Blackbird Historical Wide ADP Normalize");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  season: ${report.season}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  input exists: ${report.inputExists}`);
  console.log(`  source player rows: ${report.sourcePlayerRows}`);
  console.log(`  normalized rows: ${report.normalizedRows}`);
  console.log("  rows by scoring format:");
  for (const [format, count] of Object.entries(report.rowsByScoringFormat)) console.log(`    ${format}: ${count}`);
  console.log(`  rows missing ADP: ${report.rowsMissingAdp}`);
  console.log(`  rows missing order/rank: ${report.rowsMissingOrderRank}`);
  console.log(`  duplicate player/format rows: ${report.duplicatePlayerFormatRows}`);
  console.log(`  invalid rows: ${report.invalidRows.length}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
