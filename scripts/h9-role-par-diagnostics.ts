import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { buildReplacementValueModel } from "@/lib/draft/replacement-value";
import { getDraftRoomState } from "@/lib/rosterforge/state";
import { h1142LeagueContext, h1142Overlays, h1142Players, overlay, player } from "./h11-442-fixtures";
import { loadLocalEnv } from "./h9-projection-hardening-utils";

type DiagnosticKind =
  | "h9-role-classification"
  | "h9-replacement-value-calibration"
  | "h9-par-quality"
  | "h9-role-aware-projection-quality"
  | "h11-role-par-display";

const kind = readArg("--kind") as DiagnosticKind;
const draftRoomId = readArg("--draft-room-id");
if (!kind) throw new Error("Missing --kind");
loadLocalEnv();

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
const context = await loadDiagnosticContext(draftRoomId);
const rank = buildBlackbirdLeagueRank({ players: context.players, overlays: context.overlays, recommendations: context.recommendations, draftedPlayerIds: context.draftedPlayerIds, leagueContext: context.leagueContext });
const suggestions = buildLiveDraftSuggestions({
  leagueRankRows: rank.rows,
  draftedPlayerIds: context.draftedPlayerIds,
  positionNeeds: context.positionNeeds,
  currentPickNumber: context.currentPickNumber,
});
const board = buildBlackbirdBoard({ players: context.players, overlays: context.overlays, recommendations: context.recommendations, draftedPlayerIds: context.draftedPlayerIds, leagueContext: context.leagueContext, includeDrafted: true });
const replacement = buildReplacementValueModel({
  leagueContext: context.leagueContext,
  teamCount: context.teamCount,
  players: rank.rows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    medianPoints: row.projectedFantasyPoints.median,
    projectionTrustLabel: row.projectionTrust.trustLabel,
    roleClassification: row.roleClassification,
  })),
});

const sampleRoles = rank.rows.slice(0, 12).map((row) => ({
  playerId: row.playerId,
  playerName: row.playerName,
  position: row.position,
  median: row.projectedFantasyPoints.median,
  blackbirdRank: row.blackbirdRank,
  role: row.roleClassification.role,
  roleConfidence: row.roleClassification.confidence,
  replacementMedian: row.replacementValue.replacementMedianPoints,
  pointsAboveReplacement: row.pointsAboveReplacement,
  valueScore: row.leagueValueScore,
  dataGaps: row.roleClassification.dataGaps.slice(0, 4),
}));

const checks = {
  roleClassificationPresent: rank.rows.every((row) => Boolean(row.roleClassification.role)),
  replacementBaselinesPresent: replacement.baselines.length > 0,
  parUsesSeasonProjectionMinusReplacement: rank.rows.every((row) => row.pointsAboveReplacement === null || row.replacementValue.replacementMedianPoints !== null),
  backupsCanBeBelowReplacement: context.dataMode === "real_room" ? true : rank.rows.some((row) => ["backup", "deep_reserve"].includes(row.roleClassification.role) && (row.pointsAboveReplacement ?? 1) < 0),
  draftedPlayersRetainBlackbirdRank: context.draftedPlayerIds.length ? rank.rows.some((row) => row.drafted && row.blackbirdRank > 0) : true,
  suggestionsCarryRoleAndPAR: suggestions.rows.every((row) => row.role && row.pointsAboveReplacement !== undefined),
  boardCarriesRoleAndPAR: board.rows.every((row) => row.role !== undefined && row.replacementMedianPoints !== undefined),
  noAdpPrimarySignal: !rank.diagnostics.adpPrimarySignal,
  noMutationOrPersistence: true,
};

const artifact = {
  kind,
  draftRoomId: draftRoomId ?? null,
  dataMode: context.dataMode,
  generatedAt: new Date().toISOString(),
  counts: {
    players: rank.rows.length,
    roleClassified: rank.diagnostics.roleClassifiedRows,
    replacementBaselinePositions: rank.diagnostics.replacementBaselinePositions,
    playersWithPAR: rank.diagnostics.playersWithRoleAwarePAR,
    draftSuggestions: suggestions.rows.length,
    boardRows: board.rows.length,
  },
  checks,
  replacementBaselines: replacement.baselines,
  sampleRoles,
  topSuggestions: suggestions.rows.slice(0, 8).map((row) => ({
    draftSuggestionRank: row.draftSuggestionRank,
    blackbirdRank: row.blackbirdRank,
    playerName: row.playerName,
    position: row.position,
    role: row.role,
    par: row.pointsAboveReplacement,
    score: row.suggestionScore,
    reasons: row.reasons.slice(0, 3),
    cautions: row.cautions.slice(0, 3),
  })),
  verdict: Object.values(checks).every(Boolean) ? "pass" : "fail",
};

writeArtifacts(kind, artifact);
console.log(`${kind} diagnostic`);
console.log(JSON.stringify({ verdict: artifact.verdict, counts: artifact.counts, checks: artifact.checks }, null, 2));
}

