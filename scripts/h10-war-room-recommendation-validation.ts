// H10.8 — War Room recommendation validation and controlled experiment readiness.
//
// Read-only. Discovers draft rooms, runs the H10 preview in memory, and writes
// validation artifacts. No persistence, legacy replacement, or ordering change.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { buildWarRoomValueOverlay } from "@/lib/draft/h10-war-room-overlay";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildNormalizedRosterRequirements, buildPositionNeeds, buildTopNeeds } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import {
  buildPerRoomValidation,
  buildValidationReadiness,
  classifyRosterFormats,
  type H10WarRoomInventoryRow,
  type H10WarRoomPerRoomValidation,
} from "@/lib/draft/war-room-recommendation-validation";
import { buildWarRoomRecommendations } from "@/lib/draft/war-room-recommendations";
import { rankingSource } from "@/lib/draft/h10-validation-room-seed";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import { getDraftRoomState } from "@/lib/rosterforge/state";
import { createAdminClient } from "@/lib/supabase/admin";

type LeagueRow = {
  id: string;
  name: string | null;
  season: number | null;
  roster_positions_json: string[] | null;
  is_superflex?: boolean | null;
  is_two_qb?: boolean | null;
  te_premium?: number | null;
};

type DraftRoomRow = {
  id: string;
  user_id: string;
  league_id: string;
  metadata_json?: Record<string, unknown> | null;
  settings_json?: Record<string, unknown> | null;
  leagues: LeagueRow | null;
};

type ValidationRankingRow = {
  sleeper_player_id: string | null;
  matched_player_id: string | null;
  player_name: string;
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
};

type Args = {
  includeLive: boolean;
  includeValidation: boolean;
  includeFixtures: boolean;
};

type ValidationArtifact = {
  generatedAt: string;
  artifactVersion: "h10.8-war-room-recommendation-validation-v3";
  args: Args;
  roomInventory: H10WarRoomInventoryRow[];
  formatCoverage: Record<string, boolean>;
  roomResults: H10WarRoomPerRoomValidation[];
  readiness: ReturnType<typeof buildValidationReadiness>;
  limitations: string[];
};

loadLocalEnv();

