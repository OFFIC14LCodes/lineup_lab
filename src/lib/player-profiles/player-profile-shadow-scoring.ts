import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProfileEvidenceDiagnosticRow,
  ProfileEvidenceDiagnosticSeverity,
} from "./player-profile-evidence-diagnostics";

export type ProfileShadowPoolMode = "relevant" | "all" | "topN";
export type ProfileShadowMovementClassification =
  | "strong_boost"
  | "mild_boost"
  | "negligible"
  | "mild_penalty"
  | "strong_penalty";
export type ProfileShadowMovementDirection = "up" | "down" | "unchanged";
export type ProfileShadowCalibrationVerdict =
  | "too_aggressive"
  | "too_weak"
  | "reasonable_for_shadow_only"
  | "ready_for_flagged_ui_preview"
  | "ready_for_small_live_weight";

export type ProfileShadowScoringWeights = {
  adjustmentCap: number;
  strongAdjustmentThreshold: number;
  mildAdjustmentThreshold: number;
  relevantRankLimit: number;
  topN: number;
};

export type ProfileShadowComponentAdjustments = {
  sampleConfidence: number;
  consistencyFloor: number;
  ceilingSpike: number;
  availability: number;
  positionSpecificEdge: number;
  cautionPenalty: number;
  rankZoneDampening: number;
};

export type ProfileShadowScoringRow = {
  playerId: string | null;
  playerName: string;
  position: string | null;
  team: string | null;
  poolMode: ProfileShadowPoolMode;
  currentRank: number;
  currentScore: number | null;
  shadowRank: number;
  shadowScore: number;
  rankMovement: number;
  movementDirection: ProfileShadowMovementDirection;
  movementClassification: ProfileShadowMovementClassification;
  profileShadowAdjustment: number;
  profileEvidenceScore: number;
  profileSeverity: ProfileEvidenceDiagnosticSeverity;
  profileMetrics: ProfileEvidenceDiagnosticRow["profileMetrics"];
  matchConfidence: string | null;
  scoringSource: ProfileEvidenceDiagnosticRow["scoringSource"];
  componentAdjustments: ProfileShadowComponentAdjustments;
  positiveSignals: string[];
  cautionSignals: string[];
  adjustmentReasons: string[];
};

export type ProfileShadowScoringResult = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  draftRoomId: string | null;
  leagueId: string | null;
  pool: {
    mode: ProfileShadowPoolMode;
    totalCandidatesBeforeFiltering: number;
    totalPlayersEvaluatedAfterFiltering: number;
    filteredOutAsFringe: number;
    filteredOutAsUnsupported: number;
    filteredOutAsInactive: number;
    filteredOutNoBoardRank: number;
    profilesAvailable: number;
    profilesUnavailable: number;
    topN: number | null;
    relevantRankLimit: number;
  };
  totals: {
    playersEvaluated: number;
    averageAdjustment: number;
    medianAdjustment: number;
    maxBoost: number;
    maxPenalty: number;
    boostedPlayers: number;
    penalizedPlayers: number;
    unchangedPlayers: number;
    strongBoostCount: number;
    mildBoostCount: number;
    negligibleCount: number;
    mildPenaltyCount: number;
    strongPenaltyCount: number;
    currentScoreRows: number;
    rankOnlyRows: number;
  };
  distributions: {
    movement: Record<ProfileShadowMovementClassification, number>;
    positionMovement: Record<string, Record<ProfileShadowMovementClassification, number>>;
  };
  categories: {
    strongBoosts: ProfileShadowScoringRow[];
    strongPenalties: ProfileShadowScoringRow[];
    idpBoosts: ProfileShadowScoringRow[];
    qbRbWrTeBoosts: ProfileShadowScoringRow[];
    largestRankMovers: ProfileShadowScoringRow[];
    intuitiveMovements: ProfileShadowScoringRow[];
    suspiciousMovements: ProfileShadowScoringRow[];
  };
  rows: ProfileShadowScoringRow[];
  weights: ProfileShadowScoringWeights;
  calibration: {
    verdict: ProfileShadowCalibrationVerdict;
    notes: string[];
  };
  sanity: {
    movementCountsReconcile: boolean;
    strongBoostsWithinBoosted: boolean;
    strongPenaltiesWithinPenalized: boolean;
  };
  safety: {
    changesBlackbirdRank: false;
    changesDraftSuggestionOrder: false;
    changesProjectionGeneration: false;
    writesSupabase: false;
    exposesProductionUi: false;
  };
};

