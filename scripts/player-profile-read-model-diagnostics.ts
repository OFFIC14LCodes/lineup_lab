import { writeDiagnostic } from "./h9-projection-hardening-utils";
import { createPlayerProfileRepository } from "@/lib/player-profiles";

const repository = createPlayerProfileRepository();
const examples = lookupExamplesByPosition(repository);

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: true,
  readOnly: true,
  artifactPath: repository.artifactPath,
  artifactExists: repository.exists,
  totalProfiles: repository.indexStats.totalProfiles,
  profilesIndexedBySleeperId: repository.indexStats.bySleeperId,
  profilesIndexedByGsisId: repository.indexStats.byGsisId,
  profilesIndexedByBlackbirdPlayerId: repository.indexStats.byBlackbirdPlayerId,
  profilesIndexedByNflId: repository.indexStats.byNflId,
  profilesIndexedByEspnId: repository.indexStats.byEspnId,
  profilesIndexedByPfrId: repository.indexStats.byPfrId,
  profilesIndexedByNamePosition: repository.indexStats.byNamePosition,
  duplicateIdsFound: repository.indexStats.duplicateIds.length,
  duplicateIdExamples: repository.indexStats.duplicateIds.slice(0, 20),
  lookupSuccessExamplesByPosition: examples.success,
  lookupFailures: examples.failures,
  limitations: [
    "Artifact-backed read model only. No Supabase writes are performed.",
    "Ambiguous duplicate ID lookups intentionally return no profile.",
    "Weekly game log is capped in the API response.",
  ],
};

writeDiagnostic("player-profile-read-model-diagnostics", report);

console.log("Blackbird Player Profile Read Model Diagnostics");
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  artifact exists: ${report.artifactExists}`);
console.log(`  total profiles: ${report.totalProfiles}`);
console.log(`  profiles indexed by sleeper_id: ${report.profilesIndexedBySleeperId}`);
console.log(`  profiles indexed by gsis_id: ${report.profilesIndexedByGsisId}`);
console.log(`  profiles indexed by blackbird player id: ${report.profilesIndexedByBlackbirdPlayerId}`);
console.log(`  profiles indexed by nfl_id: ${report.profilesIndexedByNflId}`);
console.log(`  profiles indexed by espn_id: ${report.profilesIndexedByEspnId}`);
console.log(`  profiles indexed by pfr_id: ${report.profilesIndexedByPfrId}`);
console.log(`  duplicate IDs found: ${report.duplicateIdsFound}`);
console.log(`  lookup failures: ${report.lookupFailures.length}`);
console.log("  artifacts:");
console.log("    artifacts/projections/player-profile-read-model-diagnostics.json");
console.log("    artifacts/projections/player-profile-read-model-diagnostics.md");

function lookupExamplesByPosition(repository: ReturnType<typeof createPlayerProfileRepository>) {
  const success: Record<string, Array<{ playerName: string; playerId: string; matchedBy: string | null }>> = {};
  const failures: Array<{ playerName: string; playerId: string; position: string }> = [];
  for (const profile of repository.profiles) {
    const position = profile.bio.position;
    if ((success[position]?.length ?? 0) >= 3) continue;
    const playerId = profile.identity.sleeperId ?? profile.identity.gsisId;
    const result = repository.lookupProfile({ playerId });
    if (result.profile) {
      success[position] = [...(success[position] ?? []), { playerName: profile.bio.name, playerId, matchedBy: result.matchedBy }];
    } else {
      failures.push({ playerName: profile.bio.name, playerId, position });
    }
  }
  return { success, failures: failures.slice(0, 20) };
}
