import { parsePbpFlag, parsePbpNumeric, parsePbpString } from "@/lib/providers/nflverse/pbp/schema";
import type { NflversePbpRaw } from "@/lib/providers/nflverse/pbp/schema";
import { selectPointsAllowedBucket, selectYardsAllowedBucket } from "@/lib/scoring/team-defense-allowance";

export type DstScoringEventClassification =
  | "charged_to_dst"
  | "excluded_from_dst"
  | "conversion_always_charged"
  | "unresolved_edge_case";

export type DstScoringEventType =
  | "offensive_touchdown"
  | "field_goal"
  | "extra_point"
  | "two_point_conversion"
  | "pick_six_touchdown"
  | "kickoff_return_touchdown"
  | "punt_return_touchdown"
  | "blocked_punt_return_touchdown"
  | "safety"
  | "defensive_fumble_return_td"
  | "offensive_fumble_recovery_td"
  | "blocked_field_goal_return_td"
  | "blocked_extra_point_return"
  | "defensive_two_point_return"
  | "loose_ball_return_td"
  | "interception_lateral_return_td"
  | "special_teams_misc_return_td"
  | "possession_change_misc_td"
  | "structurally_unclassifiable";

export type DstScoringEvent = {
  gameId: string;
  playId: string;
  week: number;
  scoringTeam: string | null;
  chargedTeam: string | null;
  points: number;
  type: DstScoringEventType;
  classification: DstScoringEventClassification;
  reason: string;
  description: string;
};

export type DstAllowanceTeamResult = {
  gameId: string;
  week: number;
  teamId: string;
  opponentTeamId: string;
  opponentFinalScore: number;
  dstPointsAllowed: number;
  excludedNonDstTouchdownPoints: number;
  unresolvedPoints: number;
  baseDstYardsAllowed: number | null;
  specialTeamsReturnYardsAllowed: number;
  effectiveDstYardsAllowed: number | null;
  storedYardsAllowed: number | null;
  yardsAllowedDifference: number | null;
  pointsBucket: string;
  yardsBucket: string | null;
  reconciliationStatus: "verified" | "unresolved";
};

export type DstAllowanceDerivationReport = {
  teamResults: DstAllowanceTeamResult[];
  events: DstScoringEvent[];
  unresolvedEvents: DstScoringEvent[];
  coverage: {
    totalEvents: number;
    chargedEvents: number;
    excludedEvents: number;
    conversionAlwaysChargedEvents: number;
    unresolvedEvents: number;
    teamRows: number;
    verifiedTeamRows: number;
    unresolvedTeamRows: number;
    finalScoreReconciliationFailures: number;
    exactYardMatchesAgainstStored: number;
    yardMismatchesAgainstStored: number;
  };
};

export type DstAllowanceGameInput = {
  gameId: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeYardsAllowedStored: number | null;
  awayYardsAllowedStored: number | null;
};

type LeagueReturnYardPolicy = {
  includeSpecialTeamsReturnYards: boolean;
};

