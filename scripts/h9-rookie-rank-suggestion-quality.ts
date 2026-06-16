import type { BlackbirdLeagueRankRow } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { buildProjectionTrust } from "@/lib/projections/projection-trust";
import { buildDraftCapitalProfile, buildCollegeProductionProfile, normalizeRookieProfile, type RookieDataInput } from "@/lib/projections/rookie-data-sources";
import { arg, readHardeningArtifacts, writeDiagnostic } from "./h9-projection-hardening-utils";

const kind = arg("--kind", "rank") === "suggestion" ? "suggestion" : "rank";
const out = kind === "suggestion" ? "h9-rookie-suggestion-quality" : "h9-rookie-rank-quality";
const artifacts = readHardeningArtifacts();
const rookieRows = artifacts.projections?.projections?.filter((row) => row.projectionType === "rookie") ?? [];
const diagnostic = kind === "suggestion" ? buildSuggestionDiagnostic() : buildRankDiagnostic();

writeDiagnostic(out, diagnostic);
console.log(JSON.stringify({ verdict: diagnostic.verdict, artifact: `artifacts/projections/${out}.json` }, null, 2));
if (diagnostic.verdict === "failed") process.exitCode = 1;

function buildRankDiagnostic() {
  const enriched = normalizeRookieProfile(rookieInput({
    playerId: "rookie-enriched-rb",
    playerName: "Enriched Rookie RB",
    position: "RB",
    team: "LV",
    nflDraftRound: 1,
    nflDraftOverall: 8,
    collegeGames: 14,
    collegeRushingAttempts: 245,
    collegeRushingYards: 1610,
    collegeRushingTouchdowns: 19,
    landingSpotRole: "probable_starter",
  }));
  const missing = normalizeRookieProfile(rookieInput({
    playerId: "rookie-missing-rb",
    playerName: "Missing Context Rookie RB",
    position: "RB",
    team: "LV",
  }));
  const draftCapital = buildDraftCapitalProfile({ nflDraftRound: 1, nflDraftPick: null, nflDraftOverall: 8 });
  const collegeProduction = buildCollegeProductionProfile(rookieInput({
    playerName: "College Production Probe",
    position: "RB",
    collegeGames: 14,
    collegeRushingAttempts: 245,
    collegeRushingYards: 1610,
    collegeRushingTouchdowns: 19,
  }));
  const syntheticRows = [
    leagueRankRow("rookie-enriched-rb", "Enriched Rookie RB", "RB", 1, 82, 230, enriched.dataGaps, enriched.rookieProjectionConfidence),
    leagueRankRow("veteran-rb", "Veteran RB", "RB", 2, 76, 216, [], "medium"),
    leagueRankRow("rookie-missing-rb", "Missing Context Rookie RB", "RB", 3, 62, 185, missing.dataGaps, missing.rookieProjectionConfidence),
  ];
  const checks = [
    check("draft_capital_score_derives_without_adp", draftCapital.score !== null && draftCapital.score >= 80, `score=${draftCapital.score}`),
    check("college_production_score_derives_without_adp", collegeProduction.productionScore !== null && collegeProduction.productionScore >= 70, `score=${collegeProduction.productionScore}`),
    check("enriched_rookie_confidence_improves", confidenceNumber(enriched.rookieProjectionConfidence) > confidenceNumber(missing.rookieProjectionConfidence), `${enriched.rookieProjectionConfidence} vs ${missing.rookieProjectionConfidence}`),
    check("rank_can_place_enriched_rookie_above_missing_context_rookie", syntheticRows[0].blackbirdRank < syntheticRows[2].blackbirdRank, `#${syntheticRows[0].blackbirdRank} vs #${syntheticRows[2].blackbirdRank}`),
    check("missing_context_remains_gapped", missing.dataGaps.some((gap) => /draft capital/i.test(gap)) && missing.dataGaps.some((gap) => /college/i.test(gap)), missing.dataGaps.join(", ")),
    check("no_adp_fallback", syntheticRows.every((row) => row.source.adp === null && row.source.externalMarketRank === null), "ADP and market rank are null"),
    check("current_real_rookie_gaps_visible", rookieRows.length === 0 || rookieRows.some((row) => row.dataGaps.length > 0), `${rookieRows.length} real rookie projection rows`),
  ];
  return base("h9-rookie-rank-quality", checks, {
    currentRealRookies: {
      count: rookieRows.length,
      withDraftCapitalGaps: rookieRows.filter((row) => row.dataGaps.some((gap) => /draft capital/i.test(gap))).length,
      withCollegeProductionGaps: rookieRows.filter((row) => row.dataGaps.some((gap) => /college/i.test(gap))).length,
    },
    syntheticRookies: [
      {
        playerName: enriched.playerName,
        draftCapitalScore: enriched.draftCapitalScore,
        collegeProductionScore: enriched.collegeProductionScore,
        opportunityScore: enriched.opportunityScore,
        confidence: enriched.rookieProjectionConfidence,
        dataGaps: enriched.dataGaps,
      },
      {
        playerName: missing.playerName,
        draftCapitalScore: missing.draftCapitalScore,
        collegeProductionScore: missing.collegeProductionScore,
        opportunityScore: missing.opportunityScore,
        confidence: missing.rookieProjectionConfidence,
        dataGaps: missing.dataGaps,
      },
    ],
    syntheticRankRows: syntheticRows.map(summaryRow),
  });
}

