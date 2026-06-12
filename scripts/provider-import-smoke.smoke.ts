import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { approveImportMapping, createImportPreview, executeImportSession } from "@/lib/providers/import/service";
import { ImportWorkflowError } from "@/lib/providers/import/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequiredEnv } from "@/lib/env";

loadEnvConfig(process.cwd());
loadLocalEnvFallback();

type SmokePlayer = {
  id: string;
  full_name: string | null;
  team: string | null;
  position_group: string | null;
};

type AuthHarness = {
  userId: string;
  client: SupabaseClient;
  email: string;
};

type CleanupContext = {
  authUserIds: string[];
  sessionIds: string[];
  externalIds: string[];
  weeklyProviderExternalIds: string[];
};

const CURRENT_SEASON = new Date().getUTCFullYear();

describe.sequential("provider import smoke test", () => {
  it("validates the provider-import workflow against the configured Supabase project", async () => {
    console.warn("This smoke test writes only marker-scoped provider import rows and cleans up only what it creates.");

    const admin = createAdminClient();
    const marker = `provider_import_smoke_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const cleanup: CleanupContext = {
      authUserIds: [],
      sessionIds: [],
      externalIds: [],
      weeklyProviderExternalIds: []
    };

    let testFailure: unknown = null;

    try {
      const owner = await createAuthenticatedHarness(`${marker}_owner`);
      const otherUser = await createAuthenticatedHarness(`${marker}_other`);
      cleanup.authUserIds.push(owner.userId, otherUser.userId);
      const players = await selectSmokePlayers(admin);

      const schemaSummary = await inspectRemoteImportSessionSchema(admin);
      expect(schemaSummary.tableReachable).toBe(true);

      const previewTarget = await selectMappingRequiredCandidate(admin, owner.userId, marker);
      if (!previewTarget) {
        throw new Error("Unable to find a player that produces a mappingRequired weekly_stats preview.");
      }

      const directInsertSourceHash = `${marker}_forbidden_insert`;
      const directInsertAttempt = await owner.client.from("provider_import_sessions").insert({
        user_id: owner.userId,
        provider: "manual",
        dataset_kind: "weekly_stats",
        filename: "unauthorized.json",
        source_hash: directInsertSourceHash,
        session_payload_json: {},
        status: "previewed",
        expires_at: new Date(Date.now() + 60_000).toISOString()
      });
      expect(directInsertAttempt.error).not.toBeNull();
      const forbiddenInsertCount = await admin
        .from("provider_import_sessions")
        .select("id", { head: true, count: "exact" })
        .eq("source_hash", directInsertSourceHash);
      expect(forbiddenInsertCount.error).toBeNull();
      expect(forbiddenInsertCount.count ?? 0).toBe(0);

      const previewExternalId = `${marker}_preview_${previewTarget.id.slice(0, 8)}`;
      cleanup.weeklyProviderExternalIds.push(previewExternalId);

      const previewBeforeCount = await countWeeklyStats(admin, previewExternalId);
      expect(previewBeforeCount).toBe(0);

      const preview = await createImportPreview(owner.userId, {
        datasetKind: "weekly_stats",
        provider: "manual",
        filename: `..\\unsafe/${marker}.json`,
        fileMimeType: "application/json",
        fileContent: JSON.stringify([
          {
            providerExternalId: previewExternalId,
            fullName: previewTarget.full_name,
            team: previewTarget.team,
            position: previewTarget.position_group,
            season: CURRENT_SEASON,
            week: 8,
            seasonType: "regular",
            stats: {
              rec_yd: 88,
              rec_td: 1
            },
            sourceUpdatedAt: `${CURRENT_SEASON}-10-15T12:00:00.000Z`,
            sourceRecordId: `${marker}_preview_row`,
            metadata: {
              smoke_test_marker: marker,
              raw_blob: "should_not_persist"
            }
          }
        ])
      });
      cleanup.sessionIds.push(preview.sessionId);

      expect(preview.summary.totalRows).toBe(1);
      expect(preview.summary.mappingRequired).toBe(1);
      expect(preview.summary.ready).toBe(0);
      expect(preview.filename).toBe(`${marker}.json`);

      const previewAfterCount = await countWeeklyStats(admin, previewExternalId);
      expect(previewAfterCount).toBe(0);

      const ownerSessionRead = await owner.client
        .from("provider_import_sessions")
        .select("id,user_id,filename,source_hash,status,session_payload_json,created_at,updated_at")
        .eq("id", preview.sessionId)
        .single();
      expect(ownerSessionRead.error).toBeNull();
      expect(ownerSessionRead.data?.user_id).toBe(owner.userId);
      expect(ownerSessionRead.data?.filename).toBe(`${marker}.json`);
      expect(ownerSessionRead.data?.source_hash).toBe(preview.sourceHash);

      const payloadText = JSON.stringify(ownerSessionRead.data?.session_payload_json ?? {});
      expect(payloadText).not.toContain("should_not_persist");
      expect(payloadText).not.toContain("\"fileContent\"");

      const otherUserRead = await otherUser.client
        .from("provider_import_sessions")
        .select("id")
        .eq("id", preview.sessionId);
      expect(otherUserRead.error).toBeNull();
      expect(otherUserRead.data ?? []).toHaveLength(0);

      const directUpdateAttempt = await owner.client
        .from("provider_import_sessions")
        .update({ status: "completed" })
        .eq("id", preview.sessionId);
      if (directUpdateAttempt.error) {
        expect(directUpdateAttempt.error.code).toBe("42501");
      }
      const postDirectUpdate = await admin
        .from("provider_import_sessions")
        .select("status")
        .eq("id", preview.sessionId)
        .single();
      expect(postDirectUpdate.error).toBeNull();
      expect(postDirectUpdate.data?.status).toBe("mapping_review");

      const directDeleteAttempt = await owner.client
        .from("provider_import_sessions")
        .delete()
        .eq("id", preview.sessionId);
      if (directDeleteAttempt.error) {
        expect(directDeleteAttempt.error.code).toBe("42501");
      }
      const postDirectDelete = await admin
        .from("provider_import_sessions")
        .select("id")
        .eq("id", preview.sessionId)
        .single();
      expect(postDirectDelete.error).toBeNull();
      expect(postDirectDelete.data?.id).toBe(preview.sessionId);

      await expect(
        executeImportSession(owner.userId, {
          sessionId: preview.sessionId,
          confirm: true
        })
      ).rejects.toMatchObject({ code: "SESSION_NOT_EXECUTABLE" });

      await expect(
        approveImportMapping(owner.userId, {
          sessionId: preview.sessionId,
          sourceRecordId: `${marker}_preview_row`,
          action: "approve",
          playerId: players.alternate.id
        })
      ).rejects.toMatchObject({ code: "MAPPING_NOT_APPROVABLE" });

      await expect(
        approveImportMapping(otherUser.userId, {
          sessionId: preview.sessionId,
          sourceRecordId: `${marker}_preview_row`,
          action: "approve",
          playerId: preview.mappingRequiredRows[0]?.playerId
        })
      ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });

      const skipped = await approveImportMapping(owner.userId, {
        sessionId: preview.sessionId,
        sourceRecordId: `${marker}_preview_row`,
        action: "skip"
      });
      expect(skipped.reviewHistory.some((entry) => entry.action === "skip")).toBe(true);
      expect(skipped.rejectedRows.some((row) => row.sourceRecordId === `${marker}_preview_row`)).toBe(true);

      const approvalExternalId = `${marker}_approval_${previewTarget.id.slice(0, 8)}`;
      cleanup.weeklyProviderExternalIds.push(approvalExternalId);
      cleanup.externalIds.push(approvalExternalId);

      const approvalPreview = await createImportPreview(owner.userId, {
        datasetKind: "weekly_stats",
        provider: "manual",
        filename: `${marker}_approval.json`,
        fileMimeType: "application/json",
        fileContent: JSON.stringify([
          {
            providerExternalId: approvalExternalId,
            fullName: previewTarget.full_name,
            team: previewTarget.team,
            position: previewTarget.position_group,
            season: CURRENT_SEASON,
            week: 9,
            seasonType: "regular",
            stats: {
              rec_yd: 91,
              rec_td: 1,
              targets: 10
            },
            sourceUpdatedAt: `${CURRENT_SEASON}-10-22T12:00:00.000Z`,
            sourceRecordId: `${marker}_approval_row`,
            metadata: {
              smoke_test_marker: marker,
              secret_like: "not_persisted"
            }
          }
        ])
      });
      cleanup.sessionIds.push(approvalPreview.sessionId);

      const proposedPlayerId = approvalPreview.mappingRequiredRows[0]?.playerId;
      if (!proposedPlayerId) {
        throw new Error("Expected a proposed player in mappingRequired preview.");
      }

      const approved = await approveImportMapping(owner.userId, {
        sessionId: approvalPreview.sessionId,
        sourceRecordId: `${marker}_approval_row`,
        action: "approve",
        playerId: proposedPlayerId
      });

      expect(approved.summary.ready).toBe(1);
      expect(approved.reviewHistory.some((entry) => entry.action === "approve")).toBe(true);

      const approvedAgain = await approveImportMapping(owner.userId, {
        sessionId: approvalPreview.sessionId,
        sourceRecordId: `${marker}_approval_row`,
        action: "approve",
        playerId: proposedPlayerId
      });
      expect(approvedAgain.summary.ready).toBe(1);

      const mappingRow = await admin
        .from("player_external_ids")
        .select("player_id,provider,external_id,external_type,mapping_status")
        .eq("provider", "manual")
        .eq("external_id", approvalExternalId)
        .maybeSingle();
      expect(mappingRow.error).toBeNull();
      expect(mappingRow.data?.player_id).toBe(proposedPlayerId);
      expect(mappingRow.data?.mapping_status).toBe("verified");

      const executionResult = await executeImportSession(owner.userId, {
        sessionId: approvalPreview.sessionId,
        confirm: true,
        failureMode: "continue"
      });
      expect(executionResult.status).toBe("completed");
      expect(executionResult.execution?.nonTransactional).toBe(true);
      expect(executionResult.execution?.summary.written).toBe(1);

      const writtenWeeklyRow = await admin
        .from("player_weekly_stats")
        .select("id,provider,provider_external_id,week,season,stats_json,metadata_json")
        .eq("provider", "manual")
        .eq("provider_external_id", approvalExternalId)
        .maybeSingle();
      expect(writtenWeeklyRow.error).toBeNull();
      expect(writtenWeeklyRow.data?.stats_json).toMatchObject({
        rec_yd: 91,
        rec_td: 1,
        targets: 10
      });
      expect(writtenWeeklyRow.data?.metadata_json ?? {}).toEqual({});

      const secondExecution = await executeImportSession(owner.userId, {
        sessionId: approvalPreview.sessionId,
        confirm: true
      });
      expect(secondExecution.status).toBe("completed");

      const weeklyCountAfterDoubleExecute = await countWeeklyStats(admin, approvalExternalId);
      expect(weeklyCountAfterDoubleExecute).toBe(1);

      const concurrentExternalId = `${marker}_concurrent_${previewTarget.id.slice(0, 8)}`;
      cleanup.weeklyProviderExternalIds.push(concurrentExternalId);
      cleanup.externalIds.push(concurrentExternalId);

      const concurrentPreview = await createImportPreview(owner.userId, {
        datasetKind: "weekly_stats",
        provider: "manual",
        filename: `${marker}_concurrent.json`,
        fileMimeType: "application/json",
        fileContent: JSON.stringify([
          {
            providerExternalId: concurrentExternalId,
            fullName: previewTarget.full_name,
            team: previewTarget.team,
            position: previewTarget.position_group,
            season: CURRENT_SEASON,
            week: 10,
            seasonType: "regular",
            stats: {
              rec_yd: 77,
              rec_td: 0
            },
            sourceUpdatedAt: `${CURRENT_SEASON}-10-29T12:00:00.000Z`,
            sourceRecordId: `${marker}_concurrent_row`
          }
        ])
      });
      cleanup.sessionIds.push(concurrentPreview.sessionId);

      const concurrentApproved = await approveImportMapping(owner.userId, {
        sessionId: concurrentPreview.sessionId,
        sourceRecordId: `${marker}_concurrent_row`,
        action: "approve",
        playerId: concurrentPreview.mappingRequiredRows[0]?.playerId
      });
      expect(concurrentApproved.summary.ready).toBe(1);

      const concurrentResults = await Promise.allSettled([
        executeImportSession(owner.userId, {
          sessionId: concurrentPreview.sessionId,
          confirm: true,
          failureMode: "continue"
        }),
        executeImportSession(owner.userId, {
          sessionId: concurrentPreview.sessionId,
          confirm: true,
          failureMode: "continue"
        })
      ]);

      const fulfilled = concurrentResults.filter((result) => result.status === "fulfilled");
      const rejected = concurrentResults.filter((result) => result.status === "rejected");
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(rejected.length).toBeLessThanOrEqual(1);
      if (rejected[0]?.status === "rejected") {
        expect((rejected[0].reason as ImportWorkflowError).code).toMatch(/EXECUTION_ALREADY_STARTED|EXECUTION_ALREADY_COMPLETED|SESSION_NOT_EXECUTABLE/);
      }
      expect(await countWeeklyStats(admin, concurrentExternalId)).toBe(1);

      const ownSelect = await owner.client
        .from("provider_import_sessions")
        .select("id,status")
        .eq("id", approvalPreview.sessionId)
        .single();
      expect(ownSelect.error).toBeNull();
      expect(ownSelect.data?.id).toBe(approvalPreview.sessionId);

      const expiredExternalId = `${marker}_expired_${previewTarget.id.slice(0, 8)}`;
      cleanup.weeklyProviderExternalIds.push(expiredExternalId);
      cleanup.externalIds.push(expiredExternalId);

      const expiredPreview = await createImportPreview(owner.userId, {
        datasetKind: "weekly_stats",
        provider: "manual",
        filename: `${marker}_expired.json`,
        fileMimeType: "application/json",
        fileContent: JSON.stringify([
          {
            providerExternalId: expiredExternalId,
            fullName: previewTarget.full_name,
            team: previewTarget.team,
            position: previewTarget.position_group,
            season: CURRENT_SEASON,
            week: 11,
            seasonType: "regular",
            stats: {
              rec_yd: 40
            },
            sourceRecordId: `${marker}_expired_row`
          }
        ])
      });
      cleanup.sessionIds.push(expiredPreview.sessionId);

      const forcedExpired = await admin
        .from("provider_import_sessions")
        .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
        .eq("id", expiredPreview.sessionId)
        .select("status,updated_at")
        .single();
      expect(forcedExpired.error).toBeNull();

      await expect(
        approveImportMapping(owner.userId, {
          sessionId: expiredPreview.sessionId,
          sourceRecordId: `${marker}_expired_row`,
          action: "approve",
          playerId: expiredPreview.mappingRequiredRows[0]?.playerId
        })
      ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });

      const expiredSession = await admin
        .from("provider_import_sessions")
        .select("status")
        .eq("id", expiredPreview.sessionId)
        .single();
      expect(expiredSession.error).toBeNull();
      expect(expiredSession.data?.status).toBe("expired");

      const finalSessionInspect = await admin
        .from("provider_import_sessions")
        .select("*")
        .eq("id", approvalPreview.sessionId)
        .single();
      expect(finalSessionInspect.error).toBeNull();

      const sessionPayloadJson = JSON.stringify(finalSessionInspect.data?.session_payload_json ?? {});
      const sessionBytes = Buffer.byteLength(sessionPayloadJson, "utf8");
      console.info(JSON.stringify({
        marker,
        schemaSummary,
        sessionPayloadBytes: sessionBytes,
        actualImportSessionColumns: Object.keys(finalSessionInspect.data ?? {}).sort()
      }, null, 2));
    } catch (error) {
      testFailure = error;
      throw error;
    } finally {
      try {
        await cleanupImportSmoke(admin, cleanup);
      } catch (cleanupError) {
        if (testFailure) {
          console.error(
            `Provider import smoke cleanup follow-up failure: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`
          );
        } else {
          throw cleanupError;
        }
      }
    }
  });
});

async function inspectRemoteImportSessionSchema(admin: ReturnType<typeof createAdminClient>) {
  const reachable = await admin.from("provider_import_sessions").select("id", { head: true, count: "exact" }).limit(1);
  if (reachable.error) {
    throw new Error(`provider_import_sessions is not queryable remotely: ${reachable.error.message}`);
  }

  const violatedFkAttempt = await admin.from("provider_import_sessions").insert({
    user_id: "00000000-0000-4000-8000-000000000000",
    provider: "manual",
    dataset_kind: "weekly_stats",
    filename: "fk-check.json",
    source_hash: `fk_check_${Date.now()}`,
    session_payload_json: {},
    status: "previewed",
    expires_at: new Date(Date.now() + 60_000).toISOString()
  });

  return {
    tableReachable: true,
    foreignKeyRejectsUnknownUser: Boolean(violatedFkAttempt.error)
  };
}

async function selectSmokePlayers(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("players")
    .select("id,full_name,team,position_group")
    .eq("active", true)
    .not("full_name", "is", null)
    .not("team", "is", null)
    .not("position_group", "is", null)
    .limit(200);

  if (error) {
    throw new Error(`Unable to select smoke players: ${error.message}`);
  }

  const players = (data ?? []) as SmokePlayer[];
  if (players.length < 2) {
    throw new Error("Smoke test requires at least two active players with name/team/position_group.");
  }

  return {
    candidates: players,
    alternate: players[1]
  };
}

async function selectMappingRequiredCandidate(admin: ReturnType<typeof createAdminClient>, userId: string, marker: string) {
  const { candidates } = await selectSmokePlayers(admin);

  for (const player of candidates) {
    const preview = await createImportPreview(userId, {
      datasetKind: "weekly_stats",
      provider: "manual",
      filename: `${marker}_probe.json`,
      fileMimeType: "application/json",
      fileContent: JSON.stringify([
        {
          providerExternalId: `${marker}_probe_${player.id.slice(0, 8)}`,
          fullName: player.full_name,
          team: player.team,
          position: player.position_group,
          season: CURRENT_SEASON,
          week: 7,
          seasonType: "regular",
          stats: { rec_yd: 1 },
          sourceRecordId: `${marker}_probe_row`
        }
      ])
    }).catch(() => null);

    if (!preview) continue;

    const adminClient = createAdminClient();
    await adminClient.from("provider_import_sessions").delete().eq("id", preview.sessionId);

    if (preview.summary.mappingRequired === 1 && preview.mappingRequiredRows[0]?.playerId === player.id) {
      return player;
    }
  }

  return null;
}

async function createAuthenticatedHarness(marker: string): Promise<AuthHarness> {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const admin = createAdminClient();
  const email = `${marker}@blackbirdgm.local`;
  const password = `${marker}_Password1!`;
  const client = createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (created.error || !created.data.user) {
    throw new Error(`Unable to create import-smoke auth user: ${created.error?.message ?? "unknown error"}`);
  }

  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw new Error(`Unable to sign in import-smoke auth user: ${signIn.error.message}`);
  }

  return {
    userId: created.data.user.id,
    client,
    email
  };
}

async function countWeeklyStats(admin: ReturnType<typeof createAdminClient>, providerExternalId: string) {
  const { count, error } = await admin
    .from("player_weekly_stats")
    .select("id", { head: true, count: "exact" })
    .eq("provider", "manual")
    .eq("provider_external_id", providerExternalId);
  if (error) {
    throw new Error(`Unable to count weekly stats for ${providerExternalId}: ${error.message}`);
  }
  return count ?? 0;
}

async function cleanupImportSmoke(admin: ReturnType<typeof createAdminClient>, cleanup: CleanupContext) {
  for (const providerExternalId of cleanup.weeklyProviderExternalIds) {
    const weeklyDelete = await admin
      .from("player_weekly_stats")
      .delete()
      .eq("provider", "manual")
      .eq("provider_external_id", providerExternalId);
    if (weeklyDelete.error) {
      throw new Error(`Failed to clean weekly stats ${providerExternalId}: ${weeklyDelete.error.message}`);
    }
  }

  for (const externalId of cleanup.externalIds) {
    const mappingDelete = await admin
      .from("player_external_ids")
      .delete()
      .eq("provider", "manual")
      .eq("external_id", externalId);
    if (mappingDelete.error) {
      throw new Error(`Failed to clean external mapping ${externalId}: ${mappingDelete.error.message}`);
    }
  }

  for (const sessionId of cleanup.sessionIds) {
    const sessionDelete = await admin
      .from("provider_import_sessions")
      .delete()
      .eq("id", sessionId);
    if (sessionDelete.error) {
      throw new Error(`Failed to clean provider import session ${sessionId}: ${sessionDelete.error.message}`);
    }
  }

  for (const providerExternalId of cleanup.weeklyProviderExternalIds) {
    expect(await countWeeklyStats(admin, providerExternalId)).toBe(0);
  }

  for (const externalId of cleanup.externalIds) {
    const remainingMapping = await admin
      .from("player_external_ids")
      .select("id", { head: true, count: "exact" })
      .eq("provider", "manual")
      .eq("external_id", externalId);
    if (remainingMapping.error) {
      throw new Error(`Failed to verify external mapping cleanup for ${externalId}: ${remainingMapping.error.message}`);
    }
    expect(remainingMapping.count ?? 0).toBe(0);
  }

  for (const sessionId of cleanup.sessionIds) {
    const remainingSession = await admin
      .from("provider_import_sessions")
      .select("id", { head: true, count: "exact" })
      .eq("id", sessionId);
    if (remainingSession.error) {
      throw new Error(`Failed to verify import session cleanup for ${sessionId}: ${remainingSession.error.message}`);
    }
    expect(remainingSession.count ?? 0).toBe(0);
  }

  for (const authUserId of cleanup.authUserIds) {
    const deleted = await admin.auth.admin.deleteUser(authUserId);
    if (deleted.error) {
      throw new Error(`Failed to delete import-smoke auth user ${authUserId}: ${deleted.error.message}`);
    }
  }
}

function loadLocalEnvFallback() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