const DEFAULT_WEIGHTS: ProfileShadowScoringWeights = {
  adjustmentCap: 6,
  strongAdjustmentThreshold: 4,
  mildAdjustmentThreshold: 1.5,
  relevantRankLimit: 410,
  topN: 410,
};

const CATEGORY_LIMIT = 25;
const SUPPORTED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DL", "LB", "DB"]);

export function buildProfileShadowScoring(input: {
  draftRoomId?: string | null;
  leagueId?: string | null;
  rows: ProfileEvidenceDiagnosticRow[];
  generatedAt?: string;
  poolMode?: ProfileShadowPoolMode;
  topN?: number;
  weights?: Partial<ProfileShadowScoringWeights>;
}): ProfileShadowScoringResult {
  const weights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const poolMode = input.poolMode ?? "relevant";
  const topN = input.topN ?? weights.topN;
  const pool = selectPool(input.rows, poolMode, weights, topN);
  const baselineRows = pool.rows.map((row, index) => {
    const currentRank = currentRankFor(row, index);
    const currentScore = row.recommendationScore ?? row.valueScore ?? null;
    const baselineScore = currentScore ?? rankOnlyBaselineScore(currentRank, pool.rows.length);
    const adjustment = calculateProfileShadowAdjustment(row, currentRank, weights);
    return {
      row,
      currentRank,
      currentScore,
      baselineScore,
      adjustment,
      shadowSortScore: baselineScore + adjustment.value,
    };
  });

  const shadowRankByKey = new Map<string, number>();
  [...baselineRows]
    .sort((a, b) =>
      b.shadowSortScore - a.shadowSortScore ||
      a.currentRank - b.currentRank ||
      a.row.playerName.localeCompare(b.row.playerName)
    )
    .forEach((item, index) => shadowRankByKey.set(rowKey(item.row, item.currentRank), index + 1));

  const rows = baselineRows
    .map((item) => {
      const shadowRank = shadowRankByKey.get(rowKey(item.row, item.currentRank)) ?? item.currentRank;
      const rankMovement = item.currentRank - shadowRank;
      return toShadowRow({
        source: item.row,
        poolMode,
        currentRank: item.currentRank,
        currentScore: item.currentScore,
        shadowRank,
        shadowScore: round(item.baselineScore + item.adjustment.value),
        rankMovement,
        adjustment: item.adjustment,
        weights,
      });
    })
    .sort((a, b) => a.currentRank - b.currentRank || a.playerName.localeCompare(b.playerName));

  const movement = movementDistribution(rows);
  const positionMovement = positionMovementDistribution(rows);
  const totalAdjustment = rows.reduce((sum, row) => sum + row.profileShadowAdjustment, 0);
  const boostedPlayers = rows.filter((row) => row.profileShadowAdjustment > 0).length;
  const penalizedPlayers = rows.filter((row) => row.profileShadowAdjustment < 0).length;
  const unchangedPlayers = rows.filter((row) => row.profileShadowAdjustment === 0).length;
  const calibration = calibrationNotes(rows);
  const sanity = {
    movementCountsReconcile: boostedPlayers + penalizedPlayers + unchangedPlayers === rows.length,
    strongBoostsWithinBoosted: movement.strong_boost <= boostedPlayers,
    strongPenaltiesWithinPenalized: movement.strong_penalty <= penalizedPlayers,
  };

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    draftRoomId: input.draftRoomId ?? null,
    leagueId: input.leagueId ?? null,
    pool: {
      mode: poolMode,
      totalCandidatesBeforeFiltering: input.rows.length,
      totalPlayersEvaluatedAfterFiltering: rows.length,
      filteredOutAsFringe: pool.filteredOutAsFringe,
      filteredOutAsUnsupported: pool.filteredOutAsUnsupported,
      filteredOutAsInactive: 0,
      filteredOutNoBoardRank: pool.filteredOutNoBoardRank,
      profilesAvailable: rows.filter((row) => row.profileSeverity !== "profile_unavailable").length,
      profilesUnavailable: rows.filter((row) => row.profileSeverity === "profile_unavailable").length,
      topN: poolMode === "topN" ? topN : null,
      relevantRankLimit: weights.relevantRankLimit,
    },
    totals: {
      playersEvaluated: rows.length,
      averageAdjustment: round(rows.length ? totalAdjustment / rows.length : 0),
      medianAdjustment: median(rows.map((row) => row.profileShadowAdjustment)),
      maxBoost: rows.length ? Math.max(...rows.map((row) => row.profileShadowAdjustment)) : 0,
      maxPenalty: rows.length ? Math.min(...rows.map((row) => row.profileShadowAdjustment)) : 0,
      boostedPlayers,
      penalizedPlayers,
      unchangedPlayers,
      strongBoostCount: movement.strong_boost,
      mildBoostCount: movement.mild_boost,
      negligibleCount: movement.negligible,
      mildPenaltyCount: movement.mild_penalty,
      strongPenaltyCount: movement.strong_penalty,
      currentScoreRows: rows.filter((row) => row.currentScore !== null).length,
      rankOnlyRows: rows.filter((row) => row.currentScore === null).length,
    },
    distributions: { movement, positionMovement },
    categories: {
      strongBoosts: cap(rows.filter((row) => row.movementClassification === "strong_boost").sort(sortByAdjustmentImpact)),
      strongPenalties: cap(rows.filter((row) => row.movementClassification === "strong_penalty").sort(sortByAdjustmentImpact)),
      idpBoosts: cap(rows.filter((row) => isIdp(row.position) && row.profileShadowAdjustment > 0).sort(sortByAdjustmentImpact)),
      qbRbWrTeBoosts: cap(rows.filter((row) => ["QB", "RB", "WR", "TE"].includes(row.position ?? "") && row.profileShadowAdjustment > 0).sort(sortByAdjustmentImpact)),
      largestRankMovers: cap([...rows].sort((a, b) => Math.abs(b.rankMovement) - Math.abs(a.rankMovement) || Math.abs(b.profileShadowAdjustment) - Math.abs(a.profileShadowAdjustment))),
      intuitiveMovements: cap(rows.filter(isIntuitiveMovement).sort(sortByAdjustmentImpact)),
      suspiciousMovements: cap(rows.filter(isSuspiciousMovement).sort(sortByAdjustmentImpact)),
    },
    rows,
    weights,
    calibration,
    sanity,
    safety: {
      changesBlackbirdRank: false,
      changesDraftSuggestionOrder: false,
      changesProjectionGeneration: false,
      writesSupabase: false,
      exposesProductionUi: false,
    },
  };
}

