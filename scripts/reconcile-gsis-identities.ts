#!/usr/bin/env tsx
/**
 * Targeted GSIS identity reconciliation for explicitly provided IDs.
 *
 * Dry run:
 *   npm run reconcile:gsis-identities -- --season=2025 --gsis-ids=00-0039108,00-0037288
 *
 * Execute:
 *   npm run reconcile:gsis-identities -- --season=2025 --gsis-ids=00-0039108,00-0037288 --execute
 *
 * Safety:
 *   - Only processes the GSIS IDs explicitly passed in.
 *   - Requires a unique canonical candidate.
 *   - Requires auto-approved evidence.
 *   - Refuses conflicting metadata or conflicting player_external_ids ownership.
 *   - Idempotent on reruns.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { normalizePlayerName } from "../src/lib/players/normalize";
import { upsertExternalIdMapping } from "../src/lib/providers/external-ids";
import { loadAllCanonicalPlayers, loadExistingMappingsForGsisIds, loadNflversePlayersMap } from "../src/lib/providers/nflverse/identities/diagnose";
import { evaluateGsisReconciliationTarget } from "../src/lib/providers/nflverse/identities/reconcile";
import { normalizeGsisId } from "../src/lib/providers/nflverse/normalize-gsis-id";

loadLocalEnv();

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

type MappingRow = {
  player_id: string;
  provider: string;
  external_id: string;
  external_type: string;
  season: number | null;
  mapping_status: string;
  mapping_method: string | null;
};

type TargetReport = {
  gsisId: string;
  nflverseName: string | null;
  nflverseTeam: string | null;
  nflversePositionGroup: string | null;
  nflverseEspnId: string | null;
  canonicalPlayerId: string | null;
  canonicalName: string | null;
  canonicalSleeperId: string | null;
  canonicalTeam: string | null;
  canonicalPositionGroup: string | null;
  canonicalMetaGsisId: string | null;
  existingMappingPlayerId: string | null;
  existingProviderIds: string[];
  evidenceTier: string | null;
  approvalReason: string | null;
  status: string;
  reason: string;
  metadataPatched: boolean;
  externalMappingWritten: boolean;
};

async function main() {
  const season = parseSeason(process.argv, process.env);
  const execute = process.argv.includes("--execute");
  const gsisIds = parseGsisIds(process.argv);
  const projectRoot = process.cwd();

  if (gsisIds.length === 0) {
    console.error("ERROR: Pass --gsis-ids=<comma-separated-ids>.");
    process.exit(1);
  }

  const nflversePlayers = loadNflversePlayersMap(projectRoot);
  const canonical = await loadAllCanonicalPlayers(adminClient);
  const existingMappings = await loadExistingMappingsForGsisIds(gsisIds, adminClient);

  const playerIdsToLookup = new Set<string>();
  const evaluated = gsisIds.map((gsisId) => {
    const nflversePlayer = nflversePlayers.get(gsisId) ?? null;
    const normalizedName = nflversePlayer ? normalizePlayerName(nflversePlayer.displayName) : null;
    const allNameCandidates = normalizedName ? canonical.byNormalizedName.get(normalizedName) ?? [] : [];
    const result = evaluateGsisReconciliationTarget({
      gsisId,
      nflversePlayer,
      allNameCandidates,
      existingMappingPlayerId: existingMappings.get(gsisId) ?? null
    });

    if (result.canonicalPlayer?.playerId) {
      playerIdsToLookup.add(result.canonicalPlayer.playerId);
    }

    return result;
  });

  const existingProviderIds = await loadExistingProviderIds([...playerIdsToLookup]);

  const reports: TargetReport[] = [];
  let insertedMappings = 0;
  let existingRows = 0;
  let conflicts = 0;
  let unresolved = 0;
  let metadataPatches = 0;

  for (const result of evaluated) {
    const existingProviderIdRows = result.canonicalPlayer?.playerId
      ? existingProviderIds.get(result.canonicalPlayer.playerId) ?? []
      : [];

    let metadataPatched = false;
    let externalMappingWritten = false;

    if (result.status === "repairable" && result.canonicalPlayer && result.nflversePlayer) {
      if (execute) {
        metadataPatched = await ensureCanonicalGsisId(
          result.canonicalPlayer.playerId,
          result.canonicalPlayer.metaGsisId,
          result.gsisId
        );
        externalMappingWritten = await ensureGsisExternalMapping({
          playerId: result.canonicalPlayer.playerId,
          gsisId: result.gsisId,
          season,
          team: result.nflversePlayer.latestTeam,
          positionGroup: result.nflversePlayer.positionGroup,
          evidenceTier: result.evidenceTier,
          approvalReason: result.approvalReason
        });
      }

      if (metadataPatched) metadataPatches += 1;
      if (existingMappings.has(result.gsisId)) {
        existingRows += 1;
      } else if (execute ? externalMappingWritten : true) {
        insertedMappings += 1;
      }
    } else if (result.status === "existing") {
      existingRows += 1;
    } else if (result.status === "conflict") {
      conflicts += 1;
    } else {
      unresolved += 1;
    }

    reports.push({
      gsisId: result.gsisId,
      nflverseName: result.nflversePlayer?.displayName ?? null,
      nflverseTeam: result.nflversePlayer?.latestTeam ?? null,
      nflversePositionGroup: result.nflversePlayer?.positionGroup ?? null,
      nflverseEspnId: result.nflversePlayer?.espnId ?? null,
      canonicalPlayerId: result.canonicalPlayer?.playerId ?? null,
      canonicalName: result.canonicalPlayer?.fullName ?? null,
      canonicalSleeperId: result.canonicalPlayer?.sleeperId ?? null,
      canonicalTeam: result.canonicalPlayer?.team ?? null,
      canonicalPositionGroup: result.canonicalPlayer?.positionGroup ?? null,
      canonicalMetaGsisId: result.canonicalPlayer?.metaGsisId ?? null,
      existingMappingPlayerId: result.existingMappingPlayerId,
      existingProviderIds: existingProviderIdRows.map((row) =>
        `${row.provider}:${row.external_type}:${row.external_id}${row.season ? `:${row.season}` : ""}`
      ),
      evidenceTier: result.evidenceTier,
      approvalReason: result.approvalReason,
      status: result.status,
      reason: result.reason,
      metadataPatched,
      externalMappingWritten
    });
  }

  const artifactDir = path.join(projectRoot, "data", "diagnostic");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(
    artifactDir,
    `gsis-reconcile-${season}-${execute ? "execute" : "dry-run"}.json`
  );
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        season,
        mode: execute ? "execute" : "dry_run",
        insertedMappings,
        existingRows,
        conflicts,
        unresolved,
        metadataPatches,
        reports
      },
      null,
      2
    ),
    "utf8"
  );

  console.info([
    "",
    `=== Targeted GSIS Reconciliation (${execute ? "execute" : "dry run"}) ===`,
    `Season:               ${season}`,
    `Requested IDs:        ${gsisIds.length}`,
    `Inserted mappings:    ${insertedMappings}`,
    `Existing mappings:    ${existingRows}`,
    `Conflicts:            ${conflicts}`,
    `Unresolved:           ${unresolved}`,
    `Metadata patches:     ${metadataPatches}`,
    `Artifact:             ${artifactPath}`,
    "",
    ...reports.map((report) =>
      `${report.gsisId}  ${report.nflverseName ?? "unknown"}  status=${report.status}  reason=${report.reason}`
    ),
    ""
  ].join("\n"));
}

async function ensureCanonicalGsisId(
  playerId: string,
  existingGsisId: string | null,
  nextGsisId: string
) {
  if (existingGsisId === nextGsisId) {
    return false;
  }

  const { data, error } = await adminClient
    .from("players")
    .select("metadata_json")
    .eq("id", playerId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load canonical player ${playerId}: ${error?.message}`);
  }

  const metadata = ((data.metadata_json as Record<string, unknown> | null) ?? {});
  const current = metadata["gsis_id"];
  const normalizedCurrent = current != null ? normalizeGsisId(String(current)) : null;

  if (normalizedCurrent === nextGsisId) {
    return false;
  }

  if (normalizedCurrent && normalizedCurrent !== nextGsisId) {
    throw new Error(`Refusing to overwrite canonical gsis_id ${normalizedCurrent} with ${nextGsisId}.`);
  }

  const { error: updateError } = await adminClient
    .from("players")
    .update({
      metadata_json: {
        ...metadata,
        gsis_id: nextGsisId
      }
    })
    .eq("id", playerId);

  if (updateError) {
    throw new Error(`Failed to patch canonical gsis_id for ${playerId}: ${updateError.message}`);
  }

  return true;
}

async function ensureGsisExternalMapping(input: {
  playerId: string;
  gsisId: string;
  season: number;
  team: string | null;
  positionGroup: string | null;
  evidenceTier: string | null;
  approvalReason: string | null;
}) {
  await upsertExternalIdMapping(
    {
      player_id: input.playerId,
      provider: "gsis",
      external_id: input.gsisId,
      external_type: "gsis",
      season: null,
      team: input.team,
      position_group: input.positionGroup,
      mapping_status: "verified",
      mapping_method: "manual",
      confidence: 0.99,
      verified_at: new Date().toISOString(),
      metadata_json: {
        source: "h4b_fum_ret_td_reconciliation",
        season: input.season,
        evidence_tier: input.evidenceTier,
        approval_reason: input.approvalReason
      }
    },
    adminClient
  );

  return true;
}

async function loadExistingProviderIds(playerIds: string[]) {
  const grouped = new Map<string, MappingRow[]>();
  if (playerIds.length === 0) {
    return grouped;
  }

  const { data, error } = await adminClient
    .from("player_external_ids")
    .select("player_id,provider,external_id,external_type,season,mapping_status,mapping_method")
    .in("player_id", playerIds);

  if (error) {
    throw new Error(`Failed to load existing provider IDs: ${error.message}`);
  }

  for (const row of (data ?? []) as MappingRow[]) {
    const existing = grouped.get(row.player_id) ?? [];
    existing.push(row);
    grouped.set(row.player_id, existing);
  }

  return grouped;
}

function parseSeason(argv: string[], env: NodeJS.ProcessEnv) {
  const arg = argv.find((value) => value.startsWith("--season="));
  const raw = arg ? arg.slice("--season=".length) : env["NFLVERSE_SEASON"] ?? "2025";
  const season = Number.parseInt(raw, 10);
  if (!Number.isInteger(season) || season < 1900 || season > 3000) {
    throw new Error(`Invalid season: ${raw}`);
  }
  return season;
}

function parseGsisIds(argv: string[]) {
  const arg = argv.find((value) => value.startsWith("--gsis-ids="));
  if (!arg) {
    return [];
  }

  return arg
    .slice("--gsis-ids=".length)
    .split(",")
    .map((value) => normalizeGsisId(value))
    .filter((value): value is string => value !== null);
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(sep + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
