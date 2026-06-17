import { writeDiagnostic, loadLocalEnv } from "./h9-projection-hardening-utils";
import { createPlayerProfileRepository } from "@/lib/player-profiles/player-profile-repository";
import { resolveProfileShardStoreConfig } from "@/lib/player-profiles/profile-shard-store-config";

void main();

async function main() {
  loadLocalEnv();
  const config = resolveProfileShardStoreConfig({ env: process.env });
  const repository = await createPlayerProfileRepository({ env: process.env });
  const runtimeDiagnostics = await repository.runtimeDiagnostics();
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    storageMode: config.mode,
    storageProvider: config.provider,
    bucket: config.bucket,
    prefix: config.prefix,
    source: runtimeDiagnostics.source,
    manifestLoaded: runtimeDiagnostics.manifestLoaded,
    manifestProfileCount: runtimeDiagnostics.manifestProfileCount,
    shardLoaded: runtimeDiagnostics.shardLoaded,
    artifactStatus: repository.status,
    loadError: repository.loadError,
    configErrors: config.errors,
    configWarnings: config.warnings,
    knownLookups: runtimeDiagnostics.knownLookups,
    verdict: config.mode === "remote" && repository.status === "ready" ? "remote_profile_storage_ready" : config.mode === "remote" ? "remote_profile_storage_needs_attention" : "remote_profile_storage_not_configured",
  };

  writeDiagnostic("player-profile-remote-diagnostics", report);

  console.log("Blackbird Player Profile Remote Storage Diagnostics");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  storage mode: ${report.storageMode}`);
  console.log(`  provider: ${report.storageProvider}`);
  console.log(`  bucket: ${report.bucket ?? "n/a"}`);
  console.log(`  prefix: ${report.prefix ?? "n/a"}`);
  console.log(`  source: ${report.source}`);
  console.log(`  manifest loaded: ${report.manifestLoaded}`);
  console.log(`  manifest profiles: ${report.manifestProfileCount ?? "n/a"}`);
  console.log(`  shard loaded: ${report.shardLoaded}`);
  console.log(`  artifact status: ${report.artifactStatus}`);
  console.log(`  config errors: ${report.configErrors.length}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log("  artifacts:");
  console.log("    artifacts/projections/player-profile-remote-diagnostics.json");
  console.log("    artifacts/projections/player-profile-remote-diagnostics.md");
}