async function main() {
  const args = parseArgs();
  const rooms = await loadDraftRooms(args);
  const valueRows = loadH10ValueRows();
  const roomInventory: H10WarRoomInventoryRow[] = [];
  const roomResults: H10WarRoomPerRoomValidation[] = [];
  const limitations: string[] = [];

  for (const room of rooms) {
    const source = roomSource(room);
    const beforeState = source === "validation_seed" ? await getValidationSeedRoomState(room) : await getDraftRoomState(room.user_id, room.id);
    const inventory = buildInventoryRow(room, beforeState, source);
    roomInventory.push(inventory);
    if (!inventory.h10PreviewEnabledPossible) {
      limitations.push(`${room.id}: H10 preview skipped because no remaining players were available.`);
      continue;
    }

    const remainingPlayers = beforeState.remainingPlayers as DraftTargetScorePlayer[];
    const sleeperToCanonicalId = await loadSleeperCrosswalk(remainingPlayers);
    let overlay = buildWarRoomValueOverlay({
      leagueId: room.league_id,
      players: remainingPlayers,
      valueRows: valueRows.filter((row) => row.leagueId === room.league_id),
      rosterRequirements: beforeState.rosterRequirements,
      includeDstDryRun: true,
      includeAllPositions: false,
      sleeperToCanonicalId,
    });
    if (source === "validation_seed" && room.metadata_json?.h10_validation_profile === "dst" && overlay.rows.every((row) => row.overlayStatus === "missing_projection")) {
      overlay = buildSyntheticDstValidationOverlay(room.league_id, remainingPlayers);
    }
    const recommendations = buildWarRoomRecommendations({
      leagueId: room.league_id,
      draftRoomId: room.id,
      remainingPlayers,
      h10ValueOverlay: overlay.rows,
      rosterRequirements: beforeState.rosterRequirements,
      positionNeeds: beforeState.positionNeeds,
      topNeeds: beforeState.topNeeds,
      myRoster: beforeState.myRoster,
      picks: beforeState.picks,
      currentPickNumber: beforeState.currentPickNumber ?? null,
      currentRound: beforeState.currentRound ?? null,
      picksUntilMyNextPick: beforeState.picksUntilMyNextPick ?? null,
      draftedPlayerIds: beforeState.draftedPlayerIds?.filter((id): id is string => Boolean(id)),
      positionCounts: beforeState.positionCounts,
      includeDstDryRun: true,
      matchCoverageSummary: overlay.diagnostics.matchCoverageSummary,
    });
    const afterState = source === "validation_seed" ? await getValidationSeedRoomState(room) : await getDraftRoomState(room.user_id, room.id);
    roomResults.push(
      buildPerRoomValidation({
        inventory,
        recommendations,
        legacyRecommendationTopRows: compactLegacyRows(beforeState.recommendations ?? []),
        legacyRowsChanged: signature(beforeState.recommendations ?? []) !== signature(afterState.recommendations ?? []),
        remainingPlayersOrderChanged: playerOrderSignature(beforeState.remainingPlayers ?? []) !== playerOrderSignature(afterState.remainingPlayers ?? []),
      })
    );
  }

  if (roomInventory.length < 2) {
    limitations.push("Database validation has fewer than two draft rooms; missing format coverage may require fixtures.");
  }

  if (args.includeFixtures) {
    const fixtures = buildFixtureValidations();
    roomInventory.push(...fixtures.inventory);
    roomResults.push(...fixtures.results);
  }

  const readiness = buildValidationReadiness({ inventory: roomInventory, roomResults });
  const artifact: ValidationArtifact = {
    generatedAt: new Date().toISOString(),
    artifactVersion: "h10.8-war-room-recommendation-validation-v3",
    args,
    roomInventory,
    formatCoverage: readiness.formatCoverage,
    roomResults,
    readiness,
    limitations,
  };
  const artifactPaths = writeArtifacts(artifact);

  console.log("\nH10.8 War Room Recommendation Validation");
  console.log(JSON.stringify({
    args,
    draftRoomsDiscovered: roomInventory.length,
    roomsValidated: roomResults.length,
    formatCoverage: readiness.formatCoverage,
    thresholdResults: readiness.thresholdResults,
    failures: readiness.failures,
    roomExperimentReadiness: roomResults.map((room) => ({
      source: room.source,
      draftRoomId: room.draftRoomId,
      legacyReady: room.experimentReadiness.legacyReady,
      blackbirdPreviewReady: room.experimentReadiness.blackbirdPreviewReady,
      blackbirdExperimentEligible: room.experimentReadiness.blackbirdExperimentEligible,
      failedExperimentGates: room.experimentReadiness.failedExperimentGates,
    })),
    limitations,
    verdict: readiness.verdict,
    artifactPaths,
  }, null, 2));
}

async function loadDraftRooms(args: Args): Promise<DraftRoomRow[]> {
  if (!args.includeLive && !args.includeValidation) return [];
  const query = createAdminClient()
    .from("draft_rooms")
    .select("id,user_id,league_id,metadata_json,settings_json,leagues(id,name,season,roster_positions_json,is_superflex,is_two_qb,te_premium)")
    .order("created_at", { ascending: false });
  const { data, error } = await query.limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as DraftRoomRow[]).filter((room) => {
    const source = roomSource(room);
    return (source === "live" && args.includeLive) || (source === "validation_seed" && args.includeValidation);
  });
}

