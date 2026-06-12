import { SLEEPER_RULES_BY_KEY } from "@/lib/scoring/sleeper-keys";
import { normalizeSleeperScoringSettings } from "@/lib/scoring/normalize-settings";
import type {
  AggregateScoringCompatibility,
  NormalizedScoringSettings,
  PositionGroup,
  ScoringWarning
} from "@/lib/scoring/types";

const AGGREGATE_UNSAFE_PREFIXES = ["bonus_", "pts_allow_", "yds_allow_"];
const AGGREGATE_UNKNOWN_HINTS = ["bonus", "long", "pts_allow", "yds_allow"];

export function auditAggregateScoringCompatibility(input: {
  scoringSettings: Record<string, unknown> | NormalizedScoringSettings;
  positionGroup: PositionGroup | null;
}): AggregateScoringCompatibility {
  const normalizedSettings = normalizeSleeperScoringSettings(input.scoringSettings);
  const safeKeys: string[] = [];
  const aggregateUnsafeKeys: string[] = [];
  const reasons: string[] = [];
  const warnings: ScoringWarning[] = [];

  for (const [key, value] of Object.entries(normalizedSettings.values)) {
    if (value === 0) continue;

    const rules = SLEEPER_RULES_BY_KEY.get(key) ?? [];
    const applicable =
      rules.length === 0 ||
      rules.some((rule) => !rule.allowedPositions?.length || (input.positionGroup && rule.allowedPositions.includes(input.positionGroup)));

    if (!applicable) {
      continue;
    }

    if (AGGREGATE_UNSAFE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      aggregateUnsafeKeys.push(key);
      reasons.push(reasonForUnsafeKey(key));
      continue;
    }

    if (rules.length === 0 && AGGREGATE_UNKNOWN_HINTS.some((hint) => key.includes(hint))) {
      aggregateUnsafeKeys.push(key);
      reasons.push(`Unknown aggregate scoring behavior for ${key}.`);
      warnings.push({
        code: "AGGREGATE_UNKNOWN_SCORING_KEY",
        scoringKey: key,
        message: `Unknown scoring key ${key} may depend on game-level detail that aggregate rows cannot reproduce exactly.`
      });
      continue;
    }

    safeKeys.push(key);
  }

  return {
    safeKeys: uniqueSorted(safeKeys),
    aggregateUnsafeKeys: uniqueSorted(aggregateUnsafeKeys),
    reasons: uniqueSorted(reasons),
    isExact: aggregateUnsafeKeys.length === 0,
    warnings
  };
}

function reasonForUnsafeKey(key: string) {
  if (key.startsWith("bonus_")) {
    return `Weekly threshold bonus ${key} cannot be reconstructed exactly from aggregate totals.`;
  }
  if (key.startsWith("pts_allow_")) {
    return `Points-allowed tier ${key} is game-based and aggregate rows are not exact.`;
  }
  if (key.startsWith("yds_allow_")) {
    return `Yards-allowed tier ${key} is game-based and aggregate rows are not exact.`;
  }
  return `Aggregate scoring is not exact for ${key}.`;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}
