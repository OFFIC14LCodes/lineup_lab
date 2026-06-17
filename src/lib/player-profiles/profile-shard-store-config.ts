import path from "node:path";

import { DEFAULT_PLAYER_PROFILES_SHARDED_DIR } from "./player-profile-shards";

export type ProfileStorageMode = "local" | "remote";
export type ProfileStorageProvider = "local" | "supabase";
export type ProfileShardStoreSource = "local_artifacts" | "supabase_storage";

export type ProfileShardStoreConfig = {
  mode: ProfileStorageMode;
  provider: ProfileStorageProvider;
  bucket: string | null;
  prefix: string | null;
  source: ProfileShardStoreSource;
  localManifestPath: string;
  supabaseUrlDefined: boolean;
  supabaseServiceRoleDefined: boolean;
  errors: string[];
  warnings: string[];
};

export type ProfileShardStoreConfigInput = {
  env?: Record<string, string | undefined>;
  projectRoot?: string;
  localManifestPath?: string;
};

export const DEFAULT_PROFILE_STORAGE_BUCKET = "blackbird-artifacts";
export const DEFAULT_PROFILE_STORAGE_PREFIX = "player-profiles/latest";

export function resolveProfileShardStoreConfig(input: ProfileShardStoreConfigInput = {}): ProfileShardStoreConfig {
  const env = input.env ?? process.env;
  const projectRoot = input.projectRoot ?? process.cwd();
  const localManifestPath = path.isAbsolute(input.localManifestPath ?? "")
    ? input.localManifestPath as string
    : path.join(projectRoot, input.localManifestPath ?? path.join(DEFAULT_PLAYER_PROFILES_SHARDED_DIR, "manifest.json"));
  const requestedMode = env.PROFILE_STORAGE_MODE?.trim().toLowerCase();
  const requestedProvider = env.PROFILE_STORAGE_PROVIDER?.trim().toLowerCase();
  const mode: ProfileStorageMode = requestedMode === "remote" ? "remote" : "local";
  const provider: ProfileStorageProvider = mode === "remote" ? "supabase" : "local";
  const bucket = mode === "remote" ? env.PROFILE_STORAGE_BUCKET?.trim() || DEFAULT_PROFILE_STORAGE_BUCKET : null;
  const prefix = mode === "remote" ? normalizePrefix(env.PROFILE_STORAGE_PREFIX || DEFAULT_PROFILE_STORAGE_PREFIX) : null;
  const supabaseUrlDefined = Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const supabaseServiceRoleDefined = Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const errors: string[] = [];
  const warnings: string[] = [];

  if (requestedMode && requestedMode !== "local" && requestedMode !== "remote") {
    warnings.push(`Unknown PROFILE_STORAGE_MODE "${requestedMode}". Falling back to local artifacts.`);
  }
  if (mode === "remote" && requestedProvider && requestedProvider !== "supabase") {
    errors.push(`Unsupported PROFILE_STORAGE_PROVIDER "${requestedProvider}". Only "supabase" is supported for remote profile storage.`);
  }
  if (mode === "remote" && !bucket) errors.push("PROFILE_STORAGE_BUCKET is required when PROFILE_STORAGE_MODE=remote.");
  if (mode === "remote" && !prefix) errors.push("PROFILE_STORAGE_PREFIX is required when PROFILE_STORAGE_MODE=remote.");
  if (mode === "remote" && !supabaseUrlDefined) errors.push("NEXT_PUBLIC_SUPABASE_URL is required for remote profile storage.");
  if (mode === "remote" && !supabaseServiceRoleDefined) errors.push("SUPABASE_SERVICE_ROLE_KEY is required for remote profile storage reads.");

  return {
    mode,
    provider,
    bucket,
    prefix,
    source: mode === "remote" ? "supabase_storage" : "local_artifacts",
    localManifestPath,
    supabaseUrlDefined,
    supabaseServiceRoleDefined,
    errors,
    warnings,
  };
}

export function profileStorageKey(prefix: string, relativePath: string) {
  return `${normalizePrefix(prefix)}/${relativePath.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

function normalizePrefix(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
