import type {
  HistoricalPlayerProfileSnapshot,
  PlayerProfileSeasonSummary,
} from "@/lib/player-profiles";

import type {
  ProjectionBacktestActuals,
  ProjectionBacktestDataset,
  ProjectionBacktestAvailabilityMissType,
  ProjectionBacktestExistingProjectionRow,
  ProjectionBacktestExistingProjectionSource,
  ProjectionBacktestInputFeatures,
  ProjectionBacktestOptions,
  ProjectionBacktestPlayerRow,
  ProjectionBacktestPriorDataGroup,
  ProjectionBacktestBaselineModel,
  ProjectionBacktestCohort,
} from "./projection-backtest-types";

const DEFAULT_OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "TE", "K"];
const IDP_POSITIONS = ["DL", "LB", "DB"];

export function buildProjectionBacktestDataset(input: {
  profiles: HistoricalPlayerProfileSnapshot[];
  options: ProjectionBacktestOptions;
  existingProjectionSource?: ProjectionBacktestExistingProjectionSource | null;
}): ProjectionBacktestDataset {
  const allowedPositions = allowedPositionSet(input.options);
  const existingIndex = buildExistingProjectionIndex(input.existingProjectionSource);
  const rows: ProjectionBacktestPlayerRow[] = [];
  const skipped = { missingActuals: 0, positionFiltered: 0, insufficientPositionSupport: 0 };

  for (const profile of input.profiles) {
    const position = profile.bio.normalizedPosition;
    if (!allowedPositions.has(position)) {
      skipped.positionFiltered += 1;
      continue;
    }
    const actualSummary = seasonSummary(profile, input.options.targetSeason);
    if (!actualSummary || actualSummary.gamesPlayed <= 0 || actualSummary.pointsPerGame === null) {
      skipped.missingActuals += 1;
      continue;
    }

    const priorSummaries = profile.seasonSummaries
      .filter((summary) => typeof summary.season === "number" && summary.season < input.options.targetSeason)
      .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
    const inputFeatures = buildInputFeatures(profile, priorSummaries, input.options.targetSeason);
    const existingProjections = matchExistingProjections(profile, existingIndex);
    rows.push({
      identity: {
        sleeperId: profile.identity.sleeperId,
        gsisId: profile.identity.gsisId,
        name: profile.bio.name,
        position,
        team: profile.bio.team,
        matchConfidence: profile.identity.matchConfidence,
      },
      actuals: actualsFromProfile(profile, actualSummary),
      inputFeatures,
      predictions: {
        prior_season_ppg: null,
        weighted_recent_ppg: null,
        career_recent_blend: null,
        profile_informed_simple: null,
        blackbird_existing_projection: existingProjections.blackbird_existing_projection
          ? existingProjectionPrediction(existingProjections.blackbird_existing_projection, actualsFromProfile(profile, actualSummary), "blackbird_existing_projection")
          : null,
        blackbird_availability_calibrated: existingProjections.blackbird_availability_calibrated
          ? existingProjectionPrediction(existingProjections.blackbird_availability_calibrated, actualsFromProfile(profile, actualSummary), "blackbird_availability_calibrated")
          : null,
        blackbird_no_prior_calibrated: existingProjections.blackbird_no_prior_calibrated
          ? existingProjectionPrediction(existingProjections.blackbird_no_prior_calibrated, actualsFromProfile(profile, actualSummary), "blackbird_no_prior_calibrated")
          : null,
        blackbird_calibrated_v2: existingProjections.blackbird_calibrated_v2
          ? existingProjectionPrediction(existingProjections.blackbird_calibrated_v2, actualsFromProfile(profile, actualSummary), "blackbird_calibrated_v2")
          : null,
        blackbird_cohort_games_calibrated: existingProjections.blackbird_cohort_games_calibrated
          ? existingProjectionPrediction(existingProjections.blackbird_cohort_games_calibrated, actualsFromProfile(profile, actualSummary), "blackbird_cohort_games_calibrated")
          : null,
        blackbird_cohort_ppg_calibrated: existingProjections.blackbird_cohort_ppg_calibrated
          ? existingProjectionPrediction(existingProjections.blackbird_cohort_ppg_calibrated, actualsFromProfile(profile, actualSummary), "blackbird_cohort_ppg_calibrated")
          : null,
        blackbird_cohort_calibrated_v3: existingProjections.blackbird_cohort_calibrated_v3
          ? existingProjectionPrediction(existingProjections.blackbird_cohort_calibrated_v3, actualsFromProfile(profile, actualSummary), "blackbird_cohort_calibrated_v3")
          : null,
        blackbird_expected_games_v4: existingProjections.blackbird_expected_games_v4
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v4, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v4")
          : null,
        blackbird_expected_games_v5_selective: existingProjections.blackbird_expected_games_v5_selective
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v5_selective, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v5_selective")
          : null,
        blackbird_expected_games_v6_gated: existingProjections.blackbird_expected_games_v6_gated
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v6_gated, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v6_gated")
          : null,
        blackbird_expected_games_v7_family_selective: existingProjections.blackbird_expected_games_v7_family_selective
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v7_family_selective, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v7_family_selective")
          : null,
        blackbird_expected_games_v8_cohort_blend: existingProjections.blackbird_expected_games_v8_cohort_blend
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v8_cohort_blend, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v8_cohort_blend")
          : null,
        blackbird_expected_games_v8_1_calibrated_gate: existingProjections.blackbird_expected_games_v8_1_calibrated_gate
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v8_1_calibrated_gate, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v8_1_calibrated_gate")
          : null,
        blackbird_expected_games_v8_2_high_impact_guardrail: existingProjections.blackbird_expected_games_v8_2_high_impact_guardrail
          ? existingProjectionPrediction(existingProjections.blackbird_expected_games_v8_2_high_impact_guardrail, actualsFromProfile(profile, actualSummary), "blackbird_expected_games_v8_2_high_impact_guardrail")
          : null,
      },
      bestBaseline: null,
      classification: "accurate",
      priorDataGroup: priorDataGroup(profile, inputFeatures, input.options.targetSeason),
      cohortLabels: cohortLabels(profile, inputFeatures, actualSummary),
    });
  }

  const rankedRows = assignActualPositionRanks(rows)
    .sort((a, b) => a.identity.position.localeCompare(b.identity.position) || a.identity.name.localeCompare(b.identity.name));
  const inputSeasonsUsed = unique(rankedRows.flatMap((row) => row.inputFeatures.inputSeasonsUsed));
  return {
    targetSeason: input.options.targetSeason,
    inputSeasonsUsed,
    actualSeasonUsed: input.options.targetSeason,
    rows: rankedRows,
    skipped,
    leakageSafety: {
      targetSeasonExcludedFromInputFeatures: rankedRows.every((row) => row.inputFeatures.inputSeasonsUsed.every((season) => season < input.options.targetSeason)),
      inputSeasonsUsed,
      actualSeasonUsed: input.options.targetSeason,
    },
  };
}

