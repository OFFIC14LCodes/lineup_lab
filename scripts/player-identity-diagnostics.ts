import { buildPlayerIdentityDiagnostics } from "@/lib/data-acquisition/player-identity";

import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const report = buildPlayerIdentityDiagnostics();
writeDiagnostic("player-identity-diagnostics", report);

console.log("Blackbird Player Identity Diagnostics");
console.log(`  dry run: ${report.dryRun}`);
console.log(`  Blackbird/Sleeper players considered: ${report.counts.totalBlackbirdSleeperPlayersConsidered}`);
console.log(`  nflverse players considered: ${report.counts.totalNflversePlayersConsidered}`);
console.log(`  Sleeper players loaded: ${report.counts.totalSleeperPlayersLoaded}`);
console.log(`  active Sleeper players: ${report.counts.activeSleeperPlayers}`);
console.log(`  fantasy relevant Sleeper players: ${report.counts.fantasyRelevantSleeperPlayers}`);
console.log(`  active fantasy relevant Sleeper players: ${report.counts.activeFantasyRelevantSleeperPlayers}`);
console.log(`  manual override file: ${report.sources.manualOverrides.exists ? "present" : "missing"}`);
console.log(`  manual override rows: ${report.sources.manualOverrides.rows}`);
console.log(`  approved manual override rows: ${report.sources.manualOverrides.approvedRows}`);
console.log(`  skipped manual override rows: ${report.sources.manualOverrides.skippedRows}`);
console.log(`  manual override matches: ${report.counts.manualOverrideMatches}`);
console.log(`  manual override conflicts: ${report.counts.manualOverrideConflicts}`);
console.log(`  exact ID matches: ${report.counts.exactIdMatches}`);
console.log(`  exact external ID matches: ${report.counts.exactExternalIdMatches}`);
console.log(`  strong name/position/team matches: ${report.counts.strongNamePositionTeamMatches}`);
console.log(`  name/position/team matches: ${report.counts.namePositionTeamMatches}`);
console.log(`  medium matches: ${report.counts.mediumMatches}`);
console.log(`  weak matches: ${report.counts.weakMatches}`);
console.log(`  unmatched Blackbird/Sleeper players: ${report.counts.unmatchedBlackbirdSleeperPlayers}`);
console.log(`  active fantasy relevant unmatched players: ${report.counts.activeFantasyRelevantUnmatchedPlayers}`);
console.log(`  inactive/retired unmatched players: ${report.counts.inactiveRetiredUnmatchedPlayers}`);
console.log(`  unmatched nflverse fantasy-relevant players: ${report.counts.unmatchedNflverseFantasyRelevantPlayers}`);
console.log(`  conflicts / duplicate candidates: ${report.counts.conflictsDuplicateCandidates}`);
console.log(`  active fantasy relevant conflicts: ${report.counts.activeFantasyRelevantConflicts}`);
console.log(`  confidence distribution: ${JSON.stringify(report.confidenceDistribution)}`);
console.log(`  verdict: ${report.verdict}`);
console.log("  artifacts:");
console.log("    artifacts/projections/player-identity-diagnostics.json");
console.log("    artifacts/projections/player-identity-diagnostics.md");

if (report.verdict === "blackbird_source_missing") {
  process.exitCode = 1;
}
