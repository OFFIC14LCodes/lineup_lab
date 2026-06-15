// H9.7 — IDP / DST / K data audit and projection design.
//
// Audit/design only: no projections, no migrations, no War Room ordering changes.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import {
  DST_SCORING_KEYS,
  IDP_SCORING_KEYS,
  KICKER_SCORING_KEYS,
  RETURN_SCORING_KEYS,
  auditLeagueRoster,
  classifyScoringKeyProjectability,
  relevantScoringKeys,
  scoringKeyCategory,
  type DataPresence,
  type ProjectionCategory,
} from "@/lib/projections/idp-dst-k-audit";
import { REGISTRY_BY_KEY } from "@/lib/scoring/coverage/registry";

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

function argValue(name: string, def: string | null = null): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}

function supabase(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and service or anon key are required.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type LeagueRow = {
  id: string;
  name: string | null;
  season: number | string | null;
  roster_positions_json: unknown;
  scoring_settings_json: Record<string, unknown> | null;
};

type WeeklyRow = {
  player_id: string;
  season_type: string;
  position_group: string | null;
  team: string | null;
  stats_json: Record<string, unknown>;
};

type DerivedRow = {
  season_type: string;
  stat_scope: string;
  stats_json: Record<string, unknown>;
  completeness: string;
};

type TeamGameRow = {
  season_type: string;
  team_id: string;
  points_scored: number | null;
  points_allowed: number | null;
  offensive_yards: number | null;
  yards_allowed: number | null;
  reconciliation_status: string;
};

type PlayerRow = {
  id: string;
  position: string | null;
  primary_position: string | null;
  position_group: string | null;
  side_of_ball: string | null;
  active: boolean | null;
};

type AdpSnapshotRow = {
  id: string;
  provider: string;
  season: number;
  source_meta_json: Record<string, unknown> | null;
  source_confidence: string;
  is_dynasty: boolean;
  is_best_ball: boolean;
  is_superflex: boolean;
  scoring_format: string;
};

type AdpRecordRow = {
  snapshot_id: string;
  canonical_player_id: string | null;
  raw_name: string;
  raw_position: string | null;
  identity_match_method: string | null;
};

const RETURN_DATA_FIELDS = new Set([
  "kick_ret_yd",
  "kickoff_return_yards",
  "kick_return_yards",
  "punt_ret_yd",
  "punt_return_yards",
  "return_td",
  "return_tds",
  "return_fd",
  "special_teams_tds",
]);

async function loadLeagues(client: SupabaseClient<any>, season: number): Promise<LeagueRow[]> {
  return loadAllPagesWith<LeagueRow>(
    (from, to) => client
      .from("leagues")
      .select("id,name,season,roster_positions_json,scoring_settings_json")
      .eq("season", season)
      .order("id", { ascending: true })
      .range(from, to),
    { table: "leagues" }
  );
}

async function loadWeeklyRows(client: SupabaseClient<any>, season: number): Promise<WeeklyRow[]> {
  return loadAllPagesWith<WeeklyRow>(
    (from, to) => client
      .from("player_weekly_stats")
      .select("player_id,season_type,position_group,team,stats_json")
      .eq("season", season)
      .order("player_id", { ascending: true })
      .range(from, to),
    { table: "player_weekly_stats" }
  );
}

async function loadDerivedRows(client: SupabaseClient<any>, season: number): Promise<DerivedRow[]> {
  return loadAllPagesWith<DerivedRow>(
    (from, to) => client
      .from("player_weekly_derived_stats")
      .select("season_type,stat_scope,stats_json,completeness")
      .eq("season", season)
      .order("stat_scope", { ascending: true })
      .range(from, to),
    { table: "player_weekly_derived_stats" }
  );
}

async function loadTeamRows(client: SupabaseClient<any>, season: number): Promise<TeamGameRow[]> {
  return loadAllPagesWith<TeamGameRow>(
    (from, to) => client
      .from("team_game_stats")
      .select("season_type,team_id,points_scored,points_allowed,offensive_yards,yards_allowed,reconciliation_status")
      .eq("season", season)
      .order("team_id", { ascending: true })
      .range(from, to),
    { table: "team_game_stats" }
  );
}

async function loadPlayers(client: SupabaseClient<any>): Promise<PlayerRow[]> {
  return loadAllPagesWith<PlayerRow>(
    (from, to) => client
      .from("players")
      .select("id,position,primary_position,position_group,side_of_ball,active")
      .order("id", { ascending: true })
      .range(from, to),
    { table: "players" }
  );
}

async function loadAdp(client: SupabaseClient<any>, season: number) {
  const snapshots = await loadAllPagesWith<AdpSnapshotRow>(
    (from, to) => client
      .from("adp_snapshots")
      .select("id,provider,season,source_meta_json,source_confidence,is_dynasty,is_best_ball,is_superflex,scoring_format")
      .eq("season", season)
      .order("provider", { ascending: true })
      .range(from, to),
    { table: "adp_snapshots" }
  );
  const records = snapshots.length === 0 ? [] : await loadAllPagesWith<AdpRecordRow>(
    (from, to) => client
      .from("adp_player_records")
      .select("snapshot_id,canonical_player_id,raw_name,raw_position,identity_match_method")
      .in("snapshot_id", snapshots.map((snapshot) => snapshot.id))
      .order("snapshot_id", { ascending: true })
      .range(from, to),
    { table: "adp_player_records" }
  );
  return { snapshots, records };
}

function rosterPositions(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function statKeys(rows: Array<{ stats_json: Record<string, unknown> }>): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row.stats_json ?? {})))].sort();
}

