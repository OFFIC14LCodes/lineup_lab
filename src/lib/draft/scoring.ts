export type RecommendationTier =
  | "elite_target"
  | "strong_target"
  | "good_value"
  | "depth_option"
  | "avoid_for_now";

export type DraftStage = "early" | "middle" | "late";

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
};

export type ScoredDraftTarget = DraftTargetScorePlayer & {
  draftTargetScore: number | null;
  recommendationTier: RecommendationTier;
  scoreComponents: DraftTargetScoreComponents | null;
  reasons: string[];
  warnings: string[];
};

export type DraftTargetNeeds = Array<{ position: string; current: number; target: number; need: number }>;

export type DraftTargetScoreResult = {
  scoredPlayers: ScoredDraftTarget[];
  recommendations: ScoredDraftTarget[];
  topNeeds: DraftTargetNeeds;
  scoringMetadata: {
    formulaVersion: "draft_target_score_v1.1";
    generatedAt: string;
    draftStage: DraftStage;
    inputsUsed: string[];
    limitations: string[];
    weights: typeof SCORE_WEIGHTS;
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

const FLEX_POSITIONS = new Set(["FLEX", "WRRB_FLEX", "WRRB", "RB_WR", "REC_FLEX", "WRTE_FLEX", "WRT_FLEX"]);
const SUPER_FLEX_POSITIONS = new Set(["SUPER_FLEX", "OP"]);
const REC_FLEX_POSITIONS = new Set(["REC_FLEX", "WRTE_FLEX"]);
const BENCH_POSITIONS = new Set(["BN", "IR", "TAXI", "TAXI_SQUAD"]);
const POSITION_SET = ["QB", "RB", "WR", "TE"] as const;

type StarterTargets = {
  base: Record<string, number>;
  flex: number;
  recFlex: number;
  superFlex: number;
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
  const starterTargets = buildStarterTargets(league.rosterPositions, league);
  const topNeeds = buildTopNeeds(starterTargets, league.positionCounts, league, draftStage);

  if (rankedPlayers.length === 0) {
    return {
      scoredPlayers: players.map((player) => ({
        ...player,
        draftTargetScore: null,
        recommendationTier: "avoid_for_now",
        scoreComponents: null,
        reasons: [],
        warnings: player.is_fallback ? ["Upload rankings for true recommendations."] : []
      })),
      recommendations: [],
      topNeeds,
      scoringMetadata: metadata(draftStage)
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
    .map((player) =>
      player.is_ranked && !player.is_fallback
        ? scoreRankedPlayer({
            player,
            league,
            draftStage,
            starterTargets,
            topNeeds,
            rankedValues,
            projectedValues,
            scarcity
          })
        : {
            ...player,
            draftTargetScore: null,
            recommendationTier: "avoid_for_now" as const,
            scoreComponents: null,
            reasons: [],
            warnings: ["Upload rankings for true recommendations."]
          }
    )
    .sort(sortByScoreThenRank);

  const eligibleRecommendations = scoredPlayers.filter(
    (player) =>
      player.draftTargetScore !== null &&
      player.recommendationTier !== "avoid_for_now" &&
      player.match_status !== "unmatched" &&
      player.match_status !== "ambiguous"
  );
  const fallbackRecommendations = scoredPlayers.filter((player) => player.draftTargetScore !== null);
  const recommendations = (eligibleRecommendations.length >= 5 ? eligibleRecommendations : fallbackRecommendations).slice(0, 10);

  return {
    scoredPlayers,
    recommendations,
    topNeeds,
    scoringMetadata: metadata(draftStage)
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
  scarcity
}: {
  player: DraftTargetScorePlayer;
  league: LeagueContext;
  draftStage: DraftStage;
  starterTargets: StarterTargets;
  topNeeds: DraftTargetNeeds;
  rankedValues: number[];
  projectedValues: number[];
  scarcity: ScarcitySnapshot;
}): ScoredDraftTarget {
  const rankingScore = getRankingScore(player.rank);
  const projectionScore = normalizeScore(player.projected_points, projectedValues, 45);
  const valueScore = getValueScore(player, league, rankedValues, rankingScore);
  const rosterNeedScore = getRosterNeedScore(player.position, league.positionCounts, starterTargets, league, draftStage);
  const scarcityScore = getScarcityScore(player.position, scarcity, league, draftStage);
  const formatFitScore = getFormatFitScore(player, league, rosterNeedScore);
  const adpValueScore = getAdpValueScore(player.adp, league.currentPickNumber, rankingScore, valueScore);
  const matchConfidencePenalty = getMatchPenalty(player.match_status, player.match_confidence, player.is_fallback);

  const weightedScore =
    rankingScore * SCORE_WEIGHTS.ranking +
    projectionScore * SCORE_WEIGHTS.projection +
    valueScore * SCORE_WEIGHTS.value +
    rosterNeedScore * SCORE_WEIGHTS.rosterNeed +
    scarcityScore * SCORE_WEIGHTS.scarcity +
    formatFitScore * SCORE_WEIGHTS.formatFit +
    adpValueScore * SCORE_WEIGHTS.adpValue -
    matchConfidencePenalty;

  const draftTargetScore = clamp(weightedScore, 0, 100);
  const warnings = buildWarnings(player, projectedValues.length > 0);
  const recommendationTier = getRecommendationTier(draftTargetScore, player, warnings.length, adpValueScore);
  const reasons = buildReasons({
    player,
    draftStage,
    league,
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
    warnings
  };
}

function buildStarterTargets(rosterPositions: string[] | null | undefined, league: LeagueContext): StarterTargets {
  const base: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };
  const positions = Array.isArray(rosterPositions) ? rosterPositions : [];

  if (positions.length === 0) {
    if (league.is_superflex || league.is_two_qb) base.QB = 2;
    return { base, flex: 0, recFlex: 0, superFlex: league.is_superflex || league.is_two_qb ? 1 : 0 };
  }

  base.QB = 0;
  base.RB = 0;
  base.WR = 0;
  base.TE = 0;

  let flexCount = 0;
  let recFlexCount = 0;
  let superFlexCount = 0;

  for (const slot of positions) {
    if (BENCH_POSITIONS.has(slot)) continue;
    if (slot === "QB") base.QB += 1;
    else if (slot === "RB") base.RB += 1;
    else if (slot === "WR") base.WR += 1;
    else if (slot === "TE") base.TE += 1;
    else if (slot === "K" || slot === "DEF" || slot === "DL" || slot === "LB" || slot === "DB" || slot === "IDP") continue;
    else if (FLEX_POSITIONS.has(slot)) flexCount += 1;
    else if (REC_FLEX_POSITIONS.has(slot)) recFlexCount += 1;
    else if (SUPER_FLEX_POSITIONS.has(slot)) superFlexCount += 1;
  }

  if (league.is_superflex || league.is_two_qb) {
    base.QB = Math.max(base.QB, 2);
  }

  return { base, flex: flexCount, recFlex: recFlexCount, superFlex: superFlexCount };
}

function buildTopNeeds(
  starterTargets: StarterTargets,
  counts: Record<string, number>,
  league: LeagueContext,
  draftStage: DraftStage
): DraftTargetNeeds {
  return POSITION_SET
    .map((position) => {
      const target = round(getPositionDemand(position, starterTargets, league, draftStage));
      const current = counts[position] ?? 0;
      return {
        position,
        current,
        target,
        need: round(clamp((target - current) / Math.max(target, 1), 0, 1) * 100)
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

function getValueScore(player: DraftTargetScorePlayer, league: LeagueContext, values: number[], rankingScore: number) {
  const preferredValue = selectValueField(player, league);
  if (preferredValue !== null && values.length > 1) {
    return normalizeScore(preferredValue, values, 50);
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

  return (
    player.dynasty_value ??
    player.best_ball_value ??
    player.superflex_value ??
    player.te_premium_value ??
    null
  );
}

function getRosterNeedScore(
  position: string | null,
  counts: Record<string, number>,
  starterTargets: StarterTargets,
  league: LeagueContext,
  draftStage: DraftStage
) {
  if (!position) return 20;
  if (!isPrimaryPosition(position)) return 20;

  const current = counts[position] ?? 0;
  const starterDemand = getPositionDemand(position, starterTargets, league, draftStage);
  const baseStarters = starterTargets.base[position] ?? 0;
  const starterDeficit = clamp((baseStarters - current) / Math.max(baseStarters, 1), 0, 1);
  const totalDeficit = clamp((starterDemand - current) / Math.max(starterDemand, 1), 0, 1);
  const depthTarget = getDepthTarget(position, starterTargets, league, draftStage);
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

function getScarcityScore(
  position: string | null,
  scarcity: ScarcitySnapshot,
  league: LeagueContext,
  draftStage: DraftStage
) {
  if (!position) return 35;

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

  return clamp(score, 20, 100);
}

function getFormatFitScore(player: DraftTargetScorePlayer, league: LeagueContext, rosterNeedScore: number) {
  const position = player.position;
  let score = 45;

  if ((league.is_superflex || league.is_two_qb) && position === "QB") score += 22;
  if (league.is_best_ball && ["WR", "RB", "TE"].includes(position ?? "")) score += 10;
  if (league.te_premium > 0 && position === "TE") score += Math.min(18, league.te_premium * 10);
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
  draftStage,
  league,
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
  draftStage: DraftStage;
  league: LeagueContext;
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
  if (projectionScore >= 76) reasons.push("Strong projected points input");
  if (valueScore >= 76) reasons.push("Strong format-adjusted value");
  if (rosterNeedScore >= 70 && player.position) {
    reasons.push(`Fills urgent ${player.position} need`);
  } else if (topNeed && player.position === topNeed) {
    reasons.push(`Matches your top ${player.position} need`);
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

function buildWarnings(player: DraftTargetScorePlayer, hasProjectionData: boolean) {
  const warnings: string[] = [];
  if (player.match_status === "ambiguous") warnings.push("Ambiguous player match");
  if (player.match_status === "unmatched") warnings.push("Unmatched ranking row");
  if (player.match_status === "fuzzy" && (player.match_confidence ?? 0) < 0.95) {
    warnings.push((player.match_confidence ?? 0) < 0.85 ? "Low-confidence player match" : "Fuzzy player match");
  }
  if (player.is_fallback) {
    warnings.push("Fallback player pool item");
  }
  if (!hasProjectionData || player.projected_points === null || player.projected_points === undefined) {
    warnings.push("No projection value in current upload");
  }
  return warnings.slice(0, 3);
}

function getRecommendationTier(
  score: number,
  player: DraftTargetScorePlayer,
  warningCount: number,
  adpValueScore: number
): RecommendationTier {
  if (player.is_fallback || player.match_status === "unmatched" || player.match_status === "ambiguous") {
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

function metadata(draftStage: DraftStage) {
  return {
    formulaVersion: "draft_target_score_v1.1" as const,
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
      "No pick survival or probability model yet.",
      "Recommendation quality depends on uploaded ranking data."
    ],
    weights: SCORE_WEIGHTS
  };
}

function getDraftStage(currentPickNumber: number, positionCounts: Record<string, number>): DraftStage {
  const draftedCount = Math.max(0, Object.values(positionCounts).reduce((sum, count) => sum + count, 0));
  const currentWindow = Math.max(currentPickNumber, draftedCount + 1);
  if (currentWindow <= 48) return "early";
  if (currentWindow <= 120) return "middle";
  return "late";
}

function getPositionDemand(
  position: (typeof POSITION_SET)[number],
  starterTargets: StarterTargets,
  league: LeagueContext,
  draftStage: DraftStage
) {
  let demand = starterTargets.base[position] ?? 0;

  if (position === "RB") demand += starterTargets.flex * 0.55;
  if (position === "WR") demand += starterTargets.flex * 0.45;

  if (position === "WR") demand += starterTargets.recFlex * 0.65;
  if (position === "TE") demand += starterTargets.recFlex * 0.2;
  if (position === "RB") demand += starterTargets.recFlex * 0.15;

  if (position === "QB") demand += starterTargets.superFlex * 0.9;
  if (position === "RB") demand += starterTargets.superFlex * 0.05;
  if (position === "WR") demand += starterTargets.superFlex * 0.05;

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

function getDepthTarget(
  position: string,
  starterTargets: StarterTargets,
  league: LeagueContext,
  draftStage: DraftStage
) {
  const normalizedPosition = isPrimaryPosition(position) ? position : "WR";
  const starterDemand = getPositionDemand(normalizedPosition, starterTargets, league, draftStage);
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

  if ((league.is_superflex || league.is_two_qb) && position === "QB" && top50 <= 9) return "QB tier is thinning";
  if (league.te_premium > 0 && position === "TE" && top50 <= 8) return "TE premium raises TE scarcity";
  if (position === "WR" && top100 >= 28) return "WR depth remains healthy";
  if (position === "RB" && top50 <= 12) return "RB pool is drying up";
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

function isPrimaryPosition(position: string): position is (typeof POSITION_SET)[number] {
  return POSITION_SET.includes(position as (typeof POSITION_SET)[number]);
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
