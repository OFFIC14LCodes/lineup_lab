export type RecommendationTier =
  | "elite_target"
  | "strong_target"
  | "good_value"
  | "depth_option"
  | "avoid_for_now";

export type DraftStage = "early" | "middle" | "late";
export type InputCompleteness = "full" | "partial" | "rankings_only" | "fallback_only";
export type PositionScoringMode =
  | "offense_v1_1"
  | "idp_rankings_v1"
  | "kicker_rankings_v1"
  | "defense_rankings_v1"
  | "unsupported";

export type DraftTargetScoreComponents = {
  rankingScore: number;
  projectionScore: number;
  valueScore: number;
  rosterNeedScore: number;
  scarcityScore: number;
  formatFitScore: number;
  adpValueScore: number;
  matchConfidencePenalty: number;
};

export type DraftTargetScorePlayer = {
  sleeper_player_id: string | null;
  matched_player_id: string | null;
  player_name: string | null;
  position: string | null;
  team: string | null;
  rank: number | null;
  adp: number | null;
  projected_points: number | null;
  dynasty_value: number | null;
  best_ball_value: number | null;
  superflex_value: number | null;
  te_premium_value: number | null;
  match_status: string | null;
  match_confidence: number | null;
  is_ranked: boolean;
  is_fallback: boolean;
};

type LeagueContext = {
  currentPickNumber: number;
  rosterPositions: string[];
  positionCounts: Record<string, number>;
  is_dynasty: boolean;
  is_best_ball: boolean;
  is_superflex: boolean;
  is_two_qb: boolean;
  te_premium: number;
  scoringSettings?: Record<string, number> | null;
};

export type ScoredDraftTarget = DraftTargetScorePlayer & {
  draftTargetScore: number | null;
  recommendationTier: RecommendationTier;
  scoreComponents: DraftTargetScoreComponents | null;
  reasons: string[];
  warnings: string[];
  inputCompleteness?: InputCompleteness;
  positionScoringMode?: PositionScoringMode;
};

export type DraftTargetNeeds = Array<{
  position: string;
  current: number;
  target: number;
  need: number;
  sharedFlexDemand?: number;
  needLevel?: "urgent" | "high" | "moderate" | "low" | "filled" | "not_used";
  kind?: "direct" | "shared" | "depth";
  label?: string;
  note?: string;
}>;

export type DraftTargetScoreResult = {
  scoredPlayers: ScoredDraftTarget[];
  recommendations: ScoredDraftTarget[];
  topNeeds: DraftTargetNeeds;
  scoringMetadata: {
    formulaVersion: "draft_target_score_v1.2";
    generatedAt: string;
    draftStage: DraftStage;
    inputsUsed: string[];
    limitations: string[];
    weights: typeof SCORE_WEIGHTS;
    supportedScoredPositions: string[];
    positionScoringModes: PositionScoringMode[];
    idpScoringDetected: boolean;
    rankingsOnlyPositions: string[];
  };
};

const SCORE_WEIGHTS = {
  ranking: 0.25,
  projection: 0.15,
  value: 0.15,
  rosterNeed: 0.15,
  scarcity: 0.1,
  formatFit: 0.1,
  adpValue: 0.1
} as const;

const FLEX_POSITIONS = new Set(["FLEX", "WRRB_FLEX", "WRRBTE_FLEX", "REC_FLEX", "W/R/T"]);
const SUPER_FLEX_POSITIONS = new Set(["SUPER_FLEX", "SUPERFLEX", "OP"]);
const IDP_FLEX_POSITIONS = new Set(["IDP", "IDP_FLEX", "FLEX_IDP", "DP"]);
const BENCH_POSITIONS = new Set(["BN", "BENCH", "IR", "RESERVE", "TAXI", "TAXI_SQUAD"]);
const OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
const DEFENSIVE_POSITIONS = ["DL", "LB", "DB"] as const;
const SCORABLE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"] as const;
const LIMITED_DATA_POSITIONS = new Set(["DL", "LB", "DB", "K", "DEF"]);

type StarterTargets = {
  direct: Record<(typeof SCORABLE_POSITIONS)[number], number>;
  offensiveFlexCount: number;
  superFlexCount: number;
  idpFlexCount: number;
};

type ScarcitySnapshot = {
  top24: Record<string, number>;
  top50: Record<string, number>;
  top100: Record<string, number>;
};