export function allowedPositionSet(options: ProjectionBacktestOptions): Set<string> {
  if (options.positions?.length) return new Set(options.positions.map((position) => position.toUpperCase()));
  return new Set(options.includeIdp ? [...DEFAULT_OFFENSIVE_POSITIONS, ...IDP_POSITIONS] : DEFAULT_OFFENSIVE_POSITIONS);
}

function buildInputFeatures(
  profile: HistoricalPlayerProfileSnapshot,
  priorSummaries: PlayerProfileSeasonSummary[],
  targetSeason: number
): ProjectionBacktestInputFeatures {
  const priorSeason = priorSummaries[0] ?? null;
  const careerGames = priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  const careerPoints = round(priorSummaries.reduce((sum, summary) => sum + summary.totalFantasyPoints, 0));
  const priorUsage = profile.seasonUsageSummaries?.find((summary) => summary.season === priorSeason?.season) ?? null;
  const priorHighValueUsage = profile.seasonHighValueUsageSummaries?.find((summary) => summary.season === priorSeason?.season) ?? null;
  const trendPpg = priorSummaries.length >= 2 && priorSummaries[0].pointsPerGame !== null && priorSummaries[1].pointsPerGame !== null
    ? round(priorSummaries[0].pointsPerGame - priorSummaries[1].pointsPerGame)
    : null;

  return {
    inputSeasonsUsed: priorSummaries.map((summary) => summary.season).filter((season): season is number => typeof season === "number" && season < targetSeason),
    priorSeason: priorSeason?.season ?? null,
    priorSeasonGames: priorSeason?.gamesPlayed ?? null,
    priorSeasonPoints: priorSeason?.totalFantasyPoints ?? null,
    priorSeasonPpg: priorSeason?.pointsPerGame ?? null,
    priorSeasonFloor: priorSeason?.floor ?? null,
    priorSeasonMedian: priorSeason?.median ?? null,
    priorSeasonCeiling: priorSeason?.ceiling ?? null,
    priorSeasonConsistency: priorSeason?.consistencyScore ?? null,
    priorSeasonSpike: priorSeason?.spikeScore ?? null,
    priorSeasonAvailability: priorSeason?.availabilityScore ?? null,
    recentSeasonPpgs: priorSummaries
      .filter((summary) => typeof summary.season === "number" && summary.pointsPerGame !== null)
      .slice(0, 3)
      .map((summary) => ({
        season: summary.season as number,
        ppg: summary.pointsPerGame as number,
        games: summary.gamesPlayed,
        points: summary.totalFantasyPoints,
      })),
    priorSeasonOffensiveSnapShare: priorUsage?.offensiveSnapShare ?? null,
    priorSeasonDefensiveSnapShare: priorUsage?.defensiveSnapShare ?? null,
    priorSeasonHighValueUsageAvailable: priorHighValueUsage?.sourceStatus === "available",
    priorSeasonHighValueUsageFlags: priorHighValueUsage?.modifiers ?? [],
    careerToDateGames: careerGames,
    careerToDatePoints: careerPoints,
    careerToDatePpg: careerGames ? round(careerPoints / careerGames) : null,
    careerTrendPpg: trendPpg,
    rookieSeason: profile.bio.rookieSeason ?? profile.careerMetadata?.rookieSeason ?? null,
    yearsExperience: profile.bio.yearsExperience ?? null,
    roleLabelThroughPreviousSeason: deriveRoleLabel(profile.bio.normalizedPosition, priorUsage),
    usageTrendThroughPreviousSeason: priorUsage?.trendLabel ?? "insufficient_data",
    coverageLabel: profile.careerMetadata?.coverageLabel ?? null,
    warnings: [
      ...profile.profileWarnings,
      ...(profile.roleWarnings ?? []),
      ...(profile.highValueRoleWarnings ?? []),
    ],
  };
}

