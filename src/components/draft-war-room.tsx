"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";

type RecommendationTier = "elite_target" | "strong_target" | "good_value" | "depth_option" | "avoid_for_now";

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
};

type PickLine = {
  player_name: string | null;
  position: string | null;
  team: string | null;
  pick_no: number;
  round: number | null;
  pick_in_round: number | null;
  roster_label?: string | null;
};

type DraftState = {
  room: { id: string; status: string | null; last_synced_at: string | null };
  league: { name: string | null } | null;
  picks: PickLine[];
  currentPickNumber: number;
  currentRound: number;
  picksUntilMyNextPick: number | null;
  lastPick: PickLine | null;
  myRoster: PickLine[];
  positionCounts: Record<string, number>;
  remainingPlayers: AvailablePlayer[];
  recommendations: AvailablePlayer[];
  topNeeds: Array<{ position: string; current: number; target: number; need: number }>;
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
  };
  warnings: string[];
  warningMessages: string[];
  warning: string | null;
};

const POSITIONS = ["All", "QB", "RB", "WR", "TE"];
const MATCH_FILTERS = ["All", "Matched", "Issues"];

export function DraftWarRoom({ draftRoomId }: { draftRoomId: string }) {
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [positionFilter, setPositionFilter] = useState("All");
  const [matchFilter, setMatchFilter] = useState("All");
  const [search, setSearch] = useState("");

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
    void syncNow();
    const interval = window.setInterval(loadState, 5000);
    return () => window.clearInterval(interval);
  }, [loadState, syncNow]);

  const availablePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (state?.remainingPlayers ?? [])
      .filter((player) => positionFilter === "All" || player.position === positionFilter)
      .filter((player) => !needle || (player.player_name ?? "").toLowerCase().includes(needle))
      .filter((player) => {
        if (matchFilter === "Matched") return Boolean(player.matched_player_id || player.sleeper_player_id);
        if (matchFilter === "Issues") return player.match_status === "unmatched" || player.match_status === "ambiguous";
        return true;
      })
      .slice(0, 25);
  }, [matchFilter, positionFilter, search, state?.remainingPlayers]);

  if (error && !state) {
    return <div className="rf-panel p-6 text-red-300">{error}</div>;
  }

  if (!state) {
    return <div className="rf-panel p-6 text-slate-300">Loading draft room...</div>;
  }

  const recentPicks = state.picks.slice(-24).reverse();
  const totalDraftedByMe = state.myRoster.length;

  return (
    <div className="space-y-6">
      <section className="rf-panel p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-black">{state.league?.name ?? "Draft War Room"}</h1>
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
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <Metric label="Current pick" value={state.currentPickNumber} />
          <Metric label="Round" value={state.currentRound} />
          <Metric label="Until my pick" value={state.picksUntilMyNextPick ?? "N/A"} />
          <Metric label="Drafted" value={state.picks.length} />
          <Metric label="Last pick" value={state.lastPick?.player_name ?? "None"} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <section className="rf-panel overflow-hidden">
            <div className="border-b border-line p-4">
              <h2 className="text-xl font-bold">Draft Board</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-panel2 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Pick</th>
                    <th className="px-4 py-3">Round</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Pos</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Roster</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPicks.map((pick) => (
                    <tr key={pick.pick_no} className="border-t border-line/70">
                      <td className="px-4 py-3 font-bold">{pick.pick_no}</td>
                      <td className="px-4 py-3">{pick.round ?? "-"}</td>
                      <td className="px-4 py-3">{pick.player_name ?? "Unknown"}</td>
                      <td className="px-4 py-3">{pick.position ?? "-"}</td>
                      <td className="px-4 py-3">{pick.team ?? "-"}</td>
                      <td className="px-4 py-3">{pick.roster_label ?? "-"}</td>
                    </tr>
                  ))}
                  {recentPicks.length === 0 ? <EmptyTable colSpan={6} text="No picks synced yet." /> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rf-panel overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-xl font-bold">Available Players</h2>
                  <p className="mt-1 text-sm text-slate-400">{state.boardLabel}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[180px_140px_120px]">
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

        <aside className="space-y-6">
          <SidePanel title="My Roster Construction">
            <div className="grid grid-cols-2 gap-2">
              {["QB", "RB", "WR", "TE"].map((position) => (
                <Metric key={position} label={position} value={state.positionCounts[position] ?? 0} />
              ))}
            </div>
            <div className="mt-3 rounded-md border border-line bg-panel2 px-3 py-2 text-sm">
              Total drafted: <span className="font-bold">{totalDraftedByMe}</span>
            </div>
            <NeedsList needs={state.topNeeds} />
          </SidePanel>

          <SidePanel title="Recommended Targets">
            <RecommendationList
              players={state.recommendations.slice(0, 10)}
              rankingsUploaded={state.rankingsUploaded}
              warningMessages={state.warningMessages}
            />
            <NeedsList needs={state.topNeeds} compact />
            <ScoringMetadata metadata={state.scoringMetadata} />
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}