export function buildDraftTargetScore({
  players,
  league
}: {
  players: DraftTargetScorePlayer[];
  league: LeagueContext;
}): DraftTargetScoreResult {
  const rankedPlayers = players.filter((player) => player.is_ranked && !player.is_fallback);
  const draftStage = getDraftStage(league.currentPickNumber, league.positionCounts);
  const starterTargets = buildStarterTargets(league.rosterPositions);
  const topNeeds = buildTopNeeds(starterTargets, league.positionCounts, draftStage, league);
  const idpScoringDetected = detectIdpScoring(league.scoringSettings);

  if (rankedPlayers.length === 0) {
    return {
      scoredPlayers: players.map((player) => ({
        ...player,
        draftTargetScore: null,
        recommendationTier: "avoid_for_now",
        scoreComponents: null,
        reasons: [],
        warnings: player.is_fallback ? ["Upload rankings for true recommendations."] : [],
        inputCompleteness: player.is_fallback ? "fallback_only" : "rankings_only",
        positionScoringMode: "unsupported"
      })),
      recommendations: [],
      topNeeds,
      scoringMetadata: metadata(draftStage, idpScoringDetected)
    };
  }

  const rankedValues = rankedPlayers
    .map((player) => selectValueField(player, league))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const projectedValues = rankedPlayers
    .map((player) => player.projected_points)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const scarcity = {
    top24: countTopPositionDepth(rankedPlayers, 24),
    top50: countTopPositionDepth(rankedPlayers, 50),
    top100: countTopPositionDepth(rankedPlayers, 100)
  };

  const scoredPlayers = players
    .map((player): ScoredDraftTarget => {
      if (player.is_ranked && !player.is_fallback && isScorablePosition(player.position ?? "")) {
        return scoreRankedPlayer({
          player,
          league,
          draftStage,
          starterTargets,
          topNeeds,
          rankedValues,
          projectedValues,
          scarcity,
          idpScoringDetected
        });
      }

      return {
        ...player,
        draftTargetScore: null,
        recommendationTier: "avoid_for_now",
        scoreComponents: null,
        reasons: [],
        warnings: buildUnsupportedWarnings(player, league),
        inputCompleteness: player.is_fallback ? "fallback_only" : "rankings_only",
        positionScoringMode: "unsupported"
      };
    })
    .sort(sortByScoreThenRank);

  const recommendations = scoredPlayers
    .filter(
      (player) =>
        player.draftTargetScore !== null &&
        player.recommendationTier !== "avoid_for_now" &&
        player.match_status !== "unmatched" &&
        player.match_status !== "ambiguous"
    )
    .slice(0, 10);

  return {
    scoredPlayers,
    recommendations,
    topNeeds,
    scoringMetadata: metadata(draftStage, idpScoringDetected)
  };
}

function scoreRankedPlayer({
  player,
  league,
  draftStage,
  starterTargets,
  topNeeds,
  rankedValues,
  projectedValues,
  scarcity,
  idpScoringDetected
}: {
  player: DraftTargetScorePlayer;
  league: LeagueContext;
  draftStage: DraftStage;
  starterTargets: StarterTargets;
  topNeeds: DraftTargetNeeds;
  rankedValues: number[];
  projectedValues: number[];
  scarcity: ScarcitySnapshot;
  idpScoringDetected: boolean;
}): ScoredDraftTarget {
  const inputCompleteness = getInputCompleteness(player);
  const rankingScore = getRankingScore(player.rank);
  const projectionScore = getProjectionScore(player, projectedValues, rankingScore);
  const valueScore = getValueScore(player, league, rankedValues, rankingScore);
  const rosterNeedScore = getRosterNeedScore(player.position, league.positionCounts, starterTargets, league, draftStage);
  const scarcityScore = getScarcityScore(player.position, scarcity, league, draftStage);
  const formatFitScore = getFormatFitScore(player, league, rosterNeedScore, draftStage);
  const adpValueScore = getAdpValueScore(player.adp, league.currentPickNumber, rankingScore, valueScore);
  const matchConfidencePenalty = getMatchPenalty(player.match_status, player.match_confidence, player.is_fallback);
  const positionAdjustment = getPositionAdjustment(player.position, league, draftStage, rosterNeedScore, adpValueScore);

  const weightedScore =
    rankingScore * SCORE_WEIGHTS.ranking +
    projectionScore * SCORE_WEIGHTS.projection +
    valueScore * SCORE_WEIGHTS.value +
    rosterNeedScore * SCORE_WEIGHTS.rosterNeed +
    scarcityScore * SCORE_WEIGHTS.scarcity +
    formatFitScore * SCORE_WEIGHTS.formatFit +
    adpValueScore * SCORE_WEIGHTS.adpValue +
    positionAdjustment -
    matchConfidencePenalty;

  const draftTargetScore = clamp(weightedScore, 0, 100);
  const warnings = buildWarnings(player, projectedValues.length > 0, league, inputCompleteness, idpScoringDetected);
  const recommendationTier = getRecommendationTier(
    draftTargetScore,
    player,
    warnings.length,
    adpValueScore,
    league,
    draftStage
  );
  const positionScoringMode = getPositionScoringMode(player.position);
  const reasons = buildReasons({
    player,
    league,
    draftStage,
    projectionScore,
    valueScore,
    rosterNeedScore,
    scarcityScore,
    formatFitScore,
    topNeeds,
    scarcity,
    recommendationTier
  });

  return {
    ...player,
    draftTargetScore: round(draftTargetScore),
    recommendationTier,
    scoreComponents: {
      rankingScore: round(rankingScore),
      projectionScore: round(projectionScore),
      valueScore: round(valueScore),
      rosterNeedScore: round(rosterNeedScore),
      scarcityScore: round(scarcityScore),
      formatFitScore: round(formatFitScore),
      adpValueScore: round(adpValueScore),
      matchConfidencePenalty: round(matchConfidencePenalty)
    },
    reasons,
    warnings,
    inputCompleteness,
    positionScoringMode
  };
}

