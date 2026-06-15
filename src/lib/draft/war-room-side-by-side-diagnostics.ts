import { DEFAULT_H10_RECOMMENDATION_SOURCE, H10_RECOMMENDATION_READINESS_LABELS } from "@/lib/draft/war-room-recommendation-experiment-ui";

export type H10SideBySideDifferenceClassification =
  | "SAME_TARGET"
  | "SIMILAR_POSITION_DIFFERENT_PLAYER"
  | "BLACKBIRD_HIGHER_VALUE"
  | "LEGACY_HIGHER_SCORE"
  | "BLACKBIRD_HAS_PROJECTION_LEGACY_MISSING"
  | "LEGACY_HAS_ROW_BLACKBIRD_INSUFFICIENT_DATA"
  | "FORMAT_OR_CONFIDENCE_SUPPRESSION";

export type H10SideBySideLegacyRow = {
  player_name: string | null;
  position: string | null;
  recommendationTier?: string | null;
  draftTargetScore: number | null;
};

export type H10SideBySideBlackbirdRow = {
  displayName: string;
  position: string | null;
  team?: string | null;
  recommendationRank: number;
  recommendationTier: string;
  recommendationScore: number;
  status: string;
  primaryReason?: string;
  warningCodes?: string[];
  scoreComponents?: {
    leagueValue?: number;
    rosterNeed?: number;
    scarcity?: number;
    tierCliff?: number;
    marketValue?: number;
    availabilityRisk?: number;
    confidencePenalty?: number;
    formatPenalty?: number;
  };
};

export type H10SideBySideRoomInput = {
  source: "live" | "validation_seed" | "fixture" | string;
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  legacyRecommendationTopRows: H10SideBySideLegacyRow[];
  topRecommendations: H10SideBySideBlackbirdRow[];
  warningCounts: Record<string, number>;
  rowsByTier: Record<string, number>;
  rowsByStatus: Record<string, number>;
  legacyRowsChanged: boolean;
  remainingPlayersOrderChanged: boolean;
  experimentReadiness?: {
    legacyReady: boolean;
    blackbirdPreviewReady: boolean;
    blackbirdExperimentEligible: boolean;
    failedExperimentGates: string[];
  };
};

export type H10SideBySideFeatureFlags = {
  previewEnabled: boolean;
  experimentEnabled: boolean;
};

export type H10SideBySideRoomDiagnostics = {
  source: string;
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  defaultsChanged: boolean;
  remainingPlayerOrderUnchanged: boolean;
  legacyRecommendationsUnchanged: boolean;
  blackbirdEligible: boolean;
  failedExperimentGates: string[];
  topLegacyRows: H10SideBySideLegacyRow[];
  topBlackbirdRows: H10SideBySideBlackbirdRow[];
  overlapCount: number;
  disagreementCount: number;
  overlap: Array<{ legacyName: string; blackbirdName: string; position: string | null; classification: H10SideBySideDifferenceClassification }>;
  blackbirdOnlyTargets: H10SideBySideBlackbirdRow[];
  legacyOnlyTargets: H10SideBySideLegacyRow[];
  watchOrAvoidInBoth: Array<{ legacyName: string; blackbirdName: string; position: string | null }>;
  disagreementCounts: Record<H10SideBySideDifferenceClassification, number>;
  examples: Array<{
    classification: H10SideBySideDifferenceClassification;
    legacyName: string | null;
    blackbirdName: string | null;
    position: string | null;
    reason: string;
  }>;
  warningCounts: Record<string, number>;
  rowsByTier: Record<string, number>;
  rowsByStatus: Record<string, number>;
  safetyAssertions: H10SideBySideSafetyAssertions;
};

export type H10SideBySideSafetyAssertions = {
  defaultSourceRemainsLegacy: boolean;
  blackbirdDoesNotMutateLegacyRows: boolean;
  blackbirdDoesNotMutateAvailablePlayerOrder: boolean;
  sourceSwitchingDoesNotPersistState: boolean;
  noBannedRecommendationLanguage: boolean;
  noAiAdviceLanguage: boolean;
  noRecommendationPersistence: boolean;
  noProjectionMutation: boolean;
  noLegacyReplacement: boolean;
};