function nonZeroStatKeys(rows: Array<{ stats_json: Record<string, unknown> }>): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.stats_json ?? {})) {
      if (typeof value === "number" && value !== 0) keys.add(key);
    }
  }
  return [...keys].sort();
}

function buildDataPresence(weeklyRows: WeeklyRow[], teamRows: TeamGameRow[]): DataPresence {
  const keys = new Set(statKeys(weeklyRows));
  const teamKeys = new Set(["points_scored", "points_allowed", "offensive_yards", "yards_allowed"]);
  return {
    hasIdpWeeklyRows: weeklyRows.some((row) => ["DL", "DE", "DT", "LB", "DB", "CB", "S"].includes((row.position_group ?? "").toUpperCase())),
    hasDstWeeklyRows: weeklyRows.some((row) => ["DEF", "DST", "D/ST"].includes((row.position_group ?? "").toUpperCase())),
    hasKickerWeeklyRows: weeklyRows.some((row) => (row.position_group ?? "").toUpperCase() === "K"),
    hasTeamGameRows: teamRows.length > 0,
    hasField: (field) => keys.has(field),
    hasTeamField: (field) => teamKeys.has(field),
  };
}

function auditScoringKeys(leagues: LeagueRow[], dataPresence: DataPresence) {
  const usage = new Map<string, Set<string>>();
  for (const league of leagues) {
    for (const key of relevantScoringKeys(league.scoring_settings_json ?? {})) {
      if (!usage.has(key)) usage.set(key, new Set());
      usage.get(key)!.add(league.id);
    }
  }
  return [...usage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, leagueIds]) => {
      const category = scoringKeyCategory(key) ?? "dst";
      return {
        scoringKey: key,
        category,
        leagueCount: leagueIds.size,
        leagueIds: [...leagueIds].sort(),
        exactRegistryKey: REGISTRY_BY_KEY.has(key),
        classification: classifyScoringKeyProjectability(key, category as ProjectionCategory, dataPresence),
        registry: REGISTRY_BY_KEY.get(key) ?? null,
      };
    });
}

function fieldAvailability(rows: WeeklyRow[], positionGroups: string[]) {
  const filtered = rows.filter((row) => positionGroups.includes((row.position_group ?? "").toUpperCase()));
  return {
    rowCount: filtered.length,
    distinctPlayers: new Set(filtered.map((row) => row.player_id)).size,
    positionsPresent: countBy(filtered.map((row) => (row.position_group ?? "UNKNOWN").toUpperCase())),
    seasonTypeValues: countBy(filtered.map((row) => row.season_type)),
    teamsPresent: [...new Set(filtered.map((row) => row.team).filter(Boolean) as string[])].sort(),
    statFieldsPresent: statKeys(filtered),
    nonZeroStatFields: nonZeroStatKeys(filtered),
  };
}

