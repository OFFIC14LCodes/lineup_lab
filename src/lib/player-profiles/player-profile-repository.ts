import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { normalizePlayerName } from "@/lib/players/normalize";

import {
  createLocalProfileShardStore,
  createSupabaseProfileShardStore,
  type ProfileShardStore,
  type ProfileShardStoreDiagnostics,
} from "./profile-shard-store";
import {
  resolveProfileShardStoreConfig,
  type ProfileShardStoreConfigInput,
} from "./profile-shard-store-config";
import {
  DEFAULT_PLAYER_PROFILES_SHARDED_DIR,
  namePositionKey,
  playerProfileMatchesIndex,
  type PlayerProfileShardIndexName,
  type PlayerProfileShardManifest,
} from "./player-profile-shards";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

export const DEFAULT_PLAYER_PROFILES_ARTIFACT_PATH = path.join("artifacts", "projections", "player-profiles.json");
export const DEFAULT_PLAYER_PROFILES_SHARDED_MANIFEST_PATH = path.join(DEFAULT_PLAYER_PROFILES_SHARDED_DIR, "manifest.json");

export type PlayerProfileLookupKey =
  | { playerId: string; position?: string | null }
  | { normalizedName: string; position: string };

export type PlayerProfileRepository = {
  artifactPath: string;
  artifactStrategy: "sharded" | "single";
  exists: boolean;
  artifactSizeBytes: number | null;
  status: PlayerProfileArtifactStatus;
  loadError: string | null;
  profiles: HistoricalPlayerProfileSnapshot[];
  indexStats: PlayerProfileIndexStats;
  lookupProfile: (key: PlayerProfileLookupKey) => Promise<PlayerProfileLookupResult>;
  runtimeDiagnostics: () => Promise<PlayerProfileRuntimeDiagnostics>;
};

export type PlayerProfileArtifactStatus = "ready" | "artifact_missing" | "artifact_unreadable" | "artifact_invalid";

export type PlayerProfileLookupResult = {
  profile: HistoricalPlayerProfileSnapshot | null;
  matchedBy: string | null;
  duplicateKey: string | null;
  artifactStatus?: PlayerProfileArtifactStatus | null;
  loadError?: string | null;
};

export type PlayerProfileIndexStats = {
  totalProfiles: number;
  bySleeperId: number;
  byGsisId: number;
  byBlackbirdPlayerId: number;
  byNflId: number;
  byEspnId: number;
  byPfrId: number;
  byNamePosition: number;
  duplicateIds: Array<{ index: string; key: string; count: number }>;
  shardCount?: number;
  manifestSizeBytes?: number | null;
  largestShardSizeBytes?: number | null;
  averageShardSizeBytes?: number | null;
  totalShardedSizeBytes?: number | null;
};

export type PlayerProfileRuntimeDiagnostics = {
  artifactPath: string;
  cwd: string;
  artifactExists: boolean;
  artifactSizeBytes: number | null;
  artifactStatus: PlayerProfileArtifactStatus;
  loadError: string | null;
  profilesLoadedCount: number;
  artifactStrategy: "sharded" | "single";
  storage: ProfileShardStoreDiagnostics;
  storageMode: ProfileShardStoreDiagnostics["storageMode"];
  storageProvider: ProfileShardStoreDiagnostics["storageProvider"];
  bucket: string | null;
  prefix: string | null;
  source: ProfileShardStoreDiagnostics["source"];
  manifestLoaded: boolean;
  manifestProfileCount: number | null;
  shardLoaded: boolean;
  shardedArtifacts?: {
    manifestPath: string;
    manifestSizeBytes: number | null;
    shardCount: number;
    largestShardSizeBytes: number | null;
    averageShardSizeBytes: number | null;
    totalShardedSizeBytes: number | null;
  };
  knownLookups: {
    christianMcCaffreyBySleeperId4034: PlayerProfileKnownLookupStatus;
    christianMcCaffreyByGsisId000033280: PlayerProfileKnownLookupStatus;
    calebWilliamsByNamePosition: PlayerProfileKnownLookupStatus;
    jordynBrooksByGsisId000036409: PlayerProfileKnownLookupStatus;
  };
};

export type PlayerProfileKnownLookupStatus = {
  found: boolean;
  matchedBy: string | null;
  duplicateKey: string | null;
  playerName: string | null;
  position: string | null;
};

type IndexName = "sleeper_id" | "gsis_id" | "blackbird_player_id" | "nfl_id" | "espn_id" | "pfr_id" | "name_position";