function buildStarterTargets(rosterPositions: string[]) {
  const direct = Object.fromEntries(SCORABLE_POSITIONS.map((position) => [position, 0])) as Record<
    (typeof SCORABLE_POSITIONS)[number],
    number
  >;
  let offensiveFlexCount = 0;
  let superFlexCount = 0;
  let idpFlexCount = 0;

  for (const rawSlot of rosterPositions) {
    const slot = normalizeRosterSlot(rawSlot);
    if (!slot || BENCH_POSITIONS.has(slot)) continue;

    if (FLEX_POSITIONS.has(slot)) {
      offensiveFlexCount += 1;
      continue;
    }
    if (SUPER_FLEX_POSITIONS.has(slot)) {
      superFlexCount += 1;
      continue;
    }
    if (IDP_FLEX_POSITIONS.has(slot)) {
      idpFlexCount += 1;
      continue;
    }

    const normalizedDirect = normalizeRosterSlotToPosition(slot);
    if (normalizedDirect) {
      direct[normalizedDirect] += 1;
    }
  }

  return { direct, offensiveFlexCount, superFlexCount, idpFlexCount };
}

function buildTopNeeds(
  starterTargets: StarterTargets,
  counts: Record<string, number>,
  draftStage: DraftStage,
  league: LeagueContext
): DraftTargetNeeds {
  return SCORABLE_POSITIONS
    .filter((position) => isPositionUsed(position, league, starterTargets))
    .map((position) => {
      const current = counts[position] ?? 0;
      const minimumNeed = getMinimumNeed(position, starterTargets);
      const directStarterRequirement = starterTargets.direct[position];
      const sharedFlexDemand = getSharedDemand(position, starterTargets);
      const deficit = Math.max(0, minimumNeed - current);
      return {
        position,
        label: position,
        current,
        target: minimumNeed,
        need: round(scoreTopNeed(position, draftStage, deficit, directStarterRequirement, sharedFlexDemand)),
        sharedFlexDemand: sharedFlexDemand || undefined,
        needLevel: deriveNeedLevel(position, draftStage, current, directStarterRequirement, sharedFlexDemand),
        kind: deficit > 0 ? ("direct" as const) : sharedFlexDemand > 0 ? ("shared" as const) : ("depth" as const)
      };
    })
    .sort((a, b) => b.need - a.need)
    .filter((item) => item.need > 0);
}

function getRankingScore(rank: number | null) {
  if (!rank || rank <= 0) return 10;
  const cappedRank = clamp(rank, 1, 300);
  return 100 - ((cappedRank - 1) / 299) * 95;
}

function getProjectionScore(player: DraftTargetScorePlayer, projectedValues: number[], rankingScore: number) {
  if (player.projected_points !== null && player.projected_points !== undefined && Number.isFinite(player.projected_points)) {
    return normalizeScore(player.projected_points, projectedValues, 45);
  }
  if (LIMITED_DATA_POSITIONS.has(player.position ?? "")) {
    return clamp(rankingScore * 0.72, 38, 74);
  }
  return 45;
}

function getValueScore(player: DraftTargetScorePlayer, league: LeagueContext, values: number[], rankingScore: number) {
  const preferredValue = selectValueField(player, league);
  if (preferredValue !== null && values.length > 1) {
    return normalizeScore(preferredValue, values, 50);
  }
  if (LIMITED_DATA_POSITIONS.has(player.position ?? "")) {
    return clamp(rankingScore * 0.82, 38, 78);
  }
  return clamp(rankingScore * 0.75, 25, 80);
}

function selectValueField(player: DraftTargetScorePlayer, league: LeagueContext) {
  if (league.is_superflex || league.is_two_qb) {
    if (player.superflex_value !== null && player.superflex_value !== undefined) return player.superflex_value;
  }
  if (league.te_premium > 0 && player.position === "TE") {
    if (player.te_premium_value !== null && player.te_premium_value !== undefined) return player.te_premium_value;
  }
  if (league.is_best_ball) {
    if (player.best_ball_value !== null && player.best_ball_value !== undefined) return player.best_ball_value;
  }
  if (league.is_dynasty) {
    if (player.dynasty_value !== null && player.dynasty_value !== undefined) return player.dynasty_value;
  }
  if (LIMITED_DATA_POSITIONS.has(player.position ?? "")) {
    return null;
  }
  return player.dynasty_value ?? player.best_ball_value ?? player.superflex_value ?? player.te_premium_value ?? null;
}

function getRosterNeedScore(
  position: string | null,
  counts: Record<string, number>,
  starterTargets: StarterTargets,
  league: LeagueContext,
  draftStage: DraftStage
) {
  if (!position || !isScorablePosition(position) || !isPositionUsed(position, league, starterTargets)) return 0;

  if (!isOffensivePosition(position)) {
    return getSpecialPositionNeedScore(position, counts, starterTargets, draftStage);
  }

  const current = counts[position] ?? 0;
  const starterDemand = getOffensiveDemand(position, starterTargets, league, draftStage);
  const baseStarters = starterTargets.direct[position] ?? 0;
  const starterDeficit = clamp((baseStarters - current) / Math.max(baseStarters, 1), 0, 1);
  const totalDeficit = clamp((starterDemand - current) / Math.max(starterDemand, 1), 0, 1);
  const depthTarget = getOffensiveDepthTarget(position, starterTargets, league, draftStage);
  const depthDeficit = clamp((depthTarget - current) / Math.max(depthTarget, 1), 0, 1);

  let score = 18 + starterDeficit * 42 + totalDeficit * 24 + depthDeficit * 16;

  if (draftStage === "early") {
    score -= 6;
    score += starterDeficit * 8;
  } else if (draftStage === "middle") {
    score += totalDeficit * 8;
  } else {
    score += depthDeficit * 10;
  }

  if ((league.is_superflex || league.is_two_qb) && position === "QB") {
    if (current === 0) score += 24;
    else if (current === 1) score += 14;
    else if (current === 2) score += 4;
    else if (current >= 3) score -= 8;
  }

  if (league.te_premium > 0 && position === "TE") {
    if (current === 0) score += 16;
    else if (current === 1) score += 4;
    else score -= 4;
  }

  if (league.is_best_ball) {
    if (position === "WR") score += 8;
    if (position === "RB") score += 5;
    if (position === "TE") score += 3;
  }

  return clamp(score, 10, 100);
}