function existingProjectionPrediction(row: ProjectionBacktestExistingProjectionRow, actuals: ProjectionBacktestActuals, model: ProjectionBacktestBaselineModel) {
  const predictedGames = row.projectedGames;
  const predictedPpg = row.projectedPpg ?? (row.projectedTotalPoints !== null && predictedGames ? round(row.projectedTotalPoints / predictedGames) : null);
  const predictedTotalPoints = row.projectedTotalPoints ?? (predictedPpg !== null && predictedGames !== null ? round(predictedPpg * predictedGames) : null);
  const errorPpg = predictedPpg !== null && actuals.pointsPerGame !== null ? round(predictedPpg - actuals.pointsPerGame) : null;
  const errorTotalPoints = predictedTotalPoints !== null ? round(predictedTotalPoints - actuals.totalPoints) : null;
  const gamesError = predictedGames !== null ? round(predictedGames - actuals.games) : null;
  return {
    model,
    predictedPpg,
    predictedGames,
    predictedTotalPoints,
    errorPpg,
    errorTotalPoints,
    gamesError,
    availabilityMissType: availabilityMissType(predictedGames, actuals.games),
    ppgErrorComponent: predictedPpg !== null && actuals.pointsPerGame !== null && predictedGames !== null
      ? round((predictedPpg - actuals.pointsPerGame) * predictedGames)
      : null,
    gamesErrorComponent: predictedGames !== null && actuals.pointsPerGame !== null
      ? round((predictedGames - actuals.games) * actuals.pointsPerGame)
      : null,
    combinedError: errorTotalPoints,
    projectionSource: row.source,
    matchConfidence: row.matchConfidence ?? "source_match",
    reasons: [`Existing Blackbird projection source: ${row.source}.`],
  };
}

function actualsFromProfile(profile: HistoricalPlayerProfileSnapshot, summary: PlayerProfileSeasonSummary): ProjectionBacktestActuals {
  const weeklyScores = profile.weeklyStats
    .filter((row) => row.season === summary.season)
    .map((row) => row.calculatedFantasyPoints);
  return {
    games: summary.gamesPlayed,
    totalPoints: summary.totalFantasyPoints,
    pointsPerGame: summary.pointsPerGame,
    weeklyScores,
    positionalRank: null,
  };
}