export async function createPlayerProfileRepository(input: ({ artifactPath?: string; projectRoot?: string } & ProfileShardStoreConfigInput) = {}): Promise<PlayerProfileRepository> {
  const projectRoot = input.projectRoot ?? process.cwd();
  const artifactPath = path.isAbsolute(input.artifactPath ?? "")
    ? input.artifactPath as string
    : path.join(projectRoot, input.artifactPath ?? DEFAULT_PLAYER_PROFILES_SHARDED_MANIFEST_PATH);
  if (!input.artifactPath) {
    const config = resolveProfileShardStoreConfig({ env: input.env, projectRoot, localManifestPath: DEFAULT_PLAYER_PROFILES_SHARDED_MANIFEST_PATH });
    const store = config.mode === "remote" ? createSupabaseProfileShardStore(config) : createLocalProfileShardStore(config);
    return createShardedPlayerProfileRepository({ manifestPath: config.localManifestPath, projectRoot, store });
  }
  if (artifactPath.endsWith("manifest.json")) {
    const config = resolveProfileShardStoreConfig({ env: { PROFILE_STORAGE_MODE: "local" }, projectRoot, localManifestPath: artifactPath });
    return createShardedPlayerProfileRepository({ manifestPath: artifactPath, projectRoot, store: createLocalProfileShardStore(config) });
  }

  const loaded = loadProfiles(artifactPath);
  const profiles = loaded.profiles;
  const indexes = buildIndexes(profiles);
  const stats = buildIndexStats(profiles, indexes);

  return {
    artifactPath,
    artifactStrategy: "single",
    exists: loaded.exists,
    artifactSizeBytes: loaded.artifactSizeBytes,
    status: loaded.status,
    loadError: loaded.loadError,
    profiles,
    indexStats: stats,
    lookupProfile: async (key) => lookupProfile(key, indexes),
    runtimeDiagnostics: async () => buildRuntimeDiagnostics({
      artifactPath,
      artifactStrategy: "single",
      artifactSizeBytes: loaded.artifactSizeBytes,
      exists: loaded.exists,
      indexes,
      loadError: loaded.loadError,
      profiles,
      status: loaded.status,
      storage: localSingleStorageDiagnostics,
    }),
  };
}

async function createShardedPlayerProfileRepository(input: { manifestPath: string; projectRoot: string; store: ProfileShardStore }): Promise<PlayerProfileRepository> {
  const loaded = await input.store.loadManifest();
  const shardCache = new Map<string, HistoricalPlayerProfileSnapshot[]>();
  const indexStats = loaded.data ? buildShardedIndexStats(loaded.data) : emptyIndexStats();

  return {
    artifactPath: input.manifestPath,
    artifactStrategy: "sharded",
    exists: loaded.exists,
    artifactSizeBytes: loaded.sizeBytes,
    status: loaded.status,
    loadError: loaded.loadError,
    profiles: [],
    indexStats,
    lookupProfile: (key) => lookupShardedProfile({
      key,
      manifest: loaded.data,
      manifestStatus: loaded.status,
      manifestLoadError: loaded.loadError,
      shardCache,
      store: input.store,
    }),
    runtimeDiagnostics: async () => buildRuntimeDiagnostics({
      artifactPath: input.manifestPath,
      artifactStrategy: "sharded",
      artifactSizeBytes: loaded.sizeBytes,
      exists: loaded.exists,
      indexes: null,
      loadError: loaded.loadError,
      manifest: loaded.data,
      profiles: [],
      status: loaded.status,
      storage: input.store.diagnostics,
      lookupFn: (key) => lookupShardedProfile({
        key,
        manifest: loaded.data,
        manifestStatus: loaded.status,
        manifestLoadError: loaded.loadError,
        shardCache,
        store: input.store,
      }),
    }),
  };
}

function loadProfiles(artifactPath: string): {
  exists: boolean;
  artifactSizeBytes: number | null;
  status: PlayerProfileArtifactStatus;
  loadError: string | null;
  profiles: HistoricalPlayerProfileSnapshot[];
} {
  if (!existsSync(artifactPath)) {
    return { exists: false, artifactSizeBytes: null, status: "artifact_missing", loadError: null, profiles: [] };
  }

  let artifactSizeBytes: number | null = null;
  try {
    artifactSizeBytes = statSync(artifactPath).size;
  } catch (error) {
    return {
      exists: true,
      artifactSizeBytes,
      status: "artifact_unreadable",
      loadError: error instanceof Error ? error.message : "Unable to stat artifact.",
      profiles: [],
    };
  }

  let raw: string;
  try {
    raw = readFileSync(artifactPath, "utf8");
  } catch (error) {
    return {
      exists: true,
      artifactSizeBytes,
      status: "artifact_unreadable",
      loadError: error instanceof Error ? error.message : "Unable to read artifact.",
      profiles: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { exists: true, artifactSizeBytes, status: "artifact_invalid", loadError: "Artifact root is not an array.", profiles: [] };
    }
    return { exists: true, artifactSizeBytes, status: "ready", loadError: null, profiles: parsed as HistoricalPlayerProfileSnapshot[] };
  } catch (error) {
    return {
      exists: true,
      artifactSizeBytes,
      status: "artifact_invalid",
      loadError: error instanceof Error ? error.message : "Artifact JSON is invalid.",
      profiles: [],
    };
  }
}

