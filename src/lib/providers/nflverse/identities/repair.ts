import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeGsisId } from "@/lib/providers/nflverse/normalize-gsis-id";

import { isPositionCompatible, isRepairableViaEspnId, isRepairableViaGsisId } from "./classify";
import type {
  DiagnoseReport,
  RepairDecision,
  RepairOptions,
  RepairReport,
  UnresolvedPlayerReport
} from "./types";

// DEF/DST must never be mapped to individual players.
const TEAM_DEFENSE_POSITIONS = new Set(["DEF", "DST", "D/ST"]);

function isTeamDefensePosition(positionGroup: string | null): boolean {
  if (!positionGroup) return false;
  return TEAM_DEFENSE_POSITIONS.has(positionGroup.toUpperCase());
}

// ─── Decision builder (pure — no side effects) ────────────────────────────

// Build repair decisions from a diagnosis report entry.
// Returns null when the player is not a repair candidate at all.
//
// Tier enforcement:
//   auto_approved  → repair (always eligible)
//   high_confidence_review → repair only if gsisId is in approvedReviewIds
//   conflict / ambiguous / rejected → null (never writable)
//   null tier (non-canonical_gsis_missing root cause) → evaluate via rootCause
export function buildRepairDecision(
  entry: UnresolvedPlayerReport,
  approvedReviewIds?: Set<string>
): RepairDecision | null {
  // Must have exactly one position-compatible canonical candidate
  if (entry.candidateCount !== 1 || !entry.canonicalPlayerId || !entry.canonicalSleeperPlayerId) {
    return null;
  }

  // Reject team-defense entities
  if (isTeamDefensePosition(entry.canonicalPositionGroup) || isTeamDefensePosition(entry.nflversePositionGroup)) {
    return null;
  }

  // ── Tier-based gating ──────────────────────────────────────────────────────
  // Applies to entries that went through evidence comparison (canonical_gsis_missing)
  if (entry.confidenceTier !== null) {
    const tier = entry.confidenceTier;

    // conflict / ambiguous / rejected — never writable, per spec
    if (tier === "conflict" || tier === "ambiguous" || tier === "rejected") {
      return null;
    }

    // high_confidence_review — writable only with explicit approval
    if (tier === "high_confidence_review") {
      if (!approvedReviewIds?.has(entry.gsisId)) {
        return {
          gsisId: entry.gsisId,
          nflverseName: entry.nflverseName,
          nflversePosition: entry.nflversePositionGroup,
          nflverseTeam: entry.nflverseTeam,
          canonicalPlayerId: entry.canonicalPlayerId,
          canonicalName: entry.canonicalName,
          canonicalSleeperId: entry.canonicalSleeperPlayerId,
          repairType: "add_gsis_id",
          newValue: entry.gsisId,
          existingValue: entry.canonicalMetaGsisId,
          decision: "skip",
          skipReason: "pending_review: not_in_approved_list",
          confidenceTier: tier
        };
      }
      // Approved review — fall through to repair logic below
    }

    // auto_approved — fall through to repair logic below
  }

  // Position groups must be compatible
  if (!isPositionCompatible(entry.nflversePositionGroup, entry.canonicalPositionGroup)) {
    return {
      gsisId: entry.gsisId,
      nflverseName: entry.nflverseName,
      nflversePosition: entry.nflversePositionGroup,
      nflverseTeam: entry.nflverseTeam,
      canonicalPlayerId: entry.canonicalPlayerId,
      canonicalName: entry.canonicalName,
      canonicalSleeperId: entry.canonicalSleeperPlayerId,
      repairType: "add_gsis_id",
      newValue: entry.gsisId,
      existingValue: entry.canonicalMetaGsisId,
      decision: "skip",
      skipReason: `position_mismatch: nflverse=${entry.nflversePositionGroup} canonical=${entry.canonicalPositionGroup}`,
      confidenceTier: entry.confidenceTier ?? undefined
    };
  }

  // No conflicting external mapping for a different player
  if (entry.hasExistingMapping && entry.existingMappingPlayerId !== entry.canonicalPlayerId) {
    return {
      gsisId: entry.gsisId,
      nflverseName: entry.nflverseName,
      nflversePosition: entry.nflversePositionGroup,
      nflverseTeam: entry.nflverseTeam,
      canonicalPlayerId: entry.canonicalPlayerId,
      canonicalName: entry.canonicalName,
      canonicalSleeperId: entry.canonicalSleeperPlayerId,
      repairType: "add_gsis_id",
      newValue: entry.gsisId,
      existingValue: entry.canonicalMetaGsisId,
      decision: "skip",
      skipReason: `conflicting_mapping: existing player_id=${entry.existingMappingPlayerId}`,
      confidenceTier: entry.confidenceTier ?? undefined
    };
  }

  // ── GSIS ID repair ──
  if (isRepairableViaGsisId(entry.rootCause)) {
    const newGsisId = normalizeGsisId(entry.gsisId);
    if (!newGsisId) return null;

    if (entry.canonicalMetaGsisId && entry.canonicalMetaGsisId !== newGsisId) {
      return {
        gsisId: entry.gsisId,
        nflverseName: entry.nflverseName,
        nflversePosition: entry.nflversePositionGroup,
        nflverseTeam: entry.nflverseTeam,
        canonicalPlayerId: entry.canonicalPlayerId,
        canonicalName: entry.canonicalName,
        canonicalSleeperId: entry.canonicalSleeperPlayerId,
        repairType: "add_gsis_id",
        newValue: newGsisId,
        existingValue: entry.canonicalMetaGsisId,
        decision: "skip",
        skipReason: `would_overwrite_existing_gsis_id: existing=${entry.canonicalMetaGsisId}`,
        confidenceTier: entry.confidenceTier ?? undefined
      };
    }

    if (entry.canonicalMetaGsisId === newGsisId) {
      return {
        gsisId: entry.gsisId,
        nflverseName: entry.nflverseName,
        nflversePosition: entry.nflversePositionGroup,
        nflverseTeam: entry.nflverseTeam,
        canonicalPlayerId: entry.canonicalPlayerId,
        canonicalName: entry.canonicalName,
        canonicalSleeperId: entry.canonicalSleeperPlayerId,
        repairType: "add_gsis_id",
        newValue: newGsisId,
        existingValue: entry.canonicalMetaGsisId,
        decision: "skip",
        skipReason: "already_present",
        confidenceTier: entry.confidenceTier ?? undefined
      };
    }

    return {
      gsisId: entry.gsisId,
      nflverseName: entry.nflverseName,
      nflversePosition: entry.nflversePositionGroup,
      nflverseTeam: entry.nflverseTeam,
      canonicalPlayerId: entry.canonicalPlayerId,
      canonicalName: entry.canonicalName,
      canonicalSleeperId: entry.canonicalSleeperPlayerId,
      repairType: "add_gsis_id",
      newValue: newGsisId,
      existingValue: entry.canonicalMetaGsisId,
      decision: "repair",
      confidenceTier: entry.confidenceTier ?? undefined
    };
  }

  // ── ESPN ID repair ──
  if (isRepairableViaEspnId(entry.rootCause, entry.nflverseEspnId)) {
    const newEspnId = entry.nflverseEspnId!;

    if (entry.canonicalMetaEspnId && entry.canonicalMetaEspnId !== newEspnId) {
      return {
        gsisId: entry.gsisId,
        nflverseName: entry.nflverseName,
        nflversePosition: entry.nflversePositionGroup,
        nflverseTeam: entry.nflverseTeam,
        canonicalPlayerId: entry.canonicalPlayerId,
        canonicalName: entry.canonicalName,
        canonicalSleeperId: entry.canonicalSleeperPlayerId,
        repairType: "add_espn_id",
        newValue: newEspnId,
        existingValue: entry.canonicalMetaEspnId,
        decision: "skip",
        skipReason: `would_overwrite_existing_espn_id: existing=${entry.canonicalMetaEspnId}`,
        confidenceTier: entry.confidenceTier ?? undefined
      };
    }

    if (entry.canonicalMetaEspnId === newEspnId) {
      return {
        gsisId: entry.gsisId,
        nflverseName: entry.nflverseName,
        nflversePosition: entry.nflversePositionGroup,
        nflverseTeam: entry.nflverseTeam,
        canonicalPlayerId: entry.canonicalPlayerId,
        canonicalName: entry.canonicalName,
        canonicalSleeperId: entry.canonicalSleeperPlayerId,
        repairType: "add_espn_id",
        newValue: newEspnId,
        existingValue: entry.canonicalMetaEspnId,
        decision: "skip",
        skipReason: "already_present",
        confidenceTier: entry.confidenceTier ?? undefined
      };
    }

    return {
      gsisId: entry.gsisId,
      nflverseName: entry.nflverseName,
      nflversePosition: entry.nflversePositionGroup,
      nflverseTeam: entry.nflverseTeam,
      canonicalPlayerId: entry.canonicalPlayerId,
      canonicalName: entry.canonicalName,
      canonicalSleeperId: entry.canonicalSleeperPlayerId,
      repairType: "add_espn_id",
      newValue: newEspnId,
      existingValue: entry.canonicalMetaEspnId,
      decision: "repair",
      confidenceTier: entry.confidenceTier ?? undefined
    };
  }

  return null;
}

