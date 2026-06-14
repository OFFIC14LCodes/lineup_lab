import { normalizePositionGroup } from "@/lib/players/normalize";
import { scoreFantasyStats } from "@/lib/scoring";
import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { REGISTRY_BY_KEY } from "@/lib/scoring/coverage/registry";
import type { FantasyScoringComponent } from "@/lib/scoring";
import type {
  ComponentShares,
  DraftDataAggregationResult,
  DraftDataDerivedWeeklyRow,
  DraftDataLeague,
  DraftDataPlayer,
  DraftDataProvenance,
  DraftDataWeeklyRow,
  LeagueFormatProfile,
  LeagueSummary,
  OffensiveDraftPosition,
  PbpDerivedBatchStatus,
  PlayerLeagueSeasonProfile,
  PlayerSituationProfile,
  ProfileLimitation,
  ProfileLimitationReason,
  ReplacementSummary,
  ScoredWeeklyPlayer,
  ScoringCompleteness,
  WeeklyFinishDistribution
} from "@/lib/draft-data/types";
import { OFFENSIVE_DRAFT_POSITIONS } from "@/lib/draft-data/types";

// Scoring keys that are backed by PBP-derived stats (including alias pass_int_td → pass_pick6).
const PBP_DERIVED_SCORING_KEYS = new Set([
  "rec_td_40p", "rec_td_50p", "rush_td_40p", "rush_td_50p",
  "pass_pick6", "pass_int_td", "fum_ret_td"
]);

// Scoring keys that require team-game context (pts_allow / yds_allow).
// These remain unavailable until team-game context is wired into the scoring engine.
const TEAM_CONTEXT_SCORING_KEYS = new Set([
  "pts_allow_0", "pts_allow_1_6", "pts_allow_7_13", "pts_allow_14_20",
  "pts_allow_21_27", "pts_allow_28_34", "pts_allow_35p",
  "yds_allow_0_99", "yds_allow_100_199", "yds_allow_200_299", "yds_allow_300_349",
  "yds_allow_350_399", "yds_allow_400_449", "yds_allow_450_499",
  "yds_allow_500_549", "yds_allow_550p", "return_fd"
]);

// Zero-value stats object injected when PBP batch is complete but the player-week
// has no derived row (= confirmed no qualifying events that week).
const DERIVED_ZERO_STATS: Record<string, number> = {
  rec_td_40p: 0, rec_td_50p: 0,
  rush_td_40p: 0, rush_td_50p: 0,
  pass_pick6: 0, fum_ret_td: 0
};

const OFFENSIVE_SET = new Set<string>(OFFENSIVE_DRAFT_POSITIONS);
const DEFAULT_MIN_GAMES_FOR_PPG_RANK = 4;

// Returns true when a scoring key is inapplicable to an offensive player profile (e.g., a DEF/IDP
// or kicking key that appears as "unsupported" in the engine for all positions because the engine
// has no rule for it, but should not count against offensive scoring completeness).
function isKeyInapplicableToOffensiveProfile(key: string, position: OffensiveDraftPosition): boolean {
  const record = REGISTRY_BY_KEY.get(key);
  if (record) {
    if (record.family === "team_defense" || record.family === "idp" || record.family === "kicking") return true;
    if (record.allowedPositions.length > 0 && !record.allowedPositions.includes(position)) return true;
    return false;
  }
  // Pattern heuristics for keys not yet in the registry (common DEF/IDP/ST prefixes).
  if (/^def_/.test(key)) return true;          // def_st_td, def_2pt_ret, etc.
  if (/^idp_/.test(key)) return true;          // idp_blk_kick, idp_def_td, etc.
  if (/^st_/.test(key)) return true;           // st_ff, st_fum_rec, st_tkl (special-teams)
  if (/^bonus_def_/.test(key)) return true;
  if (/^bonus_sack_/.test(key)) return true;
  if (/^bonus_tkl_/.test(key)) return true;
  if (/^bonus_qb_hit_/.test(key)) return true;
  if (/^bonus_idp_/.test(key)) return true;    // idp-specific bonus variants
  return false;
}

export type AggregateDraftDataInput = {
  league: DraftDataLeague;
  performanceSeason: number;
  leagueConfigSeason?: number;
  analysisMode?: "historical_under_current_format" | "historical_under_historical_format";
  weeklyRows: DraftDataWeeklyRow[];
  players: DraftDataPlayer[];
  derivedRows?: DraftDataDerivedWeeklyRow[];
  // Whether the PBP-derived batch for this season completed successfully.
  // "complete"  → absent derived rows are known zero (no qualifying events).
  // "partial"   → batch ran but may be missing some weeks; absent = unknown.
  // "not_run"   → batch has never run; all PBP-derived keys are unknown.
  pbpDerivedBatchStatus?: PbpDerivedBatchStatus;
  minimumGamesForPpgRank?: number;
  generatedAt?: string;
};

