import {
  classifySideOfBall,
  normalizePlayerName,
  normalizePosition,
  normalizePositionGroup,
  normalizeTeam
} from "@/lib/players/normalize";

export type MatchablePlayer = {
  id: string;
  sleeper_player_id: string | null;
  full_name: string | null;
  normalized_name: string | null;
  position: string | null;
  primary_position?: string | null;
  position_group?: string | null;
  side_of_ball?: string | null;
  team: string | null;
};

export type RankingMatchInput = {
  sleeper_player_id?: string | null;
  player_name: string;
  position?: string | null;
  team?: string | null;
};

export type PlayerMatchResult = {
  matched_player_id: string | null;
  sleeper_player_id: string | null;
  match_status:
    | "exact_id"
    | "exact_name_position_team"
    | "exact_name_position"
    | "exact_name_team"
    | "exact_name"
    | "fuzzy"
    | "ambiguous"
    | "unmatched";
  match_confidence: number;
  candidate_count: number;
  candidates: Array<Pick<MatchablePlayer, "id" | "sleeper_player_id" | "full_name" | "position" | "team">>;
};

export function matchRankingRowToPlayer(row: RankingMatchInput, players: MatchablePlayer[]): PlayerMatchResult {
  const normalizedName = normalizePlayerName(row.player_name);
  const position = normalizePosition(row.position);
  const positionGroup = normalizePositionGroup(row.position);
  const sideOfBall = classifySideOfBall(row.position);
  const team = normalizeTeam(row.team);

  if (row.sleeper_player_id) {
    const exact = players.find((player) => player.sleeper_player_id === row.sleeper_player_id);
    if (exact) return result("exact_id", 1, [exact]);
  }

  const byName = players.filter((player) => {
    if (player.normalized_name !== normalizedName) return false;
    if (!sideOfBall) return true;
    return getPlayerSideOfBall(player) === sideOfBall;
  });
  const matchers: Array<[PlayerMatchResult["match_status"], (player: MatchablePlayer) => boolean, number]> = [
    [
      "exact_name_position_team",
      (player) => matchesPosition(player, position, positionGroup) && player.team === team,
      0.98
    ],
    ["exact_name_position", (player) => matchesPosition(player, position, positionGroup), 0.93],
    ["exact_name_team", (player) => player.team === team, 0.9],
    ["exact_name", () => true, 0.82]
  ];

  for (const [status, predicate, confidence] of matchers) {
    const candidates = byName.filter(predicate);
    if (candidates.length === 1) return result(status, confidence, candidates);
    if (candidates.length > 1) return result("ambiguous", 0.45, candidates);
  }

  const fuzzyCandidates = players
    .map((player) => ({ player, score: similarity(normalizedName, player.normalized_name ?? "") }))
    .filter(({ score, player }) => {
      if (score < 0.92) return false;
      if (sideOfBall && getPlayerSideOfBall(player) !== sideOfBall) return false;
      if (positionGroup && !matchesPosition(player, position, positionGroup)) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  if (fuzzyCandidates.length === 1) {
    return result("fuzzy", fuzzyCandidates[0].score, [fuzzyCandidates[0].player]);
  }

  if (fuzzyCandidates.length > 1) {
    const [best, second] = fuzzyCandidates;
    if (best.score >= 0.96 && best.score - second.score >= 0.04) {
      return result("fuzzy", best.score, [best.player]);
    }
    return result("ambiguous", best.score, fuzzyCandidates.map((candidate) => candidate.player));
  }

  return result("unmatched", 0, []);
}

function matchesPosition(
  player: MatchablePlayer,
  position: string | null,
  positionGroup: string | null
) {
  const playerPrimary = player.primary_position ?? player.position ?? null;
  const playerGroup = player.position_group ?? normalizePositionGroup(playerPrimary) ?? null;

  if (position && playerPrimary === position) return true;
  if (positionGroup && playerGroup === positionGroup) return true;
  return !position && !positionGroup;
}

function getPlayerSideOfBall(player: MatchablePlayer) {
  return player.side_of_ball ?? classifySideOfBall(player.primary_position ?? player.position);
}

function result(
  match_status: PlayerMatchResult["match_status"],
  match_confidence: number,
  candidates: MatchablePlayer[]
): PlayerMatchResult {
  const matched = candidates.length === 1 && match_status !== "ambiguous" ? candidates[0] : null;
  return {
    matched_player_id: matched?.id ?? null,
    sleeper_player_id: matched?.sleeper_player_id ?? null,
    match_status,
    match_confidence,
    candidate_count: candidates.length,
    candidates: candidates.slice(0, 5).map((player) => ({
      id: player.id,
      sleeper_player_id: player.sleeper_player_id,
      full_name: player.full_name,
      position: player.position,
      team: player.team
    }))
  };
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}
