import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";
import { createPlayerProfileRepository } from "@/lib/player-profiles/player-profile-repository";

void main();

async function main() {
  loadLocalEnv();
  const repository = await createPlayerProfileRepository();
  const examples = await lookupExamplesByPosition(repository);
  const runtimeDiagnostics = await repository.runtimeDiagnostics();

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    artifactStrategy: repository.artifactStrategy,
    artifactPath: repository.artifactPath,
    cwd: runtimeDiagnostics.cwd,
    artifactExists: repository.exists,
    artifactStatus: repository.status,
    artifactSizeBytes: repository.artifactSizeBytes,
    loadError: repository.loadError,
    storage: runtimeDiagnostics.storage,
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
    shardedArtifacts: runtimeDiagnostics.shardedArtifacts ?? null,
    shardCount: repository.indexStats.shardCount ?? 0,
    manifestSizeBytes: repository.indexStats.manifestSizeBytes ?? null,
    largestShardSizeBytes: repository.indexStats.largestShardSizeBytes ?? null,
    averageShardSizeBytes: repository.indexStats.averageShardSizeBytes ?? null,
    totalShardedSizeBytes: repository.indexStats.totalShardedSizeBytes ?? null,
    knownLookups: runtimeDiagnostics.knownLookups,
    cmcLookupStatus: runtimeDiagnostics.knownLookups.christianMcCaffreyBySleeperId4034,
    cmcGsisLookupStatus: runtimeDiagnostics.knownLookups.christianMcCaffreyByGsisId000033280,
    calebWilliamsLookupStatus: runtimeDiagnostics.knownLookups.calebWilliamsByNamePosition,
    jordynBrooksGsisLookupStatus: runtimeDiagnostics.knownLookups.jordynBrooksByGsisId000036409,
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
  console.log(`  storage source: ${report.storage.source}`);
  console.log(`  artifact strategy: ${report.artifactStrategy}`);
  console.log(`  artifact path: ${report.artifactPath}`);
  console.log(`  cwd: ${report.cwd}`);
  console.log(`  artifact exists: ${report.artifactExists}`);
  console.log(`  artifact status: ${report.artifactStatus}`);
  console.log(`  artifact size bytes: ${report.artifactSizeBytes ?? "n/a"}`);
  console.log(`  total profiles: ${report.totalProfiles}`);
  console.log(`  profiles indexed by sleeper_id: ${report.profilesIndexedBySleeperId}`);
  console.log(`  profiles indexed by gsis_id: ${report.profilesIndexedByGsisId}`);
  console.log(`  duplicate IDs found: ${report.duplicateIdsFound}`);
  console.log(`  shard count: ${report.shardCount}`);
  console.log(`  CMC sleeper lookup found: ${report.cmcLookupStatus.found}`);
  console.log(`  CMC GSIS lookup found: ${report.cmcGsisLookupStatus.found}`);
  console.log(`  Caleb Williams name+position lookup found: ${report.calebWilliamsLookupStatus.found}`);
  console.log(`  Jordyn Brooks GSIS lookup found: ${report.jordynBrooksGsisLookupStatus.found}`);
  console.log(`  lookup failures: ${report.lookupFailures.length}`);
  console.log("  artifacts:");
  console.log("    artifacts/projections/player-profile-read-model-diagnostics.json");
  console.log("    artifacts/projections/player-profile-read-model-diagnostics.md");
}

async function lookupExamplesByPosition(repository: Awaited<ReturnType<typeof createPlayerProfileRepository>>) {
  const success: Record<string, Array<{ playerName: string; playerId: string; matchedBy: string | null }>> = {};
  const failures: Array<{ playerName: string; playerId: string; position: string }> = [];
  if (!repository.profiles.length) return { success, failures };
  for (const profile of repository.profiles) {
    const position = profile.bio.position;
    if ((success[position]?.length ?? 0) >= 3) continue;
    const playerId = profile.identity.sleeperId ?? profile.identity.gsisId;
    const result = await repository.lookupProfile({ playerId });
    if (result.profile) {
      success[position] = [...(success[position] ?? []), { playerName: profile.bio.name, playerId, matchedBy: result.matchedBy }];
    } else {
      failures.push({ playerName: profile.bio.name, playerId, position });
    }
  }
  return { success, failures: failures.slice(0, 20) };
}