export function renderProfileShadowScoringMarkdown(result: ProfileShadowScoringResult): string {
  return [
    "# Historical Profile Shadow Scoring Diagnostics",
    "",
    `Generated: ${result.generatedAt}`,
    `Draft room: ${result.draftRoomId ?? "not provided"}`,
    `League: ${result.leagueId ?? "not provided"}`,
    `Dry run: ${result.dryRun}`,
    `Read-only: ${result.readOnly}`,
    "",
    "## Pool",
    "",
    `- Pool mode: ${result.pool.mode}`,
    `- Candidates before filtering: ${result.pool.totalCandidatesBeforeFiltering}`,
    `- Players evaluated after filtering: ${result.pool.totalPlayersEvaluatedAfterFiltering}`,
    `- Filtered out as fringe: ${result.pool.filteredOutAsFringe}`,
    `- Filtered out as unsupported: ${result.pool.filteredOutAsUnsupported}`,
    `- Filtered out as inactive: ${result.pool.filteredOutAsInactive}`,
    `- Filtered out with no board rank: ${result.pool.filteredOutNoBoardRank}`,
    `- Profiles available: ${result.pool.profilesAvailable}`,
    `- Profiles unavailable: ${result.pool.profilesUnavailable}`,
    "",
    "## Totals",
    "",
    `- Total players evaluated: ${result.totals.playersEvaluated}`,
    `- Average shadow adjustment: ${format(result.totals.averageAdjustment)}`,
    `- Median shadow adjustment: ${format(result.totals.medianAdjustment)}`,
    `- Max boost: ${format(result.totals.maxBoost)}`,
    `- Max penalty: ${format(result.totals.maxPenalty)}`,
    `- Players boosted: ${result.totals.boostedPlayers}`,
    `- Players penalized: ${result.totals.penalizedPlayers}`,
    `- Players unchanged: ${result.totals.unchangedPlayers}`,
    "",
    "## Movement Distribution",
    "",
    ...Object.entries(result.distributions.movement).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Position Movement Distribution",
    "",
    ...Object.entries(result.distributions.positionMovement).flatMap(([position, counts]) => [
      `### ${position}`,
      ...Object.entries(counts).map(([key, value]) => `- ${key}: ${value}`),
      "",
    ]),
    "## Weight Model",
    "",
    `- Adjustment cap: +/-${result.weights.adjustmentCap}`,
    "- Sample/confidence component cap: -2 to +2",
    "- Consistency/floor component cap: -2 to +2",
    "- Ceiling/spike component cap: -2 to +2",
    "- Availability component cap: -2 to +2",
    "- Position-specific edge component cap: -2 to +2",
    "- Insufficient sample caps positive adjustment instead of applying a large automatic penalty.",
    "- Elite and fringe rank zones are dampened before final cap.",
    "",
    renderCategory("Top 25 Strong Boosts", result.categories.strongBoosts),
    renderCategory("Top 25 Strong Penalties", result.categories.strongPenalties),
    renderCategory("Top 25 IDP Boosts", result.categories.idpBoosts),
    renderCategory("Top 25 QB/RB/WR/TE Boosts", result.categories.qbRbWrTeBoosts),
    renderCategory("Top 25 Largest Rank Movers", result.categories.largestRankMovers),
    renderCategory("Examples That Look Intuitive", result.categories.intuitiveMovements),
    renderCategory("Examples That Still Look Suspicious", result.categories.suspiciousMovements),
    "## Sanity",
    "",
    `- Boosted + penalized + unchanged = evaluated: ${result.sanity.movementCountsReconcile}`,
    `- Strong boosts <= boosted players: ${result.sanity.strongBoostsWithinBoosted}`,
    `- Strong penalties <= penalized players: ${result.sanity.strongPenaltiesWithinPenalized}`,
    "",
    "## Calibration Verdict",
    "",
    ...result.calibration.notes.map((note) => `- ${note}`),
    `- Verdict: ${result.calibration.verdict}`,
    "",
    "## Safety",
    "",
    `- Changes Blackbird Rank: ${result.safety.changesBlackbirdRank}`,
    `- Changes Draft Suggestion Order: ${result.safety.changesDraftSuggestionOrder}`,
    `- Changes Projection Generation: ${result.safety.changesProjectionGeneration}`,
    `- Writes Supabase: ${result.safety.writesSupabase}`,
    `- Exposes Production UI: ${result.safety.exposesProductionUi}`,
    "",
  ].join("\n");
}

