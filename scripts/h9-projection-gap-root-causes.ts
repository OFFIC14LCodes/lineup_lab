import { buildProjectionTrustRows, countBy, readHardeningArtifacts, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";

const artifacts = readHardeningArtifacts();
const trustRows = buildProjectionTrustRows(artifacts);
const fallbackRows = trustRows.filter((row) => row.projectionSource === "fallback_projection" || row.fallbackReason !== null);
const strictFallbackRows = trustRows.filter((row) => row.projectionSource === "fallback_projection");
const blackbirdRankFallbacks = fallbackRows.filter((row) => row.hasScoredFantasyProjection || row.trustLabel !== "very_low");
const draftSuggestionFallbacks = fallbackRows.filter((row) => row.trustScore >= 30);
const highRiskSilentlyPromoted = fallbackRows.filter((row) => row.trustScore >= 55);
const unknownUnitHighRank = trustRows.filter((row) => row.projectionUnit === "unknown" && row.trustScore >= 30);
const failures = [
  !artifacts.projections ? "missing projection artifact" : null,
  !artifacts.scoring ? "missing scoring artifact" : null,
  highRiskSilentlyPromoted.length ? "fallback-only rows can reach medium/high trust" : null,
  unknownUnitHighRank.length ? "unknown projection unit on non-low trust row" : null,
].filter((item): item is string => Boolean(item));

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: failures.length ? "failed" : "passed",
  failureReasons: failures,
  totals: {
    totalPlayers: trustRows.length,
    statBackedProjectionCount: trustRows.filter((row) => row.hasStatBackedProjection).length,
    fallbackProjectionCount: strictFallbackRows.length,
    fallbackOrCaveatedProjectionCount: fallbackRows.length,
  },
  fallbackPlayersByPosition: countBy(fallbackRows.map((row) => row.position)),
  fallbackPlayersByActiveInactiveStatus: {
    activeOrUnknown: fallbackRows.filter((row) => row.fallbackReason !== "inactive_or_deep_pool").length,
    inactiveOrDeepPool: fallbackRows.filter((row) => row.fallbackReason === "inactive_or_deep_pool").length,
  },
  fallbackPlayersByDraftedUndraftedStatus: {
    unknownFromProjectionArtifact: fallbackRows.length,
  },
  fallbackPlayersByRookieVeteranStatus: {
    rookieMissingInputs: fallbackRows.filter((row) => row.fallbackReason === "rookie_missing_inputs").length,
    veteranOrUnknownMissingStats: fallbackRows.filter((row) => row.fallbackReason === "no_historical_stats" || row.fallbackReason === "missing_projected_components").length,
  },
  fallbackPlayersByMissingSourceDataReason: countBy(fallbackRows.map((row) => row.fallbackReason ?? "unknown")),
  fallbackPlayersWithNoWeeklyStats: fallbackRows.filter((row) => row.dataGaps.some((gap) => /weekly|historical/i.test(gap))).length,
  fallbackPlayersWithUnresolvedIdentity: fallbackRows.filter((row) => row.fallbackReason === "unresolved_identity").length,
  fallbackPlayersWithUnsupportedPosition: fallbackRows.filter((row) => row.fallbackReason === "unsupported_position").length,
  fallbackPlayersWithOnlyPartialStatHistory: fallbackRows.filter((row) => row.dataGaps.some((gap) => /limited historical|partial/i.test(gap))).length,
  fallbackPlayersStillAppearingInBlackbirdRank: blackbirdRankFallbacks.length,
  fallbackPlayersStillAppearingInDraftSuggestions: draftSuggestionFallbacks.length,
  highestBlackbirdRankFallbackPlayers: fallbackRows.slice(0, 25).map(summary),
  highestDraftSuggestionFallbackPlayers: draftSuggestionFallbacks.slice(0, 25).map(summary),
  fallbackPlayersWithVisibleUiCaveats: fallbackRows.filter((row) => row.dataGaps.length || row.reasons.length).length,
  fallbackPlayersWithoutVisibleUiCaveats: fallbackRows.filter((row) => !row.dataGaps.length && !row.reasons.length).length,
  topFallbackDataGaps: topEntries(countBy(fallbackRows.flatMap((row) => row.dataGaps))),
  checks: [
    check("fallback_reasons_visible", fallbackRows.every((row) => row.dataGaps.length || row.reasons.length), "fallback rows carry reasons or data gaps"),
    check("fallback_not_zero", fallbackRows.every((row) => !row.hasScoredFantasyProjection || row.trustLabel === "very_low"), "fallback rows are not elevated by zero-like scoring"),
    check("no_high_rank_fallback_without_caution", highRiskSilentlyPromoted.length === 0, `${highRiskSilentlyPromoted.length} rows`),
    check("projection_unit_known_for_trusted_rows", unknownUnitHighRank.length === 0, `${unknownUnitHighRank.length} rows`),
  ],
};

writeDiagnostic("h9-projection-gap-root-causes", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-projection-gap-root-causes.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function summary(row: (typeof trustRows)[number]) {
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    trustScore: row.trustScore,
    trustLabel: row.trustLabel,
    fallbackReason: row.fallbackReason,
    dataGaps: row.dataGaps.slice(0, 5),
  };
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
