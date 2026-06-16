import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import { writeDiagnostic } from "./h9-projection-hardening-utils";

type PlayerRow = {
  id: string;
  full_name: string | null;
  position: string | null;
  primary_position: string | null;
  position_group: string | null;
  team: string | null;
  age: number | string | null;
  years_exp: number | string | null;
  active?: boolean | null;
  metadata_json?: Record<string, unknown> | null;
};

type RookieCsvRow = Record<string, string | number | null>;

const PROJECTION_SEASON = numberArg("--projection-season", 2026);
const OUTPUT_PATH = path.join(process.cwd(), "data", "rookies", "rookie-data.csv");
const DRAFTABLE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const COLUMNS = [
  "playerId",
  "playerName",
  "position",
  "team",
  "season",
  "rookieYear",
  "age",
  "yearsExperience",
  "nflDraftRound",
  "nflDraftPick",
  "nflDraftOverall",
  "nflDraftTeam",
  "college",
  "collegeConference",
  "collegeGames",
  "collegePassingAttempts",
  "collegeCompletions",
  "collegePassingYards",
  "collegePassingTouchdowns",
  "collegeInterceptions",
  "collegeRushingAttempts",
  "collegeRushingYards",
  "collegeRushingTouchdowns",
  "collegeTargets",
  "collegeReceptions",
  "collegeReceivingYards",
  "collegeReceivingTouchdowns",
  "collegeSoloTackles",
  "collegeAssistedTackles",
  "collegeTotalTackles",
  "collegeTacklesForLoss",
  "collegeSacks",
  "collegeInterceptionsDef",
  "collegePassesDefended",
  "collegeForcedFumbles",
  "collegeFumbleRecoveries",
  "landingSpotRole",
  "opportunityNotes",
  "source",
  "sourceLabel",
  "dataGaps",
];

loadLocalEnv();

main().catch((error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
});

async function main() {
  const client = supabase();
  const players = await loadPlayers(client);
  const rookiePlayers = players.filter(isCurrentRookie);
  const rows = rookiePlayers.map(toCsvRow).sort((a, b) => String(a.position).localeCompare(String(b.position)) || String(a.playerName).localeCompare(String(b.playerName)));
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, renderCsv(rows));

  const artifact = {
    generatedAt: new Date().toISOString(),
    verdict: rows.length > 0 ? "passed" : "failed",
    outputPath: OUTPUT_PATH,
    projectionSeason: PROJECTION_SEASON,
    totalCandidatePlayers: players.length,
    rookieRowsWritten: rows.length,
    rowsWithDraftCapital: rows.filter((row) => row.nflDraftRound || row.nflDraftPick || row.nflDraftOverall).length,
    rowsWithCollege: rows.filter((row) => row.college).length,
    rowsWithCollegeProduction: rows.filter(hasCollegeProduction).length,
    rowsWithLandingSpotRole: rows.filter((row) => row.landingSpotRole).length,
    dataSource: "players table metadata_json and canonical player fields only",
    safety: {
      noScraping: true,
      noPaidApi: true,
      noAdpFallback: true,
      noFabricatedStats: true,
      missingValuesRemainBlank: true,
    },
    samples: rows.slice(0, 20),
  };
  writeDiagnostic("h9-rookie-data-file-build", artifact);
  console.log(JSON.stringify({ verdict: artifact.verdict, outputPath: artifact.outputPath, rookieRowsWritten: artifact.rookieRowsWritten, rowsWithDraftCapital: artifact.rowsWithDraftCapital, rowsWithCollege: artifact.rowsWithCollege }, null, 2));
  if (artifact.verdict === "failed") process.exitCode = 1;
}

async function loadPlayers(client: SupabaseClient<any>): Promise<PlayerRow[]> {
  const rows = await loadAllPagesWith<PlayerRow>(
    (from, to) => client
      .from("players")
      .select("id,full_name,position,primary_position,position_group,team,age,years_exp,active,metadata_json")
      .range(from, to),
    { table: "players" }
  );
  return rows
    .filter((player) => player.full_name)
    .filter((player) => player.active !== false)
    .filter((player) => DRAFTABLE_POSITIONS.includes(playerPosition(player)));
}

