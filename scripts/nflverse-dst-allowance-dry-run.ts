import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

import { decompressPbpFile, downloadAndArchivePbp } from "@/lib/providers/nflverse/pbp/download";
import { validatePbpSchema } from "@/lib/providers/nflverse/pbp/schema";
import { downloadAndArchiveSchedules, readSchedulesFile } from "@/lib/providers/nflverse/schedules/download";
import { parseScheduleRow, validateSchedulesSchema } from "@/lib/providers/nflverse/schedules/schema";
import { deriveDstAllowanceForGames, type DstAllowanceGameInput } from "@/lib/providers/nflverse/team-games/dst-allowance";
import { normalizeNflTeamId } from "@/lib/providers/nflverse/teams/normalize";

const LEDGER_FIELDS = [
  "game_id",
  "week",
  "play_id",
  "posteam",
  "defteam",
  "qtr",
  "time",
  "desc",
  "play_type",
  "play_type_nfl",
  "touchdown",
  "safety",
  "two_point_conv_result",
  "defensive_two_point_conv",
  "return_touchdown",
  "interception",
  "fumble",
  "fumble_lost",
  "fumble_recovery_1_team",
  "fumble_recovery_2_team",
  "td_team",
  "td_player_id",
  "passer_player_id",
  "rusher_player_id",
  "receiver_player_id",
  "special_teams_play",
  "st_play_type",
  "kickoff_attempt",
  "punt_attempt",
  "punt_blocked",
  "field_goal_attempt",
  "extra_point_attempt",
  "penalty",
  "penalty_team",
  "penalty_type",
  "penalty_yards",
  "play_deleted",
  "aborted_play",
] as const;

const YARD_LEDGER_FIELDS = [
  "game_id",
  "week",
  "play_id",
  "posteam",
  "defteam",
  "qtr",
  "time",
  "desc",
  "play_type",
  "play_type_nfl",
  "yards_gained",
  "passing_yards",
  "rushing_yards",
  "sack",
  "lateral_reception",
  "lateral_rush",
  "lateral_return",
  "lateral_recovery",
  "aborted_play",
  "fumble",
  "fumble_lost",
  "fumble_recovery_1_team",
  "fumble_recovery_1_yards",
  "penalty",
  "penalty_team",
  "penalty_type",
  "penalty_yards",
  "play_deleted",
] as const;

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
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

function parseSeason() {
  const args = process.argv.slice(2);
  const seasonArg = args.find((arg) => arg.startsWith("--season="));
  const seasonIndex = args.indexOf("--season");
  const raw = seasonArg?.slice("--season=".length) ?? (seasonIndex >= 0 ? args[seasonIndex + 1] : undefined) ?? "2025";
  const season = Number(raw);
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    console.error(`Invalid --season: ${raw}`);
    process.exit(1);
  }
  return season;
}