export function aggregateLeagueDraftData(input: AggregateDraftDataInput): DraftDataAggregationResult {
  const minimumGamesForPpgRank = input.minimumGamesForPpgRank ?? DEFAULT_MIN_GAMES_FOR_PPG_RANK;
  const leagueConfigSeason = input.leagueConfigSeason ?? Number(input.league.season ?? input.performanceSeason);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pbpDerivedBatchStatus: PbpDerivedBatchStatus = input.pbpDerivedBatchStatus ?? "not_run";
  const pbpBatchComplete = pbpDerivedBatchStatus === "complete";

  const provenance = buildProvenance({
    league: input.league,
    performanceSeason: input.performanceSeason,
    leagueConfigSeason,
    analysisAsOfDate: generatedAt,
    analysisMode: input.analysisMode ?? (
      leagueConfigSeason === input.performanceSeason
        ? "historical_under_historical_format"
        : "historical_under_current_format"
    ),
    weeklyRows: input.weeklyRows,
    derivedRows: input.derivedRows ?? []
  });
  const leagueFormat = buildLeagueFormatProfile(input.league, input.performanceSeason, leagueConfigSeason);
  const scoringSettings = input.league.scoring_settings_json ?? {};
  const playersById = new Map(input.players.map((player) => [player.id, player]));
  const derivedByKey = new Map(
    (input.derivedRows ?? []).map((row) => [weeklyKey(row.player_id, row.season, row.week, row.season_type), row])
  );

  const scoredWeeks: ScoredWeeklyPlayer[] = [];
  let unresolvedIdentityRows = 0;
  let knownZeroInferencesApplied = 0;

  for (const row of input.weeklyRows) {
    const player = playersById.get(row.player_id);
    const position = normalizeOffensivePosition(row.position_group ?? player?.position_group ?? player?.primary_position ?? player?.position);
    if (!player || !position) {
      unresolvedIdentityRows += 1;
      continue;
    }

    const derived = derivedByKey.get(weeklyKey(row.player_id, row.season, row.week, row.season_type));
    // Known-zero inference: when PBP batch is complete and no derived row exists for this
    // player-week, the absence of qualifying events is confirmed. Inject zeros for all
    // PBP-derived keys so the scoring engine evaluates them as 0 instead of missing_stat.
    const useKnownZero = !derived && pbpBatchComplete;
    if (useKnownZero) knownZeroInferencesApplied += 1;
    const effectiveDerived = derived ?? (pbpBatchComplete ? { stats_json: DERIVED_ZERO_STATS } : null);
    const stats = effectiveDerived ? mergeStats(row.stats_json, effectiveDerived.stats_json) : row.stats_json;

    const scoring = scoreFantasyStats({
      stats,
      scoringSettings,
      positionGroup: position,
      statSource: "actual",
      context: { season: row.season, week: row.week, playerId: row.player_id }
    });

    scoredWeeks.push({
      playerId: row.player_id,
      playerName: player.full_name ?? "Unknown player",
      position,
      nflTeam: row.team ?? player.team ?? null,
      season: row.season,
      week: row.week,
      points: round(scoring.totalPoints),
      scoring,
      components: scoring.components,
      stats
    });
  }

  const profiles = buildProfiles({
    leagueId: input.league.id,
    performanceSeason: input.performanceSeason,
    leagueConfigSeason,
    analysisMode: provenance.analysisMode,
    provenance,
    scoredWeeks,
    minimumGamesForPpgRank,
    pbpDerivedBatchStatus,
    scoringSettings
  });
  const replacementSummary = buildReplacementSummary(input.league.id, input.performanceSeason, leagueConfigSeason, leagueFormat, profiles);
  applyReplacement(profiles, replacementSummary);
  applyRanks(profiles, minimumGamesForPpgRank);
  const sortedProfiles = profiles.sort(profileSort);
  const leagueSummary = buildLeagueSummary(input.league.id, leagueFormat, sortedProfiles);

  return {
    generatedAt,
    provenance,
    leagueFormat,
    profiles: sortedProfiles,
    replacementSummary,
    leagueSummary,
    diagnostics: {
      sourceWeeklyRows: input.weeklyRows.length,
      resolvedOffensiveWeeklyRows: scoredWeeks.length,
      unresolvedIdentityRows,
      profileCount: profiles.length,
      minimumGamesForPpgRank,
      knownZeroInferencesApplied,
      pbpDerivedBatchStatus,
      notes: [
        "Only stored weekly scoring rows are treated as valid scoring data.",
        "Inactive, bye, missing, and unresolved identity weeks are not inferred and are not scored as zero.",
        pbpBatchComplete
          ? "PBP batch is complete: player-weeks without derived rows receive known-zero inference for all PBP-derived scoring keys."
          : `PBP batch status is '${pbpDerivedBatchStatus}': PBP-derived keys without derived rows remain unknown rather than inferred as zero.`,
        "Replacement-level output is preliminary and based on roster-slot demand plus scored historical PPG."
      ]
    }
  };
}