function AvailablePlayersTable({ players }: { players: AvailablePlayer[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1240px] text-left text-sm">
        <thead className="bg-panel2 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Player</th>
            <th className="px-3 py-3">Score</th>
            <th className="px-3 py-3">Tier</th>
            <th className="px-3 py-3">Pos</th>
            <th className="px-3 py-3">Team</th>
            <th className="px-3 py-3">Proj</th>
            <th className="px-3 py-3">ADP</th>
            <th className="px-3 py-3">Dynasty</th>
            <th className="px-3 py-3">Best Ball</th>
            <th className="px-3 py-3">Superflex</th>
            <th className="px-3 py-3">TE Prem</th>
            <th className="px-3 py-3">Match</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={`${player.sleeper_player_id ?? player.player_name}-${index}`} className="border-t border-line/70">
              <td className="px-3 py-3 font-bold">{player.rank ?? (player.is_fallback ? "-" : index + 1)}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-100">{player.player_name ?? "Unknown"}</div>
                <div className="mt-1 text-xs text-slate-500">{player.team ?? player.position ?? "Player pool item"}</div>
              </td>
              <td className="px-3 py-3">
                {player.draftTargetScore === null ? (
                  "-"
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
              <td className="px-3 py-3">{formatNumber(player.adp)}</td>
              <td className="px-3 py-3">{formatNumber(player.dynasty_value)}</td>
              <td className="px-3 py-3">{formatNumber(player.best_ball_value)}</td>
              <td className="px-3 py-3">{formatNumber(player.superflex_value)}</td>
              <td className="px-3 py-3">{formatNumber(player.te_premium_value)}</td>
              <td className="px-3 py-3">{player.match_status ?? (player.is_fallback ? "fallback" : "-")}</td>
            </tr>
          ))}
          {players.length === 0 ? <EmptyTable colSpan={13} text="No available players match these filters." /> : null}
        </tbody>
      </table>
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
  needs: Array<{ position: string; current: number; target: number; need: number }>;
  compact?: boolean;
}) {
  if (!needs.length) {
    return <p className="mt-3 text-sm text-slate-400">Starter targets covered by placeholder counts.</p>;
  }

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      {needs.map((need) => (
        <div key={need.position} className="flex justify-between border-b border-line/70 py-2 text-sm">
          <span>{need.position}</span>
          <span className="text-slate-400">
            {need.current}/{need.target}
          </span>
        </div>
      ))}
    </div>
  );
}

function RecommendationList({
  players,
  rankingsUploaded,
  warningMessages
}: {
  players: AvailablePlayer[];
  rankingsUploaded: boolean;
  warningMessages: string[];
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
        <span className="text-slate-600">•</span>
        <span>{new Date(metadata.generatedAt).toLocaleTimeString()}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Limits: {metadata.limitations.slice(0, 2).join(" ")}
      </p>
    </div>
  );
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

// TODO: Extend War Room display logic for IDP roster slots and defensive positions.
// TODO: Surface player stats and projection-provider inputs when those data pipelines exist.