function getSpecialPositionNeedScore(
  position: string,
  counts: Record<string, number>,
  starterTargets: StarterTargets,
  draftStage: DraftStage
) {
  const current = counts[position] ?? 0;
  const directRequirement = starterTargets.direct[position as keyof typeof starterTargets.direct] ?? 0;
  const sharedDemand = getSharedDemand(position, starterTargets);
  const minimumNeed = getMinimumNeed(position, starterTargets);
  const directDeficit = Math.max(0, directRequirement - current);
  const totalDeficit = Math.max(0, minimumNeed - current);

  let score = 12 + directDeficit * 28 + totalDeficit * 14;

  if (DEFENSIVE_POSITIONS.includes(position as (typeof DEFENSIVE_POSITIONS)[number])) {
    if (draftStage === "early") score -= 4;
    if (draftStage === "middle") score += directDeficit > 0 ? 8 : sharedDemand > 0 ? 5 : 0;
    if (draftStage === "late") score += totalDeficit > 0 ? 12 : sharedDemand > 0 ? 6 : 0;
  } else if (position === "K") {
    score += current === 0 && draftStage === "late" ? 18 : draftStage === "middle" ? -12 : -24;
  } else if (position === "DEF") {
    score += current === 0 && draftStage === "late" ? 16 : draftStage === "middle" ? -10 : -22;
  }

  return clamp(score, 0, 100);
}

function countTopPositionDepth(players: DraftTargetScorePlayer[], limit: number) {
  return players
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .slice(0, limit)
    .reduce<Record<string, number>>((acc, player) => {
      const position = player.position ?? "UNK";
      acc[position] = (acc[position] ?? 0) + 1;
      return acc;
    }, {});
}

function getScarcityScore(position: string | null, scarcity: ScarcitySnapshot, league: LeagueContext, draftStage: DraftStage) {
  if (!position || !isPositionUsed(position, league)) return 0;

  const top24 = scarcity.top24[position] ?? 0;
  const top50 = scarcity.top50[position] ?? 0;
  const top100 = scarcity.top100[position] ?? 0;
  let score =
    top24 <= 2 ? 84 : top24 <= 4 ? 74 : top24 <= 7 ? 64 : top50 <= 8 ? 58 : top100 <= 14 ? 50 : 38;

  if (draftStage === "early") score -= 4;
  if (draftStage === "middle") score += 4;
  if (draftStage === "late" && top100 <= 18) score += 6;

  if ((league.is_superflex || league.is_two_qb) && position === "QB") {
    score += top50 <= 6 ? 18 : top50 <= 9 ? 12 : 6;
  }
  if (league.te_premium > 0 && position === "TE") {
    score += top50 <= 5 ? 16 : top50 <= 8 ? 10 : 5;
  }
  if (position === "WR" && top100 >= 28) score -= 8;
  if (position === "RB" && top50 <= 12) score += 8;
  if (position === "K") score = top24 <= 3 ? 48 : top50 <= 6 ? 38 : 26;
  if (position === "DEF") score = top24 <= 3 ? 52 : top50 <= 6 ? 40 : 28;
  if (position === "DL" && top50 <= 8) score += 8;
  if (position === "LB" && top50 <= 8) score += 6;
  if (position === "DB" && top100 >= 18) score -= 6;

  return clamp(score, 20, 100);
}

function getFormatFitScore(
  player: DraftTargetScorePlayer,
  league: LeagueContext,
  rosterNeedScore: number,
  draftStage: DraftStage
) {
  const position = player.position;
  if (!position || !isPositionUsed(position, league)) return 0;

  let score = 45;

  if ((league.is_superflex || league.is_two_qb) && position === "QB") score += 22;
  if (league.is_best_ball && ["WR", "RB", "TE"].includes(position)) score += 10;
  if (league.te_premium > 0 && position === "TE") score += Math.min(18, league.te_premium * 10);
  if (position === "K") score += draftStage === "late" ? 12 : draftStage === "middle" ? -8 : -18;
  if (position === "DEF") score += draftStage === "late" ? 10 : draftStage === "middle" ? -6 : -16;
  if (DEFENSIVE_POSITIONS.includes(position as (typeof DEFENSIVE_POSITIONS)[number])) {
    score += getSharedDemand(position, buildStarterTargets(league.rosterPositions)) > 0 ? 10 : 6;
  }
  if (league.is_dynasty) score += player.dynasty_value ? 10 : 4;
  if (!league.is_dynasty && player.projected_points !== null) score += 6;
  score += (rosterNeedScore - 50) * 0.2;

  return clamp(score, 15, 100);
}

