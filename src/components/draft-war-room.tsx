"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw, Search, Users, X } from "lucide-react";

import type { WarRoomValueOverlayRow, WarRoomValueOverlayResult } from "@/lib/draft/h10-war-room-overlay";
import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import type { H10RecommendationExperimentDiagnostics } from "@/lib/draft/war-room-recommendation-experiment";
import {
  buildH10RecommendationExperimentUiState,
  DEFAULT_H10_RECOMMENDATION_SOURCE,
  H10_RECOMMENDATION_READINESS_LABELS,
  type H10RecommendationSource,
} from "@/lib/draft/war-room-recommendation-experiment-ui";
import { buildBlackbirdBoard, type BlackbirdBoardRow, type BlackbirdBoardSortKey } from "@/lib/draft/blackbird-board";
import { applyLivePlanFitToBoardRows, buildLivePlanStatus, type LivePlanStatus } from "@/lib/draft/live-plan-status";
import {
  draftBoardPositionBadgeClass,
  draftBoardPositionCardClass,
  normalizeDraftBoardPosition,
} from "@/lib/draft/draft-board-display";
import { buildPlayerProfileEvidence, type PlayerProfileEvidence } from "@/lib/player-profiles/player-profile-evidence";
import type { PlayerProfileReadModel } from "@/lib/player-profiles/player-profile-read-model";
import type { PlayerProfileScoringMetadata } from "@/lib/player-profiles/player-profile-rescoring";
import { buildPreDraftStrategyUiViewModel } from "@/lib/draft/pre-draft-strategy-ui";
import { projectionTrustBadgeLabel } from "@/lib/projections/projection-trust";
import type { WarRoomRecommendationResult, WarRoomRecommendationRow, WarRoomRecommendationTier } from "@/lib/draft/war-room-recommendations";

type RecommendationTier = "elite_target" | "strong_target" | "good_value" | "depth_option" | "avoid_for_now";
type InputCompleteness = "full" | "partial" | "rankings_only" | "fallback_only";
type PositionScoringMode =
  | "offense_v1_1"
  | "idp_rankings_v1"
  | "kicker_rankings_v1"
  | "defense_rankings_v1"
  | "unsupported";

type AvailablePlayer = {
  sleeper_player_id: string | null;
  matched_player_id: string | null;
  player_name: string | null;
  position: string | null;
  team: string | null;
  age?: number | null;
  years_exp?: number | null;
  yearsExperience?: number | null;
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
  draftTargetScore: number | null;
  recommendationTier: RecommendationTier;
  scoreComponents: {
    rankingScore: number;
    projectionScore: number;
    valueScore: number;
    rosterNeedScore: number;
    scarcityScore: number;
    formatFitScore: number;
    adpValueScore: number;
    matchConfidencePenalty: number;
  } | null;
  reasons: string[];
  warnings: string[];
  inputCompleteness?: InputCompleteness;
  positionScoringMode?: PositionScoringMode;
};

type PickLine = {
  player_name: string | null;
  position: string | null;
  team: string | null;
  pick_no: number;
  round: number | null;
  pick_in_round: number | null;
  platform_roster_id: string | null;
  roster_label?: string | null;
};

type DraftBoardTeam = {
  rosterId: string;
  label: string;
  ownerPlatformUserId: string | null;
  draftSlot: number;
  mappingSource?: string;
};

type DraftState = {
  room: { id: string; status: string | null; last_synced_at: string | null };
  league: {
    name: string | null;
    is_dynasty?: boolean | null;
    is_best_ball?: boolean | null;
    is_superflex?: boolean | null;
    is_two_qb?: boolean | null;
    te_premium?: number | null;
    roster_positions_json?: string[] | null;
    scoring_settings_json?: Record<string, number | string | boolean | null> | null;
  } | null;
  picks: PickLine[];
  currentPickNumber: number;
  currentRound: number;
  picksUntilMyNextPick: number | null;
  myDraftSlot: number | null;
  teamCount: number | null;
  lastPick: PickLine | null;
  myRoster: PickLine[];
  draftedPlayerIds?: string[];
  draftBoardTeams: DraftBoardTeam[];
  positionCounts: Record<string, number>;
  blackbirdRankPlayers?: AvailablePlayer[];
  remainingPlayers: AvailablePlayer[];
  draftablePlayers?: AvailablePlayer[];
  recommendations: AvailablePlayer[];
  h10ValueOverlay?: WarRoomValueOverlayRow[];
  h10ValueOverlayDiagnostics?: WarRoomValueOverlayResult["diagnostics"];
  h10RecommendationPreview?: WarRoomRecommendationRow[];
  h10RecommendationDiagnostics?: WarRoomRecommendationResult["diagnostics"];
  h10RecommendationExperimentDiagnostics?: H10RecommendationExperimentDiagnostics;
  h10RecommendationPreviewEnabled?: boolean;
  h10RecommendationExperimentEnabled?: boolean;
  h10InternalTrustedExperimentEnabled?: boolean;
  h10InternalTrustedExperimentAllowed?: boolean;
  h10InternalTrustedExperimentGating?: "env_only" | "trusted_user_allowlist";
  fallbackRelevanceDiagnostics?: {
    fallbackRowsTotal: number;
    fallbackRowsIncluded: number;
    fallbackRowsExcluded: number;
    fallbackRelevanceDistribution: Record<string, number>;
    projectionlessFallbackRows: number;
    historicalOnlyRows: number;
    diagnosticFallbackRows: number;
    draftRelevantFallbackRows: number;
    formatExcludedFallbackRows: number;
    includeDiagnosticFallbacks: boolean;
    topExcludedFallbackExamples: Array<{
      player_name: string | null;
      position: string | null;
      team: string | null;
      reasonExcluded: string;
      rank: number | null;
      adp: number | null;
      hasH10Value: boolean;
      isFallback: boolean;
    }>;
  };
  topNeeds: Array<{
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
  rosterRequirements: {
    directStarters: Record<string, number>;
    offensiveFlexCount: number;
    superflexCount: number;
    idpFlexCount: number;
    benchCount: number;
    irCount: number;
    taxiCount: number;
    hasIDP: boolean;
    hasKicker: boolean;
    hasTeamDefense: boolean;
    unknownSlots: string[];
  };
  positionNeeds: Array<{
    position: string;
    label: string;
    draftedCount: number;
    directStarterRequirement: number;
    sharedFlexDemand: number;
    minimumNeed: number;
    deficit: number;
    needLevel: "urgent" | "high" | "moderate" | "low" | "filled" | "not_used";
    kind: "direct" | "shared" | "depth";
    note?: string;
  }>;
  hasIDP: boolean;
  hasKicker: boolean;
  hasTeamDefense: boolean;
  unknownRosterSlots: string[];
  rankingsUploaded: boolean;
  boardLabel: string;
  scoringMetadata: {
    formulaVersion: string;
    generatedAt: string;
    draftStage: "early" | "middle" | "late";
    inputsUsed: string[];
    limitations: string[];
    weights: {
      ranking: number;
      projection: number;
      value: number;
      rosterNeed: number;
      scarcity: number;
      formatFit: number;
      adpValue: number;
    };
    supportedScoredPositions: string[];
    positionScoringModes: PositionScoringMode[];
    idpScoringDetected: boolean;
    rankingsOnlyPositions: string[];
  };
  warnings: string[];
  warningMessages: string[];
  warning: string | null;
};

type PlayerProfileResponse = {
  player: {
    id: string;
    sleeperPlayerId: string | null;
    fullName: string | null;
    position: string | null;
    team: string | null;
    status: string | null;
  };
  projection: {
    projectionRunId: string;
    projectionSeason: number | null;
    asOfDate: string | null;
    position: string;
    projectedPpgWhenInRole: number;
    floorPoints: number;
    medianPoints: number;
    ceilingPoints: number;
    upsidePoints: number;
    confidenceLabel: string;
    projectedPositionRank: number | null;
    projectionMethod: string;
    statLine: Array<{ key: string; label: string; value: number }>;
  } | null;
  history: Array<{
    season: number;
    team: string | null;
    position: string | null;
    gamesPlayed: number | null;
    gamesStarted: number | null;
    fantasyPoints: number | null;
    statLine: Array<{ key: string; label: string; value: number }>;
  }>;
  dataAvailability: {
    projection: boolean;
    projectedStatLine: boolean;
    historicalSeasons: number;
  };
};

type PlayerProfileLoadState = {
  status: "idle" | "loading" | "ready" | "error";
  profile: PlayerProfileResponse | null;
  error: string | null;
};

type SelectedPlayerSummary = {
  playerName: string;
  position: string | null;
  team: string | null;
};

type HistoricalPlayerProfileResponse = {
  status?: string;
  profile: PlayerProfileReadModel;
  lookup: {
    matchedBy: string;
    artifactBacked: boolean;
    readOnly: boolean;
  };
  scoring: PlayerProfileScoringMetadata;
};

type HistoricalProfileLoadState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  profile: HistoricalPlayerProfileResponse["profile"] | null;
  scoring: HistoricalPlayerProfileResponse["scoring"] | null;
  error: string | null;
  reason: "artifact_unavailable" | "not_found" | "ambiguous" | "error" | null;
};

type PreDraftStrategyResponse = {
  strategyPreviewLabel: string;
  leagueSummary: {
    leagueName: string | null;
    teams: number | null;
    rounds: number | null;
    scoringType: string;
    formats: string[];
    superflexOr2Qb: boolean;
    tePremium: boolean;
    idp: boolean;
    kicker: boolean;
    teamDefense: boolean;
    flexStructure: string[];
  };
  scoringEmphasis: Array<{ signal: string; position: string; priority: string; reason: string }>;
  rosterConstructionPlan: Array<{ phase: string; guidance: string; positions: string[] }>;
  positionalPriorityMap: Record<string, { priority: string; score: number; reasons: string[] }>;
  draftSlotStrategy: {
    slot: number | null;
    teamCount: number | null;
    archetype: string;
    expectedLongWaitPicks: number | null;
    draftSlotBand?: string;
    isTurnPick?: boolean;
    isNearTurn?: boolean;
    averagePicksBetweenTurns?: number | null;
    maxWaitUntilNextPick?: number | null;
    turnPairingRisk?: string;
    slotStrategySummary?: string;
    projectedUserPicks?: Array<{ round: number; pickInRound: number; overallPick: number; window: string }>;
    roundPickWindows?: Array<{ label: string; rounds: string; picks: number[]; guidance: string }>;
    roundWindowPlanBySlot?: Array<{ window: string; rounds: string; picks: number[]; guidance: string }>;
    timingSignals: string[];
    positionsAtRiskBeforeNextTurn: string[];
  };
  roundWindowPlan: Array<{ window: string; rounds: string; positions: string[]; guidance: string }>;
  roundWindowPlanDetailed?: Array<{
    window: string;
    rounds: string;
    projectedPicks: number[];
    primaryPositions: string[];
    avoidForcingPositions: string[];
    likelyValuePockets: string[];
    tierCliffRisks: string[];
    contingencyTriggers: string[];
    fallbackPath: string;
    guidance: string;
  }>;
  contingencyTriggers?: Array<{
    id: string;
    label: string;
    appliesToRounds: number[];
    appliesToPositions: string[];
    triggerConditionSummary: string;
    suggestedAdjustment: string;
    riskLevel: "low" | "medium" | "high";
    confidence: "low" | "medium" | "high";
    reasons: string[];
  }>;
  tierCliffWatchlist: Array<{ position: string; label: string; tier: number | null; risk: string; reason: string }>;
  valuePocketWatchlist: Array<{ position: string; label: string; marketSignal: string | null; reason: string }>;
  waitPositions: Array<{ position: string; confidence: string; reason: string; targetCount: number }>;
  doNotForcePositions: Array<{ position: string; reason: string }>;
  contingencyPlans: Array<{ trigger: string; response: string }>;
  specialPositionGuidance: Array<{ position: string; guidance: string }>;
  riskNotes: string[];
  explanationFragments: string[];
  dataGaps: string[];
  safetyLanguageStatus?: { passed: boolean; failures: string[] };
};

type StrategyLoadState = {
  status: "loading" | "ready" | "error";
  strategy: PreDraftStrategyResponse | null;
  error: string | null;
};

const POSITIONS = ["All", "QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const MATCH_FILTERS = ["All", "Matched", "Issues"];
const BOARD_SORTS: Array<{ value: BlackbirdBoardSortKey; label: string }> = [
  { value: "blackbird", label: "Blackbird rank" },
  { value: "projection", label: "Projection" },
  { value: "value", label: "Value" },
];
const BOARD_VIEW_MODES = [
  { value: "draft_suggestions", label: "Draft Suggestions" },
  { value: "full_blackbird", label: "Full Blackbird Rank" },
  { value: "available_blackbird", label: "Available Blackbird Rank" },
] as const;
type BoardViewMode = (typeof BOARD_VIEW_MODES)[number]["value"];
const POSITION_SORT_ORDER: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DEF: 6,
  DL: 7,
  LB: 8,
  DB: 9,
};

