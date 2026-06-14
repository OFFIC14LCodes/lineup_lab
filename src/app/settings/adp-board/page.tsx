import Link from "next/link";

import { AdpBoardPanel } from "@/components/adp-board-panel";
import { PageShell, Panel } from "@/components/ui";
import { requireAdpBoardAccess } from "@/lib/adp/server/access";
import { computeH6ProfilesForBoard } from "@/lib/adp/server/hlv";
import { scoreFormatMatch } from "@/lib/adp/format-match";
import { buildAdpBoard, extractArchetypeExamples } from "@/lib/adp/board";
import { loadLatestSnapshotWithRecords } from "@/lib/adp/storage";
import { buildValueVsMarket } from "@/lib/adp/value";
import { assignFormatGroupKey } from "@/lib/adp/format-group";
import type { AdpBoardSeasonModel, AdpFormatGroupKey, AdpFormatMatchScore, AdpFormatProfile, ConsensusAdpRecord, LeagueFormatInput } from "@/lib/adp/types";
import type { DraftDataLeague } from "@/lib/draft-data/types";
import { createClient } from "@/lib/supabase/server";

export default async function AdpBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; season?: string }>;
}) {
  await requireAdpBoardAccess();

  const { leagueId, season: seasonStr } = await searchParams;
  const adpSeason = parseInt(seasonStr ?? "2026", 10);

  const supabase = await createClient();

  // Load user's leagues
  const { data: leaguesRaw } = await supabase
    .from("leagues")
    .select("id,name,season,total_teams,is_dynasty,is_best_ball,is_superflex,is_two_qb,te_premium,scoring_settings_json,roster_positions_json")
    .order("season", { ascending: false })
    .order("name");

  const leagues = (leaguesRaw ?? []) as DraftDataLeague[];

  const targetLeagueId = leagueId ?? leagues[0]?.id;
  const targetLeague = leagues.find((l) => l.id === targetLeagueId) ?? null;

  // Load latest ADP snapshot
  const snapshotData = await loadLatestSnapshotWithRecords(supabase, "mfl", adpSeason);

  let board: ReturnType<typeof buildAdpBoard> | null = null;
  let archetypes: ReturnType<typeof extractArchetypeExamples> | null = null;
  let formatMatchScore: AdpFormatMatchScore | null = null;
  let seasonModel: AdpBoardSeasonModel | null = null;
  let hlvDiagnostics: { profileCount: number; weeklyRowCount: number; positionBreakdown: Record<string, number> } | null = null;
  let boardFormatGroupKey: AdpFormatGroupKey | null = null;

  if (snapshotData && targetLeague) {
    // Season model: ADP from 2026 compared to 2025 historical stats under 2026 rules
    // HLV is intentionally historical — not a projection
    const historicalPerformanceSeason = adpSeason - 1;
    const leagueConfigSeason = adpSeason;

    seasonModel = {
      adpSeason,
      historicalPerformanceSeason,
      leagueConfigSeason,
      leagueId: targetLeague.id,
      analysisAsOfDate: new Date().toISOString(),
    };

    const scoring = targetLeague.scoring_settings_json ?? {};
    const rosterPositions = (targetLeague.roster_positions_json as string[] | null) ?? [];
    const leagueFormat = {
      leagueId: targetLeague.id,
      pprValue: typeof scoring["rec"] === "number" ? scoring["rec"] : 1.0,
      tePremiumValue: typeof scoring["bonus_rec_te"] === "number" ? scoring["bonus_rec_te"] : 0,
      teamCount: targetLeague.total_teams ?? 12,
      isDynasty: targetLeague.is_dynasty === true,
      isBestBall: targetLeague.is_best_ball === true,
      isSuperflex:
        rosterPositions.includes("SUPER_FLEX") ||
        targetLeague.is_superflex === true ||
        targetLeague.is_two_qb === true,
    };

    const snapshotFormatProfile = (JSON.parse(JSON.stringify(snapshotData.snapshot.source_meta_json)) as { formatProfile?: AdpFormatProfile }).formatProfile ?? null;

    const fmScore = snapshotFormatProfile
      ? scoreFormatMatch(snapshotData.snapshot.id, snapshotFormatProfile, leagueFormat)
      : scoreFormatMatch(
          snapshotData.snapshot.id,
          JSON.parse(JSON.stringify(snapshotData.snapshot.source_meta_json)).formatProfile,
          leagueFormat
        );
    formatMatchScore = fmScore;

    if (snapshotFormatProfile) {
      boardFormatGroupKey = assignFormatGroupKey(snapshotFormatProfile);
    }

    // Build consensus records from stored player records for VvM computation
    const consensus: ConsensusAdpRecord[] = snapshotData.records
      .filter((r) => r.canonical_player_id)
      .map((r) => ({
        canonicalPlayerId: r.canonical_player_id!,
        playerName: r.raw_name,
        position: r.raw_position,
        nflTeam: r.raw_team,
        isRookie: r.is_rookie,
        hasHistoricalProfile: r.has_historical_profile,
        overallAdp: Number(r.overall_adp),
        overallRank: r.overall_rank ?? 0,
        positionalAdp: r.positional_adp ? Number(r.positional_adp) : null,
        positionalRank: r.positional_rank ?? null,
        adpStddev: r.stddev ? Number(r.stddev) : null,
        minPick: r.min_pick,
        maxPick: r.max_pick,
        providerCount: 1,
        totalSampleSize: r.sample_size,
        recencyWeight: 1.0,
        formatWeight: fmScore.overallScore,
        sourceSnapshots: [r.snapshot_id],
      }));

    // Compute H6 historical profiles using 2025 stats scored under 2026 league config
    // season_type='regular' in player_weekly_stats (fixed from 'REG')
    const hlvResult = await computeH6ProfilesForBoard({
      supabase,
      league: targetLeague,
      performanceSeason: historicalPerformanceSeason,
      leagueConfigSeason,
    });

    hlvDiagnostics = {
      profileCount: hlvResult.profileCount,
      weeklyRowCount: hlvResult.weeklyRowCount,
      positionBreakdown: hlvResult.positionBreakdown,
    };

    const vvm = buildValueVsMarket(consensus, hlvResult.hlv, targetLeague.id);

    board = buildAdpBoard({
      snapshot: snapshotData.snapshot,
      records: snapshotData.records,
      formatMatch: formatMatchScore,
      hlv: hlvResult.hlv,
      vvm,
      seasonModel,
      snapshotFormatProfile: snapshotFormatProfile ?? undefined,
      leagueFormatInput: leagueFormat as LeagueFormatInput,
      formatGroupKey: boardFormatGroupKey ?? undefined,
    });

    archetypes = extractArchetypeExamples(board);
  }

  return (
    <PageShell className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">ADP Board</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Internal read-only board — {adpSeason} market ADP vs {adpSeason - 1} historical league value.
              Historical — not projected. Does not affect War Room recommendations.
            </p>
          </div>
          <Link href="/settings" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300">
            Back to settings
          </Link>
        </div>

        {/* Season model banner */}
        {seasonModel && (
          <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-xs text-blue-300">
            <span className="font-semibold">Season Model:</span>{" "}
            ADP season: <span className="text-blue-200">{seasonModel.adpSeason}</span>
            {" · "}
            Historical performance: <span className="text-blue-200">{seasonModel.historicalPerformanceSeason}</span>
            {" · "}
            League config: <span className="text-blue-200">{seasonModel.leagueConfigSeason}</span>
            {" · "}
            <span className="text-slate-400">Historical — not projected</span>
          </div>
        )}

        {snapshotData ? (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Provider: <span className="text-slate-200">MFL</span></span>
            <span>Season: <span className="text-slate-200">{snapshotData.snapshot.season}</span></span>
            <span>Records: <span className="text-slate-200">{snapshotData.snapshot.total_records}</span></span>
            <span>Sample: <span className="text-slate-200">{snapshotData.snapshot.sample_size ?? "n/a"} drafts</span></span>
            <span>Captured: <span className="text-slate-200">{new Date(snapshotData.snapshot.captured_at).toLocaleDateString()}</span></span>
            {formatMatchScore && (
              <span>Format match: <span className={formatMatchScore.isCompatible ? "text-green-400" : "text-amber-400"}>
                {(formatMatchScore.overallScore * 100).toFixed(0)}%
              </span></span>
            )}
            {hlvDiagnostics && (
              <span>
                H6 profiles: <span className="text-slate-200">{hlvDiagnostics.profileCount}</span>
                {" ("}
                {Object.entries(hlvDiagnostics.positionBreakdown).map(([pos, n]) => `${pos}:${n}`).join(" ")}
                {") from "}
                <span className="text-slate-200">{hlvDiagnostics.weeklyRowCount.toLocaleString()}</span> weekly rows
              </span>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
            No ADP snapshot found for season {adpSeason}. Run{" "}
            <code className="font-mono text-xs">npm run import:h7-adp -- --mode=execute</code> to import.
          </div>
        )}
      </Panel>

      {board && snapshotData && (
        <AdpBoardPanel
          board={board}
          archetypes={archetypes ?? []}
          snapshotCapturedAt={snapshotData.snapshot.captured_at}
          formatMatchScore={formatMatchScore}
          formatGroupKey={boardFormatGroupKey}
        />
      )}
    </PageShell>
  );
}