function getAdpValueScore(adp: number | null, currentPickNumber: number, rankingScore: number, valueScore: number) {
  if (adp === null || adp === undefined || !Number.isFinite(adp)) return 45;
  const delta = currentPickNumber - adp;
  if (delta >= 24) return 88;
  if (delta >= 12) return 74;
  if (delta >= 5) return 62;
  if (delta >= -4) return 50;
  if (delta >= -12) return rankingScore >= 78 || valueScore >= 74 ? 43 : 34;
  return rankingScore >= 82 || valueScore >= 80 ? 36 : 24;
}

function getMatchPenalty(matchStatus: string | null, matchConfidence: number | null, isFallback: boolean) {
  if (isFallback) return 22;
  if (!matchStatus || matchStatus === "exact_id" || matchStatus.startsWith("exact_name")) return 0;
  if (matchStatus === "fuzzy") {
    const confidencePenalty = matchConfidence === null || matchConfidence === undefined ? 12 : (1 - matchConfidence) * 24;
    return clamp(5 + confidencePenalty, 5, 20);
  }
  if (matchStatus === "ambiguous") return 22;
  if (matchStatus === "unmatched") return 32;
  return 8;
}

function buildReasons({
  player,
  league,
  draftStage,
  projectionScore,
  valueScore,
  rosterNeedScore,
  scarcityScore,
  formatFitScore,
  topNeeds,
  scarcity,
  recommendationTier
}: {
  player: DraftTargetScorePlayer;
  league: LeagueContext;
  draftStage: DraftStage;
  projectionScore: number;
  valueScore: number;
  rosterNeedScore: number;
  scarcityScore: number;
  formatFitScore: number;
  topNeeds: DraftTargetNeeds;
  scarcity: ScarcitySnapshot;
  recommendationTier: RecommendationTier;
}) {
  const reasons: string[] = [];
  const topNeed = topNeeds[0]?.position;

  if (player.rank !== null && player.rank <= 12) reasons.push("Top-12 remaining rank");
  else if (player.rank !== null && player.rank <= 24) reasons.push("Top-24 remaining rank");
  else if (player.rank !== null && LIMITED_DATA_POSITIONS.has(player.position ?? "") && player.rank <= 6) {
    reasons.push(`Top-ranked remaining ${labelForPosition(player.position)}`);
  }

  if (projectionScore >= 76 && !LIMITED_DATA_POSITIONS.has(player.position ?? "")) reasons.push("Strong projected points input");
  if (valueScore >= 76) reasons.push("Strong format-adjusted value");
  if (rosterNeedScore >= 70 && player.position) {
    reasons.push(`Fills urgent ${player.position} need`);
  } else if (topNeed && player.position === topNeed) {
    reasons.push(`Matches your top ${player.position} need`);
  }

  if (player.position === "K" && draftStage === "late") reasons.push("Late-draft roster fit");
  if (player.position === "DEF" && draftStage === "late") reasons.push("Late-draft roster fit");
  if (DEFENSIVE_POSITIONS.includes((player.position ?? "") as (typeof DEFENSIVE_POSITIONS)[number])) {
    const position = player.position ?? "";
    const directRequirement = getDirectRequirement(position, league);
    const currentCount = league.positionCounts[position] ?? 0;
    if (directRequirement > currentCount) {
      reasons.push("Direct defensive starter still unfilled");
    } else if (getSharedDemand(position, buildStarterTargets(league.rosterPositions)) > 0) {
      reasons.push("Fills an open IDP-flex need");
    }
  }

  if (player.position) {
    const scarcityReason = getScarcityReason(player.position, scarcity, league);
    if (scarcityScore >= 68 && scarcityReason) reasons.push(scarcityReason);
  }
  if (formatFitScore >= 72 && player.position) {
    const formatReason = getFormatReason(player.position, league);
    if (formatReason) reasons.push(formatReason);
  }
  if (player.adp !== null) {
    const adpReason = getAdpReason(player.adp, league.currentPickNumber);
    if (adpReason) reasons.push(adpReason);
  }
  if (recommendationTier === "elite_target") reasons.push("Elite value at current board");
  if (recommendationTier === "strong_target") reasons.push("Strong roster fit");
  if (recommendationTier === "depth_option" && draftStage === "late") reasons.push("Useful depth but not a priority");

  return Array.from(new Set(reasons)).slice(0, 4);
}

function buildWarnings(
  player: DraftTargetScorePlayer,
  hasProjectionData: boolean,
  league: LeagueContext,
  inputCompleteness: InputCompleteness,
  idpScoringDetected: boolean
) {
  const warnings: string[] = [];

  if (player.match_status === "ambiguous") warnings.push("Ambiguous player match");
  if (player.match_status === "unmatched") warnings.push("Unmatched ranking row");
  if (player.match_status === "fuzzy" && (player.match_confidence ?? 0) < 0.95) {
    warnings.push((player.match_confidence ?? 0) < 0.85 ? "Low-confidence player match" : "Fuzzy player match");
  }
  if (player.is_fallback) warnings.push("Fallback player pool item");
  if ((!hasProjectionData || player.projected_points === null || player.projected_points === undefined) && !LIMITED_DATA_POSITIONS.has(player.position ?? "")) {
    warnings.push("No projection value in current upload");
  }
  if (inputCompleteness === "rankings_only" && DEFENSIVE_POSITIONS.includes((player.position ?? "") as (typeof DEFENSIVE_POSITIONS)[number])) {
    warnings.push("Rankings-only defensive evaluation");
  }
  if (inputCompleteness === "rankings_only" && player.position === "K") warnings.push("No kicker projection inputs");
  if (inputCompleteness === "rankings_only" && player.position === "DEF") {
    warnings.push("No schedule or matchup data for DEF");
  }
  if (idpScoringDetected && DEFENSIVE_POSITIONS.includes((player.position ?? "") as (typeof DEFENSIVE_POSITIONS)[number])) {
    warnings.push("No league-specific IDP stat model yet");
  }
  if (!isPositionUsed(player.position ?? "", league)) warnings.push(`${player.position} is not used by this league.`);

  return warnings.slice(0, 3);
}