export type H10SideBySideDiagnosticsArtifact = {
  generatedAt: string;
  artifactVersion: "h10.9-war-room-side-by-side-diagnostics-v1";
  featureFlags: H10SideBySideFeatureFlags;
  roomInventory: Array<Pick<H10SideBySideRoomInput, "source" | "draftRoomId" | "leagueId" | "leagueName">>;
  rooms: H10SideBySideRoomDiagnostics[];
  aggregate: {
    roomsCompared: number;
    blackbirdEligibleRooms: number;
    overlapCount: number;
    disagreementCount: number;
    disagreementCounts: Record<H10SideBySideDifferenceClassification, number>;
    safetyAssertions: H10SideBySideSafetyAssertions;
    disagreementIsFailure: false;
  };
};

const CLASSIFICATIONS: H10SideBySideDifferenceClassification[] = [
  "SAME_TARGET",
  "SIMILAR_POSITION_DIFFERENT_PLAYER",
  "BLACKBIRD_HIGHER_VALUE",
  "LEGACY_HIGHER_SCORE",
  "BLACKBIRD_HAS_PROJECTION_LEGACY_MISSING",
  "LEGACY_HAS_ROW_BLACKBIRD_INSUFFICIENT_DATA",
  "FORMAT_OR_CONFIDENCE_SUPPRESSION",
];

const BANNED_RECOMMENDATION_LANGUAGE = /\b(ai says|guaranteed|must draft|lock|best pick)\b/i;
const AI_ADVICE_LANGUAGE = /\b(ai advice|ai-generated advice|machine says|model says)\b/i;

export function buildH10WarRoomSideBySideDiagnostics(input: {
  generatedAt: string;
  featureFlags: H10SideBySideFeatureFlags;
  rooms: H10SideBySideRoomInput[];
}): H10SideBySideDiagnosticsArtifact {
  const rooms = input.rooms.map((room) => compareRoom(room));
  const aggregateSafety = aggregateSafetyAssertions(rooms.map((room) => room.safetyAssertions));
  return {
    generatedAt: input.generatedAt,
    artifactVersion: "h10.9-war-room-side-by-side-diagnostics-v1",
    featureFlags: input.featureFlags,
    roomInventory: input.rooms.map((room) => ({
      source: room.source,
      draftRoomId: room.draftRoomId,
      leagueId: room.leagueId,
      leagueName: room.leagueName,
    })),
    rooms,
    aggregate: {
      roomsCompared: rooms.length,
      blackbirdEligibleRooms: rooms.filter((room) => room.blackbirdEligible).length,
      overlapCount: sum(rooms.map((room) => room.overlapCount)),
      disagreementCount: sum(rooms.map((room) => room.disagreementCount)),
      disagreementCounts: mergeClassificationCounts(rooms.map((room) => room.disagreementCounts)),
      safetyAssertions: aggregateSafety,
      disagreementIsFailure: false,
    },
  };
}

