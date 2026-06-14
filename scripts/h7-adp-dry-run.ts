// H7 ADP Dry-Run Diagnostic
// Fetches ADP from MFL, resolves identities against canonical players,
// scores format match against the user's leagues, and optionally computes
// Historical League Value + Value-vs-Market from H6 profiles.
//
// Usage:
//   npx tsx scripts/h7-adp-dry-run.ts [options]
//
// Options:
//   --season <year>           ADP season to fetch (default: 2026)
//   --team-count <n>          Team count for MFL fetch (default: 12)
//   --performance-season <y>  H6 performance season for HLV (default: 2025)
//   --league-id <id>          Target league for format match + HLV (optional)
//   --mfl-url <url>           Override MFL API base URL (for testing)

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildConsensusAdp, buildExternalIdMap, buildHistoricalLeagueValues, buildPositionalTiers, buildValueVsMarket, resolveAdpIdentities, scoreFormatMatch, summarizeResolution } from "@/lib/adp";
import { buildAvailabilityModels } from "@/lib/adp/availability";
import type { ConsensusAdpRecord, LeagueFormatInput, PlayerAdpRecord } from "@/lib/adp/types";
import { aggregateLeagueDraftData } from "@/lib/draft-data/aggregate";
import type { DraftDataDerivedWeeklyRow, DraftDataLeague, DraftDataPlayer, DraftDataWeeklyRow, PbpDerivedBatchStatus } from "@/lib/draft-data/types";
import type { MatchablePlayer } from "@/lib/players/match";
import { fetchMflAdp, buildMflSourceMeta } from "@/lib/providers/adp/mfl";

type SupabaseLike = SupabaseClient<any>;

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnv();

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string | null = null) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
  };
  return {
    season: parseInt(get("--season", "2026") ?? "2026", 10),
    teamCount: parseInt(get("--team-count", "12") ?? "12", 10),
    performanceSeason: parseInt(get("--performance-season", "2025") ?? "2025", 10),
    leagueId: get("--league-id"),
    mflBaseUrl: get("--mfl-url"),
  };
}