function isCurrentRookie(player: PlayerRow): boolean {
  const metadata = player.metadata_json ?? {};
  const yearsExperience = numberOrNull(player.years_exp);
  const rookieYear = numberOrNull(metadata.rookie_year) ?? numberOrNull(metadata.rookieSeason) ?? numberOrNull(metadata.rookie_season);
  const draftYear = numberOrNull(metadata.draft_year) ?? numberOrNull(metadata.draftYear);
  return yearsExperience === 0 || rookieYear === PROJECTION_SEASON || draftYear === PROJECTION_SEASON;
}

function toCsvRow(player: PlayerRow): RookieCsvRow {
  const metadata = player.metadata_json ?? {};
  const draftRound = firstNumber(metadata, ["draft_round", "draftRound"]);
  const draftPick = firstNumber(metadata, ["draft_pick", "draftPick"]);
  const draftOverall = firstNumber(metadata, ["draft_overall", "draft_number", "draftOverall", "draftNumber"]) ?? draftPick;
  const draftTeam = normalizeTeam(firstString(metadata, ["draft_team", "draftTeam"]) ?? player.team);
  const college = firstString(metadata, ["college", "college_name", "collegeName", "school"]);
  const collegeConference = firstString(metadata, ["college_conference", "collegeConference", "conference"]);
  const position = playerPosition(player);
  const dataGaps = [
    draftRound || draftPick || draftOverall ? null : "NFL draft capital",
    college ? null : "college",
    "college production",
    "landing spot role",
  ].filter((gap): gap is string => Boolean(gap)).join("|");
  return {
    playerId: player.id,
    playerName: player.full_name ?? "",
    position,
    team: normalizeTeam(player.team),
    season: PROJECTION_SEASON,
    rookieYear: PROJECTION_SEASON,
    age: numberOrNull(player.age),
    yearsExperience: numberOrNull(player.years_exp),
    nflDraftRound: draftRound,
    nflDraftPick: draftPick,
    nflDraftOverall: draftOverall,
    nflDraftTeam: draftTeam,
    college,
    collegeConference,
    collegeGames: null,
    collegePassingAttempts: null,
    collegeCompletions: null,
    collegePassingYards: null,
    collegePassingTouchdowns: null,
    collegeInterceptions: null,
    collegeRushingAttempts: null,
    collegeRushingYards: null,
    collegeRushingTouchdowns: null,
    collegeTargets: null,
    collegeReceptions: null,
    collegeReceivingYards: null,
    collegeReceivingTouchdowns: null,
    collegeSoloTackles: null,
    collegeAssistedTackles: null,
    collegeTotalTackles: null,
    collegeTacklesForLoss: null,
    collegeSacks: null,
    collegeInterceptionsDef: null,
    collegePassesDefended: null,
    collegeForcedFumbles: null,
    collegeFumbleRecoveries: null,
    landingSpotRole: null,
    opportunityNotes: null,
    source: "derived",
    sourceLabel: "players.metadata_json",
    dataGaps,
  };
}

function hasCollegeProduction(row: RookieCsvRow): boolean {
  return COLUMNS.some((column) => column.startsWith("college") && !["college", "collegeConference", "collegeGames"].includes(column) && row[column]);
}

function renderCsv(rows: RookieCsvRow[]): string {
  return `${COLUMNS.join(",")}\n${rows.map((row) => COLUMNS.map((column) => csv(row[column])).join(",")).join("\n")}\n`;
}

function csv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function playerPosition(player: PlayerRow): string {
  return normalizePrimaryPosition(player.primary_position ?? player.position ?? player.position_group) ?? "UNK";
}

function firstString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = numberOrNull(metadata[key]);
    if (value !== null) return value;
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  return createClient(url, key);
}

function numberArg(name: string, fallback: number): number {
  const eq = process.argv.find((item) => item.startsWith(`${name}=`));
  if (!eq) return fallback;
  const value = Number(eq.slice(name.length + 1));
  return Number.isFinite(value) ? value : fallback;
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sep = trimmed.indexOf("=");
      if (sep === -1) continue;
      const key = trimmed.slice(0, sep).trim();
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(sep + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Existing diagnostics will report missing env if this file is unavailable.
  }
}