function returnFieldAvailability(rows: WeeklyRow[]) {
  const availability = fieldAvailability(rows, ["QB", "RB", "WR", "TE", "K", "DL", "DE", "DT", "LB", "DB", "CB", "S"]);
  return {
    ...availability,
    statFieldsPresent: availability.statFieldsPresent.filter((key) => RETURN_DATA_FIELDS.has(key)),
    nonZeroStatFields: availability.nonZeroStatFields.filter((key) => RETURN_DATA_FIELDS.has(key)),
  };
}

function summarizeAdp(adp: Awaited<ReturnType<typeof loadAdp>>, players: PlayerRow[]) {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const positionCounts = countBy(adp.records.map((record) => {
    if (!record.canonical_player_id) return record.raw_position ?? "UNRESOLVED";
    const player = playerById.get(record.canonical_player_id);
    return player?.primary_position ?? player?.position ?? record.raw_position ?? "UNKNOWN";
  }));
  const relevantPositions = new Set(["K", "DEF", "DST", "D/ST", "DL", "DE", "DT", "LB", "DB", "CB", "S"]);
  const relevant = adp.records.filter((record) => {
    const pos = record.canonical_player_id
      ? (playerById.get(record.canonical_player_id)?.primary_position ?? playerById.get(record.canonical_player_id)?.position ?? record.raw_position ?? "")
      : (record.raw_position ?? "");
    return relevantPositions.has(pos.toUpperCase());
  });
  return {
    snapshotCount: adp.snapshots.length,
    recordCount: adp.records.length,
    providerCoverage: countBy(adp.snapshots.map((snapshot) => snapshot.provider)),
    formatGroups: adp.snapshots.map((snapshot) => ({
      snapshotId: snapshot.id,
      provider: snapshot.provider,
      scoringFormat: snapshot.scoring_format,
      isDynasty: snapshot.is_dynasty,
      isBestBall: snapshot.is_best_ball,
      isSuperflex: snapshot.is_superflex,
      sourceConfidence: snapshot.source_confidence,
    })),
    positionsIncluded: positionCounts,
    relevantRecordCount: relevant.length,
    relevantPositionsIncluded: countBy(relevant.map((record) => record.raw_position ?? "UNKNOWN")),
    resolutionRate: adp.records.length === 0 ? 0 : Number((adp.records.filter((record) => record.canonical_player_id).length / adp.records.length).toFixed(4)),
    unresolvedRelevantNames: relevant
      .filter((record) => !record.canonical_player_id)
      .map((record) => ({ rawName: record.raw_name, rawPosition: record.raw_position }))
      .slice(0, 50),
  };
}

function risk(category: ProjectionCategory, rosterCount: number, available: boolean) {
  if (rosterCount === 0) {
    return {
      overall: "LOW",
      dataRisk: "Low for War Room because no owned league roster demand was detected.",
      modelRisk: "Defer model work unless future leagues require it.",
      scoringRisk: "No immediate league-scoring impact.",
      marketRisk: "No market requirement before War Room MVP.",
      warRoomImportance: "defer",
    };
  }
  if (available) {
    return {
      overall: category === "dst" ? "MEDIUM" : "MEDIUM",
      dataRisk: "Data exists, but projection quality still depends on role stability and source completeness.",
      modelRisk: "Use conservative baseline with explicit low-confidence flags for volatile events.",
      scoringRisk: category === "dst" ? "Allowance tiers and team context require careful weekly semantics." : "Straight counting stats are scoreable when fields exist.",
      marketRisk: "Current ADP may not cover this category sufficiently.",
      warRoomImportance: "important if rostered",
    };
  }
  return {
    overall: "HIGH",
    dataRisk: "Required weekly component data is missing from the active pipeline.",
    modelRisk: "Projection would be speculative before ingestion.",
    scoringRisk: "Engine rules may exist, but missing inputs prevent responsible scoring.",
    marketRisk: "Market comparison likely sparse or unavailable.",
    warRoomImportance: rosterCount > 0 || category === "return" ? "ingest-before-model" : "defer",
  };
}

