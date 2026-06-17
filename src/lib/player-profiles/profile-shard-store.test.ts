import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createPlayerProfileRepository } from "./player-profile-repository";
import { createSupabaseProfileShardStore } from "./profile-shard-store";
import { resolveProfileShardStoreConfig } from "./profile-shard-store-config";
import { writeShardedPlayerProfileArtifacts } from "./player-profile-shards";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";
import { validateLocalProfileShardUploadSource } from "../../../scripts/upload-player-profile-shards";

describe("profile shard storage", () => {
  it("defaults to local artifact storage", () => {
    const config = resolveProfileShardStoreConfig({ env: {}, projectRoot: "/repo" });

    expect(config.mode).toBe("local");
    expect(config.provider).toBe("local");
    expect(config.source).toBe("local_artifacts");
    expect(config.errors).toEqual([]);
  });

  it("reports missing remote Supabase config explicitly", async () => {
    const repo = await createPlayerProfileRepository({
      env: { PROFILE_STORAGE_MODE: "remote", PROFILE_STORAGE_PROVIDER: "supabase" },
    });
    const diagnostics = await repo.runtimeDiagnostics();

    expect(repo.status).toBe("artifact_missing");
    expect(diagnostics.storageMode).toBe("remote");
    expect(diagnostics.storageProvider).toBe("supabase");
    expect(diagnostics.source).toBe("supabase_storage");
    expect(diagnostics.storage.configErrors.length).toBeGreaterThan(0);
  });

  it("warns when production is not configured for remote storage", () => {
    const config = resolveProfileShardStoreConfig({ env: { NODE_ENV: "production" } });

    expect(config.mode).toBe("local");
    expect(config.productionWarning).toBe("Production is not configured for remote profile storage. Local artifacts may be unavailable in Vercel.");
    expect(config.warnings).toContain(config.productionWarning);
  });

  it("uses local sharded artifacts when no remote env is set", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "s1" })]);
    const repo = await createPlayerProfileRepository({ artifactPath: manifestPath });
    const lookup = await repo.lookupProfile({ playerId: "s1" });
    const diagnostics = await repo.runtimeDiagnostics();

    expect(repo.status).toBe("ready");
    expect(lookup.profile?.bio.name).toBe("Test Player");
    expect(diagnostics.source).toBe("local_artifacts");
    expect(diagnostics.manifestLoaded).toBe(true);
  });

  it("loads a manifest and shard from a mocked Supabase store", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "s1" })]);
    const manifestDir = path.dirname(manifestPath);
    const manifest = readText(manifestPath);
    const shard = readText(path.join(manifestDir, "shards", "shard-000.json"));
    const store = createSupabaseProfileShardStore(
      resolveProfileShardStoreConfig({
        env: {
          PROFILE_STORAGE_MODE: "remote",
          PROFILE_STORAGE_PROVIDER: "supabase",
          PROFILE_STORAGE_BUCKET: "bucket",
          PROFILE_STORAGE_PREFIX: "player-profiles/latest",
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role",
        },
      }),
      supabaseMock({
        "player-profiles/latest/manifest.json": manifest,
        "player-profiles/latest/shards/shard-000.json": shard,
      })
    );

    const loadedManifest = await store.loadManifest();
    const loadedShard = await store.loadShard("shards/shard-000.json");

    expect(loadedManifest.status).toBe("ready");
    expect(loadedManifest.data?.totalProfiles).toBe(1);
    expect(loadedShard.status).toBe("ready");
    expect(loadedShard.data?.[0]?.identity.sleeperId).toBe("s1");
    expect(store.diagnostics()).toMatchObject({
      source: "supabase_storage",
      manifestLoaded: true,
      shardLoaded: true,
      manifestProfileCount: 1,
    });
  });

  it("remote mode can load mocked Supabase shards without local artifacts", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "s1" })]);
    const manifestDir = path.dirname(manifestPath);
    const store = createSupabaseProfileShardStore(
      resolveProfileShardStoreConfig({
        localManifestPath: path.join(os.tmpdir(), "missing-local-profile-manifest.json"),
        env: {
          PROFILE_STORAGE_MODE: "remote",
          PROFILE_STORAGE_PROVIDER: "supabase",
          PROFILE_STORAGE_BUCKET: "bucket",
          PROFILE_STORAGE_PREFIX: "player-profiles/latest",
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role",
        },
      }),
      supabaseMock({
        "player-profiles/latest/manifest.json": readText(manifestPath),
        "player-profiles/latest/shards/shard-000.json": readText(path.join(manifestDir, "shards", "shard-000.json")),
      })
    );

    await expect(store.loadManifest()).resolves.toMatchObject({ status: "ready" });
    await expect(store.loadShard("shards/shard-000.json")).resolves.toMatchObject({ status: "ready" });
    expect(store.diagnostics().source).toBe("supabase_storage");
  });

  it("reports an invalid remote shard without guessing", async () => {
    const store = createSupabaseProfileShardStore(
      resolveProfileShardStoreConfig({
        env: {
          PROFILE_STORAGE_MODE: "remote",
          PROFILE_STORAGE_PROVIDER: "supabase",
          PROFILE_STORAGE_BUCKET: "bucket",
          PROFILE_STORAGE_PREFIX: "player-profiles/latest",
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role",
        },
      }),
      supabaseMock({ "player-profiles/latest/shards/shard-000.json": "{\"not\":\"array\"}" })
    );

    const loadedShard = await store.loadShard("shards/shard-000.json");

    expect(loadedShard.status).toBe("artifact_invalid");
    expect(loadedShard.loadError).toContain("Shard root is not an array");
  });

  it("validates local shards before upload", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "s1" }), profile({ sleeperId: "s2" })]);

    const result = validateLocalProfileShardUploadSource(manifestPath);

    expect(result.valid).toBe(true);
    expect(result.manifestProfileCount).toBe(2);
    expect(result.shardCount).toBe(2);
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it("fails upload validation when a referenced shard is missing", async () => {
    const manifestPath = await writeShardedProfiles([profile({ sleeperId: "s1" })]);
    rmSync(path.join(path.dirname(manifestPath), "shards", "shard-000.json"), { force: true });

    const result = validateLocalProfileShardUploadSource(manifestPath);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Shard is missing");
  });

  it("does not include local profile shards in Next.js function tracing", () => {
    const nextConfigSource = readText(path.join(process.cwd(), "next.config.ts"));

    expect(nextConfigSource).not.toContain("./artifacts/projections/player-profiles-sharded/**/*");
    expect(nextConfigSource).toContain("./data/**/*");
    expect(nextConfigSource).toContain("Do not bundle player profile shards into Vercel functions.");
  });

  it("ignores generated profile and large nflverse artifacts", () => {
    const gitignore = readText(path.join(process.cwd(), ".gitignore"));

    for (const ignoredPath of [
      "artifacts/projections/player-profiles.json",
      "artifacts/projections/player-profiles-sharded/",
      "artifacts/projections/player-profiles-shards-diagnostics.json",
      "artifacts/projections/player-profile-remote-diagnostics.json",
      "artifacts/projections/player-profile-read-model-diagnostics.json",
      "artifacts/projections/player-profiles-diagnostics.json",
      "artifacts/projections/profile-evidence-diagnostics.csv",
      "artifacts/projections/profile-shadow-scoring-diagnostics.json",
      "data/nflverse/player_stats_2018_2025.csv",
      "data/nflverse/rosters_2018_2025.csv",
      "data/nflverse/snap_counts_2018_2025.csv",
      "data/nflverse/participation_2018_2025.csv",
      "data/nflverse/pbp_2023_2025.csv",
      "data/nflverse/pbp_2018_2025.csv",
    ]) {
      expect(gitignore).toContain(ignoredPath);
    }
  });
});

