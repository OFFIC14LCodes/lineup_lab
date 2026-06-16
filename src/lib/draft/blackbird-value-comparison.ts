import type { BlackbirdLeagueRankRow } from "@/lib/draft/blackbird-league-rank";

export type BlackbirdValueComparison = {
  playerAId: string;
  playerBId: string;
  preferredPlayerId: string | null;
  summary: string;
  decidingFactors: Array<{
    factor: string;
    playerAValue: string;
    playerBValue: string;
    edge: "playerA" | "playerB" | "neutral";
    explanation: string;
  }>;
  dataGaps: string[];
};

export function compareBlackbirdValues(playerA: BlackbirdLeagueRankRow, playerB: BlackbirdLeagueRankRow): BlackbirdValueComparison {
  const factors = [
    factor("Static Value", playerA.leagueValueScore, playerB.leagueValueScore, "Higher calibrated static value."),
    factor("Projection", playerA.projectedFantasyPoints.median, playerB.projectedFantasyPoints.median, "Higher season median projection."),
    factor("Floor", playerA.projectedFantasyPoints.floor, playerB.projectedFantasyPoints.floor, "Higher season floor projection."),
    factor("Ceiling", playerA.projectedFantasyPoints.ceiling, playerB.projectedFantasyPoints.ceiling, "Higher season ceiling projection."),
    factor("PAR", playerA.pointsAboveReplacement, playerB.pointsAboveReplacement, "Higher points above replacement."),
    factor("Projection Trust", playerA.projectionTrust.trustScore, playerB.projectionTrust.trustScore, "Higher projection trust."),
    factor("Scarcity", playerA.valueComponents.positionScarcity, playerB.valueComponents.positionScarcity, "Higher calibrated scarcity."),
    factor("Format Fit", formatFit(playerA), formatFit(playerB), "Better league and roster format fit."),
  ];
  const aEdges = factors.filter((item) => item.edge === "playerA").length;
  const bEdges = factors.filter((item) => item.edge === "playerB").length;
  const preferredPlayerId = playerA.leagueValueScore === playerB.leagueValueScore ? null : playerA.leagueValueScore > playerB.leagueValueScore ? playerA.playerId : playerB.playerId;
  return {
    playerAId: playerA.playerId,
    playerBId: playerB.playerId,
    preferredPlayerId,
    summary: preferredPlayerId === null
      ? `${playerA.playerName} and ${playerB.playerName} are effectively tied by calibrated value.`
      : `${preferredPlayerId === playerA.playerId ? playerA.playerName : playerB.playerName} is preferred by calibrated static value; factor edges ${aEdges}-${bEdges}.`,
    decidingFactors: factors,
    dataGaps: Array.from(new Set([...playerA.dataGaps, ...playerB.dataGaps])).sort(),
  };
}

function factor(
  name: string,
  a: number | null,
  b: number | null,
  explanation: string
): BlackbirdValueComparison["decidingFactors"][number] {
  const edge = a === null || b === null || Math.abs(a - b) < 0.01 ? "neutral" : a > b ? "playerA" : "playerB";
  return {
    factor: name,
    playerAValue: a === null ? "unavailable" : a.toFixed(1),
    playerBValue: b === null ? "unavailable" : b.toFixed(1),
    edge,
    explanation,
  };
}

function formatFit(row: BlackbirdLeagueRankRow): number {
  return (row.valueComponents.rosterFormatFit + row.valueComponents.leagueFormatFit) / 2;
}