export function buildLeagueFormatProfile(league: DraftDataLeague, performanceSeason: number, leagueConfigSeason = Number(league.season ?? performanceSeason)): LeagueFormatProfile {
  const rosterSlots = Array.isArray(league.roster_positions_json)
    ? league.roster_positions_json.filter((slot): slot is string => typeof slot === "string")
    : [];
  const requirements = buildNormalizedRosterRequirements(rosterSlots);
  const scoring = league.scoring_settings_json ?? {};
  const rec = numeric(scoring["rec"]);
  const recTe = numeric(scoring["bonus_rec_te"]) + numeric(scoring["rec_te"]);
  const firstDownKeys = Object.keys(scoring).filter((key) => key.includes("fd") || key.includes("first_down")).sort();
  const bonusKeys = Object.keys(scoring).filter((key) => key.startsWith("bonus_")).sort();
  const isSuperflex = Boolean(league.is_superflex || league.is_two_qb || requirements.superflexCount > 0);

  return {
    leagueId: league.id,
    performanceSeason,
    leagueConfigSeason,
    teamCount: Math.max(1, Number(league.total_teams ?? 12)),
    rosterSlots,
    directStarters: {
      QB: requirements.directStarters.QB,
      RB: requirements.directStarters.RB,
      WR: requirements.directStarters.WR,
      TE: requirements.directStarters.TE
    },
    offensiveFlexCount: requirements.offensiveFlexCount,
    superflexCount: requirements.superflexCount,
    benchCount: requirements.benchCount,
    isDynasty: Boolean(league.is_dynasty),
    isBestBall: Boolean(league.is_best_ball),
    isSuperflex,
    isTwoQb: Boolean(league.is_two_qb || requirements.directStarters.QB >= 2),
    tePremium: {
      detected: Boolean(league.te_premium || recTe > 0),
      ppr: rec,
      teReceptionPremium: recTe
    },
    scoring: {
      passingTd: hasValue(scoring["pass_td"]) ? numeric(scoring["pass_td"]) : null,
      reception: rec,
      firstDownKeys,
      bonusKeys,
      activeKeyCount: Object.values(scoring).filter((value) => Number(value) !== 0).length
    },
    notes: [
      isSuperflex ? "Superflex or 2QB demand is active." : "Single-QB demand profile.",
      recTe > 0 ? "TE reception premium detected from scoring settings." : "No explicit TE reception premium detected.",
      requirements.unknownSlots.length > 0
        ? `Unknown roster slots ignored in H6 demand model: ${requirements.unknownSlots.join(", ")}.`
        : "Roster slots normalized without unknown offensive slots."
    ]
  };
}

export function buildUnknownSituationProfile(playerId: string, performanceSeason: number): PlayerSituationProfile {
  const unknown = {
    status: "unknown" as const,
    value: null,
    source: null,
    updatedAt: null,
    confidence: "unknown" as const
  };
  return {
    playerId,
    performanceSeason,
    team: unknown,
    depthChartRole: unknown,
    projectedRole: unknown,
    injuryStatus: unknown,
    offensiveLineContext: unknown,
    quarterbackContext: unknown,
    teammateCompetition: unknown,
    coachingScheme: unknown
  };
}