// ─── DB execution (execute mode only) ─────────────────────────────────────

async function applyMetadataPatch(
  playerId: string,
  field: "gsis_id" | "espn_id",
  value: string,
  client: SupabaseClient
): Promise<void> {
  const { data, error: fetchError } = await client
    .from("players")
    .select("metadata_json")
    .eq("id", playerId)
    .single();

  if (fetchError || !data) {
    throw new Error(`Failed to fetch player ${playerId} for metadata patch: ${fetchError?.message}`);
  }

  const existingMeta = (data.metadata_json as Record<string, unknown> | null) ?? {};

  const existingValue = existingMeta[field];
  if (existingValue !== null && existingValue !== undefined && String(existingValue).trim() !== "") {
    const normalizedExisting = field === "gsis_id" ? normalizeGsisId(String(existingValue)) : String(existingValue).trim();
    if (normalizedExisting !== value) {
      throw new Error(
        `Refusing to overwrite ${field} for player ${playerId}: existing="${existingValue}", new="${value}"`
      );
    }
    return; // Already has the same value — idempotent
  }

  const patchedMeta = { ...existingMeta, [field]: value };

  const { error: updateError } = await client
    .from("players")
    .update({ metadata_json: patchedMeta })
    .eq("id", playerId);

  if (updateError) {
    throw new Error(`Failed to patch metadata_json for player ${playerId}: ${updateError.message}`);
  }
}