export function deriveDstAllowanceForGames(
  games: DstAllowanceGameInput[],
  plays: NflversePbpRaw[],
  policy: LeagueReturnYardPolicy = { includeSpecialTeamsReturnYards: false }
): DstAllowanceDerivationReport {
  const gamesById = new Map(games.map((game) => [game.gameId, game]));
  const events = plays
    .map(classifyDstScoringEvent)
    .filter((event): event is DstScoringEvent => Boolean(event && gamesById.has(event.gameId)));
  const eventsByChargedTeamGame = new Map<string, DstScoringEvent[]>();

  for (const event of events) {
    if (!event.chargedTeam) continue;
    const key = `${event.gameId}|${event.chargedTeam}`;
    eventsByChargedTeamGame.set(key, [...(eventsByChargedTeamGame.get(key) ?? []), event]);
  }

  const baseYards = deriveOfficialNetYards(plays);
  const returnYardsAllowed = deriveSpecialTeamsReturnYardsAllowed(plays);
  const teamResults: DstAllowanceTeamResult[] = [];
  let finalScoreReconciliationFailures = 0;
  let exactYardMatchesAgainstStored = 0;
  let yardMismatchesAgainstStored = 0;

  for (const game of games) {
    for (const side of [
      { teamId: game.homeTeamId, opponentTeamId: game.awayTeamId, opponentFinalScore: game.awayScore, storedYardsAllowed: game.homeYardsAllowedStored },
      { teamId: game.awayTeamId, opponentTeamId: game.homeTeamId, opponentFinalScore: game.homeScore, storedYardsAllowed: game.awayYardsAllowedStored },
    ]) {
      const teamEvents = eventsByChargedTeamGame.get(`${game.gameId}|${side.teamId}`) ?? [];
      const dstPointsAllowed = sumPoints(teamEvents, ["charged_to_dst", "conversion_always_charged"]);
      const excludedNonDstTouchdownPoints = sumPoints(teamEvents, ["excluded_from_dst"]);
      const unresolvedPoints = sumPoints(teamEvents, ["unresolved_edge_case"]);
      const reconciles = dstPointsAllowed + excludedNonDstTouchdownPoints + unresolvedPoints === side.opponentFinalScore;
      if (!reconciles) finalScoreReconciliationFailures += 1;

      const opponentBaseYards = baseYards.get(`${game.gameId}|${side.opponentTeamId}`) ?? null;
      const specialTeamsReturnYards = returnYardsAllowed.get(`${game.gameId}|${side.teamId}`) ?? 0;
      const effectiveYards = opponentBaseYards === null
        ? null
        : opponentBaseYards + (policy.includeSpecialTeamsReturnYards ? specialTeamsReturnYards : 0);
      const yardsDifference = side.storedYardsAllowed !== null && effectiveYards !== null
        ? effectiveYards - side.storedYardsAllowed
        : null;

      if (side.storedYardsAllowed === effectiveYards) {
        exactYardMatchesAgainstStored += 1;
      } else {
        yardMismatchesAgainstStored += 1;
      }

      teamResults.push({
        gameId: game.gameId,
        week: game.week,
        teamId: side.teamId,
        opponentTeamId: side.opponentTeamId,
        opponentFinalScore: side.opponentFinalScore,
        dstPointsAllowed,
        excludedNonDstTouchdownPoints,
        unresolvedPoints,
        baseDstYardsAllowed: opponentBaseYards,
        specialTeamsReturnYardsAllowed: specialTeamsReturnYards,
        effectiveDstYardsAllowed: effectiveYards,
        storedYardsAllowed: side.storedYardsAllowed,
        yardsAllowedDifference: yardsDifference,
        pointsBucket: selectPointsAllowedBucket(dstPointsAllowed),
        yardsBucket: effectiveYards === null ? null : selectYardsAllowedBucket(effectiveYards),
        reconciliationStatus: reconciles && unresolvedPoints === 0 ? "verified" : "unresolved",
      });
    }
  }

  const unresolvedEvents = events.filter((event) => event.classification === "unresolved_edge_case");
  return {
    teamResults,
    events,
    unresolvedEvents,
    coverage: {
      totalEvents: events.length,
      chargedEvents: events.filter((event) => event.classification === "charged_to_dst").length,
      excludedEvents: events.filter((event) => event.classification === "excluded_from_dst").length,
      conversionAlwaysChargedEvents: events.filter((event) => event.classification === "conversion_always_charged").length,
      unresolvedEvents: unresolvedEvents.length,
      teamRows: teamResults.length,
      verifiedTeamRows: teamResults.filter((row) => row.reconciliationStatus === "verified").length,
      unresolvedTeamRows: teamResults.filter((row) => row.reconciliationStatus === "unresolved").length,
      finalScoreReconciliationFailures,
      exactYardMatchesAgainstStored,
      yardMismatchesAgainstStored,
    },
  };
}

