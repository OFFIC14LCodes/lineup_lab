import { SLEEPER_RULES_BY_KEY } from "@/lib/scoring/sleeper-keys";
import type {
  FantasyScoringComponent,
  PositionGroup,
  ScoringRuleContext,
  ScoringWarning
} from "@/lib/scoring/types";

export type EvaluationAccumulator = {
  components: FantasyScoringComponent[];
  warnings: ScoringWarning[];
  evaluatedScoringKeys: string[];
  missingStatsForSupportedKeys: Array<{
    scoringKey: string;
    requiredStats: string[];
  }>;
  unsupportedScoringKeys: string[];
  notApplicableScoringKeys: string[];
};

export function evaluateActiveScoringKey(
  scoringKey: string,
  scoringValue: number,
  context: Omit<ScoringRuleContext, "scoringKey" | "scoringValue">
) {
  const rules = SLEEPER_RULES_BY_KEY.get(scoringKey) ?? [];
  if (rules.length === 0) {
    return {
      components: [] as FantasyScoringComponent[],
      warnings: [] as ScoringWarning[],
      state: "unsupported" as const,
      requiredStats: [] as string[]
    };
  }

  const rule =
    rules.find((entry) => !entry.allowedPositions?.length || (context.positionGroup && entry.allowedPositions.includes(context.positionGroup))) ??
    rules[0];

  const result = rule.evaluate({
    ...context,
    scoringKey,
    scoringValue
  });

  return {
    components: result.state === "evaluated" ? sortComponents(result.components) : [],
    warnings: "warning" in result && result.warning ? [result.warning] : [],
    state: result.state,
    requiredStats: result.requiredStats
  };
}

export function detectScoringWarnings(positionGroup: PositionGroup | null, activeScoringKeys: Set<string>) {
  const warnings: ScoringWarning[] = [];

  if (!positionGroup) {
    warnings.push({
      code: "POSITION_GROUP_MISSING",
      message: "Position group is missing; position-specific scoring keys could not be applied."
    });
  }

  if (
    positionGroup &&
    ["DL", "LB", "DB"].includes(positionGroup) &&
    activeScoringKeys.has("tkl") &&
    (activeScoringKeys.has("solo_tkl") || activeScoringKeys.has("ast_tkl"))
  ) {
    warnings.push({
      code: "OVERLAPPING_IDP_TACKLE_KEYS",
      message: "League scores total tackles alongside solo or assisted tackles. Explicit keys were scored without deriving missing tackle stats."
    });
  }

  return warnings;
}

function sortComponents(components: FantasyScoringComponent[]) {
  return [...components].sort((a, b) => {
    const categoryOrder = a.category.localeCompare(b.category);
    if (categoryOrder !== 0) return categoryOrder;
    const scoringKeyOrder = a.scoringKey.localeCompare(b.scoringKey);
    if (scoringKeyOrder !== 0) return scoringKeyOrder;
    return a.statKey.localeCompare(b.statKey);
  });
}