function assignActualPositionRanks(rows: ProjectionBacktestPlayerRow[]) {
  const byPosition = new Map<string, ProjectionBacktestPlayerRow[]>();
  for (const row of rows) byPosition.set(row.identity.position, [...(byPosition.get(row.identity.position) ?? []), row]);
  for (const positionRows of byPosition.values()) {
    positionRows
      .sort((a, b) => b.actuals.totalPoints - a.actuals.totalPoints || a.identity.name.localeCompare(b.identity.name))
      .forEach((row, index) => {
        row.actuals.positionalRank = index + 1;
      });
  }
  return rows;
}

function seasonSummary(profile: HistoricalPlayerProfileSnapshot, season: number) {
  return profile.seasonSummaries.find((summary) => summary.season === season) ?? null;
}

function deriveRoleLabel(position: string, usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null) {
  if (!usage) return "insufficient_data";
  if (["DL", "LB", "DB"].includes(position)) {
    if ((usage.tackleFloorScore ?? 0) >= 70) return "tackle_floor";
    if ((usage.sackDependencyScore ?? 0) >= 60) return "sack_upside";
    if ((usage.bigPlayDependencyScore ?? 0) >= 60) return "big_play_dependent";
    return "balanced";
  }
  if (position === "QB") return (usage.carriesPerGame ?? 0) >= 5 ? "rushing_qb" : "pocket_qb";
  if (position === "RB") {
    if ((usage.touchesPerGame ?? 0) >= 18) return "workhorse";
    if ((usage.targetsPerGame ?? 0) >= 4) return "receiving_back";
    if ((usage.touchesPerGame ?? 0) >= 10) return "committee_back";
  }
  if (position === "WR" || position === "TE") {
    if ((usage.targetsPerGame ?? 0) >= 8) return "alpha_receiver";
    if ((usage.targetsPerGame ?? 0) >= 5) return "volume_receiver";
  }
  return "low_usage";
}

function priorDataGroup(profile: HistoricalPlayerProfileSnapshot, features: ProjectionBacktestInputFeatures, targetSeason: number): ProjectionBacktestPriorDataGroup {
  if (features.rookieSeason === targetSeason || (features.rookieSeason === null && features.inputSeasonsUsed.length === 0 && (profile.bio.yearsExperience ?? 0) === 0)) return "rookie";
  if (features.rookieSeason === targetSeason - 1 || ((features.yearsExperience ?? 99) <= 1 && features.inputSeasonsUsed.length <= 1)) return "second_year";
  if (features.inputSeasonsUsed.length === 0) return "no_prior_stats";
  if (features.inputSeasonsUsed.length === 1) return "one_prior_season";
  if (features.usageTrendThroughPreviousSeason !== "stable" || features.warnings.some((warning) => warning.toLowerCase().includes("role"))) return "role_change_warning";
  return "multi_year_prior";
}

function cohortLabels(
  profile: HistoricalPlayerProfileSnapshot,
  features: ProjectionBacktestInputFeatures,
  actualSummary: PlayerProfileSeasonSummary
): ProjectionBacktestCohort[] {
  const labels = new Set<ProjectionBacktestCohort>();
  const priorCount = features.inputSeasonsUsed.length;
  const position = profile.bio.normalizedPosition;
  if (priorCount >= 3) labels.add("veteran_3plus_prior_seasons");
  if (priorCount === 2) labels.add("two_prior_seasons");
  if (priorCount === 1) labels.add("one_prior_season");
  if (priorCount === 0 || (features.yearsExperience ?? 99) === 0) labels.add("rookie_or_no_prior_nfl_data");
  if (features.careerToDateGames < 8) labels.add("low_prior_sample");
  if (actualSummary.gamesPlayed < 4) labels.add("low_actual_sample");
  if (position === "DL") labels.add("idp_dl");
  if (position === "LB") labels.add("idp_lb");
  if (position === "DB") labels.add("idp_db");
  if (position === "QB") labels.add("offense_qb");
  if (position === "RB") labels.add("offense_rb");
  if (position === "WR") labels.add("offense_wr");
  if (position === "TE") labels.add("offense_te");
  if (position === "K") labels.add("kicker");
  return [...labels].sort();
}