export function renderProfileShadowScoringCsv(result: ProfileShadowScoringResult): string {
  const header = [
    "player_name",
    "position",
    "team",
    "pool_mode",
    "current_rank",
    "current_score",
    "shadow_rank",
    "shadow_score",
    "rank_movement",
    "profile_shadow_adjustment",
    "movement_classification",
    "profile_evidence_score",
    "severity",
    "sample_size",
    "ppg",
    "consistency",
    "spike",
    "availability",
    "floor",
    "ceiling",
    "match_confidence",
    "scoring_source",
    "sample_confidence_component",
    "consistency_floor_component",
    "ceiling_spike_component",
    "availability_component",
    "position_specific_component",
    "caution_penalty_component",
    "rank_zone_dampening",
    "adjustment_reasons",
    "caution_reasons",
  ];
  return [
    header.join(","),
    ...result.rows.map((row) =>
      [
        row.playerName,
        row.position ?? "",
        row.team ?? "",
        row.poolMode,
        row.currentRank,
        row.currentScore ?? "",
        row.shadowRank,
        row.shadowScore,
        row.rankMovement,
        row.profileShadowAdjustment,
        row.movementClassification,
        row.profileEvidenceScore,
        row.profileSeverity,
        row.profileMetrics.games ?? "",
        row.profileMetrics.ppg ?? "",
        row.profileMetrics.consistencyScore ?? "",
        row.profileMetrics.spikeScore ?? "",
        row.profileMetrics.availabilityScore ?? "",
        row.profileMetrics.floor ?? "",
        row.profileMetrics.ceiling ?? "",
        row.matchConfidence ?? "",
        row.scoringSource,
        row.componentAdjustments.sampleConfidence,
        row.componentAdjustments.consistencyFloor,
        row.componentAdjustments.ceilingSpike,
        row.componentAdjustments.availability,
        row.componentAdjustments.positionSpecificEdge,
        row.componentAdjustments.cautionPenalty,
        row.componentAdjustments.rankZoneDampening,
        row.adjustmentReasons.join(" | "),
        row.cautionSignals.join(" | "),
      ].map(csvCell).join(",")
    ),
  ].join("\n");
}