function buildProfiles(input: {
  leagueId: string;
  performanceSeason: number;
  leagueConfigSeason: number;
  analysisMode: "historical_under_current_format" | "historical_under_historical_format";
  provenance: DraftDataProvenance;
  scoredWeeks: ScoredWeeklyPlayer[];
  minimumGamesForPpgRank: number;
  pbpDerivedBatchStatus: PbpDerivedBatchStatus;
  scoringSettings: Record<string, unknown>;
}) {
  const byPlayer = groupBy(input.scoredWeeks, (week) => week.playerId);
  const finishDistributions = buildWeeklyFinishDistributions(input.scoredWeeks);
  const profiles: PlayerLeagueSeasonProfile[] = [];

  for (const [playerId, weeks] of byPlayer) {
    const sortedWeeks = [...weeks].sort((a, b) => a.week - b.week || a.points - b.points);
    const points = sortedWeeks.map((week) => week.points);
    const first = sortedWeeks[0]!;
    const scoringWarnings = uniqueSorted(sortedWeeks.flatMap((week) => week.scoring.warnings.map((warning) => warning.code)));
    const unsupported = uniqueSorted(sortedWeeks.flatMap((week) => week.scoring.coverage.unsupportedScoringKeys));
    const missingStats = uniqueSorted(
      sortedWeeks.flatMap((week) => week.scoring.coverage.missingStatsForSupportedKeys.map((item) => item.scoringKey))
    );
    const coverageRatio = average(sortedWeeks.map((week) => week.scoring.coverage.coverageRatio));

    const scoringCompleteness = buildScoringCompleteness(
      sortedWeeks, unsupported, missingStats, coverageRatio,
      input.pbpDerivedBatchStatus, input.scoringSettings, scoringWarnings, first.position
    );

    profiles.push({
      leagueId: input.leagueId,
      performanceSeason: input.performanceSeason,
      leagueConfigSeason: input.leagueConfigSeason,
      analysisMode: input.analysisMode,
      provenance: input.provenance,
      playerId,
      playerName: first.playerName,
      position: first.position,
      nflTeam: latestTeam(sortedWeeks),
      gamesWithValidScoringData: sortedWeeks.length,
      gamesPlayed: sortedWeeks.length,
      gamesStarted: null,
      totalPoints: round(sum(points)),
      pointsPerGame: round(average(points)),
      medianPoints: round(percentile(points, 0.5)),
      minPoints: round(Math.min(...points)),
      maxPoints: round(Math.max(...points)),
      stddevPoints: round(stddev(points)),
      coefficientOfVariation: average(points) === 0 ? null : round(stddev(points) / Math.abs(average(points))),
      zeroPointWeeks: points.filter((value) => value === 0).length,
      negativePointWeeks: points.filter((value) => value < 0).length,
      floorPoints: round(percentile(points, 0.25)),
      medianRangePoints: round(percentile(points, 0.5)),
      ceilingPoints: round(percentile(points, 0.75)),
      bestThreeWeekAverage: rollingAverage(points, 3, "best"),
      worstThreeWeekAverage: rollingAverage(points, 3, "worst"),
      topThreeShare: topShare(points, 3),
      weeklyFinishDistribution: finishDistributions.get(playerId) ?? emptyFinishDistribution(),
      componentShares: buildComponentShares(sortedWeeks.flatMap((week) => week.components)),
      scoringCompleteness,
      ranks: {
        overallTotal: null,
        positionTotal: null,
        positionPpg: null,
        positionMedian: null,
        positionConsistency: null,
        positionCeiling: null,
        ppgSmallSample: sortedWeeks.length < input.minimumGamesForPpgRank
      },
      replacement: {
        replacementPointsPerGame: null,
        pointsAboveReplacement: null
      },
      situationProfile: buildUnknownSituationProfile(playerId, input.performanceSeason),
      limitations: scoringCompleteness.limitations
    });
  }

  return profiles;
}

