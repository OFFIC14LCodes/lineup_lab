import { getScoringKeyDefinition, SLEEPER_RULES_BY_KEY } from "@/lib/scoring/sleeper-keys";
import { normalizeSleeperScoringSettings } from "@/lib/scoring/normalize-settings";
import type { LeagueScoringAudit, NormalizedScoringSettings, PositionGroup } from "@/lib/scoring/types";

const POSITIONS: Array<PositionGroup | "DEF" | "UNKNOWN"> = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB", "UNKNOWN"];

export function auditLeagueScoringSettings(raw: Record<string, unknown> | NormalizedScoringSettings): LeagueScoringAudit {
  const normalizedSettings = normalizeSleeperScoringSettings(raw);
  const activeKeys = Object.entries(normalizedSettings.values)
    .filter((entry) => entry[1] !== 0)
    .map((entry) => entry[0])
    .sort();

  const unknownKeys: string[] = [];
  const fullySupportedKeys: string[] = [];
  const partiallySupportedKeys: string[] = [];
  const unsupportedKeys: string[] = [];

  const positionSpecificSupport = Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      {
        supportedKeys: [] as string[],
        unsupportedKeys: [] as string[],
        notApplicableKeys: [] as string[]
      }
    ])
  ) as LeagueScoringAudit["positionSpecificSupport"];

  for (const scoringKey of activeKeys) {
    const rules = SLEEPER_RULES_BY_KEY.get(scoringKey) ?? [];
    const definition = getScoringKeyDefinition(scoringKey);
    if (rules.length === 0 && !definition) {
      unknownKeys.push(scoringKey);
      unsupportedKeys.push(scoringKey);
      for (const position of POSITIONS) {
        positionSpecificSupport[position].unsupportedKeys.push(scoringKey);
      }
      continue;
    }

    let supportedSomewhere = false;
    let unsupportedSomewhere = false;
    for (const position of POSITIONS) {
      const applicable = definition?.allowedPositions?.length
        ? position !== "UNKNOWN" && definition.allowedPositions.includes(position as PositionGroup)
        : rules.some(
            (rule) => !rule.allowedPositions?.length || (position !== "UNKNOWN" && rule.allowedPositions.includes(position as PositionGroup))
          ) || Boolean(definition);
      if (applicable) {
        if (rules.length > 0) {
          supportedSomewhere = true;
          positionSpecificSupport[position].supportedKeys.push(scoringKey);
        } else {
          unsupportedSomewhere = true;
          positionSpecificSupport[position].unsupportedKeys.push(scoringKey);
        }
      } else {
        unsupportedSomewhere = true;
        positionSpecificSupport[position].notApplicableKeys.push(scoringKey);
      }
    }

    if (supportedSomewhere && unsupportedSomewhere) {
      partiallySupportedKeys.push(scoringKey);
    } else if (supportedSomewhere) {
      fullySupportedKeys.push(scoringKey);
    } else {
      unsupportedKeys.push(scoringKey);
    }
  }

  return {
    normalizedSettings,
    fullySupportedKeys: uniqueSorted(fullySupportedKeys),
    partiallySupportedKeys: uniqueSorted(partiallySupportedKeys),
    unsupportedKeys: uniqueSorted(unsupportedKeys),
    unknownKeys: uniqueSorted(unknownKeys),
    positionSpecificSupport: Object.fromEntries(
      Object.entries(positionSpecificSupport).map(([position, support]) => [
        position,
        {
          supportedKeys: uniqueSorted(support.supportedKeys),
          unsupportedKeys: uniqueSorted(support.unsupportedKeys),
          notApplicableKeys: uniqueSorted(support.notApplicableKeys)
        }
      ])
    ) as LeagueScoringAudit["positionSpecificSupport"]
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}
