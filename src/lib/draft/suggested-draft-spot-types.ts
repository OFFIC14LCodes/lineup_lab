export type SuggestedDraftSpotLabel =
  | "take_now"
  | "target_this_round"
  | "target_next_round"
  | "wait_for_value"
  | "value_if_falls"
  | "do_not_reach"
  | "avoid"
  | "unknown";

export type SuggestedDraftSpotRisk = "low" | "medium" | "high" | "unknown";

export type SuggestedDraftSpot = {
  pickMin: number | null;
  pickMax: number | null;
  round: number | null;
  label: SuggestedDraftSpotLabel;
  marketEdgePicks: number | null;
  reachRisk: SuggestedDraftSpotRisk;
  waitRisk: SuggestedDraftSpotRisk;
  reason: string;
};

export type SuggestedDraftSpotInput = {
  blackbirdRank: number | null;
  marketAdp: number | null;
  teamCount?: number | null;
  currentPick?: number | null;
  picksUntilNextTurn?: number | null;
  tierRisk?: "low" | "medium" | "high" | string | null;
  trustLabel?: "high" | "medium" | "low" | "very_low" | string | null;
  drafted?: boolean;
};