// ─── Main repair pipeline ─────────────────────────────────────────────────

export async function repairSleeperPlayerIdentities(
  options: RepairOptions,
  diagnoseReport: DiagnoseReport,
  client: SupabaseClient
): Promise<RepairReport> {
  const startedAt = Date.now();
  const { mode, approvedReviewIds } = options;

  const decisions: RepairDecision[] = [];
  let gsisIdRepairs = 0;
  let espnIdRepairs = 0;
  let autoApprovedRepairs = 0;
  let reviewApprovedRepairs = 0;
  let skipped = 0;
  let skippedPendingReview = 0;
  let skippedBlocked = 0;
  let conflicts = 0;
  let errors = 0;

  for (const entry of diagnoseReport.players) {
    const decision = buildRepairDecision(entry, approvedReviewIds);
    if (!decision) {
      // null = hard block (conflict tier, no candidate, DEF, etc.)
      if (entry.confidenceTier === "conflict") conflicts += 1;
      continue;
    }

    decisions.push(decision);

    if (decision.decision === "skip") {
      const reason = decision.skipReason ?? "";
      if (reason.startsWith("pending_review")) {
        skippedPendingReview += 1;
      } else if (reason.startsWith("would_overwrite") || reason.startsWith("conflicting")) {
        skippedBlocked += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    // decision.decision === "repair"
    const isReviewApproved = entry.confidenceTier === "high_confidence_review";

    if (mode === "execute") {
      try {
        const field = decision.repairType === "add_gsis_id" ? "gsis_id" : "espn_id";
        await applyMetadataPatch(decision.canonicalPlayerId, field, decision.newValue, client);
        if (decision.repairType === "add_gsis_id") gsisIdRepairs += 1;
        else espnIdRepairs += 1;
        if (isReviewApproved) reviewApprovedRepairs += 1;
        else autoApprovedRepairs += 1;
      } catch (err) {
        errors += 1;
        decisions[decisions.length - 1] = {
          ...decision,
          decision: "skip",
          skipReason: `error: ${err instanceof Error ? err.message : String(err)}`
        };
      }
    } else {
      // dry_run: count as would-be repaired
      if (decision.repairType === "add_gsis_id") gsisIdRepairs += 1;
      else espnIdRepairs += 1;
      if (isReviewApproved) reviewApprovedRepairs += 1;
      else autoApprovedRepairs += 1;
    }
  }

  return {
    mode,
    season: options.season,
    totalCandidates: decisions.length,
    gsisIdRepairs,
    espnIdRepairs,
    autoApprovedRepairs,
    reviewApprovedRepairs,
    skipped,
    skippedPendingReview,
    skippedBlocked,
    conflicts,
    errors,
    decisions,
    durationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  };
}