export function writeProfileShadowScoringArtifacts(
  result: ProfileShadowScoringResult,
  outputDir = path.join(process.cwd(), "artifacts", "projections")
) {
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "profile-shadow-scoring-diagnostics.json");
  const markdownPath = path.join(outputDir, "profile-shadow-scoring-diagnostics.md");
  const csvPath = path.join(outputDir, "profile-shadow-scoring-diagnostics.csv");
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(markdownPath, renderProfileShadowScoringMarkdown(result));
  writeFileSync(csvPath, `${renderProfileShadowScoringCsv(result)}\n`);
  return { jsonPath, markdownPath, csvPath };
}

function selectPool(rows: ProfileEvidenceDiagnosticRow[], mode: ProfileShadowPoolMode, weights: ProfileShadowScoringWeights, topN: number) {
  const ranked = rows.map((row, index) => ({ row, currentRank: currentRankFor(row, index) }));
  let filteredOutAsFringe = 0;
  let filteredOutAsUnsupported = 0;
  let filteredOutNoBoardRank = 0;
  const selected: ProfileEvidenceDiagnosticRow[] = [];

  for (const item of ranked) {
    if (!SUPPORTED_POSITIONS.has(item.row.position ?? "")) {
      filteredOutAsUnsupported += 1;
      continue;
    }
    if (item.row.draftSuggestionRank === null && item.row.blackbirdRank === null) {
      filteredOutNoBoardRank += 1;
      continue;
    }
    const rankLimit = mode === "topN" ? topN : weights.relevantRankLimit;
    if (mode !== "all" && item.currentRank > rankLimit) {
      filteredOutAsFringe += 1;
      continue;
    }
    if (mode === "relevant" && !item.row.profileAvailable) {
      filteredOutAsFringe += 1;
      continue;
    }
    selected.push(item.row);
  }

  return {
    rows: selected,
    filteredOutAsFringe,
    filteredOutAsUnsupported,
    filteredOutNoBoardRank,
  };
}

function calculateProfileShadowAdjustment(row: ProfileEvidenceDiagnosticRow, currentRank: number, weights: ProfileShadowScoringWeights) {
  const reasons: string[] = [];
  if (!row.profileAvailable) {
    const components = emptyComponents();
    components.cautionPenalty = -1;
    reasons.push("No historical profile available: -1");
    return { value: -1, reasons, components };
  }

  const sampleConfidence = sampleConfidenceComponent(row, reasons);
  const consistencyFloor = consistencyFloorComponent(row, reasons);
  const ceilingSpike = ceilingSpikeComponent(row, reasons);
  const availability = availabilityComponent(row, reasons);
  const positionSpecificEdge = positionSpecificComponent(row, reasons);
  const cautionPenalty = cautionPenaltyComponent(row, reasons);
  const raw = sampleConfidence + consistencyFloor + ceilingSpike + availability + positionSpecificEdge + cautionPenalty;
  const dampening = rankZoneDampening(row, currentRank);
  let adjusted = raw * dampening;

  if (row.severity === "insufficient_sample") {
    adjusted = Math.min(adjusted, 1.25);
    if (row.profileMatchConfidence !== "weak") {
      adjusted = Math.max(adjusted, -1.25);
    }
    reasons.push("Insufficient sample caps positive shadow adjustment at +1.25.");
  }
  if (row.profileMatchConfidence === "weak") {
    adjusted = Math.min(adjusted, -1);
    reasons.push("Weak identity confidence cannot produce a positive shadow adjustment.");
  }
  if (isIdp(row.position) && (row.profileMetrics.ppg ?? 0) < 3) {
    adjusted = Math.min(adjusted, 1.25);
    reasons.push("Low historical IDP production caps positive shadow adjustment at +1.25.");
  }
  if (row.position === "K") {
    adjusted = clamp(adjusted, -1.2, 1.2);
    reasons.push("Kicker profile impact capped to +/-1.2.");
  }

  const value = round(clamp(adjusted, -weights.adjustmentCap, weights.adjustmentCap));
  return {
    value,
    reasons,
    components: {
      sampleConfidence,
      consistencyFloor,
      ceilingSpike,
      availability,
      positionSpecificEdge,
      cautionPenalty,
      rankZoneDampening: dampening,
    },
  };
}