async function main() {
  const args = parseArgs();
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const operatorUserId = process.env["SCORING_VALIDATION_OPERATOR_USER_ID"]?.trim() || null;

  if (!supabaseUrl || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log(`[h7-adp] DRY RUN — no database rows will be written.`);
  console.log(`[h7-adp] ADP season=${args.season} teamCount=${args.teamCount}`);

  // 1. Fetch ADP from MFL
  console.log("[h7-adp] Fetching ADP from MFL API...");
  const now = new Date().toISOString();
  let mflResult: Awaited<ReturnType<typeof fetchMflAdp>>;
  try {
    mflResult = await fetchMflAdp({
      season: args.season,
      teamCount: args.teamCount,
      baseUrl: args.mflBaseUrl ?? undefined,
    });
  } catch (err) {
    console.error(`[h7-adp] MFL fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error("[h7-adp] Hint: verify MFL API is reachable at https://api.myfantasyleague.com");
    process.exit(1);
  }

  const sourceMeta = buildMflSourceMeta({
    season: args.season,
    teamCount: args.teamCount,
    capturedAt: now,
    effectiveDate: now.slice(0, 10),
    fileHash: mflResult.fileHash,
    sourceUrl: mflResult.sourceUrl,
    sampleSize: mflResult.sampleSize,
    sourceVersion: mflResult.sourceVersion,
  });

  console.log(
    `[h7-adp] Fetched ${mflResult.raw.length} raw ADP records` +
    ` (hash=${mflResult.fileHash.slice(0, 12)}..., sampleSize=${mflResult.sampleSize ?? "n/a"}, rejected=${mflResult.rejectedCount})`
  );
  if (mflResult.rejectedCount > 0) {
    console.log(`[h7-adp] Rejection reasons: ${JSON.stringify(mflResult.rejectedReasons)}`);
  }

  // 2. Load canonical players for identity resolution
  console.log("[h7-adp] Loading canonical players...");
  const canonicalPlayers = await loadCanonicalPlayers(supabase);
  console.log(`[h7-adp] Loaded ${canonicalPlayers.length} canonical players`);

  // 3. Load MFL external IDs (may be empty if not yet seeded)
  const externalIdRows = await loadMflExternalIds(supabase);
  const externalIdMap = buildExternalIdMap(externalIdRows);
  console.log(`[h7-adp] MFL external ID map: ${externalIdMap.size} entries`);

  // 4. Resolve identities
  console.log("[h7-adp] Resolving player identities...");
  const resolved: PlayerAdpRecord[] = resolveAdpIdentities(mflResult.raw, {
    externalIdMap,
    canonicalPlayers,
    playerIdsWithProfile: new Set(), // Will fill if HLV is computed below
  });

  const summary = summarizeResolution(resolved);
  console.log(
    `[h7-adp] Resolution: ${summary.resolved}/${summary.total} resolved ` +
    `(${summary.ambiguous} ambiguous, ${summary.unresolved} unresolved, ${summary.rookie} rookie)`
  );

  // 5. Build consensus (single source — acts as passthrough; multi-source blending is future work)
  const consensusRecords = buildConsensusAdp([
    {
      snapshotId: sourceMeta.fileHash,
      provider: "mfl",
      capturedAt: now,
      formatMatchScore: 1.0,           // Single source — no cross-source weighting yet
      sourceConfidenceScore: 0.75,     // MFL "medium" confidence
      sampleSize: null,
      records: resolved,
    }
  ]);

  console.log(`[h7-adp] Consensus: ${consensusRecords.length} players with overall ADP`);

  // 6. Load leagues and score format match
  let leagues: DraftDataLeague[] = [];
  if (operatorUserId) {
    leagues = await loadLeagues(supabase, operatorUserId);
    console.log(`[h7-adp] Format-matching ${leagues.length} leagues...`);
  } else {
    console.warn("[h7-adp] SCORING_VALIDATION_OPERATOR_USER_ID not set — skipping league format match");
  }

  const formatMatchResults = leagues.map((league) => {
    const leagueFormat = leagueToFormatInput(league);
    const fmScore = scoreFormatMatch(sourceMeta.fileHash, sourceMeta.formatProfile, leagueFormat);
    return {
      leagueName: league.name,
      ...fmScore,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);

  // 7. Optional HLV computation (requires a specific league ID)
  let hlvOutput: ReturnType<typeof buildHistoricalLeagueValues> | null = null;
  let vvmOutput: ReturnType<typeof buildValueVsMarket> | null = null;
  let tiersOutput: ReturnType<typeof buildPositionalTiers> | null = null;
  let availabilityOutput: ReturnType<typeof buildAvailabilityModels> | null = null;

  if (args.leagueId && operatorUserId) {
    const targetLeague = leagues.find((l) => l.id === args.leagueId);
    if (!targetLeague) {
      console.warn(`[h7-adp] League ${args.leagueId} not found in owned leagues — skipping HLV`);
    } else {
      console.log(`[h7-adp] Computing HLV for league: ${targetLeague.name} (season=${args.performanceSeason})`);
      const hlvResult = await computeHlv(supabase, targetLeague, args.performanceSeason, consensusRecords);
      hlvOutput = hlvResult.hlv;
      vvmOutput = hlvResult.vvm;
      tiersOutput = buildPositionalTiers(consensusRecords);
      availabilityOutput = buildAvailabilityModels(
        consensusRecords.slice(0, 100).map((r) => ({
          canonicalPlayerId: r.canonicalPlayerId,
          playerName: r.playerName,
          overallAdp: r.overallAdp,
          adpStddev: r.adpStddev,
        }))
      );
      console.log(`[h7-adp] HLV: ${hlvOutput.length} profiles, ${vvmOutput.length} value-vs-market records`);
    }
  }

  // 8. Build and write artifact
  const artifact = {
    generatedAt: now,
    mode: "dry_run",
    note: "Dry run — no rows written to adp_snapshots or adp_player_records.",
    sourceMeta,
    adpFetch: {
      rawRecords: mflResult.raw.length,
      fileHash: mflResult.fileHash,
      sourceUrl: mflResult.sourceUrl,
      sampleSize: mflResult.sampleSize,
      sourceVersion: mflResult.sourceVersion,
      rejectedCount: mflResult.rejectedCount,
      rejectedReasons: mflResult.rejectedReasons,
    },
    identityResolution: {
      ...summary,
      resolvedRate: summary.total > 0 ? Math.round((summary.resolved / summary.total) * 1000) / 10 : 0,
      unresolvedSample: resolved
        .filter((r) => !r.canonicalPlayerId)
        .slice(0, 20)
        .map((r) => ({ rawName: r.rawName, rawPosition: r.rawPosition, rawTeam: r.rawTeam, method: r.identityMatchMethod })),
    },
    consensus: {
      playerCount: consensusRecords.length,
      top20: consensusRecords.slice(0, 20).map((r) => ({
        rank: r.overallRank,
        name: r.playerName,
        pos: r.position,
        team: r.nflTeam,
        adp: r.overallAdp,
        isRookie: r.isRookie,
      })),
    },
    formatMatch: formatMatchResults.map((r) => ({
      leagueId: r.leagueId,
      leagueName: r.leagueName,
      score: r.overallScore,
      compatible: r.isCompatible,
      warnings: r.warnings,
    })),
    hlv: hlvOutput ? {
      computed: true,
      leagueId: args.leagueId,
      recordCount: hlvOutput.length,
      top20: hlvOutput.slice(0, 20).map((h) => ({
        rank: h.hlvRank,
        posRank: h.hlvPositionalRank,
        name: h.playerName,
        pos: h.position,
        hlvScore: h.hlvScore,
        par: h.pointsAboveReplacement,
        confidence: h.historicalScoreConfidence,
      })),
    } : { computed: false, reason: args.leagueId ? "league not found" : "no --league-id provided" },
    valueVsMarket: vvmOutput ? {
      computed: true,
      recordCount: vvmOutput.length,
      strongValue: vvmOutput.filter((v) => v.valueSignal === "strong_value").slice(0, 10).map((v) => ({
        name: v.playerName,
        pos: v.position,
        adp: v.overallAdp,
        hlvRank: v.hlvRank,
        delta: v.rankDelta,
      })),
      clearOverdraft: vvmOutput.filter((v) => v.valueSignal === "clear_overdraft").slice(0, 10).map((v) => ({
        name: v.playerName,
        pos: v.position,
        adp: v.overallAdp,
        hlvRank: v.hlvRank,
        delta: v.rankDelta,
      })),
    } : { computed: false },
    tiers: tiersOutput ? {
      computed: true,
      positionCount: [...new Set(tiersOutput.map((t) => t.position))].length,
      tierCount: tiersOutput.length,
      sample: tiersOutput.filter((t) => ["QB", "RB", "WR", "TE"].includes(t.position) && t.tierNumber <= 2),
    } : { computed: false },
    availability: availabilityOutput ? {
      computed: true,
      sample: availabilityOutput.slice(0, 5).map((a) => ({
        name: a.playerName,
        adp: a.overallAdp,
        stddev: a.effectiveStddev,
        stage: a.draftStageVariance,
        probAt: {
          minus12: a.probAvailableAt[String(Math.round(a.overallAdp - 12))] ?? null,
          adpPick: a.probAvailableAt[String(Math.round(a.overallAdp))] ?? null,
          plus12: a.probAvailableAt[String(Math.round(a.overallAdp + 12))] ?? null,
        },
      })),
    } : { computed: false },
  };

  const artifactDir = path.join(process.cwd(), "artifacts", "adp");
  mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, `h7-adp-dry-run-${args.season}.json`);
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2), "utf8");
  writeFileSync(path.join(artifactDir, `h7-adp-dry-run-${args.season}.md`), buildMarkdown(artifact), "utf8");

  console.log(`\n[h7-adp] Artifact written to: ${jsonPath}`);
  printSummary(artifact, summary);
}

async function computeHlv(
  supabase: SupabaseLike,
  league: DraftDataLeague,
  performanceSeason: number,
  consensusRecords: ConsensusAdpRecord[]
) {
  const weeklyRows = await loadAllPages<DraftDataWeeklyRow>((from, to) =>
    supabase
      .from("player_weekly_stats")
      .select("player_id,season,week,season_type,game_id,team,opponent,position_group,stats_json")
      .eq("season", performanceSeason)
      .eq("season_type", "regular")
      .range(from, to)
  );

  const derivedRows = await loadAllPages<DraftDataDerivedWeeklyRow>((from, to) =>
    supabase
      .from("player_weekly_derived_stats")
      .select("player_id,season,week,season_type,stat_scope,stats_json,completeness")
      .eq("season", performanceSeason)
      .range(from, to)
  );

  const pbpDerivedBatchStatus: PbpDerivedBatchStatus =
    derivedRows.length === 0 ? "not_run"
    : derivedRows.some((r) => r.completeness === "partial") ? "partial"
    : "complete";

  const playerIds = [...new Set(weeklyRows.map((r) => r.player_id))];
  const players = await loadPlayersById(supabase, playerIds);

  const result = aggregateLeagueDraftData({
    league,
    performanceSeason,
    leagueConfigSeason: Number(league.season),
    weeklyRows,
    players,
    derivedRows,
    pbpDerivedBatchStatus,
    generatedAt: new Date().toISOString(),
  });

  const profilePlayerIds = new Set(result.profiles.map((p) => p.playerId));

  // Re-resolve identities with profile membership known
  const playerIdsWithProfile = profilePlayerIds;

  const hlv = buildHistoricalLeagueValues(result.profiles, performanceSeason, league.id);
  const vvm = buildValueVsMarket(consensusRecords, hlv, league.id);

  return { hlv, vvm, playerIdsWithProfile };
}

async function loadCanonicalPlayers(supabase: SupabaseLike): Promise<MatchablePlayer[]> {
  return loadAllPages<MatchablePlayer>((from, to) =>
    supabase
      .from("players")
      .select("id,sleeper_player_id,full_name,normalized_name,position,primary_position,position_group,side_of_ball,team")
      .range(from, to)
  );
}

async function loadMflExternalIds(supabase: SupabaseLike) {
  return loadAllPages<{ external_id: string; player_id: string }>((from, to) =>
    supabase
      .from("player_external_ids")
      .select("external_id,player_id")
      .eq("provider", "mfl")
      .eq("external_type", "player")
      .range(from, to)
  );
}

async function loadLeagues(supabase: SupabaseLike, userId: string): Promise<DraftDataLeague[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id,user_id,platform,platform_league_id,name,season,status,total_teams,is_dynasty,is_best_ball,is_superflex,is_two_qb,te_premium,scoring_settings_json,roster_positions_json,settings_json")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load leagues: ${error.message}`);
  return (data ?? []) as DraftDataLeague[];
}

async function loadPlayersById(supabase: SupabaseLike, ids: string[]): Promise<DraftDataPlayer[]> {
  const players: DraftDataPlayer[] = [];
  const pageSize = 500;
  for (let i = 0; i < ids.length; i += pageSize) {
    const batch = ids.slice(i, i + pageSize);
    const { data, error } = await supabase
      .from("players")
      .select("id,full_name,position,team,primary_position,position_group,raw_position")
      .in("id", batch);
    if (error) throw new Error(`Failed to load players: ${error.message}`);
    players.push(...((data ?? []) as DraftDataPlayer[]));
  }
  return players;
}

async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`DB query failed: ${(error as { message: string }).message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function leagueToFormatInput(league: DraftDataLeague): LeagueFormatInput {
  const scoring = (league.scoring_settings_json ?? {}) as Record<string, number>;
  const pprValue = typeof scoring["rec"] === "number" ? scoring["rec"] : 1.0;
  const teBonus = typeof scoring["bonus_rec_te"] === "number" ? scoring["bonus_rec_te"] : 0;
  const rosterPositions = Array.isArray(league.roster_positions_json)
    ? (league.roster_positions_json as string[])
    : [];
  const isSuperflex =
    rosterPositions.includes("SUPER_FLEX") || league.is_superflex === true || league.is_two_qb === true;

  return {
    leagueId: league.id,
    pprValue,
    tePremiumValue: teBonus,
    teamCount: league.total_teams ?? 12,
    isDynasty: league.is_dynasty === true,
    isBestBall: league.is_best_ball === true,
    isSuperflex,
  };
}

function buildMarkdown(artifact: ReturnType<typeof buildArtifact>): string {
  const lines: string[] = [
    `# H7 ADP Dry-Run — Season ${artifact.sourceMeta.season}`,
    "",
    `Generated: ${artifact.generatedAt}`,
    `**DRY RUN — no rows written.**`,
    "",
    "## ADP Source",
    `- Provider: MFL (myfantasyleague.com)`,
    `- Source URL: ${artifact.sourceMeta.sourceUrl ?? "N/A"}`,
    `- Raw records: ${artifact.adpFetch.rawRecords}`,
    `- File hash: ${artifact.adpFetch.fileHash.slice(0, 16)}...`,
    "",
    "## Identity Resolution",
    `- Resolved: ${artifact.identityResolution.resolved} / ${artifact.identityResolution.total} (${artifact.identityResolution.resolvedRate}%)`,
    `- Ambiguous: ${artifact.identityResolution.ambiguous}`,
    `- Unresolved: ${artifact.identityResolution.unresolved}`,
    `- Rookies: ${artifact.identityResolution.rookie}`,
    "",
    "## Top 20 by Consensus ADP",
    "| Rank | Player | Pos | Team | ADP |",
    "|---:|---|---|---|---:|",
    ...artifact.consensus.top20.map((p: { rank: number; name: string | null; isRookie: boolean; pos: string | null; team: string | null; adp: number }) =>
      `| ${p.rank} | ${p.name ?? String(p.rank)}${p.isRookie ? " *" : ""} | ${p.pos ?? "-"} | ${p.team ?? "-"} | ${p.adp} |`
    ),
    "",
    "\\* = Rookie",
    "",
    "## Format Match",
  ];

  if (artifact.formatMatch.length === 0) {
    lines.push("No leagues loaded (SCORING_VALIDATION_OPERATOR_USER_ID not set).");
  } else {
    lines.push("| League | Score | Compatible | Warnings |");
    lines.push("|---|---:|:---:|---|");
    for (const fm of artifact.formatMatch) {
      lines.push(`| ${fm.leagueName ?? fm.leagueId.slice(0, 8)} | ${fm.score.toFixed(3)} | ${fm.compatible ? "✓" : "✗"} | ${fm.warnings.join("; ") || "-"} |`);
    }
  }

  if (artifact.hlv.computed) {
    lines.push(
      "",
      `## Historical League Value (League ${artifact.hlv.leagueId})`,
      "| HLV Rank | Pos Rank | Player | Pos | HLV Score | PAR | Confidence |",
      "|---:|---:|---|---|---:|---:|---|",
      ...(artifact.hlv as any).top20.map((h: any) =>
        `| ${h.rank} | ${h.posRank} | ${h.name ?? "-"} | ${h.pos ?? "-"} | ${h.hlvScore.toFixed(1)} | ${h.par?.toFixed(1) ?? "-"} | ${h.confidence} |`
      )
    );
  }

  return lines.join("\n");
}

// TypeScript helper to make artifact type accessible in buildMarkdown
function buildArtifact(a: any) { return a as any; }

function printSummary(
  artifact: any,
  resolution: ReturnType<typeof summarizeResolution>
) {
  console.log("\n── H7 ADP Dry-Run Summary ──");
  console.log(`  ADP records fetched : ${artifact.adpFetch.rawRecords}`);
  console.log(`  Resolved identities : ${resolution.resolved} / ${resolution.total} (${artifact.identityResolution.resolvedRate}%)`);
  console.log(`  Ambiguous           : ${resolution.ambiguous}`);
  console.log(`  Unresolved          : ${resolution.unresolved}`);
  console.log(`  Consensus players   : ${artifact.consensus.playerCount}`);
  if (artifact.hlv.computed) {
    console.log(`  HLV profiles        : ${artifact.hlv.recordCount}`);
    console.log(`  Value-vs-Market     : ${artifact.valueVsMarket.recordCount ?? 0}`);
  }
  console.log("────────────────────────────\n");
}

main().catch((err) => {
  console.error("[h7-adp] Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