function buildExistingProjectionIndex(source: ProjectionBacktestExistingProjectionSource | null | undefined) {
  if (!source || source.status !== "available" || !source.leakageSafe) return null;
  const index = new Map<string, Partial<Record<ProjectionBacktestBaselineModel, ProjectionBacktestExistingProjectionRow>>>();
  for (const row of source.rows) {
    const model = modelFromExistingProjectionRow(row);
    if (!model) continue;
    for (const key of existingProjectionKeys({
      sleeperId: row.sleeperId ?? null,
      gsisId: row.gsisId ?? null,
      name: row.playerName,
      position: row.position,
    })) {
      const bucket = index.get(key) ?? {};
      if (!bucket[model]) bucket[model] = row;
      index.set(key, bucket);
    }
  }
  return index;
}

function matchExistingProjections(profile: HistoricalPlayerProfileSnapshot, index: Map<string, Partial<Record<ProjectionBacktestBaselineModel, ProjectionBacktestExistingProjectionRow>>> | null) {
  const matches: Partial<Record<ProjectionBacktestBaselineModel, ProjectionBacktestExistingProjectionRow>> = {};
  if (!index) return matches;
  for (const key of existingProjectionKeys({
    sleeperId: profile.identity.sleeperId,
    gsisId: profile.identity.gsisId,
    name: profile.bio.name,
    position: profile.bio.normalizedPosition,
  })) {
    const match = index.get(key);
    if (!match) continue;
    for (const model of Object.keys(match) as ProjectionBacktestBaselineModel[]) {
      if (!matches[model]) matches[model] = match[model];
    }
  }
  return matches;
}

function modelFromExistingProjectionRow(row: ProjectionBacktestExistingProjectionRow): ProjectionBacktestBaselineModel | null {
  if (row.source === "blackbird_calibrated_v2") return "blackbird_calibrated_v2";
  if (row.source === "blackbird_cohort_games_calibrated") return "blackbird_cohort_games_calibrated";
  if (row.source === "blackbird_cohort_ppg_calibrated") return "blackbird_cohort_ppg_calibrated";
  if (row.source === "blackbird_cohort_calibrated_v3") return "blackbird_cohort_calibrated_v3";
  if (row.source === "blackbird_expected_games_v4") return "blackbird_expected_games_v4";
  if (row.source === "blackbird_expected_games_v5_selective") return "blackbird_expected_games_v5_selective";
  if (row.source === "blackbird_expected_games_v6_gated") return "blackbird_expected_games_v6_gated";
  if (row.source === "blackbird_expected_games_v7_family_selective") return "blackbird_expected_games_v7_family_selective";
  if (row.source === "blackbird_expected_games_v8_cohort_blend") return "blackbird_expected_games_v8_cohort_blend";
  if (row.source === "blackbird_expected_games_v8_1_calibrated_gate") return "blackbird_expected_games_v8_1_calibrated_gate";
  if (row.source === "blackbird_expected_games_v8_2_high_impact_guardrail") return "blackbird_expected_games_v8_2_high_impact_guardrail";
  if (row.source === "blackbird_availability_calibrated") return "blackbird_availability_calibrated";
  if (row.source === "blackbird_no_prior_calibrated") return "blackbird_no_prior_calibrated";
  if (row.source === "blackbird_existing_projection_v1" || row.source === "blackbird_preseason_snapshot_v1") return "blackbird_existing_projection";
  return "blackbird_existing_projection";
}

function existingProjectionKeys(input: { sleeperId: string | null; gsisId: string | null; name: string; position: string }) {
  const keys: string[] = [];
  if (input.sleeperId) keys.push(`sleeper:${input.sleeperId}`);
  if (input.gsisId) keys.push(`gsis:${input.gsisId}`);
  keys.push(`namepos:${normalizeName(input.name)}:${input.position.toUpperCase()}`);
  return keys;
}

function availabilityMissType(predictedGames: number | null, actualGames: number): ProjectionBacktestAvailabilityMissType {
  if (predictedGames === null) return "no_games_projection";
  if (actualGames < 4) return "low_actual_games";
  const error = predictedGames - actualGames;
  if (Math.abs(error) <= 2) return "accurate_games";
  if (Math.abs(error) >= 6) return "major_availability_miss";
  return error > 0 ? "overestimated_availability" : "underestimated_availability";
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function unique(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