function buildMarkdown(artifact: any): string {
  const lines = [
    `# H9.7 IDP / DST / K Audit and Design - ${artifact.projectionSeason}`,
    "",
    "## Roster Requirement Summary",
    "",
    "| League | IDP | DST | K | Return Scoring | IDP Slots | DST Slots | K Slots | War Room Required |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...artifact.rosterAudit.leagues.map((league: any) =>
      `| ${league.league_name} | ${league.uses_idp ? "yes" : "no"} | ${league.uses_dst ? "yes" : "no"} | ${league.uses_kicker ? "yes" : "no"} | ${league.uses_return_scoring ? "yes" : "no"} | ${league.idp_slots} | ${league.dst_slots} | ${league.k_slots} | ${league.war_room_required ? "yes" : "no"} |`
    ),
    "",
    "## Scoring Key Summary",
    "",
    JSON.stringify(artifact.scoringKeyAudit.summaryByClassification, null, 2),
    "",
    "## Data Availability",
    "",
    `- IDP weekly rows: ${artifact.dataAvailability.idp.rowCount}`,
    `- K weekly rows: ${artifact.dataAvailability.kicker.rowCount}`,
    `- DEF weekly rows: ${artifact.dataAvailability.dstWeekly.rowCount}`,
    `- Team-game rows: ${artifact.dataAvailability.teamGame.rowCount}`,
    `- Return non-zero fields: ${artifact.dataAvailability.return.nonZeroStatFields.join(", ") || "none"}`,
    "",
    "## ADP Availability",
    "",
    `- Snapshots: ${artifact.adpAvailability.snapshotCount}`,
    `- Records: ${artifact.adpAvailability.recordCount}`,
    `- Relevant IDP/DST/K records: ${artifact.adpAvailability.relevantRecordCount}`,
    `- Resolution rate: ${artifact.adpAvailability.resolutionRate}`,
    "",
    "## Recommended Sequence",
    "",
    ...artifact.recommendedSequence.map((step: string, index: number) => `${index + 1}. ${step}`),
    "",
    "## Final Recommendation",
    "",
    artifact.finalRecommendation,
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const projectionSeason = Number(argValue("--projection-season", "2026"));
  const historicalSeason = Number(argValue("--historical-season", "2025"));
  const client = supabase();

  const [leagues, weeklyRows, derivedRows, teamRows, players, adp] = await Promise.all([
    loadLeagues(client, projectionSeason),
    loadWeeklyRows(client, historicalSeason),
    loadDerivedRows(client, historicalSeason),
    loadTeamRows(client, historicalSeason),
    loadPlayers(client),
    loadAdp(client, projectionSeason),
  ]);

  const rosterAudit = leagues.map((league) => auditLeagueRoster({
    leagueId: league.id,
    leagueName: league.name ?? league.id,
    season: Number(league.season ?? projectionSeason),
    rosterPositions: rosterPositions(league.roster_positions_json),
    scoringSettings: league.scoring_settings_json ?? {},
  }));
  const dataPresence = buildDataPresence(weeklyRows, teamRows);
  const scoringKeyAudit = auditScoringKeys(leagues, dataPresence);
  const rosterSummary = {
    leagueCount: rosterAudit.length,
    idpLeagueCount: rosterAudit.filter((league) => league.uses_idp).length,
    dstLeagueCount: rosterAudit.filter((league) => league.uses_dst).length,
    kickerLeagueCount: rosterAudit.filter((league) => league.uses_kicker).length,
    returnScoringLeagueCount: rosterAudit.filter((league) => league.uses_return_scoring).length,
    warRoomRequiredLeagueCount: rosterAudit.filter((league) => league.war_room_required).length,
  };

  const dataAvailability = {
    idp: fieldAvailability(weeklyRows, ["DL", "DE", "DT", "LB", "DB", "CB", "S"]),
    kicker: fieldAvailability(weeklyRows, ["K"]),
    dstWeekly: fieldAvailability(weeklyRows, ["DEF", "DST", "D/ST"]),
    return: returnFieldAvailability(weeklyRows),
    derived: {
      rowCount: derivedRows.length,
      statScopes: countBy(derivedRows.map((row) => row.stat_scope)),
      completeness: countBy(derivedRows.map((row) => row.completeness)),
      statFieldsPresent: statKeys(derivedRows),
    },
    teamGame: {
      rowCount: teamRows.length,
      distinctTeams: new Set(teamRows.map((row) => row.team_id)).size,
      seasonTypeValues: countBy(teamRows.map((row) => row.season_type)),
      reconciliationStatus: countBy(teamRows.map((row) => row.reconciliation_status)),
      fieldsPresent: ["points_scored", "points_allowed", "offensive_yards", "yards_allowed"],
      nonNullCounts: {
        pointsScored: teamRows.filter((row) => row.points_scored !== null).length,
        pointsAllowed: teamRows.filter((row) => row.points_allowed !== null).length,
        offensiveYards: teamRows.filter((row) => row.offensive_yards !== null).length,
        yardsAllowed: teamRows.filter((row) => row.yards_allowed !== null).length,
      },
    },
    players: {
      rowCount: players.length,
      activeByPosition: countBy(players.filter((player) => player.active).map((player) => player.primary_position ?? player.position ?? "UNKNOWN")),
      sideOfBall: countBy(players.map((player) => player.side_of_ball ?? "UNKNOWN")),
    },
  };

  const categoryRisk = {
    idp: risk("idp", rosterSummary.idpLeagueCount, dataPresence.hasIdpWeeklyRows),
    dst: risk("dst", rosterSummary.dstLeagueCount, dataPresence.hasTeamGameRows || dataPresence.hasDstWeeklyRows),
    kicker: risk("kicker", rosterSummary.kickerLeagueCount, dataPresence.hasKickerWeeklyRows),
    return: risk("return", rosterSummary.returnScoringLeagueCount, dataAvailability.return.nonZeroStatFields.some((key) => key.includes("return") || key.includes("ret_"))),
  };

  const artifact = {
    auditId: `h9.7-idp-dst-k-${new Date().toISOString()}`,
    historicalSeason,
    projectionSeason,
    rosterAudit: {
      summary: rosterSummary,
      leagues: rosterAudit,
    },
    scoringKeyAudit: {
      usedRelevantKeys: scoringKeyAudit,
      summaryByClassification: countBy(scoringKeyAudit.map((row) => row.classification)),
      watchedKeys: {
        idp: IDP_SCORING_KEYS,
        dst: DST_SCORING_KEYS,
        kicker: KICKER_SCORING_KEYS,
        return: RETURN_SCORING_KEYS,
      },
    },
    dataAvailability,
    adpAvailability: summarizeAdp(adp, players),
    categoryRisk,
    projectabilityByCategory: {
      idp: dataPresence.hasIdpWeeklyRows ? "ingestion-present-but-needs-model" : "ingestion-required-before-projection",
      dst: dataPresence.hasTeamGameRows ? "team-allowance-baseline-feasible-low-confidence" : "team-game-ingestion-required",
      kicker: dataPresence.hasKickerWeeklyRows ? "kicker-baseline-feasible" : "kicker-ingestion-required",
      return: "separate-return-role-model-required-before-war-room-impact",
    },
    recommendedSequence: [
      "H9.8 prioritize DST/K only if owned roster demand exists; otherwise keep rankings-only safeguards.",
      "H9.9 build missing ingestion for whichever of IDP, DST, or K is roster-required by owned leagues.",
      "H9.10 implement category-specific role foundations and component projections with low-confidence flags.",
      "H9.11 extend market comparison only after ADP/CSV sources include those categories.",
      "H9.12 projection inspection/UI for all categories.",
      "H10 league value and War Room MVP after non-offensive projection gaps are explicitly handled or deferred.",
    ],
    finalRecommendation: "Do not implement IDP/DST/K projections until the roster-demand audit is reviewed. Prioritize categories actually rostered by owned leagues; use rankings-only safeguards for unrostered or data-missing categories.",
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `h9-idp-dst-k-audit-${projectionSeason}.json`);
  const mdPath = path.join(outDir, `h9-idp-dst-k-design-${projectionSeason}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(mdPath, buildMarkdown(artifact));

  console.log(JSON.stringify({
    jsonArtifact: jsonPath,
    markdownArtifact: mdPath,
    rosterSummary,
    scoringKeyClassificationSummary: artifact.scoringKeyAudit.summaryByClassification,
    dataAvailability: {
      idpRows: dataAvailability.idp.rowCount,
      kickerRows: dataAvailability.kicker.rowCount,
      dstWeeklyRows: dataAvailability.dstWeekly.rowCount,
      teamGameRows: dataAvailability.teamGame.rowCount,
      adpRelevantRecords: artifact.adpAvailability.relevantRecordCount,
    },
    categoryRisk,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