function getRecommendationTier(
  score: number,
  player: DraftTargetScorePlayer,
  warningCount: number,
  adpValueScore: number,
  league: LeagueContext,
  draftStage: DraftStage
): RecommendationTier {
  if (
    player.is_fallback ||
    player.match_status === "unmatched" ||
    player.match_status === "ambiguous" ||
    !isPositionUsed(player.position ?? "", league)
  ) {
    return "avoid_for_now";
  }

  if (player.position === "K") {
    if (draftStage === "late" && score >= 76 && warningCount <= 2) return "strong_target";
    if (score >= 58) return "good_value";
    if (score >= 44) return "depth_option";
    return "avoid_for_now";
  }

  if (player.position === "DEF") {
    if (draftStage === "late" && score >= 74 && warningCount <= 2) return "strong_target";
    if (score >= 56) return "good_value";
    if (score >= 42) return "depth_option";
    return "avoid_for_now";
  }

  if (score >= 84 && warningCount <= 1 && (player.rank ?? 999) <= 36) return "elite_target";
  if (score >= 74 && warningCount <= 2) return "strong_target";
  if (score >= 62 || adpValueScore >= 72) return "good_value";
  if (score >= 50) return "depth_option";
  return "avoid_for_now";
}

function normalizeScore(value: number | null | undefined, allValues: number[], fallback: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  if (allValues.length < 2) return 60;

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (min === max) return 60;

  return 15 + ((value - min) / (max - min)) * 85;
}

function metadata(
  draftStage: DraftStage,
  idpScoringDetected: boolean
): DraftTargetScoreResult["scoringMetadata"] {
  return {
    formulaVersion: "draft_target_score_v1.2" as const,
    generatedAt: new Date().toISOString(),
    draftStage,
    inputsUsed: [
      "uploaded_rankings",
      "available_ranked_players",
      "synced_draft_picks",
      "roster_construction",
      "league_format_flags",
      "adp",
      "value_fields",
      "match_confidence"
    ],
    limitations: [
      "No external projection provider, news feed, or injury feed.",
      "No AI explanation layer yet.",
      "IDP, K, and DEF recommendations currently use imported rankings, roster need, and scarcity.",
      "League-specific raw-stat scoring is not yet modeled.",
      "DEF schedule and matchup context are not included.",
      "K projections are not included.",
      "No pick survival or probability model yet.",
      "Recommendation quality depends on uploaded ranking data."
    ],
    weights: SCORE_WEIGHTS,
    supportedScoredPositions: [...SCORABLE_POSITIONS],
    positionScoringModes: ["offense_v1_1", "idp_rankings_v1", "kicker_rankings_v1", "defense_rankings_v1"],
    idpScoringDetected,
    rankingsOnlyPositions: ["DL", "LB", "DB", "K", "DEF"]
  };
}

function buildUnsupportedWarnings(player: DraftTargetScorePlayer, league: LeagueContext) {
  const warnings: string[] = [];
  if (player.is_fallback) warnings.push("Upload rankings for true recommendations.");
  if (player.position && !isPositionUsed(player.position, league)) warnings.push(`${player.position} is not used by this league.`);
  return warnings.slice(0, 3);
}

// TODO: Add defensive slot assignment using multi-position eligibility.
// TODO: Add IDP roster-need logic using league-specific fantasy point inputs once stats exist.
// TODO: Add IDP scarcity refinement using real stat/projection context.
// TODO: Add K and DEF recommendation logic using projections and schedule data.
// TODO: Add league-specific fantasy point calculations from player statistics.

function getDraftStage(currentPickNumber: number, positionCounts: Record<string, number>): DraftStage {
  const draftedCount = Math.max(0, Object.values(positionCounts).reduce((sum, count) => sum + count, 0));
  const currentWindow = Math.max(currentPickNumber, draftedCount + 1);
  if (currentWindow <= 48) return "early";
  if (currentWindow <= 120) return "middle";
  return "late";
}

function getOffensiveDemand(
  position: (typeof OFFENSIVE_POSITIONS)[number],
  starterTargets: StarterTargets,
  league: LeagueContext,
  draftStage: DraftStage
) {
  let demand = starterTargets.direct[position] ?? 0;

  if (position === "RB") demand += starterTargets.offensiveFlexCount * 0.55;
  if (position === "WR") demand += starterTargets.offensiveFlexCount * 0.45;
  if (position === "TE") demand += starterTargets.offensiveFlexCount * 0.2;

  if (position === "QB") demand += starterTargets.superFlexCount * 0.9;
  if (position === "RB") demand += starterTargets.superFlexCount * 0.05;
  if (position === "WR") demand += starterTargets.superFlexCount * 0.05;

  if (league.is_best_ball) {
    if (position === "WR") demand += draftStage === "late" ? 1.6 : 1;
    if (position === "RB") demand += draftStage === "late" ? 1.2 : 0.7;
    if (position === "TE") demand += 0.3;
  }

  if (league.te_premium > 0 && position === "TE") {
    demand += draftStage === "early" ? 0.45 : 0.25;
  }

  if ((league.is_superflex || league.is_two_qb) && position === "QB") {
    demand = Math.max(demand, draftStage === "late" ? 2.6 : 2.2);
  }

  return demand;
}

