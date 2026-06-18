import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalPlayerProfileSnapshot, PlayerProfileScoringMetadata } from "@/lib/player-profiles";
import {
  isV82ExpectedGamesEnabled,
  loadV82FeatureFlagReadinessRows,
  selectExpectedGamesModelForProjectionRow,
  type ExpectedGamesModelSelectionResult,
} from "@/lib/projections/feature-flags";

import { calibrateCohortProjection } from "./cohort-calibration";
import type { CohortCalibrationResult } from "./cohort-calibration-types";
import { projectExpectedGamesV4 } from "./expected-games-model";
import type { ExpectedGamesModelResult } from "./expected-games-model-types";
import type {
  PreseasonProjectionSnapshot,
  PreseasonProjectionCohort,
  PreseasonProjectionExpectedGamesSelectorOverride,
  PreseasonProjectionSnapshotOptions,
  PreseasonProjectionSnapshotRow,
  PreseasonProjectionUniverse,
  PreseasonProjectionVariant,
} from "./preseason-projection-snapshot-types";
import type { ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "TE", "K"];
const IDP_POSITIONS = ["DL", "LB", "DB"];
const RECENT_WEIGHTS = [0.5, 0.3, 0.2];
const NO_PRIOR_PPG: Record<string, number> = { QB: 6, RB: 3, WR: 3, TE: 2.5, K: 6, DL: 2.5, LB: 3.5, DB: 3 };
const NO_PRIOR_GAMES: Record<string, number> = { QB: 6, RB: 8, WR: 8, TE: 8, K: 12, DL: 8, LB: 8, DB: 8 };
const NO_SIGNAL_PPG: Record<string, number> = { QB: 1.5, RB: 0.8, WR: 0.8, TE: 0.6, K: 1, DL: 0.7, LB: 0.9, DB: 0.8 };
const NO_SIGNAL_GAMES: Record<string, number> = { QB: 2, RB: 3, WR: 3, TE: 3, K: 2, DL: 3, LB: 3, DB: 3 };
const VARIANTS: PreseasonProjectionVariant[] = [
  "blackbird_existing_projection_v1",
  "blackbird_availability_calibrated",
  "blackbird_no_prior_calibrated",
  "blackbird_calibrated_v2",
  "blackbird_cohort_games_calibrated",
  "blackbird_cohort_ppg_calibrated",
  "blackbird_cohort_calibrated_v3",
  "blackbird_expected_games_v4",
  "blackbird_expected_games_v5_selective",
  "blackbird_expected_games_v6_gated",
  "blackbird_expected_games_v7_family_selective",
  "blackbird_expected_games_v8_cohort_blend",
  "blackbird_expected_games_v8_1_calibrated_gate",
  "blackbird_expected_games_v8_2_high_impact_guardrail",
];

export function buildPreseasonProjectionSnapshot(input: {
  profiles: HistoricalPlayerProfileSnapshot[];
  scoringMetadata: PlayerProfileScoringMetadata;
  options: PreseasonProjectionSnapshotOptions;
  expectedGamesSelector?: PreseasonProjectionExpectedGamesSelectorOverride;
}): PreseasonProjectionSnapshot {
  const universe = input.options.universe ?? "fantasy-relevant";
  const selectorContext = buildExpectedGamesSelectorContext(input.options.targetSeason, input.expectedGamesSelector);
  const allowedPositions = new Set(input.options.includeIdp ? [...OFFENSIVE_POSITIONS, ...IDP_POSITIONS] : OFFENSIVE_POSITIONS);
  const rows: PreseasonProjectionSnapshotRow[] = [];
  let skipped = 0;
  let skippedNoSignal = 0;
  for (const profile of input.profiles) {
    const position = profile.bio.normalizedPosition;
    if (!allowedPositions.has(position)) {
      skipped += 1;
      continue;
    }
    const playerRows = buildSnapshotRows(profile, input.options.targetSeason, universe, selectorContext);
    if (!playerRows.length) {
      skipped += 1;
      skippedNoSignal += 1;
      continue;
    }
    rows.push(...playerRows);
  }

  const sortedRows = rows.sort((a, b) => a.position.localeCompare(b.position) || a.playerName.localeCompare(b.playerName) || (a.sleeperId ?? "").localeCompare(b.sleeperId ?? "") || a.variant.localeCompare(b.variant));
  const inputSeasons = unique(sortedRows.flatMap((row) => row.inputCoverage.priorSeasonsUsed));
  const warningsByType = countBy(sortedRows.flatMap((row) => row.warnings));
  const v2Rows = sortedRows.filter((row) => row.variant === "blackbird_calibrated_v2");
  const expectedGamesSelector = expectedGamesSelectorSummary(sortedRows, selectorContext);
  return {
    metadata: {
      artifactType: "blackbird_preseason_projection_snapshot",
      projectionSeason: input.options.targetSeason,
      targetSeason: input.options.targetSeason,
      inputSeasons,
      excludedSeasons: [input.options.targetSeason],
      leakageSafe: true,
      createdForBacktesting: true,
      modelVersion: "preseason_snapshot_v2",
      defaultUniverse: universe,
      scoringSource: input.scoringMetadata.scoringSource,
      scoringProfile: input.scoringMetadata.scoringProfileName,
      notes: [
        "Snapshot uses only player profile seasons strictly before targetSeason.",
        "No target-season weekly stats, snap outcomes, PBP outcomes, or projection artifacts are used.",
        "Model v2 adds dry-run availability, cohort, and no-prior calibration variants for backtesting only.",
      ],
    },
    rows: sortedRows,
    diagnostics: {
      playersConsidered: input.profiles.length,
      playersProjected: v2Rows.length,
      playersSkipped: skipped,
      playersSkippedNoSignal: skippedNoSignal,
      universe,
      variantCounts: countBy(sortedRows.map((row) => row.variant)),
      cohortCounts: countBy(v2Rows.flatMap((row) => row.cohortLabels)),
      noPriorTypeCounts: countBy(v2Rows.map((row) => row.inputCoverage.noPriorType)),
      noPriorCount: v2Rows.filter((row) => row.inputCoverage.noPriorNflData).length,
      idpCount: v2Rows.filter((row) => IDP_POSITIONS.includes(row.position)).length,
      averageProjectedGames: mean(v2Rows.map((row) => row.projectedGames)),
      averageProjectedPpgByPosition: averagePpgByPosition(v2Rows),
      confidenceDistribution: countBy(v2Rows.map((row) => row.confidence)),
      warningsByType,
      leakageSafety: {
        passed: true,
        targetSeasonExcludedFromInputs: sortedRows.every((row) => row.inputCoverage.priorSeasonsUsed.every((season) => season < input.options.targetSeason)),
        noPostTargetProjectionArtifactsUsed: true,
        notes: [
          `Target season ${input.options.targetSeason} is excluded from all numeric projection inputs.`,
          "Rows are produced from profile history only; no current 2026 projection outputs are read.",
        ],
      },
      expectedGamesSelector,
    },
  };
}