function buildInventoryRow(room: DraftRoomRow, state: Awaited<ReturnType<typeof getDraftRoomState>>, source: H10WarRoomInventoryRow["source"]): H10WarRoomInventoryRow {
  const league = room.leagues ?? (state.league as LeagueRow | null);
  const formats = classifyRosterFormats({
    rosterSlots: league?.roster_positions_json ?? [],
    isSuperflex: league?.is_superflex,
    isTwoQb: league?.is_two_qb,
    tePremium: league?.te_premium,
  });
  const remainingPlayers = (state.remainingPlayers ?? []) as DraftTargetScorePlayer[];
  const positionsPresent = Array.from(new Set(remainingPlayers.map((player) => player.position ?? "UNK"))).sort();
  const fallbackRowCount = remainingPlayers.filter((player) => player.is_fallback).length;
  const rankedRowCount = remainingPlayers.filter((player) => player.is_ranked && !player.is_fallback).length;

  return {
    source,
    draftRoomId: room.id,
    leagueId: room.league_id,
    leagueName: league?.name ?? null,
    season: league?.season ?? null,
    has_uploaded_rankings: Boolean(state.rankingsUploaded),
    remaining_player_count: remainingPlayers.length,
    fallback_row_count: fallbackRowCount,
    ranked_row_count: rankedRowCount,
    positions_present: positionsPresent,
    hasIDP: formats.requirements.hasIDP,
    hasKicker: formats.requirements.hasKicker,
    hasTeamDefense: formats.requirements.hasTeamDefense,
    isSuperflex: formats.isSuperflex,
    is2QB: formats.is2QB,
    isTEPremium: formats.isTEPremium,
    benchDepth: formats.benchDepth,
    currentPickKnown: state.currentPickNumber !== null && state.currentPickNumber !== undefined,
    picksUntilMyNextPickKnown: state.picksUntilMyNextPick !== null && state.picksUntilMyNextPick !== undefined,
    legacyRecommendationCount: (state.recommendations ?? []).length,
    h10PreviewEnabledPossible: remainingPlayers.length > 0,
  };
}

async function getValidationSeedRoomState(room: DraftRoomRow): Promise<Awaited<ReturnType<typeof getDraftRoomState>>> {
  const profile = typeof room.metadata_json?.h10_validation_profile === "string" ? room.metadata_json.h10_validation_profile : "";
  const rosterSlots = Array.isArray(room.settings_json?.roster_positions)
    ? (room.settings_json.roster_positions as string[])
    : Array.isArray(room.leagues?.roster_positions_json)
      ? room.leagues.roster_positions_json
      : [];
  const { data, error } = await createAdminClient()
    .from("draft_rankings")
    .select("sleeper_player_id,matched_player_id,player_name,position,team,rank,adp,projected_points,dynasty_value,best_ball_value,superflex_value,te_premium_value,match_status,match_confidence")
    .eq("user_id", room.user_id)
    .eq("league_id", room.league_id)
    .eq("source", rankingSource())
    .eq("format", profile)
    .order("rank", { ascending: true, nullsFirst: false });
  if (error) throw error;
  const remainingPlayers = ((data ?? []) as ValidationRankingRow[]).map((ranking) => ({
    source: "ranking" as const,
    sleeper_player_id: ranking.sleeper_player_id,
    matched_player_id: ranking.matched_player_id,
    player_name: ranking.player_name,
    position: ranking.position,
    team: ranking.team,
    rank: ranking.rank,
    adp: ranking.adp,
    projected_points: ranking.projected_points,
    dynasty_value: ranking.dynasty_value,
    best_ball_value: ranking.best_ball_value,
    superflex_value: ranking.superflex_value,
    te_premium_value: ranking.te_premium_value,
    match_status: ranking.match_status,
    match_confidence: ranking.match_confidence,
    is_ranked: true,
    is_fallback: false,
  })) as DraftTargetScorePlayer[];
  const rosterRequirements = buildNormalizedRosterRequirements(rosterSlots);
  const positionCounts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, DL: 0, LB: 0, DB: 0 };
  const positionNeeds = buildPositionNeeds(positionCounts, rosterRequirements);
  const topNeeds = buildTopNeeds(positionNeeds);

  return {
    room,
    league: room.leagues,
    picks: [],
    currentPickNumber: 1,
    currentRound: 1,
    picksUntilMyNextPick: 12,
    lastPick: null,
    myRoster: [],
    positionCounts,
    draftedPlayerIds: [],
    remainingPlayers,
    recommendations: [],
    topNeeds,
    rosterRequirements,
    positionNeeds,
    hasIDP: rosterRequirements.hasIDP,
    hasKicker: rosterRequirements.hasKicker,
    hasTeamDefense: rosterRequirements.hasTeamDefense,
    unknownRosterSlots: rosterRequirements.unknownSlots,
    rankingsUploaded: true,
    rankingMatchStatusCounts: {},
    boardLabel: "H10 validation ranked players",
    scoringMetadata: null,
    warnings: [],
    warningMessages: [],
    warning: null,
    fallbackRelevanceDiagnostics: null,
  } as unknown as Awaited<ReturnType<typeof getDraftRoomState>>;
}

