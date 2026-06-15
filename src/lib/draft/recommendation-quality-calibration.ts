import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import { WAR_ROOM_RECOMMENDATION_CALIBRATION } from "@/lib/draft/war-room-recommendations";

export type RecommendationQualityRoomInput = {
  source: "live" | "validation_seed" | "fixture" | "scenario";
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  rows: WarRoomRecommendationRow[];
};

export type RecommendationQualityRowAudit = {
  recommendationRank: number;
  displayName: string;
  position: string | null;
  recommendationScore: number;
  recommendationTier: string;
  status: string;
  needTimingAction: string;
  componentBreakdown: {
    projectionValue: number;
    marketAdpValue: number;
    positionalScarcity: number;
    rosterNeed: number;
    needTiming: number;
    confidenceRiskAdjustment: number;
    tierDropRisk: number;
    futureAvailability: number;
    opportunityCost: number;
  };
  dominantComponents: string[];
  explanationQuality: {
    hasValueReason: boolean;
    hasNeedReason: boolean;
    hasTimingReason: boolean;
    hasRiskCaveat: boolean;
    bannedLanguage: string[];
  };
  guardrailFindings: string[];
};

export type RecommendationQualityRoomAudit = {
  source: RecommendationQualityRoomInput["source"];
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  rowCount: number;
  componentAverages: RecommendationQualityRowAudit["componentBreakdown"];
  dominantComponentCounts: Record<string, number>;
  topRecommendationExamples: RecommendationQualityRowAudit[];
  topExplanationExamples: Array<{ displayName: string; explanation: string }>;
  confidenceRiskFindings: string[];
  specialTeamsCautionFindings: string[];
  idpCautionFindings: string[];
  stabilityFindings: string[];
  safetyFindings: string[];
};

export type RecommendationQualityCalibrationArtifact = {
  generatedAt: string;
  artifactVersion: "h10.12-recommendation-quality-calibration-v1";
  rooms: RecommendationQualityRoomAudit[];
  aggregate: {
    roomsEvaluated: number;
    rowsAudited: number;
    dominantComponentCounts: Record<string, number>;
    confidenceRiskFindingCount: number;
    specialTeamsCautionFindingCount: number;
    idpCautionFindingCount: number;
    stabilityFindingCount: number;
    safetyFindingCount: number;
    verdict: "ready" | "needs_revision" | "blocked_by_insufficient_data";
  };
  knownLimitations: string[];
};

const BANNED_LANGUAGE = ["must draft", "guaranteed", "ai says", "ai advice", "best pick", "you should draft"];
const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const SPECIAL_TEAMS_POSITIONS = new Set(["K", "DEF"]);

export function buildRecommendationQualityCalibrationArtifact(input: {
  generatedAt: string;
  rooms: RecommendationQualityRoomInput[];
}): RecommendationQualityCalibrationArtifact {
  const rooms = input.rooms.map(auditRoom);
  const rowsAudited = rooms.reduce((sum, room) => sum + room.rowCount, 0);
  const dominantComponentCounts = mergeCounts(rooms.map((room) => room.dominantComponentCounts));
  const confidenceRiskFindingCount = rooms.reduce((sum, room) => sum + room.confidenceRiskFindings.length, 0);
  const specialTeamsCautionFindingCount = rooms.reduce((sum, room) => sum + room.specialTeamsCautionFindings.length, 0);
  const idpCautionFindingCount = rooms.reduce((sum, room) => sum + room.idpCautionFindings.length, 0);
  const stabilityFindingCount = rooms.reduce((sum, room) => sum + room.stabilityFindings.length, 0);
  const safetyFindingCount = rooms.reduce((sum, room) => sum + room.safetyFindings.length, 0);
  const hardFailures = safetyFindingCount + confidenceRiskFindingCount + specialTeamsCautionFindingCount + idpCautionFindingCount;

  return {
    generatedAt: input.generatedAt,
    artifactVersion: "h10.12-recommendation-quality-calibration-v1",
    rooms,
    aggregate: {
      roomsEvaluated: rooms.length,
      rowsAudited,
      dominantComponentCounts,
      confidenceRiskFindingCount,
      specialTeamsCautionFindingCount,
      idpCautionFindingCount,
      stabilityFindingCount,
      safetyFindingCount,
      verdict: rowsAudited === 0 ? "blocked_by_insufficient_data" : hardFailures > 0 ? "needs_revision" : "ready",
    },
    knownLimitations: [
      "Calibration evaluates deterministic Blackbird experimental rows only; it does not claim draft outcome quality.",
      "Stability diagnostics compare score/rank shape within available validation snapshots, not live future draft outcomes.",
      "IDP/K/DST rows remain low-confidence or dry-run sources where upstream projection quality is intentionally conservative.",
    ],
  };
}