export function writePreseasonProjectionSnapshotArtifacts(snapshot: PreseasonProjectionSnapshot) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `preseason-projection-snapshot-${snapshot.metadata.targetSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(snapshot), "utf8");
  writeFileSync(csvPath, renderCsv(snapshot), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

type ExpectedGamesSelectorContext = {
  flagEnabled: boolean;
  readinessArtifactsAvailable: boolean;
  readinessRows: Map<string, ProjectionV82FeatureFlagReadinessRow> | null;
};

function buildExpectedGamesSelectorContext(targetSeason: number, override?: PreseasonProjectionExpectedGamesSelectorOverride): ExpectedGamesSelectorContext {
  const flagEnabled = override?.flagEnabled ?? isV82ExpectedGamesEnabled();
  if (!flagEnabled) {
    return {
      flagEnabled,
      readinessArtifactsAvailable: override?.readinessArtifactsAvailable ?? true,
      readinessRows: override?.readinessRows ?? null,
    };
  }

  const readinessRows = override?.readinessRows ?? loadV82FeatureFlagReadinessRows({ projectionSeason: targetSeason });
  return {
    flagEnabled,
    readinessArtifactsAvailable: override?.readinessArtifactsAvailable ?? readinessRows !== null,
    readinessRows,
  };
}

function buildSnapshotRows(profile: HistoricalPlayerProfileSnapshot, targetSeason: number, universe: PreseasonProjectionUniverse, selectorContext: ExpectedGamesSelectorContext): PreseasonProjectionSnapshotRow[] {
  const priorSummaries = profile.seasonSummaries
    .filter((summary) => typeof summary.season === "number" && summary.season < targetSeason)
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
  const priorUsage = profile.seasonUsageSummaries
    ?.filter((summary) => typeof summary.season === "number" && summary.season < targetSeason)
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0] ?? null;
  const priorHighValue = profile.seasonHighValueUsageSummaries
    ?.filter((summary) => typeof summary.season === "number" && summary.season < targetSeason)
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0] ?? null;
  const noPrior = priorSummaries.length === 0;
  const position = profile.bio.normalizedPosition;
  const noPriorType = classifyNoPriorType(profile, priorUsage, noPrior);
  if (!isInUniverse(universe, profile, priorSummaries, priorUsage, noPriorType)) return [];
  const weightedPpg = weightedAverage(priorSummaries.slice(0, 3).map((summary) => summary.pointsPerGame), RECENT_WEIGHTS);
  const careerGames = priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  const careerPoints = priorSummaries.reduce((sum, summary) => sum + summary.totalFantasyPoints, 0);
  const careerPpg = careerGames ? careerPoints / careerGames : null;
  const basePpg = weightedPpg ?? careerPpg ?? NO_PRIOR_PPG[position] ?? 2;
  const adjustedPpgV1 = round1(basePpg * (1 + cappedAdjustment(profile, priorSummaries[0] ?? null, priorUsage, priorHighValue, noPrior)));
  const v1Games = expectedGames(position, priorSummaries, noPrior);
  const calibratedGames = calibratedExpectedGames(profile, priorSummaries, priorUsage, noPrior, noPriorType);
  const cohortCalibration = calibrateCohortProjection({
    profile,
    priorSummaries,
    priorUsage,
    priorHighValue,
    noPrior,
    noPriorType,
    basePpg,
    v1Ppg: adjustedPpgV1,
    v1Games,
  });
  const expectedGamesV4 = projectExpectedGamesV4({
    profile,
    targetSeason,
    priorSummaries,
    priorUsage,
    noPrior,
    noPriorType,
    previousProjectedGames: v1Games,
    projectedPpgAnchor: basePpg,
  });
  const confidence = confidenceLabel(priorSummaries.length, profile.identity.matchConfidence, noPrior, profile.profileWarnings);
  const warnings = warningsFor(profile, noPrior, priorSummaries, priorUsage, priorHighValue, noPriorType);
  const cohortLabels = cohortsFor(profile, priorSummaries, noPrior);
  const availabilityDiagnostics = expectedGamesDiagnostics(profile, v1Games, calibratedGames, priorSummaries, priorUsage, noPrior, noPriorType, cohortCalibration, expectedGamesV4);
  const selectorPlayerId = selectorPlayerIdForProfile(profile, position);
  return VARIANTS.map((variant) => {
    const projectedPpg = projectedPpgForVariant(variant, adjustedPpgV1, basePpg, profile, priorSummaries[0] ?? null, priorUsage, priorHighValue, noPrior, noPriorType, cohortCalibration.ppg);
    const selector = expectedGamesSelectorForVariant(variant, selectorPlayerId, position, selectorContext);
    const projectedGames = selectedGamesForVariant(variant, selector, v1Games, calibratedGames, cohortCalibration.expectedGames, expectedGamesV4.v4ProjectedGames, expectedGamesV4.v5ProjectedGames, expectedGamesV4.v6ProjectedGames, expectedGamesV4.v7ProjectedGames, expectedGamesV4.v8ProjectedGames, expectedGamesV4.v81ProjectedGames, expectedGamesV4.v82ProjectedGames);
    const projectedTotalPoints = round1(projectedPpg * projectedGames);
    const expectedGamesDiagnosticsWithSelection = addExpectedGamesSelectorDiagnostics(
      availabilityDiagnostics,
      selector,
      selectorPlayerId,
      selectorContext,
      selector?.selection === "v8_2_candidate_path" ? selectorContext.readinessRows?.get(selectorPlayerId) ?? null : selectorContext.readinessRows?.get(selectorPlayerId) ?? null,
    );
    return {
    sleeperId: profile.identity.sleeperId,
    gsisId: profile.identity.gsisId,
    playerName: profile.bio.name,
    normalizedName: normalizeName(profile.bio.name),
    position,
    team: profile.bio.team,
    matchConfidence: profile.identity.matchConfidence,
    projectedGames,
    projectedPpg,
    projectedTotalPoints,
    floorPoints: round1(projectedTotalPoints * 0.8),
    medianPoints: projectedTotalPoints,
    ceilingPoints: round1(projectedTotalPoints * 1.2),
    confidence,
    confidenceScore: confidenceScore(confidence),
    variant,
    source: variant,
    projectionSource: variant,
    projectionRunId: null,
    projectionReasons: reasonsFor(variant, noPrior, priorSummaries.length, priorUsage, priorHighValue, projectedGames, v1Games, cohortCalibration),
    warnings,
    cohortLabels,
    universe,
    inputCoverage: {
      priorSeasonsUsed: priorSummaries.map((summary) => summary.season).filter((season): season is number => typeof season === "number"),
      priorGames: careerGames,
      priorPpg: priorSummaries[0]?.pointsPerGame ?? null,
      careerToDatePpg: careerPpg === null ? null : round1(careerPpg),
      roleLabel: roleLabel(position, priorUsage),
      availabilitySignal: priorSummaries[0]?.availabilityScore ?? null,
      snapShare: priorUsage?.offensiveSnapShare ?? priorUsage?.defensiveSnapShare ?? null,
      usageTrend: priorUsage?.trendLabel ?? "insufficient_data",
      highValueUsageFlags: priorHighValue?.modifiers ?? [],
      noPriorNflData: noPrior,
      noPriorType,
    },
    expectedGamesDiagnostics: expectedGamesDiagnosticsWithSelection,
  };
  });
}

function cappedAdjustment(
  profile: HistoricalPlayerProfileSnapshot,
  prior: HistoricalPlayerProfileSnapshot["seasonSummaries"][number] | null,
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  highValue: NonNullable<HistoricalPlayerProfileSnapshot["seasonHighValueUsageSummaries"]>[number] | null,
  noPrior: boolean
) {
  let adjustment = 0;
  adjustment += clamp(((prior?.consistencyScore ?? 60) - 60) * 0.0008, -0.03, 0.03);
  adjustment += clamp(((prior?.availabilityScore ?? 75) - 75) * 0.0008, -0.04, 0.03);
  adjustment += clamp(((prior?.spikeScore ?? 55) - 55) * 0.0004, -0.02, 0.025);
  const snap = usage?.offensiveSnapShare ?? usage?.defensiveSnapShare ?? null;
  if (snap !== null && snap >= 0.7) adjustment += 0.02;
  if (snap !== null && snap < 0.4) adjustment -= 0.03;
  if (highValue?.modifiers?.some((flag) => ["goal_line_role", "red_zone_role", "end_zone_target_role", "high_value_touch_role"].includes(flag))) adjustment += 0.015;
  if (["DL"].includes(profile.bio.normalizedPosition) && (usage?.sackDependencyScore ?? 0) >= 70) adjustment -= 0.025;
  if (["LB", "DB"].includes(profile.bio.normalizedPosition) && (usage?.tackleFloorScore ?? 0) >= 70) adjustment += 0.015;
  if (noPrior) adjustment -= 0.08;
  if (profile.profileWarnings.some((warning) => warning.includes("weak_identity") || warning.includes("duplicate"))) adjustment -= 0.04;
  return clamp(adjustment, -0.12, 0.1);
}

function expectedGames(position: string, summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"], noPrior: boolean) {
  if (noPrior) return NO_PRIOR_GAMES[position] ?? 8;
  const recent = weightedAverage(summaries.slice(0, 3).map((summary) => summary.gamesPlayed), RECENT_WEIGHTS);
  const career = summaries.length ? summaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0) / summaries.length : null;
  const blended = recent !== null && career !== null ? recent * 0.7 + career * 0.3 : recent ?? career ?? 10;
  return Math.max(1, Math.min(17, Math.round(blended)));
}

function calibratedExpectedGames(
  profile: HistoricalPlayerProfileSnapshot,
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  noPrior: boolean,
  noPriorType: string
) {
  const position = profile.bio.normalizedPosition;
  if (noPrior) {
    if (noPriorType === "rookie_with_rookie_source_data") return position === "QB" ? 8 : position === "K" ? 10 : 7;
    if (noPriorType === "roster_or_snap_evidence_no_prior_stats") return position === "K" ? 10 : 6;
    if (noPriorType === "idp_no_prior_player") return 5;
    return NO_SIGNAL_GAMES[position] ?? 3;
  }
  const recent = weightedAverage(summaries.slice(0, 3).map((summary) => summary.gamesPlayed), RECENT_WEIGHTS);
  const career = summaries.length ? summaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0) / summaries.length : null;
  let games = recent !== null && career !== null ? recent * 0.62 + career * 0.38 : recent ?? career ?? 8;
  const snap = usage?.offensiveSnapShare ?? usage?.defensiveSnapShare ?? null;
  if (position === "QB" && snap !== null && snap >= 0.7 && (summaries[0]?.gamesPlayed ?? 0) >= 12) games += 1.4;
  if (position === "RB") games -= 0.8;
  if (["WR", "TE"].includes(position) && snap !== null && snap >= 0.7) games += 0.6;
  if (["WR", "TE"].includes(position) && snap !== null && snap < 0.45) games -= 1.2;
  if (["DL", "LB", "DB"].includes(position) && snap !== null && snap >= 0.65) games += 0.8;
  if (["DL", "LB", "DB"].includes(position) && snap !== null && snap < 0.4) games -= 1.4;
  if (position === "K") games = Math.min(16, games + 0.4);
  if (summaries.length === 1) games = games * 0.82 + (position === "K" ? 9 : 7) * 0.18;
  if ((profile.bio.age ?? 0) >= 31 && ["RB", "WR", "TE", "DL", "LB", "DB"].includes(position)) games -= 0.5;
  return Math.max(1, Math.min(17, Math.round(games)));
}

function projectedPpgForVariant(
  variant: PreseasonProjectionVariant,
  adjustedPpgV1: number,
  basePpg: number,
  profile: HistoricalPlayerProfileSnapshot,
  prior: HistoricalPlayerProfileSnapshot["seasonSummaries"][number] | null,
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  highValue: NonNullable<HistoricalPlayerProfileSnapshot["seasonHighValueUsageSummaries"]>[number] | null,
  noPrior: boolean,
  noPriorType: string,
  cohortPpg: number
) {
  if (variant === "blackbird_expected_games_v4" || variant === "blackbird_expected_games_v5_selective" || variant === "blackbird_expected_games_v6_gated" || variant === "blackbird_expected_games_v7_family_selective" || variant === "blackbird_expected_games_v8_cohort_blend" || variant === "blackbird_expected_games_v8_1_calibrated_gate" || variant === "blackbird_expected_games_v8_2_high_impact_guardrail") return round1(basePpg);
  if (variant === "blackbird_cohort_ppg_calibrated" || variant === "blackbird_cohort_calibrated_v3") return cohortPpg;
  if (variant === "blackbird_cohort_games_calibrated") return adjustedPpgV1;
  if (variant === "blackbird_existing_projection_v1" || variant === "blackbird_availability_calibrated") return adjustedPpgV1;
  let ppg = noPrior ? noPriorPpg(profile.bio.normalizedPosition, noPriorType) * (1 + cappedAdjustment(profile, prior, usage, highValue, noPrior)) : adjustedPpgV1;
  if (variant === "blackbird_calibrated_v2") {
    const snap = usage?.offensiveSnapShare ?? usage?.defensiveSnapShare ?? null;
    if (noPriorType === "unsupported_no_signal") ppg *= 0.45;
    if (noPrior && snap !== null && snap < 0.35) ppg *= 0.9;
    if (noPrior && ["LB", "DB"].includes(profile.bio.normalizedPosition) && (usage?.tackleFloorScore ?? 0) >= 70) ppg *= 1.03;
  }
  return round1(ppg);
}

function gamesForVariant(variant: PreseasonProjectionVariant, v1Games: number, v2Games: number, cohortGames: number, v4Games: number, v5Games: number, v6Games: number, v7Games: number, v8Games: number, v81Games: number, v82Games: number) {
  if (variant === "blackbird_expected_games_v4") return v4Games;
  if (variant === "blackbird_expected_games_v5_selective") return v5Games;
  if (variant === "blackbird_expected_games_v6_gated") return v6Games;
  if (variant === "blackbird_expected_games_v7_family_selective") return v7Games;
  if (variant === "blackbird_expected_games_v8_cohort_blend") return v8Games;
  if (variant === "blackbird_expected_games_v8_1_calibrated_gate") return v81Games;
  if (variant === "blackbird_expected_games_v8_2_high_impact_guardrail") return v82Games;
  if (variant === "blackbird_existing_projection_v1" || variant === "blackbird_no_prior_calibrated" || variant === "blackbird_cohort_ppg_calibrated") return v1Games;
  if (variant === "blackbird_cohort_games_calibrated" || variant === "blackbird_cohort_calibrated_v3") return cohortGames;
  return v2Games;
}

function selectedGamesForVariant(
  variant: PreseasonProjectionVariant,
  selector: ExpectedGamesModelSelectionResult | null,
  v1Games: number,
  v2Games: number,
  cohortGames: number,
  v4Games: number,
  v5Games: number,
  v6Games: number,
  v7Games: number,
  v8Games: number,
  v81Games: number,
  v82Games: number
) {
  if (variant === "blackbird_expected_games_v7_family_selective" && selector?.selection === "v8_2_candidate_path") return v82Games;
  return gamesForVariant(variant, v1Games, v2Games, cohortGames, v4Games, v5Games, v6Games, v7Games, v8Games, v81Games, v82Games);
}

function expectedGamesSelectorForVariant(
  variant: PreseasonProjectionVariant,
  playerId: string,
  position: string,
  selectorContext: ExpectedGamesSelectorContext
): ExpectedGamesModelSelectionResult | null {
  if (variant !== "blackbird_expected_games_v7_family_selective") return null;
  const readinessRow = selectorContext.readinessRows?.get(playerId) ?? null;
  return selectExpectedGamesModelForProjectionRow({
    playerId,
    position,
    readinessRow,
    readinessArtifactsAvailable: selectorContext.readinessArtifactsAvailable,
    flagEnabled: selectorContext.flagEnabled,
  });
}

function addExpectedGamesSelectorDiagnostics(
  diagnostics: PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"],
  selector: ExpectedGamesModelSelectionResult | null,
  playerId: string,
  selectorContext: ExpectedGamesSelectorContext,
  readinessRow: ProjectionV82FeatureFlagReadinessRow | null
): PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"] {
  if (!selector) {
    return diagnostics;
  }

  return {
    ...diagnostics,
    expectedGamesModelSelected: selector.model,
    expectedGamesSelectionReason: selector.reason,
    expectedGamesSelectionProtectedReason: selector.selection === "v8_2_candidate_path" ? null : selector.reason,
    expectedGamesSelectionFlagEnabled: selector.flagEnabled,
    expectedGamesReadinessArtifactsAvailable: selectorContext.readinessArtifactsAvailable,
    expectedGamesReadinessStatus: readinessRow?.status ?? null,
    expectedGamesSelectorPlayerId: playerId,
  };
}

function expectedGamesSelectorSummary(
  rows: PreseasonProjectionSnapshotRow[],
  selectorContext: ExpectedGamesSelectorContext
): PreseasonProjectionSnapshot["diagnostics"]["expectedGamesSelector"] {
  const selectorRows = rows.filter((row) => row.variant === "blackbird_expected_games_v7_family_selective");
  const selectedV82Rows = selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesModelSelected === "blackbird_expected_games_v8_2_high_impact_guardrail");
  const currentPathRows = selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesModelSelected === "current").length;
  const blockedOrExcludedRows = selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesModelSelected === null && row.expectedGamesDiagnostics.expectedGamesSelectionReason !== undefined && row.expectedGamesDiagnostics.expectedGamesSelectionReason !== null).length;
  return {
    flagEnabled: selectorContext.flagEnabled,
    readinessArtifactsAvailable: selectorContext.readinessArtifactsAvailable,
    totalSelectorRows: selectorRows.length,
    selectedV82Rows: selectedV82Rows.length,
    currentPathRows,
    blockedOrExcludedRows,
    missingReadinessRows: selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesSelectionReason === "readiness_row_missing").length,
    missingArtifactRows: selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesSelectionReason === "missing_safety_artifacts").length,
    protectedRows: selectorRows.filter((row) => isProtectedSelectorReason(row.expectedGamesDiagnostics.expectedGamesSelectionProtectedReason)).length,
    kRowsUsingV82: selectedV82Rows.filter((row) => row.position === "K").length,
    criticalMovementRowsUsingV82: selectedV82Rows.filter((row) => selectorContext.readinessRows?.get(row.expectedGamesDiagnostics.expectedGamesSelectorPlayerId ?? "")?.criticalMovement).length,
    meaningfulRankMoversUsingV82: selectedV82Rows.filter((row) => selectorContext.readinessRows?.get(row.expectedGamesDiagnostics.expectedGamesSelectorPlayerId ?? "")?.meaningfulRankMover).length,
    legacyRowsUsingV82: selectedV82Rows.filter((row) => {
      const readinessRow = selectorContext.readinessRows?.get(row.expectedGamesDiagnostics.expectedGamesSelectorPlayerId ?? "");
      return readinessRow?.universeEligibilityStatus === "retired_or_legacy_suspect" || readinessRow?.universeEligibilityStatus === "stale_historical_signal";
    }).length,
  };
}

function isProtectedSelectorReason(reason: PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"]["expectedGamesSelectionProtectedReason"]) {
  return reason === "current_path_protected"
    || reason === "kicker_policy_protected"
    || reason === "critical_movement_protected"
    || reason === "meaningful_rank_movement_protected"
    || reason === "legacy_or_stale_blocked"
    || reason === "excluded_or_blocked";
}

function noPriorPpg(position: string, noPriorType: string) {
  if (noPriorType === "unsupported_no_signal" || noPriorType === "depth_or_fringe_no_prior_player") return NO_SIGNAL_PPG[position] ?? 0.8;
  if (noPriorType === "rookie_with_rookie_source_data") return (NO_PRIOR_PPG[position] ?? 2) * 0.9;
  if (noPriorType === "roster_or_snap_evidence_no_prior_stats") return (NO_PRIOR_PPG[position] ?? 2) * 0.7;
  if (noPriorType === "idp_no_prior_player") return (NO_PRIOR_PPG[position] ?? 2) * 0.65;
  return NO_PRIOR_PPG[position] ?? 2;
}

function classifyNoPriorType(
  profile: HistoricalPlayerProfileSnapshot,
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  noPrior: boolean
) {
  if (!noPrior) return "has_prior_nfl_data";
  const position = profile.bio.normalizedPosition;
  const snap = usage?.offensiveSnapShare ?? usage?.defensiveSnapShare ?? null;
  const hasRoleEvidence = snap !== null && snap >= 0.25 || (usage?.gamesWithUsage ?? 0) > 0;
  if ((profile.bio.yearsExperience ?? 99) === 0 || profile.bio.rookieSeason === profile.careerMetadata?.latestStatSeason) return "rookie_with_rookie_source_data";
  if (["DL", "LB", "DB"].includes(position)) return hasRoleEvidence ? "idp_no_prior_player" : "unsupported_no_signal";
  if (hasRoleEvidence) return "roster_or_snap_evidence_no_prior_stats";
  if (profile.bio.active || profile.bio.status?.toLowerCase() === "active") return "depth_or_fringe_no_prior_player";
  return "unsupported_no_signal";
}

function isInUniverse(
  universe: PreseasonProjectionUniverse,
  profile: HistoricalPlayerProfileSnapshot,
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  noPriorType: string
) {
  if (universe === "all") return true;
  if (summaries.length > 0) return true;
  if (noPriorType === "unsupported_no_signal") return false;
  const snap = usage?.offensiveSnapShare ?? usage?.defensiveSnapShare ?? null;
  if (snap !== null && snap >= 0.25) return true;
  if (profile.bio.active && ["rookie_with_rookie_source_data", "roster_or_snap_evidence_no_prior_stats", "idp_no_prior_player"].includes(noPriorType)) return true;
  return universe === "evaluated-backtest" ? false : noPriorType !== "unsupported_no_signal";
}

function cohortsFor(profile: HistoricalPlayerProfileSnapshot, summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"], noPrior: boolean): PreseasonProjectionCohort[] {
  const position = profile.bio.normalizedPosition;
  const cohorts = new Set<PreseasonProjectionCohort>();
  if (summaries.length >= 3) cohorts.add("veteran_3plus_prior_seasons");
  if (summaries.length === 2) cohorts.add("two_prior_seasons");
  if (summaries.length === 1) cohorts.add("one_prior_season");
  if (noPrior || (profile.bio.yearsExperience ?? 99) === 0) cohorts.add("rookie_or_no_prior_nfl_data");
  if (summaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0) < 8) cohorts.add("low_prior_sample");
  if (position === "DL") cohorts.add("idp_dl");
  if (position === "LB") cohorts.add("idp_lb");
  if (position === "DB") cohorts.add("idp_db");
  if (position === "QB") cohorts.add("offense_qb");
  if (position === "RB") cohorts.add("offense_rb");
  if (position === "WR") cohorts.add("offense_wr");
  if (position === "TE") cohorts.add("offense_te");
  if (position === "K") cohorts.add("kicker");
  return [...cohorts].sort();
}

function expectedGamesDiagnostics(
  profile: HistoricalPlayerProfileSnapshot,
  projectedGamesV1: number,
  calibratedProjectedGames: number,
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  noPrior: boolean,
  noPriorType: string,
  cohortCalibration: CohortCalibrationResult,
  expectedGamesV4: ExpectedGamesModelResult | null
): PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"] {
  const snap = usage?.offensiveSnapShare ?? usage?.defensiveSnapShare ?? null;
  const availabilityCohort = noPrior ? noPriorType : summaries.length === 1 ? "one_year_availability_sample" : snap !== null && snap >= 0.65 ? "stable_role_availability" : "standard_recent_availability";
  const availabilityConfidence = noPrior ? "very_low" : summaries.length === 1 ? "low" : snap !== null && snap >= 0.65 ? "high" : "medium";
  const delta = calibratedProjectedGames - projectedGamesV1;
  const gamesCalibrationReason = delta === 0
    ? "Calibrated games matched v1 after position, sample, age, and role checks."
    : delta > 0
      ? "Calibrated games increased due to stronger pre-target role/availability signals."
      : "Calibrated games decreased due to no-prior, low-sample, age, or weak role signals.";
  return {
    projectedGamesV1,
    calibratedProjectedGames,
    gamesCalibrationReason,
    availabilityCohort,
    availabilityConfidence,
    calibrationCohort: cohortCalibration.cohort,
    cohortReason: cohortCalibration.cohortReason,
    expectedGamesRule: cohortCalibration.expectedGamesRule,
    ppgAdjustmentRule: cohortCalibration.ppgAdjustmentRule,
    confidenceRule: cohortCalibration.confidenceRule,
    noPriorRule: cohortCalibration.noPriorRule,
    expectedGamesModel: expectedGamesV4?.expectedGamesModel ?? null,
    expectedGamesRuleV4: expectedGamesV4?.expectedGamesRule ?? null,
    expectedGamesInputs: expectedGamesV4?.expectedGamesInputs ?? null,
    expectedGamesConfidence: expectedGamesV4?.expectedGamesConfidence ?? null,
    expectedGamesWarnings: expectedGamesV4?.expectedGamesWarnings ?? [],
    previousProjectedGames: expectedGamesV4?.previousProjectedGames ?? null,
    v4ProjectedGames: expectedGamesV4?.v4ProjectedGames ?? null,
    v5ProjectedGames: expectedGamesV4?.v5ProjectedGames ?? null,
    v6ProjectedGames: expectedGamesV4?.v6ProjectedGames ?? null,
    v7ProjectedGames: expectedGamesV4?.v7ProjectedGames ?? null,
    v8ProjectedGames: expectedGamesV4?.v8ProjectedGames ?? null,
    v81ProjectedGames: expectedGamesV4?.v81ProjectedGames ?? null,
    v82ProjectedGames: expectedGamesV4?.v82ProjectedGames ?? null,
    weightedRecentGames: expectedGamesV4?.weightedRecentGames ?? null,
    careerRecentGames: expectedGamesV4?.careerRecentGames ?? null,
    selectedExpectedGamesMethod: expectedGamesV4?.selectedExpectedGamesMethod ?? null,
    selectedExpectedGamesReason: expectedGamesV4?.selectedExpectedGamesReason ?? null,
    fallbackReason: expectedGamesV4?.fallbackReason ?? null,
    v6SelectedExpectedGamesMethod: expectedGamesV4?.v6SelectedExpectedGamesMethod ?? null,
    v6GateReason: expectedGamesV4?.v6GateReason ?? null,
    v6PositionFamilyGateStatus: expectedGamesV4?.v6PositionFamilyGateStatus ?? null,
    v6ExpectedGamesConfidence: expectedGamesV4?.v6ExpectedGamesConfidence ?? null,
    v6SelectedExpectedGamesReason: expectedGamesV4?.v6SelectedExpectedGamesReason ?? null,
    v6FallbackReason: expectedGamesV4?.v6FallbackReason ?? null,
    v7SelectedExpectedGamesMethod: expectedGamesV4?.v7SelectedExpectedGamesMethod ?? null,
    v7GateReason: expectedGamesV4?.v7GateReason ?? null,
    v7PositionFamilyGateStatus: expectedGamesV4?.v7PositionFamilyGateStatus ?? null,
    v7ExpectedGamesConfidence: expectedGamesV4?.v7ExpectedGamesConfidence ?? null,
    v7SelectedExpectedGamesReason: expectedGamesV4?.v7SelectedExpectedGamesReason ?? null,
    v7FallbackReason: expectedGamesV4?.v7FallbackReason ?? null,
    v8SelectedExpectedGamesMethod: expectedGamesV4?.v8SelectedExpectedGamesMethod ?? null,
    v8Cohort: expectedGamesV4?.v8Cohort ?? null,
    v8BaselineExpectedGames: expectedGamesV4?.v8BaselineExpectedGames ?? null,
    v8Adjustment: expectedGamesV4?.v8Adjustment ?? null,
    v8AdjustmentReason: expectedGamesV4?.v8AdjustmentReason ?? null,
    v8BaselineSource: expectedGamesV4?.v8BaselineSource ?? null,
    v8ExpectedGamesConfidence: expectedGamesV4?.v8ExpectedGamesConfidence ?? null,
    v8SelectedExpectedGamesReason: expectedGamesV4?.v8SelectedExpectedGamesReason ?? null,
    v8FallbackReason: expectedGamesV4?.v8FallbackReason ?? null,
    v81BaseModelUsed: expectedGamesV4?.v81BaseModelUsed ?? null,
    v81ProjectedGamesRawV8: expectedGamesV4?.v81ProjectedGamesRawV8 ?? null,
    v81ProjectedGamesV7: expectedGamesV4?.v81ProjectedGamesV7 ?? null,
    v81RawDeltaFromV7: expectedGamesV4?.v81RawDeltaFromV7 ?? null,
    v81CalibratedDeltaFromV7: expectedGamesV4?.v81CalibratedDeltaFromV7 ?? null,
    v81DampeningFactor: expectedGamesV4?.v81DampeningFactor ?? null,
    v81GatesApplied: expectedGamesV4?.v81GatesApplied ?? [],
    v81Cohort: expectedGamesV4?.v81Cohort ?? null,
    v81Position: expectedGamesV4?.v81Position ?? null,
    v81PpgBucket: expectedGamesV4?.v81PpgBucket ?? null,
    v81AdjustmentBucket: expectedGamesV4?.v81AdjustmentBucket ?? null,
    v81ReasonCodes: expectedGamesV4?.v81ReasonCodes ?? [],
    v81SelectedExpectedGamesReason: expectedGamesV4?.v81SelectedExpectedGamesReason ?? null,
    v82BaseModelUsed: expectedGamesV4?.v82BaseModelUsed ?? null,
    v82ProjectedGamesV7: expectedGamesV4?.v82ProjectedGamesV7 ?? null,
    v82ProjectedGamesV8: expectedGamesV4?.v82ProjectedGamesV8 ?? null,
    v82ProjectedGamesV81: expectedGamesV4?.v82ProjectedGamesV81 ?? null,
    v82DeltaFromV7: expectedGamesV4?.v82DeltaFromV7 ?? null,
    v82DeltaFromV81: expectedGamesV4?.v82DeltaFromV81 ?? null,
    v82GuardrailApplied: expectedGamesV4?.v82GuardrailApplied ?? null,
    v82GuardrailReasonCodes: expectedGamesV4?.v82GuardrailReasonCodes ?? [],
    v82PpgBucket: expectedGamesV4?.v82PpgBucket ?? null,
    v82AdjustmentBucket: expectedGamesV4?.v82AdjustmentBucket ?? null,
    v82SelectedExpectedGamesReason: expectedGamesV4?.v82SelectedExpectedGamesReason ?? null,
    qbStarterProbabilityBucket: expectedGamesV4?.qbStarterProbabilityBucket ?? null,
    qbStarterSignalReason: expectedGamesV4?.qbStarterSignalReason ?? null,
    qbExpectedGamesCap: expectedGamesV4?.qbExpectedGamesCap ?? null,
    qbFallbackReason: expectedGamesV4?.qbFallbackReason ?? null,
  };
}

function confidenceLabel(priorSeasonCount: number, matchConfidence: string, noPrior: boolean, warnings: string[]): PreseasonProjectionSnapshotRow["confidence"] {
  if (noPrior || !["exact_id", "strong"].includes(matchConfidence) || warnings.some((warning) => warning.includes("weak_identity"))) return "very_low";
  if (priorSeasonCount === 1) return "low";
  if (priorSeasonCount === 2) return "medium";
  return "high";
}

function warningsFor(
  profile: HistoricalPlayerProfileSnapshot,
  noPrior: boolean,
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"],
  usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null,
  highValue: NonNullable<HistoricalPlayerProfileSnapshot["seasonHighValueUsageSummaries"]>[number] | null,
  noPriorType: string
) {
  const warnings = new Set<string>();
  if (noPrior) warnings.add("no_prior_nfl_data");
  if (noPriorType !== "has_prior_nfl_data") warnings.add(`no_prior_type:${noPriorType}`);
  if (noPriorType === "unsupported_no_signal") warnings.add("unsupported_no_signal_player");
  if (noPriorType === "depth_or_fringe_no_prior_player") warnings.add("depth_or_fringe_no_prior_player");
  if (summaries.length === 1) warnings.add("single_prior_season");
  if (!usage) warnings.add("usage_context_unavailable");
  if (!highValue || highValue.sourceStatus !== "available") warnings.add("high_value_usage_unavailable");
  if (!["exact_id", "strong"].includes(profile.identity.matchConfidence)) warnings.add("identity_confidence_not_strong");
  for (const warning of profile.profileWarnings) warnings.add(warning);
  return [...warnings].sort();
}

function reasonsFor(
  variant: PreseasonProjectionVariant,
  noPrior: boolean,
  priorSeasonCount: number,
  usage: unknown,
  highValue: { modifiers?: string[] } | null,
  projectedGames: number,
  v1Games: number,
  cohortCalibration: CohortCalibrationResult
) {
  const reasons = ["Base projection uses weighted recent PPG from seasons before the target season."];
  reasons.push(variant === "blackbird_existing_projection_v1"
    ? "Expected games use v1 weighted recent games and career recent games."
    : variant.startsWith("blackbird_cohort")
      ? `${cohortCalibration.expectedGamesRule} (${v1Games} to ${projectedGames}).`
      : `Expected games were calibrated from v1 ${v1Games} to ${projectedGames} using pre-target role, sample, age, and position signals.`);
  if (variant === "blackbird_cohort_ppg_calibrated" || variant === "blackbird_cohort_calibrated_v3") reasons.push(cohortCalibration.ppgAdjustmentRule);
  if (variant === "blackbird_no_prior_calibrated" || variant === "blackbird_calibrated_v2" || variant === "blackbird_cohort_calibrated_v3") reasons.push("No-prior players use split priors for rookies, roster evidence, IDP, depth/fringe, and no-signal cases.");
  if (variant.startsWith("blackbird_cohort")) reasons.push(cohortCalibration.cohortReason);
  if (noPrior) reasons.push("No prior NFL production was available; conservative position prior was used.");
  else reasons.push(`${priorSeasonCount} prior NFL season(s) were available before target season.`);
  if (usage) reasons.push("Prior-season usage/snap context was available.");
  if (highValue?.modifiers?.length) reasons.push(`Pre-target high-value usage signals: ${highValue.modifiers.join(", ")}.`);
  return reasons;
}

function roleLabel(position: string, usage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null) {
  if (!usage) return "insufficient_data";
  if (["DL", "LB", "DB"].includes(position)) {
    if ((usage.tackleFloorScore ?? 0) >= 70) return "tackle_floor";
    if ((usage.sackDependencyScore ?? 0) >= 60) return "sack_upside";
    if ((usage.bigPlayDependencyScore ?? 0) >= 60) return "big_play_dependent";
    return "balanced";
  }
  if (position === "QB") return (usage.carriesPerGame ?? 0) >= 5 ? "rushing_qb" : "pocket_qb";
  if (position === "RB") return (usage.touchesPerGame ?? 0) >= 18 ? "workhorse" : (usage.targetsPerGame ?? 0) >= 4 ? "receiving_back" : "committee_back";
  if (position === "WR" || position === "TE") return (usage.targetsPerGame ?? 0) >= 8 ? "alpha_receiver" : (usage.targetsPerGame ?? 0) >= 5 ? "volume_receiver" : "low_usage";
  return "low_usage";
}

function renderMarkdown(snapshot: PreseasonProjectionSnapshot) {
  return `# Preseason Projection Snapshot ${snapshot.metadata.targetSeason}

