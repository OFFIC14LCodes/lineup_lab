import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { normalizePlayerName } from "@/lib/players/normalize";

import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

export const DEFAULT_PLAYER_PROFILES_ARTIFACT_PATH = path.join("artifacts", "projections", "player-profiles.json");

export type PlayerProfileLookupKey =
  | { playerId: string; position?: string | null }
  | { normalizedName: string; position: string };

export type PlayerProfileRepository = {
  artifactPath: string;
  exists: boolean;
  artifactSizeBytes: number | null;
  status: PlayerProfileArtifactStatus;
  loadError: string | null;
  profiles: HistoricalPlayerProfileSnapshot[];
  indexStats: PlayerProfileIndexStats;
  lookupProfile: (key: PlayerProfileLookupKey) => PlayerProfileLookupResult;
  runtimeDiagnostics: () => PlayerProfileRuntimeDiagnostics;
};

export type PlayerProfileArtifactStatus = "ready" | "artifact_missing" | "artifact_unreadable" | "artifact_invalid";

export type PlayerProfileLookupResult = {
  profile: HistoricalPlayerProfileSnapshot | null;
  matchedBy: string | null;
  duplicateKey: string | null;
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
};

export type PlayerProfileRuntimeDiagnostics = {
  artifactPath: string;
  cwd: string;
  artifactExists: boolean;
  artifactSizeBytes: number | null;
  artifactStatus: PlayerProfileArtifactStatus;
  loadError: string | null;
  profilesLoadedCount: number;
  knownLookups: {
    christianMcCaffreyBySleeperId4034: PlayerProfileKnownLookupStatus;
    christianMcCaffreyByGsisId000033280: PlayerProfileKnownLookupStatus;
    calebWilliamsByNamePosition: PlayerProfileKnownLookupStatus;
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

export function createPlayerProfileRepository(input: { artifactPath?: string; projectRoot?: string } = {}): PlayerProfileRepository {
  const artifactPath = path.isAbsolute(input.artifactPath ?? "")
    ? input.artifactPath as string
    : path.join(input.projectRoot ?? process.cwd(), input.artifactPath ?? DEFAULT_PLAYER_PROFILES_ARTIFACT_PATH);
  const loaded = loadProfiles(artifactPath);
  const profiles = loaded.profiles;
  const indexes = buildIndexes(profiles);
  const stats = buildIndexStats(profiles, indexes);

  return {
    artifactPath,
    exists: loaded.exists,
    artifactSizeBytes: loaded.artifactSizeBytes,
    status: loaded.status,
    loadError: loaded.loadError,
    profiles,
    indexStats: stats,
    lookupProfile: (key) => lookupProfile(key, indexes),
    runtimeDiagnostics: () => buildRuntimeDiagnostics({
      artifactPath,
      artifactSizeBytes: loaded.artifactSizeBytes,
      exists: loaded.exists,
      indexes,
      loadError: loaded.loadError,
      profiles,
      status: loaded.status,
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

function add(index: Map<string, HistoricalPlayerProfileSnapshot[]>, key: string | null | undefined, profile: HistoricalPlayerProfileSnapshot) {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), profile]);
}

function namePositionKey(name: string, position: string) {
  return `${normalizePlayerName(name)}|${position.toUpperCase()}`;
}

function buildRuntimeDiagnostics(input: {
  artifactPath: string;
  artifactSizeBytes: number | null;
  exists: boolean;
  indexes: ReturnType<typeof buildIndexes>;
  loadError: string | null;
  profiles: HistoricalPlayerProfileSnapshot[];
  status: PlayerProfileArtifactStatus;
}): PlayerProfileRuntimeDiagnostics {
  return {
    artifactPath: input.artifactPath,
    cwd: process.cwd(),
    artifactExists: input.exists,
    artifactSizeBytes: input.artifactSizeBytes,
    artifactStatus: input.status,
    loadError: input.loadError,
    profilesLoadedCount: input.profiles.length,
    knownLookups: {
      christianMcCaffreyBySleeperId4034: knownLookup(lookupProfile({ playerId: "4034" }, input.indexes)),
      christianMcCaffreyByGsisId000033280: knownLookup(lookupProfile({ playerId: "00-0033280" }, input.indexes)),
      calebWilliamsByNamePosition: knownLookup(lookupProfile({ normalizedName: "Caleb Williams", position: "QB" }, input.indexes)),
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