function buildIndexes(profiles: HistoricalPlayerProfileSnapshot[]) {
  const indexes: Record<IndexName, Map<string, HistoricalPlayerProfileSnapshot[]>> = {
    sleeper_id: new Map(),
    gsis_id: new Map(),
    blackbird_player_id: new Map(),
    nfl_id: new Map(),
    espn_id: new Map(),
    pfr_id: new Map(),
    name_position: new Map(),
  };

  for (const profile of profiles) {
    add(indexes.sleeper_id, profile.identity.sleeperId, profile);
    add(indexes.gsis_id, profile.identity.gsisId, profile);
    add(indexes.blackbird_player_id, profile.identity.blackbirdPlayerId, profile);
    add(indexes.nfl_id, profile.identity.nflId, profile);
    add(indexes.espn_id, profile.identity.espnId, profile);
    add(indexes.pfr_id, profile.identity.pfrId, profile);
    add(indexes.name_position, namePositionKey(profile.bio.name, profile.bio.position), profile);
  }

  return indexes;
}

function lookupProfile(key: PlayerProfileLookupKey, indexes: ReturnType<typeof buildIndexes>): PlayerProfileLookupResult {
  if ("normalizedName" in key) {
    return lookupIndex(indexes.name_position, `${normalizePlayerName(key.normalizedName)}|${key.position.toUpperCase()}`, "name_position");
  }

  const id = key.playerId.trim();
  if (!id) return { profile: null, matchedBy: null, duplicateKey: null };

  for (const [indexName, index] of [
    ["sleeper_id", indexes.sleeper_id],
    ["gsis_id", indexes.gsis_id],
    ["blackbird_player_id", indexes.blackbird_player_id],
    ["nfl_id", indexes.nfl_id],
    ["espn_id", indexes.espn_id],
    ["pfr_id", indexes.pfr_id],
  ] as const) {
    const result = lookupIndex(index, id, indexName);
    if (result.profile || result.duplicateKey) return result;
  }

  if (key.position) {
    return lookupIndex(indexes.name_position, namePositionKey(id, key.position), "name_position");
  }

  return { profile: null, matchedBy: null, duplicateKey: null };
}

async function lookupShardedProfile(input: {
  key: PlayerProfileLookupKey;
  manifest: PlayerProfileShardManifest | null;
  manifestStatus: PlayerProfileArtifactStatus;
  manifestLoadError: string | null;
  shardCache: Map<string, HistoricalPlayerProfileSnapshot[]>;
  store: ProfileShardStore;
}): Promise<PlayerProfileLookupResult> {
  if (!input.manifest || input.manifestStatus !== "ready") {
    return {
      profile: null,
      matchedBy: null,
      duplicateKey: null,
      artifactStatus: input.manifestStatus,
      loadError: input.manifestLoadError,
    };
  }

  if ("normalizedName" in input.key) {
    return lookupShardedIndex({
      indexName: "name_position",
      key: `${normalizePlayerName(input.key.normalizedName)}|${input.key.position.toUpperCase()}`,
      manifest: input.manifest,
      shardCache: input.shardCache,
      store: input.store,
    });
  }

  const id = input.key.playerId.trim();
  if (!id) return { profile: null, matchedBy: null, duplicateKey: null, artifactStatus: null, loadError: null };

  for (const indexName of ["sleeper_id", "gsis_id", "blackbird_player_id", "nfl_id", "espn_id", "pfr_id"] as const) {
    const result = lookupShardedIndex({
      indexName,
      key: id,
      manifest: input.manifest,
      shardCache: input.shardCache,
      store: input.store,
    });
    // eslint-disable-next-line no-await-in-loop
    const awaited = await result;
    if (awaited.profile || awaited.duplicateKey || awaited.artifactStatus) return awaited;
  }

  if (input.key.position) {
    return lookupShardedIndex({
      indexName: "name_position",
      key: namePositionKey(id, input.key.position),
      manifest: input.manifest,
      shardCache: input.shardCache,
      store: input.store,
    });
  }

  return { profile: null, matchedBy: null, duplicateKey: null, artifactStatus: null, loadError: null };
}