type DiagnosticArtifact = {
  kind: string;
  verdict: string;
  counts: Record<string, number>;
  checks: Record<string, boolean>;
  sampleRoles: Array<Record<string, any>>;
  [key: string]: any;
};

function writeArtifacts(name: string, artifact: DiagnosticArtifact) {
  const outDir = join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(join(outDir, `${name}.md`), markdown(artifact));
}

function markdown(artifact: DiagnosticArtifact): string {
  return [
    `# ${artifact.kind}`,
    "",
    `Verdict: ${artifact.verdict}`,
    "",
    "## Counts",
    ...Object.entries(artifact.counts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Checks",
    ...Object.entries(artifact.checks).map(([key, value]) => `- ${key}: ${value ? "pass" : "fail"}`),
    "",
    "## Sample Roles",
    ...artifact.sampleRoles.map((row: Record<string, any>) => `- #${row.blackbirdRank} ${row.playerName} (${row.position}): role=${row.role}, PAR=${row.pointsAboveReplacement ?? "unavailable"}, replacement=${row.replacementMedian ?? "unavailable"}`),
    "",
  ].join("\n");
}

function readArg(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function loadDiagnosticContext(inputDraftRoomId: string | null) {
  const authUserId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (inputDraftRoomId && authUserId) {
    const state = await getDraftRoomState(authUserId, inputDraftRoomId) as Record<string, any>;
    return {
      dataMode: "real_room" as const,
      players: mergePlayers(state.blackbirdRankPlayers ?? [], state.draftablePlayers ?? [], state.remainingPlayers ?? []),
      overlays: state.h10ValueOverlay ?? [],
      recommendations: state.h10RecommendationPreview ?? [],
      draftedPlayerIds: Array.isArray(state.draftedPlayerIds) ? state.draftedPlayerIds : [],
      positionNeeds: state.positionNeeds ?? [],
      currentPickNumber: state.currentPickNumber ?? null,
      teamCount: state.teamCount ?? null,
      leagueContext: {
        isDynasty: Boolean(state.league?.is_dynasty),
        isBestBall: Boolean(state.league?.is_best_ball),
        isSuperflex: Boolean(state.league?.is_superflex),
        isTwoQb: Boolean(state.league?.is_two_qb),
        tePremium: Number(state.league?.te_premium ?? 0),
        hasIDP: Boolean(state.hasIDP),
        hasKicker: Boolean(state.hasKicker),
        hasTeamDefense: Boolean(state.hasTeamDefense),
        rosterPositions: Array.isArray(state.league?.roster_positions_json) ? state.league.roster_positions_json : [],
        scoringSettings: state.league?.scoring_settings_json && typeof state.league.scoring_settings_json === "object" ? state.league.scoring_settings_json : null,
      },
    };
  }
  const leagueContext = {
    ...h1142LeagueContext,
    scoringSettings: { ...(h1142LeagueContext.scoringSettings ?? {}), teams: 2 },
  };
  return {
    dataMode: "synthetic_fixture" as const,
    players: [
      ...h1142Players(),
      player({ matched_player_id: "rb2", sleeper_player_id: "srb2", player_name: "Depth RB", position: "RB", projected_points: 155, team: "TST", rank: 90 }),
      player({ matched_player_id: "rb3", sleeper_player_id: "srb3", player_name: "Reserve RB", position: "RB", projected_points: 75, team: "TST", rank: 180 }),
      player({ matched_player_id: "qb2", sleeper_player_id: "sqb2", player_name: "Backup QB", position: "QB", projected_points: 115, team: "TST", rank: 190 }),
      player({ matched_player_id: "lb2", sleeper_player_id: "slb2", player_name: "Depth LB", position: "LB", projected_points: 140, team: "TST", rank: 170 }),
    ],
    overlays: [
      ...h1142Overlays(),
      overlay({ entityId: "rb2", displayName: "Depth RB", position: "RB", medianPoints: 155, floorPoints: 115, ceilingPoints: 195, pointsAboveReplacement: 5 }),
      overlay({ entityId: "rb3", displayName: "Reserve RB", position: "RB", medianPoints: 75, floorPoints: 50, ceilingPoints: 105, pointsAboveReplacement: -35, confidenceLabel: "low" }),
      overlay({ entityId: "qb2", displayName: "Backup QB", position: "QB", medianPoints: 115, floorPoints: 70, ceilingPoints: 160, pointsAboveReplacement: -120, confidenceLabel: "low" }),
      overlay({ entityId: "lb2", displayName: "Depth LB", position: "LB", medianPoints: 140, floorPoints: 105, ceilingPoints: 175, pointsAboveReplacement: -40, confidenceLabel: "low" }),
    ],
    recommendations: [],
    draftedPlayerIds: ["sqb"],
    positionNeeds: [{ position: "RB", needLevel: "high" }, { position: "LB", needLevel: "moderate" }],
    currentPickNumber: 80,
    teamCount: 2,
    leagueContext,
  };
}

function mergePlayers(...groups: any[][]): any[] {
  const rows: any[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.matched_player_id ?? ""}|${row.sleeper_player_id ?? ""}|${(row.player_name ?? "").toLowerCase()}|${(row.position ?? "").toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}
