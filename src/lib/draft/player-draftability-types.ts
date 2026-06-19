import type { LeaguePositionEligibilityInput } from "./league-position-eligibility";
import type { PositionGroup } from "./roster-slots";

export type DraftabilityReason =
  | "position_not_eligible"
  | "final_policy_blocked_archive"
  | "legacy_archive_blocked"
  | "inactive_or_retired_status"
  | "active_universe_policy_blocked"
  | "manual_review_required"
  | "source_expansion_required"
  | "shadow_only"
  | "kicker_review_required";

export type DraftabilityPolicy =
  | "final_policy_active_candidate"
  | "final_policy_current_path_only"
  | "final_policy_shadow_only"
  | "final_policy_manual_review"
  | "final_policy_source_expansion_required"
  | "final_policy_kicker_review_required"
  | "final_policy_blocked_archive"
  | string;

export type DraftabilityPlayerLike = {
  position?: string | null;
  player_name?: string | null;
  playerName?: string | null;
  fullName?: string | null;
  team?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  retired?: boolean | null;
  status?: string | null;
  roster_status?: string | null;
  rosterStatus?: string | null;
  activePolicyClass?: string | null;
  active_policy?: string | null;
  active_policy_class?: string | null;
  finalPolicyClass?: string | null;
  final_policy_class?: string | null;
  policyClassification?: string | null;
  policy_classification?: string | null;
  policyGroup?: string | null;
  policy_group?: string | null;
  sourceVariant?: string | null;
  source_variant?: string | null;
  kickerPolicyAllowed?: boolean | null;
  fantasyPositions?: string[] | null;
  fantasy_positions?: string[] | null;
  fantasy_positions_json?: string[] | null;
  eligiblePositions?: string[] | null;
  eligible_positions?: string[] | null;
  eligible_positions_json?: string[] | null;
};

export type PlayerDraftabilityInput = LeaguePositionEligibilityInput;

export type PlayerDraftabilityResult = {
  draftable: boolean;
  reasons: DraftabilityReason[];
  policy: DraftabilityPolicy | null;
  policyGroup: string | null;
  normalizedPosition: PositionGroup | null;
  eligiblePositions: PositionGroup[];
};

export type DraftabilityFilteredExample = {
  player_name: string | null;
  position: string | null;
  team: string | null;
  policy: string | null;
  policy_group: string | null;
  reasons: DraftabilityReason[];
};

export type FilterDraftablePlayersResult<T> = {
  players: T[];
  filteredCount: number;
  filteredReasons: Record<DraftabilityReason, number>;
  filteredPolicyCounts: Record<string, number>;
  filteredPositions: string[];
  filteredExamples: DraftabilityFilteredExample[];
};