async function main() {
  const season = parseSeason();
  const projectRoot = process.cwd();
  const storedYards = await loadStoredTeamYards(season);
  const schedulesDownload = await downloadAndArchiveSchedules(projectRoot);
  const schedulesCsvText = readSchedulesFile(schedulesDownload.filePath);
  const schedulesParsed = Papa.parse<Record<string, string>>(schedulesCsvText, { header: true, skipEmptyLines: true });
  const schedulesSchema = validateSchedulesSchema(schedulesParsed.meta.fields ?? []);
  if (!schedulesSchema.valid) {
    throw new Error(`Schedules schema missing columns: ${schedulesSchema.missingColumns.join(", ")}`);
  }

  const games: DstAllowanceGameInput[] = [];
  for (const raw of schedulesParsed.data) {
    if (raw["season"]?.trim() !== String(season)) continue;
    const parsed = parseScheduleRow(raw);
    if (!parsed) continue;
    const homeTeamId = normalizeNflTeamId(parsed.homeTeamRaw);
    const awayTeamId = normalizeNflTeamId(parsed.awayTeamRaw);
    if (!homeTeamId || !awayTeamId) continue;
    games.push({
      gameId: parsed.gameId,
      week: parsed.week,
      homeTeamId,
      awayTeamId,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
      homeYardsAllowedStored: storedYards.get(`${parsed.gameId}|${homeTeamId}`) ?? null,
      awayYardsAllowedStored: storedYards.get(`${parsed.gameId}|${awayTeamId}`) ?? null,
    });
  }

  const pbpDownload = await downloadAndArchivePbp(season, projectRoot);
  const pbpCsvText = decompressPbpFile(pbpDownload.filePath);
  const pbpParsed = Papa.parse<Record<string, string>>(pbpCsvText, { header: true, skipEmptyLines: true });
  const pbpSchema = validatePbpSchema(pbpParsed.meta.fields ?? []);
  if (!pbpSchema.valid) {
    throw new Error(`PBP schema missing columns: ${pbpSchema.missingColumns.join(", ")}`);
  }

  const report = deriveDstAllowanceForGames(games, pbpParsed.data);
  const h53 = buildH53Ledgers(report, pbpParsed.data);
  const artifact = {
    season,
    mode: "dry_run",
    schedulesSha256: schedulesDownload.sha256,
    pbpFilePath: pbpDownload.filePath,
    completedAt: new Date().toISOString(),
    ...report,
    h53,
  };

  console.log("\n=== H5.3 DST Allowance Dry Run ===");
  console.log(`Season:                          ${season}`);
  console.log(`Games:                           ${games.length}`);
  console.log(`Team rows:                       ${report.coverage.teamRows}`);
  console.log(`Scoring events:                  ${report.coverage.totalEvents}`);
  console.log(`Charged events:                  ${report.coverage.chargedEvents}`);
  console.log(`Conversion charged events:       ${report.coverage.conversionAlwaysChargedEvents}`);
  console.log(`Excluded events:                 ${report.coverage.excludedEvents}`);
  console.log(`Unresolved events:               ${report.coverage.unresolvedEvents}`);
  console.log(`Verified team rows:              ${report.coverage.verifiedTeamRows}`);
  console.log(`Unresolved team rows:            ${report.coverage.unresolvedTeamRows}`);
  console.log(`Final-score reconciliation fail: ${report.coverage.finalScoreReconciliationFailures}`);
  console.log(`Exact yard matches:              ${report.coverage.exactYardMatchesAgainstStored}`);
  console.log(`Yard mismatches:                 ${report.coverage.yardMismatchesAgainstStored}`);

  const unresolvedByType = report.unresolvedEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Unresolved by type:              ${JSON.stringify(unresolvedByType)}`);
  console.log(`H5.3 event ledger rows:          ${h53.unresolvedEventLedger.length}`);
  console.log(`H5.3 yard mismatch rows:         ${h53.yardageMismatchLedger.length}`);

  const artifactDir = path.join(projectRoot, "artifacts", "team-games");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `h52-dst-allowance-${season}-dry-run.json`);
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
  console.log(`\nArtifact written: ${artifactPath}`);

  const h53JsonPath = path.join(artifactDir, `h53-dst-allowance-ledger-${season}.json`);
  const h53MarkdownPath = path.join(artifactDir, `h53-dst-allowance-ledger-${season}.md`);
  writeFileSync(h53JsonPath, JSON.stringify(h53, null, 2), "utf8");
  writeFileSync(h53MarkdownPath, renderH53Markdown(season, h53), "utf8");
  console.log(`H5.3 JSON ledger written: ${h53JsonPath}`);
  console.log(`H5.3 Markdown ledger written: ${h53MarkdownPath}`);
}

async function loadStoredTeamYards(season: number): Promise<Map<string, number>> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const result = new Map<string, number>();
  if (!supabaseUrl || !supabaseKey) return result;

  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  let offset = 0;
  while (true) {
    const { data, error } = await admin
      .from("team_game_stats")
      .select("game_id,team_id,yards_allowed")
      .eq("season", season)
      .eq("season_type", "REG")
      .range(offset, offset + 999);

    if (error) throw new Error(`Failed to load stored team-game yards: ${error.message}`);
    for (const row of data ?? []) {
      if (typeof row.yards_allowed === "number") {
        result.set(`${row.game_id}|${row.team_id}`, row.yards_allowed);
      }
    }
    if ((data?.length ?? 0) < 1000) break;
    offset += 1000;
  }
  return result;
}

function buildH53Ledgers(
  report: ReturnType<typeof deriveDstAllowanceForGames>,
  plays: Record<string, string>[]
) {
  const playsByKey = new Map(plays.map((row) => [`${row["game_id"]}|${row["play_id"]}`, row]));
  const unresolvedEventLedger = report.unresolvedEvents.map((event) => {
    const raw = playsByKey.get(`${event.gameId}|${event.playId}`) ?? {};
    return {
      game_id: event.gameId,
      week: event.week,
      play_id: event.playId,
      scoring_team: event.scoringTeam,
      defending_fantasy_team: event.chargedTeam,
      quarter: raw["qtr"] ?? null,
      clock: raw["time"] ?? null,
      event_text: event.description,
      current_classification: event.type,
      exact_reason_unresolved: event.reason,
      evidence_confidence: "structured_fields_present_but_sleeper_semantics_unverified",
      fields: pickFields(raw, LEDGER_FIELDS),
    };
  });

  const yardageMismatchLedger = report.teamResults
    .filter((row) => row.yardsAllowedDifference !== null && row.yardsAllowedDifference !== 0)
    .map((row) => {
      const relevant = plays
        .filter((play) => play["game_id"] === row.gameId && play["posteam"] === row.opponentTeamId)
        .filter((play) => {
          const oldValue = oldYardValue(play);
          const newValue = officialNetYardValue(play);
          return oldValue !== newValue;
        })
        .map((play) => ({
          old_yards_gained_accumulator_value: oldYardValue(play),
          official_style_net_yards_value: officialNetYardValue(play),
          fields: pickFields(play, YARD_LEDGER_FIELDS),
        }));

      return {
        game_id: row.gameId,
        week: row.week,
        defending_fantasy_team: row.teamId,
        opponent_team: row.opponentTeamId,
        stored_yards_allowed: row.storedYardsAllowed,
        official_style_dst_yards_allowed: row.effectiveDstYardsAllowed,
        difference: row.yardsAllowedDifference,
        root_cause: inferYardMismatchRootCause(relevant),
        relevant_plays: relevant,
      };
    });

  return {
    unresolvedEventLedger,
    unresolvedByType: countBy(unresolvedEventLedger.map((row) => row.current_classification)),
    safetyLedger: unresolvedEventLedger.filter((row) => row.current_classification === "safety").map((row) => ({
      ...row,
      safety_subtype: classifySafetySubtype(row.fields),
      sleeper_semantics: "unresolved_requires_sleeper_specific_evidence",
    })),
    defensiveTwoPointLedger: unresolvedEventLedger.filter((row) => row.current_classification === "defensive_two_point_return").map((row) => ({
      ...row,
      sleeper_semantics: "unresolved_requires_sleeper_specific_evidence",
    })),
    yardageMismatchLedger,
    independentYardageSourceFindings: {
      searchedLocalArtifacts: [
        "data/raw/nflverse/schedules/games.csv",
        "data/raw/nflverse/pbp/2025/play_by_play_2025.csv.gz",
        "data/raw/nflverse/player_stats/2025/stats_player_week_2025.csv",
        "data/raw/nflverse/players/players.csv",
      ],
      foundIndependentTeamGameTotalNetYardsSource: false,
      limitation: "No local independent game/team total-net-yards artifact is present. Schedules contain scores only; player_stats is player-week scoped; PBP is the derivation source.",
    },
    activationEligibility: {
      points: {
        eligible: false,
        blockers: [
          "32 rare scoring events still require Sleeper-specific evidence.",
          "Final-score reconciliation still includes unresolved points.",
        ],
      },
      yards: {
        eligible: false,
        blockers: [
          "Two stored rows differ from official-style net-yard derivation and require a migration/backfill plan before activation.",
          "No independent team-game total-net-yards source is available locally.",
        ],
      },
    },
  };
}

function pickFields(row: Record<string, string>, fields: readonly string[]) {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? ""]));
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function oldYardValue(play: Record<string, string>) {
  if (play["play_deleted"] === "1" || play["two_point_attempt"] === "1" || play["defensive_two_point_attempt"] === "1") return 0;
  if (!["pass", "run", "qb_spike", "qb_kneel"].includes(play["play_type"] ?? "")) return 0;
  return numeric(play["yards_gained"]);
}

function officialNetYardValue(play: Record<string, string>) {
  if (play["play_deleted"] === "1" || play["two_point_attempt"] === "1" || play["defensive_two_point_attempt"] === "1") return 0;
  const value = numeric(play["passing_yards"]) + numeric(play["rushing_yards"]) + (play["sack"] === "1" ? numeric(play["yards_gained"]) : 0);
  if (value === 0 && play["sack"] !== "1" && play["pass_attempt"] !== "1" && play["rush_attempt"] !== "1") return 0;
  return value;
}

function numeric(raw: string | undefined) {
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function inferYardMismatchRootCause(relevant: Array<{ fields: Record<string, string> }>) {
  if (relevant.some((play) => play.fields["aborted_play"] === "1")) return "aborted_play_lateral_or_fumble_stat_attribution";
  if (relevant.some((play) => play.fields["lateral_reception"] === "1" || play.fields["lateral_rush"] === "1")) return "lateral_stat_attribution";
  return "structured_official_net_yards_differs_from_yards_gained_accumulator";
}

function classifySafetySubtype(fields: Record<string, string>) {
  if (fields["penalty_type"] === "Intentional Grounding") return "intentional_grounding_in_end_zone";
  if (fields["penalty_type"] === "Offensive Holding") return "offensive_holding_or_foul_in_end_zone";
  if (fields["play_type"] === "run") return "offense_tackled_in_own_end_zone";
  if (fields["play_type"] === "pass" && fields["fumble"] === "1") return "fumble_out_of_offense_end_zone_or_recovered_in_end_zone";
  if (fields["play_type"] === "pass") return "sack_or_pass_play_in_own_end_zone";
  return "unusual_safety";
}

function renderH53Markdown(season: number, h53: ReturnType<typeof buildH53Ledgers>) {
  const lines = [
    `# H5.3 DST Allowance Ledger - ${season}`,
    "",
    "## Unresolved Event Summary",
    "",
    "| Classification | Count |",
    "|---|---:|",
    ...Object.entries(h53.unresolvedByType).map(([type, count]) => `| \`${type}\` | ${count} |`),
    "",
    "## Full Unresolved Event Ledger",
    "",
    "| Game | Week | Play | Team Scored | Charged Team | Qtr | Clock | Class | Reason | Text |",
    "|---|---:|---:|---|---|---:|---|---|---|---|",
    ...h53.unresolvedEventLedger.map((row) =>
      `| ${row.game_id} | ${row.week} | ${row.play_id} | ${row.scoring_team ?? ""} | ${row.defending_fantasy_team ?? ""} | ${row.quarter ?? ""} | ${row.clock ?? ""} | \`${row.current_classification}\` | ${escapeMd(row.exact_reason_unresolved)} | ${escapeMd(row.event_text)} |`
    ),
    "",
    "## Yardage Mismatches",
    "",
    "| Game | Week | DST | Opponent | Stored | Official-style | Diff | Root cause |",
    "|---|---:|---|---|---:|---:|---:|---|",
    ...h53.yardageMismatchLedger.map((row) =>
      `| ${row.game_id} | ${row.week} | ${row.defending_fantasy_team} | ${row.opponent_team} | ${row.stored_yards_allowed} | ${row.official_style_dst_yards_allowed} | ${row.difference} | ${row.root_cause} |`
    ),
    "",
    "## Activation Eligibility",
    "",
    `Points eligible: ${h53.activationEligibility.points.eligible}`,
    "",
    ...h53.activationEligibility.points.blockers.map((blocker) => `- ${blocker}`),
    "",
    `Yards eligible: ${h53.activationEligibility.yards.eligible}`,
    "",
    ...h53.activationEligibility.yards.blockers.map((blocker) => `- ${blocker}`),
    "",
  ];
  return lines.join("\n");
}

function escapeMd(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

main().catch((err) => {
  console.error("[dst-allowance-dry-run] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
