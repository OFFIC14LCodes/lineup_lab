import { buildHistoricalPlayerProfiles, writePlayerProfileArtifacts } from "@/lib/player-profiles";

import { loadLocalEnv } from "./h9-projection-hardening-utils";

loadLocalEnv();

const result = buildHistoricalPlayerProfiles();
writePlayerProfileArtifacts(result);

console.log("Blackbird Historical Player Profile Builder");
console.log(`  dry run: ${result.dryRun}`);
console.log(`  profiles built: ${result.diagnostics.totalProfilesBuilt}`);
console.log(`  profiles with weekly stats: ${result.diagnostics.profilesWithWeeklyStats}`);
console.log(`  profiles without weekly stats: ${result.diagnostics.profilesWithoutWeeklyStats}`);
console.log(`  profiles with IDP stats: ${result.diagnostics.profilesWithIdpStats}`);
console.log(`  profiles with warnings: ${result.diagnostics.profilesWithWarnings}`);
console.log(`  profiles by position: ${JSON.stringify(result.diagnostics.profilesByPosition)}`);
console.log(`  profiles by match confidence: ${JSON.stringify(result.diagnostics.profilesByMatchConfidence)}`);
console.log(`  scoring profile: ${result.scoringProfile.label} (${result.scoringProfile.version})`);
console.log("  artifacts:");
console.log("    artifacts/projections/player-profiles.json");
console.log("    artifacts/projections/player-profiles-summary.md");
console.log("    artifacts/projections/player-profiles-sample.md");
console.log("    artifacts/projections/player-profiles-diagnostics.json");