export function compareRoom(room: H10SideBySideRoomInput, topN = 10): H10SideBySideRoomDiagnostics {
  const topLegacyRows = room.legacyRecommendationTopRows.slice(0, topN);
  const topBlackbirdRows = room.topRecommendations.slice(0, topN);
  const overlap = findOverlap(topLegacyRows, topBlackbirdRows);
  const blackbirdOnlyTargets = topBlackbirdRows.filter((blackbird) => !topLegacyRows.some((legacy) => isSamePlayer(legacy.player_name, blackbird.displayName)));
  const legacyOnlyTargets = topLegacyRows.filter((legacy) => !topBlackbirdRows.some((blackbird) => isSamePlayer(legacy.player_name, blackbird.displayName)));
  const overlapExamples = overlap.map((match) => ({
    classification: match.classification,
    legacyName: match.legacyName,
    blackbirdName: match.blackbirdName,
    position: match.position,
    reason: "Both systems surfaced the same player.",
  }));
  const blackbirdExamples = blackbirdOnlyTargets.slice(0, 5).map((row) => ({
    classification: classifyBlackbirdOnly(row),
    legacyName: null,
    blackbirdName: row.displayName,
    position: row.position,
    reason: row.primaryReason ?? "Blackbird surfaced a target not present in the legacy top rows.",
  }));
  const legacyExamples = legacyOnlyTargets.slice(0, 5).map((row) => ({
    classification: classifyLegacyOnly(row, topBlackbirdRows),
    legacyName: row.player_name,
    blackbirdName: null,
    position: row.position,
    reason: "Legacy surfaced a target not present in the Blackbird top rows.",
  }));
  const examples = [...overlapExamples, ...blackbirdExamples, ...legacyExamples];
  const disagreementClassifications = [
    ...overlap.map((match) => match.classification),
    ...blackbirdOnlyTargets.map((row) => classifyBlackbirdOnly(row)),
    ...legacyOnlyTargets.map((row) => classifyLegacyOnly(row, topBlackbirdRows)),
  ];
  const disagreementCounts = countClassifications(disagreementClassifications);

  return {
    source: room.source,
    draftRoomId: room.draftRoomId,
    leagueId: room.leagueId,
    leagueName: room.leagueName,
    defaultsChanged: DEFAULT_H10_RECOMMENDATION_SOURCE !== "legacy",
    remainingPlayerOrderUnchanged: !room.remainingPlayersOrderChanged,
    legacyRecommendationsUnchanged: !room.legacyRowsChanged,
    blackbirdEligible: Boolean(room.experimentReadiness?.blackbirdExperimentEligible),
    failedExperimentGates: room.experimentReadiness?.failedExperimentGates ?? [],
    topLegacyRows,
    topBlackbirdRows,
    overlapCount: overlap.length,
    disagreementCount: blackbirdOnlyTargets.length + legacyOnlyTargets.length + overlap.filter((match) => match.classification !== "SAME_TARGET").length,
    overlap,
    blackbirdOnlyTargets,
    legacyOnlyTargets,
    watchOrAvoidInBoth: overlap
      .filter((match) => match.classification === "SAME_TARGET")
      .map((match) => ({ legacyName: match.legacyName, blackbirdName: match.blackbirdName, position: match.position })),
    disagreementCounts,
    examples,
    warningCounts: room.warningCounts,
    rowsByTier: room.rowsByTier,
    rowsByStatus: room.rowsByStatus,
    safetyAssertions: buildSafetyAssertions(room),
  };
}

function findOverlap(legacyRows: H10SideBySideLegacyRow[], blackbirdRows: H10SideBySideBlackbirdRow[]) {
  return legacyRows.flatMap((legacy) => {
    const blackbird = blackbirdRows.find((row) => isSamePlayer(legacy.player_name, row.displayName));
    if (!blackbird) return [];
    return [{
      legacyName: legacy.player_name ?? "",
      blackbirdName: blackbird.displayName,
      position: blackbird.position ?? legacy.position,
      classification: classifyMatchedRows(legacy, blackbird),
    }];
  });
}

function classifyMatchedRows(
  legacy: H10SideBySideLegacyRow,
  blackbird: H10SideBySideBlackbirdRow
): H10SideBySideDifferenceClassification {
  if (isSuppressed(blackbird)) return "FORMAT_OR_CONFIDENCE_SUPPRESSION";
  if (legacy.draftTargetScore !== null && legacy.draftTargetScore > blackbird.recommendationScore) return "LEGACY_HIGHER_SCORE";
  if ((blackbird.scoreComponents?.leagueValue ?? 0) > 0) return "BLACKBIRD_HIGHER_VALUE";
  return "SAME_TARGET";
}

