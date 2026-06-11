export type RecommendationTier =
  | "elite_target"
  | "strong_target"
  | "good_value"
  | "depth_option"
  | "avoid_for_now";

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
    formulaVersion: "draft_target_score_v1";
    generatedAt: string;
    inputsUsed: string[];
    limitations: string[];
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

export function buildDraftTargetScore({
  players,
  league
}: {
  players: DraftTargetScorePlayer[];
  league: LeagueContext;
}): DraftTargetScoreResult {
  const rankedPlayers = players.filter((player) => player.is_ranked && !player.is_fallback);
  const targets = buildRosterTargets(league.rosterPositions, league);
  const topNeeds = buildTopNeeds(targets, league.positionCounts);

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
      scoringMetadata: metadata()
    };
  }

  const rankedValues = rankedPlayers
    .map((player) => selectValueField(player, league))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const projectedValues = rankedPlayers
    .map((player) => player.projected_points)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const positionalDepth = countTopPositionDepth(rankedPlayers, 60);
  const strongPositionalDepth = countTopPositionDepth(rankedPlayers, 24);

  const scoredPlayers = players
    .map((player) =>
      player.is_ranked && !player.is_fallback
        ? scoreRankedPlayer({
            player,
            league,
            targets,
            topNeeds,
            rankedValues,
            projectedValues,
            positionalDepth,
            strongPositionalDepth
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
    scoringMetadata: metadata()
  };
}

function scoreRankedPlayer({
  player,
  league,
  targets,
  topNeeds,
  rankedValues,
  projectedValues,
  positionalDepth,
  strongPositionalDepth
}: {
  player: DraftTargetScorePlayer;
  league: LeagueContext;
  targets: Record<string, number>;
  topNeeds: DraftTargetNeeds;
  rankedValues: number[];
  projectedValues: number[];
  positionalDepth: Record<string, number>;
  strongPositionalDepth: Record<string, number>;
}): ScoredDraftTarget {
  const rankingScore = getRankingScore(player.rank);
  const projectionScore = normalizeScore(player.projected_points, projectedValues, 45);
  const valueScore = getValueScore(player, league, rankedValues, rankingScore);
  const rosterNeedScore = getRosterNeedScore(player.position, league.positionCounts, targets, league);
  const scarcityScore = getScarcityScore(player.position, positionalDepth, strongPositionalDepth, league);
  const formatFitScore = getFormatFitScore(player, league, rosterNeedScore);
  const adpValueScore = getAdpValueScore(player.adp, league.currentPickNumber);
  const matchConfidencePenalty = getMatchPenalty(player.match_status, player.match_confidence);

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
  const recommendationTier = getRecommendationTier(draftTargetScore, player.match_status);
  const reasons = buildReasons({
    player,
    rankingScore,
    projectionScore,
    valueScore,
    rosterNeedScore,
    scarcityScore,
    formatFitScore,
    adpValueScore,
    topNeeds
  });
  const warnings = buildWarnings(player, projectedValues.length > 0);

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

function buildRosterTargets(rosterPositions: string[] | null | undefined, league: LeagueContext) {
  const targets: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };
  const positions = Array.isArray(rosterPositions) ? rosterPositions : [];

  if (positions.length === 0) {
    if (league.is_superflex || league.is_two_qb) targets.QB = 2;
    if (league.te_premium > 0) targets.TE = Math.max(targets.TE, 1);
    return targets;
  }

  targets.QB = 0;
  targets.RB = 0;
  targets.WR = 0;
  targets.TE = 0;

  let flexCount = 0;
  let recFlexCount = 0;
  let superFlexCount = 0;

  for (const slot of positions) {
    if (slot === "BN" || slot === "IR" || slot === "TAXI" || slot === "TAXI_SQUAD") continue;
    if (slot === "QB") targets.QB += 1;
    else if (slot === "RB") targets.RB += 1;
    else if (slot === "WR") targets.WR += 1;
    else if (slot === "TE") targets.TE += 1;
    else if (FLEX_POSITIONS.has(slot)) flexCount += 1;
    else if (REC_FLEX_POSITIONS.has(slot)) recFlexCount += 1;
    else if (SUPER_FLEX_POSITIONS.has(slot)) superFlexCount += 1;
  }

  targets.RB += flexCount * 0.5;
  targets.WR += flexCount * 0.5;
  targets.WR += recFlexCount * 0.55;
  targets.TE += recFlexCount * 0.25;
  targets.QB += superFlexCount * 0.8;
  targets.RB += superFlexCount * 0.1;
  targets.WR += superFlexCount * 0.1;

  if (league.is_superflex || league.is_two_qb) {
    targets.QB = Math.max(targets.QB, 2);
  }
  if (league.te_premium > 0) {
    targets.TE += Math.min(0.5, league.te_premium * 0.15);
  }

  return targets;
}

function buildTopNeeds(targets: Record<string, number>, counts: Record<string, number>): DraftTargetNeeds {
  return (["QB", "RB", "WR", "TE"] as const)
    .map((position) => {
      const target = round(targets[position] ?? 0);
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
  targets: Record<string, number>,
  league: LeagueContext
) {
  if (!position) return 20;

  const target = targets[position] ?? 0;
  const current = counts[position] ?? 0;
  const deficitRatio = clamp((target - current) / Math.max(target, 1), 0, 1);

  let score = 35 + deficitRatio * 55;
  if ((league.is_superflex || league.is_two_qb) && position === "QB") score += current === 0 ? 12 : current === 1 ? 8 : 0;
  if (league.te_premium > 0 && position === "TE") score += Math.min(12, league.te_premium * 6);

  return clamp(score, 15, 100);
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
  positionalDepth: Record<string, number>,
  strongPositionalDepth: Record<string, number>,
  league: LeagueContext
) {
  if (!position) return 35;

  const topCount = positionalDepth[position] ?? 0;
  const strongCount = strongPositionalDepth[position] ?? 0;
  let score =
    strongCount <= 2 ? 88 : strongCount <= 4 ? 76 : strongCount <= 7 ? 64 : topCount <= 10 ? 54 : 40;

  if ((league.is_superflex || league.is_two_qb) && position === "QB") score += 10;
  if (league.te_premium > 0 && position === "TE") score += Math.min(12, league.te_premium * 8);

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

function getAdpValueScore(adp: number | null, currentPickNumber: number) {
  if (adp === null || adp === undefined || !Number.isFinite(adp)) return 45;
  const delta = currentPickNumber - adp;
  if (delta >= 30) return 95;
  if (delta >= 18) return 82;
  if (delta >= 8) return 68;
  if (delta >= -5) return 52;
  if (delta >= -15) return 38;
  return 25;
}

function getMatchPenalty(matchStatus: string | null, matchConfidence: number | null) {
  if (!matchStatus || matchStatus === "exact_id" || matchStatus.startsWith("exact_name")) return 0;
  if (matchStatus === "fuzzy") {
    const confidencePenalty = matchConfidence === null || matchConfidence === undefined ? 10 : (1 - matchConfidence) * 18;
    return clamp(4 + confidencePenalty, 4, 16);
  }
  if (matchStatus === "ambiguous") return 18;
  if (matchStatus === "unmatched") return 25;
  return 8;
}

function buildReasons({
  player,
  rankingScore,
  projectionScore,
  valueScore,
  rosterNeedScore,
  scarcityScore,
  formatFitScore,
  adpValueScore,
  topNeeds
}: {
  player: DraftTargetScorePlayer;
  rankingScore: number;
  projectionScore: number;
  valueScore: number;
  rosterNeedScore: number;
  scarcityScore: number;
  formatFitScore: number;
  adpValueScore: number;
  topNeeds: DraftTargetNeeds;
}) {
  const reasons: string[] = [];
  const topNeed = topNeeds[0]?.position;

  if (rankingScore >= 80) reasons.push("Strong ranking position on the remaining board");
  if (projectionScore >= 70) reasons.push("Projection is near the top of the available pool");
  if (valueScore >= 70) reasons.push("Format-adjusted value field is strong");
  if (rosterNeedScore >= 70 && player.position) {
    reasons.push(`${player.position} fits current roster need`);
  } else if (topNeed && player.position === topNeed) {
    reasons.push(`${player.position} aligns with your highest roster need`);
  }
  if (scarcityScore >= 70 && player.position) reasons.push(`${player.position} tier is thinning`);
  if (formatFitScore >= 70 && player.position) reasons.push(`League format boosts ${player.position} value`);
  if (adpValueScore >= 70) reasons.push("ADP suggests value at this pick");

  return reasons.slice(0, 4);
}

function buildWarnings(player: DraftTargetScorePlayer, hasProjectionData: boolean) {
  const warnings: string[] = [];
  if (player.match_status === "ambiguous") warnings.push("Ranking row is ambiguous and should be reviewed.");
  if (player.match_status === "unmatched") warnings.push("Ranking row is unmatched and may not clear automatically.");
  if (player.match_status === "fuzzy" && (player.match_confidence ?? 0) < 0.95) {
    warnings.push("Player match is fuzzy and carries some risk.");
  }
  if (!hasProjectionData || player.projected_points === null || player.projected_points === undefined) {
    warnings.push("No projection value available in current upload.");
  }
  return warnings.slice(0, 3);
}

function getRecommendationTier(score: number, matchStatus: string | null): RecommendationTier {
  if (matchStatus === "unmatched") return "avoid_for_now";
  if (score >= 82) return "elite_target";
  if (score >= 72) return "strong_target";
  if (score >= 62) return "good_value";
  if (score >= 48) return "depth_option";
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

function metadata() {
  return {
    formulaVersion: "draft_target_score_v1" as const,
    generatedAt: new Date().toISOString(),
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
    ]
  };
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