function sampleConfidenceComponent(row: ProfileEvidenceDiagnosticRow, reasons: string[]) {
  const games = row.profileMetrics.games ?? 0;
  let component = 0;
  if (games >= 14) component += 1.25;
  else if (games >= 10) component += 1;
  else if (games >= 6) component += 0.25;
  else component -= 0.75;

  if (row.profileMatchConfidence === "exact_id" || row.profileMatchConfidence === "strong") component += 0.75;
  else if (row.profileMatchConfidence === "medium") component -= 0.75;
  else if (row.profileMatchConfidence === "weak") component -= 2;
  else component -= 1;

  component = clamp(component, -2, 2);
  reasons.push(`Sample/confidence component: ${formatSigned(component)}`);
  return component;
}

function consistencyFloorComponent(row: ProfileEvidenceDiagnosticRow, reasons: string[]) {
  const consistency = row.profileMetrics.consistencyScore;
  const floor = row.profileMetrics.floor;
  let component = 0;
  if (consistency !== null) {
    if (consistency >= 88) component += 1.25;
    else if (consistency >= 78) component += 0.75;
    else if (consistency < 55) component -= 1;
  }
  if (floor !== null) {
    if (floor >= strongFloorThreshold(row.position)) component += 0.75;
    else if (floor <= lowFloorThreshold(row.position)) component -= isIdp(row.position) ? 0.25 : 1;
  }
  component = clamp(component, -2, 2);
  reasons.push(`Consistency/floor component: ${formatSigned(component)}`);
  return component;
}

function ceilingSpikeComponent(row: ProfileEvidenceDiagnosticRow, reasons: string[]) {
  const spike = row.profileMetrics.spikeScore;
  const ceiling = row.profileMetrics.ceiling;
  let component = 0;
  if ((spike ?? 0) >= 85) component += 1.25;
  else if ((spike ?? 0) >= 75) component += 0.75;
  if (ceiling !== null && ceiling >= strongCeilingThreshold(row.position)) component += 0.75;
  if ((spike ?? 0) >= 85 && (row.profileMetrics.floor ?? 99) <= lowFloorThreshold(row.position)) component -= 1;
  component = clamp(component, -2, 2);
  reasons.push(`Ceiling/spike component: ${formatSigned(component)}`);
  return component;
}

function availabilityComponent(row: ProfileEvidenceDiagnosticRow, reasons: string[]) {
  const availability = row.profileMetrics.availabilityScore;
  let component = 0;
  if (availability !== null) {
    if (availability >= 95) component += 2;
    else if (availability >= 85) component += 1;
    else if (availability < 55) component -= 2;
    else if (availability < 70) component -= 1;
  }
  component = clamp(component, -2, 2);
  reasons.push(`Availability component: ${formatSigned(component)}`);
  return component;
}

function positionSpecificComponent(row: ProfileEvidenceDiagnosticRow, reasons: string[]) {
  let component = 0;
  if (row.position === "QB" && hasSignal(row, /rushing/i)) component += 1.5;
  if (row.position === "RB" && (hasSignal(row, /receiving|target/i) || (row.profileMetrics.floor ?? 0) >= strongFloorThreshold(row.position))) component += 1.5;
  if ((row.position === "WR" || row.position === "TE") && (row.profileMetrics.spikeScore ?? 0) >= 85) component += 1;
  if (row.position === "LB" && (row.badges.includes("idp-floor") || hasSignal(row, /tackle/i))) component += 2;
  if (row.position === "DB" && (row.badges.includes("idp-floor") || hasSignal(row, /tackle|pd|interception/i))) component += 1.25;
  if (row.position === "DL" && hasSignal(row, /sack|big-play|splash/i)) component += (row.profileMetrics.floor ?? 0) <= lowFloorThreshold(row.position) ? 0.5 : 1.5;
  if (row.position === "DL" && hasSignal(row, /sack|big-play|splash/i) && (row.profileMetrics.floor ?? 0) <= lowFloorThreshold(row.position)) component -= 0.75;
  component = clamp(component, -2, 2);
  reasons.push(`Position-specific component: ${formatSigned(component)}`);
  return component;
}

function cautionPenaltyComponent(row: ProfileEvidenceDiagnosticRow, reasons: string[]) {
  let component = 0;
  if (row.severity === "major_caution" || row.severity === "profile_disagreement") component -= 2;
  if (row.severity === "insufficient_sample") component -= 0.75;
  if (row.cautionSignals.some((signal) => /low floor|volatility|boom\/bust|bust/i.test(signal))) component -= 1;
  if (row.scoringSource === "fallback") component -= 0.5;
  component = clamp(component, -2.5, 0);
  reasons.push(`Caution penalty component: ${formatSigned(component)}`);
  return component;
}