async function writeShardedProfiles(profiles: HistoricalPlayerProfileSnapshot[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "blackbird-profile-store-"));
  const outputDir = path.join(root, "player-profiles-sharded");
  writeShardedPlayerProfileArtifacts({ profiles, generatedAt: "2026-01-01T00:00:00.000Z", outputDir, shardSize: 1 });
  return path.join(outputDir, "manifest.json");
}

function profile(input: Partial<{ sleeperId: string | null }> = {}): HistoricalPlayerProfileSnapshot {
  return {
    identity: {
      blackbirdPlayerId: null,
      sleeperId: input.sleeperId ?? "s1",
      gsisId: "00-1",
      espnId: null,
      pfrId: null,
      nflId: null,
      smartId: null,
      matchConfidence: "exact_id",
      matchReasons: ["test"],
      preservedIds: { blackbirdPlayerId: null, sleeperId: input.sleeperId ?? "s1", gsisId: "00-1", espnId: null, pfrId: null, nflId: null, smartId: null },
    },
    bio: {
      name: "Test Player",
      position: "WR",
      normalizedPosition: "WR",
      team: "DET",
      status: "Active",
      active: true,
      age: 24,
      birthDate: "2002-01-01",
      height: 72,
      weight: 205,
      college: "Example",
      rookieSeason: 2024,
      yearsExperience: 2,
    },
    weeklyStats: [],
    seasonSummaries: [],
    consistencyMetrics: { mean: 0, median: 0, standardDeviation: 0, floorPercentile20: 0, ceilingPercentile80: 0, ceilingPercentile90: 0, boomWeeks: 0, bustWeeks: 0, startableWeeks: 0, consistencyScore: 0, spikeWeekScore: 0 },
    availabilityMetrics: { weeksWithStatRows: 0, missedWeekEstimate: 0, gamesPlayed: 0, availabilityScore: 0 },
    recommendationSignals: { floorScore: 0, ceilingScore: 0, consistencyScore: 0, spikeScore: 0, availabilityScore: 0, volatilityLabel: "low", formatFitHints: { redraft: "", dynasty: "", bestBall: "", idp: "" } },
    profileWarnings: [],
  };
}

function supabaseMock(files: Record<string, string>) {
  return {
    storage: {
      from: () => ({
        download: async (key: string) => {
          const text = files[key];
          if (text === undefined) return { data: null, error: { message: `not found: ${key}` } };
          return { data: new Blob([text], { type: "application/json" }), error: null };
        },
      }),
    },
  } as never;
}

function readText(filePath: string) {
  return readFileSync(filePath, "utf8");
}
