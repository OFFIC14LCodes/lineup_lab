import { normalizePositionGroup } from "@/lib/players/normalize";
import { auditLeagueScoringSettings } from "@/lib/scoring/coverage";
import { normalizeSleeperScoringSettings } from "@/lib/scoring/normalize-settings";
import { createStatResolver } from "@/lib/scoring/stat-aliases";
import { detectScoringWarnings, evaluateActiveScoringKey } from "@/lib/scoring/score-components";
import type {
  FantasyScoringResult,
  NormalizedScoringSettings,
  ScoreFantasyStatsInput,
  ScoreStoredProjectionInput,
  ScoreStoredSeasonStatsInput,
  ScoreStoredWeeklyStatsInput,
  ScoringCoverageReport,
  ScoringWarning
} from "@/lib/scoring/types";

export const BLACKBIRD_SCORING_FORMULA_VERSION = "blackbird-scoring-v1" as const;

export function scoreFantasyStats(input: ScoreFantasyStatsInput): FantasyScoringResult {
  const normalizedSettings = normalizeSleeperScoringSettings(
    isNormalizedScoringSettings(input.scoringSettings)
      ? input.scoringSettings
      : (input.scoringSettings as Record<string, unknown>)
  );
  const activeScoringKeys = Object.entries(normalizedSettings.values)
    .filter((entry) => entry[1] !== 0)
    .map((entry) => entry[0])
    .sort();
  const activeScoringKeySet = new Set(activeScoringKeys);
  const positionGroup = input.positionGroup;
  const statResolver = createStatResolver(input.stats);
  const components = [];
  const evaluatedScoringKeys: string[] = [];
  const unsupportedScoringKeys: string[] = [];
  const missingStatsForSupportedKeys: Array<{ scoringKey: string; requiredStats: string[] }> = [];
  const notApplicableScoringKeys: string[] = [];
  const warnings: ScoringWarning[] = [...detectScoringWarnings(positionGroup, activeScoringKeySet)];

  for (const scoringKey of activeScoringKeys) {
    const result = evaluateActiveScoringKey(scoringKey, normalizedSettings.values[scoringKey], {
      positionGroup,
      statSource: input.statSource ?? "actual",
      activeScoringKeys: activeScoringKeySet,
      getStat: statResolver.getStat
    });

    components.push(...result.components);
    warnings.push(...result.warnings);

    if (result.state === "evaluated") {
      evaluatedScoringKeys.push(scoringKey);
    } else if (result.state === "missing_stat") {
      missingStatsForSupportedKeys.push({
        scoringKey,
        requiredStats: result.requiredStats
      });
    } else if (result.state === "unsupported") {
      unsupportedScoringKeys.push(scoringKey);
    } else if (result.state === "not_applicable") {
      notApplicableScoringKeys.push(scoringKey);
    }
  }

  const ambiguousStatAliases = statResolver.getAmbiguousAliases();
  for (const ambiguity of ambiguousStatAliases) {
    warnings.push({
      code: "AMBIGUOUS_STAT_ALIASES",
      statKey: ambiguity.canonicalKey,
      message: `Multiple aliases for ${ambiguity.canonicalKey} were present with conflicting values. Exact canonical key wins; otherwise the first documented alias is used.`,
      details: { presentAliases: ambiguity.presentAliases }
    });
  }

  const coverage = buildCoverage({
    activeScoringKeys,
    evaluatedScoringKeys,
    unsupportedScoringKeys,
    missingStatsForSupportedKeys,
    notApplicableScoringKeys,
    unusedStatKeys: statResolver.getUnusedStatKeys(),
    ambiguousStatAliases
  });

  const sortedComponents = sortComponents(components);
  return {
    totalPoints: sortedComponents.reduce((sum, component) => sum + component.points, 0),
    components: sortedComponents,
    coverage,
    warnings: dedupeWarnings(warnings),
    positionGroup,
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
  };
}

export function scoreWeeklyStats(input: ScoreStoredWeeklyStatsInput) {
  return scoreFantasyStats({
    stats: input.row.stats_json,
    scoringSettings: input.scoringSettings,
    positionGroup: normalizePositionGroup(input.row.position_group),
    statSource: "actual",
    context: {
      season: input.row.season,
      week: input.row.week,
      playerId: input.row.player_id
    }
  });
}

export function scoreSeasonStats(input: ScoreStoredSeasonStatsInput) {
  return scoreFantasyStats({
    stats: input.row.stats_json,
    scoringSettings: input.scoringSettings,
    positionGroup: normalizePositionGroup(input.row.position_group),
    statSource: "actual",
    context: {
      season: input.row.season,
      playerId: input.row.player_id
    }
  });
}

export function scoreProjection(input: ScoreStoredProjectionInput) {
  return scoreFantasyStats({
    stats: input.row.stats_json,
    scoringSettings: input.scoringSettings,
    positionGroup: normalizePositionGroup(input.row.position_group),
    statSource: "projection",
    context: {
      season: input.row.season,
      week: input.row.week,
      playerId: input.row.player_id
    }
  });
}

export { auditLeagueScoringSettings };

function buildCoverage(input: {
  activeScoringKeys: string[];
  evaluatedScoringKeys: string[];
  unsupportedScoringKeys: string[];
  missingStatsForSupportedKeys: Array<{ scoringKey: string; requiredStats: string[] }>;
  notApplicableScoringKeys: string[];
  unusedStatKeys: string[];
  ambiguousStatAliases: Array<{ canonicalKey: string; presentAliases: string[] }>;
}): ScoringCoverageReport {
  const denominator =
    input.evaluatedScoringKeys.length + input.unsupportedScoringKeys.length + input.missingStatsForSupportedKeys.length;
  const coverageRatio = denominator === 0 ? 1 : input.evaluatedScoringKeys.length / denominator;

  return {
    supportedScoringKeys: uniqueSorted([...input.evaluatedScoringKeys, ...input.missingStatsForSupportedKeys.map((item) => item.scoringKey)]),
    unsupportedScoringKeys: uniqueSorted(input.unsupportedScoringKeys),
    missingStatsForSupportedKeys: input.missingStatsForSupportedKeys
      .map((item) => ({ scoringKey: item.scoringKey, requiredStats: uniqueSorted(item.requiredStats) }))
      .sort((a, b) => a.scoringKey.localeCompare(b.scoringKey)),
    unusedStatKeys: uniqueSorted(input.unusedStatKeys),
    ambiguousStatAliases: input.ambiguousStatAliases,
    notApplicableScoringKeys: uniqueSorted(input.notApplicableScoringKeys),
    activeScoringKeys: uniqueSorted(input.activeScoringKeys),
    evaluatedScoringKeys: uniqueSorted(input.evaluatedScoringKeys),
    coverageRatio,
    isComplete: input.unsupportedScoringKeys.length === 0 && input.missingStatsForSupportedKeys.length === 0
  };
}

function sortComponents(components: FantasyScoringResult["components"]) {
  return [...components].sort((a, b) => {
    const categoryOrder = a.category.localeCompare(b.category);
    if (categoryOrder !== 0) return categoryOrder;
    const keyOrder = a.scoringKey.localeCompare(b.scoringKey);
    if (keyOrder !== 0) return keyOrder;
    return a.statKey.localeCompare(b.statKey);
  });
}

function dedupeWarnings(warnings: ScoringWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = JSON.stringify([warning.code, warning.message, warning.scoringKey ?? null, warning.statKey ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function isNormalizedScoringSettings(value: unknown): value is NormalizedScoringSettings {
  return Boolean(value && typeof value === "object" && "values" in value);
}
