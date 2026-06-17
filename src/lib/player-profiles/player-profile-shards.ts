import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizePlayerName } from "@/lib/players/normalize";

import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

export const DEFAULT_PLAYER_PROFILES_SHARDED_DIR = path.join("artifacts", "projections", "player-profiles-sharded");
export const PLAYER_PROFILE_SHARD_SIZE = 200;

export type PlayerProfileShardIndexName =
  | "sleeper_id"
  | "gsis_id"
  | "blackbird_player_id"
  | "nfl_id"
  | "espn_id"
  | "pfr_id"
  | "name_position";

export type PlayerProfileShardLocator = {
  shard: string;
  profileKey: string;
};

export type PlayerProfileShardManifest = {
  version: 1;
  generatedAt: string;
  shardSize: number;
  totalProfiles: number;
  indexes: Record<PlayerProfileShardIndexName, Record<string, PlayerProfileShardLocator>>;
  duplicates: Record<PlayerProfileShardIndexName, Record<string, number>>;
  shards: Array<{
    file: string;
    profileCount: number;
    sizeBytes: number;
  }>;
  sizes: {
    singleArtifactSizeBytes: number | null;
    manifestSizeBytes: number;
    totalShardedSizeBytes: number;
    largestShardSizeBytes: number;
    averageShardSizeBytes: number;
  };
};

type PendingIndex = Record<PlayerProfileShardIndexName, Map<string, PlayerProfileShardLocator[]>>;

