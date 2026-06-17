import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { PlayerProfileArtifactStatus } from "./player-profile-repository";
import {
  profileStorageKey,
  type ProfileShardStoreConfig,
  type ProfileShardStoreSource,
} from "./profile-shard-store-config";
import type { PlayerProfileShardManifest } from "./player-profile-shards";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

export type ProfileShardStoreLoadResult<T> = {
  exists: boolean;
  sizeBytes: number | null;
  status: PlayerProfileArtifactStatus;
  loadError: string | null;
  data: T | null;
};

export type ProfileShardStoreDiagnostics = {
  storageMode: ProfileShardStoreConfig["mode"];
  storageProvider: ProfileShardStoreConfig["provider"];
  bucket: string | null;
  prefix: string | null;
  source: ProfileShardStoreSource;
  manifestLoaded: boolean;
  manifestProfileCount: number | null;
  shardLoaded: boolean;
  selectedShard: string | null;
  configErrors: string[];
  configWarnings: string[];
  supabaseUrlDefined: boolean;
  supabaseServiceRoleDefined: boolean;
};

export type ProfileShardStore = {
  source: ProfileShardStoreSource;
  config: ProfileShardStoreConfig;
  loadManifest: () => Promise<ProfileShardStoreLoadResult<PlayerProfileShardManifest>>;
  loadShard: (relativePath: string) => Promise<ProfileShardStoreLoadResult<HistoricalPlayerProfileSnapshot[]>>;
  diagnostics: () => ProfileShardStoreDiagnostics;
};

export function createLocalProfileShardStore(config: ProfileShardStoreConfig): ProfileShardStore {
  let manifestLoaded = false;
  let manifestProfileCount: number | null = null;
  let shardLoaded = false;
  let selectedShard: string | null = null;
  const manifestPath = config.localManifestPath;
  const manifestDir = path.dirname(manifestPath);

  return {
    source: "local_artifacts",
    config,
    async loadManifest() {
      const result = readJsonFile<PlayerProfileShardManifest>(manifestPath, validateManifest);
      manifestLoaded = result.status === "ready";
      manifestProfileCount = result.data?.totalProfiles ?? null;
      return result;
    },
    async loadShard(relativePath) {
      selectedShard = relativePath;
      const result = readJsonFile<HistoricalPlayerProfileSnapshot[]>(
        path.join(manifestDir, relativePath),
        (parsed) => Array.isArray(parsed) ? null : `Shard root is not an array: ${relativePath}`
      );
      shardLoaded = result.status === "ready";
      return result;
    },
    diagnostics() {
      return baseDiagnostics(config, manifestLoaded, manifestProfileCount, shardLoaded, selectedShard);
    },
  };
}

export function createSupabaseProfileShardStore(config: ProfileShardStoreConfig, client?: SupabaseClient): ProfileShardStore {
  let manifestLoaded = false;
  let manifestProfileCount: number | null = null;
  let shardLoaded = false;
  let selectedShard: string | null = null;
  let supabase: SupabaseClient | null = client ?? null;

  return {
    source: "supabase_storage",
    config,
    async loadManifest() {
      if (config.errors.length) {
        return missingFromConfig<PlayerProfileShardManifest>(config.errors);
      }
      const result = await downloadJson<PlayerProfileShardManifest>(getSupabaseClient(), config, "manifest.json", validateManifest);
      manifestLoaded = result.status === "ready";
      manifestProfileCount = result.data?.totalProfiles ?? null;
      return result;
    },
    async loadShard(relativePath) {
      selectedShard = relativePath;
      if (config.errors.length) {
        return missingFromConfig<HistoricalPlayerProfileSnapshot[]>(config.errors);
      }
      const result = await downloadJson<HistoricalPlayerProfileSnapshot[]>(
        getSupabaseClient(),
        config,
        relativePath,
        (parsed) => Array.isArray(parsed) ? null : `Shard root is not an array: ${relativePath}`
      );
      shardLoaded = result.status === "ready";
      return result;
    },
    diagnostics() {
      return baseDiagnostics(config, manifestLoaded, manifestProfileCount, shardLoaded, selectedShard);
    },
  };

  function getSupabaseClient() {
    supabase ??= createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    return supabase;
  }
}

function readJsonFile<T>(filePath: string, validate: (parsed: unknown) => string | null): ProfileShardStoreLoadResult<T> {
  if (!existsSync(filePath)) return { exists: false, sizeBytes: null, status: "artifact_missing", loadError: null, data: null };
  let sizeBytes: number | null = null;
  try {
    sizeBytes = statSync(filePath).size;
  } catch (error) {
    return { exists: true, sizeBytes, status: "artifact_unreadable", loadError: errorMessage(error, "Unable to stat artifact."), data: null };
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    const validationError = validate(parsed);
    if (validationError) return { exists: true, sizeBytes, status: "artifact_invalid", loadError: validationError, data: null };
    return { exists: true, sizeBytes, status: "ready", loadError: null, data: parsed as T };
  } catch (error) {
    return { exists: true, sizeBytes, status: "artifact_invalid", loadError: errorMessage(error, "Artifact JSON is invalid."), data: null };
  }
}

async function downloadJson<T>(
  client: SupabaseClient,
  config: ProfileShardStoreConfig,
  relativePath: string,
  validate: (parsed: unknown) => string | null
): Promise<ProfileShardStoreLoadResult<T>> {
  const bucket = config.bucket;
  const prefix = config.prefix;
  if (!bucket || !prefix) return missingFromConfig<T>(["Remote storage bucket/prefix is not configured."]);
  const key = profileStorageKey(prefix, relativePath);
  const response = await client.storage.from(bucket).download(key);
  if (response.error) {
    return {
      exists: false,
      sizeBytes: null,
      status: "artifact_missing",
      loadError: response.error.message,
      data: null,
    };
  }
  try {
    const blob = response.data as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text) as unknown;
    const validationError = validate(parsed);
    if (validationError) return { exists: true, sizeBytes: blob.size ?? Buffer.byteLength(text), status: "artifact_invalid", loadError: validationError, data: null };
    return { exists: true, sizeBytes: blob.size ?? Buffer.byteLength(text), status: "ready", loadError: null, data: parsed as T };
  } catch (error) {
    return { exists: true, sizeBytes: null, status: "artifact_invalid", loadError: errorMessage(error, "Remote artifact JSON is invalid."), data: null };
  }
}

function validateManifest(parsed: unknown) {
  const manifest = parsed as Partial<PlayerProfileShardManifest> | null;
  if (!manifest || manifest.version !== 1 || !manifest.indexes || !Array.isArray(manifest.shards)) {
    return "Sharded manifest shape is invalid.";
  }
  return null;
}

function missingFromConfig<T>(errors: string[]): ProfileShardStoreLoadResult<T> {
  return {
    exists: false,
    sizeBytes: null,
    status: "artifact_missing",
    loadError: errors.join(" "),
    data: null,
  };
}

function baseDiagnostics(
  config: ProfileShardStoreConfig,
  manifestLoaded: boolean,
  manifestProfileCount: number | null,
  shardLoaded: boolean,
  selectedShard: string | null
): ProfileShardStoreDiagnostics {
  return {
    storageMode: config.mode,
    storageProvider: config.provider,
    bucket: config.bucket,
    prefix: config.prefix,
    source: config.source,
    manifestLoaded,
    manifestProfileCount,
    shardLoaded,
    selectedShard,
    configErrors: config.errors,
    configWarnings: config.warnings,
    supabaseUrlDefined: config.supabaseUrlDefined,
    supabaseServiceRoleDefined: config.supabaseServiceRoleDefined,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
