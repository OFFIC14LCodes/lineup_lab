import { describe, expect, it } from "vitest";

import {
  buildDraftTargetScore,
  type DraftTargetScorePlayer,
  type RecommendationTier,
  type ScoredDraftTarget
} from "./scoring";

const supportedPositions = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const unsupportedReasonTerms = [
  "tackles",
  "sacks",
  "interceptions",
  "pressure rate",
  "matchup",
  "schedule strength",
  "injury",
  "weather",
  "streaming upside"
];
const allowedTiers: RecommendationTier[] = [
  "elite_target",
  "strong_target",
  "good_value",
  "depth_option",
  "avoid_for_now"
];

function makeLeague(overrides: Partial<Parameters<typeof buildDraftTargetScore>[0]["league"]> = {}) {
  return {
    currentPickNumber: 25,
    rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"],
    positionCounts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, DL: 0, LB: 0, DB: 0 },
    is_dynasty: false,
    is_best_ball: false,
    is_superflex: false,
    is_two_qb: false,
    te_premium: 0,
    scoringSettings: null,
    ...overrides
  };
}

function makePlayer(overrides: Partial<DraftTargetScorePlayer> = {}): DraftTargetScorePlayer {
  return {
    sleeper_player_id:
      "sleeper_player_id" in overrides ? (overrides.sleeper_player_id ?? null) : `sleeper-${overrides.player_name ?? "player"}`,
    matched_player_id:
      "matched_player_id" in overrides ? (overrides.matched_player_id ?? null) : `matched-${overrides.player_name ?? "player"}`,
    player_name: "player_name" in overrides ? (overrides.player_name ?? null) : "Player",
    position: "position" in overrides ? (overrides.position ?? null) : "RB",
    team: "team" in overrides ? (overrides.team ?? null) : "ATL",
    rank: "rank" in overrides ? (overrides.rank ?? null) : 50,
    adp: "adp" in overrides ? (overrides.adp ?? null) : 50,
    projected_points: "projected_points" in overrides ? (overrides.projected_points ?? null) : 200,
    dynasty_value: "dynasty_value" in overrides ? (overrides.dynasty_value ?? null) : 50,
    best_ball_value: "best_ball_value" in overrides ? (overrides.best_ball_value ?? null) : 50,
    superflex_value: "superflex_value" in overrides ? (overrides.superflex_value ?? null) : 50,
    te_premium_value: "te_premium_value" in overrides ? (overrides.te_premium_value ?? null) : 50,
    match_status: "match_status" in overrides ? (overrides.match_status ?? null) : "exact_id",
    match_confidence: "match_confidence" in overrides ? (overrides.match_confidence ?? null) : 1,
    is_ranked: overrides.is_ranked ?? true,
    is_fallback: overrides.is_fallback ?? false
  };
}

function scorePlayers(players: DraftTargetScorePlayer[], leagueOverrides: Partial<Parameters<typeof buildDraftTargetScore>[0]["league"]> = {}) {
  return buildDraftTargetScore({
    players,
    league: makeLeague(leagueOverrides)
  });
}

function findPlayer(players: ScoredDraftTarget[], name: string) {
  const player = players.find((entry) => entry.player_name === name);
  expect(player).toBeDefined();
  return player as ScoredDraftTarget;
}

function expectScoreInvariant(player: ScoredDraftTarget) {
  if (player.draftTargetScore !== null) {
    expect(player.draftTargetScore).toBeGreaterThanOrEqual(0);
    expect(player.draftTargetScore).toBeLessThanOrEqual(100);
  }
  expect(allowedTiers).toContain(player.recommendationTier);
  if (player.scoreComponents) {
    expect(player.scoreComponents.matchConfidencePenalty).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.rankingScore).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.projectionScore).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.valueScore).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.rosterNeedScore).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.scarcityScore).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.formatFitScore).toBeGreaterThanOrEqual(0);
    expect(player.scoreComponents.adpValueScore).toBeGreaterThanOrEqual(0);
  }
  expect(player.reasons.length).toBeLessThanOrEqual(4);
  expect(new Set(player.warnings).size).toBe(player.warnings.length);
}