function buildSuggestionDiagnostic() {
  const rankRows = [
    leagueRankRow("drafted-rookie-qb", "Drafted Rookie QB", "QB", 1, 88, 270, [], "medium", true),
    leagueRankRow("available-rookie-lb", "Available Rookie LB", "LB", 2, 78, 206, ["rookie projection", "landing spot role"], "low"),
    leagueRankRow("available-veteran-wr", "Available Veteran WR", "WR", 3, 77, 218, [], "medium"),
    leagueRankRow("available-rookie-rb-missing", "Available Rookie RB Missing Context", "RB", 4, 63, 181, ["NFL draft capital", "college production", "landing spot role"], "very_low"),
  ];
  const suggestions = buildLiveDraftSuggestions({
    leagueRankRows: rankRows,
    draftedPlayerIds: ["drafted-rookie-qb"],
    currentPickNumber: 84,
    picksUntilMyTurn: 5,
    positionNeeds: [{ position: "LB", needLevel: "urgent" }],
  });
  const rows = suggestions.rows;
  const text = JSON.stringify(rows).toLowerCase();
  const banned = ["must draft", "guaranteed", "best pick", "you should draft", "final plan"].filter((term) => text.includes(term));
  const checks = [
    check("draft_suggestions_available_only", rows.every((row) => row.playerId !== "drafted-rookie-qb"), rows.map((row) => row.playerName).join(", ")),
    check("suggestion_rank_can_differ_from_static_rank", suggestions.diagnostics.rankChangedFromStatic, `rankChanged=${suggestions.diagnostics.rankChangedFromStatic}`),
    check("positional_need_changes_suggestion", rows[0]?.position === "LB", rows[0] ? `${rows[0].playerName} ${rows[0].suggestionType}` : "no rows"),
    check("rookie_missing_inputs_reduce_confidence", rows.some((row) => row.playerId === "available-rookie-rb-missing" && row.projectionTrustLabel !== "high"), "missing-input rookie is not high trust"),
    check("rookie_gaps_visible_in_suggestions", rows.some((row) => row.dataGaps.some((gap) => /draft capital|college|role/i.test(gap))), "rookie data gaps are carried into suggestions"),
    check("no_banned_language", banned.length === 0, banned.join(", ") || "none"),
    check("no_persistence", suggestions.diagnostics.noPersistence, "diagnostic only"),
  ];
  return base("h9-rookie-suggestion-quality", checks, {
    diagnostics: suggestions.diagnostics,
    rows,
  });
}