export function classifyDstScoringEvent(raw: NflversePbpRaw): DstScoringEvent | null {
  if (parsePbpFlag(raw["play_deleted"])) return null;
  const gameId = parsePbpString(raw["game_id"]) ?? "";
  const playId = parsePbpString(raw["play_id"]) ?? "";
  const week = parsePbpNumeric(raw["week"]) ?? 0;
  const posteam = parsePbpString(raw["posteam"]);
  const defteam = parsePbpString(raw["defteam"]);
  const tdTeam = parsePbpString(raw["td_team"]);
  const playType = parsePbpString(raw["play_type"]);
  const desc = parsePbpString(raw["desc"]) ?? "";

  if (parsePbpString(raw["field_goal_result"]) === "made") {
    return event(raw, { gameId, playId, week, scoringTeam: posteam, chargedTeam: defteam, points: 3, type: "field_goal", classification: "charged_to_dst", reason: "Opponent field goals are charged to DST points allowed.", description: desc });
  }

  if (parsePbpString(raw["extra_point_result"]) === "good") {
    return event(raw, { gameId, playId, week, scoringTeam: posteam, chargedTeam: defteam, points: 1, type: "extra_point", classification: "conversion_always_charged", reason: "PATs are charged even after an excluded defensive touchdown.", description: desc });
  }

  if (parsePbpString(raw["two_point_conv_result"]) === "success") {
    return event(raw, { gameId, playId, week, scoringTeam: posteam, chargedTeam: defteam, points: 2, type: "two_point_conversion", classification: "conversion_always_charged", reason: "Two-point conversions are charged even after an excluded defensive touchdown.", description: desc });
  }

  if (parsePbpFlag(raw["defensive_two_point_conv"])) {
    return event(raw, { gameId, playId, week, scoringTeam: defteam, chargedTeam: posteam, points: 2, type: "defensive_two_point_return", classification: "unresolved_edge_case", reason: "Sleeper DST allowance treatment for defensive two-point returns requires empirical evidence.", description: desc });
  }

  if (parsePbpFlag(raw["safety"])) {
    return event(raw, { gameId, playId, week, scoringTeam: defteam, chargedTeam: posteam, points: 2, type: "safety", classification: "unresolved_edge_case", reason: "Sleeper DST allowance treatment for safeties scored against the offense requires empirical evidence.", description: desc });
  }

  if (!parsePbpFlag(raw["touchdown"])) return null;

  if (parsePbpFlag(raw["interception"]) && parsePbpFlag(raw["return_touchdown"]) && tdTeam === defteam) {
    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: posteam, points: 6, type: "pick_six_touchdown", classification: "excluded_from_dst", reason: "Official Sleeper support states a pick-six thrown by the DST offense does not count against that DST.", description: desc });
  }

  if (parsePbpFlag(raw["interception"]) && parsePbpFlag(raw["fumble"]) && tdTeam && tdTeam === posteam) {
    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: defteam, points: 6, type: "possession_change_misc_td", classification: "unresolved_edge_case", reason: "Interception return followed by fumble and offensive recovery TD requires empirical Sleeper DST allowance evidence.", description: desc });
  }

  if (playType === "kickoff" || parsePbpFlag(raw["kickoff_attempt"])) {
    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: defteam, points: 6, type: "kickoff_return_touchdown", classification: "charged_to_dst", reason: "Official Sleeper support states kickoff-return touchdowns count against DST points allowed.", description: desc });
  }

  if (playType === "punt" || parsePbpFlag(raw["punt_attempt"])) {
    const type = parsePbpFlag(raw["punt_blocked"]) || /blocked punt/i.test(desc)
      ? "blocked_punt_return_touchdown"
      : "punt_return_touchdown";
    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: defteam, points: 6, type, classification: "charged_to_dst", reason: "Official Sleeper support states punt-return and blocked-punt return touchdowns count against DST points allowed.", description: desc });
  }

  if (parsePbpFlag(raw["field_goal_attempt"]) && parsePbpFlag(raw["return_touchdown"])) {
    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: defteam, points: 6, type: "blocked_field_goal_return_td", classification: "unresolved_edge_case", reason: "Sleeper DST allowance treatment for blocked field-goal return touchdowns requires empirical evidence.", description: desc });
  }

  if ((parsePbpFlag(raw["fumble"]) || parsePbpFlag(raw["fumble_lost"])) && tdTeam) {
    if (tdTeam !== posteam) {
      return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: posteam, points: 6, type: "defensive_fumble_return_td", classification: "unresolved_edge_case", reason: "Sleeper DST allowance treatment for defensive fumble-return touchdowns requires empirical evidence.", description: desc });
    }

    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: defteam, points: 6, type: "offensive_fumble_recovery_td", classification: "unresolved_edge_case", reason: "Offensive fumble recovery touchdown requires empirical Sleeper DST allowance evidence.", description: desc });
  }

  if (parsePbpFlag(raw["return_touchdown"])) {
    const type = parsePbpFlag(raw["special_teams_play"])
      ? "special_teams_misc_return_td"
      : "structurally_unclassifiable";
    return event(raw, { gameId, playId, week, scoringTeam: tdTeam, chargedTeam: defteam, points: 6, type, classification: "unresolved_edge_case", reason: "Return touchdown was not classifiable from structured pick-six/kickoff/punt/fumble fields.", description: desc });
  }

  return event(raw, { gameId, playId, week, scoringTeam: tdTeam ?? posteam, chargedTeam: defteam, points: 6, type: "offensive_touchdown", classification: "charged_to_dst", reason: "Opponent offensive touchdowns are charged to DST points allowed.", description: desc });
}