export function DraftWarRoom({ draftRoomId, disableAutoSync = false }: { draftRoomId: string; disableAutoSync?: boolean }) {
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [positionFilter, setPositionFilter] = useState("All");
  const [matchFilter, setMatchFilter] = useState("All");
  const [boardSort, setBoardSort] = useState<BlackbirdBoardSortKey>("blackbird");
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>("draft_suggestions");
  const [visibleBoardRows, setVisibleBoardRows] = useState(50);
  const [search, setSearch] = useState("");
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<PlayerProfileLoadState>({
    status: "idle",
    profile: null,
    error: null,
  });
  const [selectedPlayerSummary, setSelectedPlayerSummary] = useState<SelectedPlayerSummary | null>(null);
  const [selectedHistoricalProfile, setSelectedHistoricalProfile] = useState<HistoricalProfileLoadState>({
    status: "idle",
    profile: null,
    scoring: null,
    error: null,
    reason: null,
  });
  const [recommendationSource, setRecommendationSource] = useState<H10RecommendationSource>(DEFAULT_H10_RECOMMENDATION_SOURCE);
  const [strategyState, setStrategyState] = useState<StrategyLoadState>({
    status: "loading",
    strategy: null,
    error: null,
  });

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/draft-rooms/${draftRoomId}/state`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Unable to load draft room.");
      return;
    }
    setState(payload as DraftState);
    setError(null);
  }, [draftRoomId]);

  const loadStrategy = useCallback(async () => {
    setStrategyState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const response = await fetch(`/api/draft-rooms/${draftRoomId}/pre-draft-strategy`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setStrategyState({
          status: "error",
          strategy: null,
          error: response.status === 401 || response.status === 404
            ? "Strategy preview is unavailable. War Room remains usable."
            : payload.error ?? "Unable to load strategy preview. War Room remains usable.",
        });
        return;
      }
      setStrategyState({ status: "ready", strategy: payload as PreDraftStrategyResponse, error: null });
    } catch {
      setStrategyState({
        status: "error",
        strategy: null,
        error: "Unable to load strategy preview. War Room remains usable.",
      });
    }
  }, [draftRoomId]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    const response = await fetch(`/api/draft-rooms/${draftRoomId}/sync`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Sync failed.");
    }
    setSyncing(false);
    await loadState();
    await loadStrategy();
  }, [draftRoomId, loadState, loadStrategy]);

  const loadHistoricalPlayerProfile = useCallback(async (row: BlackbirdBoardRow) => {
    const lookupId = row.playerId ?? row.playerName;
    if (!lookupId) {
      setSelectedHistoricalProfile({ status: "empty", profile: null, scoring: null, error: null, reason: "not_found" });
      return;
    }

    setSelectedHistoricalProfile({ status: "loading", profile: null, scoring: null, error: null, reason: null });
    const params = new URLSearchParams({ weeklyLimit: "8", draftRoomId });
    if (row.position) params.set("position", row.position);

    try {
      const response = await fetch(`/api/player-profiles/${encodeURIComponent(lookupId)}?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as Partial<HistoricalPlayerProfileResponse> & { error?: string };
      if (response.status === 404 && payload.status === "ambiguous_duplicate_lookup") {
        setSelectedHistoricalProfile({ status: "empty", profile: null, scoring: null, error: null, reason: "ambiguous" });
        return;
      }
      if (response.status === 404) {
        setSelectedHistoricalProfile({ status: "empty", profile: null, scoring: null, error: null, reason: "not_found" });
        return;
      }
      if (payload.status === "artifact_missing" || payload.status === "artifact_unreadable" || payload.status === "artifact_invalid") {
        setSelectedHistoricalProfile({
          status: "empty",
          profile: null,
          scoring: null,
          error: null,
          reason: "artifact_unavailable",
        });
        return;
      }
      if (!response.ok || !payload.profile) {
        setSelectedHistoricalProfile({
          status: "error",
          profile: null,
          scoring: null,
          error: payload.error ?? "Historical profile not available yet.",
          reason: "error",
        });
        return;
      }

      setSelectedHistoricalProfile({ status: "ready", profile: payload.profile, scoring: payload.scoring ?? null, error: null, reason: null });
    } catch {
      setSelectedHistoricalProfile({
        status: "error",
        profile: null,
        scoring: null,
        error: "Historical profile not available yet.",
        reason: "error",
      });
    }
  }, [draftRoomId]);

  const openPlayerProfile = useCallback(async (row: BlackbirdBoardRow) => {
    setSelectedPlayerSummary({ playerName: row.playerName, position: row.position, team: row.team });
    setSelectedPlayerProfile({ status: "loading", profile: null, error: null });
    void loadHistoricalPlayerProfile(row);
    if (!row.playerId) {
      setSelectedPlayerProfile({
        status: "error",
        profile: null,
        error: "League projection profile is not available for this player yet.",
      });
      return;
    }
    try {
      const response = await fetch(
        `/api/draft-rooms/${draftRoomId}/players/${encodeURIComponent(row.playerId)}/profile`,
        { cache: "no-store" }
      );
      const payload = await response.json();
      if (!response.ok) {
        setSelectedPlayerProfile({
          status: "error",
          profile: null,
          error: payload.error ?? "Unable to load player profile.",
        });
        return;
      }
      setSelectedPlayerProfile({ status: "ready", profile: payload as PlayerProfileResponse, error: null });
    } catch {
      setSelectedPlayerProfile({
        status: "error",
        profile: null,
        error: "Unable to load player profile.",
      });
    }
  }, [draftRoomId, loadHistoricalPlayerProfile]);

  const closePlayerProfile = useCallback(() => {
    setSelectedPlayerProfile({ status: "idle", profile: null, error: null });
    setSelectedPlayerSummary(null);
    setSelectedHistoricalProfile({ status: "idle", profile: null, scoring: null, error: null, reason: null });
  }, []);

  useEffect(() => {
    void loadStrategy();
    if (disableAutoSync) void loadState();
    else void syncNow();
    const interval = window.setInterval(loadState, 5000);
    return () => window.clearInterval(interval);
  }, [disableAutoSync, loadState, loadStrategy, syncNow]);

  useEffect(() => {
    setVisibleBoardRows(50);
  }, [boardSort, boardViewMode, matchFilter, positionFilter, search]);

  const blackbirdPlayerPool = useMemo(
    () => mergeDraftableAndRemainingPlayers(
      mergeDraftableAndRemainingPlayers(state?.blackbirdRankPlayers ?? [], state?.draftablePlayers ?? []),
      state?.remainingPlayers ?? []
    ),
    [state?.blackbirdRankPlayers, state?.draftablePlayers, state?.remainingPlayers]
  );

  const blackbirdBoard = useMemo(() => {
    const scoringSettings =
      state?.league?.scoring_settings_json && typeof state.league.scoring_settings_json === "object"
        ? state.league.scoring_settings_json
        : null;
    return buildBlackbirdBoard({
      players: blackbirdPlayerPool,
      overlays: state?.h10ValueOverlay ?? [],
      recommendations: state?.h10RecommendationPreview ?? [],
      draftedPlayerIds: state?.draftedPlayerIds ?? [],
      sortKey: boardSort,
      leagueContext: {
        isDynasty: Boolean(state?.league?.is_dynasty),
        isBestBall: Boolean(state?.league?.is_best_ball),
        isSuperflex: Boolean(state?.league?.is_superflex),
        isTwoQb: Boolean(state?.league?.is_two_qb),
        tePremium: Number(state?.league?.te_premium ?? 0),
        hasIDP: Boolean(state?.hasIDP),
        hasKicker: Boolean(state?.hasKicker),
        hasTeamDefense: Boolean(state?.hasTeamDefense),
        rosterPositions: Array.isArray(state?.league?.roster_positions_json) ? state.league.roster_positions_json : [],
        scoringSettings,
      },
      includeDrafted: true,
    });
  }, [
    blackbirdPlayerPool,
    boardSort,
    state?.draftedPlayerIds,
    state?.h10RecommendationPreview,
    state?.h10ValueOverlay,
    state?.league,
    state?.hasIDP,
    state?.hasKicker,
    state?.hasTeamDefense,
  ]);

  const livePlanStatus = useMemo(() => {
    if (!state) return null;
    return buildLivePlanStatus({
      draftRoomId,
      currentPickNumber: state.currentPickNumber,
      currentRound: state.currentRound,
      myDraftSlot: state.myDraftSlot,
      teamCount: state.teamCount,
      picksUntilMyTurn: state.picksUntilMyNextPick,
      positionCounts: state.positionCounts,
      strategy: strategyState.strategy,
      boardRows: blackbirdBoard.rows,
      draftedPlayerIds: state.draftedPlayerIds ?? [],
    });
  }, [blackbirdBoard.rows, draftRoomId, state, strategyState.strategy]);

  const planFitBoardRows = useMemo(
    () => {
      const scoringSettings =
        state?.league?.scoring_settings_json && typeof state.league.scoring_settings_json === "object"
          ? state.league.scoring_settings_json
          : null;
      const leagueRank = buildBlackbirdLeagueRank({
        players: blackbirdPlayerPool,
        overlays: state?.h10ValueOverlay ?? [],
        recommendations: state?.h10RecommendationPreview ?? [],
        draftedPlayerIds: state?.draftedPlayerIds ?? [],
        leagueContext: {
          isDynasty: Boolean(state?.league?.is_dynasty),
          isBestBall: Boolean(state?.league?.is_best_ball),
          isSuperflex: Boolean(state?.league?.is_superflex),
          isTwoQb: Boolean(state?.league?.is_two_qb),
          tePremium: Number(state?.league?.te_premium ?? 0),
          hasIDP: Boolean(state?.hasIDP),
          hasKicker: Boolean(state?.hasKicker),
          hasTeamDefense: Boolean(state?.hasTeamDefense),
          rosterPositions: Array.isArray(state?.league?.roster_positions_json) ? state.league.roster_positions_json : [],
          scoringSettings,
        },
      });
      const suggestions = buildLiveDraftSuggestions({
        leagueRankRows: leagueRank.rows,
        draftedPlayerIds: state?.draftedPlayerIds ?? [],
        positionCounts: state?.positionCounts,
        positionNeeds: state?.positionNeeds,
        currentPickNumber: state?.currentPickNumber,
        picksUntilMyTurn: state?.picksUntilMyNextPick,
        livePlanStatus,
      });
      const suggestionById = new Map(suggestions.rows.map((row) => [row.playerId, row]));
      const rowsWithLiveSuggestions = applyLivePlanFitToBoardRows(blackbirdBoard.rows, livePlanStatus).map((row) => {
        const suggestion = row.playerId ? suggestionById.get(row.playerId) : undefined;
        return suggestion
          ? {
              ...row,
              draftSuggestionRank: suggestion.draftSuggestionRank,
              draftSuggestionScore: suggestion.suggestionScore,
              draftSuggestionType: suggestion.suggestionType,
              needTimingAction: suggestion.timingAction,
            }
          : row;
      });
      return withFallbackDraftSuggestionRanks(rowsWithLiveSuggestions);
    },
    [blackbirdBoard.rows, blackbirdPlayerPool, livePlanStatus, state]
  );

  const filteredBoardRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const viewRows = planFitBoardRows
      .filter((row) => {
        if (boardViewMode === "draft_suggestions") return !row.drafted && row.draftSuggestionRank !== null;
        if (boardViewMode === "available_blackbird") return !row.drafted;
        return true;
      })
      .sort((a, b) => {
        if (boardViewMode === "draft_suggestions") return (a.draftSuggestionRank ?? 999999) - (b.draftSuggestionRank ?? 999999);
        return a.blackbirdBoardRank - b.blackbirdBoardRank;
      });
    return viewRows
      .filter((row) => positionFilter === "All" || row.position === positionFilter)
      .filter((row) => !needle || row.playerName.toLowerCase().includes(needle))
      .filter((row) => {
        if (matchFilter === "Matched") return Boolean(row.playerId);
        if (matchFilter === "Issues") return row.confidence === "low" || row.risk === "high" || row.dataStatus.projection === "unavailable";
        return true;
      });
  }, [boardViewMode, matchFilter, planFitBoardRows, positionFilter, search]);

  const visibleBlackbirdRows = filteredBoardRows.slice(0, visibleBoardRows);

  if (error && !state) {
    return (
      <div className="rf-panel p-6">
        <h1 className="text-xl font-black text-red-200">War Room state could not load</h1>
        <p className="mt-2 text-sm text-slate-300">{error}</p>
        <p className="mt-2 text-xs text-slate-500">Refresh the room or sync the league before relying on draft board, roster, or preview signals.</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rf-panel p-6">
        <h1 className="text-xl font-black text-slate-100">Loading draft room state</h1>
        <p className="mt-2 text-sm text-slate-400">Syncing picks, roster construction, available players, and preview signals.</p>
      </div>
    );
  }

  const recentPicks = state.picks.slice(-24).reverse();
  const totalDraftedByMe = state.myRoster.length;
  const draftBoardTeams = state.draftBoardTeams ?? [];
  const selectedTeam =
    draftBoardTeams.find((team) => team.rosterId === selectedRosterId) ??
    draftBoardTeams.find((team) => team.draftSlot === state.myDraftSlot) ??
    draftBoardTeams[0] ??
    null;
  const selectedTeamPicks = selectedTeam ? state.picks.filter((pick) => pick.platform_roster_id === selectedTeam.rosterId) : [];
  const strategyProminent = !state.picks.length || state.currentRound <= 2;

  return (
    <div className="space-y-6">
      <section className="rf-panel p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black sm:text-3xl">{state.league?.name ?? "Draft War Room"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
              <span>Pick {state.currentPickNumber}</span>
              <span>Round {state.currentRound}</span>
              <span>Until turn {state.picksUntilMyNextPick ?? "N/A"}</span>
              <span>{state.picks.length} drafted</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="text-xs text-slate-500">
              Last synced {state.room.last_synced_at ? new Date(state.room.last_synced_at).toLocaleTimeString() : "never"}
            </div>
            <button className="rf-button" onClick={syncNow} disabled={syncing}>
              <RefreshCw className="h-4 w-4" />
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </section>

      {strategyProminent ? <PreDraftStrategyPanel loadState={strategyState} prominent /> : null}

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-5">
          <section className="rf-panel overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-xl font-bold">Draft Board</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {(state.teamCount ?? draftBoardTeams.length) || "Unknown"} teams · Slot {state.myDraftSlot ?? "-"} · {recentPicks.length} recent picks
                  </p>
                </div>
                {draftBoardTeams.length ? (
                  <label className="grid gap-2 text-sm text-slate-300 sm:flex sm:items-center">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500">View roster</span>
                    <select
                      className="rf-input min-w-0 sm:min-w-[220px]"
                      value={selectedTeam?.rosterId ?? ""}
                      onChange={(event) => setSelectedRosterId(event.target.value)}
                    >
                      {draftBoardTeams.map((team) => (
                        <option key={team.rosterId} value={team.rosterId}>
                          Slot {team.draftSlot} · {team.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
            <SleeperStyleDraftBoard picks={state.picks} teams={draftBoardTeams} myDraftSlot={state.myDraftSlot} currentPickNumber={state.currentPickNumber} />
            {selectedTeam ? <TeamRosterStrip team={selectedTeam} picks={selectedTeamPicks} /> : null}
          </section>

          <section className="rf-panel overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold">Blackbird Board</h2>
                    <span className="rounded-full border border-line bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-slate-400">Read-only</span>
                    <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[11px] uppercase tracking-wide text-brand">Experimental</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Draft Suggestion is live and available-only. Blackbird Rank is static league value across draftable players.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_180px_120px_120px_160px]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      className="rf-input pl-9"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search players"
                    />
                  </label>
                  <select className="rf-input" value={boardViewMode} onChange={(event) => setBoardViewMode(event.target.value as BoardViewMode)}>
                    {BOARD_VIEW_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                  <select className="rf-input" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
                    {POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                  <select className="rf-input" value={matchFilter} onChange={(event) => setMatchFilter(event.target.value)}>
                    {MATCH_FILTERS.map((filter) => (
                      <option key={filter} value={filter}>
                        {filter}
                      </option>
                    ))}
                  </select>
                  <select className="rf-input" value={boardSort} onChange={(event) => setBoardSort(event.target.value as BlackbirdBoardSortKey)}>
                    {BOARD_SORTS.map((sort) => (
                      <option key={sort.value} value={sort.value}>
                        {sort.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Showing {visibleBlackbirdRows.length} of {filteredBoardRows.length} players · {blackbirdBoard.diagnostics.marketRows} ranked · {blackbirdBoard.diagnostics.projectionRows} with projections
              </div>
            </div>
            <AvailablePlayersTable rows={visibleBlackbirdRows} onSelectPlayer={openPlayerProfile} />
            <div className="flex flex-col gap-2 border-t border-line bg-panel2/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                Showing {visibleBlackbirdRows.length} of {filteredBoardRows.length} filtered players. Filters and sort are local to this browser view.
              </p>
              {visibleBlackbirdRows.length < filteredBoardRows.length ? (
                <button className="rf-button-secondary justify-center" type="button" onClick={() => setVisibleBoardRows((count) => count + 50)}>
                  Load more
                </button>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="min-w-0 space-y-5">
          {!strategyProminent ? <PreDraftStrategyPanel loadState={strategyState} /> : null}

          <LivePlanStatusPanel status={livePlanStatus} />

          <SidePanel title="My Roster Construction">
            <RosterConstructionSummary state={state} />
            <div className="mt-3 rounded-md border border-line bg-panel2 px-3 py-2 text-sm">
              Total drafted: <span className="font-bold">{totalDraftedByMe}</span>
            </div>
            <NeedsList needs={state.topNeeds} />
          </SidePanel>

          <SidePanel title="Recommended Targets">
            {state.h10InternalTrustedExperimentAllowed ? (
              <InternalTrustedRecommendationPanel
                legacyRows={state.recommendations.slice(0, 10)}
                rankingsUploaded={state.rankingsUploaded}
                warningMessages={state.warningMessages}
                usesLimitedDataPositions={state.hasIDP || state.hasKicker || state.hasTeamDefense}
                blackbirdRows={state.h10RecommendationPreview ?? []}
                blackbirdDiagnostics={state.h10RecommendationDiagnostics ?? null}
                experimentDiagnostics={state.h10RecommendationExperimentDiagnostics ?? null}
                gating={state.h10InternalTrustedExperimentGating ?? "env_only"}
              />
            ) : state.h10RecommendationExperimentEnabled ? (
              <RecommendationSourcePanel
                source={recommendationSource}
                onSourceChange={setRecommendationSource}
                legacyRows={state.recommendations.slice(0, 10)}
                rankingsUploaded={state.rankingsUploaded}
                warningMessages={state.warningMessages}
                usesLimitedDataPositions={state.hasIDP || state.hasKicker || state.hasTeamDefense}
                blackbirdRows={state.h10RecommendationPreview ?? []}
                blackbirdDiagnostics={state.h10RecommendationDiagnostics ?? null}
                experimentDiagnostics={state.h10RecommendationExperimentDiagnostics ?? null}
              />
            ) : !state.rankingsUploaded && !state.recommendations.length && (state.h10RecommendationPreview || state.h10RecommendationDiagnostics) ? (
              <H10RecommendationPreview
                rows={state.h10RecommendationPreview ?? []}
                diagnostics={state.h10RecommendationDiagnostics ?? null}
                experimentDiagnostics={state.h10RecommendationExperimentDiagnostics ?? null}
                mode="preview"
              />
            ) : (
              <RecommendationList
                players={state.recommendations.slice(0, 10)}
                rankingsUploaded={state.rankingsUploaded}
                warningMessages={state.warningMessages}
                usesLimitedDataPositions={state.hasIDP || state.hasKicker || state.hasTeamDefense}
              />
            )}
            <NeedsList needs={state.topNeeds} compact />
            <ScoringMetadata metadata={state.scoringMetadata} />
          </SidePanel>

          {!state.h10RecommendationExperimentEnabled && (state.rankingsUploaded || state.recommendations.length > 0) && (state.h10RecommendationPreview || state.h10RecommendationDiagnostics) ? (
            <SidePanel title="Blackbird Value Preview">
              <H10RecommendationPreview
                rows={state.h10RecommendationPreview ?? []}
                diagnostics={state.h10RecommendationDiagnostics ?? null}
                experimentDiagnostics={state.h10RecommendationExperimentDiagnostics ?? null}
                mode="preview"
              />
            </SidePanel>
          ) : null}
        </aside>
      </div>
      {selectedPlayerProfile.status !== "idle" ? (
        <PlayerProfileModal
          loadState={selectedPlayerProfile}
          fallbackPlayer={selectedPlayerSummary}
          historicalProfileState={selectedHistoricalProfile}
          onClose={closePlayerProfile}
        />
      ) : null}
    </div>
  );
}

function SleeperStyleDraftBoard({
  picks,
  teams,
  myDraftSlot,
  currentPickNumber,
}: {
  picks: PickLine[];
  teams: DraftBoardTeam[];
  myDraftSlot: number | null;
  currentPickNumber: number;
}) {
  if (!teams.length) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-dashed border-line bg-panel2/60 px-4 py-6 text-sm text-slate-400">
          Team columns need synced league roster metadata. Sync the league to populate draft slots and roster labels.
        </div>
      </div>
    );
  }

  const maxRound = Math.max(1, ...picks.map((pick) => pick.round ?? 1), Math.ceil(currentPickNumber / Math.max(1, teams.length)));
  const picksByRoundAndSlot = new Map<string, PickLine>();
  for (const pick of picks) {
    const round = pick.round ?? Math.ceil(pick.pick_no / teams.length);
    const slot = pick.pick_in_round ?? inferDraftSlotForPick(pick.pick_no, teams.length);
    picksByRoundAndSlot.set(`${round}:${slot}`, pick);
  }

  return (
    <div>
      <div className="border-b border-line/70 px-4 py-3">
        <PositionLegend />
        {!picks.length ? (
          <p className="mt-2 text-xs text-slate-500">No picks are synced yet; empty slots are shown in snake order until Sleeper pick data arrives.</p>
        ) : null}
      </div>
      <div className="overflow-hidden">
        <div
          className="grid w-full gap-px bg-line/70 p-px"
          style={{ gridTemplateColumns: `clamp(34px, 3vw, 48px) repeat(${teams.length}, minmax(0, 1fr))` }}
        >
          <div className="bg-panel2 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Rd
          </div>
          {teams.map((team) => (
            <div
              key={team.rosterId}
              className={`min-w-0 bg-panel2 px-2 py-2 text-[11px] ${team.draftSlot === myDraftSlot ? "ring-1 ring-inset ring-gold/60" : ""}`}
            >
              <div className="truncate font-black text-slate-100">Slot {team.draftSlot}</div>
              <div className="mt-1 truncate text-slate-400">{team.label}</div>
              {team.draftSlot === myDraftSlot ? <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gold">My slot</div> : null}
            </div>
          ))}
          {Array.from({ length: maxRound }, (_, index) => index + 1).flatMap((round) => [
            <div key={`round-${round}`} className="flex items-center justify-center bg-panel2 text-xs font-black text-slate-300">
              {round}
            </div>,
            ...teams.map((team) => {
              const pick = picksByRoundAndSlot.get(`${round}:${team.draftSlot}`);
              const expectedPickNo = expectedPickNumber(round, team.draftSlot, teams.length);
              const isCurrent = expectedPickNo === currentPickNumber;
              return <DraftPickCard key={`${round}-${team.rosterId}`} pick={pick ?? null} expectedPickNo={expectedPickNo} isCurrent={isCurrent} />;
            }),
          ])}
        </div>
      </div>
    </div>
  );
}

function PositionLegend() {
  const positions = ["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"];
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      {positions.map((position) => (
        <span key={position} className={`rounded-full border px-2 py-1 font-bold ${draftBoardPositionBadgeClass(position)}`}>
          {position}
        </span>
      ))}
    </div>
  );
}

function DraftPickCard({ pick, expectedPickNo, isCurrent }: { pick: PickLine | null; expectedPickNo: number; isCurrent: boolean }) {
  if (!pick) {
    return (
      <div className={`min-h-[72px] min-w-0 bg-background/70 p-1.5 ${isCurrent ? "outline outline-2 outline-gold/70" : ""}`}>
        <div className="text-[11px] font-semibold text-slate-600">#{expectedPickNo}</div>
        {isCurrent ? <div className="mt-3 text-xs font-bold text-gold">On clock</div> : null}
      </div>
    );
  }

  const position = normalizeDraftBoardPosition(pick.position);
  return (
    <div className={`min-h-[72px] min-w-0 border p-1.5 ${draftBoardPositionCardClass(pick.position)}`}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-white/75">#{pick.pick_no}</span>
        <span className="rounded-full bg-black/25 px-1.5 py-0.5 font-bold text-white">{position}</span>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[13px] font-black leading-tight text-white">{pick.player_name ?? "Unknown"}</div>
      <div className="mt-1 truncate text-[11px] text-white/75">{pick.team ?? pick.roster_label ?? "-"}</div>
    </div>
  );
}

function TeamRosterStrip({ team, picks }: { team: DraftBoardTeam; picks: PickLine[] }) {
  const grouped = picks.reduce<Record<string, PickLine[]>>((acc, pick) => {
    const position = normalizeDraftBoardPosition(pick.position);
    acc[position] = acc[position] ?? [];
    acc[position].push(pick);
    return acc;
  }, {});
  const positions = Object.keys(grouped).sort((a, b) => (POSITION_SORT_ORDER[a] ?? 99) - (POSITION_SORT_ORDER[b] ?? 99) || a.localeCompare(b));

  return (
    <div className="border-t border-line bg-panel2/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-black text-slate-100">{team.label}</div>
          <div className="text-xs text-slate-500">Slot {team.draftSlot} · {picks.length} picks</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {positions.map((position) => (
            <span key={position} className={`rounded-full border px-2 py-1 text-[11px] font-bold ${draftBoardPositionBadgeClass(position)}`}>
              {position} {grouped[position].length}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((pick) => (
          <div key={pick.pick_no} className="rounded-md border border-line bg-background/60 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-100">{pick.player_name ?? "Unknown"}</span>
              <span className={`rounded-full border px-2 py-0.5 font-bold ${draftBoardPositionBadgeClass(pick.position)}`}>{normalizeDraftBoardPosition(pick.position)}</span>
            </div>
            <div className="mt-1 text-slate-500">Pick {pick.pick_no} · Round {pick.round ?? "-"}</div>
          </div>
        ))}
        {!picks.length ? <p className="text-sm text-slate-400">No synced picks for this team yet. Sync Sleeper draft picks to populate this roster view.</p> : null}
      </div>
    </div>
  );
}

function LivePlanStatusPanel({ status }: { status: LivePlanStatus | null }) {
  if (!status) {
    return (
      <SidePanel title="Live Plan Status">
        <div className="rounded-md border border-line bg-panel2 px-3 py-3 text-sm text-slate-400">
          Insufficient data to score the live plan.
        </div>
      </SidePanel>
    );
  }

  const activeSignals = [
    ...status.triggeredContingencies.slice(0, 2).map((item) => ({
      label: "Contingency active",
      text: item.label,
      tone: "gold" as const,
    })),
    ...status.tierRiskStatus.filter((item) => item.riskLevel !== "low").slice(0, 2).map((item) => ({
      label: "Tier risk rising",
      text: item.summary,
      tone: "red" as const,
    })),
    ...status.valueFallStatus.slice(0, 2).map((item) => ({
      label: "Unexpected value signal",
      text: item.summary,
      tone: "brand" as const,
    })),
    ...status.waitPlanStatus.filter((item) => item.status !== "not_waiting").slice(0, 2).map((item) => ({
      label: item.status === "supported" ? "Wait plan supported" : "Wait plan weakening",
      text: item.summary,
      tone: item.status === "supported" ? "green" as const : "gold" as const,
    })),
  ].slice(0, 6);

  return (
    <SidePanel title="Live Plan Status">
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-panel2 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <LivePlanBadge status={status.overallStatus} label={status.statusLabel} />
            {status.activeRoundWindowIds.slice(0, 2).map((windowId) => (
              <span key={windowId} className="rounded-full border border-line bg-background px-2 py-1 text-[11px] font-bold text-slate-300">
                {windowId}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{status.statusSummary}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <MiniDetail label="Pick" value={formatNullableNumber(status.currentPickNumber)} />
            <MiniDetail label="Round" value={formatNullableNumber(status.currentRound)} />
            <MiniDetail label="Until turn" value={formatNullableNumber(status.picksUntilMyTurn)} />
          </div>
        </div>

        {activeSignals.length ? (
          <div className="grid gap-2">
            {activeSignals.map((signal, index) => (
              <LiveSignal key={`${signal.label}-${index}`} label={signal.label} text={signal.text} tone={signal.tone} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-line bg-background/60 px-3 py-2 text-sm text-slate-400">
            No active contingency or tier alerts are visible.
          </p>
        )}

        <DetailList
          title="Focus"
          items={status.recommendedFocus.slice(0, 4).map((item) => `${item.label}: ${item.reason}`)}
        />
        <DetailList
          title="Position Plan"
          items={status.positionPlanStatus
            .filter((item) => ["thin", "behind", "intentionally_waiting", "avoid_forcing"].includes(item.status))
            .slice(0, 4)
            .map((item) => item.summary)}
        />
        <DetailList title="Data Gaps" items={status.dataGaps.slice(0, 5)} />
      </div>
    </SidePanel>
  );
}

function LivePlanBadge({ status, label }: { status: LivePlanStatus["overallStatus"]; label: string }) {
  const className =
    status === "on_plan" || status === "pre_draft"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : status === "slightly_off_plan" || status === "off_plan_recoverable"
        ? "border-brand/30 bg-brand/10 text-brand"
        : status === "contingency_active" || status === "needs_attention"
          ? "border-gold/35 bg-gold/10 text-gold"
          : "border-line bg-background text-slate-400";
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-black uppercase tracking-wide ${className}`}>{label}</span>;
}

function LiveSignal({ label, text, tone }: { label: string; text: string; tone: "gold" | "red" | "brand" | "green" }) {
  const className =
    tone === "red"
      ? "border-red-400/25 bg-red-500/10 text-red-100"
      : tone === "green"
        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
        : tone === "brand"
          ? "border-brand/25 bg-brand/10 text-brand"
          : "border-gold/30 bg-gold/10 text-gold";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${className}`}>
      <div className="text-[11px] font-black uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 leading-relaxed">{text}</div>
    </div>
  );
}

function AvailablePlayersTable({ rows, onSelectPlayer }: { rows: BlackbirdBoardRow[]; onSelectPlayer: (row: BlackbirdBoardRow) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1420px] text-left text-sm">
        <thead className="bg-panel2 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-3">Suggestion</th>
            <th className="px-3 py-3">Blackbird Power Rank</th>
            <th className="px-3 py-3">Player + Details</th>
            <th className="px-3 py-3">Position</th>
            <th className="px-3 py-3">Team</th>
            <th className="px-3 py-3">Season Projection</th>
            <th className="px-3 py-3">PAR</th>
            <th className="px-3 py-3">Static Value</th>
            <th className="px-3 py-3">Trust</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Live Fit</th>
            <th className="px-3 py-3">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.playerId ?? row.playerName}-${row.blackbirdBoardRank}`} className="border-t border-line/70">
              <td className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black text-brand">{row.draftSuggestionRank === null ? "-" : `#${row.draftSuggestionRank}`}</span>
                  {row.blackbirdValueScore === null ? null : (
                    <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-xs font-black text-brand">
                      {formatNumber(row.blackbirdValueScore)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{formatTimingAction(row.needTimingAction)}</div>
              </td>
              <td className="px-3 py-3 text-lg font-black text-slate-100">#{row.blackbirdBoardRank}</td>
              <td className="px-3 py-3">
                <button
                  type="button"
                  className="block max-w-[260px] truncate text-left font-medium text-slate-100 underline decoration-brand/40 underline-offset-4 hover:text-brand"
                  onClick={() => onSelectPlayer(row)}
                >
                  {row.playerName}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{row.playerId ? "Matched context" : "Fallback context"}</span>
                  <span>{row.dataStatus.ordering.replace("_", " ")}</span>
                  {row.drafted ? <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">Drafted</span> : null}
                </div>
                <p className="mt-2 max-w-[520px] text-xs leading-relaxed text-slate-400">{blackbirdRankSummary(row)}</p>
                <BlackbirdBoardPlayerDetails row={row} />
              </td>
              <td className="px-3 py-3"><PositionBadge position={row.position} /></td>
              <td className="px-3 py-3">{row.team || "-"}</td>
              <td className="px-3 py-3">
                {row.dataStatus.projection === "available" ? (
                  <div className="min-w-[210px]">
                    <div className="grid grid-cols-3 gap-2">
                      <ProjectionMini label="Floor" value={row.projectionLow} />
                      <ProjectionMini label="Median" value={row.projectionPoints} />
                      <ProjectionMini label="Ceiling" value={row.projectionHigh} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>{projectionUnitLabel(row)}</span>
                      <ProjectionTrustBadge row={row} />
                    </div>
                  </div>
                ) : "Projection unavailable"}
              </td>
              <td className="px-3 py-3 font-black text-slate-100">{formatNullableNumber(row.pointsAboveReplacement)}</td>
              <td className="px-3 py-3 font-black text-brand">{row.blackbirdValueScore === null ? "-" : `${formatNumber(row.blackbirdValueScore)}/100`}</td>
              <td className="px-3 py-3"><ProjectionTrustBadge row={row} /></td>
              <td className="px-3 py-3 text-xs text-slate-300">{row.role ? row.role.replace(/_/g, " ") : "-"}</td>
              <td className="px-3 py-3 text-xs text-slate-300">{row.planFit.replace(/_/g, " ")}</td>
              <td className="px-3 py-3">
                <RiskScoreBlock row={row} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <EmptyTable colSpan={12} text="No players match these filters." /> : null}
        </tbody>
      </table>
    </div>
  );
}

function BlackbirdBoardPlayerDetails({ row }: { row: BlackbirdBoardRow }) {
  const detail = row.playerDetailContext;
  if (!detail) return null;
  const rookieContext = rookieDetailContext(row);
  return (
    <details className="group mt-2 max-w-[460px] rounded-md border border-line/70 bg-background/45 px-2 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-brand">
        <span>Details</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-2 text-slate-300">
        <div className="flex flex-wrap gap-1">
          <StrategyPill>Blackbird preview</StrategyPill>
          <StrategyPill>Read-only</StrategyPill>
          <StrategyPill>Experimental</StrategyPill>
          <StrategyPill>Profile evidence in modal</StrategyPill>
          <StrategyPill>{projectionTrustBadgeLabel(detail.projectionTrust)}</StrategyPill>
          {rookieContext.labels.map((label) => (
            <StrategyPill key={label}>{label}</StrategyPill>
          ))}
        </div>
        <p className="rounded-md border border-line/70 bg-panel2/60 px-3 py-2 text-slate-300">{blackbirdRankSummary(row)}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <MiniDetail label={projectionUnitLabel(row)} value={formatNullableNumber(detail.projection)} />
          <MiniDetail label="Floor" value={formatNullableNumber(detail.projectedFantasyPoints.low)} />
          <MiniDetail label="Ceiling" value={formatNullableNumber(detail.projectedFantasyPoints.high)} />
          <MiniDetail label="PAR" value={formatNullableNumber(detail.par)} />
          <MiniDetail label="Replacement" value={formatNullableNumber(detail.replacementMedianPoints)} />
          <MiniDetail label="Role" value={detail.role ? detail.role.replace(/_/g, " ") : "-"} />
          <MiniDetail label="Blackbird Rank" value={`#${formatNumber(detail.blackbirdRank)}`} />
          <MiniDetail label="Draft Suggestion" value={detail.draftSuggestionRank === null ? "-" : `#${detail.draftSuggestionRank}`} />
          <MiniDetail label="Value" value={formatNullableNumber(detail.valueScore)} />
          <MiniDetail label="Tier" value={detail.blackbirdTier === null ? "-" : String(detail.blackbirdTier)} />
        </div>
        {detail.valueScoreComponents ? (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Value Components</div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {Object.entries(detail.valueScoreComponents).slice(0, 8).map(([label, value]) => (
                <MiniDetail key={label} label={label.replace(/([A-Z])/g, " $1")} value={formatNullableNumber(value)} />
              ))}
            </div>
          </div>
        ) : null}
        <DetailList title="Why Blackbird Likes" items={detail.whyBlackbirdLikes.slice(0, 3)} />
        <DetailList title="Primary Value Drivers" items={(detail.valueExplanation?.primaryDrivers ?? []).slice(0, 4).map((driver) => `${driver.label}: ${driver.explanation}`)} />
        <DetailList title="Cautions" items={detail.whyBlackbirdIsCautious.slice(0, 3)} />
        <DetailList title="Projection Trust" items={detail.projectionTrust.reasons.slice(0, 4)} />
        {rookieContext.items.length ? <DetailList title="Rookie Context" items={rookieContext.items} /> : null}
        <DetailList title="Role Context" items={playerContextDisplayItems(row).slice(0, 6)} />
        <DetailList title="Wait Plan" items={detail.waitPlanContext.slice(0, 2)} />
        <DetailList title="Contingency" items={detail.contingencyContext.slice(0, 2)} />
        <DetailList title="Plan Fit" items={row.planFitReasons.slice(0, 4)} />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Data Status</div>
          <div className="mt-1">
            <BoardDataStatus row={row} />
          </div>
        </div>
        {detail.tierNeighborContext.previous.length || detail.tierNeighborContext.next.length ? (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Tier Neighbors</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {[...detail.tierNeighborContext.previous, ...detail.tierNeighborContext.next].slice(0, 4).map((neighbor) => (
                <span key={`${neighbor.rank}-${neighbor.playerName}`} className="rounded-full border border-line bg-panel2 px-2 py-1 text-[11px] text-slate-300">
                  #{neighbor.rank} {neighbor.playerName}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <DetailList title="Data Gaps" items={detail.dataGaps.slice(0, 4).map((gap) => gap === "none" ? "No explicit data gaps." : gap)} />
      </div>
    </details>
  );
}

function playerContextDisplayItems(row: BlackbirdBoardRow): string[] {
  const detail = row.playerDetailContext;
  const gaps = new Set([...row.contextualDataGaps, ...(detail?.dataGaps ?? [])].map((gap) => gap.toLowerCase()));
  return [
    row.role ? `Role context: ${row.role.replace(/_/g, " ")}` : "Role context: unknown",
    gaps.has("depth chart context") || gaps.has("confirmed depth chart role") ? "Depth chart scenario: data gap" : "Depth chart scenario: source unavailable or neutral",
    gaps.has("injury context") || gaps.has("confirmed injury status") ? "Injury context: data gap" : "Injury context: unknown unless sourced",
    gaps.has("physical profile") ? "Physical profile: data gap" : "Physical profile: not yet sourced",
    gaps.has("athletic testing") ? "Athletic profile: data gap" : "Athletic profile: not yet sourced",
    gaps.has("coaching environment") || gaps.has("team environment") ? "Coaching/team environment: data gap" : "Coaching/team environment: unknown unless sourced",
  ];
}

function rookieDetailContext(row: BlackbirdBoardRow): { labels: string[]; items: string[] } {
  const detail = row.playerDetailContext;
  const gaps = new Set([...row.contextualDataGaps, ...(detail?.dataGaps ?? [])].map((gap) => gap.toLowerCase()));
  const gapText = Array.from(gaps).join(" ");
  const isRookie =
    row.role === "rookie_unknown" ||
    detail?.role === "rookie_unknown" ||
    gapText.includes("rookie") ||
    gapText.includes("draft capital") ||
    gapText.includes("college production");
  if (!isRookie) return { labels: [], items: [] };

  const hasDraftCapitalGap = gapText.includes("draft capital");
  const hasCollegeGap = gapText.includes("college");
  const hasRoleGap = gapText.includes("role") || row.role === "rookie_unknown" || detail?.role === "rookie_unknown";
  const hasAnyEnrichedInput = !hasDraftCapitalGap || !hasCollegeGap || !hasRoleGap;
  const labels = [
    "Rookie projection",
    hasAnyEnrichedInput ? "Enriched rookie data available" : null,
    hasDraftCapitalGap ? "Missing draft capital" : "Draft capital available",
    hasCollegeGap ? "Missing college production" : "College production available",
    hasRoleGap ? "Role uncertainty" : null,
  ].filter((label): label is string => Boolean(label));

  const items = [
    "Rookie outputs use conservative position baselines adjusted only by available draft capital, college production, and role inputs.",
    hasAnyEnrichedInput ? "At least one rookie context input is available; unresolved fields remain explicit data gaps." : "No enrichment overlay inputs are available for this rookie yet.",
    hasDraftCapitalGap ? "NFL draft capital is missing or unresolved for this player." : "Draft capital is present and used only as an opportunity signal.",
    hasCollegeGap ? "College production is missing or unresolved for this player." : "College production is present and used to shape uncertainty/stat mix, not copied directly into NFL stats.",
    hasRoleGap ? "Landing spot role is uncertain, so confidence remains conservative." : "Role context is available for this rookie profile.",
  ];

  return { labels, items };
}

function ProjectionMini({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-md border border-line bg-background/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-black text-slate-100">{formatNullableNumber(value)}</div>
    </div>
  );
}

function ProjectionTrustBadge({ row }: { row: BlackbirdBoardRow }) {
  const trust = row.projectionTrust;
  const className =
    trust.trustLabel === "high"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
      : trust.trustLabel === "medium"
        ? "border-brand/25 bg-brand/10 text-brand"
        : trust.trustLabel === "low"
          ? "border-gold/30 bg-gold/10 text-gold"
          : "border-red-400/25 bg-red-500/10 text-red-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${className}`}>
      {trust.trustLabel.replace("_", " ")} trust
    </span>
  );
}

function RiskScoreBlock({ row }: { row: BlackbirdBoardRow }) {
  const teamRisk = teamRiskScore(row);
  const playerRisk = playerPerformanceRiskScore(row);
  return (
    <div className="min-w-[150px] space-y-2">
      <RiskMeter label="Team" value={teamRisk} />
      <RiskMeter label="Player" value={playerRisk} />
      <div className="text-[11px] text-slate-500">{row.confidence} confidence</div>
    </div>
  );
}

function RiskMeter({ label, value }: { label: string; value: number }) {
  const className = value >= 7 ? "text-red-200 border-red-400/30 bg-red-500/10" : value >= 4 ? "text-gold border-gold/30 bg-gold/10" : "text-emerald-200 border-emerald-400/30 bg-emerald-500/10";
  return (
    <div className={`rounded-md border px-2 py-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide opacity-80">{label}</span>
        <span className="font-black">{value}/10</span>
      </div>
    </div>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line/70 bg-panel2 px-2 py-1">
      <div className="uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-bold text-slate-200">{value}</div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="rounded-md border border-line/70 bg-panel2 px-2 py-1 text-[11px] text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayerProfileModal({
  loadState,
  fallbackPlayer,
  historicalProfileState,
  onClose,
}: {
  loadState: PlayerProfileLoadState;
  fallbackPlayer: SelectedPlayerSummary | null;
  historicalProfileState: HistoricalProfileLoadState;
  onClose: () => void;
}) {
  const profile = loadState.profile;
  const title = profile?.player.fullName ?? fallbackPlayer?.playerName ?? "Player Profile";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-6 sm:px-6">
      <div className="w-full max-w-5xl rounded-lg border border-line bg-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black text-slate-50">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {profile?.player.position ?? fallbackPlayer?.position ?? "-"} · {profile?.player.team ?? fallbackPlayer?.team ?? "-"} ·{" "}
              {profile?.player.status ?? "status unknown"}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-background text-slate-200 hover:border-brand/40 hover:text-brand"
            onClick={onClose}
            aria-label="Close player profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {loadState.status === "loading" ? (
            <div className="rounded-md border border-line bg-panel2 px-3 py-3 text-sm text-slate-300">Loading player profile...</div>
          ) : null}
          {loadState.status === "error" ? (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
              {loadState.error ?? "Unable to load player profile."}
            </div>
          ) : null}
          {profile ? (
            <>
              <section className="rounded-md border border-line bg-panel2 px-3 py-3">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-300">Upcoming Projection</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {profile.projection?.projectionSeason ?? "Projection season unavailable"} · Confidence{" "}
                      {profile.projection?.confidenceLabel ?? "unavailable"} · Rank{" "}
                      {profile.projection?.projectedPositionRank ?? "-"}
                    </p>
                  </div>
                  {profile.projection ? (
                    <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[360px]">
                      <H11MiniMetric label="Floor" value={formatNumber(profile.projection.floorPoints)} />
                      <H11MiniMetric label="Median" value={formatNumber(profile.projection.medianPoints)} />
                      <H11MiniMetric label="Ceiling" value={formatNumber(profile.projection.ceilingPoints)} />
                    </div>
                  ) : null}
                </div>
                {profile.projection ? (
                  <StatLineGrid items={profile.projection.statLine} empty="Projected stat components are not available for this player." />
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No league projection row is available for this player in this room.</p>
                )}
              </section>

              <section className="rounded-md border border-line bg-panel2 px-3 py-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-300">Previous Seasons</h3>
                {profile.history.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-2 py-2">Season</th>
                          <th className="px-2 py-2">Team</th>
                          <th className="px-2 py-2">G</th>
                          <th className="px-2 py-2">GS</th>
                          <th className="px-2 py-2">Fantasy Pts</th>
                          <th className="px-2 py-2">Stat Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.history.map((row) => (
                          <tr key={row.season} className="border-t border-line/70">
                            <td className="px-2 py-3 font-bold text-slate-100">{row.season}</td>
                            <td className="px-2 py-3">{row.team ?? "-"}</td>
                            <td className="px-2 py-3">{row.gamesPlayed ?? "-"}</td>
                            <td className="px-2 py-3">{row.gamesStarted ?? "-"}</td>
                            <td className="px-2 py-3">{row.fantasyPoints === null ? "-" : formatNumber(row.fantasyPoints)}</td>
                            <td className="px-2 py-3">
                              {row.statLine.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.statLine.slice(0, 8).map((stat) => (
                                    <span key={`${row.season}-${stat.key}`} className="rounded-full border border-line bg-background px-2 py-1 text-[11px] text-slate-300">
                                      {stat.label} {formatNumber(stat.value)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">Stat line unavailable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No previous season stat rows are available for this player.</p>
                )}
              </section>
            </>
          ) : null}
          <HistoricalPlayerProfilePanel state={historicalProfileState} />
        </div>
      </div>
    </div>
  );
}

function HistoricalPlayerProfilePanel({ state }: { state: HistoricalProfileLoadState }) {
  const profile = state.profile;
  const evidence = buildPlayerProfileEvidence({
    profile,
    scoring: state.scoring,
    unavailableReason: state.reason,
  });

  if (state.status === "loading" || state.status === "idle") {
    return (
      <section className="rounded-md border border-line bg-panel2 px-3 py-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-300">Historical Profile</h3>
        <p className="mt-3 text-sm text-slate-400">Loading historical profile...</p>
      </section>
    );
  }

  if (!profile || state.status === "empty" || state.status === "error") {
    const message =
      state.reason === "artifact_unavailable"
        ? "Historical profile data is not available in this deployment yet."
        : state.reason === "ambiguous"
          ? "Historical profile lookup is ambiguous and needs review."
          : "Historical profile not available yet.";
    return (
      <section className="rounded-md border border-line bg-panel2 px-3 py-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-300">Historical Profile</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        <HistoricalEvidenceCard evidence={evidence} />
      </section>
    );
  }

  const confidence = profile.identity.match_confidence.toLowerCase();
  const needsReviewNote = confidence === "medium" || confidence === "weak";
  const statSummary = buildHistoricalStatSummary(profile);
  const recentWeeklyRows = profile.weeklyGameLog.slice(0, 8);
  const scoringLabel = historicalScoringLabel(state.scoring);
  const coverageLabel = formatCoverageLabel(profile.careerMetadata?.coverageLabel ?? null);
  const careerWindow = profile.careerMetadata?.firstStatSeason && profile.careerMetadata.latestStatSeason
    ? `${profile.careerMetadata.firstStatSeason}-${profile.careerMetadata.latestStatSeason}`
    : "No stat window";
  const trendLabel = profile.trendMetrics?.trendLabel ? formatCoverageLabel(profile.trendMetrics.trendLabel) : "Insufficient data";

  return (
    <section className="rounded-md border border-line bg-panel2 px-3 py-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-300">Historical Profile</h3>
          <p className="mt-1 text-xs text-slate-500">
            Match confidence: <span className="font-bold text-slate-300">{profile.identity.match_confidence}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Career coverage: <span className="font-bold text-slate-300">{coverageLabel}</span>{" "}
            <span className="text-slate-600">({careerWindow})</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Trend: <span className="font-bold text-slate-300">{trendLabel}</span>
          </p>
          <p className="mt-2 inline-flex rounded-full border border-line bg-background/70 px-2 py-1 text-[11px] font-semibold text-slate-300">
            {scoringLabel}
          </p>
          <HistoricalEvidenceCard evidence={evidence} />
          {needsReviewNote ? (
            <p className="mt-2 rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-xs text-gold">
              Profile match confidence: {confidence}. Review may be needed.
            </p>
          ) : null}
          {profile.careerMetadata?.coverageNote ? (
            <p className="mt-2 rounded-md border border-line bg-background/60 px-2 py-1 text-xs text-slate-400">
              {profile.careerMetadata.coverageNote}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[420px] sm:grid-cols-3">
          <H11MiniMetric label="Career Games" value={formatNumber(profile.summaryMetrics.games)} />
          <H11MiniMetric label="Career Points" value={formatNumber(profile.summaryMetrics.total_points)} />
          <H11MiniMetric label="Career PPG" value={formatNullableNumber(profile.summaryMetrics.points_per_game)} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <H11MiniMetric label="Floor" value={formatNullableNumber(profile.summaryMetrics.floor)} />
        <H11MiniMetric label="Median" value={formatNullableNumber(profile.summaryMetrics.median)} />
        <H11MiniMetric label="Ceiling" value={formatNullableNumber(profile.summaryMetrics.ceiling)} />
        <H11MiniMetric label="Consistency" value={`${formatNumber(profile.summaryMetrics.consistency_score)}/100`} />
        <H11MiniMetric label="Spike" value={`${formatNumber(profile.summaryMetrics.spike_score)}/100`} />
        <H11MiniMetric label="Availability" value={`${formatNumber(profile.summaryMetrics.availability_score)}/100`} />
      </div>

      <HistoricalRoleUsagePanel profile={profile} />
      <HistoricalHighValueUsagePanel profile={profile} />

      {profile.warnings.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {profile.warnings.map((warning) => (
            <span key={warning} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-1 text-[11px] text-gold">
              {formatProfileWarning(warning)}
            </span>
          ))}
        </div>
      ) : null}

      {statSummary.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {statSummary.map((stat) => (
            <div key={stat.label} className="rounded-md border border-line/70 bg-background/50 px-2 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{stat.label}</div>
              <div className="mt-1 font-black text-slate-100">{formatNumber(stat.value)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {profile.seasonSummaries.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Season</th>
                <th className="px-2 py-2">Games</th>
                <th className="px-2 py-2">Points</th>
                <th className="px-2 py-2">PPG</th>
                <th className="px-2 py-2">Floor</th>
                <th className="px-2 py-2">Ceiling</th>
                <th className="px-2 py-2">Position Rank</th>
              </tr>
            </thead>
            <tbody>
              {profile.seasonSummaries.slice(0, 8).map((row) => (
                <tr key={`${row.season ?? "unknown"}-${row.positionRank ?? "rank"}`} className="border-t border-line/70">
                  <td className="px-2 py-3 font-bold text-slate-100">{row.season ?? "-"}</td>
                  <td className="px-2 py-3">{formatNumber(row.gamesPlayed)}</td>
                  <td className="px-2 py-3">{formatNumber(row.totalFantasyPoints)}</td>
                  <td className="px-2 py-3">{formatNullableNumber(row.pointsPerGame)}</td>
                  <td className="px-2 py-3">{formatNullableNumber(row.floor ?? null)}</td>
                  <td className="px-2 py-3">{formatNullableNumber(row.ceiling ?? null)}</td>
                  <td className="px-2 py-3">{row.positionRank === null ? "-" : `#${row.positionRank}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="text-xs font-black uppercase tracking-wide text-slate-400">Recent Weekly Game Log</div>
        {recentWeeklyRows.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Week</th>
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2">Opp</th>
                  <th className="px-2 py-2">Points</th>
                  <th className="px-2 py-2">Line</th>
                </tr>
              </thead>
              <tbody>
                {recentWeeklyRows.map((row) => (
                  <tr key={`${row.season ?? "season"}-${row.week ?? "week"}-${row.team ?? "team"}`} className="border-t border-line/70">
                    <td className="px-2 py-3 font-bold text-slate-100">
                      {row.season ?? "-"} W{row.week ?? "-"}
                    </td>
                    <td className="px-2 py-3">{row.team ?? "-"}</td>
                    <td className="px-2 py-3">{row.opponent ?? "-"}</td>
                    <td className="px-2 py-3">{formatNumber(row.calculatedFantasyPoints)}</td>
                    <td className="px-2 py-3 text-slate-300">{buildWeeklyStatLine(row, profile.header.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Weekly game log is not available for this profile.</p>
        )}
        {profile.weeklyGameLogTruncated ? <p className="mt-2 text-xs text-slate-500">Showing the most recent 8 weekly rows.</p> : null}
      </div>
    </section>
  );
}

function HistoricalHighValueUsagePanel({ profile }: { profile: HistoricalProfile }) {
  const usage = profile.highValueUsageSummary;
  if (!usage || usage.sourceStatus !== "available" || usage.gamesWithHighValueUsage === 0) return null;
  const metrics = highValueUsageMetrics(profile);
  return (
    <div className="mt-3 rounded-md border border-line/70 bg-background/45 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">High-Value Usage</div>
          <p className="mt-2 text-xs text-slate-500">
            Compact play-by-play evidence only; not yet included in Blackbird Rank.
          </p>
          {usage.modifiers.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {usage.modifiers.slice(0, 5).map((modifier) => (
                <span key={modifier} className="rounded-full border border-brand/20 bg-brand/10 px-2 py-1 text-[11px] text-brand">
                  {formatCoverageLabel(modifier)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[420px] sm:grid-cols-3">
          {metrics.map((metric) => (
            <H11MiniMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </div>
      {profile.highValueRoleWarnings?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {profile.highValueRoleWarnings.slice(0, 4).map((warning) => (
            <span key={warning} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-1 text-[11px] text-gold">
              {formatCoverageLabel(warning)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HistoricalRoleUsagePanel({ profile }: { profile: HistoricalProfile }) {
  const usage = profile.usageSummary;
  const role = profile.roleMetrics;
  if (!usage || !role) {
    return (
      <div className="mt-3 rounded-md border border-line/70 bg-background/45 px-3 py-3">
        <div className="text-xs font-black uppercase tracking-wide text-slate-400">Role & Usage</div>
        <p className="mt-2 text-sm text-slate-400">Usage profile is not available yet.</p>
      </div>
    );
  }
  const metrics = roleUsageMetrics(profile);
  return (
    <div className="mt-3 rounded-md border border-line/70 bg-background/45 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">Role & Usage</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-brand">
              {formatCoverageLabel(role.roleLabel)}
            </span>
            <span className="rounded-full border border-line bg-panel px-2 py-1 text-[11px] text-slate-300">
              Confidence {role.roleConfidence}
            </span>
            <span className="rounded-full border border-line bg-panel px-2 py-1 text-[11px] text-slate-300">
              Trend {formatCoverageLabel(role.roleTrend)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">{roleUsageSourceNote(usage)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[360px] sm:grid-cols-3">
          {metrics.map((metric) => (
            <H11MiniMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </div>
      {role.keySignals.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {role.keySignals.slice(0, 4).map((signal) => (
            <span key={signal} className="rounded-full border border-line bg-panel px-2 py-1 text-[11px] text-slate-300">
              {signal}
            </span>
          ))}
        </div>
      ) : null}
      {role.roleModifiers.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {role.roleModifiers.slice(0, 4).map((modifier) => (
            <span key={modifier} className="rounded-full border border-brand/20 bg-brand/10 px-2 py-1 text-[11px] text-brand">
              {formatCoverageLabel(modifier)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function highValueUsageMetrics(profile: HistoricalProfile): Array<{ label: string; value: string }> {
  const usage = profile.highValueUsageSummary;
  if (!usage) return [];
  const position = profile.header.position;
  if (position === "QB") {
    return [
      { label: "RZ Pass/G", value: formatNullableNumber(usage.redZonePassAttemptsPerGame) },
      { label: "QB Rush/G", value: formatNullableNumber((usage.designedQbRushesPerGame ?? 0) + (usage.scramblesPerGame ?? 0)) },
      { label: "HV Touch/G", value: formatNullableNumber(usage.highValueTouchesPerGame) },
      { label: "Trend", value: formatCoverageLabel(usage.trendLabel) },
      { label: "TD Dep", value: formatNullableNumber(usage.touchdownDependency) },
      { label: "Games", value: formatNumber(usage.gamesWithHighValueUsage) },
    ];
  }
  if (position === "RB") {
    return [
      { label: "HV Touch/G", value: formatNullableNumber(usage.highValueTouchesPerGame) },
      { label: "RZ Carry/G", value: formatNullableNumber(usage.redZoneCarriesPerGame) },
      { label: "Goal-Line/G", value: formatNullableNumber(usage.goalLineCarriesPerGame) },
      { label: "Target HV/G", value: formatNullableNumber(usage.highValueTargetsPerGame) },
      { label: "Trend", value: formatCoverageLabel(usage.trendLabel) },
      { label: "Games", value: formatNumber(usage.gamesWithHighValueUsage) },
    ];
  }
  if (position === "WR" || position === "TE") {
    return [
      { label: "HV Target/G", value: formatNullableNumber(usage.highValueTargetsPerGame) },
      { label: "RZ Target/G", value: formatNullableNumber(usage.redZoneTargetsPerGame) },
      { label: "End Zone/G", value: formatNullableNumber(usage.endZoneTargetsPerGame) },
      { label: "Deep/G", value: formatNullableNumber(usage.deepTargetsPerGame) },
      { label: "Air Yd/Tgt", value: formatNullableNumber(usage.airYardsPerTarget) },
      { label: "Games", value: formatNumber(usage.gamesWithHighValueUsage) },
    ];
  }
  return [
    { label: "HV Touch/G", value: formatNullableNumber(usage.highValueTouchesPerGame) },
    { label: "HV Target/G", value: formatNullableNumber(usage.highValueTargetsPerGame) },
    { label: "RZ Usage/G", value: formatNullableNumber((usage.redZoneCarriesPerGame ?? 0) + (usage.redZoneTargetsPerGame ?? 0)) },
    { label: "Deep/G", value: formatNullableNumber(usage.deepTargetsPerGame) },
    { label: "Trend", value: formatCoverageLabel(usage.trendLabel) },
    { label: "Games", value: formatNumber(usage.gamesWithHighValueUsage) },
  ];
}

function roleUsageMetrics(profile: HistoricalProfile): Array<{ label: string; value: string }> {
  const usage = profile.usageSummary;
  if (!usage) return [];
  const position = profile.header.position;
  const snapMetrics = snapRoleMetrics(usage, position);
  if (["DL", "LB", "DB"].includes(position)) {
    return [
      { label: "Tackle Floor", value: `${formatNullableNumber(usage.tackleFloorScore)}/100` },
      { label: "Big Play Dep", value: `${formatNullableNumber(usage.bigPlayDependencyScore)}/100` },
      { label: "Sack Dep", value: `${formatNullableNumber(usage.sackDependencyScore)}/100` },
      ...snapMetrics,
    ].slice(0, 6);
  }
  if (position === "QB") {
    return [
      { label: "Pass Att/G", value: formatNullableNumber(usage.passAttemptsPerGame) },
      { label: "Carries/G", value: formatNullableNumber(usage.carriesPerGame) },
      { label: "Use Stable", value: `${formatNumber(usage.weeklyUsageConsistency)}/100` },
      ...snapMetrics,
    ].slice(0, 6);
  }
  return [
    { label: "Opp/G", value: formatNullableNumber(usage.opportunitiesPerGame) },
    { label: "Touches/G", value: formatNullableNumber(usage.touchesPerGame) },
    { label: "Targets/G", value: formatNullableNumber(usage.targetsPerGame) },
    ...snapMetrics,
  ].slice(0, 6);
}

function snapRoleMetrics(usage: NonNullable<HistoricalProfile["usageSummary"]>, position: string): Array<{ label: string; value: string }> {
  const primarySnap = ["DL", "LB", "DB"].includes(position) ? usage.defensiveSnapShare : usage.offensiveSnapShare;
  const label = ["DL", "LB", "DB"].includes(position) ? "Def Snap" : "Off Snap";
  const metrics: Array<{ label: string; value: string }> = [];
  if (primarySnap !== null) metrics.push({ label, value: formatPercent(primarySnap) });
  if (usage.gamesOver70PercentSnaps !== null) metrics.push({ label: "70%+ Games", value: String(usage.gamesOver70PercentSnaps) });
  if (usage.trendLabel !== "insufficient_data") metrics.push({ label: "Snap Trend", value: formatCoverageLabel(usage.trendLabel) });
  return metrics;
}

function roleUsageSourceNote(usage: NonNullable<HistoricalProfile["usageSummary"]>) {
  if (usage.gamesWithSnapData > 0 && usage.gamesWithParticipationData > 0) {
    return "Usage profile includes weekly stats, snap counts, and participation context.";
  }
  if (usage.gamesWithSnapData > 0) {
    return "Usage profile includes weekly stats and snap count context.";
  }
  if (usage.gamesWithParticipationData > 0) {
    return "Usage profile includes weekly stats and participation context; snap counts were not matched for this player.";
  }
  return "Usage profile is based on available weekly stat data. Snap source exists, but this player has no matched snap data.";
}

function formatCoverageLabel(value: string | null) {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function HistoricalEvidenceCard({ evidence }: { evidence: PlayerProfileEvidence }) {
  return (
    <div className="mt-3 rounded-md border border-line/70 bg-background/55 px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Historical Evidence</div>
          <p className="mt-1 text-sm text-slate-300">{evidence.summary}</p>
          <p className="mt-1 text-[11px] text-slate-500">{evidence.note}</p>
        </div>
        {evidence.badges.length ? (
          <div className="flex flex-wrap gap-1 sm:max-w-[320px] sm:justify-end">
            {evidence.badges.map((badge) => (
              <span key={badge} className="rounded-full border border-brand/20 bg-brand/10 px-2 py-1 text-[10px] uppercase tracking-wide text-brand">
                {badge.replaceAll("-", " ")}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {evidence.positiveSignals.length || evidence.cautionSignals.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {evidence.positiveSignals.length ? (
            <EvidenceSignalList title="Positive Signals" items={evidence.positiveSignals} tone="positive" />
          ) : null}
          {evidence.cautionSignals.length ? (
            <EvidenceSignalList title="Cautions" items={evidence.cautionSignals} tone="caution" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceSignalList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "caution";
}) {
  const className = tone === "positive" ? "text-emerald-100 border-emerald-400/20 bg-emerald-500/10" : "text-gold border-gold/25 bg-gold/10";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className={`rounded-full border px-2 py-1 text-[11px] ${className}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

type HistoricalProfile = HistoricalPlayerProfileResponse["profile"];
type HistoricalWeeklyRow = HistoricalProfile["weeklyGameLog"][number];

function historicalScoringLabel(scoring: HistoricalProfileLoadState["scoring"]) {
  if (scoring?.scoringSource === "draft_room" || scoring?.scoringSource === "league") {
    return "Scored using this league's settings";
  }
  if (scoring?.scoringSource === "fallback") {
    return "League scoring unavailable; using default profile scoring";
  }
  return "Scored using Blackbird default profile scoring";
}

function buildHistoricalStatSummary(profile: HistoricalProfile): Array<{ label: string; value: number }> {
  const position = profile.header.position;
  const seasonTotals = profile.seasonSummaries[0]?.keyStatTotals ?? {};
  const totals = ["DL", "LB", "DB"].includes(position) ? profile.idpSummary ?? seasonTotals : seasonTotals;
  return positionStatSpecs(position)
    .map((spec) => ({ label: spec.label, value: firstStatValue(totals, spec.keys) }))
    .filter((stat) => stat.value !== null && stat.value !== 0)
    .map((stat) => ({ label: stat.label, value: stat.value ?? 0 }))
    .slice(0, 8);
}

function buildWeeklyStatLine(row: HistoricalWeeklyRow, position: string): string {
  const parts = positionStatSpecs(position)
    .map((spec) => {
      const value = firstStatValueForWeeklyRow(row, spec.keys);
      return value === null || value === 0 ? null : `${spec.label} ${formatNumber(value)}`;
    })
    .filter((part): part is string => Boolean(part))
    .slice(0, 5);
  return parts.length ? parts.join(" · ") : "Stat line unavailable";
}

function positionStatSpecs(position: string): Array<{ label: string; keys: string[] }> {
  if (position === "QB") {
    return [
      { label: "Pass Yds", keys: ["passing_yards", "pass_yd", "pass_yds"] },
      { label: "Pass TD", keys: ["passing_tds", "pass_td"] },
      { label: "INT", keys: ["interceptions", "pass_int", "int"] },
      { label: "Rush Yds", keys: ["rushing_yards", "rush_yd", "rush_yds"] },
      { label: "Rush TD", keys: ["rushing_tds", "rush_td"] },
    ];
  }
  if (position === "RB") {
    return [
      { label: "Rush Att", keys: ["carries", "rushing_att", "rush_att"] },
      { label: "Rush Yds", keys: ["rushing_yards", "rush_yd", "rush_yds"] },
      { label: "Rush TD", keys: ["rushing_tds", "rush_td"] },
      { label: "Rec", keys: ["receptions", "rec"] },
      { label: "Rec Yds", keys: ["receiving_yards", "rec_yd", "rec_yds"] },
      { label: "Rec TD", keys: ["receiving_tds", "rec_td"] },
    ];
  }
  if (position === "WR" || position === "TE") {
    return [
      { label: "Targets", keys: ["targets", "tgt"] },
      { label: "Rec", keys: ["receptions", "rec"] },
      { label: "Rec Yds", keys: ["receiving_yards", "rec_yd", "rec_yds"] },
      { label: "Rec TD", keys: ["receiving_tds", "rec_td"] },
      { label: "Rush Yds", keys: ["rushing_yards", "rush_yd", "rush_yds"] },
    ];
  }
  if (position === "K") {
    return [
      { label: "FGM", keys: ["fg_made", "fgm"] },
      { label: "FGA", keys: ["fg_att", "fga"] },
      { label: "XPM", keys: ["xp_made", "xpm"] },
      { label: "XPA", keys: ["xp_att", "xpa"] },
    ];
  }
  if (position === "DL" || position === "LB" || position === "DB") {
    return [
      { label: "Solo", keys: ["solo_tkl", "def_tackle_solo", "tackle_solo"] },
      { label: "Ast", keys: ["ast_tkl", "def_tackle_ast", "tackle_ast"] },
      { label: "Sack", keys: ["sack", "sacks"] },
      { label: "INT", keys: ["int", "def_int"] },
      { label: "FF", keys: ["ff", "forced_fumbles"] },
      { label: "FR", keys: ["fr", "fumble_recovery"] },
      { label: "PD", keys: ["pd", "pass_defended"] },
    ];
  }
  return [
    { label: "Points", keys: ["fantasy_points", "calculatedFantasyPoints"] },
  ];
}

function firstStatValue(totals: Record<string, number>, keys: string[]): number | null {
  for (const key of keys) {
    const value = totals[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function firstStatValueForWeeklyRow(row: HistoricalWeeklyRow, keys: string[]): number | null {
  const groups = [row.passing, row.rushing, row.receiving, row.kicking, row.defensive];
  for (const group of groups) {
    const value = firstNullableStatValue(group, keys);
    if (value !== null) return value;
  }
  return null;
}

function firstNullableStatValue(totals: Record<string, number | null>, keys: string[]): number | null {
  for (const key of keys) {
    const value = totals[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatProfileWarning(warning: string): string {
  return warning
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatLineGrid({ items, empty }: { items: Array<{ key: string; label: string; value: number }>; empty: string }) {
  if (!items.length) return <p className="mt-3 text-sm text-slate-400">{empty}</p>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.key} className="rounded-md border border-line/70 bg-background/50 px-2 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</div>
          <div className="mt-1 font-black text-slate-100">{formatNumber(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function BoardDataStatus({ row }: { row: BlackbirdBoardRow }) {
  const labels = [
    row.dataStatus.h10 === "available" ? "H10" : "No H10 rows",
    row.dataStatus.projection === "available" ? "Projection" : "Projection unavailable",
    row.dataStatus.marketRank === "available" ? "Blackbird rank" : "Rank unavailable",
  ];
  return (
    <div className="flex max-w-[220px] flex-wrap gap-1">
      {labels.map((label) => (
        <span key={label} className={`rounded-full border px-2 py-1 text-[11px] ${label.includes("unavailable") || label.startsWith("No ") ? "border-gold/25 bg-gold/10 text-gold" : "border-line bg-background text-slate-300"}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rf-panel p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PreDraftStrategyPanel({
  loadState,
  prominent = false,
}: {
  loadState: StrategyLoadState;
  prominent?: boolean;
}) {
  const strategy = loadState.strategy;
  const model = buildPreDraftStrategyUiViewModel({
    loadState: loadState.status,
    error: loadState.error,
    dataGaps: strategy?.dataGaps ?? [],
    riskNotes: strategy?.riskNotes ?? [],
    safetyLanguagePassed: strategy?.safetyLanguageStatus?.passed,
    sectionCounts: strategy
      ? {
          scoringEmphasis: strategy.scoringEmphasis.length,
          rosterConstructionPlan: strategy.rosterConstructionPlan.length,
          positionalPriorityMap: Object.keys(strategy.positionalPriorityMap).length,
          roundWindowPlan: strategy.roundWindowPlan.length,
          tierCliffWatchlist: strategy.tierCliffWatchlist.length,
          valuePocketWatchlist: strategy.valuePocketWatchlist.length,
          waitPositions: strategy.waitPositions.length,
          doNotForcePositions: strategy.doNotForcePositions.length,
          contingencyPlans: strategy.contingencyPlans.length,
          specialPositionGuidance: strategy.specialPositionGuidance.length,
        }
      : {},
  });

  return (
    <section className={`rf-panel p-4 sm:p-5 ${prominent ? "border-brand/30" : ""}`} data-testid="pre-draft-strategy-panel">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-slate-100 sm:text-xl">{model.title}</h2>
            <StrategyPill>Read-only</StrategyPill>
            <StrategyPill>Experimental</StrategyPill>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Blackbird Strategy Preview based on currently available projections, market context, and league context.
          </p>
        </div>
        {strategy?.leagueSummary ? (
          <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[220px]">
            <H11MiniMetric label="Teams" value={strategy.leagueSummary.teams ?? "-"} />
            <H11MiniMetric label="Rounds" value={strategy.leagueSummary.rounds ?? "-"} />
            <H11MiniMetric label="Slot" value={strategy.draftSlotStrategy.slot ?? "-"} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {model.caveats.map((caveat) => (
          <span key={caveat} className="rounded-full border border-line bg-background px-2 py-1 text-slate-300">
            {caveat}
          </span>
        ))}
      </div>

      {model.loading ? (
        <div className="mt-4 rounded-md border border-line bg-panel2 px-3 py-3 text-sm text-slate-300">
          Loading strategy preview...
        </div>
      ) : null}

      {model.unavailable ? (
        <div className="mt-4 rounded-md border border-gold/25 bg-gold/10 px-3 py-3 text-sm text-gold">
          {model.errorMessage ?? "Unable to load strategy preview. War Room remains usable."}
        </div>
      ) : null}

      {model.partial ? (
        <details className="group mt-4 rounded-md border border-gold/25 bg-gold/10 px-3 py-3 text-sm text-gold" open={prominent}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>Strategy preview is partial because some draft context is missing.</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {model.dataGaps.slice(0, 8).map((gap) => (
              <div key={gap} className="break-words rounded-md border border-gold/20 bg-background/40 px-2 py-1 text-xs">
                {gap}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {strategy && !model.empty ? (
        <div className="mt-4 space-y-4">
          <H11LeagueSummary strategy={strategy} />
          <div className={`grid gap-3 ${prominent ? "lg:grid-cols-2" : ""}`}>
            <H11Section title="Scoring Emphasis">
              <StrategyList items={strategy.scoringEmphasis.slice(0, prominent ? 5 : 3).map((row) => `${row.position}: ${row.reason}`)} />
            </H11Section>
            <H11Section title="Roster Construction Plan">
              <StrategyList items={strategy.rosterConstructionPlan.slice(0, prominent ? 4 : 2).map((row) => `${row.phase}: ${row.guidance}`)} />
            </H11Section>
            <H11Section title="Positional Priority Map">
              <PriorityMapPreview priorities={strategy.positionalPriorityMap} />
            </H11Section>
            <H11Section title="Draft Slot Strategy">
              <StrategyList
                items={[
                  `Draft slot band: ${strategy.draftSlotStrategy.draftSlotBand ?? strategy.draftSlotStrategy.archetype}`,
                  `Turn pick: ${strategy.draftSlotStrategy.isTurnPick ? "yes" : "no"} · Near turn: ${strategy.draftSlotStrategy.isNearTurn ? "yes" : "no"}`,
                  `Turn pairing risk: ${strategy.draftSlotStrategy.turnPairingRisk ?? "unknown"}`,
                  strategy.draftSlotStrategy.maxWaitUntilNextPick === null || strategy.draftSlotStrategy.maxWaitUntilNextPick === undefined
                    ? "Exact wait length needs more draft context."
                    : `Max wait until next pick: ${strategy.draftSlotStrategy.maxWaitUntilNextPick} picks`,
                  strategy.draftSlotStrategy.slotStrategySummary ?? "Strategy preview uses generic slot timing because exact slot context is partial.",
                  ...strategy.draftSlotStrategy.timingSignals.slice(0, 2),
                ]}
              />
              <H11SlotWindowPreview strategy={strategy} />
            </H11Section>
          </div>
          <details className="group rounded-md border border-line bg-panel2/70 px-3 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-100">
              <span>Strategy Watchlists</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <H11Section title="Round Window Plan">
                <StrategyList items={strategy.roundWindowPlan.slice(0, 5).map((row) => `${row.window} (${row.rounds}): ${row.positions.join(", ")}`)} />
              </H11Section>
              <H11Section title="Detailed Round Windows">
                <RoundWindowDetailPreview strategy={strategy} />
              </H11Section>
              <H11Section title="Tier Cliff Watchlist">
                <StrategyList items={strategy.tierCliffWatchlist.slice(0, 5).map((row) => `${row.position}: ${row.label} (${row.risk})`)} empty="No tier cliff rows returned." />
              </H11Section>
              <H11Section title="Value Pocket Watchlist">
                <StrategyList items={strategy.valuePocketWatchlist.slice(0, 5).map((row) => `${row.position}: ${row.label}`)} empty="No value pocket rows returned." />
              </H11Section>
              <H11Section title="Wait Positions">
                <StrategyList items={strategy.waitPositions.slice(0, 5).map((row) => `${row.position}: ${row.reason}`)} empty="No wait-position rows returned." />
              </H11Section>
              <H11Section title="Do-Not-Force Positions">
                <StrategyList items={strategy.doNotForcePositions.slice(0, 5).map((row) => `${row.position}: ${row.reason}`)} empty="No do-not-force rows returned." />
              </H11Section>
              <H11Section title="Special Position Guidance">
                <StrategyList items={strategy.specialPositionGuidance.slice(0, 5).map((row) => `${row.position}: ${row.guidance}`)} empty="No special position guidance returned." />
              </H11Section>
            </div>
          </details>
          <H11Section title="Contingency Plans">
            <StrategyList items={strategy.contingencyPlans.slice(0, prominent ? 5 : 3).map((row) => `${row.trigger}: ${row.response}`)} />
          </H11Section>
          <H11Section title="Contingency Triggers">
            <ContingencyTriggerPreview strategy={strategy} />
          </H11Section>
          <H11Section title="Risk Notes">
            <StrategyList items={strategy.riskNotes.slice(0, 5)} />
          </H11Section>
        </div>
      ) : null}

      {strategy && model.empty ? (
        <div className="mt-4 rounded-md border border-line bg-panel2 px-3 py-3 text-sm text-slate-300">
          Strategy preview is available, but no populated strategy sections were returned yet.
        </div>
      ) : null}

      {model.bannedLanguageFound.length ? (
        <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Strategy preview safety language check needs review.
        </div>
      ) : null}
    </section>
  );
}

function H11SlotWindowPreview({ strategy }: { strategy: PreDraftStrategyResponse }) {
  const projectedPicks = strategy.draftSlotStrategy.projectedUserPicks ?? [];
  const windows = strategy.draftSlotStrategy.roundPickWindows ?? [];
  if (!projectedPicks.length && !windows.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {projectedPicks.length ? (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Projected User Picks</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {projectedPicks.slice(0, 10).map((pick) => (
              <span key={`${pick.round}-${pick.overallPick}`} className="rounded-full border border-line bg-background px-2 py-1 text-[11px] text-slate-300">
                R{pick.round} P{pick.overallPick}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {windows.length ? (
        <div className="grid gap-2">
          {windows.slice(0, 3).map((window) => (
            <div key={window.label} className="rounded-md border border-line/70 bg-background/50 px-2 py-2 text-xs">
              <div className="font-bold text-slate-200">{window.label}</div>
              <div className="mt-1 text-slate-500">
                Rounds {window.rounds} · Picks {window.picks.slice(0, 6).join(", ") || "TBD"}
              </div>
              <div className="mt-1 text-slate-300">{window.guidance}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RoundWindowDetailPreview({ strategy }: { strategy: PreDraftStrategyResponse }) {
  const windows = strategy.roundWindowPlanDetailed ?? [];
  if (!windows.length) return <p className="text-sm text-slate-500">No detailed round windows returned.</p>;
  return (
    <div className="grid gap-2">
      {windows.slice(0, 4).map((window) => (
        <div key={`${window.window}-${window.rounds}`} className="rounded-md border border-line/70 bg-background/50 px-2 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-slate-200">{window.window}</div>
            <div className="text-slate-500">Rounds {window.rounds}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {window.primaryPositions.map((position) => <StrategyPill key={position}>{position}</StrategyPill>)}
          </div>
          <p className="mt-2 text-slate-300">{window.guidance}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <MiniDetail label="Value pockets" value={window.likelyValuePockets.join(", ") || "Monitor board"} />
            <MiniDetail label="Tier risk" value={window.tierCliffRisks.join(", ") || "Low visible risk"} />
            <MiniDetail label="Avoid forcing" value={window.avoidForcingPositions.join(", ") || "None flagged"} />
            <MiniDetail label="Fallback" value={window.fallbackPath} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContingencyTriggerPreview({ strategy }: { strategy: PreDraftStrategyResponse }) {
  const triggers = strategy.contingencyTriggers ?? [];
  if (!triggers.length) return <p className="text-sm text-slate-500">No contingency triggers returned.</p>;
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {triggers.slice(0, 6).map((trigger) => (
        <div key={trigger.id} className="rounded-md border border-line/70 bg-background/50 px-2 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-slate-200">{trigger.label}</div>
            <span className="rounded-full border border-line bg-panel2 px-2 py-1 text-[11px] text-slate-300">
              {trigger.riskLevel} risk · {trigger.confidence} confidence
            </span>
          </div>
          <p className="mt-2 text-slate-400">{trigger.triggerConditionSummary}</p>
          <p className="mt-1 text-slate-200">{trigger.suggestedAdjustment}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {trigger.appliesToPositions.map((position) => <StrategyPill key={position}>{position}</StrategyPill>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function H11LeagueSummary({ strategy }: { strategy: PreDraftStrategyResponse }) {
  const summary = strategy.leagueSummary;
  return (
    <div className="rounded-md border border-line bg-panel2/70 px-3 py-3">
      <h3 className="mb-2 text-sm font-bold text-slate-100">League Summary</h3>
      <div className="flex flex-wrap gap-2">
        {summary.formats.map((format) => <StrategyPill key={format}>{format}</StrategyPill>)}
        <StrategyPill>{summary.scoringType}</StrategyPill>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <H11MiniMetric label="Superflex/2QB" value={summary.superflexOr2Qb ? "Yes" : "No"} />
        <H11MiniMetric label="TE premium" value={summary.tePremium ? "Yes" : "No"} />
        <H11MiniMetric label="IDP" value={summary.idp ? "Yes" : "No"} />
        <H11MiniMetric label="K/DST" value={summary.kicker || summary.teamDefense ? "Yes" : "No"} />
      </div>
    </div>
  );
}

function H11Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-background/45 px-3 py-3">
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StrategyList({ items, empty = "No rows returned." }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <p key={item} className="break-words rounded-md border border-line/70 bg-panel2 px-2 py-2 text-xs text-slate-300">
          {item}
        </p>
      ))}
    </div>
  );
}

function PriorityMapPreview({ priorities }: { priorities: PreDraftStrategyResponse["positionalPriorityMap"] }) {
  const rows = Object.entries(priorities)
    .filter(([, value]) => value.score > 0)
    .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .slice(0, 8);

  if (!rows.length) return <p className="text-sm text-slate-500">No positional priority rows returned.</p>;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map(([position, value]) => (
        <div key={position} className="rounded-md border border-line bg-panel2 px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${draftBoardPositionBadgeClass(position)}`}>{normalizeDraftBoardPosition(position)}</span>
            <span className="text-xs text-slate-400">{value.score}</span>
          </div>
          <div className="mt-2 truncate text-xs text-slate-300">{value.priority}</div>
        </div>
      ))}
    </div>
  );
}

function H11MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-background/50 px-2 py-2">
      <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-100">{value}</div>
    </div>
  );
}

function StrategyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-brand">
      {children}
    </span>
  );
}

function NeedsList({
  needs,
  compact = false
}: {
  needs: Array<{
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
  compact?: boolean;
}) {
  if (!needs.length) {
    return <p className="mt-3 text-sm text-slate-400">Starter requirements are currently covered.</p>;
  }

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      {needs.map((need) => (
        <div key={`${need.position}-${need.kind ?? "direct"}`} className="border-b border-line/70 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{need.label ?? need.position}</span>
              {need.needLevel ? <NeedLevelBadge level={need.needLevel} /> : null}
            </div>
            <span className="shrink-0 text-slate-400">
              {need.current}/{need.target}
            </span>
          </div>
          {need.sharedFlexDemand ? (
            <p className="mt-1 text-xs text-slate-500">
              Shared demand {need.sharedFlexDemand} · {need.kind === "shared" ? "flex pressure" : "depth signal"}
            </p>
          ) : need.note ? (
            <p className="mt-1 text-xs text-slate-500">{need.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RecommendationList({
  players,
  rankingsUploaded,
  warningMessages,
  usesLimitedDataPositions
}: {
  players: AvailablePlayer[];
  rankingsUploaded: boolean;
  warningMessages: string[];
  usesLimitedDataPositions: boolean;
}) {
  if (!players.length) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-panel2/60 px-4 py-4 text-sm">
        <p className="font-semibold text-slate-100">
          {rankingsUploaded ? "No actionable recommendations yet." : "Recommendations need uploaded rankings."}
        </p>
        <p className="mt-2 text-slate-400">
          {rankingsUploaded
            ? "Review unmatched rows, sync draft picks, or broaden available ranked players to restore recommendations."
            : "Upload matched rankings to enable Draft Target Score recommendations. If rankings are absent, the War Room falls back to the Sleeper player pool only."}
        </p>
        {usesLimitedDataPositions && rankingsUploaded ? (
          <p className="mt-2 text-xs text-slate-500">
            IDP, kicker, and team-defense recommendations need matched rankings before limited-data scoring can surface them.
          </p>
        ) : null}
        {warningMessages.length ? (
          <p className="mt-3 text-xs text-gold">{warningMessages[0]}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {players.map((player, index) => (
        <div
          key={`${player.sleeper_player_id ?? player.player_name}-${index}`}
          className={`rounded-xl border px-4 py-4 text-sm ${
            index === 0
              ? "border-gold/35 bg-gradient-to-br from-gold/10 via-panel2 to-panel2 shadow-[0_0_0_1px_rgba(250,204,21,0.06)]"
              : index < 3
                ? "border-brand/25 bg-gradient-to-br from-brand/6 via-panel2 to-panel2"
                : "border-line bg-panel2"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge index={index} />
                <PositionBadge position={player.position} />
                <LimitedDataBadge player={player} />
              </div>
              <div className="mt-3 truncate text-base font-black text-slate-50">{player.player_name ?? "Unknown"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>
                  {player.position ?? "-"} · {player.team ?? "-"}
                </span>
                <span>Rank {player.rank ?? "-"}</span>
                <span>ADP {formatNumber(player.adp)}</span>
                {player.projected_points !== null && player.projected_points !== undefined ? (
                  <span>Proj {formatNumber(player.projected_points)}</span>
                ) : null}
              </div>
            </div>
            <div className="min-w-[88px] text-right">
              <div className="inline-flex min-w-[76px] justify-center rounded-lg border border-brand/25 bg-background/70 px-3 py-2 text-lg font-black text-brand">
                {player.draftTargetScore?.toFixed(1) ?? "-"}
              </div>
              <div className="mt-2 flex justify-end">
                <TierBadge tier={player.recommendationTier} />
              </div>
            </div>
          </div>
          <ReasonList reasons={player.reasons} />
          {player.warnings.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {player.warnings.map((warning) => (
                <span
                  key={warning}
                  className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] font-medium text-gold"
                >
                  {warning}
                </span>
              ))}
            </div>
          ) : null}
          <ScoreBreakdown player={player} />
        </div>
      ))}
    </div>
  );
}

function RecommendationSourcePanel({
  source,
  onSourceChange,
  legacyRows,
  rankingsUploaded,
  warningMessages,
  usesLimitedDataPositions,
  blackbirdRows,
  blackbirdDiagnostics,
  experimentDiagnostics,
}: {
  source: H10RecommendationSource;
  onSourceChange: (source: H10RecommendationSource) => void;
  legacyRows: AvailablePlayer[];
  rankingsUploaded: boolean;
  warningMessages: string[];
  usesLimitedDataPositions: boolean;
  blackbirdRows: WarRoomRecommendationRow[];
  blackbirdDiagnostics: WarRoomRecommendationResult["diagnostics"] | null;
  experimentDiagnostics: H10RecommendationExperimentDiagnostics | null;
}) {
  const effectiveSource = !rankingsUploaded && !legacyRows.length && blackbirdRows.length ? "blackbird" : source;
  const uiState = buildH10RecommendationExperimentUiState({
    experimentEnabled: true,
    selectedSource: effectiveSource,
    rows: blackbirdRows,
    experimentDiagnostics,
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-background/50 p-2">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Recommendation Source</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${effectiveSource === "legacy" ? "border-brand/40 bg-brand/15 text-brand" : "border-line bg-panel2 text-slate-300"}`}
            onClick={() => onSourceChange("legacy")}
          >
            Legacy
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${effectiveSource === "blackbird" ? "border-gold/40 bg-gold/10 text-gold" : "border-line bg-panel2 text-slate-300"}`}
            onClick={() => onSourceChange("blackbird")}
          >
            Blackbird Value Preview
          </button>
        </div>
      </div>
      {effectiveSource === "legacy" ? (
        <RecommendationList
          players={legacyRows}
          rankingsUploaded={rankingsUploaded}
          warningMessages={warningMessages}
          usesLimitedDataPositions={usesLimitedDataPositions}
        />
      ) : (
        <H10RecommendationPreview
          rows={blackbirdRows}
          diagnostics={blackbirdDiagnostics}
          experimentDiagnostics={experimentDiagnostics}
          mode="experiment"
          disabled={!uiState.blackbirdPanelEnabled}
        />
      )}
    </div>
  );
}

function InternalTrustedRecommendationPanel({
  legacyRows,
  rankingsUploaded,
  warningMessages,
  usesLimitedDataPositions,
  blackbirdRows,
  blackbirdDiagnostics,
  experimentDiagnostics,
  gating,
}: {
  legacyRows: AvailablePlayer[];
  rankingsUploaded: boolean;
  warningMessages: string[];
  usesLimitedDataPositions: boolean;
  blackbirdRows: WarRoomRecommendationRow[];
  blackbirdDiagnostics: WarRoomRecommendationResult["diagnostics"] | null;
  experimentDiagnostics: H10RecommendationExperimentDiagnostics | null;
  gating: "env_only" | "trusted_user_allowlist";
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-3 text-xs text-brand">
        <div className="font-black uppercase tracking-wide">Blackbird Trusted Preview</div>
        <p className="mt-1 text-brand/90">
          Internal experiment · read-only · source switching is not saved · Synthetic replay validated; historical outcome validation not yet available.
        </p>
        <p className="mt-1 text-brand/80">Gate: {gating === "trusted_user_allowlist" ? "trusted user allowlist" : "environment flag only"}</p>
      </div>
      <H10RecommendationPreview
        rows={blackbirdRows}
        diagnostics={blackbirdDiagnostics}
        experimentDiagnostics={experimentDiagnostics}
        mode="experiment"
        internalTrusted
      />
      <details className="rounded-lg border border-line bg-background/40 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-200">
          <span>Legacy Draft Target Score</span>
          <ChevronDown className="h-4 w-4 transition open:rotate-180" />
        </summary>
        <div className="mt-3">
          <RecommendationList
            players={legacyRows}
            rankingsUploaded={rankingsUploaded}
            warningMessages={warningMessages}
            usesLimitedDataPositions={usesLimitedDataPositions}
          />
        </div>
      </details>
    </div>
  );
}

function H10RecommendationPreview({
  rows,
  diagnostics,
  experimentDiagnostics,
  mode,
  disabled = false,
  internalTrusted = false,
}: {
  rows: WarRoomRecommendationRow[];
  diagnostics: WarRoomRecommendationResult["diagnostics"] | null;
  experimentDiagnostics: H10RecommendationExperimentDiagnostics | null;
  mode: "preview" | "experiment";
  disabled?: boolean;
  internalTrusted?: boolean;
}) {
  const uiState = buildH10RecommendationExperimentUiState({
    previewEnabled: mode === "preview",
    experimentEnabled: mode === "experiment",
    selectedSource: mode === "experiment" ? "blackbird" : "legacy",
    rows,
    experimentDiagnostics,
  });
  const visibleRows = rows
    .filter((row) => row.status === "recommendable" || row.status === "watch_only")
    .slice(0, 8);
  const insufficientCount = diagnostics?.rowsByTier.insufficient_data ?? rows.filter((row) => row.recommendationTier === "insufficient_data").length;
  const mostlyInsufficient = rows.length > 0 && insufficientCount / rows.length >= 0.5;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand">
        {internalTrusted ? "Internal experiment · Trusted preview · " : ""}
        {H10_RECOMMENDATION_READINESS_LABELS.join(" · ")}. Blackbird preview is a read-only experimental signal based on current projections,
        market value, roster need, and pick timing. It does not replace legacy Draft Target Score rows.
      </div>
      {internalTrusted ? (
        <p className="rounded-md border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold">
          Synthetic replay validated; historical outcome validation not yet available.
        </p>
      ) : null}
      {mode === "experiment" && disabled ? (
        <p className="rounded-md border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold">
          Blackbird experiment panel is diagnostics-only because validation gates did not pass:{" "}
          {experimentDiagnostics?.failedExperimentGates.join(", ") || "unknown gate failure"}.
        </p>
      ) : null}
      {mostlyInsufficient ? (
        <p className="rounded-md border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold">
          Blackbird has value data for some players, but many available players are missing deterministic projection matches in this room. Confidence and risk caveats apply.
        </p>
      ) : null}
      {!disabled && visibleRows.length ? (
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <H10RecommendationCard key={`${row.entityId ?? row.displayName}-${row.recommendationRank}`} row={row} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-panel2/60 px-4 py-4 text-sm">
          <p className="font-semibold text-slate-100">No H10 preview rows available.</p>
          <p className="mt-2 text-slate-400">
            The Blackbird preview needs a synced draft room plus deterministic projection and market rows. Upload rankings to use legacy Draft Target Score
            while preview rows are unavailable.
          </p>
        </div>
      )}
      {diagnostics ? (
        <H10RecommendationDiagnostics
          diagnostics={diagnostics}
          experimentDiagnostics={experimentDiagnostics}
          sourceSelected={mode === "experiment" ? "blackbird" : "preview"}
          diagnosticsOnlyRows={uiState.diagnosticsOnlyRows}
        />
      ) : null}
    </div>
  );
}

function H10RecommendationCard({ row }: { row: WarRoomRecommendationRow }) {
  const driver = getRecommendationDriver(row);
  return (
    <div className="rounded-lg border border-line bg-panel2 px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <H10RecommendationTierBadge tier={row.recommendationTier} />
            <PositionBadge position={row.position} />
          </div>
          <div className="mt-2 truncate font-bold text-slate-50">{row.displayName}</div>
          <div className="mt-1 text-xs text-slate-400">
            {row.position ?? "-"} · {row.team ?? "-"}
          </div>
        </div>
        <div className="shrink-0 rounded-md border border-line bg-background px-2 py-1 text-sm font-black text-slate-100">
          {row.recommendationScore.toFixed(1)}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-200">{row.primaryReason}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
        <H10MiniStat label="Signal type" value={driver} />
        <H10MiniStat label="Wait targets" value={`${row.waitPlanTargetCount ?? 0} (${row.waitPlanStrongTargetCount ?? 0} strong)`} />
        <H10MiniStat label="Risk" value={row.h10.confidenceLabel ?? row.waitRisk ?? "-"} />
        <H10MiniStat label="Action" value={row.needTimingAction ?? "-"} />
      </div>
      {row.explanationFragments.length > 1 ? (
        <div className="mt-2 grid gap-1">
          {row.explanationFragments.slice(1, 4).map((fragment) => (
            <p key={fragment} className="rounded-md border border-line/70 bg-background/50 px-2 py-1 text-[11px] text-slate-400">
              {fragment}
            </p>
          ))}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
        <H10MiniStat label="PAR" value={formatNumber(row.h10.pointsAboveReplacement)} />
        <H10MiniStat label="Risk value" value={formatNumber(row.h10.riskAdjustedValue)} />
        <H10MiniStat label="Tier" value={row.h10.tier === null ? "-" : String(row.h10.tier)} />
        <H10MiniStat label="Market" value={row.h10.marketValueSignal ?? "-"} />
        <H10MiniStat label="Timing" value={row.needTimingAction ?? "-"} />
        <H10MiniStat label="Urgency" value={row.needUrgency ?? "-"} />
        <H10MiniStat label="League value" value={formatNumber(row.scoreComponents.leagueValue)} />
        <H10MiniStat label="Roster need" value={formatNumber(row.scoreComponents.rosterNeed)} />
        <H10MiniStat label="Scarcity" value={formatNumber(row.scoreComponents.scarcity)} />
        <H10MiniStat label="Tier cliff" value={formatNumber(row.scoreComponents.tierCliff)} />
        <H10MiniStat label="Availability" value={formatNumber(row.scoreComponents.availabilityRisk)} />
        <H10MiniStat label="Timing adj" value={formatNumber(row.scoreComponents.needTiming)} />
        <H10MiniStat label="Confidence" value={row.h10.confidenceLabel ?? row.status} />
        <H10MiniStat label="Risk" value={row.h10.valueReadiness ?? "-"} />
      </div>
      {row.needTimingReasons?.length ? (
        <div className="mt-2 grid gap-1">
          {row.needTimingReasons.slice(0, 2).map((reason) => (
            <p key={reason} className="rounded-md border border-line/70 bg-background/50 px-2 py-1 text-[11px] text-slate-400">
              {reason}
            </p>
          ))}
        </div>
      ) : null}
      {row.warningCodes.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {row.warningCodes.slice(0, 3).map((warning) => (
            <span key={warning} className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] text-gold">
              {warning}
            </span>
          ))}
          {row.warningCodes.length > 3 ? <span className="text-[11px] text-slate-500">+{row.warningCodes.length - 3}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function getRecommendationDriver(row: WarRoomRecommendationRow) {
  const entries = [
    ["value signal", row.scoreComponents.leagueValue + row.scoreComponents.marketValue],
    ["roster need acknowledged", row.scoreComponents.rosterNeed],
    ["scarcity-driven", row.scoreComponents.scarcity + row.scoreComponents.tierCliff],
    ["timing signal", row.scoreComponents.needTiming + row.scoreComponents.availabilityRisk],
  ] as const;
  return entries.reduce((best, current) => current[1] > best[1] ? current : best)[0];
}

function H10MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line/70 bg-background/50 px-2 py-1">
      <div className="uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-slate-200">{value}</div>
    </div>
  );
}

function H10RecommendationTierBadge({ tier }: { tier: WarRoomRecommendationTier }) {
  const label =
    tier === "priority_target"
      ? "Priority Target"
      : tier === "strong_target"
        ? "Strong Target"
        : tier === "solid_target"
          ? "Solid Target"
          : tier === "watchlist"
            ? "Watchlist"
            : tier === "insufficient_data"
              ? "Insufficient Data"
              : "Avoid for Now";
  const className =
    tier === "priority_target"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tier === "strong_target"
        ? "border-brand/35 bg-brand/10 text-brand"
        : tier === "solid_target"
          ? "border-slate-300/30 bg-slate-300/10 text-slate-200"
          : tier === "watchlist"
            ? "border-gold/30 bg-gold/10 text-gold"
            : tier === "insufficient_data"
              ? "border-line bg-background text-slate-400"
              : "border-red-400/30 bg-red-500/10 text-red-200";
  return <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${className}`}>{label}</span>;
}

function H10RecommendationDiagnostics({
  diagnostics,
  experimentDiagnostics,
  sourceSelected,
  diagnosticsOnlyRows,
}: {
  diagnostics: WarRoomRecommendationResult["diagnostics"];
  experimentDiagnostics: H10RecommendationExperimentDiagnostics | null;
  sourceSelected: string;
  diagnosticsOnlyRows: number;
}) {
  return (
    <details className="group rounded-lg border border-line bg-background/40 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between text-slate-300">
        <span>Preview diagnostics</span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2 text-slate-400">
        <DiagnosticsLine label="Source selected" value={sourceSelected} />
        <DiagnosticsLine label="Rows generated" value={String(diagnostics.recommendationsGenerated)} />
        <DiagnosticsLine label="Rows shown" value={String(experimentDiagnostics?.blackbirdRowsShown ?? diagnostics.recommendationsGenerated - diagnosticsOnlyRows)} />
        <DiagnosticsLine label="Diagnostics-only rows" value={String(diagnosticsOnlyRows)} />
        <DiagnosticsLine label="Match rate" value={formatNullableRate(experimentDiagnostics?.matchRate ?? diagnostics.matchCoverageSummary?.matchRate ?? null)} />
        <DiagnosticsLine label="Insufficient data rate" value={formatRate(experimentDiagnostics?.insufficientDataRate ?? 0)} />
        <DiagnosticsLine label="Rows by tier" value={formatCounts(diagnostics.rowsByTier)} />
        <DiagnosticsLine label="Rows by status" value={formatCounts(diagnostics.rowsByStatus)} />
        <DiagnosticsLine label="Rows by position" value={formatCounts(diagnostics.rowsByPosition)} />
        <DiagnosticsLine label="Warning counts" value={formatCounts(diagnostics.warningCounts)} />
        <DiagnosticsLine
          label="Experiment eligible"
          value={experimentDiagnostics ? String(experimentDiagnostics.blackbirdExperimentEligible) : "Preview only"}
          warning={experimentDiagnostics ? !experimentDiagnostics.blackbirdExperimentEligible : false}
        />
        <DiagnosticsLine
          label="Failed gates"
          value={experimentDiagnostics?.failedExperimentGates.join(", ") || "None"}
          warning={Boolean(experimentDiagnostics?.failedExperimentGates.length)}
        />
        <DiagnosticsLine label="IDP rows evaluated" value={String(diagnostics.idpRowsEvaluated)} />
        <DiagnosticsLine label="IDP rows by tier" value={formatCounts(diagnostics.idpRowsByTier)} />
        <DiagnosticsLine label="IDP avg components" value={formatScoreComponents(diagnostics.idpAverageScoreComponents)} />
        <DiagnosticsLine label="IDP suppression" value={formatCounts(diagnostics.idpSuppressionReasons)} />
        <DiagnosticsLine label="Context limitations" value={diagnostics.contextLimitations.join(", ") || "None"} />
        <DiagnosticsLine
          label="Invariant failures"
          value={diagnostics.invariantFailures.join(", ") || "None"}
          warning={diagnostics.invariantFailures.length > 0}
        />
      </div>
    </details>
  );
}

function DiagnosticsLine({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="uppercase tracking-wide text-slate-500">{label}</div>
      <div className={warning ? "text-red-200" : "text-slate-300"}>{value}</div>
    </div>
  );
}

function TierBadge({ tier }: { tier: RecommendationTier }) {
  const label =
    tier === "elite_target"
      ? "Elite"
      : tier === "strong_target"
        ? "Strong"
        : tier === "good_value"
          ? "Value"
          : tier === "depth_option"
            ? "Depth"
            : "Avoid";
  const className =
    tier === "elite_target"
      ? "border-gold/40 bg-gold/15 text-gold"
      : tier === "strong_target"
        ? "border-brand/40 bg-brand/15 text-brand"
        : tier === "good_value"
          ? "border-slate-400/30 bg-slate-400/10 text-slate-200"
          : tier === "depth_option"
            ? "border-line bg-background text-slate-300"
            : "border-red-400/30 bg-red-500/10 text-red-200";

  return <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${className}`}>{label}</span>;
}

function PriorityBadge({ index }: { index: number }) {
  const label = index === 0 ? "Top target" : index < 3 ? `Top ${index + 1}` : `Target ${index + 1}`;
  const className =
    index === 0
      ? "border-gold/35 bg-gold/12 text-gold"
      : index < 3
        ? "border-brand/35 bg-brand/12 text-brand"
        : "border-line bg-background text-slate-400";

  return <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${className}`}>{label}</span>;
}

function PositionBadge({ position }: { position: string | null }) {
  return (
    <span className="rounded-full border border-line bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
      {position ?? "UNK"}
    </span>
  );
}

function LimitedDataBadge({
  player,
  compact = false
}: {
  player: AvailablePlayer;
  compact?: boolean;
}) {
  const label =
    player.positionScoringMode === "idp_rankings_v1"
      ? "Rankings-only IDP"
      : player.positionScoringMode === "kicker_rankings_v1"
        ? "Rankings-only K"
        : player.positionScoringMode === "defense_rankings_v1"
          ? "Rankings-only DEF"
          : null;

  if (!label) return null;

  return (
    <span
      className={`rounded-full border border-brand/20 bg-brand/10 px-2 py-1 text-[11px] uppercase tracking-wide text-brand ${
        compact ? "" : ""
      }`}
    >
      {label}
    </span>
  );
}

function ReasonList({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;

  const primaryReasons = reasons.slice(0, 2);
  const extraReasons = reasons.slice(2);

  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2">
        {primaryReasons.map((reason) => (
          <div key={reason} className="rounded-lg border border-line/70 bg-background/60 px-3 py-2 text-xs text-slate-200">
            {reason}
          </div>
        ))}
      </div>
      {extraReasons.length ? (
        <div className="flex flex-wrap gap-2">
          {extraReasons.map((reason) => (
            <span key={reason} className="rounded-full border border-line px-2 py-1 text-[11px] text-slate-400">
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScoreBreakdown({ player }: { player: AvailablePlayer }) {
  if (!player.scoreComponents) return null;

  // TODO: Ground a future AI explanation layer in these deterministic score components.
  const components = [
    { label: "Rank", value: player.scoreComponents.rankingScore },
    { label: "Proj", value: player.scoreComponents.projectionScore },
    { label: "Value", value: player.scoreComponents.valueScore },
    { label: "Need", value: player.scoreComponents.rosterNeedScore },
    { label: "Scarcity", value: player.scoreComponents.scarcityScore },
    { label: "Format", value: player.scoreComponents.formatFitScore },
    { label: "ADP", value: player.scoreComponents.adpValueScore },
    { label: "Penalty", value: player.scoreComponents.matchConfidencePenalty }
  ];

  return (
    <details className="mt-3 group">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-line/70 bg-background/50 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-line hover:text-slate-100">
        <span>Why this score?</span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {components.map((component) => (
          <div key={component.label} className="rounded-lg border border-line/70 bg-background/60 px-2 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{component.label}</div>
            <div className="mt-1 text-sm font-bold text-slate-100">{component.value.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function ScoringMetadata({
  metadata
}: {
  metadata: DraftState["scoringMetadata"];
}) {
  return (
    <div className="mt-4 rounded-xl border border-line/80 bg-background/50 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
        <span>{metadata.formulaVersion}</span>
        <span className="text-slate-600">•</span>
        <span>{metadata.draftStage} stage</span>
        {metadata.idpScoringDetected ? (
          <>
            <span className="text-slate-600">•</span>
            <span>IDP scoring detected</span>
          </>
        ) : null}
        <span className="text-slate-600">•</span>
        <span>{new Date(metadata.generatedAt).toLocaleTimeString()}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Limits: {metadata.limitations.slice(0, 3).join(" ")}
      </p>
    </div>
  );
}

function RosterConstructionSummary({ state }: { state: DraftState }) {
  const visibleNeeds = state.positionNeeds.filter((need) => {
    if (need.position === "K") return state.hasKicker;
    if (need.position === "DEF") return state.hasTeamDefense;
    if (["DL", "LB", "DB"].includes(need.position)) return state.hasIDP;
    return ["QB", "RB", "WR", "TE"].includes(need.position);
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {visibleNeeds.map((need) => (
          <div key={need.position} className="rounded-md border border-line bg-panel2 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{need.label}</span>
                <NeedLevelBadge level={need.needLevel} />
              </div>
              <span className="text-sm text-slate-400">
                {need.draftedCount} / {need.directStarterRequirement}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {need.directStarterRequirement > 0
                ? `${need.directStarterRequirement} direct starter${need.directStarterRequirement === 1 ? "" : "s"}`
                : "No direct starter slots"}
              {need.sharedFlexDemand > 0 ? ` · ${need.sharedFlexDemand} shared flex demand` : ""}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {state.rosterRequirements.offensiveFlexCount > 0 ? (
          <SharedDemandCard label="Offensive Flex" value={state.rosterRequirements.offensiveFlexCount} />
        ) : null}
        {state.rosterRequirements.superflexCount > 0 ? (
          <SharedDemandCard label="Superflex" value={state.rosterRequirements.superflexCount} />
        ) : null}
        {state.rosterRequirements.idpFlexCount > 0 ? (
          <SharedDemandCard label="IDP Flex" value={state.rosterRequirements.idpFlexCount} />
        ) : null}
      </div>
      {state.hasIDP || state.hasKicker || state.hasTeamDefense ? (
        <p className="rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand">
          IDP, kicker, and team-defense recommendations currently use imported rankings, roster need, and scarcity.
          Player-stat and league-specific scoring inputs are coming in a later phase.
        </p>
      ) : null}
      {state.unknownRosterSlots.length ? (
        <p className="text-xs text-gold">Unknown slots: {state.unknownRosterSlots.join(", ")}</p>
      ) : null}
    </div>
  );
}

function SharedDemandCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-background/60 px-3 py-2 text-xs">
      <div className="uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-100">{value} shared slot{value === 1 ? "" : "s"}</div>
    </div>
  );
}

function NeedLevelBadge({
  level
}: {
  level: "urgent" | "high" | "moderate" | "low" | "filled" | "not_used";
}) {
  const className =
    level === "urgent"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : level === "high"
        ? "border-gold/35 bg-gold/10 text-gold"
        : level === "moderate"
          ? "border-brand/35 bg-brand/10 text-brand"
          : level === "low"
            ? "border-slate-400/30 bg-slate-400/10 text-slate-300"
            : level === "filled"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-line bg-background text-slate-400";

  return <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${className}`}>{level}</span>;
}

function EmptyTable({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="px-4 py-6 text-slate-400" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatNullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${Math.round(value * 100)}%`;
}

function mergeDraftableAndRemainingPlayers(draftablePlayers: AvailablePlayer[], remainingPlayers: AvailablePlayer[]): AvailablePlayer[] {
  const merged: AvailablePlayer[] = [];
  const seen = new Set<string>();
  const add = (player: AvailablePlayer, index: number, source: "draftable" | "remaining") => {
    const keys = playerMergeKeys(player, index, source);
    if (keys.some((key) => seen.has(key))) return;
    merged.push(player);
    keys.forEach((key) => seen.add(key));
  };

  draftablePlayers.forEach((player, index) => add(player, index, "draftable"));
  remainingPlayers.forEach((player, index) => add(player, index, "remaining"));
  return merged;
}

function playerMergeKeys(player: AvailablePlayer, index: number, source: "draftable" | "remaining"): string[] {
  const keys = [player.matched_player_id, player.sleeper_player_id]
    .filter((value): value is string => Boolean(value))
    .map((value) => `id:${value}`);
  const nameKey = [player.player_name, player.position, player.team]
    .map((value) => value?.trim().toLowerCase() ?? "")
    .join("|");
  if (nameKey.replaceAll("|", "")) keys.push(`name:${nameKey}`);
  return keys.length ? keys : [`fallback:${source}:${index}`];
}

function withFallbackDraftSuggestionRanks(rows: BlackbirdBoardRow[]): BlackbirdBoardRow[] {
  const rankedRows = rows
    .filter((row) => !row.drafted && row.draftSuggestionRank !== null)
    .sort((a, b) => (a.draftSuggestionRank ?? 999999) - (b.draftSuggestionRank ?? 999999));
  const fallbackRows = rows
    .filter((row) => !row.drafted && row.draftSuggestionRank === null)
    .sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName));
  const fallbackRankByKey = new Map<string, number>();
  fallbackRows.forEach((row, index) => {
    fallbackRankByKey.set(boardRowKey(row), rankedRows.length + index + 1);
  });

  return rows.map((row) => {
    const fallbackRank = fallbackRankByKey.get(boardRowKey(row));
    if (!fallbackRank) return row;
    return {
      ...row,
      draftSuggestionRank: fallbackRank,
      draftSuggestionScore: row.blackbirdValueScore,
      draftSuggestionType: row.dataStatus.projection === "unavailable" ? "insufficient_data" : "value",
      needTimingAction: row.needTimingAction ?? "value available",
    };
  });
}

function boardRowKey(row: BlackbirdBoardRow): string {
  return `${row.playerId ?? ""}|${row.playerName}|${row.position ?? ""}|${row.team ?? ""}`;
}

function blackbirdRankSummary(row: BlackbirdBoardRow): string {
  const detail = row.playerDetailContext;
  const positives = detail?.whyBlackbirdLikes.filter(Boolean) ?? row.contextualReasons;
  const cautions = detail?.whyBlackbirdIsCautious.filter(Boolean) ?? [];
  const projection = row.projectionPoints === null ? "projection unavailable" : `${formatNumber(row.projectionPoints)} median points`;
  const value = row.blackbirdValueScore === null ? "value score unavailable" : `${formatNumber(row.blackbirdValueScore)} value`;
  const reason = positives[0] ?? `${projection} and ${value} drive the ranking.`;
  const primaryCaution = cautions[0] ?? row.contextualDataGaps[0] ?? null;
  const caution = primaryCaution ? ` Caveat: ${primaryCaution}.` : "";
  return `Ranked #${row.blackbirdBoardRank} for this league because ${reason.replace(/\.$/, "")}. ${projection}; ${value}.${caution}`.replace(/\s+/g, " ").trim();
}

function teamRiskScore(row: BlackbirdBoardRow): number {
  let score = 3;
  if (row.planFit === "strong_fit") score -= 1;
  if (row.planFit === "contingency_fit" || row.planFit === "value_detour") score += 1;
  if (row.planFit === "avoid_forcing") score += 4;
  if (row.planFit === "insufficient_data") score += 2;
  if (row.waitPlanTargetCount && row.waitPlanTargetCount > 0) score -= 1;
  if (row.contextualDataGaps.length >= 4) score += 1;
  if (row.pointsAboveReplacement !== null && row.pointsAboveReplacement < 0) score += 1;
  return clampRisk(score);
}

function playerPerformanceRiskScore(row: BlackbirdBoardRow): number {
  let score = row.risk === "high" ? 8 : row.risk === "medium" ? 5 : 3;
  if (row.confidence === "very_low") score += 3;
  else if (row.confidence === "low") score += 2;
  else if (row.confidence === "high") score -= 1;
  if (row.projectionLow !== null && row.projectionHigh !== null && row.projectionPoints !== null) {
    const range = Math.abs(row.projectionHigh - row.projectionLow);
    const rangeRate = range / Math.max(Math.abs(row.projectionPoints), 1);
    if (rangeRate > 0.55) score += 2;
    else if (rangeRate > 0.35) score += 1;
  }
  if (row.dataStatus.projection === "unavailable") score += 2;
  if (row.role && ["backup", "deep_reserve", "rookie_unknown", "unknown"].includes(row.role)) score += 1;
  if (row.roleConfidence === "very_low" || row.roleConfidence === "low") score += 1;
  return clampRisk(score);
}

function clampRisk(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function formatTimingAction(value: string | null | undefined) {
  if (!value) return "Timing unavailable";
  return value.replaceAll("_", " ");
}

function projectionUnitLabel(row: Pick<BlackbirdBoardRow, "projectionUnit" | "projectionSource">) {
  if (row.projectionUnit === "season") return "Season projection";
  if (row.projectionUnit === "weekly") return "Weekly projection";
  if (row.projectionUnit === "game") return "Game projection";
  if (row.projectionUnit === "fallback") return "Fallback projection";
  return row.projectionSource === "missing" ? "Projection unavailable" : "Projection unit unknown";
}

function formatCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (!entries.length) return "None";
  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function formatRate(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatNullableRate(value: number | null) {
  return value === null ? "Unknown" : formatRate(value);
}

function formatScoreComponents(components: WarRoomRecommendationResult["diagnostics"]["idpAverageScoreComponents"]) {
  if (!components) return "None";
  return Object.entries(components).map(([key, value]) => `${key}: ${formatNumber(value)}`).join(", ");
}

function expectedPickNumber(round: number, draftSlot: number, teamCount: number) {
  const pickInRound = round % 2 === 0 ? teamCount - draftSlot + 1 : draftSlot;
  return (round - 1) * teamCount + pickInRound;
}

function inferDraftSlotForPick(pickNo: number, teamCount: number) {
  const round = Math.ceil(pickNo / teamCount);
  const pickInRound = ((pickNo - 1) % teamCount) + 1;
  return round % 2 === 0 ? teamCount - pickInRound + 1 : pickInRound;
}

// TODO: Extend War Room display logic for IDP roster slots and defensive positions.
// TODO: Add IDP support for more defensive slot variants and multi-position roster assignment edge cases.
// TODO: Surface player stats and projection-provider inputs when those data pipelines exist.
// TODO: Ground a future AI explanation layer in scoreComponents once deterministic scoring is stable.