export function writeShardedPlayerProfileArtifacts(input: {
  profiles: HistoricalPlayerProfileSnapshot[];
  generatedAt: string;
  singleArtifactSizeBytes?: number | null;
  outputDir?: string;
  shardSize?: number;
}): PlayerProfileShardManifest {
  const outputDir = input.outputDir ?? path.join(process.cwd(), DEFAULT_PLAYER_PROFILES_SHARDED_DIR);
  const shardSize = input.shardSize ?? PLAYER_PROFILE_SHARD_SIZE;
  const shardsDir = path.join(outputDir, "shards");

  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(shardsDir, { recursive: true });

  const pendingIndexes = emptyPendingIndexes();
  const shardEntries: PlayerProfileShardManifest["shards"] = [];

  for (let start = 0; start < input.profiles.length; start += shardSize) {
    const shardIndex = Math.floor(start / shardSize);
    const profiles = input.profiles.slice(start, start + shardSize);
    const relativeFile = path.posix.join("shards", `shard-${String(shardIndex).padStart(3, "0")}.json`);
    const absoluteFile = path.join(outputDir, relativeFile);

    writeFileSync(absoluteFile, `${JSON.stringify(profiles)}\n`, "utf8");
    const sizeBytes = statSync(absoluteFile).size;
    shardEntries.push({ file: relativeFile, profileCount: profiles.length, sizeBytes });

    for (const profile of profiles) {
      const locator = { shard: relativeFile, profileKey: profileKey(profile) };
      addPending(pendingIndexes.sleeper_id, profile.identity.sleeperId, locator);
      addPending(pendingIndexes.gsis_id, profile.identity.gsisId, locator);
      addPending(pendingIndexes.blackbird_player_id, profile.identity.blackbirdPlayerId, locator);
      addPending(pendingIndexes.nfl_id, profile.identity.nflId, locator);
      addPending(pendingIndexes.espn_id, profile.identity.espnId, locator);
      addPending(pendingIndexes.pfr_id, profile.identity.pfrId, locator);
      addPending(pendingIndexes.name_position, namePositionKey(profile.bio.name, profile.bio.position), locator);
    }
  }

  const manifestWithoutSizes = buildManifest({
    generatedAt: input.generatedAt,
    pendingIndexes,
    shardEntries,
    shardSize,
    singleArtifactSizeBytes: input.singleArtifactSizeBytes ?? null,
    totalProfiles: input.profiles.length,
  });
  const manifestPath = path.join(outputDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifestWithoutSizes)}\n`, "utf8");
  const manifestSizeBytes = statSync(manifestPath).size;
  const totalShardedSizeBytes = manifestSizeBytes + shardEntries.reduce((sum, shard) => sum + shard.sizeBytes, 0);
  const largestShardSizeBytes = Math.max(0, ...shardEntries.map((shard) => shard.sizeBytes));
  const averageShardSizeBytes = shardEntries.length ? Math.round(shardEntries.reduce((sum, shard) => sum + shard.sizeBytes, 0) / shardEntries.length) : 0;

  const manifest: PlayerProfileShardManifest = {
    ...manifestWithoutSizes,
    sizes: {
      singleArtifactSizeBytes: input.singleArtifactSizeBytes ?? null,
      manifestSizeBytes,
      totalShardedSizeBytes,
      largestShardSizeBytes,
      averageShardSizeBytes,
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
  manifest.sizes.manifestSizeBytes = statSync(manifestPath).size;
  manifest.sizes.totalShardedSizeBytes = manifest.sizes.manifestSizeBytes + shardEntries.reduce((sum, shard) => sum + shard.sizeBytes, 0);
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");

  return manifest;
}

function buildManifest(input: {
  generatedAt: string;
  pendingIndexes: PendingIndex;
  shardEntries: PlayerProfileShardManifest["shards"];
  shardSize: number;
  singleArtifactSizeBytes: number | null;
  totalProfiles: number;
}): PlayerProfileShardManifest {
  const indexes = emptyManifestIndexes();
  const duplicates = emptyDuplicateIndexes();

  for (const indexName of Object.keys(input.pendingIndexes) as PlayerProfileShardIndexName[]) {
    for (const [key, locators] of input.pendingIndexes[indexName].entries()) {
      if (locators.length === 1) {
        indexes[indexName][key] = locators[0];
      } else if (locators.length > 1) {
        duplicates[indexName][key] = locators.length;
      }
    }
  }

  return {
    version: 1,
    generatedAt: input.generatedAt,
    shardSize: input.shardSize,
    totalProfiles: input.totalProfiles,
    indexes,
    duplicates,
    shards: input.shardEntries,
    sizes: {
      singleArtifactSizeBytes: input.singleArtifactSizeBytes,
      manifestSizeBytes: 0,
      totalShardedSizeBytes: 0,
      largestShardSizeBytes: 0,
      averageShardSizeBytes: 0,
    },
  };
}

export function playerProfileMatchesIndex(
  profile: HistoricalPlayerProfileSnapshot,
  indexName: PlayerProfileShardIndexName,
  key: string
) {
  if (indexName === "sleeper_id") return profile.identity.sleeperId === key;
  if (indexName === "gsis_id") return profile.identity.gsisId === key;
  if (indexName === "blackbird_player_id") return profile.identity.blackbirdPlayerId === key;
  if (indexName === "nfl_id") return profile.identity.nflId === key;
  if (indexName === "espn_id") return profile.identity.espnId === key;
  if (indexName === "pfr_id") return profile.identity.pfrId === key;
  return namePositionKey(profile.bio.name, profile.bio.position) === key;
}

export function namePositionKey(name: string, position: string) {
  return `${normalizePlayerName(name)}|${position.toUpperCase()}`;
}

function emptyPendingIndexes(): PendingIndex {
  return {
    sleeper_id: new Map(),
    gsis_id: new Map(),
    blackbird_player_id: new Map(),
    nfl_id: new Map(),
    espn_id: new Map(),
    pfr_id: new Map(),
    name_position: new Map(),
  };
}

function emptyManifestIndexes(): PlayerProfileShardManifest["indexes"] {
  return {
    sleeper_id: {},
    gsis_id: {},
    blackbird_player_id: {},
    nfl_id: {},
    espn_id: {},
    pfr_id: {},
    name_position: {},
  };
}

function emptyDuplicateIndexes(): PlayerProfileShardManifest["duplicates"] {
  return {
    sleeper_id: {},
    gsis_id: {},
    blackbird_player_id: {},
    nfl_id: {},
    espn_id: {},
    pfr_id: {},
    name_position: {},
  };
}

function addPending(index: Map<string, PlayerProfileShardLocator[]>, key: string | null | undefined, locator: PlayerProfileShardLocator) {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), locator]);
}

function profileKey(profile: HistoricalPlayerProfileSnapshot) {
  return profile.identity.sleeperId ?? profile.identity.gsisId ?? namePositionKey(profile.bio.name, profile.bio.position);
}