function classifyBlackbirdOnly(row: H10SideBySideBlackbirdRow): H10SideBySideDifferenceClassification {
  if (isSuppressed(row)) return "FORMAT_OR_CONFIDENCE_SUPPRESSION";
  if (row.status === "recommendable" || row.status === "watch_only") return "BLACKBIRD_HAS_PROJECTION_LEGACY_MISSING";
  return "BLACKBIRD_HIGHER_VALUE";
}

function classifyLegacyOnly(
  row: H10SideBySideLegacyRow,
  blackbirdRows: H10SideBySideBlackbirdRow[]
): H10SideBySideDifferenceClassification {
  const similarPosition = blackbirdRows.some((blackbird) => normalizePosition(blackbird.position) === normalizePosition(row.position));
  if (blackbirdRows.some((blackbird) => blackbird.recommendationTier === "insufficient_data" || blackbird.status === "missing_projection")) {
    return "LEGACY_HAS_ROW_BLACKBIRD_INSUFFICIENT_DATA";
  }
  return similarPosition ? "SIMILAR_POSITION_DIFFERENT_PLAYER" : "LEGACY_HIGHER_SCORE";
}

function buildSafetyAssertions(room: H10SideBySideRoomInput): H10SideBySideSafetyAssertions {
  const text = [
    ...H10_RECOMMENDATION_READINESS_LABELS,
    ...room.topRecommendations.flatMap((row) => [row.displayName, row.primaryReason ?? "", ...(row.warningCodes ?? [])]),
  ].join(" ");
  return {
    defaultSourceRemainsLegacy: DEFAULT_H10_RECOMMENDATION_SOURCE === "legacy",
    blackbirdDoesNotMutateLegacyRows: !room.legacyRowsChanged,
    blackbirdDoesNotMutateAvailablePlayerOrder: !room.remainingPlayersOrderChanged,
    sourceSwitchingDoesNotPersistState: true,
    noBannedRecommendationLanguage: !BANNED_RECOMMENDATION_LANGUAGE.test(text),
    noAiAdviceLanguage: !AI_ADVICE_LANGUAGE.test(text),
    noRecommendationPersistence: true,
    noProjectionMutation: true,
    noLegacyReplacement: !room.legacyRowsChanged,
  };
}

function aggregateSafetyAssertions(assertions: H10SideBySideSafetyAssertions[]): H10SideBySideSafetyAssertions {
  const keys = Object.keys(assertions[0] ?? buildSafetyAssertions({
    source: "fixture",
    draftRoomId: "",
    leagueId: "",
    leagueName: null,
    legacyRecommendationTopRows: [],
    topRecommendations: [],
    warningCounts: {},
    rowsByTier: {},
    rowsByStatus: {},
    legacyRowsChanged: false,
    remainingPlayersOrderChanged: false,
  })) as Array<keyof H10SideBySideSafetyAssertions>;
  return Object.fromEntries(keys.map((key) => [key, assertions.every((row) => row[key])])) as H10SideBySideSafetyAssertions;
}

function isSuppressed(row: H10SideBySideBlackbirdRow) {
  return row.status === "format_excluded" || row.status === "insufficient_context" || row.recommendationTier === "insufficient_data";
}

function isSamePlayer(left: string | null | undefined, right: string | null | undefined) {
  return normalizeName(left) !== "" && normalizeName(left) === normalizeName(right);
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePosition(value: string | null | undefined) {
  return (value ?? "UNK").toUpperCase();
}

function countClassifications(values: H10SideBySideDifferenceClassification[]) {
  const counts = Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<H10SideBySideDifferenceClassification, number>;
  for (const value of values) counts[value] += 1;
  return counts;
}

function mergeClassificationCounts(values: Array<Record<H10SideBySideDifferenceClassification, number>>) {
  const counts = countClassifications([]);
  for (const row of values) {
    for (const classification of CLASSIFICATIONS) counts[classification] += row[classification] ?? 0;
  }
  return counts;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
