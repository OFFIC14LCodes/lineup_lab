import type { SuggestedDraftSpot, SuggestedDraftSpotInput, SuggestedDraftSpotLabel, SuggestedDraftSpotRisk } from "./suggested-draft-spot-types";

export function buildSuggestedDraftSpot(input: SuggestedDraftSpotInput): SuggestedDraftSpot {
  const teamCount = validPositiveInteger(input.teamCount) ?? 12;
  const blackbirdRank = validPositiveInteger(input.blackbirdRank);
  const marketAdp = validPositiveNumber(input.marketAdp);
  const currentPick = validPositiveInteger(input.currentPick);
  const picksUntilNextTurn = typeof input.picksUntilNextTurn === "number" && Number.isFinite(input.picksUntilNextTurn)
    ? Math.max(0, Math.round(input.picksUntilNextTurn))
    : null;

  if (!blackbirdRank) {
    return {
      pickMin: null,
      pickMax: null,
      round: null,
      label: "unknown",
      marketEdgePicks: null,
      reachRisk: "unknown",
      waitRisk: "unknown",
      reason: "Blackbird rank is unavailable, so draft timing cannot be estimated.",
    };
  }

  if (!marketAdp) {
    const range = rangeAround(blackbirdRank, teamCount, teamCount);
    return withLiveTiming({
      spot: {
        ...range,
        round: roundForPick(range.pickMin, teamCount),
        label: "unknown",
        marketEdgePicks: null,
        reachRisk: "unknown",
        waitRisk: "unknown",
        reason: "Market ADP is unavailable; this range falls back to Blackbird rank plus one round of cushion.",
      },
      currentPick,
      picksUntilNextTurn,
      blackbirdRank,
      marketAdp: null,
      tierRisk: input.tierRisk,
      trustLabel: input.trustLabel,
    });
  }

  const marketPick = Math.round(marketAdp);
  const edge = marketPick - blackbirdRank;
  const absEdge = Math.abs(edge);
  const roundBuffer = Math.max(4, Math.round(teamCount * 0.75));

  let pickMin: number | null;
  let pickMax: number | null;
  let label: SuggestedDraftSpotLabel;
  let reason: string;

  if (edge >= 18) {
    pickMin = Math.max(1, Math.round(marketPick - roundBuffer));
    pickMax = Math.max(pickMin, marketPick - 3);
    label = edge >= 36 ? "value_if_falls" : "wait_for_value";
    reason = "Blackbird values this player above market, so the timing target waits until shortly before ADP instead of forcing the Blackbird rank.";
  } else if (edge >= 8) {
    pickMin = Math.max(1, Math.round(marketPick - Math.max(3, Math.round(teamCount / 2))));
    pickMax = Math.max(pickMin, marketPick);
    label = "target_next_round";
    reason = "Blackbird has a timing edge versus market, so target the player near the market window.";
  } else if (edge <= -24) {
    pickMin = null;
    pickMax = null;
    label = "avoid";
    reason = "Market cost is far richer than Blackbird value; only revisit if the player falls well past ADP.";
  } else if (edge <= -8) {
    pickMin = null;
    pickMax = null;
    label = "do_not_reach";
    reason = "Market is taking this player earlier than Blackbird value supports, so avoid chasing the market price.";
  } else {
    const anchor = Math.min(blackbirdRank, marketPick);
    pickMin = Math.max(1, anchor - Math.max(2, Math.round(teamCount / 4)));
    pickMax = Math.max(pickMin, Math.max(blackbirdRank, marketPick));
    label = "target_this_round";
    reason = absEdge <= 3
      ? "Blackbird value and market ADP are aligned, so the timing window stays close to rank."
      : "Blackbird value and market ADP are close enough to target the earlier practical window.";
  }

  return withLiveTiming({
    spot: {
      pickMin,
      pickMax,
      round: roundForPick(pickMin, teamCount),
      label,
      marketEdgePicks: edge,
      reachRisk: reachRiskFor(edge, input.trustLabel),
      waitRisk: waitRiskFor(edge, input.tierRisk, input.trustLabel),
      reason,
    },
    currentPick,
    picksUntilNextTurn,
    blackbirdRank,
    marketAdp: marketPick,
    tierRisk: input.tierRisk,
    trustLabel: input.trustLabel,
  });
}

function withLiveTiming(input: {
  spot: SuggestedDraftSpot;
  currentPick: number | null;
  picksUntilNextTurn: number | null;
  blackbirdRank: number;
  marketAdp: number | null;
  tierRisk?: string | null;
  trustLabel?: string | null;
}): SuggestedDraftSpot {
  if (!input.currentPick || input.spot.pickMax === null) return input.spot;
  const nextTurnPick = input.picksUntilNextTurn === null ? null : input.currentPick + input.picksUntilNextTurn;
  const tierRiskHigh = normalized(input.tierRisk) === "high";
  const trustLow = ["low", "very_low"].includes(normalized(input.trustLabel));
  if (input.spot.label !== "do_not_reach" && input.spot.label !== "avoid") {
    if (input.spot.pickMax <= input.currentPick + 1 && !trustLow) {
      return {
        ...input.spot,
        label: "take_now",
        waitRisk: "high",
        reason: `${input.spot.reason} Current pick context says the target window is open now.`,
      };
    }
    if (nextTurnPick !== null && input.spot.pickMax <= nextTurnPick && (tierRiskHigh || input.blackbirdRank <= 24) && !trustLow) {
      return {
        ...input.spot,
        label: "take_now",
        waitRisk: "high",
        reason: `${input.spot.reason} The player is unlikely to survive to your next turn.`,
      };
    }
    if (nextTurnPick !== null && input.spot.pickMin !== null && input.spot.pickMin <= nextTurnPick && input.spot.label === "target_next_round") {
      return {
        ...input.spot,
        label: "target_this_round",
        waitRisk: input.spot.waitRisk === "low" ? "medium" : input.spot.waitRisk,
        reason: `${input.spot.reason} Your next-turn window is close enough to monitor this round.`,
      };
    }
  }
  return input.spot;
}

function reachRiskFor(edge: number, trustLabel?: string | null): SuggestedDraftSpotRisk {
  if (edge <= -24) return "high";
  if (edge <= -8) return "medium";
  if (["low", "very_low"].includes(normalized(trustLabel))) return "medium";
  return "low";
}

function waitRiskFor(edge: number, tierRisk?: string | null, trustLabel?: string | null): SuggestedDraftSpotRisk {
  if (normalized(tierRisk) === "high") return "high";
  if (edge <= -8) return "low";
  if (edge >= 30) return "low";
  if (edge >= 12) return "medium";
  if (["low", "very_low"].includes(normalized(trustLabel))) return "medium";
  return "low";
}

function rangeAround(anchor: number, below: number, above: number): { pickMin: number; pickMax: number } {
  return {
    pickMin: Math.max(1, anchor - below),
    pickMax: Math.max(1, anchor + above),
  };
}

function roundForPick(pick: number | null, teamCount: number): number | null {
  return pick === null ? null : Math.max(1, Math.ceil(pick / teamCount));
}

function validPositiveInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function validPositiveNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}
