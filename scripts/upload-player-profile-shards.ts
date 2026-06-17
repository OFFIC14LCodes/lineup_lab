import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { profileStorageKey, resolveProfileShardStoreConfig } from "@/lib/player-profiles/profile-shard-store-config";
import type { PlayerProfileShardManifest } from "@/lib/player-profiles/player-profile-shards";

import { loadLocalEnv } from "./h9-projection-hardening-utils";

export type ProfileShardUploadValidation = {
  valid: boolean;
  manifestPath: string;
  manifestProfileCount: number | null;
  shardCount: number;
  totalBytes: number;
  errors: string[];
};

if (isMainModule()) {
  void main();
}

async function main() {
  loadLocalEnv();
  const config = resolveProfileShardStoreConfig({ env: process.env });
  const validation = validateLocalProfileShardUploadSource(config.localManifestPath);
  if (!validation.valid) {
    console.error("Player profile shard upload validation failed.");
    for (const error of validation.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  if (config.mode !== "remote" || config.provider !== "supabase" || config.errors.length || !config.bucket || !config.prefix) {
    console.error("Remote Supabase profile storage is not configured.");
    console.error("Set PROFILE_STORAGE_MODE=remote, PROFILE_STORAGE_PROVIDER=supabase, PROFILE_STORAGE_BUCKET, PROFILE_STORAGE_PREFIX, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.");
    for (const error of config.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const manifest = JSON.parse(readFileSync(config.localManifestPath, "utf8")) as PlayerProfileShardManifest;
  const manifestDir = path.dirname(config.localManifestPath);
  const uploads = [
    { localPath: config.localManifestPath, remotePath: "manifest.json" },
    ...manifest.shards.map((shard) => ({ localPath: path.join(manifestDir, shard.file), remotePath: shard.file })),
  ];
  const buildMetadata = {
    uploadedAt: new Date().toISOString(),
    dryRun: false,
    readOnlyApi: true,
    totalProfiles: manifest.totalProfiles,
    shardCount: manifest.shards.length,
    sourceManifestPath: path.relative(process.cwd(), config.localManifestPath),
  };

  for (const upload of uploads) {
    const key = profileStorageKey(config.prefix, upload.remotePath);
    const { error } = await supabase.storage
      .from(config.bucket)
      .upload(key, readFileSync(upload.localPath), { upsert: true, contentType: "application/json" });
    if (error) throw new Error(`Upload failed for ${key}: ${error.message}`);
  }
  const metadataKey = profileStorageKey(config.prefix, "build-metadata.json");
  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(metadataKey, JSON.stringify(buildMetadata, null, 2), { upsert: true, contentType: "application/json" });
  if (error) throw new Error(`Upload failed for ${metadataKey}: ${error.message}`);

  console.log("Blackbird Player Profile Shard Upload");
  console.log(`  bucket: ${config.bucket}`);
  console.log(`  prefix: ${config.prefix}`);
  console.log(`  manifest profiles: ${validation.manifestProfileCount}`);
  console.log(`  shard count: ${validation.shardCount}`);
  console.log(`  uploaded files: ${uploads.length + 1}`);
}

export function validateLocalProfileShardUploadSource(manifestPath: string): ProfileShardUploadValidation {
  const errors: string[] = [];
  let manifestProfileCount: number | null = null;
  let shardCount = 0;
  let totalBytes = 0;
  if (!existsSync(manifestPath)) {
    return { valid: false, manifestPath, manifestProfileCount, shardCount, totalBytes, errors: [`Manifest is missing: ${manifestPath}`] };
  }
  try {
    totalBytes += statSync(manifestPath).size;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PlayerProfileShardManifest;
    if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.shards)) {
      errors.push("Manifest shape is invalid.");
    } else {
      manifestProfileCount = manifest.totalProfiles;
      shardCount = manifest.shards.length;
      const manifestDir = path.dirname(manifestPath);
      for (const shard of manifest.shards) {
        const shardPath = path.join(manifestDir, shard.file);
        if (!existsSync(shardPath)) {
          errors.push(`Shard is missing: ${shard.file}`);
          continue;
        }
        totalBytes += statSync(shardPath).size;
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unable to validate profile shard source.");
  }
  return { valid: errors.length === 0, manifestPath, manifestProfileCount, shardCount, totalBytes, errors };
}

function isMainModule() {
  return process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(__filename) : false;
}
