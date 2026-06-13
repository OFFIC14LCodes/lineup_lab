import type { ProviderStatsJson, PlayerWeeklyStatsRow } from "@/lib/providers/data-types";

export type ReprocessExpectedRow = {
  playerId: string;
  gsisId: string;
  season: number;
  week: number;
  seasonType: "regular";
  team: string | null;
  opponent: string | null;
  positionGroup: string;
  stats: ProviderStatsJson;
  providerFantasyPoints: number | null;
  sourceRowNumber: number;
  rowSha256: string;
};

export type WeeklyRowCorrectionClassification =
  | "unchanged"
  | "zero_field_enrichment"
  | "correction"
  | "missing";

export type WeeklyRowCorrectionPlan = {
  classification: WeeklyRowCorrectionClassification;
  changedStatKeys: string[];
  changedFieldKeys: string[];
  numericCorrections: Array<{
    statKey: string;
    originalValue: number | null;
    correctedValue: number | null;
  }>;
};

export function classifyWeeklyRowCorrection(
  expected: ReprocessExpectedRow,
  existing: Pick<
    PlayerWeeklyStatsRow,
    | "provider_external_id"
    | "team"
    | "opponent"
    | "position_group"
    | "stats_json"
    | "provider_fantasy_points"
  > | null
): WeeklyRowCorrectionPlan {
  if (!existing) {
    const numericCorrections = Object.entries(expected.stats).map(([statKey, value]) => ({
      statKey,
      originalValue: null,
      correctedValue: typeof value === "number" ? value : null
    }));
    if (expected.providerFantasyPoints !== null) {
      numericCorrections.push({
        statKey: "provider_fantasy_points",
        originalValue: null,
        correctedValue: expected.providerFantasyPoints
      });
    }

    return {
      classification: "missing",
      changedStatKeys: Object.keys(expected.stats).sort(),
      changedFieldKeys: ["provider_external_id", "team", "opponent", "position_group", "provider_fantasy_points"],
      numericCorrections
    };
  }

  const expectedStats = toNumericMap(expected.stats);
  const existingStats = toNumericMap(existing.stats_json);
  const changedStatKeys = [...new Set([...Object.keys(expectedStats), ...Object.keys(existingStats)])]
    .filter((key) => !numericEquals(expectedStats[key], existingStats[key]))
    .sort();

  const changedFieldKeys = [
    compareTextField("provider_external_id", expected.gsisId, existing.provider_external_id),
    compareTextField("team", expected.team, existing.team),
    compareTextField("opponent", expected.opponent, existing.opponent),
    compareTextField("position_group", expected.positionGroup, existing.position_group),
    compareNumericField("provider_fantasy_points", expected.providerFantasyPoints, existing.provider_fantasy_points)
  ].filter((value): value is string => value !== null);

  if (changedStatKeys.length === 0 && changedFieldKeys.length === 0) {
    return {
      classification: "unchanged",
      changedStatKeys: [],
      changedFieldKeys: [],
      numericCorrections: []
    };
  }

  const numericCorrections = [
    ...changedStatKeys.map((statKey) => ({
      statKey,
      originalValue: existingStats[statKey] ?? null,
      correctedValue: expectedStats[statKey] ?? null
    })),
    ...(!numericEquals(expected.providerFantasyPoints, existing.provider_fantasy_points)
      ? [
          {
            statKey: "provider_fantasy_points",
            originalValue: existing.provider_fantasy_points,
            correctedValue: expected.providerFantasyPoints
          }
        ]
      : [])
  ];

  const isZeroFieldEnrichment =
    changedFieldKeys.length === 0 &&
    changedStatKeys.length > 0 &&
    changedStatKeys.every(
      (statKey) => expectedStats[statKey] === 0 && (existingStats[statKey] === null || existingStats[statKey] === undefined)
    );

  return {
    classification: isZeroFieldEnrichment ? "zero_field_enrichment" : "correction",
    changedStatKeys,
    changedFieldKeys,
    numericCorrections
  };
}

function compareTextField(fieldKey: string, expected: string | null, existing: string | null) {
  return normalizedText(expected) === normalizedText(existing) ? null : fieldKey;
}

function compareNumericField(fieldKey: string, expected: number | null, existing: number | null) {
  return numericEquals(expected, existing) ? null : fieldKey;
}

function normalizedText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumericMap(stats: ProviderStatsJson) {
  return Object.fromEntries(
    Object.entries(stats)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .map(([key, value]) => [key, value])
  ) as Record<string, number>;
}

function numericEquals(a: number | null | undefined, b: number | null | undefined) {
  return (a ?? null) === (b ?? null);
}
