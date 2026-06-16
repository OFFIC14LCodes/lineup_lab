import { buildSleeperPlayerDiagnostics } from "@/lib/data-acquisition/sleeper";

import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const report = buildSleeperPlayerDiagnostics();
writeDiagnostic("sleeper-player-diagnostics", report);

console.log("Sleeper Player Diagnostics");
console.log(`  source exists: ${report.sourceExists}`);
console.log(`  raw players: ${report.rawPlayerCount}`);
console.log(`  normalized players: ${report.normalizedPlayerCount}`);
console.log(`  active players: ${report.activePlayers}`);
console.log(`  fantasy relevant players: ${report.fantasyRelevantPlayers}`);
console.log(`  active fantasy relevant players: ${report.activeFantasyRelevantPlayers}`);
console.log(`  position counts: ${JSON.stringify(report.positionCounts)}`);
console.log(`  external ID coverage: ${JSON.stringify(report.externalIdCoverage)}`);
console.log(`  verdict: ${report.verdict}`);
console.log("  artifacts:");
console.log("    artifacts/projections/sleeper-player-diagnostics.json");
console.log("    artifacts/projections/sleeper-player-diagnostics.md");

if (report.verdict !== "passed") {
  process.exitCode = 1;
}
