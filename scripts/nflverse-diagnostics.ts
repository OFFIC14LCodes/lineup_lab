import { buildNflverseDiagnostics } from "@/lib/data-acquisition/nflverse";

import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const report = buildNflverseDiagnostics();
writeDiagnostic("nflverse-diagnostics", report);
writeDiagnostic("nflreadr-acquisition", report);

console.log("NFLVERSE Diagnostics");
console.log(`  players rows: ${report.rowCounts.players}`);
console.log(`  rosters rows: ${report.rowCounts.rosters}`);
console.log(`  player stats rows: ${report.rowCounts.playerStats}`);
console.log(`  schedules rows: ${report.rowCounts.schedules}`);
console.log(`  fantasy relevant players: ${report.fantasyRelevantPlayers}`);
console.log(`  2025 weekly stat rows: ${report.weeklyStatRows2025}`);
console.log(`  2025 roster rows: ${report.rosterRows2025}`);
console.log(`  position counts: ${JSON.stringify(report.positionCounts)}`);
console.log(`  identity coverage: ${JSON.stringify(report.identityCoverage)}`);
console.log(`  IDP rows with positive defensive stats: ${report.statColumnCoverage.idpRowsWithPositiveDefensiveStats}`);
console.log(`  verdict: ${report.verdict}`);
console.log("  artifacts:");
console.log("    artifacts/projections/nflverse-diagnostics.json");
console.log("    artifacts/projections/nflverse-diagnostics.md");
console.log("    artifacts/projections/nflreadr-acquisition.json");
console.log("    artifacts/projections/nflreadr-acquisition.md");

if (report.verdict === "failed") {
  process.exitCode = 1;
}