function roomSource(room: DraftRoomRow): H10WarRoomInventoryRow["source"] {
  const metadata = (room as unknown as { metadata_json?: Record<string, unknown> | null }).metadata_json ?? {};
  return metadata.validation_room === true || metadata.purpose === "h10_recommendation_validation" ? "validation_seed" : "live";
}

async function loadSleeperCrosswalk(players: DraftTargetScorePlayer[]): Promise<Record<string, string>> {
  const sleeperIds = [...new Set(players.map((player) => player.sleeper_player_id).filter((id): id is string => Boolean(id)))];
  if (!sleeperIds.length) return {};
  const crosswalk: Record<string, string> = {};
  for (const batch of chunks(sleeperIds, 200)) {
    const { data, error } = await createAdminClient()
      .from("players")
      .select("id,sleeper_player_id")
      .in("sleeper_player_id", batch);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; sleeper_player_id: string | null }>) {
      if (row.sleeper_player_id) crosswalk[row.sleeper_player_id] = row.id;
    }
  }
  return crosswalk;
}

function loadH10ValueRows(): H10LeagueValueRow[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] };
  return artifact.rows ?? [];
}

function compactLegacyRows(rows: unknown[]): H10WarRoomPerRoomValidation["legacyRecommendationTopRows"] {
  return rows.slice(0, 10).map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      player_name: typeof item.player_name === "string" ? item.player_name : null,
      position: typeof item.position === "string" ? item.position : null,
      recommendationTier: typeof item.recommendationTier === "string" ? item.recommendationTier : null,
      draftTargetScore: typeof item.draftTargetScore === "number" ? item.draftTargetScore : null,
    };
  });
}