function rankZoneDampening(row: ProfileEvidenceDiagnosticRow, currentRank: number) {
  let dampening = 1;
  if (currentRank <= 25) dampening = row.profileEvidenceScore < -35 ? 0.75 : 0.45;
  else if (currentRank <= 100) dampening = 0.75;
  else if (currentRank <= 250) dampening = 1;
  else if (currentRank <= 410) dampening = 0.8;
  else dampening = 0.35;
  if (row.position === "K") dampening = Math.min(dampening, 0.45);
  return dampening;
}

function toShadowRow(input: {
  source: ProfileEvidenceDiagnosticRow;
  poolMode: ProfileShadowPoolMode;
  currentRank: number;
  currentScore: number | null;
  shadowRank: number;
  shadowScore: number;
  rankMovement: number;
  adjustment: { value: number; reasons: string[]; components: ProfileShadowComponentAdjustments };
  weights: ProfileShadowScoringWeights;
}): ProfileShadowScoringRow {
  return {
    playerId: input.source.playerId,
    playerName: input.source.playerName,
    position: input.source.position,
    team: input.source.team,
    poolMode: input.poolMode,
    currentRank: input.currentRank,
    currentScore: input.currentScore,
    shadowRank: input.shadowRank,
    shadowScore: input.shadowScore,
    rankMovement: input.rankMovement,
    movementDirection: input.rankMovement > 0 ? "up" : input.rankMovement < 0 ? "down" : "unchanged",
    movementClassification: classifyMovement(input.adjustment.value, input.weights),
    profileShadowAdjustment: input.adjustment.value,
    profileEvidenceScore: input.source.profileEvidenceScore,
    profileSeverity: input.source.severity,
    profileMetrics: { ...input.source.profileMetrics },
    matchConfidence: input.source.profileMatchConfidence,
    scoringSource: input.source.scoringSource,
    componentAdjustments: { ...input.adjustment.components },
    positiveSignals: [...input.source.positiveSignals],
    cautionSignals: [...input.source.cautionSignals],
    adjustmentReasons: [...input.adjustment.reasons],
  };
}

function classifyMovement(adjustment: number, weights: ProfileShadowScoringWeights): ProfileShadowMovementClassification {
  if (adjustment >= weights.strongAdjustmentThreshold) return "strong_boost";
  if (adjustment <= -weights.strongAdjustmentThreshold) return "strong_penalty";
  if (adjustment >= weights.mildAdjustmentThreshold) return "mild_boost";
  if (adjustment <= -weights.mildAdjustmentThreshold) return "mild_penalty";
  return "negligible";
}

function calibrationNotes(rows: ProfileShadowScoringRow[]): ProfileShadowScoringResult["calibration"] {
  const notes: string[] = [];
  if (!rows.length) return { verdict: "too_weak", notes: ["No rows were evaluated."] };
  const average = rows.reduce((sum, row) => sum + row.profileShadowAdjustment, 0) / rows.length;
  const movement = movementDistribution(rows);
  const strongRate = (movement.strong_boost + movement.strong_penalty) / rows.length;
  const activeRate = (movement.strong_boost + movement.mild_boost + movement.mild_penalty + movement.strong_penalty) / rows.length;
  notes.push(`Average adjustment is ${format(average)} points.`);
  notes.push(`${format(strongRate * 100)}% of rows have strong boost/penalty classifications.`);
  notes.push(`${format(activeRate * 100)}% of rows have non-negligible adjustments.`);
  if (Math.abs(average) > 1) notes.push("Average adjustment is outside the desired -1 to +1 range.");
  if (strongRate > 0.15) notes.push("Strong movement rate remains high for a first live integration.");
  if (activeRate < 0.05) notes.push("Very few rows move; model may be too weak.");

  let verdict: ProfileShadowCalibrationVerdict = "reasonable_for_shadow_only";
  if (Math.abs(average) > 1.5 || strongRate > 0.2) verdict = "too_aggressive";
  else if (activeRate < 0.05) verdict = "too_weak";
  else if (Math.abs(average) <= 0.75 && strongRate <= 0.08 && activeRate <= 0.45) verdict = "ready_for_flagged_ui_preview";
  if (Math.abs(average) <= 0.5 && strongRate <= 0.04 && activeRate <= 0.25) verdict = "ready_for_small_live_weight";
  return { verdict, notes };
}