async function lookupShardedIndex(input: {
  indexName: PlayerProfileShardIndexName;
  key: string;
  manifest: PlayerProfileShardManifest;
  shardCache: Map<string, HistoricalPlayerProfileSnapshot[]>;
  store: ProfileShardStore;
}): Promise<PlayerProfileLookupResult> {
  const duplicateCount = input.manifest.duplicates[input.indexName][input.key];
  if (duplicateCount) return { profile: null, matchedBy: input.indexName, duplicateKey: input.key, artifactStatus: null, loadError: null };

  const locator = input.manifest.indexes[input.indexName][input.key];
  if (!locator) return { profile: null, matchedBy: null, duplicateKey: null, artifactStatus: null, loadError: null };

  const shard = await loadShard(locator.shard, input.shardCache, input.store);
  if (shard.status !== "ready") {
    return { profile: null, matchedBy: input.indexName, duplicateKey: null, artifactStatus: shard.status, loadError: shard.loadError };
  }

  const profile = shard.profiles.find((candidate) => playerProfileMatchesIndex(candidate, input.indexName, input.key)) ?? null;
  return {
    profile,
    matchedBy: profile ? input.indexName : null,
    duplicateKey: null,
    artifactStatus: profile ? null : "artifact_invalid",
    loadError: profile ? null : `Profile locator ${locator.profileKey} was not found in ${locator.shard}.`,
  };
}

async function loadShard(
  cacheKey: string,
  shardCache: Map<string, HistoricalPlayerProfileSnapshot[]>,
  store: ProfileShardStore
): Promise<{
  status: PlayerProfileArtifactStatus;
  loadError: string | null;
  profiles: HistoricalPlayerProfileSnapshot[];
}> {
  const cached = shardCache.get(cacheKey);
  if (cached) return { status: "ready", loadError: null, profiles: cached };
  const loaded = await store.loadShard(cacheKey);
  if (loaded.status === "ready" && loaded.data) shardCache.set(cacheKey, loaded.data);
  return { status: loaded.status, loadError: loaded.loadError, profiles: loaded.data ?? [] };
}

function lookupIndex(index: Map<string, HistoricalPlayerProfileSnapshot[]>, key: string, indexName: IndexName): PlayerProfileLookupResult {
  const values = index.get(key) ?? [];
  if (values.length === 1) return { profile: values[0], matchedBy: indexName, duplicateKey: null };
  if (values.length > 1) return { profile: null, matchedBy: indexName, duplicateKey: key };
  return { profile: null, matchedBy: null, duplicateKey: null };
}

function buildIndexStats(profiles: HistoricalPlayerProfileSnapshot[], indexes: ReturnType<typeof buildIndexes>): PlayerProfileIndexStats {
  return {
    totalProfiles: profiles.length,
    bySleeperId: indexes.sleeper_id.size,
    byGsisId: indexes.gsis_id.size,
    byBlackbirdPlayerId: indexes.blackbird_player_id.size,
    byNflId: indexes.nfl_id.size,
    byEspnId: indexes.espn_id.size,
    byPfrId: indexes.pfr_id.size,
    byNamePosition: indexes.name_position.size,
    duplicateIds: Object.entries(indexes).flatMap(([index, values]) =>
      Array.from(values.entries())
        .filter(([, rows]) => rows.length > 1)
        .map(([key, rows]) => ({ index, key, count: rows.length }))
    ),
  };
}

function buildShardedIndexStats(manifest: PlayerProfileShardManifest): PlayerProfileIndexStats {
  return {
    totalProfiles: manifest.totalProfiles,
    bySleeperId: Object.keys(manifest.indexes.sleeper_id).length,
    byGsisId: Object.keys(manifest.indexes.gsis_id).length,
    byBlackbirdPlayerId: Object.keys(manifest.indexes.blackbird_player_id).length,
    byNflId: Object.keys(manifest.indexes.nfl_id).length,
    byEspnId: Object.keys(manifest.indexes.espn_id).length,
    byPfrId: Object.keys(manifest.indexes.pfr_id).length,
    byNamePosition: Object.keys(manifest.indexes.name_position).length,
    duplicateIds: Object.entries(manifest.duplicates).flatMap(([index, values]) =>
      Object.entries(values).map(([key, count]) => ({ index, key, count }))
    ),
    shardCount: manifest.shards.length,
    manifestSizeBytes: manifest.sizes.manifestSizeBytes,
    largestShardSizeBytes: manifest.sizes.largestShardSizeBytes,
    averageShardSizeBytes: manifest.sizes.averageShardSizeBytes,
    totalShardedSizeBytes: manifest.sizes.totalShardedSizeBytes,
  };
}