Dry run: true
Artifact type: ${snapshot.metadata.artifactType}
Model version: ${snapshot.metadata.modelVersion}
Default universe: ${snapshot.metadata.defaultUniverse}
Projection season: ${snapshot.metadata.projectionSeason}
Input seasons: ${snapshot.metadata.inputSeasons.join(", ") || "none"}
Excluded seasons: ${snapshot.metadata.excludedSeasons.join(", ")}
Leakage safe: ${snapshot.metadata.leakageSafe}
Scoring source: ${snapshot.metadata.scoringSource}
Scoring profile: ${snapshot.metadata.scoringProfile}

## Diagnostics

- Players considered: ${snapshot.diagnostics.playersConsidered}
- Players projected: ${snapshot.diagnostics.playersProjected}
- Players skipped: ${snapshot.diagnostics.playersSkipped}
- Players skipped no-signal: ${snapshot.diagnostics.playersSkippedNoSignal}
- Universe: ${snapshot.diagnostics.universe}
- No-prior count: ${snapshot.diagnostics.noPriorCount}
- IDP count: ${snapshot.diagnostics.idpCount}
- Average projected games: ${snapshot.diagnostics.averageProjectedGames ?? "n/a"}

## Expected Games Selector

\`\`\`json
${JSON.stringify(snapshot.diagnostics.expectedGamesSelector ?? null, null, 2)}
\`\`\`

## Variant Counts

\`\`\`json
${JSON.stringify(snapshot.diagnostics.variantCounts, null, 2)}
\`\`\`

## Cohort Counts

\`\`\`json
${JSON.stringify(snapshot.diagnostics.cohortCounts, null, 2)}
\`\`\`

## No-Prior Type Counts

\`\`\`json
${JSON.stringify(snapshot.diagnostics.noPriorTypeCounts, null, 2)}
\`\`\`

## Average Projected PPG By Position

\`\`\`json
${JSON.stringify(snapshot.diagnostics.averageProjectedPpgByPosition, null, 2)}
\`\`\`

## Confidence Distribution

\`\`\`json
${JSON.stringify(snapshot.diagnostics.confidenceDistribution, null, 2)}
\`\`\`

## Warnings By Type

\`\`\`json
${JSON.stringify(snapshot.diagnostics.warningsByType, null, 2).slice(0, 8000)}
\`\`\`

## Leakage Safety

- Passed: ${snapshot.diagnostics.leakageSafety.passed}
- Target season excluded from inputs: ${snapshot.diagnostics.leakageSafety.targetSeasonExcludedFromInputs}
- No post-target projection artifacts used: ${snapshot.diagnostics.leakageSafety.noPostTargetProjectionArtifactsUsed}
${snapshot.diagnostics.leakageSafety.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(snapshot: PreseasonProjectionSnapshot) {
  const headers = ["player", "position", "team", "variant", "universe", "cohorts", "calibration_cohort", "cohort_reason", "expected_games_rule", "ppg_adjustment_rule", "confidence_rule", "no_prior_rule", "expected_games_model", "expected_games_model_selected", "expected_games_selection_reason", "expected_games_selection_protected_reason", "expected_games_selection_flag_enabled", "expected_games_readiness_artifacts_available", "expected_games_readiness_status", "expected_games_selector_player_id", "expected_games_rule_v4", "expected_games_confidence", "expected_games_warnings", "selected_expected_games_method", "selected_expected_games_reason", "fallback_reason", "v6_selected_expected_games_method", "v6_gate_reason", "v6_position_family_gate_status", "v6_expected_games_confidence", "v6_selected_expected_games_reason", "v6_fallback_reason", "v7_selected_expected_games_method", "v7_gate_reason", "v7_position_family_gate_status", "v7_expected_games_confidence", "v7_selected_expected_games_reason", "v7_fallback_reason", "v8_selected_expected_games_method", "v8_cohort", "v8_baseline_expected_games", "v8_adjustment", "v8_adjustment_reason", "v8_baseline_source", "v8_expected_games_confidence", "v8_selected_expected_games_reason", "v8_fallback_reason", "v81_base_model_used", "v81_projected_games_raw_v8", "v81_projected_games_v7", "v81_raw_delta_from_v7", "v81_calibrated_delta_from_v7", "v81_dampening_factor", "v81_gates_applied", "v81_cohort", "v81_position", "v81_ppg_bucket", "v81_adjustment_bucket", "v81_reason_codes", "v81_selected_expected_games_reason", "v82_base_model_used", "v82_projected_games_v7", "v82_projected_games_v8", "v82_projected_games_v81", "v82_delta_from_v7", "v82_delta_from_v81", "v82_guardrail_applied", "v82_guardrail_reason_codes", "v82_ppg_bucket", "v82_adjustment_bucket", "v82_selected_expected_games_reason", "qb_starter_probability_bucket", "qb_starter_signal_reason", "qb_expected_games_cap", "qb_fallback_reason", "previous_projected_games", "v4_projected_games", "v5_projected_games", "v6_projected_games", "v7_projected_games", "v8_projected_games", "v81_projected_games", "v82_projected_games", "weighted_recent_games", "career_recent_games", "projected_games", "projected_games_v1", "calibrated_projected_games", "games_calibration_reason", "availability_cohort", "availability_confidence", "projected_ppg", "projected_total_points", "floor_points", "median_points", "ceiling_points", "confidence", "prior_seasons", "prior_games", "prior_ppg", "career_to_date_ppg", "no_prior_type", "role_label", "availability_signal", "snap_share", "usage_trend", "high_value_usage_flags", "warnings"];
  const rows = snapshot.rows.map((row) => [
    row.playerName,
    row.position,
    row.team ?? "",
    row.variant,
    row.universe,
    row.cohortLabels.join("|"),
    row.expectedGamesDiagnostics.calibrationCohort,
    row.expectedGamesDiagnostics.cohortReason,
    row.expectedGamesDiagnostics.expectedGamesRule,
    row.expectedGamesDiagnostics.ppgAdjustmentRule,
    row.expectedGamesDiagnostics.confidenceRule,
    row.expectedGamesDiagnostics.noPriorRule ?? "",
    row.expectedGamesDiagnostics.expectedGamesModel ?? "",
    row.expectedGamesDiagnostics.expectedGamesModelSelected ?? "",
    row.expectedGamesDiagnostics.expectedGamesSelectionReason ?? "",
    row.expectedGamesDiagnostics.expectedGamesSelectionProtectedReason ?? "",
    row.expectedGamesDiagnostics.expectedGamesSelectionFlagEnabled ?? "",
    row.expectedGamesDiagnostics.expectedGamesReadinessArtifactsAvailable ?? "",
    row.expectedGamesDiagnostics.expectedGamesReadinessStatus ?? "",
    row.expectedGamesDiagnostics.expectedGamesSelectorPlayerId ?? "",
    row.expectedGamesDiagnostics.expectedGamesRuleV4 ?? "",
    row.expectedGamesDiagnostics.expectedGamesConfidence ?? "",
    row.expectedGamesDiagnostics.expectedGamesWarnings.join("|"),
    row.expectedGamesDiagnostics.selectedExpectedGamesMethod ?? "",
    row.expectedGamesDiagnostics.selectedExpectedGamesReason ?? "",
    row.expectedGamesDiagnostics.fallbackReason ?? "",
    row.expectedGamesDiagnostics.v6SelectedExpectedGamesMethod ?? "",
    row.expectedGamesDiagnostics.v6GateReason ?? "",
    row.expectedGamesDiagnostics.v6PositionFamilyGateStatus ?? "",
    row.expectedGamesDiagnostics.v6ExpectedGamesConfidence ?? "",
    row.expectedGamesDiagnostics.v6SelectedExpectedGamesReason ?? "",
    row.expectedGamesDiagnostics.v6FallbackReason ?? "",
    row.expectedGamesDiagnostics.v7SelectedExpectedGamesMethod ?? "",
    row.expectedGamesDiagnostics.v7GateReason ?? "",
    row.expectedGamesDiagnostics.v7PositionFamilyGateStatus ?? "",
    row.expectedGamesDiagnostics.v7ExpectedGamesConfidence ?? "",
    row.expectedGamesDiagnostics.v7SelectedExpectedGamesReason ?? "",
    row.expectedGamesDiagnostics.v7FallbackReason ?? "",
    row.expectedGamesDiagnostics.v8SelectedExpectedGamesMethod ?? "",
    row.expectedGamesDiagnostics.v8Cohort ?? "",
    row.expectedGamesDiagnostics.v8BaselineExpectedGames ?? "",
    row.expectedGamesDiagnostics.v8Adjustment ?? "",
    row.expectedGamesDiagnostics.v8AdjustmentReason ?? "",
    row.expectedGamesDiagnostics.v8BaselineSource ?? "",
    row.expectedGamesDiagnostics.v8ExpectedGamesConfidence ?? "",
    row.expectedGamesDiagnostics.v8SelectedExpectedGamesReason ?? "",
    row.expectedGamesDiagnostics.v8FallbackReason ?? "",
    row.expectedGamesDiagnostics.v81BaseModelUsed ?? "",
    row.expectedGamesDiagnostics.v81ProjectedGamesRawV8 ?? "",
    row.expectedGamesDiagnostics.v81ProjectedGamesV7 ?? "",
    row.expectedGamesDiagnostics.v81RawDeltaFromV7 ?? "",
    row.expectedGamesDiagnostics.v81CalibratedDeltaFromV7 ?? "",
    row.expectedGamesDiagnostics.v81DampeningFactor ?? "",
    row.expectedGamesDiagnostics.v81GatesApplied.join("|"),
    row.expectedGamesDiagnostics.v81Cohort ?? "",
    row.expectedGamesDiagnostics.v81Position ?? "",
    row.expectedGamesDiagnostics.v81PpgBucket ?? "",
    row.expectedGamesDiagnostics.v81AdjustmentBucket ?? "",
    row.expectedGamesDiagnostics.v81ReasonCodes.join("|"),
    row.expectedGamesDiagnostics.v81SelectedExpectedGamesReason ?? "",
    row.expectedGamesDiagnostics.v82BaseModelUsed ?? "",
    row.expectedGamesDiagnostics.v82ProjectedGamesV7 ?? "",
    row.expectedGamesDiagnostics.v82ProjectedGamesV8 ?? "",
    row.expectedGamesDiagnostics.v82ProjectedGamesV81 ?? "",
    row.expectedGamesDiagnostics.v82DeltaFromV7 ?? "",
    row.expectedGamesDiagnostics.v82DeltaFromV81 ?? "",
    row.expectedGamesDiagnostics.v82GuardrailApplied ?? "",
    row.expectedGamesDiagnostics.v82GuardrailReasonCodes.join("|"),
    row.expectedGamesDiagnostics.v82PpgBucket ?? "",
    row.expectedGamesDiagnostics.v82AdjustmentBucket ?? "",
    row.expectedGamesDiagnostics.v82SelectedExpectedGamesReason ?? "",
    row.expectedGamesDiagnostics.qbStarterProbabilityBucket ?? "",
    row.expectedGamesDiagnostics.qbStarterSignalReason ?? "",
    row.expectedGamesDiagnostics.qbExpectedGamesCap ?? "",
    row.expectedGamesDiagnostics.qbFallbackReason ?? "",
    row.expectedGamesDiagnostics.previousProjectedGames ?? "",
    row.expectedGamesDiagnostics.v4ProjectedGames ?? "",
    row.expectedGamesDiagnostics.v5ProjectedGames ?? "",
    row.expectedGamesDiagnostics.v6ProjectedGames ?? "",
    row.expectedGamesDiagnostics.v7ProjectedGames ?? "",
    row.expectedGamesDiagnostics.v8ProjectedGames ?? "",
    row.expectedGamesDiagnostics.v81ProjectedGames ?? "",
    row.expectedGamesDiagnostics.v82ProjectedGames ?? "",
    row.expectedGamesDiagnostics.weightedRecentGames ?? "",
    row.expectedGamesDiagnostics.careerRecentGames ?? "",
    row.projectedGames,
    row.expectedGamesDiagnostics.projectedGamesV1,
    row.expectedGamesDiagnostics.calibratedProjectedGames,
    row.expectedGamesDiagnostics.gamesCalibrationReason,
    row.expectedGamesDiagnostics.availabilityCohort,
    row.expectedGamesDiagnostics.availabilityConfidence,
    row.projectedPpg,
    row.projectedTotalPoints,
    row.floorPoints,
    row.medianPoints,
    row.ceilingPoints,
    row.confidence,
    row.inputCoverage.priorSeasonsUsed.join("|"),
    row.inputCoverage.priorGames,
    row.inputCoverage.priorPpg ?? "",
    row.inputCoverage.careerToDatePpg ?? "",
    row.inputCoverage.noPriorType,
    row.inputCoverage.roleLabel,
    row.inputCoverage.availabilitySignal ?? "",
    row.inputCoverage.snapShare ?? "",
    row.inputCoverage.usageTrend,
    row.inputCoverage.highValueUsageFlags.join("|"),
    row.warnings.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function averagePpgByPosition(rows: PreseasonProjectionSnapshotRow[]) {
  const byPosition = new Map<string, number[]>();
  for (const row of rows) byPosition.set(row.position, [...(byPosition.get(row.position) ?? []), row.projectedPpg]);
  return Object.fromEntries([...byPosition.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([position, values]) => [position, mean(values) ?? 0]));
}

function weightedAverage(values: Array<number | null>, weights: number[]) {
  let valueTotal = 0;
  let weightTotal = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const weight = weights[index] ?? 0;
    if (typeof value !== "number" || !Number.isFinite(value) || weight <= 0) continue;
    valueTotal += value * weight;
    weightTotal += weight;
  }
  return weightTotal ? valueTotal / weightTotal : null;
}

function confidenceScore(confidence: PreseasonProjectionSnapshotRow["confidence"]) {
  return confidence === "high" ? 90 : confidence === "medium" ? 70 : confidence === "low" ? 50 : 30;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function unique(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function mean(values: number[]) {
  if (!values.length) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function selectorPlayerIdForProfile(profile: HistoricalPlayerProfileSnapshot, position: string) {
  return profile.identity.sleeperId ?? profile.identity.gsisId ?? `${normalizeName(profile.bio.name)}:${position}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
