import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { DEFAULT_PLAYER_PROFILES_SHARDED_MANIFEST_PATH } from "@/lib/player-profiles/player-profile-repository";
import { resolveProfileShardStoreConfig } from "@/lib/player-profiles/profile-shard-store-config";

import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

void main();

function main() {
  loadLocalEnv();
  const config = resolveProfileShardStoreConfig({ env: process.env });
  const nextConfigSource = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
  const localArtifactsPresent = existsSync(path.join(process.cwd(), DEFAULT_PLAYER_PROFILES_SHARDED_MANIFEST_PATH));
  const vercelTracingIncludesLocalShards = nextConfigSource.includes("player-profiles-sharded/**/*")
    || nextConfigSource.includes("player-profiles-sharded/**");
  const remoteConfigured = config.mode === "remote"
    && config.provider === "supabase"
    && Boolean(config.bucket)
    && Boolean(config.prefix)
    && config.supabaseUrlDefined
    && config.supabaseServiceRoleDefined
    && config.errors.length === 0;
  const recommendation = remoteConfigured && !vercelTracingIncludesLocalShards
    ? "production-ready"
    : config.mode === "local"
      ? "local-dev-ok"
      : "needs-attention";

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    localArtifactsPresent,
    localManifestPath: DEFAULT_PLAYER_PROFILES_SHARDED_MANIFEST_PATH,
    selectedStorageMode: config.mode,
    storageProvider: config.provider,
    bucket: config.bucket,
    prefix: config.prefix,
    remoteConfigured,
    productionWarning: config.productionWarning,
    configErrors: config.errors,
    configWarnings: config.warnings,
    vercelTracingIncludesLocalShards,
    recommendation,
  };

  writeDiagnostic("player-profile-storage-config", report);

  console.log("Blackbird Player Profile Storage Config Verification");
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  selected storage mode: ${report.selectedStorageMode}`);
  console.log(`  provider: ${report.storageProvider}`);
  console.log(`  bucket: ${report.bucket ?? "n/a"}`);
  console.log(`  prefix: ${report.prefix ?? "n/a"}`);
  console.log(`  local artifacts present: ${report.localArtifactsPresent}`);
  console.log(`  remote configured: ${report.remoteConfigured}`);
  console.log(`  Vercel tracing includes local shards: ${report.vercelTracingIncludesLocalShards}`);
  console.log(`  production warning: ${report.productionWarning ?? "none"}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log("  artifacts:");
  console.log("    artifacts/projections/player-profile-storage-config.json");
  console.log("    artifacts/projections/player-profile-storage-config.md");
}
