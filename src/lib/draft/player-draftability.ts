import { isPositionDraftEligible, normalizeDraftEligiblePosition } from "./league-position-eligibility";
import type {
  DraftabilityFilteredExample,
  DraftabilityPlayerLike,
  DraftabilityPolicy,
  DraftabilityReason,
  FilterDraftablePlayersResult,
  PlayerDraftabilityInput,
  PlayerDraftabilityResult,
} from "./player-draftability-types";

const POLICY_BLOCK_REASONS: Array<{ tokens: string[]; reason: DraftabilityReason }> = [
  { tokens: ["final_policy_blocked_archive", "policy_blocked_archive", "blocked_archive"], reason: "final_policy_blocked_archive" },
  { tokens: ["legacy_archive_blocked", "legacy_archive", "legacy_blocked"], reason: "legacy_archive_blocked" },
  { tokens: ["final_policy_shadow_only", "policy_shadow_only", "shadow_only"], reason: "shadow_only" },
  { tokens: ["final_policy_manual_review", "policy_manual_review", "manual_review", "conflict_review"], reason: "manual_review_required" },
  {
    tokens: ["final_policy_source_expansion_required", "policy_source_expansion_required", "source_expansion_required", "stale_unmatched_review"],
    reason: "source_expansion_required",
  },
  { tokens: ["final_policy_kicker_review_required", "policy_kicker_review_required", "kicker_policy_review"], reason: "kicker_review_required" },
];

const INACTIVE_STATUS_TOKENS = ["retired", "inactive", "archive", "archived", "legacy", "blocked", "historical_only", "historical-only"];

export function evaluatePlayerDraftability<T extends DraftabilityPlayerLike>(
  player: T,
  input: PlayerDraftabilityInput,
): PlayerDraftabilityResult {
  const reasons: DraftabilityReason[] = [];
  const normalizedPosition = normalizeDraftEligiblePosition(player.position);
  if (!isPositionDraftEligible(player.position, input)) reasons.push("position_not_eligible");

  const policy = draftabilityPolicyFor(player);
  const policyGroup = normalizedString(player.policyGroup ?? player.policy_group);
  for (const candidate of [policy, policyGroup, normalizedString(player.sourceVariant ?? player.source_variant)]) {
    const reason = blockReasonForPolicy(candidate);
    if (reason) reasons.push(reason);
  }

  if (player.active === false || player.is_active === false || player.retired === true) {
    reasons.push("inactive_or_retired_status");
  }
  for (const status of [player.status, player.roster_status, player.rosterStatus]) {
    if (statusIndicatesInactive(status)) reasons.push("inactive_or_retired_status");
  }

  if (policy === "final_policy_current_path_only" && reasons.includes("inactive_or_retired_status")) {
    reasons.push("active_universe_policy_blocked");
  }
  if (reasons.includes("kicker_review_required") && normalizedPosition === "K" && player.kickerPolicyAllowed === true) {
    removeReason(reasons, "kicker_review_required");
  }

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    draftable: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    policy,
    policyGroup,
    normalizedPosition,
  };
}

export function filterDraftablePlayers<T extends DraftabilityPlayerLike>(
  players: T[],
  input: PlayerDraftabilityInput,
): FilterDraftablePlayersResult<T> {
  const filteredReasons: Record<DraftabilityReason, number> = emptyReasonCounts();
  const filteredPolicyCounts: Record<string, number> = {};
  const filteredPositions = new Set<string>();
  const filteredExamples: DraftabilityFilteredExample[] = [];
  const draftable: T[] = [];

  for (const player of players) {
    const result = evaluatePlayerDraftability(player, input);
    if (result.draftable) {
      draftable.push(player);
      continue;
    }

    for (const reason of result.reasons) filteredReasons[reason] += 1;
    if (result.normalizedPosition) filteredPositions.add(result.normalizedPosition);
    const policyKey = result.policy ?? result.policyGroup ?? "none";
    filteredPolicyCounts[policyKey] = (filteredPolicyCounts[policyKey] ?? 0) + 1;
    filteredExamples.push({
      player_name: player.player_name ?? player.playerName ?? player.fullName ?? null,
      position: player.position ?? null,
      team: player.team ?? null,
      policy: result.policy,
      policy_group: result.policyGroup,
      reasons: result.reasons,
    });
  }

  return {
    players: draftable,
    filteredCount: players.length - draftable.length,
    filteredReasons,
    filteredPolicyCounts,
    filteredPositions: [...filteredPositions].sort(),
    filteredExamples,
  };
}

export function draftabilityPolicyFor(player: DraftabilityPlayerLike): DraftabilityPolicy | null {
  return normalizedString(
    player.activePolicyClass ??
      player.active_policy ??
      player.active_policy_class ??
      player.finalPolicyClass ??
      player.final_policy_class ??
      player.policyClassification ??
      player.policy_classification ??
      null,
  );
}

function blockReasonForPolicy(policy: string | null): DraftabilityReason | null {
  if (!policy) return null;
  if (policy === "final_policy_active_candidate" || policy === "policy_active_candidate" || policy === "final_policy_active" || policy === "current_active") {
    return null;
  }
  if (policy === "final_policy_current_path_only" || policy === "policy_current_path_only" || policy === "manual_review_remaining") return null;
  for (const { tokens, reason } of POLICY_BLOCK_REASONS) {
    if (tokens.some((token) => policy.includes(token))) return reason;
  }
  return null;
}

function statusIndicatesInactive(status: string | null | undefined): boolean {
  const normalized = normalizedString(status);
  return Boolean(normalized && INACTIVE_STATUS_TOKENS.some((token) => normalized.includes(token)));
}

function normalizedString(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return normalized || null;
}

function removeReason(reasons: DraftabilityReason[], reason: DraftabilityReason): void {
  let index = reasons.indexOf(reason);
  while (index >= 0) {
    reasons.splice(index, 1);
    index = reasons.indexOf(reason);
  }
}

function emptyReasonCounts(): Record<DraftabilityReason, number> {
  return {
    position_not_eligible: 0,
    final_policy_blocked_archive: 0,
    legacy_archive_blocked: 0,
    inactive_or_retired_status: 0,
    active_universe_policy_blocked: 0,
    manual_review_required: 0,
    source_expansion_required: 0,
    shadow_only: 0,
    kicker_review_required: 0,
  };
}