export function auditRecommendationRow(row: WarRoomRecommendationRow): RecommendationQualityRowAudit {
  const componentBreakdown = componentBreakdownFor(row);
  const dominantComponents = dominantComponentsFor(componentBreakdown);
  const explanationText = [row.primaryReason, ...row.explanationFragments, ...row.needTimingReasons].join(" ");
  const lowerExplanation = explanationText.toLowerCase();
  const bannedLanguage = BANNED_LANGUAGE.filter((term) => lowerExplanation.includes(term));
  const guardrailFindings = guardrailFindingsFor(row);

  return {
    recommendationRank: row.recommendationRank,
    displayName: row.displayName,
    position: row.position,
    recommendationScore: row.recommendationScore,
    recommendationTier: row.recommendationTier,
    status: row.status,
    needTimingAction: row.needTimingAction,
    componentBreakdown,
    dominantComponents,
    explanationQuality: {
      hasValueReason: /value|replacement|market/i.test(explanationText),
      hasNeedReason: /need|roster|fit/i.test(explanationText),
      hasTimingReason: /timing|available|next pick|window/i.test(explanationText),
      hasRiskCaveat: /risk|confidence|dry-run|wide/i.test(explanationText),
      bannedLanguage,
    },
    guardrailFindings,
  };
}

export function compareRecommendationStability(input: {
  before: WarRoomRecommendationRow[];
  after: WarRoomRecommendationRow[];
}): string[] {
  const findings: string[] = [];
  const afterByEntity = new Map(input.after.map((row) => [row.entityId ?? row.displayName, row]));
  for (const before of input.before.slice(0, 15)) {
    const key = before.entityId ?? before.displayName;
    const after = afterByEntity.get(key);
    if (!after) {
      findings.push(`${before.displayName}: recommendation churn; row disappeared from comparison set.`);
      continue;
    }
    const rankDelta = Math.abs(after.recommendationRank - before.recommendationRank);
    const scoreDelta = Math.abs(after.recommendationScore - before.recommendationScore);
    if (rankDelta >= WAR_ROOM_RECOMMENDATION_CALIBRATION.guardrails.largeRankJump) {
      findings.push(`${before.displayName}: large rank jump ${before.recommendationRank} -> ${after.recommendationRank}.`);
    }
    if (scoreDelta >= WAR_ROOM_RECOMMENDATION_CALIBRATION.guardrails.unstableScoreDelta) {
      findings.push(`${before.displayName}: unstable score change ${before.recommendationScore} -> ${after.recommendationScore}.`);
    }
    if (before.needTimingAction !== after.needTimingAction) {
      findings.push(`${before.displayName}: need timing movement ${before.needTimingAction} -> ${after.needTimingAction}.`);
    }
  }
  return findings;
}

function auditRoom(room: RecommendationQualityRoomInput): RecommendationQualityRoomAudit {
  const rowAudits = room.rows.map(auditRecommendationRow);
  const componentAverages = averageBreakdowns(rowAudits.map((audit) => audit.componentBreakdown));
  const dominantComponentCounts = countBy(rowAudits.flatMap((audit) => audit.dominantComponents));
  const topRows = rowAudits.slice(0, 10);
  const closeTop = room.rows.length >= 2 && Math.abs(room.rows[0].recommendationScore - room.rows[1].recommendationScore) <= WAR_ROOM_RECOMMENDATION_CALIBRATION.guardrails.closeScoreMargin;
  const stabilityFindings = closeTop
    ? [`Top recommendation margin is ${Math.abs(room.rows[0].recommendationScore - room.rows[1].recommendationScore).toFixed(1)} points; treat top-row ordering as close.`]
    : [];

  return {
    source: room.source,
    draftRoomId: room.draftRoomId,
    leagueId: room.leagueId,
    leagueName: room.leagueName,
    rowCount: rowAudits.length,
    componentAverages,
    dominantComponentCounts,
    topRecommendationExamples: topRows,
    topExplanationExamples: room.rows.slice(0, 5).map((row) => ({
      displayName: row.displayName,
      explanation: [row.primaryReason, ...row.explanationFragments.slice(1, 3), ...row.needTimingReasons.slice(0, 1)].join(" "),
    })),
    confidenceRiskFindings: rowAudits.flatMap((audit) => audit.guardrailFindings.filter((finding) => finding.startsWith("confidence:"))),
    specialTeamsCautionFindings: rowAudits.flatMap((audit) => audit.guardrailFindings.filter((finding) => finding.startsWith("special_teams:"))),
    idpCautionFindings: rowAudits.flatMap((audit) => audit.guardrailFindings.filter((finding) => finding.startsWith("idp:"))),
    stabilityFindings,
    safetyFindings: rowAudits.flatMap((audit) => audit.explanationQuality.bannedLanguage.map((term) => `${audit.displayName}: banned language ${term}`)),
  };
}

