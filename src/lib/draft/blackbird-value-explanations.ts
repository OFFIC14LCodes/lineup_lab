import type { BlackbirdLeagueRankRow } from "@/lib/draft/blackbird-league-rank";

export type BlackbirdValueExplanation = {
  playerId: string;
  summary: string;
  primaryDrivers: Array<{
    label: string;
    sentiment: "positive" | "neutral" | "negative" | "caution";
    explanation: string;
  }>;
  dataGaps: string[];
  cautions: string[];
};

export function buildBlackbirdValueExplanation(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation {
  const drivers: BlackbirdValueExplanation["primaryDrivers"] = [
    projectionDriver(row),
    trustDriver(row),
    parDriver(row),
    scarcityDriver(row),
    roleDriver(row),
    formatDriver(row),
    ageDriver(row),
    riskDriver(row),
  ].filter((driver): driver is BlackbirdValueExplanation["primaryDrivers"][number] => Boolean(driver));
  const cautions = [
    row.source.fallbackProjection ? "Fallback projection limits confidence." : null,
    row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low" ? `Projection trust is ${row.projectionTrust.trustLabel.replace("_", " ")}.` : null,
    ["backup", "deep_reserve", "rookie_unknown", "unknown"].includes(row.roleClassification.role) ? `Role is ${row.roleClassification.role.replace(/_/g, " ")} by projection-volume proxy.` : null,
    row.replacementValue.replacementMedianPoints === null ? "Replacement baseline is unavailable." : null,
  ].filter((item): item is string => Boolean(item));
  const summary = `${row.playerName} is Blackbird Rank #${row.blackbirdRank} with ${row.leagueValueScore.toFixed(1)}/100 static value. ${drivers[0]?.explanation ?? "Value uses available projection, role, replacement, and format signals."}`;
  return {
    playerId: row.playerId,
    summary,
    primaryDrivers: drivers,
    dataGaps: row.dataGaps,
    cautions,
  };
}

function projectionDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  if (row.projectedFantasyPoints.median === null) {
    return { label: "Projection", sentiment: "negative", explanation: "Season projection is unavailable and is not treated as zero." };
  }
  return {
    label: "Projection",
    sentiment: row.projectedFantasyPoints.scoringAware ? "positive" : "caution",
    explanation: `${row.projectedFantasyPoints.median.toFixed(1)} season median points from ${row.projectedFantasyPoints.source.replace(/_/g, " ")}.`,
  };
}

function trustDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  const label = row.projectionTrust.trustLabel;
  return {
    label: "Projection Trust",
    sentiment: label === "high" || label === "medium" ? "positive" : "caution",
    explanation: `Projection trust is ${label.replace("_", " ")} with score ${row.projectionTrust.trustScore}/100.`,
  };
}

function parDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  if (row.pointsAboveReplacement === null) return { label: "PAR", sentiment: "caution", explanation: "PAR is unavailable because the replacement baseline is incomplete." };
  const sentiment = row.pointsAboveReplacement > 20 ? "positive" : row.pointsAboveReplacement < 0 ? "negative" : "neutral";
  return {
    label: "PAR",
    sentiment,
    explanation: `${row.pointsAboveReplacement.toFixed(1)} points above ${row.position} replacement baseline (${row.replacementValue.replacementMedianPoints?.toFixed(1) ?? "unknown"}).`,
  };
}

function scarcityDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  const scarcity = row.valueComponents.positionScarcity;
  return {
    label: "Scarcity",
    sentiment: scarcity >= 65 ? "positive" : scarcity <= 35 ? "negative" : "neutral",
    explanation: `${row.position} scarcity component is ${scarcity.toFixed(1)}/100 after replacement calibration.`,
  };
}

function roleDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  return {
    label: "Role",
    sentiment: row.roleClassification.confidence === "low" || row.roleClassification.confidence === "very_low" ? "caution" : "neutral",
    explanation: `Role proxy is ${row.roleClassification.role.replace(/_/g, " ")} with ${row.roleClassification.confidence.replace("_", " ")} confidence.`,
  };
}

function formatDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  const fit = (row.valueComponents.rosterFormatFit + row.valueComponents.leagueFormatFit) / 2;
  return {
    label: "Format Fit",
    sentiment: fit >= 65 ? "positive" : fit <= 35 ? "negative" : "neutral",
    explanation: `Roster and league format fit average ${fit.toFixed(1)}/100.`,
  };
}

function ageDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  return {
    label: "Age/Format",
    sentiment: row.valueComponents.ageCurve >= 62 ? "positive" : row.valueComponents.ageCurve <= 42 ? "caution" : "neutral",
    explanation: `Age curve component is ${row.valueComponents.ageCurve.toFixed(1)}/100 where available.`,
  };
}

function riskDriver(row: BlackbirdLeagueRankRow): BlackbirdValueExplanation["primaryDrivers"][number] {
  return {
    label: "Risk",
    sentiment: row.risk === "low" ? "neutral" : "caution",
    explanation: `Risk label is ${row.risk}; confidence label is ${row.confidence}.`,
  };
}