function buildFixtureValidations(): { inventory: H10WarRoomInventoryRow[]; results: H10WarRoomPerRoomValidation[] } {
  const fixtures = [
    fixtureRoom({
      draftRoomId: "fixture-one-qb-offense",
      leagueName: "[Fixture] 1QB Offense",
      rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN"],
      players: [
        fixturePlayer("fixture-rb", "Fixture RB", "RB", 1),
        fixturePlayer("fixture-wr", "Fixture WR", "WR", 2),
        fixturePlayer("fixture-qb", "Fixture QB", "QB", 3),
        fixturePlayer("fixture-te", "Fixture TE", "TE", 4),
      ],
      overlays: [
        fixtureOverlay("fixture-rb", "Fixture RB", "RB", 70),
        fixtureOverlay("fixture-wr", "Fixture WR", "WR", 42),
        fixtureOverlay("fixture-qb", "Fixture QB", "QB", 35),
        fixtureOverlay("fixture-te", "Fixture TE", "TE", 34),
      ],
      positionCounts: { RB: 0 },
      positionNeeds: [{ position: "RB", draftedCount: 0, minimumNeed: 3, directStarterRequirement: 2, sharedFlexDemand: 1, needLevel: "urgent" }],
    }),
    fixtureRoom({
      draftRoomId: "fixture-superflex-qb",
      leagueName: "[Fixture] Superflex QB",
      rosterSlots: ["QB", "RB", "WR", "TE", "SUPER_FLEX", "BN", "BN", "BN"],
      players: [
        fixturePlayer("fixture-sf-qb", "Fixture SF QB", "QB", 1),
        fixturePlayer("fixture-sf-rb", "Fixture SF RB", "RB", 2),
        fixturePlayer("fixture-sf-wr", "Fixture SF WR", "WR", 3),
      ],
      overlays: [
        fixtureOverlay("fixture-sf-qb", "Fixture SF QB", "QB", 58),
        fixtureOverlay("fixture-sf-rb", "Fixture SF RB", "RB", 62),
        fixtureOverlay("fixture-sf-wr", "Fixture SF WR", "WR", 48),
      ],
      positionCounts: { QB: 0, RB: 1, WR: 1 },
    }),
    fixtureRoom({
      draftRoomId: "fixture-te-premium",
      leagueName: "[Fixture] TE Premium",
      rosterSlots: ["QB", "RB", "WR", "TE", "FLEX", "BN", "BN", "BN"],
      tePremium: 1.5,
      players: [fixturePlayer("fixture-tep-te", "Fixture Premium TE", "TE", 1), fixturePlayer("fixture-tep-wr", "Fixture WR", "WR", 2)],
      overlays: [fixtureOverlay("fixture-tep-te", "Fixture Premium TE", "TE", 75), fixtureOverlay("fixture-tep-wr", "Fixture WR", "WR", 40)],
      positionCounts: { TE: 0 },
      positionNeeds: [{ position: "TE", draftedCount: 0, minimumNeed: 1, directStarterRequirement: 1, needLevel: "high" }],
    }),
    fixtureRoom({
      draftRoomId: "fixture-kicker-dst",
      leagueName: "[Fixture] Kicker DST",
      rosterSlots: ["QB", "RB", "WR", "TE", "K", "DEF", "BN", "BN"],
      players: [fixturePlayer("fixture-k", "Fixture K", "K", 1), fixturePlayer("fixture-dst", "Fixture DST", "DEF", 2)],
      overlays: [
        fixtureOverlay("fixture-k", "Fixture K", "K", 40),
        fixtureOverlay("fixture-dst", "Fixture DST", "DEF", 45, { entityType: "TEAM_DEFENSE", overlayStatus: "dst_dry_run", valueReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY", warningCodes: ["DST_DRY_RUN_ONLY"] }),
      ],
      currentRound: 3,
    }),
    fixtureRoom({
      draftRoomId: "fixture-idp-mixed",
      leagueName: "[Fixture] Mixed IDP",
      rosterSlots: ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "IDP_FLEX", "BN", "BN"],
      players: [fixturePlayer("fixture-dl", "Fixture DL", "DL", 1), fixturePlayer("fixture-lb", "Fixture LB", "LB", 2), fixturePlayer("fixture-db", "Fixture DB", "DB", 3)],
      overlays: [fixtureOverlay("fixture-dl", "Fixture DL", "DL", 64), fixtureOverlay("fixture-lb", "Fixture LB", "LB", 72), fixtureOverlay("fixture-db", "Fixture DB", "DB", 50)],
      positionCounts: { DL: 0, LB: 0, DB: 0 },
    }),
  ];
  return {
    inventory: fixtures.map((fixture) => fixture.inventory),
    results: fixtures.map((fixture) => fixture.result),
  };
}

function buildSyntheticDstValidationOverlay(leagueId: string, players: DraftTargetScorePlayer[]) {
  const rows: WarRoomValueOverlayRow[] = players.map((player, index) => ({
    leagueId,
    entityId: `h10-validation-dst-${index + 1}`,
    entityType: "TEAM_DEFENSE",
    displayName: player.player_name ?? `Validation DST ${index + 1}`,
    team: player.team,
    position: "DEF",
    floorPoints: 65 - index,
    medianPoints: 75 - index,
    ceilingPoints: 85 - index,
    pointsAboveReplacement: 8 - index * 0.5,
    pointsAboveStarterCutline: 4 - index * 0.25,
    riskAdjustedValue: 6 - index * 0.4,
    confidenceAdjustedValue: 5 - index * 0.4,
    tier: Math.floor(index / 3) + 1,
    tierLabel: `Tier ${Math.floor(index / 3) + 1}`,
    positionScarcityScore: 35 - index,
    scarcityLabel: "medium",
    marketValueSignal: "not_implemented",
    marketRankDelta: null,
    confidenceLabel: "low",
    riskLabel: "high",
    valueReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY",
    warningCodes: ["DST_DRY_RUN_ONLY", "MARKET_NOT_IMPLEMENTED"],
    reasonCodes: ["H10_VALIDATION_SYNTHETIC_DST_OVERLAY"],
    draftRelevance: "draft_relevant",
    overlayStatus: "dst_dry_run",
  }));
  return {
    rows,
    diagnostics: {
      leagueId,
      playerRowsLoaded: players.length,
      h10RowsLoaded: 0,
      matchedRows: players.length,
      unmatchedRows: 0,
      rowsByOverlayStatus: { dst_dry_run: players.length },
      rowsByPosition: { DEF: players.length },
      warningCounts: { DST_DRY_RUN_ONLY: players.length, MARKET_NOT_IMPLEMENTED: players.length },
      matchCoverageSummary: {
        leagueId,
        rowsLoaded: players.length,
        rowsMatched: players.length,
        rowsUnmatched: 0,
        matchRate: 1,
        matchRateByPosition: { DEF: { rows: players.length, matched: players.length, unmatched: 0, matchRate: 1 } },
        matchRateBySource: { "validation_seed:dst": { rows: players.length, matched: players.length, unmatched: 0, matchRate: 1 } },
        missingProjectionCount: 0,
        formatExcludedCount: 0,
        lowConfidenceCount: players.length,
        classificationCounts: { H10_VALIDATION_SYNTHETIC_DST_OVERLAY: players.length },
        missingProjectionReasons: {},
        topMissingHighRankPlayers: [],
        topMissingHighAdpPlayers: [],
        highPriorityMissingProjectionExamples: [],
      },
      missingProjectionReasons: {},
      matchRateByPosition: { DEF: { rows: players.length, matched: players.length, unmatched: 0, matchRate: 1 } },
      highPriorityMissingProjectionExamples: [],
      invariantFailures: [],
    },
  };
}

function fixtureRoom(input: {
  draftRoomId: string;
  leagueName: string;
  rosterSlots: string[];
  players: DraftTargetScorePlayer[];
  overlays: WarRoomValueOverlayRow[];
  positionCounts?: Record<string, number>;
  positionNeeds?: unknown;
  tePremium?: number;
  currentRound?: number;
}) {
  const formats = classifyRosterFormats({ rosterSlots: input.rosterSlots, tePremium: input.tePremium ?? 0 });
  const recommendations = buildWarRoomRecommendations({
    leagueId: input.draftRoomId,
    draftRoomId: input.draftRoomId,
    remainingPlayers: input.players,
    h10ValueOverlay: input.overlays,
    rosterRequirements: buildNormalizedRosterRequirements(input.rosterSlots),
    positionNeeds: input.positionNeeds,
    topNeeds: input.positionNeeds,
    myRoster: [],
    picks: [],
    currentPickNumber: 24,
    currentRound: input.currentRound ?? 2,
    picksUntilMyNextPick: 12,
    draftedPlayerIds: [],
    positionCounts: input.positionCounts ?? {},
    includeDstDryRun: true,
    matchCoverageSummary: {
      leagueId: input.draftRoomId,
      rowsLoaded: input.players.length,
      rowsMatched: input.overlays.filter((row) => row.overlayStatus !== "missing_projection").length,
      rowsUnmatched: input.overlays.filter((row) => row.overlayStatus === "missing_projection").length,
      matchRate: input.overlays.filter((row) => row.overlayStatus !== "missing_projection").length / Math.max(1, input.players.length),
      matchRateByPosition: {},
      matchRateBySource: {},
      missingProjectionCount: input.overlays.filter((row) => row.overlayStatus === "missing_projection").length,
      formatExcludedCount: 0,
      lowConfidenceCount: input.overlays.filter((row) => row.overlayStatus === "low_confidence").length,
      classificationCounts: {},
      missingProjectionReasons: {},
      topMissingHighRankPlayers: [],
      topMissingHighAdpPlayers: [],
      highPriorityMissingProjectionExamples: [],
    },
  });
  const inventory: H10WarRoomInventoryRow = {
    source: "fixture",
    draftRoomId: input.draftRoomId,
    leagueId: input.draftRoomId,
    leagueName: input.leagueName,
    season: 2026,
    has_uploaded_rankings: true,
    remaining_player_count: input.players.length,
    fallback_row_count: 0,
    ranked_row_count: input.players.length,
    positions_present: [...new Set(input.players.map((player) => player.position ?? "UNK"))].sort(),
    hasIDP: formats.requirements.hasIDP,
    hasKicker: formats.requirements.hasKicker,
    hasTeamDefense: formats.requirements.hasTeamDefense,
    isSuperflex: formats.isSuperflex,
    is2QB: formats.is2QB,
    isTEPremium: formats.isTEPremium,
    benchDepth: formats.benchDepth,
    currentPickKnown: true,
    picksUntilMyNextPickKnown: true,
    legacyRecommendationCount: 0,
    h10PreviewEnabledPossible: true,
  };
  return {
    inventory,
    result: buildPerRoomValidation({
      inventory,
      recommendations,
      legacyRecommendationTopRows: [],
      legacyRowsChanged: false,
      remainingPlayersOrderChanged: false,
    }),
  };
}

function fixturePlayer(id: string, name: string, position: string, rank: number): DraftTargetScorePlayer {
  return {
    sleeper_player_id: id,
    matched_player_id: id,
    player_name: name,
    position,
    team: "FA",
    rank,
    adp: rank + 10,
    projected_points: 200 - rank,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
  };
}

function fixtureOverlay(
  id: string,
  name: string,
  position: string,
  value: number,
  overrides: Partial<WarRoomValueOverlayRow> = {}
): WarRoomValueOverlayRow {
  return {
    leagueId: "fixture",
    entityId: id,
    entityType: "PLAYER",
    displayName: name,
    team: "FA",
    position,
    medianPoints: value,
    pointsAboveReplacement: value,
    pointsAboveStarterCutline: value / 2,
    riskAdjustedValue: value,
    confidenceAdjustedValue: value,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: value,
    scarcityLabel: value >= 60 ? "high" : "medium",
    marketValueSignal: "aligned",
    marketRankDelta: 0,
    confidenceLabel: "medium",
    riskLabel: "medium",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
    floorPoints: overrides.floorPoints ?? value - 10,
    ceilingPoints: overrides.ceilingPoints ?? value + 10,
  };
}

function signature(value: unknown): string {
  return JSON.stringify(value);
}

function playerOrderSignature(players: unknown[]): string {
  return players
    .map((player) => {
      const row = player && typeof player === "object" ? (player as Record<string, unknown>) : {};
      return [row.sleeper_player_id, row.matched_player_id, row.player_name, row.position].join("|");
    })
    .join("\n");
}

function writeArtifacts(artifact: ValidationArtifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-war-room-recommendation-validation.json");
  const markdownPath = path.join(dir, "h10-war-room-recommendation-validation.md");
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));
  writeFileSync(markdownPath, renderMarkdown(artifact));
  return { jsonPath, markdownPath };
}