function componentBreakdownFor(row: WarRoomRecommendationRow): RecommendationQualityRowAudit["componentBreakdown"] {
  return {
    projectionValue: round(row.scoreComponents.leagueValue),
    marketAdpValue: round(row.scoreComponents.marketValue + row.scoreComponents.availabilityRisk),
    positionalScarcity: round(row.scoreComponents.scarcity),
    rosterNeed: round(row.scoreComponents.rosterNeed),
    needTiming: round(row.scoreComponents.needTiming),
    confidenceRiskAdjustment: round(row.scoreComponents.confidencePenalty + row.scoreComponents.formatPenalty),
    tierDropRisk: round(row.scoreComponents.tierCliff),
    futureAvailability: round(row.scoreComponents.availabilityRisk),
    opportunityCost: row.opportunityCost === "high" ? Math.abs(Math.min(0, row.scoreComponents.needTiming)) : 0,
  };
}

function dominantComponentsFor(breakdown: RecommendationQualityRowAudit["componentBreakdown"]): string[] {
  const positiveEntries = Object.entries(breakdown).filter(([key, value]) => key !== "confidenceRiskAdjustment" && value > 0);
  const total = positiveEntries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return [];
  return positiveEntries
    .filter(([, value]) => value / total >= WAR_ROOM_RECOMMENDATION_CALIBRATION.guardrails.dominantComponentShareWarning)
    .map(([key]) => key);
}

function guardrailFindingsFor(row: WarRoomRecommendationRow): string[] {
  const findings: string[] = [];
  const position = normalizePosition(row.position);
  const lowConfidence = row.h10.confidenceLabel === "low" || row.h10.confidenceLabel === "very_low" || row.warningCodes.includes("LOW_PROJECTION_CONFIDENCE");
  if (lowConfidence && row.recommendationTier === "priority_target") {
    findings.push(`confidence:${row.displayName} low-confidence row reached priority target.`);
  }
  if (SPECIAL_TEAMS_POSITIONS.has(position) && (row.draftContext.currentRound ?? 1) < 13 && (row.recommendationTier === "priority_target" || row.recommendationTier === "strong_target")) {
    findings.push(`special_teams:${row.displayName} ${position} surfaced aggressively before late rounds.`);
  }
  if (IDP_POSITIONS.has(position) && lowConfidence && row.recommendationTier === "priority_target") {
    findings.push(`idp:${row.displayName} low-confidence IDP row overstated as priority target.`);
  }
  return findings;
}

function averageBreakdowns(rows: RecommendationQualityRowAudit["componentBreakdown"][]): RecommendationQualityRowAudit["componentBreakdown"] {
  if (!rows.length) {
    return {
      projectionValue: 0,
      marketAdpValue: 0,
      positionalScarcity: 0,
      rosterNeed: 0,
      needTiming: 0,
      confidenceRiskAdjustment: 0,
      tierDropRisk: 0,
      futureAvailability: 0,
      opportunityCost: 0,
    };
  }
  const totals = rows.reduce((acc, row) => {
    for (const [key, value] of Object.entries(row)) {
      acc[key as keyof typeof row] += value;
    }
    return acc;
  }, averageBreakdowns([]));
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value / rows.length)])) as RecommendationQualityRowAudit["componentBreakdown"];
}

function mergeCounts(counts: Array<Record<string, number>>): Record<string, number> {
  return counts.reduce<Record<string, number>>((acc, count) => {
    for (const [key, value] of Object.entries(count)) acc[key] = (acc[key] ?? 0) + value;
    return acc;
  }, {});
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