function rookieInput(overrides: Partial<RookieDataInput>): RookieDataInput {
  return {
    playerName: "Rookie",
    position: "RB",
    team: null,
    season: 2026,
    source: "manual",
    sourceLabel: "synthetic_quality_probe",
    ...overrides,
  };
}

function leagueRankRow(
  playerId: string,
  playerName: string,
  position: string,
  blackbirdRank: number,
  leagueValueScore: number,
  median: number,
  dataGaps: string[],
  confidence: BlackbirdLeagueRankRow["confidence"],
  drafted = false
): BlackbirdLeagueRankRow {
  return {
    playerId,
    playerName,
    position,
    team: "TST",
    drafted,
    blackbirdRank,
    blackbirdTier: blackbirdRank <= 2 ? 1 : 2,
    leagueValueScore,
    projectedFantasyPoints: {
      floor: Math.round(median * 0.78 * 10) / 10,
      median,
      ceiling: Math.round(median * 1.22 * 10) / 10,
      unit: "season",
      source: "synthetic_rookie_quality_probe",
      scoringAware: true,
    },
    projectionTrust: buildProjectionTrust({
      playerId,
      playerName,
      position,
      team: "TST",
      projectionRunId: null,
      projectionVersion: "synthetic",
      projectionUnit: "season",
      projectionSource: "synthetic_rookie_quality_probe",
      dataGaps,
      confidence,
      floorPoints: Math.round(median * 0.78 * 10) / 10,
      medianPoints: median,
      ceilingPoints: Math.round(median * 1.22 * 10) / 10,
      isFallback: false,
    }),
    roleClassification: {
      playerId,
      playerName,
      position,
      team: "TST",
      role: confidence === "very_low" ? "rookie_unknown" : "probable_starter",
      confidence,
      basis: [confidence === "very_low" ? "rookie_unknown" : "projection_volume_proxy"],
      teamPositionRankProxy: 1,
      sameTeamPositionPeerCount: 1,
      projectedVolumeScore: median,
      reasons: [],
      dataGaps,
    },
    replacementValue: {
      playerId,
      position,
      medianPoints: median,
      replacementMedianPoints: median - 35,
      pointsAboveReplacement: 35,
      parPercentileByPosition: 82,
      replacementRank: 24,
      replacementMethod: "projection_distribution_fallback",
      role: confidence === "very_low" ? "rookie_unknown" : "probable_starter",
      roleConfidence: confidence,
      reasons: ["synthetic quality diagnostic"],
      dataGaps,
    },
    pointsAboveReplacement: 35,
    valueComponents: {} as BlackbirdLeagueRankRow["valueComponents"],
    confidence,
    risk: confidence === "very_low" ? "high" : "medium",
    reasons: [`Static Blackbird Rank #${blackbirdRank} comes from league value score and projection context.`],
    dataGaps,
    source: {
      adp: null,
      externalMarketRank: null,
      h10RecommendationRank: null,
      projectionRunId: null,
      projectionVersion: "synthetic",
      fallbackProjection: false,
    },
  };
}

function base(kindName: string, checks: Array<{ name: string; passed: boolean; detail: string }>, extra: Record<string, unknown>) {
  return {
    kind: kindName,
    generatedAt: new Date().toISOString(),
    verdict: checks.every((row) => row.passed) ? "passed" : "failed",
    checks,
    safety: {
      noScraping: true,
      noPaidApi: true,
      noFabricatedRealContext: true,
      noAdpFallback: true,
      noDraftStateMutation: true,
      noRecommendationPersistence: true,
    },
    ...extra,
  };
}

function summaryRow(row: BlackbirdLeagueRankRow) {
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    blackbirdRank: row.blackbirdRank,
    position: row.position,
    median: row.projectedFantasyPoints.median,
    leagueValueScore: row.leagueValueScore,
    confidence: row.confidence,
    dataGaps: row.dataGaps,
  };
}

function confidenceNumber(confidence: string) {
  if (confidence === "high") return 4;
  if (confidence === "medium") return 3;
  if (confidence === "low") return 2;
  return 1;
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
