export type WarRoomPlanAlignmentLabel =
  | "Plan Fit"
  | "Need Fit"
  | "Value Fit"
  | "Scarcity Fit"
  | "Format Fit"
  | "Depth Pick"
  | "Luxury Pick"
  | "Risk Check";

export type WarRoomPlanAlignmentInput = {
  reasons?: string[] | null;
  recommendationTier?: string | null;
  scoreComponents?: {
    rosterNeedScore?: number | null;
    valueScore?: number | null;
    scarcityScore?: number | null;
    formatFitScore?: number | null;
  } | null;
  dynasty_value?: number | null;
  best_ball_value?: number | null;
  superflex_value?: number | null;
  warnings?: string[] | null;
  match_status?: string | null;
  match_confidence?: number | null;
};

export function buildWarRoomPlanAlignmentLabels(input: WarRoomPlanAlignmentInput): WarRoomPlanAlignmentLabel[] {
  const labels: WarRoomPlanAlignmentLabel[] = [];
  const components = input.scoreComponents;
  if ((input.reasons?.length ?? 0) || input.recommendationTier === "elite_target" || input.recommendationTier === "strong_target") labels.push("Plan Fit");
  if ((components?.rosterNeedScore ?? 0) >= 10) labels.push("Need Fit");
  if ((components?.valueScore ?? 0) >= 10 || (input.dynasty_value ?? input.best_ball_value ?? input.superflex_value ?? 0) > 0) labels.push("Value Fit");
  if ((components?.scarcityScore ?? 0) >= 8) labels.push("Scarcity Fit");
  if ((components?.formatFitScore ?? 0) >= 8) labels.push("Format Fit");
  if (input.recommendationTier === "depth_option") labels.push("Depth Pick");
  if (input.recommendationTier === "avoid_for_now") labels.push("Luxury Pick");
  if ((input.warnings?.length ?? 0) || input.match_status !== "matched" || (input.match_confidence !== null && input.match_confidence !== undefined && input.match_confidence < 0.75)) labels.push("Risk Check");
  return Array.from(new Set(labels)).slice(0, 6);
}