function buildScoringCompleteness(
  sortedWeeks: ScoredWeeklyPlayer[],
  unsupportedScoringKeys: string[],
  missingStatsForSupportedKeys: string[],
  coverageRatio: number,
  pbpDerivedBatchStatus: PbpDerivedBatchStatus,
  scoringSettings: Record<string, unknown>,
  warnings: string[],
  position: OffensiveDraftPosition
): ScoringCompleteness & { limitations: ProfileLimitation[] } {
  const pbpBatchComplete = pbpDerivedBatchStatus === "complete";

  // Split unsupported keys: DEF/IDP/K keys are inapplicable to offensive profiles and must not
  // reduce completeness (they appear as "unsupported" for all positions because the engine has
  // no rule for them, but they aren't gaps in offensive scoring coverage).
  const applicableUnsupportedKeys = unsupportedScoringKeys.filter((k) => !isKeyInapplicableToOffensiveProfile(k, position));
  const inapplicableUnsupportedKeys = unsupportedScoringKeys.filter((k) => isKeyInapplicableToOffensiveProfile(k, position));

  // Only PBP-derived and team-context keys represent real data pipeline gaps.
  // Regular weekly stats (rec, rush_yd, pass_td, etc.) absent from stats_json are
  // implicitly zero for that week — they do NOT reduce scoring completeness.
  const realGapMissingKeys = missingStatsForSupportedKeys.filter(
    (key) => PBP_DERIVED_SCORING_KEYS.has(key) || TEAM_CONTEXT_SCORING_KEYS.has(key)
  );

  let incompleteSourceKeyCount = 0;
  let unavailableDatasetKeyCount = 0;
  let missingMergeKeyCount = 0;
  const limitations: ProfileLimitation[] = [];

  for (const key of realGapMissingKeys) {
    let reason: ProfileLimitationReason;
    if (PBP_DERIVED_SCORING_KEYS.has(key)) {
      // With a complete PBP batch, known-zero inference should have eliminated these.
      // If we still see them missing after a complete batch, that's an unexpected merge gap.
      reason = "missing_merge";
      if (!pbpBatchComplete) incompleteSourceKeyCount += 1;
      else missingMergeKeyCount += 1;
    } else {
      reason = "unavailable_dataset";
      unavailableDatasetKeyCount += 1;
    }

    const scoringValue = Number(scoringSettings[key] ?? 0);
    const estimatedMaxImpact = scoringValue !== 0 ? Math.abs(scoringValue) : null;
    limitations.push({
      scoringKey: key,
      reason,
      estimatedMaxPointImpactPerGame: estimatedMaxImpact,
      couldAffectPositionRank: estimatedMaxImpact !== null && estimatedMaxImpact >= 2,
      couldAffectReplacementValue: estimatedMaxImpact !== null && estimatedMaxImpact >= 3
    });
  }

  // Only applicable unsupported keys (not DEF/IDP/K) count as limitations and affect completeness.
  for (const key of applicableUnsupportedKeys) {
    const scoringValue = Number(scoringSettings[key] ?? 0);
    const estimatedMaxImpact = scoringValue !== 0 ? Math.abs(scoringValue) : null;
    limitations.push({
      scoringKey: key,
      reason: "unsupported_engine",
      estimatedMaxPointImpactPerGame: estimatedMaxImpact,
      couldAffectPositionRank: estimatedMaxImpact !== null && estimatedMaxImpact >= 2,
      couldAffectReplacementValue: estimatedMaxImpact !== null && estimatedMaxImpact >= 3
    });
  }

  // applicableKeyCount: engine-evaluated + all raw-missing + applicable unsupported only.
  // Inapplicable (DEF/IDP/K) unsupported keys are excluded from both numerator and denominator.
  const firstWeekCoverage = sortedWeeks[0]?.scoring.coverage;
  const rawEvaluated = firstWeekCoverage?.evaluatedScoringKeys.length ?? 0;
  const rawAllMissing = firstWeekCoverage?.missingStatsForSupportedKeys.length ?? 0;
  const rawUnsupported = firstWeekCoverage?.unsupportedScoringKeys.length ?? 0;
  const rawUnsupportedApplicable = Math.max(0, rawUnsupported - inapplicableUnsupportedKeys.length);
  const applicableKeyCount = rawEvaluated + rawAllMissing + rawUnsupportedApplicable;

  const unsupportedEngineKeyCount = applicableUnsupportedKeys.length;
  // Real impaired keys = PBP-derived gaps + team-context gaps + unsupported engine keys.
  const totalImpairedKeys = incompleteSourceKeyCount + unavailableDatasetKeyCount + missingMergeKeyCount + unsupportedEngineKeyCount;
  const evaluatedKeyCount = Math.max(0, applicableKeyCount - totalImpairedKeys);

  // Known-zero keys: PBP-derived scoring keys active in this league that are NOT missing.
  // These were either scored from an explicit derived row or from known-zero inference.
  const activePbpDerivedKeys = [...PBP_DERIVED_SCORING_KEYS].filter(
    (key) => Number(scoringSettings[key] ?? 0) !== 0
  );
  const stillMissingPbpKeys = new Set(missingStatsForSupportedKeys.filter((k) => PBP_DERIVED_SCORING_KEYS.has(k)));
  const knownZeroKeyCount = activePbpDerivedKeys.filter((key) => !stillMissingPbpKeys.has(key)).length;

  const scoringCompletenessRatio = applicableKeyCount > 0
    ? round(evaluatedKeyCount / applicableKeyCount)
    : 1;

  const historicalScoreConfidence = classifyConfidence(scoringCompletenessRatio, totalImpairedKeys);
  const hasAnyGap = unsupportedScoringKeys.length > 0 || missingStatsForSupportedKeys.length > 0;

  return {
    validScoredWeeksOnly: true,
    gamesWithValidScoringData: sortedWeeks.length,
    applicableKeyCount,
    evaluatedKeyCount,
    knownZeroKeyCount,
    unsupportedEngineKeyCount,
    unavailableDatasetKeyCount,
    incompleteSourceKeyCount,
    missingMergeKeyCount,
    scoringCompletenessRatio,
    historicalScoreConfidence,
    // Legacy fields
    coverageRatio: round(coverageRatio),
    validationStatus:
      sortedWeeks.length === 0
        ? "no_valid_rows"
        : hasAnyGap
          ? "partial_missing_scoring_keys"
          : "complete_for_stored_rows",
    unsupportedScoringKeys,
    missingStatsForSupportedKeys,
    knownZeroStatsForSupportedKeys: activePbpDerivedKeys.filter((key) => !stillMissingPbpKeys.has(key)),
    warnings,
    limitations
  };
}

function classifyConfidence(ratio: number, totalImpairedKeys: number): ScoringCompleteness["historicalScoreConfidence"] {
  if (totalImpairedKeys === 0) return "complete";
  if (ratio >= 0.95) return "high";
  if (ratio >= 0.85) return "moderate";
  if (ratio >= 0.5) return "low";
  return "unusable";
}