function getOffensiveDepthTarget(
  position: (typeof OFFENSIVE_POSITIONS)[number],
  starterTargets: StarterTargets,
  league: LeagueContext,
  draftStage: DraftStage
) {
  const starterDemand = getOffensiveDemand(position, starterTargets, league, draftStage);
  let depthTarget = starterDemand;

  if (position === "QB") depthTarget += league.is_superflex || league.is_two_qb ? 1.1 : 0.5;
  if (position === "RB") depthTarget += league.is_best_ball ? 2.2 : 1.4;
  if (position === "WR") depthTarget += league.is_best_ball ? 2.8 : 1.8;
  if (position === "TE") depthTarget += league.te_premium > 0 ? 1.2 : 0.7;
  if (draftStage === "late") depthTarget += position === "WR" || position === "RB" ? 0.8 : 0.4;

  return depthTarget;
}

function getScarcityReason(position: string, scarcity: ScarcitySnapshot, league: LeagueContext) {
  const top50 = scarcity.top50[position] ?? 0;
  const top100 = scarcity.top100[position] ?? 0;
  const starterTargets = buildStarterTargets(league.rosterPositions);

  if ((league.is_superflex || league.is_two_qb) && position === "QB" && top50 <= 9) return "QB tier is thinning";
  if (league.te_premium > 0 && position === "TE" && top50 <= 8) return "TE premium raises TE scarcity";
  if (position === "WR" && top100 >= 28) return "WR depth remains healthy";
  if (position === "RB" && top50 <= 12) return "RB pool is drying up";
  if (position === "DL" && top50 <= 8) return "DL tier is thinning";
  if (position === "LB" && top50 <= 8) return "Few ranked LB starters remain";
  if (position === "DB" && top100 >= 18) return "DB depth remains healthy";
  if (getSharedDemand(position, starterTargets) > 0 && DEFENSIVE_POSITIONS.includes(position as (typeof DEFENSIVE_POSITIONS)[number])) {
    return "Open IDP-flex demand";
  }
  if (top50 <= 6) return "Position tier is thinning";
  return null;
}

function getFormatReason(position: string, league: LeagueContext) {
  if ((league.is_superflex || league.is_two_qb) && position === "QB") return "Superflex format boosts QB value";
  if (league.te_premium > 0 && position === "TE") return "TE premium boosts position value";
  if (league.is_best_ball && position === "WR") return "Best ball format rewards spike-week depth";
  if (league.is_best_ball && position === "RB") return "Best ball format boosts RB depth";
  return null;
}

function getAdpReason(adp: number, currentPickNumber: number) {
  const delta = currentPickNumber - adp;
  if (delta >= 8) return `Falling ${Math.round(delta)} picks past ADP`;
  if (delta >= -4) return "Near expected draft range";
  if (delta < -10) return "Earlier than ADP; requires conviction";
  return null;
}

function getInputCompleteness(player: DraftTargetScorePlayer): InputCompleteness {
  if (player.is_fallback) return "fallback_only";
  if (player.projected_points !== null && selectAnyValueField(player) !== null) return "full";
  if (player.projected_points !== null || selectAnyValueField(player) !== null) return "partial";
  return "rankings_only";
}

function selectAnyValueField(player: DraftTargetScorePlayer) {
  return player.dynasty_value ?? player.best_ball_value ?? player.superflex_value ?? player.te_premium_value ?? null;
}

function getPositionScoringMode(position: string | null): PositionScoringMode {
  if (!position) return "unsupported";
  if (isOffensivePosition(position)) return "offense_v1_1";
  if (DEFENSIVE_POSITIONS.includes(position as (typeof DEFENSIVE_POSITIONS)[number])) return "idp_rankings_v1";
  if (position === "K") return "kicker_rankings_v1";
  if (position === "DEF") return "defense_rankings_v1";
  return "unsupported";
}

function getPositionAdjustment(
  position: string | null,
  league: LeagueContext,
  draftStage: DraftStage,
  rosterNeedScore: number,
  adpValueScore: number
) {
  if (!position || !isPositionUsed(position, league)) return -40;
  if (DEFENSIVE_POSITIONS.includes(position as (typeof DEFENSIVE_POSITIONS)[number])) {
    if (draftStage === "early") return -4;
    if (draftStage === "middle") return rosterNeedScore >= 70 ? 4 : 0;
    return rosterNeedScore >= 70 ? 7 : 2;
  }
  if (position === "K") {
    if (draftStage === "early") return -24;
    if (draftStage === "middle") return rosterNeedScore >= 70 && adpValueScore >= 62 ? -4 : -14;
    return rosterNeedScore >= 70 ? 4 : -6;
  }
  if (position === "DEF") {
    if (draftStage === "early") return -22;
    if (draftStage === "middle") return rosterNeedScore >= 70 && adpValueScore >= 62 ? -2 : -12;
    return rosterNeedScore >= 70 ? 3 : -6;
  }
  return 0;
}