function renderMarkdown(artifact: ValidationArtifact): string {
  const lines = [
    "# H10.8 War Room Recommendation Validation",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    `Readiness verdict: ${artifact.readiness.verdict}`,
    "",
    "## Format Coverage",
    "",
    ...Object.entries(artifact.formatCoverage).map(([format, covered]) => `- ${format}: ${covered ? "covered" : "not covered"}`),
    "",
    "## Room Inventory",
    "",
    "| Draft room | League | Season | Rankings | Remaining | Fallback | Ranked | Positions | Formats |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ...artifact.roomInventory.map((room) =>
      `| ${room.source}:${room.draftRoomId} | ${room.leagueName ?? room.leagueId} | ${room.season ?? ""} | ${room.has_uploaded_rankings ? "yes" : "no"} | ${room.remaining_player_count} | ${room.fallback_row_count} | ${room.ranked_row_count} | ${room.positions_present.join(", ")} | ${[
        room.isSuperflex ? "Superflex" : null,
        room.is2QB ? "2QB" : null,
        room.isTEPremium ? "TE premium" : null,
        room.hasIDP ? "IDP" : null,
        room.hasKicker ? "K" : null,
        room.hasTeamDefense ? "DST" : null,
        room.benchDepth >= 8 ? "deep" : "shallow",
      ].filter(Boolean).join(", ")} |`
    ),
    "",
    "## Per-Room Results",
    "",
    ...artifact.roomResults.flatMap((room) => [
      `### ${room.leagueName ?? room.leagueId} (${room.draftRoomId})`,
      "",
      `- Formats: ${room.formats.join(", ") || "unknown"}`,
      `- Loaded: ${room.remainingPlayersLoaded} remaining, ${room.overlayRowsLoaded} overlay rows, ${room.recommendationsGenerated} recommendations`,
      `- Match rate: ${room.matchRate ?? "unknown"}`,
      `- Rows by tier: ${JSON.stringify(room.rowsByTier)}`,
      `- Rows by status: ${JSON.stringify(room.rowsByStatus)}`,
      `- Warnings: ${JSON.stringify(room.warningCounts)}`,
      `- Thresholds: ${JSON.stringify(room.thresholdResults)}`,
      `- Experiment readiness: ${JSON.stringify({
        legacyReady: room.experimentReadiness.legacyReady,
        blackbirdPreviewReady: room.experimentReadiness.blackbirdPreviewReady,
        blackbirdExperimentEligible: room.experimentReadiness.blackbirdExperimentEligible,
        failedExperimentGates: room.experimentReadiness.failedExperimentGates,
      })}`,
      `- Legacy changed: ${room.legacyRowsChanged}`,
      `- Remaining order changed: ${room.remainingPlayersOrderChanged}`,
      `- Top rows: ${room.topRecommendations.slice(0, 5).map((row) => `${row.displayName} ${row.position ?? ""} ${row.recommendationTier} ${row.recommendationScore}`).join("; ")}`,
      "",
    ]),
    "## Failures",
    "",
    ...(artifact.readiness.failures.length ? artifact.readiness.failures.map((failure) => `- ${failure}`) : ["- None"]),
    "",
    "## Limitations",
    "",
    ...(artifact.limitations.length ? artifact.limitations.map((limitation) => `- ${limitation}`) : ["- None"]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const explicit = argv.some((arg) => ["--live", "--validation", "--fixtures", "--all"].includes(arg));
  const all = argv.includes("--all") || !explicit;
  return {
    includeLive: all || argv.includes("--live"),
    includeValidation: all || argv.includes("--validation"),
    includeFixtures: all || argv.includes("--fixtures"),
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