function buildLeagueSummary(
  leagueId: string,
  leagueFormat: LeagueFormatProfile,
  profiles: PlayerLeagueSeasonProfile[]
): LeagueSummary {
  if (profiles.length === 0) {
    return {
      leagueId,
      totalProfiles: 0,
      completeProfiles: 0,
      highConfidenceProfiles: 0,
      moderateConfidenceProfiles: 0,
      lowConfidenceProfiles: 0,
      unusableProfiles: 0,
      averageScoringCompletenessRatio: 0,
      minimumScoringCompletenessRatio: 0,
      activeScoringKeyCount: leagueFormat.scoring.activeKeyCount,
      positionBreakdown: {} as LeagueSummary["positionBreakdown"],
      mostCommonLimitationKeys: [],
      outOfScopeLeagueScoringKeys: []
    };
  }

  const byConfidence = countBy(profiles.map((p) => p.scoringCompleteness.historicalScoreConfidence));
  const ratios = profiles.map((p) => p.scoringCompleteness.scoringCompletenessRatio);
  const limitationCounts = new Map<string, { reason: ProfileLimitationReason; count: number }>();
  // DEF/IDP/K scoring keys active in this league but not applicable to any offensive profile.
  const outOfScopeLeagueScoringKeys = [...new Set(
    profiles.flatMap((p) =>
      p.scoringCompleteness.unsupportedScoringKeys.filter((k) => isKeyInapplicableToOffensiveProfile(k, p.position))
    )
  )].sort();

  for (const profile of profiles) {
    for (const lim of profile.limitations) {
      const key = `${lim.scoringKey}::${lim.reason}`;
      const existing = limitationCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        limitationCounts.set(key, { reason: lim.reason, count: 1 });
      }
    }
  }

  const positionBreakdown = Object.fromEntries(
    OFFENSIVE_DRAFT_POSITIONS.map((pos) => {
      const posProfiles = profiles.filter((p) => p.position === pos);
      return [pos, {
        count: posProfiles.length,
        averageCompleteness: posProfiles.length > 0
          ? round(average(posProfiles.map((p) => p.scoringCompleteness.scoringCompletenessRatio)))
          : 0
      }];
    })
  ) as LeagueSummary["positionBreakdown"];

  const mostCommonLimitationKeys = [...limitationCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([key, { reason, count }]) => ({
      scoringKey: key.split("::")[0]!,
      reason,
      affectedProfileCount: count
    }));

  return {
    leagueId,
    totalProfiles: profiles.length,
    completeProfiles: byConfidence["complete"] ?? 0,
    highConfidenceProfiles: byConfidence["high"] ?? 0,
    moderateConfidenceProfiles: byConfidence["moderate"] ?? 0,
    lowConfidenceProfiles: byConfidence["low"] ?? 0,
    unusableProfiles: byConfidence["unusable"] ?? 0,
    averageScoringCompletenessRatio: round(average(ratios)),
    minimumScoringCompletenessRatio: round(Math.min(...ratios)),
    activeScoringKeyCount: leagueFormat.scoring.activeKeyCount,
    positionBreakdown,
    mostCommonLimitationKeys,
    outOfScopeLeagueScoringKeys
  };
}

function applyRanks(profiles: PlayerLeagueSeasonProfile[], minimumGamesForPpgRank: number) {
  assignRank(profiles, (profile) => profile.totalPoints, (profile, rank) => { profile.ranks.overallTotal = rank; });
  for (const position of OFFENSIVE_DRAFT_POSITIONS) {
    const positionProfiles = profiles.filter((profile) => profile.position === position);
    assignRank(positionProfiles, (profile) => profile.totalPoints, (profile, rank) => { profile.ranks.positionTotal = rank; });
    assignRank(
      positionProfiles.filter((profile) => profile.gamesWithValidScoringData >= minimumGamesForPpgRank),
      (profile) => profile.pointsPerGame,
      (profile, rank) => { profile.ranks.positionPpg = rank; }
    );
    assignRank(positionProfiles, (profile) => profile.medianPoints, (profile, rank) => { profile.ranks.positionMedian = rank; });
    assignRank(positionProfiles, (profile) => profile.ceilingPoints, (profile, rank) => { profile.ranks.positionCeiling = rank; });
    assignRank(
      positionProfiles,
      (profile) => -(profile.coefficientOfVariation ?? Number.MAX_SAFE_INTEGER),
      (profile, rank) => { profile.ranks.positionConsistency = rank; }
    );
  }
}

function buildReplacementSummary(
  leagueId: string,
  performanceSeason: number,
  leagueConfigSeason: number,
  leagueFormat: LeagueFormatProfile,
  profiles: PlayerLeagueSeasonProfile[]
): ReplacementSummary {
  const demand = estimateStarterDemand(leagueFormat, profiles);
  const positionSummaries = Object.fromEntries(
    OFFENSIVE_DRAFT_POSITIONS.map((position) => {
      const eligible = profiles
        .filter((profile) => profile.position === position && profile.gamesWithValidScoringData >= DEFAULT_MIN_GAMES_FOR_PPG_RANK)
        .sort(ppgSort);
      const replacementRank = Math.max(1, Math.ceil(demand[position] * leagueFormat.teamCount));
      const replacement = eligible[Math.min(eligible.length - 1, replacementRank - 1)] ?? null;
      return [
        position,
        {
          starterDemand: round(demand[position]),
          replacementRank,
          replacementPlayerId: replacement?.playerId ?? null,
          replacementPlayerName: replacement?.playerName ?? null,
          replacementPointsPerGame: replacement ? replacement.pointsPerGame : null,
          eligiblePlayerCount: eligible.length
        }
      ];
    })
  ) as ReplacementSummary["positionSummaries"];

  return {
    leagueId,
    performanceSeason,
    leagueConfigSeason,
    methodVersion: "h6-preliminary-v1",
    methodology:
      "Direct roster slots plus deterministic flex allocation using historical PPG pools. Bench, ADP, injuries, and forward-looking projections are intentionally excluded in H6.",
    positionSummaries
  };
}