export function deriveOfficialNetYards(plays: NflversePbpRaw[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const play of plays) {
    if (parsePbpFlag(play["play_deleted"]) || parsePbpFlag(play["two_point_attempt"]) || parsePbpFlag(play["defensive_two_point_attempt"])) continue;
    const gameId = parsePbpString(play["game_id"]);
    const posteam = parsePbpString(play["posteam"]);
    if (!gameId || !posteam) continue;
    const pass = parsePbpNumeric(play["passing_yards"]) ?? 0;
    const rush = parsePbpNumeric(play["rushing_yards"]) ?? 0;
    const sack = parsePbpFlag(play["sack"]) ? (parsePbpNumeric(play["yards_gained"]) ?? 0) : 0;
    const value = pass + rush + sack;
    if (value === 0 && !parsePbpFlag(play["sack"]) && !parsePbpFlag(play["pass_attempt"]) && !parsePbpFlag(play["rush_attempt"])) continue;
    const key = `${gameId}|${posteam}`;
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  return totals;
}

function deriveSpecialTeamsReturnYardsAllowed(plays: NflversePbpRaw[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const play of plays) {
    if (parsePbpFlag(play["play_deleted"])) continue;
    const gameId = parsePbpString(play["game_id"]);
    const defteam = parsePbpString(play["defteam"]);
    const playType = parsePbpString(play["play_type"]);
    if (!gameId || !defteam || (playType !== "kickoff" && playType !== "punt")) continue;
    const returnYards = parsePbpNumeric(play["return_yards"]) ?? 0;
    if (returnYards <= 0) continue;
    const key = `${gameId}|${defteam}`;
    totals.set(key, (totals.get(key) ?? 0) + returnYards);
  }
  return totals;
}

function sumPoints(events: DstScoringEvent[], classifications: DstScoringEventClassification[]) {
  const allowed = new Set(classifications);
  return events.reduce((sum, event) => sum + (allowed.has(event.classification) ? event.points : 0), 0);
}

function event(_raw: NflversePbpRaw, input: DstScoringEvent): DstScoringEvent {
  return input;
}