function movementDistribution(rows: ProfileShadowScoringRow[]) {
  const counts: Record<ProfileShadowMovementClassification, number> = {
    strong_boost: 0,
    mild_boost: 0,
    negligible: 0,
    mild_penalty: 0,
    strong_penalty: 0,
  };
  rows.forEach((row) => {
    counts[row.movementClassification] += 1;
  });
  return counts;
}

function positionMovementDistribution(rows: ProfileShadowScoringRow[]) {
  const output: Record<string, Record<ProfileShadowMovementClassification, number>> = {};
  rows.forEach((row) => {
    const position = row.position ?? "UNKNOWN";
    output[position] ??= { strong_boost: 0, mild_boost: 0, negligible: 0, mild_penalty: 0, strong_penalty: 0 };
    output[position][row.movementClassification] += 1;
  });
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}

function currentRankFor(row: ProfileEvidenceDiagnosticRow, index: number) {
  return row.draftSuggestionRank ?? row.blackbirdRank ?? index + 1;
}

function rankOnlyBaselineScore(currentRank: number, totalRows: number) {
  return Math.max(1, totalRows - currentRank + 1);
}

function rowKey(row: ProfileEvidenceDiagnosticRow, currentRank: number) {
  return `${row.playerId ?? ""}|${row.playerName}|${row.position ?? ""}|${row.team ?? ""}|${currentRank}`;
}

function hasSignal(row: ProfileEvidenceDiagnosticRow, pattern: RegExp) {
  return row.positiveSignals.some((signal) => pattern.test(signal)) || row.badges.some((badge) => pattern.test(badge));
}

function strongFloorThreshold(position: string | null) {
  if (position === "QB") return 14;
  if (position === "K") return 6;
  if (isIdp(position)) return 7;
  return 9;
}

function lowFloorThreshold(position: string | null) {
  if (position === "QB") return 7;
  if (position === "K") return 3;
  if (isIdp(position)) return 3;
  return 4;
}

function strongCeilingThreshold(position: string | null) {
  if (position === "QB") return 25;
  if (position === "K") return 12;
  if (isIdp(position)) return 14;
  return 20;
}

function renderCategory(title: string, rows: ProfileShadowScoringRow[]) {
  return [
    `## ${title}`,
    "",
    rows.length
      ? rows.map((row) => `- ${row.playerName} (${row.position ?? "?"}) - current #${row.currentRank}, shadow #${row.shadowRank}, movement ${format(row.rankMovement)}, adjustment ${format(row.profileShadowAdjustment)}, ${row.movementClassification}`).join("\n")
      : "- None",
    "",
  ].join("\n");
}

function isIntuitiveMovement(row: ProfileShadowScoringRow) {
  return (row.profileShadowAdjustment >= 1.5 && row.profileEvidenceScore >= 35 && row.profileSeverity !== "insufficient_sample") ||
    (row.profileShadowAdjustment <= -1.5 && (row.profileEvidenceScore <= -15 || row.profileSeverity === "insufficient_sample"));
}

function isSuspiciousMovement(row: ProfileShadowScoringRow) {
  return (row.profileShadowAdjustment >= 4 && row.profileMetrics.ppg !== null && row.profileMetrics.ppg < 3) ||
    (row.profileShadowAdjustment <= -4 && row.profileEvidenceScore >= 35) ||
    (row.position === "K" && Math.abs(row.profileShadowAdjustment) > 1.25);
}

function sortByAdjustmentImpact(a: ProfileShadowScoringRow, b: ProfileShadowScoringRow) {
  return Math.abs(b.profileShadowAdjustment) - Math.abs(a.profileShadowAdjustment) ||
    Math.abs(b.rankMovement) - Math.abs(a.rankMovement) ||
    a.currentRank - b.currentRank;
}

function emptyComponents(): ProfileShadowComponentAdjustments {
  return {
    sampleConfidence: 0,
    consistencyFloor: 0,
    ceilingSpike: 0,
    availability: 0,
    positionSpecificEdge: 0,
    cautionPenalty: 0,
    rankZoneDampening: 1,
  };
}

function isIdp(position: string | null) {
  return position === "DL" || position === "LB" || position === "DB";
}

function cap<T>(rows: T[]) {
  return rows.slice(0, CATEGORY_LIMIT);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  return round(value);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function format(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSigned(value: number) {
  return value > 0 ? `+${format(value)}` : format(value);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