function estimateStarterDemand(leagueFormat: LeagueFormatProfile, profiles: PlayerLeagueSeasonProfile[]) {
  const demand: Record<OffensiveDraftPosition, number> = { ...leagueFormat.directStarters };
  const flexEligible: OffensiveDraftPosition[] = ["RB", "WR", "TE"];
  allocateFlex(demand, profiles, flexEligible, leagueFormat.offensiveFlexCount, leagueFormat.teamCount);
  allocateFlex(demand, profiles, ["QB", "RB", "WR", "TE"], leagueFormat.superflexCount, leagueFormat.teamCount);
  return demand;
}

function allocateFlex(
  demand: Record<OffensiveDraftPosition, number>,
  profiles: PlayerLeagueSeasonProfile[],
  positions: OffensiveDraftPosition[],
  flexCount: number,
  teamCount: number
) {
  for (let slot = 0; slot < flexCount; slot++) {
    let bestPosition = positions[0]!;
    let bestPoints = -Infinity;
    for (const position of positions) {
      const rank = Math.max(1, Math.ceil((demand[position] + 1) * teamCount));
      const candidate = profiles
        .filter((profile) => profile.position === position)
        .sort(ppgSort)[rank - 1];
      const points = candidate?.pointsPerGame ?? -Infinity;
      if (points > bestPoints || (points === bestPoints && position.localeCompare(bestPosition) < 0)) {
        bestPosition = position;
        bestPoints = points;
      }
    }
    demand[bestPosition] += 1;
  }
}

function applyReplacement(profiles: PlayerLeagueSeasonProfile[], summary: ReplacementSummary) {
  for (const profile of profiles) {
    const replacementPpg = summary.positionSummaries[profile.position].replacementPointsPerGame;
    profile.replacement.replacementPointsPerGame = replacementPpg;
    profile.replacement.pointsAboveReplacement =
      replacementPpg === null ? null : round((profile.pointsPerGame - replacementPpg) * profile.gamesWithValidScoringData);
  }
}

function buildWeeklyFinishDistributions(scoredWeeks: ScoredWeeklyPlayer[]) {
  const counts = new Map<string, Record<string, number>>();
  const weeksByPosition = groupBy(scoredWeeks, (week) => `${week.season}:${week.week}:${week.position}`);

  for (const [, weeks] of weeksByPosition) {
    const ranked = [...weeks].sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName) || a.playerId.localeCompare(b.playerId));
    ranked.forEach((week, index) => {
      const rank = index + 1;
      const bucket = finishBucket(week.position, rank);
      const current = counts.get(week.playerId) ?? {};
      current[bucket] = (current[bucket] ?? 0) + 1;
      counts.set(week.playerId, current);
    });
  }

  const result = new Map<string, WeeklyFinishDistribution>();
  for (const [playerId, buckets] of counts) {
    const weeks = sum(Object.values(buckets));
    result.set(playerId, {
      weeks,
      buckets,
      rates: Object.fromEntries(Object.entries(buckets).map(([bucket, count]) => [bucket, round(count / weeks)]))
    });
  }
  return result;
}

function finishBucket(position: OffensiveDraftPosition, rank: number) {
  if (position === "QB") {
    if (rank <= 6) return "QB1-6";
    if (rank <= 12) return "QB7-12";
    if (rank <= 24) return "QB13-24";
    return "below_QB24";
  }
  if (position === "TE") {
    if (rank <= 3) return "TE1-3";
    if (rank <= 6) return "TE4-6";
    if (rank <= 12) return "TE7-12";
    return "below_TE12";
  }
  if (rank <= 6) return `${position}1-6`;
  if (rank <= 12) return `${position}7-12`;
  if (rank <= 24) return `${position}13-24`;
  if (rank <= 36) return `${position}25-36`;
  return `below_${position}36`;
}

function buildComponentShares(components: FantasyScoringComponent[]): ComponentShares {
  const positiveTotal = sum(components.map((component) => Math.max(0, component.points)));
  const buckets = {
    touchdowns: 0,
    receptions: 0,
    passingYardage: 0,
    rushingYardage: 0,
    receivingYardage: 0,
    other: 0
  };
  for (const component of components) {
    const points = Math.max(0, component.points);
    const key = `${component.scoringKey}:${component.statKey}`;
    if (key.includes("_td") || key.includes("td_") || key.includes("return_td")) buckets.touchdowns += points;
    else if (component.statKey === "rec" || component.scoringKey.includes("rec")) buckets.receptions += points;
    else if (component.statKey.includes("pass_yd")) buckets.passingYardage += points;
    else if (component.statKey.includes("rush_yd")) buckets.rushingYardage += points;
    else if (component.statKey.includes("rec_yd")) buckets.receivingYardage += points;
    else buckets.other += points;
  }
  if (positiveTotal <= 0) return buckets;
  return Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, round(value / positiveTotal)])) as ComponentShares;
}