describe("buildDraftTargetScore", () => {
  it("keeps offense-only recommendations stable and excludes unused non-offense positions", () => {
    const players = [
      makePlayer({ player_name: "Alpha WR", position: "WR", rank: 5, adp: 11, projected_points: 250, dynasty_value: 86 }),
      makePlayer({ player_name: "Beta RB", position: "RB", rank: 8, adp: 9, projected_points: 230, dynasty_value: 83 }),
      makePlayer({ player_name: "Gamma QB", position: "QB", rank: 12, adp: 20, projected_points: 320, superflex_value: 80 }),
      makePlayer({ player_name: "Delta TE", position: "TE", rank: 16, adp: 30, projected_points: 180, te_premium_value: 72 }),
      makePlayer({
        player_name: "Elite K",
        position: "K",
        rank: 1,
        adp: 180,
        projected_points: null,
        dynasty_value: null,
        best_ball_value: null,
        superflex_value: null,
        te_premium_value: null
      }),
      makePlayer({
        player_name: "Elite DEF",
        position: "DEF",
        rank: 2,
        adp: 170,
        projected_points: null,
        dynasty_value: null,
        best_ball_value: null,
        superflex_value: null,
        te_premium_value: null
      }),
      makePlayer({
        player_name: "Elite DL",
        position: "DL",
        rank: 3,
        adp: 160,
        projected_points: null,
        dynasty_value: null,
        best_ball_value: null,
        superflex_value: null,
        te_premium_value: null
      })
    ];

    const result = scorePlayers(players);

    expect(result.scoringMetadata.formulaVersion).toBe("draft_target_score_v1.2");
    expect(result.scoringMetadata.supportedScoredPositions).toEqual(supportedPositions);
    expect(result.recommendations.map((player) => player.position)).toEqual(
      expect.arrayContaining(["WR", "RB", "QB", "TE"])
    );
    expect(result.recommendations.map((player) => player.position)).not.toEqual(expect.arrayContaining(["K", "DEF", "DL"]));

    const kicker = findPlayer(result.scoredPlayers, "Elite K");
    const defense = findPlayer(result.scoredPlayers, "Elite DEF");
    const defender = findPlayer(result.scoredPlayers, "Elite DL");
    expect(kicker.recommendationTier).toBe("avoid_for_now");
    expect(defense.recommendationTier).toBe("avoid_for_now");
    expect(defender.recommendationTier).toBe("avoid_for_now");
    expect(kicker.warnings).toContain("K is not used by this league.");
    expect(defense.warnings).toContain("DEF is not used by this league.");
    expect(defender.warnings).toContain("DL is not used by this league.");
  });

  it("applies kicker safeguards across draft stages and league usage", () => {
    const players = [
      makePlayer({ player_name: "Strong WR", position: "WR", rank: 9, adp: 10, projected_points: 235, dynasty_value: 80 }),
      makePlayer({
        player_name: "Top K",
        position: "K",
        rank: 1,
        adp: 175,
        projected_points: null,
        dynasty_value: null,
        best_ball_value: null,
        superflex_value: null,
        te_premium_value: null
      })
    ];

    const early = scorePlayers(players, {
      rosterPositions: ["QB", "RB", "WR", "TE", "K", "BN"],
      currentPickNumber: 18
    });
    const late = scorePlayers(players, {
      rosterPositions: ["QB", "RB", "WR", "TE", "K", "BN"],
      currentPickNumber: 160,
      positionCounts: { QB: 1, RB: 3, WR: 4, TE: 1, K: 0, DEF: 0, DL: 0, LB: 0, DB: 0 }
    });
    const noKLeague = scorePlayers(players, {
      rosterPositions: ["QB", "RB", "WR", "TE", "BN"],
      currentPickNumber: 160
    });

    const earlyK = findPlayer(early.scoredPlayers, "Top K");
    const lateK = findPlayer(late.scoredPlayers, "Top K");
    const noLeagueK = findPlayer(noKLeague.scoredPlayers, "Top K");
    const earlyWr = findPlayer(early.scoredPlayers, "Strong WR");

    expect(earlyK.recommendationTier).not.toBe("elite_target");
    expect(earlyK.warnings).toContain("No kicker projection inputs");
    expect(earlyK.draftTargetScore).toBeLessThan(earlyWr.draftTargetScore ?? 100);

    expect(["good_value", "strong_target"]).toContain(lateK.recommendationTier);
    expect(lateK.recommendationTier).not.toBe("elite_target");
    expect(lateK.scoreComponents?.rosterNeedScore).toBeGreaterThan(earlyK.scoreComponents?.rosterNeedScore ?? 0);

    expect(noLeagueK.recommendationTier).toBe("avoid_for_now");
    expect(noLeagueK.warnings).toContain("K is not used by this league.");
  });

  it("applies team-defense safeguards without unsupported matchup claims", () => {
    const players = [
      makePlayer({ player_name: "Strong RB", position: "RB", rank: 10, adp: 15, projected_points: 228, dynasty_value: 81 }),
      makePlayer({
        player_name: "Top DEF",
        position: "DEF",
        rank: 1,
        adp: 172,
        projected_points: null,
        dynasty_value: null,
        best_ball_value: null,
        superflex_value: null,
        te_premium_value: null
      })
    ];

    const early = scorePlayers(players, {
      rosterPositions: ["QB", "RB", "WR", "TE", "DST", "BN"],
      currentPickNumber: 20
    });
    const late = scorePlayers(players, {
      rosterPositions: ["QB", "RB", "WR", "TE", "DST", "BN"],
      currentPickNumber: 170,
      positionCounts: { QB: 1, RB: 3, WR: 4, TE: 1, K: 0, DEF: 0, DL: 0, LB: 0, DB: 0 }
    });
    const noDefLeague = scorePlayers(players, {
      rosterPositions: ["QB", "RB", "WR", "TE", "BN"],
      currentPickNumber: 170
    });

    const earlyDef = findPlayer(early.scoredPlayers, "Top DEF");
    const lateDef = findPlayer(late.scoredPlayers, "Top DEF");
    const noLeagueDef = findPlayer(noDefLeague.scoredPlayers, "Top DEF");

    expect(earlyDef.recommendationTier).not.toBe("elite_target");
    expect(earlyDef.warnings).toContain("No schedule or matchup data for DEF");
    expect(earlyDef.reasons.join(" ").toLowerCase()).not.toContain("matchup");
    expect(earlyDef.reasons.join(" ").toLowerCase()).not.toContain("schedule");

    expect(["good_value", "strong_target"]).toContain(lateDef.recommendationTier);
    expect(lateDef.recommendationTier).not.toBe("elite_target");
    expect(lateDef.scoreComponents?.rosterNeedScore).toBeGreaterThan(earlyDef.scoreComponents?.rosterNeedScore ?? 0);

    expect(noLeagueDef.recommendationTier).toBe("avoid_for_now");
    expect(noLeagueDef.warnings).toContain("DEF is not used by this league.");
  });

  it("surfaces direct IDP deficits, partial fills, and filled-group depth correctly", () => {
    const players = [
      makePlayer({ player_name: "Thin DL", position: "DL", rank: 20, adp: 95, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Anchor LB", position: "LB", rank: 22, adp: 96, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Ballhawk DB", position: "DB", rank: 24, adp: 100, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Depth LB", position: "LB", rank: 30, adp: 110, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null })
    ];
    const rosterPositions = ["DL", "DL", "LB", "LB", "DB", "DB", "BN"];

    const empty = scorePlayers(players, {
      rosterPositions,
      currentPickNumber: 95,
      scoringSettings: { solo_tkl: 2 }
    });
    const partial = scorePlayers(players, {
      rosterPositions,
      currentPickNumber: 95,
      positionCounts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, DL: 0, LB: 1, DB: 0 },
      scoringSettings: { solo_tkl: 2 }
    });
    const filled = scorePlayers(players, {
      rosterPositions,
      currentPickNumber: 150,
      positionCounts: { QB: 1, RB: 2, WR: 3, TE: 1, K: 0, DEF: 0, DL: 2, LB: 2, DB: 1 },
      scoringSettings: { solo_tkl: 2 }
    });

    const emptyLb = findPlayer(empty.scoredPlayers, "Anchor LB");
    const partialLb = findPlayer(partial.scoredPlayers, "Anchor LB");
    const filledLb = findPlayer(filled.scoredPlayers, "Anchor LB");

    expect(empty.recommendations.map((player) => player.position)).toContain("LB");
    expect(emptyLb.reasons).toContain("Direct defensive starter still unfilled");
    expect(emptyLb.warnings).toContain("Rankings-only defensive evaluation");
    expect(emptyLb.warnings).toContain("No league-specific IDP stat model yet");

    expect(partialLb.scoreComponents?.rosterNeedScore).toBeLessThan(emptyLb.scoreComponents?.rosterNeedScore ?? 100);
    expect(partialLb.scoreComponents?.rosterNeedScore).toBeGreaterThan(0);

    expect(filledLb.scoreComponents?.rosterNeedScore).toBeLessThan(partialLb.scoreComponents?.rosterNeedScore ?? 100);
    expect(filledLb.reasons).not.toContain("Direct defensive starter still unfilled");
    expect(filledLb.recommendationTier).not.toBe("avoid_for_now");
  });

  it("handles IDP-flex-only demand without inventing direct starter needs", () => {
    const players = [
      makePlayer({ player_name: "Thin DL", position: "DL", rank: 18, adp: 88, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Balanced LB", position: "LB", rank: 19, adp: 89, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Deep DB", position: "DB", rank: 18, adp: 90, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      ...Array.from({ length: 9 }, (_, index) =>
        makePlayer({ player_name: `Extra DL ${index}`, position: "DL", rank: 40 + index, adp: 120 + index, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null })
      ),
      ...Array.from({ length: 24 }, (_, index) =>
        makePlayer({ player_name: `Extra DB ${index}`, position: "DB", rank: 60 + index, adp: 150 + index, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null })
      )
    ];

    const result = scorePlayers(players, {
      rosterPositions: ["IDP", "IDP_FLEX", "BN"],
      currentPickNumber: 115
    });

    const thinDl = findPlayer(result.scoredPlayers, "Thin DL");
    const deepDb = findPlayer(result.scoredPlayers, "Deep DB");

    expect(result.topNeeds.some((need) => need.sharedFlexDemand === 2)).toBe(true);
    expect(thinDl.reasons).toContain("Fills an open IDP-flex need");
    expect(thinDl.reasons).not.toContain("Direct defensive starter still unfilled");
    expect(thinDl.scoreComponents?.scarcityScore).toBeGreaterThan(deepDb.scoreComponents?.scarcityScore ?? 100);
    expect((thinDl.draftTargetScore ?? 0) >= (deepDb.draftTargetScore ?? 100)).toBe(true);
  });

  it("suppresses low-confidence, ambiguous, unmatched, and fallback players", () => {
    const exact = makePlayer({ player_name: "Exact DL", position: "DL", rank: 21, adp: 94, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null });
    const fuzzy = makePlayer({ player_name: "Fuzzy DL", position: "DL", rank: 21, adp: 94, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null, match_status: "fuzzy", match_confidence: 0.7 });
    const ambiguous = makePlayer({ player_name: "Ambiguous DL", position: "DL", rank: 21, adp: 94, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null, match_status: "ambiguous", matched_player_id: null });
    const unmatched = makePlayer({ player_name: "Unmatched DL", position: "DL", rank: 21, adp: 94, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null, match_status: "unmatched", matched_player_id: null });
    const fallback = makePlayer({ player_name: "Fallback DL", position: "DL", rank: null, adp: null, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null, is_ranked: false, is_fallback: true, matched_player_id: null, sleeper_player_id: null, match_status: null, match_confidence: null });

    const result = scorePlayers([exact, fuzzy, ambiguous, unmatched, fallback], {
      rosterPositions: ["DL", "BN"],
      currentPickNumber: 120
    });

    const exactPlayer = findPlayer(result.scoredPlayers, "Exact DL");
    const fuzzyPlayer = findPlayer(result.scoredPlayers, "Fuzzy DL");
    const ambiguousPlayer = findPlayer(result.scoredPlayers, "Ambiguous DL");
    const unmatchedPlayer = findPlayer(result.scoredPlayers, "Unmatched DL");
    const fallbackPlayer = findPlayer(result.scoredPlayers, "Fallback DL");

    expect(exactPlayer.scoreComponents?.matchConfidencePenalty).toBe(0);
    expect(fuzzyPlayer.scoreComponents?.matchConfidencePenalty).toBeGreaterThan(0);
    expect(fuzzyPlayer.warnings.some((warning) => warning.includes("match"))).toBe(true);
    expect((fuzzyPlayer.draftTargetScore ?? 0) < (exactPlayer.draftTargetScore ?? 0)).toBe(true);

    expect(ambiguousPlayer.recommendationTier).toBe("avoid_for_now");
    expect(ambiguousPlayer.warnings).toContain("Ambiguous player match");
    expect(unmatchedPlayer.recommendationTier).toBe("avoid_for_now");
    expect(unmatchedPlayer.warnings).toContain("Unmatched ranking row");
    expect(fallbackPlayer.recommendationTier).toBe("avoid_for_now");
    expect(fallbackPlayer.warnings).toContain("Upload rankings for true recommendations.");
    expect(result.recommendations.map((player) => player.player_name)).not.toContain("Fallback DL");
  });

  it("marks rankings-only completeness and avoids unsupported reason claims", () => {
    const players = [
      makePlayer({ player_name: "IDP LB", position: "LB", rank: 22, adp: 92, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Kicker One", position: "K", rank: 3, adp: 175, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Defense One", position: "DEF", rank: 2, adp: 168, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
      makePlayer({ player_name: "Wideout One", position: "WR", rank: 14, adp: 18, projected_points: 220, dynasty_value: 76 })
    ];

    const result = scorePlayers(players, {
      rosterPositions: ["LB", "K", "DEF", "WR", "BN"],
      currentPickNumber: 145,
      scoringSettings: { solo_tkl: 2 }
    });

    const idp = findPlayer(result.scoredPlayers, "IDP LB");
    const kicker = findPlayer(result.scoredPlayers, "Kicker One");
    const defense = findPlayer(result.scoredPlayers, "Defense One");
    const receiver = findPlayer(result.scoredPlayers, "Wideout One");

    expect(idp.inputCompleteness).toBe("rankings_only");
    expect(kicker.inputCompleteness).toBe("rankings_only");
    expect(defense.inputCompleteness).toBe("rankings_only");
    expect(receiver.inputCompleteness).not.toBe("rankings_only");
    expect(idp.warnings).toContain("Rankings-only defensive evaluation");
    expect(kicker.warnings).toContain("No kicker projection inputs");
    expect(defense.warnings).toContain("No schedule or matchup data for DEF");

    for (const player of [idp, kicker, defense]) {
      const reasonText = player.reasons.join(" ").toLowerCase();
      for (const term of unsupportedReasonTerms) {
        expect(reasonText).not.toContain(term);
      }
    }
  });

  it("maintains score and tier invariants across all scored players", () => {
    const result = scorePlayers(
      [
        makePlayer({ player_name: "QB One", position: "QB", rank: 7, adp: 14, projected_points: 300, superflex_value: 78 }),
        makePlayer({ player_name: "RB One", position: "RB", rank: 9, adp: 17, projected_points: 215, dynasty_value: 77 }),
        makePlayer({ player_name: "WR One", position: "WR", rank: 11, adp: 16, projected_points: 225, dynasty_value: 79 }),
        makePlayer({ player_name: "TE One", position: "TE", rank: 18, adp: 28, projected_points: 170, te_premium_value: 70 }),
        makePlayer({ player_name: "LB One", position: "LB", rank: 25, adp: 104, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null }),
        makePlayer({ player_name: "Defense One", position: "DEF", rank: 4, adp: 170, projected_points: null, dynasty_value: null, best_ball_value: null, superflex_value: null, te_premium_value: null })
      ],
      {
        rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "LB", "DEF", "BN"],
        currentPickNumber: 132
      }
    );

    for (const player of result.scoredPlayers) {
      expectScoreInvariant(player);
    }
  });
});
