import {
  runHistoricalDraftUniverseBuilder,
  writeHistoricalDraftUniverseArtifacts,
} from "@/lib/projections/backtesting/historical-draft-universe-builder";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const report = runHistoricalDraftUniverseBuilder({
    season,
    includeIdp: boolArg("--include-idp", false),
    includeK: boolArg("--include-k", false),
    includeDst: boolArg("--include-dst", false),
    minProjectionPoints: numberArg("--min-projection-points"),
  });
  const artifacts = writeHistoricalDraftUniverseArtifacts(report);
  console.log("Blackbird Historical Draft Universe Builder");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  universe rows: ${report.summary.universeRows}`);
  console.log(`  positions: ${report.summary.positions.join(", ") || "none"}`);
  console.log(`  exact weekly matches: ${report.identifierCoveragePreview.playersWithWeeklyResultExactIdMatch}/${report.identifierCoveragePreview.universePlayers}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
  console.log(`    ${artifacts.scenarioPath}`);
}

function boolArg(name: string, fallback: boolean) {
  const value = arg(name);
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

function numberArg(name: string) {
  const value = arg(name);
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name}=<number> must be numeric.`);
  return parsed;
}