function buildProvenance(input: {
  league: DraftDataLeague;
  performanceSeason: number;
  leagueConfigSeason: number;
  analysisAsOfDate: string;
  analysisMode: "historical_under_current_format" | "historical_under_historical_format";
  weeklyRows: DraftDataWeeklyRow[];
  derivedRows: DraftDataDerivedWeeklyRow[];
}): DraftDataProvenance {
  return {
    performanceSeason: input.performanceSeason,
    leagueConfigSeason: input.leagueConfigSeason,
    leagueId: input.league.id,
    leagueName: input.league.name,
    analysisAsOfDate: input.analysisAsOfDate,
    analysisMode: input.analysisMode,
    leagueConfigurationSnapshotId: null,
    scoringSettingsHash: stableHash(input.league.scoring_settings_json ?? {}),
    rosterSettingsHash: stableHash(input.league.roster_positions_json ?? []),
    formatProfileVersion: "h6-format-profile-v1",
    metricDefinitionVersion: "h6-metric-definitions-v1",
    sourceWeeklyStatRows: input.weeklyRows.length,
    sourceWeeklyStatHash: stableHash(
      input.weeklyRows.map((row) => ({
        player_id: row.player_id,
        season: row.season,
        week: row.week,
        season_type: row.season_type,
        stats_json: row.stats_json
      }))
    ),
    derivedStatRows: input.derivedRows.length,
    derivedStatHash: stableHash(
      input.derivedRows.map((row) => ({
        player_id: row.player_id,
        season: row.season,
        week: row.week,
        season_type: row.season_type,
        stat_scope: row.stat_scope,
        stats_json: row.stats_json
      }))
    )
  };
}

function normalizeOffensivePosition(value: string | null | undefined): OffensiveDraftPosition | null {
  const normalized = normalizePositionGroup(value);
  return normalized && OFFENSIVE_SET.has(normalized) ? (normalized as OffensiveDraftPosition) : null;
}

function mergeStats(base: Record<string, unknown>, derived: Record<string, unknown>) {
  return { ...base, ...derived };
}

function weeklyKey(playerId: string, season: number, week: number, seasonType: string) {
  return `${playerId}:${season}:${week}:${seasonType}`;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function latestTeam(weeks: ScoredWeeklyPlayer[]) {
  return [...weeks].sort((a, b) => b.week - a.week).find((week) => week.nflTeam)?.nflTeam ?? null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function stddev(values: number[]) {
  if (values.length <= 1) return 0;
  const avg = average(values);
  return Math.sqrt(average(values.map((value) => (value - avg) ** 2)));
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(pct * sorted.length) - 1));
  return sorted[index]!;
}

function rollingAverage(values: number[], size: number, mode: "best" | "worst") {
  if (values.length < size) return null;
  const windows = [];
  for (let i = 0; i <= values.length - size; i++) {
    windows.push(average(values.slice(i, i + size)));
  }
  return round(mode === "best" ? Math.max(...windows) : Math.min(...windows));
}

function topShare(values: number[], count: number) {
  if (values.length === 0) return 0;
  const total = sum(values.map((value) => Math.max(0, value)));
  if (total === 0) return 0;
  const top = sum([...values].sort((a, b) => b - a).slice(0, count).map((value) => Math.max(0, value)));
  return round(top / total);
}

function emptyFinishDistribution(): WeeklyFinishDistribution {
  return { weeks: 0, buckets: {}, rates: {} };
}

function assignRank(
  profiles: PlayerLeagueSeasonProfile[],
  score: (profile: PlayerLeagueSeasonProfile) => number,
  assign: (profile: PlayerLeagueSeasonProfile, rank: number) => void
) {
  [...profiles]
    .sort((a, b) => score(b) - score(a) || b.totalPoints - a.totalPoints || a.playerName.localeCompare(b.playerName) || a.playerId.localeCompare(b.playerId))
    .forEach((profile, index) => assign(profile, index + 1));
}

function ppgSort(a: PlayerLeagueSeasonProfile, b: PlayerLeagueSeasonProfile) {
  return b.pointsPerGame - a.pointsPerGame || b.totalPoints - a.totalPoints || a.playerName.localeCompare(b.playerName) || a.playerId.localeCompare(b.playerId);
}

function profileSort(a: PlayerLeagueSeasonProfile, b: PlayerLeagueSeasonProfile) {
  return (a.ranks.overallTotal ?? 999999) - (b.ranks.overallTotal ?? 999999) || a.playerName.localeCompare(b.playerName);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function round(value: number) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function stableHash(value: unknown) {
  const serialized = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
