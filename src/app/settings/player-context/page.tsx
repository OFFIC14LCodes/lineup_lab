import { PageShell, Panel } from "@/components/ui";
import { PlayerContextPanel } from "@/components/player-context-panel";
import type { PlayerContextEntry } from "@/components/player-context-panel";
import { requirePlayerContextAccess } from "@/lib/context/server/access";
import { aggregatePlayerSeasonStats, derivePlayerContext } from "@/lib/context/derive";
import type { WeeklyStatRow, DerivedStatRow } from "@/lib/context/derive";
import { createClient } from "@/lib/supabase/server";

const CONTEXT_SEASON = 2025; // Prior season — derive context from historical data
const PLAYER_LIMIT = 100;

export default async function PlayerContextPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string; season?: string }>;
}) {
  await requirePlayerContextAccess();

  const { position, season: seasonStr } = await searchParams;
  const season = parseInt(seasonStr ?? String(CONTEXT_SEASON), 10);

  const supabase = await createClient();

  // Load players (skill positions only)
  const positions = position ? [position] : ["QB", "RB", "WR", "TE"];
  const { data: playersRaw, error: playersError } = await supabase
    .from("players")
    .select("id, full_name, position, team")
    .in("position", positions)
    .not("position", "is", null)
    .limit(PLAYER_LIMIT);

  if (playersError) {
    return (
      <PageShell>
        <Panel>
          <h1 className="text-2xl font-black mb-2">Player Context</h1>
          <p className="text-red-400 text-sm">Failed to load players: {playersError.message}</p>
        </Panel>
      </PageShell>
    );
  }

  const players = (playersRaw ?? []) as Array<{
    id: string;
    full_name: string;
    position: string | null;
    team: string | null;
  }>;

  const playerIds = players.map((p) => p.id);

  // Load weekly stats (H1) and derived stats (H2)
  const [weeklyResult, derivedResult] = await Promise.all([
    supabase
      .from("player_weekly_stats")
      .select("player_id, season, week, stats_json")
      .eq("season", season)
      .in("player_id", playerIds),
    supabase
      .from("player_weekly_derived_stats")
      .select("player_id, season, week, stats_json")
      .eq("season", season)
      .in("player_id", playerIds),
  ]);

  const weeklyRows: WeeklyStatRow[] = (weeklyResult.data ?? []) as WeeklyStatRow[];
  const derivedRows: DerivedStatRow[] = (derivedResult.data ?? []) as DerivedStatRow[];

  const capturedAt = new Date().toISOString();

  // Derive context for each player
  const entries: PlayerContextEntry[] = players.map((player) => {
    const stats = aggregatePlayerSeasonStats(
      player.id,
      weeklyRows,
      derivedRows,
      season,
      player.position
    );

    if (stats.games === 0) {
      return {
        playerId: player.id,
        fullName: player.full_name,
        position: player.position,
        team: player.team,
        season,
        games: 0,
        derivedContext: null,
      };
    }

    const { context } = derivePlayerContext(stats, null, capturedAt);
    return {
      playerId: player.id,
      fullName: player.full_name,
      position: player.position,
      team: player.team,
      season,
      games: stats.games,
      derivedContext: context,
    };
  });

  // Extract backlogs from a sample derivation
  const sampleStats = aggregatePlayerSeasonStats(
    players[0]?.id ?? "none",
    weeklyRows,
    derivedRows,
    season,
    null
  );
  const { context: sampleCtx } = derivePlayerContext(sampleStats, null, capturedAt);

  const withDataCount = entries.filter((e) => e.derivedContext !== null).length;

  return (
    <PageShell>
      <Panel>
        <div className="mb-6">
          <h1 className="text-2xl font-black">Player Context</h1>
          <p className="mt-1 text-sm text-slate-400">
            Derived from {season} historical H1/H2 data. Observed facts — not projections.
          </p>
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span>{entries.length} players</span>
            <span>{withDataCount} with derived context</span>
            <span>{weeklyRows.length} weekly stat rows</span>
            <span>{derivedRows.length} derived stat rows</span>
          </div>
        </div>

        <PlayerContextPanel
          entries={entries}
          season={season}
          backlogs={sampleCtx.backlogs}
        />
      </Panel>
    </PageShell>
  );
}