function emptyIndexStats(): PlayerProfileIndexStats {
  return {
    totalProfiles: 0,
    bySleeperId: 0,
    byGsisId: 0,
    byBlackbirdPlayerId: 0,
    byNflId: 0,
    byEspnId: 0,
    byPfrId: 0,
    byNamePosition: 0,
    duplicateIds: [],
    shardCount: 0,
    manifestSizeBytes: null,
    largestShardSizeBytes: null,
    averageShardSizeBytes: null,
    totalShardedSizeBytes: null,
  };
}

function add(index: Map<string, HistoricalPlayerProfileSnapshot[]>, key: string | null | undefined, profile: HistoricalPlayerProfileSnapshot) {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), profile]);
}

async function buildRuntimeDiagnostics(input: {
  artifactPath: string;
  artifactStrategy: "sharded" | "single";
  artifactSizeBytes: number | null;
  exists: boolean;
  indexes: ReturnType<typeof buildIndexes> | null;
  loadError: string | null;
  manifest?: PlayerProfileShardManifest | null;
  profiles: HistoricalPlayerProfileSnapshot[];
  status: PlayerProfileArtifactStatus;
  storage: () => ProfileShardStoreDiagnostics;
  lookupFn?: (key: PlayerProfileLookupKey) => Promise<PlayerProfileLookupResult>;
}): Promise<PlayerProfileRuntimeDiagnostics> {
  const lookup = input.lookupFn ?? (async (key: PlayerProfileLookupKey) => lookupProfile(key, input.indexes as ReturnType<typeof buildIndexes>));
  const christianMcCaffreyBySleeperId4034 = knownLookup(await lookup({ playerId: "4034" }));
  const christianMcCaffreyByGsisId000033280 = knownLookup(await lookup({ playerId: "00-0033280" }));
  const calebWilliamsByNamePosition = knownLookup(await lookup({ normalizedName: "Caleb Williams", position: "QB" }));
  const jordynBrooksByGsisId000036409 = knownLookup(await lookup({ playerId: "00-0036409" }));
  const storage = input.storage();
  return {
    artifactPath: input.artifactPath,
    cwd: process.cwd(),
    artifactExists: input.exists,
    artifactSizeBytes: input.artifactSizeBytes,
    artifactStatus: input.status,
    loadError: input.loadError,
    profilesLoadedCount: input.profiles.length,
    artifactStrategy: input.artifactStrategy,
    storage,
    storageMode: storage.storageMode,
    storageProvider: storage.storageProvider,
    bucket: storage.bucket,
    prefix: storage.prefix,
    source: storage.source,
    manifestLoaded: storage.manifestLoaded,
    manifestProfileCount: storage.manifestProfileCount,
    shardLoaded: storage.shardLoaded,
    shardedArtifacts: input.manifest ? {
      manifestPath: input.artifactPath,
      manifestSizeBytes: input.manifest.sizes.manifestSizeBytes,
      shardCount: input.manifest.shards.length,
      largestShardSizeBytes: input.manifest.sizes.largestShardSizeBytes,
      averageShardSizeBytes: input.manifest.sizes.averageShardSizeBytes,
      totalShardedSizeBytes: input.manifest.sizes.totalShardedSizeBytes,
    } : undefined,
    knownLookups: {
      christianMcCaffreyBySleeperId4034,
      christianMcCaffreyByGsisId000033280,
      calebWilliamsByNamePosition,
      jordynBrooksByGsisId000036409,
    },
  };
}

function knownLookup(result: PlayerProfileLookupResult): PlayerProfileKnownLookupStatus {
  return {
    found: Boolean(result.profile),
    matchedBy: result.matchedBy,
    duplicateKey: result.duplicateKey,
    playerName: result.profile?.bio.name ?? null,
    position: result.profile?.bio.position ?? null,
  };
}

function localSingleStorageDiagnostics(): ProfileShardStoreDiagnostics {
  return {
    storageMode: "local",
    storageProvider: "local",
    bucket: null,
    prefix: null,
    source: "local_artifacts",
    manifestLoaded: false,
    manifestProfileCount: null,
    shardLoaded: false,
    selectedShard: null,
    configErrors: [],
    configWarnings: [],
    supabaseUrlDefined: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleDefined: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
