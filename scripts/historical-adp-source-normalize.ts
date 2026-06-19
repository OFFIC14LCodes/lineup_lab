import {
  normalizeHistoricalAdpSource,
  writeHistoricalAdpSourceArtifacts,
} from "@/lib/projections/backtesting/historical-adp-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<csv-path> is required.");
  const universePath = arg("--universe") ?? undefined;
  const marketFormat = arg("--market-format") ?? undefined;

  const report = normalizeHistoricalAdpSource({ season, inputPath, universePath, marketFormat });
  const artifacts = writeHistoricalAdpSourceArtifacts(report);

  console.log("Blackbird Historical ADP Source Normalize");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  season: ${report.season}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  universe: ${report.universePath}`);
  console.log(`  market format: ${marketFormat ?? "not filtered"}`);
  console.log(`  universe exists: ${report.universeExists}`);
  console.log(`  universe rows: ${report.universeRows}`);
  console.log(`  universe usable rows: ${report.universeUsableRows}`);
  console.log(`  source rows: ${report.coverage.adpSourceRows}`);
  console.log(`  normalized rows: ${report.coverage.normalizedRows}`);
  console.log(`  exact ID matches: ${report.coverage.matchedByExactId}`);
  console.log(`  name/team/position matches: ${report.coverage.matchedByNameTeamPosition}`);
  console.log(`  review candidates: ${report.coverage.reviewCandidates}`);
  console.log(`  unmatched ADP rows: ${report.coverage.unmatchedAdpRows}`);
  console.log(`  universe rows without ADP: ${report.coverage.universeRowsWithoutAdp}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.normalizedJsonPath}`);
  console.log(`    ${artifacts.normalizedMarkdownPath}`);
  console.log(`    ${artifacts.normalizedCsvPath}`);
  console.log(`    ${artifacts.enrichedJsonPath}`);
  console.log(`    ${artifacts.enrichedMarkdownPath}`);
  console.log(`    ${artifacts.enrichedCsvPath}`);
}