function isOffensivePosition(position: string): position is (typeof OFFENSIVE_POSITIONS)[number] {
  return OFFENSIVE_POSITIONS.includes(position as (typeof OFFENSIVE_POSITIONS)[number]);
}

function isDefensivePosition(position: string): position is (typeof DEFENSIVE_POSITIONS)[number] {
  return DEFENSIVE_POSITIONS.includes(position as (typeof DEFENSIVE_POSITIONS)[number]);
}

function isScorablePosition(position: string): position is (typeof SCORABLE_POSITIONS)[number] {
  return SCORABLE_POSITIONS.includes(position as (typeof SCORABLE_POSITIONS)[number]);
}

function isPositionUsed(position: string, league: LeagueContext, starterTargets?: StarterTargets) {
  const targets = starterTargets ?? buildStarterTargets(league.rosterPositions);
  if (isOffensivePosition(position)) return true;
  if (position === "K") return targets.direct.K > 0;
  if (position === "DEF") return targets.direct.DEF > 0;
  if (isDefensivePosition(position)) {
    return targets.direct[position] > 0 || targets.idpFlexCount > 0;
  }
  return false;
}

function getDirectRequirement(position: string, league: LeagueContext) {
  const starterTargets = buildStarterTargets(league.rosterPositions);
  return starterTargets.direct[position as keyof typeof starterTargets.direct] ?? 0;
}

function getSharedDemand(position: string, starterTargets: StarterTargets) {
  if (position === "QB") return starterTargets.superFlexCount;
  if (position === "RB" || position === "WR" || position === "TE") {
    return starterTargets.offensiveFlexCount + starterTargets.superFlexCount;
  }
  if (position === "DL" || position === "LB" || position === "DB") {
    return starterTargets.idpFlexCount;
  }
  return 0;
}

function getMinimumNeed(position: string, starterTargets: StarterTargets) {
  const directStarterRequirement = starterTargets.direct[position as keyof typeof starterTargets.direct] ?? 0;
  const sharedFlexDemand = getSharedDemand(position, starterTargets);

  if (position === "QB") return directStarterRequirement + Math.min(sharedFlexDemand, 1);
  if (position === "RB" || position === "WR") return directStarterRequirement + (sharedFlexDemand > 0 ? 1 : 0);
  if (position === "TE") return directStarterRequirement + (sharedFlexDemand >= 2 ? 1 : 0);
  if (position === "DL" || position === "LB" || position === "DB") return directStarterRequirement + (sharedFlexDemand > 0 ? 1 : 0);
  return directStarterRequirement;
}

function scoreTopNeed(
  position: string,
  draftStage: DraftStage,
  deficit: number,
  directStarterRequirement: number,
  sharedFlexDemand: number
) {
  const stageModifier = draftStage === "early" ? 0.85 : draftStage === "middle" ? 1 : 1.15;
  return (directStarterRequirement * 50 + sharedFlexDemand * 20 + deficit * 40) * stageModifier;
}

function deriveNeedLevel(
  position: string,
  draftStage: DraftStage,
  current: number,
  directStarterRequirement: number,
  sharedFlexDemand: number
): "urgent" | "high" | "moderate" | "low" | "filled" | "not_used" {
  if (directStarterRequirement === 0 && sharedFlexDemand === 0) return "not_used";
  if (position === "QB" && sharedFlexDemand > 0) {
    if (current === 0) return "urgent";
    if (current === 1) return "high";
  }
  if (current < directStarterRequirement - 1) return "urgent";
  if (current < directStarterRequirement) return "high";
  if (sharedFlexDemand > 0 && current < directStarterRequirement + 1) return draftStage === "late" ? "high" : "moderate";
  if (sharedFlexDemand > 0) return "low";
  return "filled";
}

function normalizeRosterSlot(slot: string) {
  return slot.trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizeRosterSlotToPosition(slot: string): (typeof SCORABLE_POSITIONS)[number] | null {
  if (["DST", "D/ST"].includes(slot)) return "DEF";
  if (["DE", "DT", "EDGE"].includes(slot)) return "DL";
  if (["ILB", "OLB", "MLB"].includes(slot)) return "LB";
  if (["CB", "S", "FS", "SS"].includes(slot)) return "DB";
  return isScorablePosition(slot) ? slot : null;
}

function detectIdpScoring(scoringSettings?: Record<string, number> | null) {
  const keys = Object.keys(scoringSettings ?? {}).map((key) => key.toLowerCase());
  return keys.some((key) =>
    ["tkl", "ast", "ff", "fr", "pd", "qb_hit", "tfl", "sack", "safe", "blk_kick"].some((marker) => key.includes(marker))
  );
}

function labelForPosition(position: string | null) {
  if (position === "DEF") return "defense";
  if (position === "K") return "kicker";
  return position ?? "player";
}

function sortByScoreThenRank(a: ScoredDraftTarget, b: ScoredDraftTarget) {
  const scoreA = a.draftTargetScore ?? -1;
  const scoreB = b.draftTargetScore ?? -1;
  if (scoreB !== scoreA) return scoreB - scoreA;
  return (a.rank ?? 99999) - (b.rank ?? 99999);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
