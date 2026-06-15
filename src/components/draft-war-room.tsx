"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw, Search, Users } from "lucide-react";

import type { WarRoomValueOverlayRow, WarRoomValueOverlayResult } from "@/lib/draft/h10-war-room-overlay";
import type { H10RecommendationExperimentDiagnostics } from "@/lib/draft/war-room-recommendation-experiment";
import {
  buildH10RecommendationExperimentUiState,
  DEFAULT_H10_RECOMMENDATION_SOURCE,
  H10_RECOMMENDATION_READINESS_LABELS,
  type H10RecommendationSource,
} from "@/lib/draft/war-room-recommendation-experiment-ui";
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
};

type DraftState = {
  room: { id: string; status: string | null; last_synced_at: string | null };
  league: { name: string | null } | null;
  picks: PickLine[];
  currentPickNumber: number;
  currentRound: number;
  picksUntilMyNextPick: number | null;
  myDraftSlot: number | null;
  teamCount: number | null;
  lastPick: PickLine | null;
  myRoster: PickLine[];
  draftBoardTeams: DraftBoardTeam[];
  positionCounts: Record<string, number>;
  remainingPlayers: AvailablePlayer[];
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

type AvailablePlayerTableRow = {
  player: AvailablePlayer;
  h10Overlay: WarRoomValueOverlayRow | null;
};

const POSITIONS = ["All", "QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const MATCH_FILTERS = ["All", "Matched", "Issues"];
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
  const [search, setSearch] = useState("");
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [recommendationSource, setRecommendationSource] = useState<H10RecommendationSource>(DEFAULT_H10_RECOMMENDATION_SOURCE);

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

  const syncNow = useCallback(async () => {
    setSyncing(true);
    const response = await fetch(`/api/draft-rooms/${draftRoomId}/sync`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Sync failed.");
    }
    setSyncing(false);
    await loadState();
  }, [draftRoomId, loadState]);

  useEffect(() => {
    if (disableAutoSync) void loadState();
    else void syncNow();
    const interval = window.setInterval(loadState, 5000);
    return () => window.clearInterval(interval);
  }, [disableAutoSync, loadState, syncNow]);

  const availablePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (state?.remainingPlayers ?? [])
      .map((player, index) => ({
        player,
        h10Overlay: state?.h10ValueOverlay?.[index] ?? null,
      }))
      .filter(({ player }) => positionFilter === "All" || player.position === positionFilter)
      .filter(({ player }) => !needle || (player.player_name ?? "").toLowerCase().includes(needle))
      .filter(({ player }) => {
        if (matchFilter === "Matched") return Boolean(player.matched_player_id || player.sleeper_player_id);
        if (matchFilter === "Issues") return player.match_status === "unmatched" || player.match_status === "ambiguous";
        return true;
      })
      .slice(0, 25);
  }, [matchFilter, positionFilter, search, state?.h10ValueOverlay, state?.remainingPlayers]);

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

  return (
    <div className="space-y-6">
      <section className="rf-panel p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black sm:text-3xl">{state.league?.name ?? "Draft War Room"}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Status {state.room.status ?? "unknown"} · Polling every 5 seconds · Last synced{" "}
              {state.room.last_synced_at ? new Date(state.room.last_synced_at).toLocaleTimeString() : "never"}
            </p>
          </div>
          <button className="rf-button" onClick={syncNow} disabled={syncing}>
            <RefreshCw className="h-4 w-4" />
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {state.warningMessages.length ? (
          <div className="mt-4 grid gap-2">
            {state.warningMessages.map((message) => (
              <p key={message} className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
                {message}
              </p>
            ))}
          </div>
        ) : null}
        {state.fallbackRelevanceDiagnostics && state.fallbackRelevanceDiagnostics.fallbackRowsExcluded > 0 ? (
          <p className="mt-3 rounded-md border border-line bg-panel2 px-3 py-2 text-xs text-slate-400">
            Some diagnostic fallback players are hidden because they lack rankings, ADP, and Blackbird projections.
          </p>
        ) : null}
        {state.h10InternalTrustedExperimentAllowed ? (
          <div className="mt-3 rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand">
            <span className="font-bold">Internal Blackbird Mode</span> · Read-only trusted preview · Synthetic replay validated; historical outcome validation not yet available.
          </div>
        ) : null}
        {state.myDraftSlot === null ? (
          <p className="mt-3 rounded-md border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold">
            Your draft slot is not detected yet. Sync league rosters or draft picks to restore exact pick timing.
          </p>
        ) : null}
        {!state.picks.length ? (
          <p className="mt-3 rounded-md border border-line bg-panel2 px-3 py-2 text-xs text-slate-400">
            No synced draft picks yet. The board will fill as Sleeper picks arrive.
          </p>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Current pick" value={state.currentPickNumber} />
          <Metric label="Round" value={state.currentRound} />
          <Metric label="Until my pick" value={state.picksUntilMyNextPick ?? "N/A"} />
          <Metric label="Drafted" value={state.picks.length} />
          <Metric label="Last pick" value={state.lastPick?.player_name ?? "None"} />
        </div>
      </section>

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
                  <h2 className="text-xl font-bold">Available Players</h2>
                  <p className="mt-1 text-sm text-slate-400">{state.boardLabel}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_140px_120px]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      className="rf-input pl-9"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search players"
                    />
                  </label>
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
                </div>
              </div>
            </div>
            <AvailablePlayersTable players={availablePlayers} />
          </section>
        </section>

        <aside className="min-w-0 space-y-5">
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
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[1120px] gap-px bg-line/70 p-px"
          style={{ gridTemplateColumns: `56px repeat(${teams.length}, minmax(128px, 1fr))` }}
        >
          <div className="sticky left-0 z-10 bg-panel2 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Rd
          </div>
          {teams.map((team) => (
            <div
              key={team.rosterId}
              className={`bg-panel2 px-3 py-3 text-xs ${team.draftSlot === myDraftSlot ? "ring-1 ring-inset ring-gold/60" : ""}`}
            >
              <div className="font-black text-slate-100">Slot {team.draftSlot}</div>
              <div className="mt-1 truncate text-slate-400">{team.label}</div>
              {team.draftSlot === myDraftSlot ? <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gold">My slot</div> : null}
            </div>
          ))}
          {Array.from({ length: maxRound }, (_, index) => index + 1).flatMap((round) => [
            <div key={`round-${round}`} className="sticky left-0 z-10 flex items-center justify-center bg-panel2 text-sm font-black text-slate-300">
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
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      {positions.map((position) => (
        <span key={position} className={`rounded-full border px-2 py-1 font-bold ${positionBadgeClass(position)}`}>
          {position}
        </span>
      ))}
    </div>
  );
}

function DraftPickCard({ pick, expectedPickNo, isCurrent }: { pick: PickLine | null; expectedPickNo: number; isCurrent: boolean }) {
  if (!pick) {
    return (
      <div className={`min-h-[78px] bg-background/70 p-2 ${isCurrent ? "outline outline-2 outline-gold/70" : ""}`}>
        <div className="text-[11px] font-semibold text-slate-600">#{expectedPickNo}</div>
        {isCurrent ? <div className="mt-3 text-xs font-bold text-gold">On clock</div> : null}
      </div>
    );
  }

  return (
    <div className={`min-h-[78px] border-l-4 p-2 ${positionCardClass(pick.position)}`}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-slate-300">#{pick.pick_no}</span>
        <span className="rounded-full bg-background/50 px-2 py-0.5 font-bold text-slate-100">{pick.position ?? "UNK"}</span>
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-black leading-tight text-slate-50">{pick.player_name ?? "Unknown"}</div>
      <div className="mt-1 truncate text-[11px] text-slate-300">{pick.team ?? pick.roster_label ?? "-"}</div>
    </div>
  );
}

function TeamRosterStrip({ team, picks }: { team: DraftBoardTeam; picks: PickLine[] }) {
  const grouped = picks.reduce<Record<string, PickLine[]>>((acc, pick) => {
    const position = pick.position ?? "UNK";
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
            <span key={position} className={`rounded-full border px-2 py-1 text-[11px] font-bold ${positionBadgeClass(position)}`}>
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
              <span className={`rounded-full border px-2 py-0.5 font-bold ${positionBadgeClass(pick.position)}`}>{pick.position ?? "UNK"}</span>
            </div>
            <div className="mt-1 text-slate-500">Pick {pick.pick_no} · Round {pick.round ?? "-"}</div>
          </div>
        ))}
        {!picks.length ? <p className="text-sm text-slate-400">No synced picks for this team yet. Sync Sleeper draft picks to populate this roster view.</p> : null}
      </div>
    </div>
  );
}

function AvailablePlayersTable({ players }: { players: AvailablePlayerTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1760px] text-left text-sm">
        <thead className="bg-panel2 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Player</th>
            <th className="px-3 py-3">Score</th>
            <th className="px-3 py-3">Tier</th>
            <th className="px-3 py-3">Pos</th>
            <th className="px-3 py-3">Team</th>
            <th className="px-3 py-3">Proj</th>
            <th className="px-3 py-3">H10 PAR</th>
            <th className="px-3 py-3">H10 Risk</th>
            <th className="px-3 py-3">H10 Tier</th>
            <th className="px-3 py-3">Scarcity</th>
            <th className="px-3 py-3">Market</th>
            <th className="px-3 py-3">Confidence</th>
            <th className="px-3 py-3">H10 Warnings</th>
            <th className="px-3 py-3">ADP</th>
            <th className="px-3 py-3">Dynasty</th>
            <th className="px-3 py-3">Best Ball</th>
            <th className="px-3 py-3">Superflex</th>
            <th className="px-3 py-3">TE Prem</th>
            <th className="px-3 py-3">Match</th>
          </tr>
        </thead>
        <tbody>
          {players.map(({ player, h10Overlay }, index) => (
            <tr key={`${player.sleeper_player_id ?? player.player_name}-${index}`} className="border-t border-line/70">
              <td className="px-3 py-3 font-bold">{player.rank ?? (player.is_fallback ? "-" : index + 1)}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-100">{player.player_name ?? "Unknown"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{player.team ?? player.position ?? "Player pool item"}</span>
                  {player.positionScoringMode && player.positionScoringMode !== "offense_v1_1" ? (
                    <LimitedDataBadge player={player} compact />
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-3">
                {player.draftTargetScore === null ? (
                  <span className="text-slate-500">{player.position && NON_OFFENSIVE_POSITIONS.has(player.position) ? "Not scored" : "-"}</span>
                ) : (
                  <span className="inline-flex min-w-[3.75rem] justify-center rounded-md border border-brand/20 bg-brand/10 px-2 py-1 font-black text-brand">
                    {player.draftTargetScore.toFixed(1)}
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                <TierBadge tier={player.recommendationTier} />
              </td>
              <td className="px-3 py-3">{player.position || "-"}</td>
              <td className="px-3 py-3">{player.team || "-"}</td>
              <td className="px-3 py-3">{formatNumber(player.projected_points)}</td>
              <td className="px-3 py-3">{formatOverlayNumber(h10Overlay, h10Overlay?.pointsAboveReplacement)}</td>
              <td className="px-3 py-3">{formatOverlayNumber(h10Overlay, h10Overlay?.riskAdjustedValue)}</td>
              <td className="px-3 py-3">
                <H10ValueBadge overlay={h10Overlay} />
              </td>
              <td className="px-3 py-3">{formatOverlayText(h10Overlay, h10Overlay?.scarcityLabel)}</td>
              <td className="px-3 py-3">{formatMarketSignal(h10Overlay)}</td>
              <td className="px-3 py-3">
                <H10StatusBadge overlay={h10Overlay} />
              </td>
              <td className="px-3 py-3">
                <H10WarningList overlay={h10Overlay} />
              </td>
              <td className="px-3 py-3">{formatNumber(player.adp)}</td>
              <td className="px-3 py-3">{formatNumber(player.dynasty_value)}</td>
              <td className="px-3 py-3">{formatNumber(player.best_ball_value)}</td>
              <td className="px-3 py-3">{formatNumber(player.superflex_value)}</td>
              <td className="px-3 py-3">{formatNumber(player.te_premium_value)}</td>
              <td className="px-3 py-3">
                <div>{player.match_status ?? (player.is_fallback ? "fallback" : "-")}</div>
                {player.warnings[0] ? <div className="mt-1 text-[11px] text-slate-500">{player.warnings[0]}</div> : null}
              </td>
            </tr>
          ))}
          {players.length === 0 ? <EmptyTable colSpan={20} text="No available players match these filters." /> : null}
        </tbody>
      </table>
    </div>
  );
}

function H10ValueBadge({ overlay }: { overlay: WarRoomValueOverlayRow | null }) {
  if (!overlay || overlay.overlayStatus === "missing_projection") return <span className="text-slate-500">No projection</span>;
  if (overlay.overlayStatus === "format_excluded") return <span className="text-slate-500">Format excluded</span>;
  const label = overlay.tierLabel ?? (overlay.tier === null ? "-" : `Tier ${overlay.tier}`);
  return (
    <span className="inline-flex max-w-[8rem] rounded-full border border-line bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
      <span className="truncate">{label}</span>
    </span>
  );
}

function H10StatusBadge({ overlay }: { overlay: WarRoomValueOverlayRow | null }) {
  if (!overlay || overlay.overlayStatus === "missing_projection") return <span className="text-slate-500">No projection</span>;
  const label =
    overlay.overlayStatus === "dst_dry_run"
      ? "DST dry-run"
      : overlay.overlayStatus === "low_confidence"
        ? "Low confidence"
        : overlay.overlayStatus === "format_excluded"
          ? "Format excluded"
          : overlay.confidenceLabel ?? "Available";
  const className =
    overlay.overlayStatus === "available"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
      : overlay.overlayStatus === "low_confidence"
        ? "border-gold/30 bg-gold/10 text-gold"
        : "border-line bg-background text-slate-400";
  return <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${className}`}>{label}</span>;
}

function H10WarningList({ overlay }: { overlay: WarRoomValueOverlayRow | null }) {
  if (!overlay) return <span className="text-slate-500">-</span>;
  if (!overlay.warningCodes.length) return <span className="text-slate-500">None</span>;
  return (
    <div className="flex max-w-[14rem] flex-wrap gap-1">
      {overlay.warningCodes.slice(0, 2).map((warning) => (
        <span key={warning} className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] text-gold">
          {warning}
        </span>
      ))}
      {overlay.warningCodes.length > 2 ? <span className="text-[11px] text-slate-500">+{overlay.warningCodes.length - 2}</span> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-panel2 p-3">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-lg font-black">{value}</div>
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
            : "Upload matched rankings to unlock Draft Target Score recommendations. If rankings are absent, the War Room falls back to the Sleeper player pool only."}
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

const NON_OFFENSIVE_POSITIONS = new Set(["K", "DEF", "DL", "LB", "DB"]);

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

function formatOverlayNumber(overlay: WarRoomValueOverlayRow | null, value: number | null | undefined) {
  if (!overlay) return "-";
  if (overlay.overlayStatus === "missing_projection") return "No projection";
  if (overlay.overlayStatus === "format_excluded") return "Format excluded";
  return formatNumber(value);
}

function formatOverlayText(overlay: WarRoomValueOverlayRow | null, value: string | null | undefined) {
  if (!overlay) return "-";
  if (overlay.overlayStatus === "missing_projection") return "No projection";
  if (overlay.overlayStatus === "format_excluded") return "Format excluded";
  return value ?? "-";
}

function formatMarketSignal(overlay: WarRoomValueOverlayRow | null) {
  if (!overlay) return "-";
  if (overlay.overlayStatus === "missing_projection") return "No projection";
  if (overlay.overlayStatus === "format_excluded") return "Format excluded";
  const delta = overlay.marketRankDelta === null || overlay.marketRankDelta === undefined ? "" : ` (${formatNumber(overlay.marketRankDelta)})`;
  return `${overlay.marketValueSignal ?? "-"}${delta}`;
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

function positionCardClass(position: string | null | undefined) {
  const base = "border-line bg-panel2 text-slate-100";
  const classes: Record<string, string> = {
    QB: "border-red-400 bg-red-500/20",
    RB: "border-emerald-400 bg-emerald-500/18",
    WR: "border-sky-400 bg-sky-500/18",
    TE: "border-orange-300 bg-orange-500/18",
    K: "border-fuchsia-300 bg-fuchsia-500/16",
    DEF: "border-zinc-300 bg-zinc-500/18",
    DL: "border-violet-300 bg-violet-500/18",
    LB: "border-lime-300 bg-lime-500/16",
    DB: "border-cyan-300 bg-cyan-500/16",
  };
  return classes[position ?? ""] ?? base;
}

function positionBadgeClass(position: string | null | undefined) {
  const classes: Record<string, string> = {
    QB: "border-red-300/40 bg-red-500/15 text-red-100",
    RB: "border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
    WR: "border-sky-300/40 bg-sky-500/15 text-sky-100",
    TE: "border-orange-300/40 bg-orange-500/15 text-orange-100",
    K: "border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-100",
    DEF: "border-zinc-300/40 bg-zinc-500/15 text-zinc-100",
    DL: "border-violet-300/40 bg-violet-500/15 text-violet-100",
    LB: "border-lime-300/40 bg-lime-500/15 text-lime-100",
    DB: "border-cyan-300/40 bg-cyan-500/15 text-cyan-100",
  };
  return classes[position ?? ""] ?? "border-line bg-background text-slate-300";
}

// TODO: Extend War Room display logic for IDP roster slots and defensive positions.
// TODO: Add IDP support for more defensive slot variants and multi-position roster assignment edge cases.
// TODO: Surface player stats and projection-provider inputs when those data pipelines exist.
// TODO: Ground a future AI explanation layer in scoreComponents once deterministic scoring is stable.
